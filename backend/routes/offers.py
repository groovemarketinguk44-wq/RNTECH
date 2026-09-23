"""Personal discount links: one per person, single-use, locked to that person's account."""
import html
import os
import secrets
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import PersonalOffer, EmailCampaign, TicketType, Event, User
from ..auth import get_current_user

router = APIRouter()

LONDON = ZoneInfo("Europe/London")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://rntech.live")

PROBLEM_TEXT = {
    "used": "This personal offer has already been used.",
    "expired": "This offer has expired.",
    "revoked": "This offer is no longer available.",
}


def discounted_price(price_pence: int, discount_bp: int) -> int:
    """Price after the discount, rounded to the nearest penny (1/3 off £10.00 = £6.67)."""
    return price_pence - int(price_pence * discount_bp / 10000 + 0.5)


def discount_label(discount_bp: int) -> str:
    if discount_bp == 3333:
        return "1/3 off"
    pct = discount_bp / 100
    return f"{pct:g}% off"


def offer_url(token: str) -> str:
    return f"{FRONTEND_URL}/?offer={token}"


def mask_email(email: str) -> str:
    local, _, domain = (email or "").partition("@")
    return (local[:1] + "***@" + domain) if domain else "your email"


def _event_open(event: Optional[Event]) -> bool:
    if not event or event.status == "past":
        return False
    today = datetime.now(LONDON).date().isoformat()
    return (event.date or "9999-12-31") >= today


def offer_problem(db: Session, offer: PersonalOffer, now: datetime) -> Optional[str]:
    """None if the link can be used right now, otherwise 'used' | 'expired' | 'revoked'."""
    if offer.status == "used":
        return "used"
    if offer.status != "unused":
        return "revoked"
    if offer.expires_at and offer.expires_at <= now:
        return "expired"
    if not _event_open(db.query(Event).filter(Event.id == offer.event_id).first()):
        return "expired"
    return None


def get_or_create_offer(db: Session, campaign: EmailCampaign, user: User) -> PersonalOffer:
    """The one link for this person in this campaign. Created the first time it's needed, then reused
    (a retried send must carry the same link, never mint a second discount)."""
    offer = db.query(PersonalOffer).filter(
        PersonalOffer.campaign_id == campaign.id, PersonalOffer.user_id == user.id).first()
    if offer:
        return offer
    offer = PersonalOffer(
        token=secrets.token_urlsafe(32), campaign_id=campaign.id, user_id=user.id,
        event_id=campaign.offer_event_id, discount_bp=campaign.offer_discount_bp or 0,
        max_tickets=campaign.offer_max_tickets or 4, expires_at=campaign.offer_expires_at,
    )
    db.add(offer)
    db.flush()
    return offer


def offer_ticket_types(db: Session, event_id: str, discount_bp: int):
    """Buyable ticket types for the offer's event with their discounted prices."""
    rows = []
    for tt in db.query(TicketType).filter(TicketType.event_id == event_id, TicketType.active == True).all():
        remaining = max(tt.capacity - tt.sold_count, 0)
        price = tt.effective_price
        if tt.sold_out or remaining <= 0 or price <= 0:
            continue
        rows.append({"id": tt.id, "name": tt.name, "price": price,
                     "discountedPrice": discounted_price(price, discount_bp), "remaining": remaining})
    return sorted(rows, key=lambda r: r["price"])


def ticket_prices_html(db: Session, campaign: EmailCampaign) -> str:
    """<ul> of the event's tickets for email bodies — with the was/now price when the campaign has an offer."""
    event_id = campaign.offer_event_id
    if not event_id:
        return ""
    bp = campaign.offer_discount_bp or 0
    items = []
    for t in offer_ticket_types(db, event_id, bp):
        name = html.escape(t["name"])
        if bp:
            items.append(f'<li>{name} &mdash; <s style="color:#888;">&pound;{t["price"]/100:.2f}</s> '
                         f'<b>&pound;{t["discountedPrice"]/100:.2f}</b></li>')
        else:
            items.append(f'<li>{name} &mdash; <b>&pound;{t["price"]/100:.2f}</b></li>')
    return "<ul>" + "".join(items) + "</ul>" if items else ""


@router.get("/offer/{token}")
def get_offer(token: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """What the personal-link page shows. Reveals only the owner's first name and a masked email."""
    offer = db.query(PersonalOffer).filter(PersonalOffer.token == token).first()
    if not offer:
        raise HTTPException(404, "This link isn't valid.")
    problem = offer_problem(db, offer, datetime.utcnow())
    if problem:
        return {"state": problem}
    if current_user and current_user.id != offer.user_id:
        return {"state": "wrong_account"}
    user = db.query(User).filter(User.id == offer.user_id).first()
    event = db.query(Event).filter(Event.id == offer.event_id).first()
    types = offer_ticket_types(db, offer.event_id, offer.discount_bp)
    if not types:
        return {"state": "sold_out"}
    return {
        "state": "ok",
        "firstName": (user.first_name or (user.name or "").split(" ")[0]) if user else "",
        "maskedEmail": mask_email(user.email if user else ""),
        "discountLabel": discount_label(offer.discount_bp),
        "maxTickets": offer.max_tickets,
        "event": {"id": event.id, "title": event.title, "displayDate": event.display_date,
                  "venue": event.venue, "location": event.location,
                  "posterImage": f"/uploads/{event.poster_image}" if event.poster_image else None},
        "ticketTypes": types,
    }
