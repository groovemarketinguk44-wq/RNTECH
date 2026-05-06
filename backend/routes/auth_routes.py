import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import User, EmailCampaign, EmailSend
from ..auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter()


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    firstName: str
    lastName: str
    email: str
    password: str
    instagram: str = ""


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "firstName": u.first_name or "",
        "lastName": u.last_name or "",
        "email": u.email,
        "role": u.role,
        "instagram": u.instagram or "",
    }


@router.post("/auth/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(400, "Invalid email or password")
    return {"token": create_token(user.id), "user": _user_dict(user)}


@router.post("/auth/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if not data.firstName.strip() or not data.lastName.strip():
        raise HTTPException(400, "First and last name are required")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if db.query(User).filter(User.email == data.email.lower().strip()).first():
        raise HTTPException(400, "An account with that email already exists")

    first = data.firstName.strip()
    last = data.lastName.strip()
    user = User(
        id="u-" + secrets.token_hex(8),
        name=f"{first} {last}",
        first_name=first,
        last_name=last,
        instagram=data.instagram.strip().lstrip("@") if data.instagram else None,
        email=data.email.lower().strip(),
        password_hash=hash_password(data.password),
        subscribed=True,
    )
    db.add(user)
    db.flush()

    # Schedule drip campaign emails
    for campaign in db.query(EmailCampaign).filter(EmailCampaign.active == True).all():
        db.add(EmailSend(
            id="snd-" + secrets.token_hex(8),
            campaign_id=campaign.id,
            user_id=user.id,
            scheduled_for=datetime.utcnow() + timedelta(days=campaign.delay_days),
        ))

    db.commit()
    return {"token": create_token(user.id), "user": _user_dict(user)}


@router.get("/auth/me")
def me(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(401, "Not authenticated")
    return _user_dict(user)


@router.put("/auth/password")
def change_password(data: dict, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user:
        raise HTTPException(401, "Not authenticated")
    current = data.get("current", "")
    new_pass = data.get("new", "")
    if not verify_password(current, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if len(new_pass) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    user.password_hash = hash_password(new_pass)
    db.commit()
    return {"ok": True}
