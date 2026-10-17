"""Public discount links (/qr/{code}) — one shared link anyone can use, switchable on/off from admin."""
import os
import re
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import PromoLink, TicketOrder
from ..auth import require_admin
from .offers import discount_label

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://rntech.live")
CODE_RE = re.compile(r"^[a-z0-9-]{3,40}$")


def promo_url(code: str) -> str:
    return f"{FRONTEND_URL}/qr/{code}"


def active_promo(db: Session, code: str) -> Optional[PromoLink]:
    """The promo for this code if it's currently switched on, else None."""
    if not code:
        return None
    return db.query(PromoLink).filter(PromoLink.code == code.strip().lower(), PromoLink.active == True).first()


def _out(db: Session, p: PromoLink) -> dict:
    orders, tickets, revenue = db.query(
        func.count(TicketOrder.id), func.coalesce(func.sum(TicketOrder.quantity), 0),
        func.coalesce(func.sum(TicketOrder.total_pence), 0),
    ).filter(TicketOrder.promo_id == p.id, TicketOrder.status == "paid").one()
    return {
        "id": p.id, "code": p.code, "label": p.label or "", "url": promo_url(p.code),
        "discountBp": p.discount_bp, "discountLabel": discount_label(p.discount_bp), "active": bool(p.active),
        "orders": orders, "tickets": int(tickets), "revenuePence": int(revenue),
        "createdAt": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/promo/{code}")
def get_promo(code: str, db: Session = Depends(get_db)):
    """What the /qr/{code} page needs. A switched-off or unknown code isn't an error — the page just
    falls back to normal-price tickets."""
    p = active_promo(db, code)
    if not p:
        return {"active": False}
    return {"active": True, "code": p.code, "discountBp": p.discount_bp, "discountLabel": discount_label(p.discount_bp)}


@router.get("/promo/{code}/qr.svg")
def promo_qr(code: str, db: Session = Depends(get_db)):
    """Print-ready QR for the link. Public on purpose — it only encodes the URL, which is public anyway,
    and works whether the link is currently on or off."""
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing
    from reportlab.graphics import renderSVG
    p = db.query(PromoLink).filter(PromoLink.code == code.strip().lower()).first()
    if not p:
        raise HTTPException(404, "Promo link not found")
    widget = QrCodeWidget(promo_url(p.code), barLevel="M")
    x0, y0, x1, y1 = widget.getBounds()
    size = 1000
    d = Drawing(size, size, transform=[size / (x1 - x0), 0, 0, size / (y1 - y0), 0, 0])
    d.add(widget)
    return Response(renderSVG.drawToString(d), media_type="image/svg+xml",
                    headers={"Content-Disposition": f'inline; filename="rntech-qr-{p.code}.svg"'})


class PromoIn(BaseModel):
    code: str = ""
    label: str = ""
    discountPercent: Optional[float] = None   # omitted = 1/3 off
    active: bool = True


class PromoUpdate(BaseModel):
    label: Optional[str] = None
    active: Optional[bool] = None


def _bp(percent: Optional[float]) -> int:
    if percent is None:
        return 3333
    if not 0 < percent < 100:
        raise HTTPException(400, "Discount must be between 0 and 100%")
    return 3333 if abs(percent - 33.33) < 0.01 else int(round(percent * 100))


@router.get("/admin/promos")
def list_promos(db: Session = Depends(get_db), _=Depends(require_admin)):
    return [_out(db, p) for p in db.query(PromoLink).order_by(PromoLink.created_at.desc()).all()]


@router.post("/admin/promos")
def create_promo(data: PromoIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    code = data.code.strip().lower() or secrets.token_hex(3)
    if not CODE_RE.match(code):
        raise HTTPException(400, "Code must be 3–40 characters: lowercase letters, numbers and dashes")
    if db.query(PromoLink).filter(PromoLink.code == code).first():
        raise HTTPException(400, "That code is already in use")
    p = PromoLink(code=code, label=data.label.strip(), discount_bp=_bp(data.discountPercent), active=data.active)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _out(db, p)


@router.patch("/admin/promos/{promo_id}")
def update_promo(promo_id: str, data: PromoUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    p = db.query(PromoLink).filter(PromoLink.id == promo_id).first()
    if not p:
        raise HTTPException(404, "Promo link not found")
    if data.label is not None:
        p.label = data.label.strip()
    if data.active is not None:
        p.active = data.active
    db.commit()
    return _out(db, p)


@router.delete("/admin/promos/{promo_id}")
def delete_promo(promo_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    p = db.query(PromoLink).filter(PromoLink.id == promo_id).first()
    if not p:
        raise HTTPException(404, "Promo link not found")
    db.delete(p)
    db.commit()
    return {"ok": True}
