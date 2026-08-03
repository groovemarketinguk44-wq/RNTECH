import json
import secrets
from datetime import datetime, timedelta
from pathlib import Path
import os
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from ..database import get_db
from ..models import Event, TicketType, EventInterest, Ticket, User, EmailCampaign, EmailSend
from ..auth import require_admin, require_user, hash_password, verify_password, create_token, get_current_user
from ..email_service import send_email

router = APIRouter()
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://rntech.live")


def _tt_dict(tt: TicketType) -> dict:
    tiers = json.loads(tt.tiers_json or "[]")
    total_capacity = sum(t.get("capacity", 0) for t in tiers) if tt.is_tiered and tiers else tt.capacity
    return {
        "id": tt.id, "eventId": tt.event_id, "name": tt.name,
        "price": tt.effective_price, "capacity": total_capacity, "soldCount": tt.sold_count,
        "active": tt.active, "description": tt.description,
        "isTiered": bool(tt.is_tiered), "tiers": tiers,
    }


def _event_dict(e: Event) -> dict:
    return {
        "id": e.id, "title": e.title, "slug": e.slug,
        "date": e.date, "displayDate": e.display_date,
        "startTime": e.start_time, "endTime": e.end_time,
        "venue": e.venue, "location": e.location,
        "description": e.description,
        "posterImage": f"/uploads/{e.poster_image}" if e.poster_image else None,
        "lineup": e.lineup, "giveaways": e.giveaways,
        "status": e.status, "isFree": e.is_free, "featured": e.featured,
        "registrationMode": e.registration_mode or "open",
        "ticketTypes": [_tt_dict(tt) for tt in e.ticket_types],
    }


# ── Public ──────────────────────────────────────────────────────────────────

@router.get("/events")
def get_events(db: Session = Depends(get_db)):
    events = db.query(Event).order_by(Event.date.desc()).all()
    return [_event_dict(e) for e in events]


@router.get("/events/{event_id}")
def get_event(event_id: str, db: Session = Depends(get_db)):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(404, "Event not found")
    return _event_dict(e)


# ── Admin: Events CRUD ───────────────────────────────────────────────────────

class EventIn(BaseModel):
    title: str
    date: str = ""
    displayDate: str = ""
    startTime: str = ""
    endTime: str = ""
    venue: str = ""
    location: str = ""
    description: str = ""
    lineup: List[dict] = []
    giveaways: List[str] = []
    status: str = "upcoming"
    isFree: bool = True
    featured: bool = False
    registrationMode: str = "open"


