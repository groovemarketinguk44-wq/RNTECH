import json
import secrets
from pathlib import Path
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from ..database import get_db
from ..models import Mix
from ..auth import require_admin

router = APIRouter()
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))


def _mix_dict(m: Mix) -> dict:
    video_src = None
    if m.video_filename:
        video_src = f"/uploads/{m.video_filename}"
    elif m.video_url:
        video_src = m.video_url
    return {
        "id": m.id, "title": m.title, "residentName": m.resident_name,
        "month": m.month, "duration": m.duration,
        "description": m.description, "tracklist": m.tracklist,
        "active": m.active,
        "coverImage": f"/uploads/{m.cover_image}" if m.cover_image else None,
        "videoSrc": video_src,
        "hasVideo": bool(m.video_filename or m.video_url),
    }


# ── Public ──────────────────────────────────────────────────────────────────

@router.get("/mixes")
def get_mixes(db: Session = Depends(get_db)):
    mixes = db.query(Mix).filter(Mix.active == True).order_by(Mix.created_at.desc()).all()
    return [_mix_dict(m) for m in mixes]


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin/mixes")
def admin_get_mixes(db: Session = Depends(get_db), _=Depends(require_admin)):
    mixes = db.query(Mix).order_by(Mix.created_at.desc()).all()
    return [_mix_dict(m) for m in mixes]


class MixIn(BaseModel):
    title: str
    residentName: str
    month: str
    duration: str = ""
    description: str = ""
    tracklist: List[str] = []
    active: bool = True
    videoUrl: Optional[str] = None


@router.post("/admin/mixes")
def create_mix(data: MixIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    m = Mix(
        id="mix-" + secrets.token_hex(8),
        title=data.title.upper(),
        resident_name=data.residentName.upper(),
        month=data.month,
        duration=data.duration,
        description=data.description,
        tracklist_json=json.dumps(data.tracklist),
        active=data.active,
        video_url=data.videoUrl,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _mix_dict(m)


@router.put("/admin/mixes/{mix_id}")
def update_mix(mix_id: str, data: MixIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    m = db.query(Mix).filter(Mix.id == mix_id).first()
    if not m:
        raise HTTPException(404, "Mix not found")
    m.title = data.title.upper()
    m.resident_name = data.residentName.upper()
    m.month = data.month
    m.duration = data.duration
    m.description = data.description
    m.tracklist_json = json.dumps(data.tracklist)
    m.active = data.active
    if data.videoUrl is not None:
        m.video_url = data.videoUrl
        m.video_filename = None  # clear uploaded file if URL set
    db.commit()
    db.refresh(m)
    return _mix_dict(m)


@router.delete("/admin/mixes/{mix_id}", status_code=204)
def delete_mix(mix_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    m = db.query(Mix).filter(Mix.id == mix_id).first()
    if not m:
        raise HTTPException(404, "Mix not found")
    db.delete(m)
    db.commit()


@router.post("/admin/mixes/{mix_id}/video")
async def upload_video(mix_id: str, file: UploadFile = File(...),
                       db: Session = Depends(get_db), _=Depends(require_admin)):
    m = db.query(Mix).filter(Mix.id == mix_id).first()
    if not m:
        raise HTTPException(404, "Mix not found")
    ext = Path(file.filename).suffix.lower() if file.filename else ".mp4"
    filename = f"video-{mix_id}{ext}"
    video_dir = UPLOAD_DIR / "videos"
    video_dir.mkdir(parents=True, exist_ok=True)
    with open(video_dir / filename, "wb") as f:
        content = await file.read()
        f.write(content)
    m.video_filename = f"videos/{filename}"
    m.video_url = None
    db.commit()
    return {"videoSrc": f"/uploads/videos/{filename}"}


@router.post("/admin/mixes/{mix_id}/cover")
async def upload_cover(mix_id: str, file: UploadFile = File(...),
                       db: Session = Depends(get_db), _=Depends(require_admin)):
    m = db.query(Mix).filter(Mix.id == mix_id).first()
    if not m:
        raise HTTPException(404, "Mix not found")
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"cover-{mix_id}{ext}"
    img_dir = UPLOAD_DIR / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    with open(img_dir / filename, "wb") as f:
        f.write(await file.read())
    m.cover_image = f"images/{filename}"
    db.commit()
    return {"coverImage": f"/uploads/images/{filename}"}
