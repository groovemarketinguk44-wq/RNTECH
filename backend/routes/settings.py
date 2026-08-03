from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..auth import require_admin
from ..settings_utils import get_setting, set_setting

router = APIRouter()

_KEYS = ["email_signature", "admin_notify_email"]


class SettingsIn(BaseModel):
    email_signature: str = ""
    admin_notify_email: str = ""


@router.get("/admin/settings")
def get_settings(db: Session = Depends(get_db), _=Depends(require_admin)):
    return {k: get_setting(db, k) for k in _KEYS}


@router.put("/admin/settings")
def update_settings(data: SettingsIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    set_setting(db, "email_signature", data.email_signature)
    set_setting(db, "admin_notify_email", data.admin_notify_email)
    return {k: get_setting(db, k) for k in _KEYS}
