import os
import secrets
import io
import csv
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from datetime import datetime
from ..models import Ticket, TicketType, Event, User, TicketOrder
from ..auth import require_user, require_admin, get_current_user, get_or_create_guest_user, ensure_guest_email_available
from .. import meta_capi
from .checkout import _send_ticket_confirmation

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://rntech.live")

router = APIRouter()
logger = logging.getLogger(__name__)
MAX_QUANTITY = 10


def _ticket_dict(t: Ticket) -> dict:
    return {
        "id": t.id, "ticketTypeId": t.ticket_type_id,
        "eventId": t.event_id, "holderName": t.holder_name,
        "holderEmail": t.holder_email, "qrCode": t.qr_code,
        "status": t.status, "issuedAt": t.issued_at.isoformat(),
        "orderId": t.order_id,
    }


class TicketIn(BaseModel):
    ticketTypeId: str
    holderName: str
    holderEmail: str
    quantity: int = 1


class AdminTicketIn(BaseModel):
    ticketTypeId: str
    holderName: str
    holderEmail: str


@router.post("/tickets")
def issue_ticket(data: TicketIn, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    quantity = data.quantity
    if quantity < 1 or quantity > MAX_QUANTITY:
        raise HTTPException(400, f"Quantity must be between 1 and {MAX_QUANTITY}")

    holder_name = data.holderName.strip()
    holder_email = data.holderEmail.strip().lower()
    if not holder_name or not holder_email:
        raise HTTPException(400, "Name and email are required")

    guest_created = False
    if not user:
        ensure_guest_email_available(db, holder_email)
        user, guest_created = get_or_create_guest_user(db, holder_name, holder_email)

    tt = db.query(TicketType).filter(TicketType.id == data.ticketTypeId, TicketType.active == True).first()
    if not tt:
        raise HTTPException(404, "Ticket type not found")
    if tt.sold_count + quantity > tt.capacity:
        remaining = max(tt.capacity - tt.sold_count, 0)
        raise HTTPException(400, f"Only {remaining} of this ticket type left")

    tickets = []
    for _ in range(quantity):
        ticket = Ticket(
            id="RNT-" + secrets.token_hex(6).upper(),
            ticket_type_id=tt.id,
            event_id=tt.event_id,
            user_id=user.id,
            holder_name=holder_name,
            holder_email=holder_email,
            qr_code=secrets.token_hex(6).upper(),
            status="valid",
        )
        tt.sold_count += 1
        db.add(ticket)
        tickets.append(ticket)
    db.commit()
    for t in tickets:
        db.refresh(t)

    event = db.query(Event).filter(Event.id == tt.event_id).first()
    _send_ticket_confirmation(
        db, event, tickets, holder_name, holder_email,
        user_id=user.id, guest_account_created=guest_created,
    )

    ip_address = meta_capi.client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    event_source_url = f"{FRONTEND_URL}/buy"
    if guest_created:
        meta_capi.send_event(
            "CompleteRegistration", event_source_url, ip_address=ip_address, user_agent=user_agent,
            email=holder_email, event_id=f"register-{user.id}",
        )
    meta_capi.send_event(
        "Purchase", event_source_url, ip_address=ip_address, user_agent=user_agent,
        email=holder_email, event_id=f"purchase-{tickets[0].id}",
        custom_data={"currency": "GBP", "value": 0},
    )

    result = _ticket_dict(tickets[0])
    result["ticketIds"] = [t.id for t in tickets]
    return result


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

@router.post("/admin/tickets")
def admin_issue_ticket(data: AdminTicketIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    tt = db.query(TicketType).filter(TicketType.id == data.ticketTypeId, TicketType.active == True).first()
    if not tt:
        raise HTTPException(404, "Ticket type not found")
    if tt.sold_count >= tt.capacity:
        raise HTTPException(400, "This ticket type is sold out")
    ticket = Ticket(
        ticket_type_id=tt.id,
        event_id=tt.event_id,
        user_id=None,
        holder_name=data.holderName,
        holder_email=data.holderEmail,
        qr_code=secrets.token_hex(6).upper(),
        status="valid",
    )
    tt.sold_count += 1
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    d = _ticket_dict(ticket)
    d["ticketTypeName"] = tt.name
    return d


class AdminCashTicketIn(BaseModel):
    email: str
    holderName: str = ""
    ticketTypeId: str
    quantity: int = 1
    amountPaidPence: int = None


@router.post("/admin/tickets/cash")
def admin_issue_cash_tickets(data: AdminCashTicketIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Issues tickets for an off-platform cash sale, attached to the buyer's existing
    (or newly created) account so they show up under their My Tickets alongside anything
    they bought through checkout."""
    if data.quantity < 1 or data.quantity > 50:
        raise HTTPException(400, "Quantity must be between 1 and 50")

    email = data.email.strip().lower()
    if not email:
        raise HTTPException(400, "Email is required")

    tt = db.query(TicketType).filter(TicketType.id == data.ticketTypeId).first()
    if not tt:
        raise HTTPException(404, "Ticket type not found")
    if tt.sold_count + data.quantity > tt.capacity:
        remaining = max(tt.capacity - tt.sold_count, 0)
        raise HTTPException(400, f"Only {remaining} of this ticket type left")

    user, created = get_or_create_guest_user(db, data.holderName, email)
    holder_name = data.holderName.strip() or user.name

    total_paid = data.amountPaidPence if data.amountPaidPence else tt.price * data.quantity
    amount_each = total_paid // data.quantity

    order = TicketOrder(
        event_id=tt.event_id,
        ticket_type_id=tt.id,
        user_id=user.id,
        holder_name=holder_name,
        holder_email=email,
        quantity=data.quantity,
        unit_price_pence=tt.price,
        total_pence=total_paid,
        status="paid",
        paid_at=datetime.utcnow(),
    )
    db.add(order)
    db.flush()

    tickets = []
    for _ in range(data.quantity):
        ticket = Ticket(
            id="RNT-" + secrets.token_hex(6).upper(),
            ticket_type_id=tt.id,
            event_id=tt.event_id,
            user_id=user.id,
            order_id=order.id,
            holder_name=holder_name,
            holder_email=email,
            qr_code=secrets.token_hex(6).upper(),
            status="valid",
            amount_paid_pence=amount_each,
        )
        tt.sold_count += 1
        db.add(ticket)
        tickets.append(ticket)
    db.commit()
    for t in tickets:
        db.refresh(t)

    event = db.query(Event).filter(Event.id == tt.event_id).first()
    _send_ticket_confirmation(
        db, event, tickets, holder_name, email,
        user_id=user.id, guest_account_created=created,
    )

    result = _ticket_dict(tickets[0])
    result["ticketIds"] = [t.id for t in tickets]
    return result


@router.get("/admin/tickets/search")
def search_tickets(q: str = "", event_id: str = None, db: Session = Depends(get_db), _=Depends(require_admin)):
    query = db.query(Ticket)
    if event_id:
        query = query.filter(Ticket.event_id == event_id)
    if q:
        query = query.filter(
            (Ticket.holder_name.ilike(f"%{q}%")) | (Ticket.holder_email.ilike(f"%{q}%"))
        )
    tickets = query.order_by(Ticket.issued_at.desc()).all()
    result = []
    for t in tickets:
        d = _ticket_dict(t)
        tt = db.query(TicketType).filter(TicketType.id == t.ticket_type_id).first()
        d["ticketTypeName"] = tt.name if tt else "—"
        result.append(d)
    return result


@router.post("/admin/tickets/checkin/{qr_code}")
def checkin_by_qr(qr_code: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    t = db.query(Ticket).filter(Ticket.qr_code == qr_code.upper()).first()
    if not t:
        raise HTTPException(404, "Ticket not found — invalid QR code")
    d = _ticket_dict(t)
    tt = db.query(TicketType).filter(TicketType.id == t.ticket_type_id).first()
    event = db.query(Event).filter(Event.id == t.event_id).first()
    d["ticketTypeName"] = tt.name if tt else "—"
    d["eventTitle"] = event.title if event else "—"
    d["alreadyUsed"] = t.status == "used"
    if t.status == "valid":
        t.status = "used"
        db.commit()
        d["status"] = "used"
    return d


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


@router.delete("/admin/tickets/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(404, "Ticket not found")
    tt = db.query(TicketType).filter(TicketType.id == t.ticket_type_id).first()
    if tt and tt.sold_count > 0:
        tt.sold_count -= 1
    db.delete(t)
    db.commit()
