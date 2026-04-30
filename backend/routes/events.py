import json
import secrets
from pathlib import Path
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from ..database import get_db
from ..models import Event, TicketType
from ..auth import require_admin

router = APIRouter()
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))


def _tt_dict(tt: TicketType) -> dict:
    return {
        "id": tt.id, "eventId": tt.event_id, "name": tt.name,
        "price": tt.price, "capacity": tt.capacity, "soldCount": tt.sold_count,
        "active": tt.active, "description": tt.description,
    }


def _event_dict(e: Event) -> dict:
    return {
        "id": e.id, "title": e.title, "slug": e.slug,
        "date": e.date, "displayDate": e.display_date,
        "startTime": e.start_time, "endTime": e.end_time,
        "venue": e.venue, "location": e.location,
        "description": e.description,
        "posterImage": f"/uploads/{e.poster_image}" if e.poster_image else None,
        "lineup": e.lineup, "giveaways": e.giveaways,
        "status": e.status, "isFree": e.is_free, "featured": e.featured,
        "ticketTypes": [_tt_dict(tt) for tt in e.ticket_types],
    }


# ── Public ──────────────────────────────────────────────────────────────────

@router.get("/events")
def get_events(db: Session = Depends(get_db)):
    events = db.query(Event).order_by(Event.date.desc()).all()
    return [_event_dict(e) for e in events]


@router.get("/events/{event_id}")
def get_event(event_id: str, db: Session = Depends(get_db)):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(404, "Event not found")
    return _event_dict(e)


# ── Admin: Events CRUD ───────────────────────────────────────────────────────

class EventIn(BaseModel):
    title: str
    date: str
    displayDate: str
    startTime: str
    endTime: str = ""
    venue: str
    location: str
    description: str = ""
    lineup: List[dict] = []
    giveaways: List[str] = []
    status: str = "upcoming"
    isFree: bool = True
    featured: bool = False


@router.post("/admin/events")
def create_event(data: EventIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    slug = data.title.lower().replace(" ", "-") + "-" + secrets.token_hex(3)
    e = Event(
        id="evt-" + secrets.token_hex(8),
        title=data.title.upper(),
        slug=slug,
        date=data.date,
        display_date=data.displayDate,
        start_time=data.startTime,
        end_time=data.endTime,
        venue=data.venue,
        location=data.location,
        description=data.description,
        lineup_json=json.dumps(data.lineup),
        giveaways_json=json.dumps(data.giveaways),
        status=data.status,
        is_free=data.isFree,
        featured=data.featured,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _event_dict(e)


@router.put("/admin/events/{event_id}")
def update_event(event_id: str, data: EventIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(404, "Event not found")
    e.title = data.title.upper()
    e.date = data.date
    e.display_date = data.displayDate
    e.start_time = data.startTime
    e.end_time = data.endTime
    e.venue = data.venue
    e.location = data.location
    e.description = data.description
    e.lineup_json = json.dumps(data.lineup)
    e.giveaways_json = json.dumps(data.giveaways)
    e.status = data.status
    e.is_free = data.isFree
    e.featured = data.featured
    db.commit()
    db.refresh(e)
    return _event_dict(e)


@router.delete("/admin/events/{event_id}", status_code=204)
def delete_event(event_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(404, "Event not found")
    db.delete(e)
    db.commit()


@router.post("/admin/events/{event_id}/poster")
async def upload_poster(event_id: str, file: UploadFile = File(...),
                        db: Session = Depends(get_db), _=Depends(require_admin)):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(404, "Event not found")
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"poster-{event_id}{ext}"
    dest = UPLOAD_DIR / "images"
    dest.mkdir(parents=True, exist_ok=True)
    with open(dest / filename, "wb") as f:
        f.write(await file.read())
    e.poster_image = f"images/{filename}"
    db.commit()
    return {"posterImage": f"/uploads/images/{filename}"}


# ── Admin: Ticket Types CRUD ─────────────────────────────────────────────────

class TicketTypeIn(BaseModel):
    eventId: str
    name: str
    price: int = 0
    capacity: int = 100
    description: str = ""
    active: bool = True


@router.post("/admin/ticket-types")
def create_ticket_type(data: TicketTypeIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    tt = TicketType(
        id="tkt-" + secrets.token_hex(8),
        event_id=data.eventId, name=data.name, price=data.price,
        capacity=data.capacity, description=data.description, active=data.active,
    )
    db.add(tt)
    db.commit()
    db.refresh(tt)
    return _tt_dict(tt)


@router.put("/admin/ticket-types/{tt_id}")
def update_ticket_type(tt_id: str, data: TicketTypeIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    tt = db.query(TicketType).filter(TicketType.id == tt_id).first()
    if not tt:
        raise HTTPException(404, "Ticket type not found")
    tt.name = data.name
    tt.price = data.price
    tt.capacity = data.capacity
    tt.description = data.description
    tt.active = data.active
    db.commit()
    db.refresh(tt)
    return _tt_dict(tt)


@router.delete("/admin/ticket-types/{tt_id}", status_code=204)
def delete_ticket_type(tt_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    tt = db.query(TicketType).filter(TicketType.id == tt_id).first()
    if not tt:
        raise HTTPException(404, "Ticket type not found")
    db.delete(tt)
    db.commit()
