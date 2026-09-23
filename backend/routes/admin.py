import io
import os
import csv
import logging
from datetime import datetime, timedelta
from typing import Optional
import stripe
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Event, Ticket, Mix, ContactMessage, EmailSend, TicketOrder
from ..auth import require_admin
from .. import meta_ads
from ..settings_utils import get_setting, set_setting

router = APIRouter()
logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
PROFIT_GOAL_PENCE = 50000       # £500 goal
PROFIT_STRETCH_GOAL_PENCE = 100000  # £1,000 stretch goal

_stripe_charge_cache = {}  # stripe_session_id -> {"amount","fee","net"} | None, fees never change once charged


def _order_stripe_charge(session_id: str):
    if session_id in _stripe_charge_cache:
        return _stripe_charge_cache[session_id]
    result = None
    try:
        session = stripe.checkout.Session.retrieve(
            session_id, expand=["payment_intent.latest_charge.balance_transaction"]
        )
        pi = session.payment_intent
        charge = pi.latest_charge if pi else None
        bt = charge.balance_transaction if charge else None
        if bt:
            result = {"amount": bt.amount, "fee": bt.fee, "net": bt.net}
    except Exception:
        logger.exception(f"Failed to fetch Stripe charge for session {session_id}")
    _stripe_charge_cache[session_id] = result
    return result


def _dj_spend_key(event_id: str = None) -> str:
    return f"dj_spend_pence:{event_id}" if event_id else "dj_spend_pence"


def _cash_revenue_key(event_id: str = None) -> str:
    return f"cash_revenue_pence:{event_id}" if event_id else "cash_revenue_pence"


def _ads_range(db, event_id: str, days: int, window_start: datetime):
    """Date range of Meta ad spend that belongs to this event, or None to use the plain rolling window.

    Ad spend comes from the whole ad account, so it's tied to an event by date: `ads_since` (and
    optionally `ads_until`) mark that event's campaign period. Without them, spend is account-wide.
    """
    if not event_id:
        return None
    ads_since = get_setting(db, f"ads_since:{event_id}", "") or None
    ads_until = get_setting(db, f"ads_until:{event_id}", "") or None
    if not ads_since and not ads_until:
        return None
    window_day = window_start.date().isoformat()
    since = max(ads_since, window_day) if ads_since else window_day
    return since, ads_until


def _event_ads_overview(db, event_id: str, days: int, window_start: datetime):
    rng = _ads_range(db, event_id, days, window_start)
    return meta_ads.get_overview(days, *rng) if rng else meta_ads.get_overview(days)


@router.get("/admin/stats")
def get_stats(db: Session = Depends(get_db), _=Depends(require_admin)):
    return {
        "events": db.query(Event).count(),
        "tickets": db.query(Ticket).count(),
        "users": db.query(User).filter(User.role == "user").count(),
        "messages": db.query(ContactMessage).filter(ContactMessage.read == False).count(),
        "mixes": db.query(Mix).filter(Mix.active == True).count(),
        "subscribers": db.query(User).filter(User.subscribed == True).count(),
    }


