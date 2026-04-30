import secrets
import io
import csv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import Ticket, TicketType, Event, User
from ..auth import require_user, require_admin, get_current_user

router = APIRouter()


def _ticket_dict(t: Ticket) -> dict:
    return {
        "id": t.id, "ticketTypeId": t.ticket_type_id,
        "eventId": t.event_id, "holderName": t.holder_name,
        "holderEmail": t.holder_email, "qrCode": t.qr_code,
        "status": t.status, "issuedAt": t.issued_at.isoformat(),
    }


class TicketIn(BaseModel):
    ticketTypeId: str
    holderName: str
    holderEmail: str


@router.post("/tickets")
def issue_ticket(data: TicketIn, db: Session = Depends(get_db), user: User = Depends(require_user)):
    tt = db.query(TicketType).filter(TicketType.id == data.ticketTypeId, TicketType.active == True).first()
    if not tt:
        raise HTTPException(404, "Ticket type not found")
    if tt.sold_count >= tt.capacity:
        raise HTTPException(400, "Sorry, this ticket type is sold out")

    ticket = Ticket(
        id="RNT-" + secrets.token_hex(6).upper(),
        ticket_type_id=tt.id,
        event_id=tt.event_id,
        user_id=user.id,
        holder_name=data.holderName,
        holder_email=data.holderEmail,
        qr_code=secrets.token_hex(6).upper(),
        status="valid",
    )
    tt.sold_count += 1
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return _ticket_dict(ticket)


@router.get("/tickets/my")
def my_tickets(db: Session = Depends(get_db), user: User = Depends(require_user)):
    tickets = db.query(Ticket).filter(Ticket.user_id == user.id).order_by(Ticket.issued_at.desc()).all()
    result = []
    for t in tickets:
        d = _ticket_dict(t)
        event = db.query(Event).filter(Event.id == t.event_id).first()
        tt = db.query(TicketType).filter(TicketType.id == t.ticket_type_id).first()
        if event:
            d["event"] = {"id": event.id, "title": event.title, "displayDate": event.display_date,
                          "venue": event.venue, "status": event.status}
        if tt:
            d["ticketTypeName"] = tt.name
        result.append(d)
    return result


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin/tickets")
def admin_tickets(event_id: str = None, db: Session = Depends(get_db), _=Depends(require_admin)):
    q = db.query(Ticket)
    if event_id:
        q = q.filter(Ticket.event_id == event_id)
    tickets = q.order_by(Ticket.issued_at.desc()).all()
    result = []
    for t in tickets:
        d = _ticket_dict(t)
        tt = db.query(TicketType).filter(TicketType.id == t.ticket_type_id).first()
        d["ticketTypeName"] = tt.name if tt else "—"
        result.append(d)
    return result


@router.get("/admin/tickets/export")
def export_tickets(event_id: str = None, db: Session = Depends(get_db), _=Depends(require_admin)):
    q = db.query(Ticket)
    if event_id:
        q = q.filter(Ticket.event_id == event_id)
    tickets = q.all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Ref", "Name", "Email", "Ticket Type", "Event", "Status", "Issued At"])
    for t in tickets:
        tt = db.query(TicketType).filter(TicketType.id == t.ticket_type_id).first()
        event = db.query(Event).filter(Event.id == t.event_id).first()
        writer.writerow([
            t.id, t.holder_name, t.holder_email,
            tt.name if tt else "—",
            event.title if event else "—",
            t.status, t.issued_at.strftime("%Y-%m-%d %H:%M"),
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=rntech-tickets.csv"},
    )


@router.put("/admin/tickets/{ticket_id}/status")
def update_ticket_status(ticket_id: str, data: dict, db: Session = Depends(get_db), _=Depends(require_admin)):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(404, "Ticket not found")
    t.status = data.get("status", t.status)
    db.commit()
    return _ticket_dict(t)