@router.post("/admin/events")
def create_event(data: EventIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    slug = data.title.lower().replace(" ", "-") + "-" + secrets.token_hex(3)
    e = Event(
        id="evt-" + secrets.token_hex(8),
        title=data.title.upper(),
        slug=slug,
        date=data.date,
        display_date=data.displayDate,
        start_time=data.startTime,
        end_time=data.endTime,
        venue=data.venue,
        location=data.location,
        description=data.description,
        lineup_json=json.dumps(data.lineup),
        giveaways_json=json.dumps(data.giveaways),
        status=data.status,
        is_free=data.isFree,
        featured=data.featured,
        registration_mode=data.registrationMode,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _event_dict(e)


@router.put("/admin/events/{event_id}")
def update_event(event_id: str, data: EventIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(404, "Event not found")
    e.title = data.title.upper()
    e.date = data.date
    e.display_date = data.displayDate
    e.start_time = data.startTime
    e.end_time = data.endTime
    e.venue = data.venue
    e.location = data.location
    e.description = data.description
    e.lineup_json = json.dumps(data.lineup)
    e.giveaways_json = json.dumps(data.giveaways)
    e.status = data.status
    e.is_free = data.isFree
    e.featured = data.featured
    e.registration_mode = data.registrationMode
    db.commit()
    db.refresh(e)
    return _event_dict(e)


@router.delete("/admin/events/{event_id}", status_code=204)
def delete_event(event_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(404, "Event not found")
    db.delete(e)
    db.commit()


@router.post("/admin/events/{event_id}/poster")
async def upload_poster(event_id: str, file: UploadFile = File(...),
                        db: Session = Depends(get_db), _=Depends(require_admin)):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(404, "Event not found")
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"poster-{event_id}{ext}"
    dest = UPLOAD_DIR / "images"
    dest.mkdir(parents=True, exist_ok=True)
    with open(dest / filename, "wb") as f:
        f.write(await file.read())
    e.poster_image = f"images/{filename}"
    db.commit()
    return {"posterImage": f"/uploads/images/{filename}"}


@router.delete("/admin/events/{event_id}/poster", status_code=204)
def remove_poster(event_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(404, "Event not found")
    if e.poster_image:
        poster_path = UPLOAD_DIR / e.poster_image
        if poster_path.exists():
            poster_path.unlink(missing_ok=True)
        e.poster_image = None
        db.commit()


# ── Admin: Ticket Types CRUD ─────────────────────────────────────────────────

class TicketTypeIn(BaseModel):
    eventId: str
    name: str
    price: int = 0          # pence, used when not tiered
    capacity: int = 100
    description: str = ""
    active: bool = True
    isTiered: bool = False
    tiers: List[dict] = []  # [{capacity: int, price_pence: int}]


def _apply_tt_data(tt: TicketType, data: TicketTypeIn):
    tt.name = data.name
    tt.description = data.description
    tt.active = data.active
    if data.isTiered and data.tiers:
        tt.is_tiered = True
        tt.tiers_json = json.dumps(data.tiers)
        tt.capacity = sum(t.get("capacity", 0) for t in data.tiers)
        tt.price = data.tiers[0].get("price_pence", 0)
    else:
        tt.is_tiered = False
        tt.tiers_json = "[]"
        tt.price = data.price
        tt.capacity = data.capacity


@router.post("/admin/ticket-types")
def create_ticket_type(data: TicketTypeIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    tt = TicketType(id="tkt-" + secrets.token_hex(8), event_id=data.eventId)
    _apply_tt_data(tt, data)
    db.add(tt)
    db.commit()
    db.refresh(tt)
    return _tt_dict(tt)


@router.put("/admin/ticket-types/{tt_id}")
def update_ticket_type(tt_id: str, data: TicketTypeIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    tt = db.query(TicketType).filter(TicketType.id == tt_id).first()
    if not tt:
        raise HTTPException(404, "Ticket type not found")
    _apply_tt_data(tt, data)
    db.commit()
    db.refresh(tt)
    return _tt_dict(tt)


@router.delete("/admin/ticket-types/{tt_id}", status_code=204)
def delete_ticket_type(tt_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    tt = db.query(TicketType).filter(TicketType.id == tt_id).first()
    if not tt:
        raise HTTPException(404, "Ticket type not found")
    db.delete(tt)
    db.commit()


# ── Event Interest / Waitlist ─────────────────────────────────────────────────

def _interest_dict(i: EventInterest) -> dict:
    return {
        "id": i.id, "eventId": i.event_id,
        "name": i.name,
        "firstName": i.first_name or "",
        "lastName": i.last_name or "",
        "email": i.email,
        "instagram": i.instagram or "",
        "status": i.status, "createdAt": i.created_at.isoformat(),
        "inviteTicketTypeId": i.invite_ticket_type_id,
        "inviteToken": i.invite_token,
        "inviteDiscountPercent": i.invite_discount_percent or 0,
        "invitedAt": i.invited_at.isoformat() if i.invited_at else None,
    }


class InterestIn(BaseModel):
    firstName: str
    lastName: str
    email: str
    instagram: str = ""
    password: str = ""


@router.post("/events/{event_id}/interest")
def submit_interest(event_id: str, data: InterestIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(404, "Event not found")

    email = data.email.lower().strip()
    first = data.firstName.strip()
    last = data.lastName.strip()
    instagram_val = data.instagram.strip().lstrip("@") if data.instagram else None

    existing = db.query(EventInterest).filter(
        EventInterest.event_id == event_id, EventInterest.email == email
    ).first()
    if existing:
        raise HTTPException(400, "You've already registered interest for this event")

    token = None
    user = current_user

    if not user:
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            if not data.password:
                raise HTTPException(400, "An account with this email already exists. Enter your password to continue.")
            if not verify_password(data.password, existing_user.password_hash):
                raise HTTPException(400, "Incorrect password.")
            user = existing_user
            token = create_token(user.id)
        else:
            if not data.password:
                raise HTTPException(400, "Please set a password to create your account.")
            if len(data.password) < 6:
                raise HTTPException(400, "Password must be at least 6 characters.")
            user = User(
                id="u-" + secrets.token_hex(8),
                name=f"{first} {last}",
                first_name=first,
                last_name=last,
                instagram=instagram_val,
                email=email,
                password_hash=hash_password(data.password),
                subscribed=True,
            )
            db.add(user)
            db.flush()
            for campaign in db.query(EmailCampaign).filter(EmailCampaign.active == True).all():
                db.add(EmailSend(
                    id="snd-" + secrets.token_hex(8),
                    campaign_id=campaign.id,
                    user_id=user.id,
                    scheduled_for=datetime.utcnow() + timedelta(days=campaign.delay_days),
                ))
            token = create_token(user.id)

    interest = EventInterest(
        event_id=event_id,
        user_id=user.id if user else None,
        name=f"{first} {last}",
        first_name=first,
        last_name=last,
        email=email,
        instagram=instagram_val,
        message="",
    )
    db.add(interest)
    db.commit()

    result = {"ok": True}
    if token and user:
        result["token"] = token
        result["user"] = {
            "id": user.id, "name": user.name,
            "firstName": user.first_name or "", "lastName": user.last_name or "",
            "email": user.email, "role": user.role, "instagram": user.instagram or "",
        }
    return result


@router.get("/events/interests/my")
def my_interests(db: Session = Depends(get_db), current_user=Depends(require_user)):
    interests = db.query(EventInterest).filter(
        EventInterest.email == current_user.email
    ).order_by(EventInterest.created_at.desc()).all()
    result = []
    for i in interests:
        event = db.query(Event).filter(Event.id == i.event_id).first()
        result.append({
            "id": i.id,
            "status": i.status,
            "createdAt": i.created_at.isoformat(),
            "inviteToken": i.invite_token,
            "event": {
                "id": event.id,
                "title": event.title,
                "displayDate": event.display_date,
                "venue": event.venue,
                "location": event.location,
                "posterImage": f"/uploads/{event.poster_image}" if event.poster_image else None,
            } if event else None,
        })
    return result


@router.get("/admin/interest/{event_id}")
def get_interest(event_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    interests = db.query(EventInterest).filter(
        EventInterest.event_id == event_id
    ).order_by(EventInterest.created_at.desc()).all()
    return [_interest_dict(i) for i in interests]


@router.put("/admin/interest/{interest_id}/approve")
def approve_interest(interest_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    i = db.query(EventInterest).filter(EventInterest.id == interest_id).first()
    if not i:
        raise HTTPException(404, "Not found")
    i.status = "approved"
    ticket_id = None
    # Resolve user — use stored user_id or fall back to email lookup
    linked_user_id = i.user_id
    if not linked_user_id:
        u = db.query(User).filter(User.email == i.email).first()
        if u:
            linked_user_id = u.id
            i.user_id = u.id
    tt = db.query(TicketType).filter(
        TicketType.event_id == i.event_id, TicketType.active == True
    ).first()
    if tt and tt.sold_count < tt.capacity:
        t = Ticket(
            ticket_type_id=tt.id,
            event_id=i.event_id,
            user_id=linked_user_id,
            holder_name=i.name,
            holder_email=i.email,
            qr_code=secrets.token_hex(6).upper(),
            status="valid",
        )
        tt.sold_count += 1
        db.add(t)
        db.flush()
        ticket_id = t.id
    db.commit()
    d = _interest_dict(i)
    if ticket_id:
        d["ticketId"] = ticket_id
    return d


class InviteIn(BaseModel):
    discountPercent: int = 0


def _prepare_invite(i: EventInterest, discount_percent: int) -> str:
    """Marks an interest as invited and returns their personal checkout link. No network calls.
    The discount applies event-wide — the recipient picks any active paid ticket type
    on the event page, rather than being locked to one tier chosen in advance."""
    i.invite_token = secrets.token_urlsafe(24)
    i.invite_discount_percent = discount_percent
    i.invited_at = datetime.utcnow()
    i.status = "invited"
    return f"{FRONTEND_URL}/?invite={i.invite_token}"


def _email_invite(email: str, name: str, event_title: str, discount_percent: int, link: str):
    offer_line = f"<p>You've got <b>{discount_percent}% off</b> any ticket type for this event.</p>" if discount_percent > 0 else ""
    try:
        send_email(
            email, name,
            f"You're invited — grab your ticket to {event_title}",
            f"<p>Good news — you're off the waitlist for <b>{event_title}</b>!</p>"
            f"{offer_line}"
            f"<p><a href='{link}' style='background:#3272a8;color:#fff;padding:12px 20px;"
            f"text-decoration:none;display:inline-block;'>Buy your ticket</a></p>"
            f"<p>Or copy this link: {link}</p>",
        )
    except Exception:
        pass


def _send_invite(i: EventInterest, discount_percent: int, event_title: str) -> str:
    """Marks an interest as invited and emails their personal checkout link. Returns the link."""
    link = _prepare_invite(i, discount_percent)
    _email_invite(i.email, i.name, event_title, discount_percent, link)
    return link


@router.put("/admin/interest/{interest_id}/invite")
def invite_interest(interest_id: str, data: InviteIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    i = db.query(EventInterest).filter(EventInterest.id == interest_id).first()
    if not i:
        raise HTTPException(404, "Not found")
    if i.status == "approved":
        raise HTTPException(400, "This person already has a ticket")
    if not (0 <= data.discountPercent <= 100):
        raise HTTPException(400, "Discount must be between 0 and 100")

    event = db.query(Event).filter(Event.id == i.event_id).first()
    link = _send_invite(i, data.discountPercent, event.title if event else "the event")
    db.commit()

    d = _interest_dict(i)
    d["inviteLink"] = link
    return d


class BulkInviteIn(BaseModel):
    interestIds: List[str]
    eventId: str
    discountPercent: int = 0


@router.post("/admin/interest/bulk-invite")
def bulk_invite_interest(data: BulkInviteIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    if not data.interestIds:
        raise HTTPException(400, "No one selected")
    if not (0 <= data.discountPercent <= 100):
        raise HTTPException(400, "Discount must be between 0 and 100")

    event = db.query(Event).filter(Event.id == data.eventId).first()
    if not event:
        raise HTTPException(404, "Event not found")
    event_title = event.title

    invited, skipped = [], []
    for interest_id in data.interestIds:
        i = db.query(EventInterest).filter(EventInterest.id == interest_id).first()
        if not i:
            skipped.append({"id": interest_id, "reason": "not found"})
            continue
        if i.event_id != data.eventId:
            skipped.append({"id": interest_id, "reason": "different event"})
            continue
        if i.status == "approved":
            skipped.append({"id": interest_id, "reason": "already has a ticket"})
            continue
        _send_invite(i, data.discountPercent, event_title)
        invited.append(interest_id)

    db.commit()
    return {"invited": invited, "skipped": skipped}


@router.post("/admin/events/{event_id}/invite-attendees")
def invite_all_attendees(
    event_id: str, data: InviteIn, background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), _=Depends(require_admin),
):
    """Invites every registered attendee who isn't already on this event's waitlist
    (pending/invited/rejected/approved) and doesn't already hold a ticket for it."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    if not (0 <= data.discountPercent <= 100):
        raise HTTPException(400, "Discount must be between 0 and 100")

    already_on_waitlist = {
        i.email for i in db.query(EventInterest).filter(EventInterest.event_id == event_id).all()
    }
    already_ticketed_user_ids = {
        t.user_id for t in db.query(Ticket).filter(
            Ticket.event_id == event_id, Ticket.user_id.isnot(None)
        ).all()
    }

    users = db.query(User).filter(User.role == "user").all()
    to_invite = [
        u for u in users
        if u.email not in already_on_waitlist and u.id not in already_ticketed_user_ids
    ]

    to_email = []  # (email, name, link) — dispatched after commit, in the background
    for u in to_invite:
        i = EventInterest(
            event_id=event_id, user_id=u.id, name=u.name,
            first_name=u.first_name, last_name=u.last_name,
            email=u.email, instagram=u.instagram, status="pending",
        )
        db.add(i)
        db.flush()
        link = _prepare_invite(i, data.discountPercent)
        to_email.append((u.email, u.name, link))
    db.commit()

    event_title = event.title
    discount_percent = data.discountPercent

    discount_percent = data.discountPercent

    def _send_all():
        for email, name, link in to_email:
            _email_invite(email, name, event_title, discount_percent, link)

    background_tasks.add_task(_send_all)

    return {"invited": len(to_invite), "alreadyHandled": len(users) - len(to_invite)}


@router.put("/admin/interest/{interest_id}/reject")
def reject_interest(interest_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    i = db.query(EventInterest).filter(EventInterest.id == interest_id).first()
    if not i:
        raise HTTPException(404, "Not found")
    i.status = "rejected"
    db.commit()
    return _interest_dict(i)


@router.delete("/admin/interest/{interest_id}", status_code=204)
def delete_interest(interest_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    i = db.query(EventInterest).filter(EventInterest.id == interest_id).first()
    if not i:
        raise HTTPException(404, "Not found")
    db.delete(i)
    db.commit()