@router.get("/admin/payments/overview")
def get_payments_overview(days: int = 30, event_id: str = None, db: Session = Depends(get_db), _=Depends(require_admin)):
    days = max(1, min(days, 365))
    since = datetime.utcnow() - timedelta(days=days - 1)
    since_midnight = since.replace(hour=0, minute=0, second=0, microsecond=0)

    order_query = db.query(TicketOrder).filter(TicketOrder.status == "paid")
    if event_id:
        order_query = order_query.filter(TicketOrder.event_id == event_id)
    paid_orders = order_query.all()
    tickets_sold_total = sum(o.quantity for o in paid_orders)
    gross_revenue_total_pence = sum(o.total_pence for o in paid_orders)

    orders_in_window = [o for o in paid_orders if o.paid_at and o.paid_at >= since_midnight]

    daily = {}
    for o in orders_in_window:
        day = o.paid_at.strftime("%Y-%m-%d")
        d = daily.setdefault(day, {"date": day, "ticketsSold": 0, "revenuePence": 0})
        d["ticketsSold"] += o.quantity
        d["revenuePence"] += o.total_pence

    series = []
    for i in range(days - 1, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        series.append(daily.get(day, {"date": day, "ticketsSold": 0, "revenuePence": 0}))

    stripe_data = {"available": False}
    if STRIPE_SECRET_KEY:
        stripe.api_key = STRIPE_SECRET_KEY
        if event_id:
            # No account-wide date query can isolate one event's charges, so reconcile
            # this event's own orders against Stripe directly (cached — fees never change once charged).
            try:
                gross_pence = fee_pence = net_pence = 0
                partial = False
                for o in orders_in_window:
                    if not o.stripe_session_id or not o.stripe_session_id.startswith("cs_"):
                        continue
                    charge = _order_stripe_charge(o.stripe_session_id)
                    if charge is None:
                        partial = True
                        continue
                    gross_pence += charge["amount"]
                    fee_pence += charge["fee"]
                    net_pence += charge["net"]
                stripe_data = {"available": True, "grossPence": gross_pence, "feePence": fee_pence, "netPence": net_pence, "partial": partial}
            except Exception:
                logger.exception("Failed to reconcile per-event Stripe charges")
                stripe_data = {"available": False, "error": True}
        else:
            try:
                gross_pence = fee_pence = net_pence = 0
                starting_after = None
                while True:
                    kwargs = {"limit": 100, "created": {"gte": int(since_midnight.timestamp())}}
                    if starting_after:
                        kwargs["starting_after"] = starting_after
                    page = stripe.BalanceTransaction.list(**kwargs)
                    for txn in page.data:
                        if txn.type != "charge":
                            continue  # skip payouts/transfers/adjustments — only charges represent ticket revenue
                        gross_pence += txn.amount
                        fee_pence += txn.fee
                        net_pence += txn.net
                    if not page.has_more:
                        break
                    starting_after = page.data[-1].id
                stripe_data = {"available": True, "grossPence": gross_pence, "feePence": fee_pence, "netPence": net_pence}
            except Exception:
                logger.exception("Failed to fetch Stripe balance transactions")
                stripe_data = {"available": False, "error": True}

    dj_spend_pence = int(get_setting(db, _dj_spend_key(event_id), "45000"))
    cash_revenue_pence = int(get_setting(db, _cash_revenue_key(event_id), "0"))
    ads_overview = _event_ads_overview(db, event_id, days, since_midnight)
    ad_spend_pence = round(ads_overview["spend"] * 100) if ads_overview.get("available") else 0
    net_revenue_pence = (stripe_data["netPence"] if stripe_data.get("available") else 0) + cash_revenue_pence
    profit_pence = (
        net_revenue_pence - dj_spend_pence - ad_spend_pence
    ) if (stripe_data.get("available") or cash_revenue_pence) else None

    return {
        "periodDays": days,
        "eventId": event_id,
        "ticketsSoldTotal": tickets_sold_total,
        "grossRevenueTotalPence": gross_revenue_total_pence,
        "dailySeries": series,
        "stripe": stripe_data,
        "djSpendPence": dj_spend_pence,
        "adSpendPence": ad_spend_pence,
        "cashRevenuePence": cash_revenue_pence,
        "adsSince": (get_setting(db, f"ads_since:{event_id}", "") or None) if event_id else None,
        "adsUntil": (get_setting(db, f"ads_until:{event_id}", "") or None) if event_id else None,
        "netRevenuePence": net_revenue_pence,
        "profitPence": profit_pence,
        "targets": {"goalPence": PROFIT_GOAL_PENCE, "stretchGoalPence": PROFIT_STRETCH_GOAL_PENCE},
    }


class DjSpendIn(BaseModel):
    pence: int
    eventId: Optional[str] = None


@router.put("/admin/dj-spend")
def update_dj_spend(data: DjSpendIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    if data.pence < 0:
        raise HTTPException(400, "DJ spend cannot be negative")
    set_setting(db, _dj_spend_key(data.eventId), str(data.pence))
    return {"djSpendPence": data.pence}


class CashRevenueIn(BaseModel):
    pence: int
    eventId: Optional[str] = None


@router.post("/admin/cash-revenue")
def add_cash_revenue(data: CashRevenueIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    if data.pence <= 0:
        raise HTTPException(400, "Amount must be positive")
    key = _cash_revenue_key(data.eventId)
    current = int(get_setting(db, key, "0"))
    total = current + data.pence
    set_setting(db, key, str(total))
    return {"cashRevenuePence": total}


class AdsRangeIn(BaseModel):
    eventId: str
    since: Optional[str] = None   # YYYY-MM-DD, blank = no start bound
    until: Optional[str] = None   # YYYY-MM-DD, blank = still running


def _valid_day(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except ValueError:
        raise HTTPException(400, "Dates must be YYYY-MM-DD")


@router.put("/admin/ads-range")
def update_ads_range(data: AdsRangeIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    if not db.query(Event).filter(Event.id == data.eventId).first():
        raise HTTPException(404, "Event not found")
    since, until = _valid_day(data.since), _valid_day(data.until)
    if since and until and since > until:
        raise HTTPException(400, "Start date must be on or before the end date")
    set_setting(db, f"ads_since:{data.eventId}", since)
    set_setting(db, f"ads_until:{data.eventId}", until)
    return {"adsSince": since or None, "adsUntil": until or None}


@router.get("/admin/meta-ads/overview")
def get_meta_ads_overview(days: int = 30, event_id: str = None, db: Session = Depends(get_db), _=Depends(require_admin)):
    days = max(1, min(days, 90))
    since = (datetime.utcnow() - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    overview = _event_ads_overview(db, event_id, days, since)
    if overview.get("available"):
        # Cash sales (stripe_session_id is null) aren't ad-attributable — a walk-up/cash buyer
        # wasn't converted by the ad, so counting their spend here would inflate ROAS.
        order_query = db.query(TicketOrder).filter(
            TicketOrder.status == "paid", TicketOrder.stripe_session_id.isnot(None)
        )
        if event_id:
            order_query = order_query.filter(TicketOrder.event_id == event_id)
        revenue_pence = sum(o.total_pence for o in order_query.all() if o.paid_at and o.paid_at >= since)
        overview["ticketRevenuePence"] = revenue_pence
        overview["roas"] = round(revenue_pence / 100 / overview["spend"], 2) if overview["spend"] else None
    return overview


@router.get("/admin/attendees")
def get_attendees(db: Session = Depends(get_db), _=Depends(require_admin)):
    users = db.query(User).filter(User.role == "user").order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        ticket_count = db.query(Ticket).filter(Ticket.user_id == u.id).count()
        result.append({
            "id": u.id, "name": u.name,
            "firstName": u.first_name or "", "lastName": u.last_name or "",
            "email": u.email, "instagram": u.instagram or "",
            "role": u.role, "subscribed": u.subscribed,
            "joinedAt": u.created_at.isoformat(),
            "ticketCount": ticket_count,
        })
    return result


class UserEditIn(BaseModel):
    firstName: str
    lastName: str
    email: str
    instagram: str = ""
    role: str = "user"


@router.put("/admin/users/{user_id}")
def update_user(user_id: str, data: UserEditIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    first = data.firstName.strip()
    last = data.lastName.strip()
    if not first or not last:
        raise HTTPException(400, "First and last name are required")
    email = data.email.lower().strip()
    clash = db.query(User).filter(User.email == email, User.id != user_id).first()
    if clash:
        raise HTTPException(400, "That email is already in use by another account")
    u.first_name = first
    u.last_name = last
    u.name = f"{first} {last}"
    u.email = email
    u.instagram = data.instagram.strip().lstrip("@") or None
    u.role = data.role if data.role in ("user", "admin") else "user"
    db.commit()
    return {"id": u.id, "name": u.name, "firstName": u.first_name, "lastName": u.last_name,
            "email": u.email, "instagram": u.instagram or "", "role": u.role,
            "subscribed": u.subscribed}


@router.delete("/admin/users/{user_id}", status_code=204)
def delete_user(user_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    if u.role == "admin":
        raise HTTPException(400, "Cannot delete an admin account")
    db.delete(u)
    db.commit()


@router.get("/admin/attendees/export")
def export_attendees(db: Session = Depends(get_db), _=Depends(require_admin)):
    users = db.query(User).filter(User.role == "user").order_by(User.created_at.desc()).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Name", "Email", "Subscribed", "Joined", "Tickets"])
    for u in users:
        tc = db.query(Ticket).filter(Ticket.user_id == u.id).count()
        writer.writerow([u.name, u.email, "Yes" if u.subscribed else "No",
                         u.created_at.strftime("%Y-%m-%d"), tc])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=rntech-attendees.csv"},
    )


@router.put("/admin/users/{user_id}/unsubscribe")
def unsubscribe_user(user_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if u:
        u.subscribed = False
        db.commit()
    return {"ok": True}
