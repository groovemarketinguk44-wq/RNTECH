import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import ContactMessage
from ..auth import require_admin

router = APIRouter()


class MessageIn(BaseModel):
    name: str
    email: str
    message: str


@router.post("/contact")
def submit_message(data: MessageIn, db: Session = Depends(get_db)):
    if not data.name or not data.email or not data.message:
        raise HTTPException(400, "All fields are required")
    msg = ContactMessage(
        id="msg-" + secrets.token_hex(8),
        name=data.name.strip(),
        email=data.email.lower().strip(),
        message=data.message.strip(),
    )
    db.add(msg)
    db.commit()
    return {"ok": True}


@router.get("/admin/messages")
def get_messages(db: Session = Depends(get_db), _=Depends(require_admin)):
    msgs = db.query(ContactMessage).order_by(ContactMessage.sent_at.desc()).all()
    return [{
        "id": m.id, "name": m.name, "email": m.email,
        "message": m.message, "sentAt": m.sent_at.isoformat(), "read": m.read,
    } for m in msgs]


@router.put("/admin/messages/{msg_id}/read")
def mark_read(msg_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    m = db.query(ContactMessage).filter(ContactMessage.id == msg_id).first()
    if not m:
        raise HTTPException(404, "Message not found")
    m.read = True
    db.commit()
    return {"ok": True}


@router.delete("/admin/messages/{msg_id}", status_code=204)
def delete_message(msg_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    m = db.query(ContactMessage).filter(ContactMessage.id == msg_id).first()
    if not m:
        raise HTTPException(404, "Message not found")
    db.delete(m)
    db.commit()
