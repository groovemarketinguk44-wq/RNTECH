import io
import csv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
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
            "id": u.id, "name": u.name,
            "firstName": u.first_name or "", "lastName": u.last_name or "",
            "email": u.email, "instagram": u.instagram or "",
            "role": u.role, "subscribed": u.subscribed,
            "joinedAt": u.created_at.isoformat(),
            "ticketCount": ticket_count,
        })
    return result


class UserEditIn(BaseModel):
    firstName: str
    lastName: str
    email: str
    instagram: str = ""
    role: str = "user"


@router.put("/admin/users/{user_id}")
def update_user(user_id: str, data: UserEditIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    first = data.firstName.strip()
    last = data.lastName.strip()
    if not first or not last:
        raise HTTPException(400, "First and last name are required")
    email = data.email.lower().strip()
    clash = db.query(User).filter(User.email == email, User.id != user_id).first()
    if clash:
        raise HTTPException(400, "That email is already in use by another account")
    u.first_name = first
    u.last_name = last
    u.name = f"{first} {last}"
    u.email = email
    u.instagram = data.instagram.strip().lstrip("@") or None
    u.role = data.role if data.role in ("user", "admin") else "user"
    db.commit()
    return {"id": u.id, "name": u.name, "firstName": u.first_name, "lastName": u.last_name,
            "email": u.email, "instagram": u.instagram or "", "role": u.role,
            "subscribed": u.subscribed}


@router.delete("/admin/users/{user_id}", status_code=204)
def delete_user(user_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    if u.role == "admin":
        raise HTTPException(400, "Cannot delete an admin account")
    db.delete(u)
    db.commit()


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
