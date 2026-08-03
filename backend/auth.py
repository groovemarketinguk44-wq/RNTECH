import os
import secrets
import bcrypt
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, PasswordResetToken

SECRET_KEY = os.getenv("SECRET_KEY", "rntech-dev-secret-CHANGE-IN-PROD")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30
BASE_URL = os.getenv("BASE_URL", "https://rntech.fly.dev")

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User | None:
    if not creds:
        return None
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        uid = payload.get("sub")
        if not uid:
            return None
    except JWTError:
        return None
    return db.query(User).filter(User.id == uid).first()


def require_user(user: User | None = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def require_admin(user: User | None = Depends(get_current_user)) -> User:
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def get_or_create_guest_user(db: Session, name: str, email: str) -> tuple[User, bool]:
    """Looks up a user by email for a guest checkout, creating an account if none exists.

    Returns (user, created) — `created` is False when an existing account was matched,
    so callers only surface "we made you an account" messaging for genuinely new users.
    """
    email = email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return existing, False

    name = name.strip() or email.split("@")[0]
    first, _, last = name.partition(" ")
    user = User(
        id="u-" + secrets.token_hex(8),
        name=name,
        first_name=first,
        last_name=last,
        email=email,
        password_hash=hash_password(secrets.token_urlsafe(24)),
        subscribed=True,
    )
    db.add(user)
    db.flush()
    return user, True


def create_password_setup_link(db: Session, user: User) -> str:
    """Issues a reset-token link so a guest-created account can set its own password later."""
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
    token = secrets.token_urlsafe(32)
    db.add(PasswordResetToken(
        token=token,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(hours=48),
    ))
    return f"{BASE_URL}/?reset={token}"
