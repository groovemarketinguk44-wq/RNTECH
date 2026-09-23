import os
import secrets
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import User, EmailCampaign, EmailSend, PasswordResetToken
from ..auth import hash_password, verify_password, create_token, get_current_user
from ..email_service import send_email
from .. import meta_capi

router = APIRouter()
logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://rntech.live")


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
def register(data: RegisterIn, request: Request, db: Session = Depends(get_db)):
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
    for campaign in db.query(EmailCampaign).filter(EmailCampaign.active == True, EmailCampaign.audience == "drip").all():
        db.add(EmailSend(
            id="snd-" + secrets.token_hex(8),
            campaign_id=campaign.id,
            user_id=user.id,
            scheduled_for=datetime.utcnow() + timedelta(days=campaign.delay_days),
        ))

    db.commit()

    meta_capi.send_event(
        "CompleteRegistration", f"{FRONTEND_URL}/buy",
        ip_address=meta_capi.client_ip(request), user_agent=request.headers.get("user-agent", ""),
        email=user.email, event_id=f"register-{user.id}",
    )

    return {"token": create_token(user.id), "user": _user_dict(user)}


@router.get("/auth/me")
def me(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(401, "Not authenticated")
    return _user_dict(user)


class ProfileIn(BaseModel):
    firstName: str
    lastName: str
    instagram: str = ""


@router.put("/auth/profile")
def update_profile(data: ProfileIn, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user:
        raise HTTPException(401, "Not authenticated")
    first = data.firstName.strip()
    last = data.lastName.strip()
    if not first or not last:
        raise HTTPException(400, "First and last name are required")
    user.first_name = first
    user.last_name = last
    user.name = f"{first} {last}"
    user.instagram = data.instagram.strip().lstrip("@") if data.instagram.strip() else None
    db.commit()
    return _user_dict(user)


BASE_URL = os.getenv("BASE_URL", "https://rntech.fly.dev")


@router.post("/auth/forgot-password")
def forgot_password(data: dict, db: Session = Depends(get_db)):
    email = (data.get("email") or "").lower().strip()
    user = db.query(User).filter(User.email == email).first()
    # Always return ok — don't reveal whether the email exists
    if user:
        db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
        token = secrets.token_urlsafe(32)
        db.add(PasswordResetToken(
            token=token,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(hours=1),
        ))
        db.commit()
        reset_link = f"{BASE_URL}/?reset={token}"
        ok = send_email(
            to_email=user.email,
            to_name=user.name,
            subject="Reset your RNTECH password",
            body_content=f"""
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#020810;color:#fff;">
  <h2 style="color:#3272a8;text-transform:uppercase;letter-spacing:0.06em;">Reset Your Password</h2>
  <p style="color:rgba(255,255,255,0.7);">Hi {user.first_name or user.name},</p>
  <p style="color:rgba(255,255,255,0.7);">Click the button below to reset your RNTECH password. This link stays valid until you use it.</p>
  <a href="{reset_link}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#3272a8;color:#fff;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Reset Password</a>
  <p style="color:rgba(255,255,255,0.3);font-size:12px;">If you didn't request this, ignore this email — your password won't change.</p>
  <p style="color:rgba(255,255,255,0.2);font-size:11px;">Or copy this link: {reset_link}</p>
</div>""",
        )
        if not ok:
            logger.error(f"forgot-password: email send failed for {user.email} — reset token was still created")
    return {"ok": True}


@router.post("/auth/reset-password")
def reset_password(data: dict, db: Session = Depends(get_db)):
    token_val = (data.get("token") or "").strip()
    new_pass = (data.get("password") or "").strip()
    if len(new_pass) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    row = db.query(PasswordResetToken).filter(PasswordResetToken.token == token_val).first()
    if not row or row.used:
        raise HTTPException(400, "This reset link is invalid or has already been used")
    user = db.query(User).filter(User.id == row.user_id).first()
    if not user:
        raise HTTPException(400, "User not found")
    user.password_hash = hash_password(new_pass)
    row.used = True
    db.commit()
    return {"ok": True}


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
