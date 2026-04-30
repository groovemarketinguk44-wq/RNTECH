import secrets
from pathlib import Path
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from ..database import get_db
from ..models import Sponsor
from ..auth import require_admin

router = APIRouter()
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))


def _sponsor_dict(s: Sponsor) -> dict:
    if s.logo_filename:
        logo = s.logo_filename if s.logo_filename.startswith('/') else f"/uploads/{s.logo_filename}"
    else:
        logo = None
    return {
        "id": s.id, "name": s.name, "subtitle": s.subtitle,
        "description": s.description,
        "logo": logo,
        "link": s.link, "active": s.active, "sortOrder": s.sort_order,
    }


@router.get("/sponsors")
def get_sponsors(db: Session = Depends(get_db)):
    sponsors = db.query(Sponsor).filter(Sponsor.active == True).order_by(Sponsor.sort_order).all()
    return [_sponsor_dict(s) for s in sponsors]


class SponsorIn(BaseModel):
    name: str
    subtitle: str = ""
    description: str = ""
    link: str = "#"
    active: bool = True
    sortOrder: int = 0


@router.post("/admin/sponsors")
def create_sponsor(data: SponsorIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    s = Sponsor(
        id="sp-" + secrets.token_hex(8),
        name=data.name.upper(), subtitle=data.subtitle,
        description=data.description, link=data.link,
        active=data.active, sort_order=data.sortOrder,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _sponsor_dict(s)


@router.put("/admin/sponsors/{sp_id}")
def update_sponsor(sp_id: str, data: SponsorIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    s = db.query(Sponsor).filter(Sponsor.id == sp_id).first()
    if not s:
        raise HTTPException(404, "Sponsor not found")
    s.name = data.name.upper()
    s.subtitle = data.subtitle
    s.description = data.description
    s.link = data.link
    s.active = data.active
    s.sort_order = data.sortOrder
    db.commit()
    db.refresh(s)
    return _sponsor_dict(s)


@router.delete("/admin/sponsors/{sp_id}", status_code=204)
def delete_sponsor(sp_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    s = db.query(Sponsor).filter(Sponsor.id == sp_id).first()
    if not s:
        raise HTTPException(404, "Sponsor not found")
    db.delete(s)
    db.commit()


@router.post("/admin/sponsors/{sp_id}/logo")
async def upload_logo(sp_id: str, file: UploadFile = File(...),
                      db: Session = Depends(get_db), _=Depends(require_admin)):
    s = db.query(Sponsor).filter(Sponsor.id == sp_id).first()
    if not s:
        raise HTTPException(404, "Sponsor not found")
    ext = Path(file.filename).suffix.lower() if file.filename else ".png"
    filename = f"logo-{sp_id}{ext}"
    img_dir = UPLOAD_DIR / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    with open(img_dir / filename, "wb") as f:
        f.write(await file.read())
    s.logo_filename = f"images/{filename}"
    db.commit()
    return {"logo": f"/uploads/images/{filename}"}
