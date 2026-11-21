"""
Door staff link: rntech.live/door/<token> — one secret link per event for whoever is on the door.

No login and no access to anything else: it only lists that event's tickets and checks people in.
The link works from 24 hours before the event starts until 3 hours after it ends (or 12 hours after
the start when there's no end time), so a link that gets passed around goes dead on its own.
Ben gets/resets the link from the admin Door tab; resetting kills the old one straight away.
"""
import hashlib
import re
import secrets
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Event, Ticket, TicketType

router = APIRouter()
UK = ZoneInfo("Europe/London")
OPENS_BEFORE = timedelta(hours=24)
CLOSES_AFTER_END = timedelta(hours=3)
SITE = "https://rntech.live"


def _parse_time(s: str):
    """'8:00 PM', '20:00', '8pm' → (hour, minute), or None."""
    m = re.match(r"\s*(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?", (s or "").lower())
    if not m:
        return None
    h, mins, ampm = int(m.group(1)), int(m.group(2) or 0), m.group(3)
    if ampm:
        h = h % 12 + (12 if ampm.startswith("p") else 0)
    return (h, mins) if h < 24 and mins < 60 else None


def door_window(ev: Event):
    """(opens, closes) as UK-aware datetimes, or (None, None) when the event has no usable date."""
    try:
        day = datetime.strptime(ev.date or "", "%Y-%m-%d")
    except ValueError:
        return None, None
    st = _parse_time(ev.start_time) or (18, 0)
    start = day.replace(hour=st[0], minute=st[1], tzinfo=UK)
    et = _parse_time(ev.end_time)
    if et:
        end = day.replace(hour=et[0], minute=et[1], tzinfo=UK)
        if end <= start:            # finishes after midnight
            end += timedelta(days=1)
        closes = end + CLOSES_AFTER_END
    else:
        closes = start + timedelta(hours=12)
    return start - OPENS_BEFORE, closes


def _state(ev: Event):
    opens, closes = door_window(ev)
    now = datetime.now(UK)
    if not opens:
        return "closed", opens, closes
    return ("early" if now < opens else "closed" if now > closes else "open"), opens, closes


def _event_for(token: str, db: Session) -> Event:
    ev = db.query(Event).filter(Event.door_token == token).first() if token and len(token) >= 20 else None
    if not ev:
        raise HTTPException(404, "This door link isn't valid — ask for a new one")
    return ev


def _open_event(token: str, db: Session) -> Event:
    ev = _event_for(token, db)
    state, _, _ = _state(ev)
    if state != "open":
        raise HTTPException(403, "The door list isn't open right now")
    return ev


def _mask_email(e: str) -> str:
    user, _, dom = (e or "").partition("@")
    return (user[:2] + "•••@" + dom) if dom else ""


def _door_ticket(t: Ticket, types: dict) -> dict:
    # Just enough to find someone and let them in — no full emails or QR codes leave the server
    return {"id": t.id, "eventId": t.event_id, "holderName": t.holder_name, "holderEmail": _mask_email(t.holder_email),
            "qrCode": "", "status": t.status, "ticketTypeName": types.get(t.ticket_type_id, "—"),
            # groups one buyer's tickets into one card without sending their real email
            "groupKey": hashlib.sha256((t.holder_email or t.holder_name or "").strip().lower().encode()).hexdigest()[:12]}


# ── Public: the door page ─────────────────────────────────────────────────────

@router.get("/door/{token}")
def door_info(token: str, db: Session = Depends(get_db)):
    ev = _event_for(token, db)
    state, opens, closes = _state(ev)
    return {"state": state, "opensAt": opens.isoformat() if opens else None, "closesAt": closes.isoformat() if closes else None,
            "event": {"id": ev.id, "title": ev.title, "displayDate": ev.display_date or ev.date, "venue": ev.venue,
                      "startTime": ev.start_time, "endTime": ev.end_time}}


@router.get("/door/{token}/tickets")
def door_tickets(token: str, db: Session = Depends(get_db)):
    ev = _open_event(token, db)
    types = {tt.id: tt.name for tt in db.query(TicketType).filter(TicketType.event_id == ev.id).all()}
    rows = db.query(Ticket).filter(Ticket.event_id == ev.id, Ticket.status != "cancelled").order_by(Ticket.holder_name).all()
    return [_door_ticket(t, types) for t in rows]


def _check_in(t: Ticket, ev: Event, db: Session) -> dict:
    tt = db.query(TicketType).filter(TicketType.id == t.ticket_type_id).first()
    d = _door_ticket(t, {t.ticket_type_id: tt.name if tt else "—"})
    d["eventTitle"] = ev.title
    d["alreadyUsed"] = t.status == "used"
    if t.status == "cancelled":
        raise HTTPException(409, "This ticket was cancelled")
    if t.status == "valid":
        t.status = "used"
        db.commit()
        d["status"] = "used"
    return d


@router.post("/door/{token}/checkin/ticket/{ticket_id}")
def door_checkin_ticket(token: str, ticket_id: str, db: Session = Depends(get_db)):
    ev = _open_event(token, db)
    t = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.event_id == ev.id).first()
    if not t:
        raise HTTPException(404, "Ticket not found for this event")
    return _check_in(t, ev, db)


@router.post("/door/{token}/checkin/qr/{qr_code}")
def door_checkin_qr(token: str, qr_code: str, db: Session = Depends(get_db)):
    ev = _open_event(token, db)
    t = db.query(Ticket).filter(Ticket.qr_code == qr_code.strip().upper()).first()
    if not t:
        raise HTTPException(404, "Ticket not found — invalid QR code")
    if t.event_id != ev.id:
        other = db.query(Event).filter(Event.id == t.event_id).first()
        raise HTTPException(409, f"This ticket is for {other.title if other else 'another event'}, not this one")
    return _check_in(t, ev, db)


@router.post("/door/{token}/undo/{ticket_id}")
def door_undo(token: str, ticket_id: str, db: Session = Depends(get_db)):
    ev = _open_event(token, db)
    t = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.event_id == ev.id).first()
    if not t:
        raise HTTPException(404, "Ticket not found for this event")
    if t.status == "used":
        t.status = "valid"
        db.commit()
    return {"id": t.id, "status": t.status}


# ── Admin: get / reset an event's door link ───────────────────────────────────

def _link_info(ev: Event) -> dict:
    state, opens, closes = _state(ev)
    return {"url": f"{SITE}/door/{ev.door_token}", "state": state,
            "opensAt": opens.isoformat() if opens else None, "closesAt": closes.isoformat() if closes else None}


@router.get("/admin/events/{event_id}/door-link")
def get_door_link(event_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    if not ev.door_token:
        ev.door_token = secrets.token_urlsafe(18)
        db.commit()
    return _link_info(ev)


@router.post("/admin/events/{event_id}/door-link/reset")
def reset_door_link(event_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    ev.door_token = secrets.token_urlsafe(18)
    db.commit()
    return _link_info(ev)
