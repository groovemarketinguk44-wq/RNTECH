import io
import csv
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Event, Ticket, Mix, ContactMessage, EmailSend
from ..auth import require_admin

router = APIRouter()


@router.get("/admin/stats")
def get_stats(db: Session = Depends(get_db), _=Depends(require_admin)):
    return {
        "events": db.query(Event).count(),
        "tickets": db.query(Ticket).count(),
        "users": db.query(User).filter(User.role == "user").count(),
        "messages": db.query(ContactMessage).filter(ContactMessage.read == False).count(),
        "mixes": db.query(Mix).filter(Mix.active == True).count(),
        "subscribers": db.query(User).filter(User.subscribed == True).count(),
    }


@router.get("/admin/attendees")
def get_attendees(db: Session = Depends(get_db), _=Depends(require_admin)):
    users = db.query(User).filter(User.role == "user").order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        ticket_count = db.query(Ticket).filter(Ticket.user_id == u.id).count()
        result.append({
            "id": u.id, "name": u.name, "email": u.email,
            "subscribed": u.subscribed, "joinedAt": u.created_at.isoformat(),
            "ticketCount": ticket_count,
        })
    return result


@router.get("/admin/attendees/export")
def export_attendees(db: Session = Depends(get_db), _=Depends(require_admin)):
    users = db.query(User).filter(User.role == "user").order_by(User.created_at.desc()).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Name", "Email", "Subscribed", "Joined", "Tickets"])
    for u in users:
        tc = db.query(Ticket).filter(Ticket.user_id == u.id).count()
        writer.writerow([u.name, u.email, "Yes" if u.subscribed else "No",
                         u.created_at.strftime("%Y-%m-%d"), tc])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=rntech-attendees.csv"},
    )


@router.put("/admin/users/{user_id}/unsubscribe")
def unsubscribe_user(user_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if u:
        u.subscribed = False
        db.commit()
    return {"ok": True}
