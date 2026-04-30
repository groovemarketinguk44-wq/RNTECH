import os
import bcrypt
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

SECRET_KEY = os.getenv("SECRET_KEY", "rntech-dev-secret-CHANGE-IN-PROD")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

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
