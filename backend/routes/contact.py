import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import ContactMessage
from ..auth import require_admin
from ..email_service import send_email, FROM_EMAIL
from ..settings_utils import get_setting

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

    notify_email = get_setting(db, "admin_notify_email") or FROM_EMAIL
    if notify_email:
        body = (
            f"<h2 style='margin:0 0 20px;color:#1a1a2e;font-size:20px;'>New Message from Website</h2>"
            f"<p style='margin:0 0 8px;'><strong>Name:</strong> {data.name}</p>"
            f"<p style='margin:0 0 8px;'><strong>Email:</strong> <a href='mailto:{data.email}' style='color:#3272a8;'>{data.email}</a></p>"
            f"<p style='margin:16px 0 8px;'><strong>Message:</strong></p>"
            f"<blockquote style='border-left:3px solid #3272a8;padding:12px 16px;margin:0;background:#f9fafb;color:#333;border-radius:0 4px 4px 0;'>{data.message}</blockquote>"
        )
        send_email(notify_email, "RNTECH Admin", f"New message from {data.name}", body)

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
