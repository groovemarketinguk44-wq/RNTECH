import json
import os
import secrets
import logging
import time
from datetime import datetime, timedelta
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import Event, TicketType, EventInterest, Ticket, TicketOrder, User, PersonalOffer
from .offers import offer_problem, discounted_price, discount_label, PROBLEM_TEXT
from .promos import active_promo
from ..auth import get_current_user, get_or_create_guest_user, ensure_guest_email_available, create_password_setup_link
from ..email_service import send_email
from ..ticket_pdf import generate_tickets_pdf
from .. import meta_capi
from .. import onesignal_notify

router = APIRouter()
logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://rntech.live")
MIN_CHARGE_PENCE = 30  # Stripe's minimum payable amount in GBP
MAX_QUANTITY = 10  # per checkout — keeps a single buyer from wiping out a ticket type

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


class CheckoutIn(BaseModel):
    ticketTypeId: str
    holderName: str = ""
    holderEmail: str = ""
    inviteToken: str = ""
    offerToken: str = ""   # personal discount link — see _create_offer_checkout
    promoCode: str = ""    # public QR discount link (/qr/{code}) — ignored if switched off
    quantity: int = 1


@router.post("/checkout/session")
def create_checkout_session(data: CheckoutIn, request: Request, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Payments aren't configured yet — please check back soon.")
    if data.offerToken:
        return _create_offer_checkout(data, request, db, current_user)

    tt = db.query(TicketType).filter(TicketType.id == data.ticketTypeId, TicketType.active == True).first()
    if not tt:
        raise HTTPException(404, "Ticket type not found")
    if tt.sold_out:
        raise HTTPException(400, "This ticket type is sold out")

    event = db.query(Event).filter(Event.id == tt.event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")

    price = tt.effective_price
    if price <= 0:
        raise HTTPException(400, "This ticket type is free — use the free ticket flow instead")

    discount_percent = 0
    interest = None
    quantity = data.quantity
    if data.inviteToken:
        interest = db.query(EventInterest).filter(EventInterest.invite_token == data.inviteToken).first()
        if not interest:
            raise HTTPException(404, "This invite link wasn't found")
        if interest.status == "approved":
            raise HTTPException(400, "This invite has already been used")
        if interest.event_id != tt.event_id:
            raise HTTPException(400, "This invite is for a different event")
        discount_percent = interest.invite_discount_percent or 0

    # A switched-off (or unknown) code just means full price, so a QR scanned after the offer ends still
    # sells a ticket. Doesn't stack with an invite discount.
    promo = None if interest else active_promo(db, data.promoCode)

    if quantity < 1 or quantity > MAX_QUANTITY:
        raise HTTPException(400, f"Quantity must be between 1 and {MAX_QUANTITY}")
    if tt.sold_count + quantity > tt.capacity:
        remaining = max(tt.capacity - tt.sold_count, 0)
        raise HTTPException(400, f"Only {remaining} of this ticket type left")

    if promo:
        unit_total_pence = discounted_price(price, promo.discount_bp)
        discount_pence = price - unit_total_pence
    else:
        discount_pence = (price * discount_percent) // 100
        unit_total_pence = max(price - discount_pence, 0)
    if unit_total_pence < MIN_CHARGE_PENCE:
        raise HTTPException(400, "That discount takes the ticket below the minimum payable amount")
    total_pence = unit_total_pence * quantity

    holder_name = data.holderName.strip()
    holder_email = data.holderEmail.strip().lower()
    if not holder_name or not holder_email:
        raise HTTPException(400, "Name and email are required")

    guest_created = False
    order_user_id = current_user.id if current_user else None
    if not current_user:
        ensure_guest_email_available(db, holder_email)
        guest_user, guest_created = get_or_create_guest_user(db, holder_name, holder_email)
        order_user_id = guest_user.id

    ip_address = meta_capi.client_ip(request)
    user_agent = request.headers.get("user-agent", "")

    order = TicketOrder(
        event_id=event.id,
        ticket_type_id=tt.id,
        interest_id=interest.id if interest else None,
        user_id=order_user_id,
        holder_name=holder_name,
        holder_email=holder_email,
        quantity=quantity,
        unit_price_pence=price,
        discount_pence=discount_pence,
        total_pence=total_pence,
        status="pending",
        guest_account_created=guest_created,
        promo_id=promo.id if promo else None,
        client_ip=ip_address,
        client_user_agent=user_agent,
    )
    db.add(order)
    db.flush()

    event_source_url = f"{FRONTEND_URL}/buy"
    meta_capi.send_event(
        "InitiateCheckout", event_source_url, ip_address=ip_address, user_agent=user_agent,
        email=holder_email, event_id=f"initiate-{order.id}",
        custom_data={"currency": "GBP", "value": total_pence / 100},
    )
    if guest_created:
        meta_capi.send_event(
            "CompleteRegistration", event_source_url, ip_address=ip_address, user_agent=user_agent,
            email=holder_email, event_id=f"register-{order_user_id}",
        )

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            customer_email=holder_email,
            line_items=[{
                "price_data": {
                    "currency": "gbp",
                    "product_data": {"name": f"{event.title} — {tt.name}",
                                     **({"description": f"Offer: {discount_label(promo.discount_bp)}"} if promo else {})},
                    "unit_amount": unit_total_pence,
                },
                "quantity": quantity,
            }],
            metadata={"order_id": order.id, **({"promo_id": promo.id} if promo else {})},
            success_url=f"{FRONTEND_URL}/?checkout=success&order={order.id}",
            cancel_url=f"{FRONTEND_URL}/?checkout=cancelled&order={order.id}",
        )
    except Exception as e:
        db.rollback()
        logger.exception("Stripe checkout session creation failed")
        raise HTTPException(502, f"Could not start checkout: {e}")

    order.stripe_session_id = session.id
    db.commit()
    return {"url": session.url, "orderId": order.id}


OFFER_RESERVATION_MINUTES = 31   # Stripe's minimum checkout-session lifetime is 30 min


def _create_offer_checkout(data: CheckoutIn, request: Request, db: Session, current_user):
    """Checkout for a personal discount link. Deliberately ignores any name/email/price the browser sends:

    - tickets always go to the account the link was issued to (name and email come from that account),
    - the discount is computed here from the link, never trusted from the request,
    - the link works for one purchase only and only one checkout can be live at a time.
    """
    now = datetime.utcnow()
    offer = db.query(PersonalOffer).filter(PersonalOffer.token == data.offerToken).first()
    if not offer:
        raise HTTPException(404, "This link isn't valid.")
    problem = offer_problem(db, offer, now)
    if problem:
        raise HTTPException(400, PROBLEM_TEXT[problem])
    if current_user and current_user.id != offer.user_id:
        raise HTTPException(403, "This offer is personal to someone else's account.")

    owner = db.query(User).filter(User.id == offer.user_id).first()
    if not owner:
        raise HTTPException(400, PROBLEM_TEXT["revoked"])

    tt = db.query(TicketType).filter(TicketType.id == data.ticketTypeId, TicketType.active == True).first()
    if not tt or tt.event_id != offer.event_id:
        raise HTTPException(400, "That ticket isn't part of this offer")
    if tt.sold_out:
        raise HTTPException(400, "This ticket type is sold out")
    event = db.query(Event).filter(Event.id == tt.event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")

    quantity = data.quantity
    limit = min(offer.max_tickets or 1, MAX_QUANTITY)
    if quantity < 1 or quantity > limit:
        raise HTTPException(400, f"You can buy between 1 and {limit} tickets with this offer")
    if tt.sold_count + quantity > tt.capacity:
        remaining = max(tt.capacity - tt.sold_count, 0)
        raise HTTPException(400, f"Only {remaining} of this ticket type left")

    price = tt.effective_price
    if price <= 0:
        raise HTTPException(400, "This ticket type is free — no offer needed")
    unit_total_pence = discounted_price(price, offer.discount_bp)
    if unit_total_pence < MIN_CHARGE_PENCE:
        raise HTTPException(400, "That discount takes the ticket below the minimum payable amount")
    total_pence = unit_total_pence * quantity

    # One live checkout at a time: a second attempt supersedes the first (so a genuine retry isn't locked
    # out) but the first can no longer be paid — and if it already was, the link is spent.
    if offer.reserved_order_id and offer.reserved_until and offer.reserved_until > now:
        old = db.query(TicketOrder).filter(TicketOrder.id == offer.reserved_order_id).first()
        if old and old.status == "paid":
            raise HTTPException(400, PROBLEM_TEXT["used"])
        if old and old.stripe_session_id:
            try:
                stripe.checkout.Session.expire(old.stripe_session_id)
            except Exception:
                try:
                    if stripe.checkout.Session.retrieve(old.stripe_session_id).status == "complete":
                        raise HTTPException(409, "A payment for this offer is already going through — check your email in a moment.")
                except HTTPException:
                    raise
                except Exception:
                    logger.exception("Could not verify the superseded checkout session")
                    raise HTTPException(503, "Couldn't safely restart checkout — please try again in a minute.")
        if old:
            old.status = "cancelled"

    ip_address = meta_capi.client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    order = TicketOrder(
        event_id=event.id, ticket_type_id=tt.id, user_id=owner.id,
        holder_name=owner.name, holder_email=owner.email,
        quantity=quantity, unit_price_pence=price, discount_pence=price - unit_total_pence,
        total_pence=total_pence, status="pending", guest_account_created=False,
        offer_id=offer.id, client_ip=ip_address, client_user_agent=user_agent,
    )
    db.add(order)
    db.flush()

    meta_capi.send_event(
        "InitiateCheckout", f"{FRONTEND_URL}/buy", ip_address=ip_address, user_agent=user_agent,
        email=owner.email, event_id=f"initiate-{order.id}",
        custom_data={"currency": "GBP", "value": total_pence / 100},
    )

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            customer_email=owner.email,
            line_items=[{
                "price_data": {
                    "currency": "gbp",
                    "product_data": {"name": f"{event.title} — {tt.name}",
                                     "description": f"Personal offer: {discount_label(offer.discount_bp)}"},
                    "unit_amount": unit_total_pence,
                },
                "quantity": quantity,
            }],
            metadata={"order_id": order.id, "offer_id": offer.id},
            expires_at=int(time.time()) + OFFER_RESERVATION_MINUTES * 60,
            success_url=f"{FRONTEND_URL}/?checkout=success&order={order.id}",
            cancel_url=f"{FRONTEND_URL}/?checkout=cancelled&order={order.id}",
        )
    except Exception as e:
        db.rollback()
        logger.exception("Stripe checkout session creation failed (offer)")
        raise HTTPException(502, f"Could not start checkout: {e}")

    order.stripe_session_id = session.id
    offer.reserved_order_id = order.id
    offer.reserved_until = now + timedelta(minutes=OFFER_RESERVATION_MINUTES)
    db.commit()
    return {"url": session.url, "orderId": order.id}


@router.get("/checkout/order/{order_id}")
def get_order_status(order_id: str, db: Session = Depends(get_db)):
    o = db.query(TicketOrder).filter(TicketOrder.id == order_id).first()
    if not o:
        raise HTTPException(404, "Order not found")
    result = {"status": o.status}
    if o.status == "paid":
        t = db.query(Ticket).filter(Ticket.order_id == o.id).first()
        if t:
            result["ticketId"] = t.id
    return result


@router.get("/invite/{token}")
def get_invite(token: str, db: Session = Depends(get_db)):
    i = db.query(EventInterest).filter(EventInterest.invite_token == token).first()
    if not i:
        raise HTTPException(404, "This invite link wasn't found")
    event = db.query(Event).filter(Event.id == i.event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    if i.status == "approved":
        return {"used": True, "event": {"title": event.title if event else ""}}

    discount_percent = i.invite_discount_percent or 0
    active_types = db.query(TicketType).filter(
        TicketType.event_id == i.event_id, TicketType.active == True
    ).all()
    ticket_types = []
    for tt in active_types:
        if tt.sold_out:
            continue
        price = tt.effective_price
        if price <= 0:
            continue  # free types don't need an invite — they issue instantly anyway
        remaining = max(tt.capacity - tt.sold_count, 0)
        if remaining <= 0:
            continue
        discounted = max(price - (price * discount_percent // 100), 0)
        ticket_types.append({"id": tt.id, "name": tt.name, "price": price, "discountedPrice": discounted, "remaining": remaining})

    if not ticket_types:
        raise HTTPException(400, "No paid ticket types are currently available for this event")

    return {
        "used": False,
        "token": token,
        "event": {
            "id": event.id, "title": event.title, "displayDate": event.display_date,
            "venue": event.venue, "location": event.location,
            "posterImage": f"/uploads/{event.poster_image}" if event.poster_image else None,
        },
        "discountPercent": discount_percent,
        "ticketTypes": ticket_types,
        "holderName": i.name,
        "holderEmail": i.email,
    }


def _fulfill_order(db: Session, order_id: str):
    if not order_id:
        return
    order = db.query(TicketOrder).filter(TicketOrder.id == order_id).first()
    if not order or order.status == "paid":
        return  # already handled — keeps the webhook idempotent

    quantity = order.quantity or 1
    tt = db.query(TicketType).filter(TicketType.id == order.ticket_type_id).first()
    if not tt or tt.sold_count + quantity > tt.capacity:
        order.status = "failed_capacity"
        db.commit()
        return

    tickets = []
    for _ in range(quantity):
        ticket = Ticket(
            ticket_type_id=order.ticket_type_id,
            event_id=order.event_id,
            user_id=order.user_id,
            holder_name=order.holder_name,
            holder_email=order.holder_email,
            qr_code=secrets.token_hex(6).upper(),
            status="valid",
            order_id=order.id,
            amount_paid_pence=order.total_pence // quantity,
        )
        tt.sold_count += 1
        db.add(ticket)
        tickets.append(ticket)

    order.status = "paid"
    order.paid_at = datetime.utcnow()

    if order.offer_id:
        offer = db.query(PersonalOffer).filter(PersonalOffer.id == order.offer_id).first()
        if offer:
            offer.status = "used"
            offer.used_at = order.paid_at
            offer.used_order_id = order.id

    if order.interest_id:
        interest = db.query(EventInterest).filter(EventInterest.id == order.interest_id).first()
        if interest:
            interest.status = "approved"

    db.commit()
    for t in tickets:
        db.refresh(t)

    event = db.query(Event).filter(Event.id == order.event_id).first()
    _send_ticket_confirmation(
        db, event, tickets, order.holder_name, order.holder_email,
        user_id=order.user_id, guest_account_created=order.guest_account_created,
    )

    onesignal_notify.notify_ticket_sale(
        quantity=order.quantity,
        event_title=event.title if event else "an event",
        buyer_name=order.holder_name,
        total_pence=order.total_pence,
    )

    meta_capi.send_event(
        "Purchase", f"{FRONTEND_URL}/buy",
        ip_address=order.client_ip or "", user_agent=order.client_user_agent or "",
        email=order.holder_email, event_id=f"purchase-{order.id}",
        custom_data={"currency": "GBP", "value": order.total_pence / 100},
    )


def _send_ticket_confirmation(
    db: Session, event, tickets: list, holder_name: str, holder_email: str,
    user_id: str = None, guest_account_created: bool = False,
):
    try:
        ticket_type_names = {}
        for t in tickets:
            if t.ticket_type_id not in ticket_type_names:
                tt = db.query(TicketType).filter(TicketType.id == t.ticket_type_id).first()
                ticket_type_names[t.ticket_type_id] = tt.name if tt else "Ticket"

        pdf_bytes = generate_tickets_pdf(tickets, event, ticket_type_names)
        refs = ", ".join(t.id for t in tickets)
        plural = "s" if len(tickets) > 1 else ""
        event_title = event.title if event else "the event"

        account_block = ""
        if guest_account_created and user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                setup_link = create_password_setup_link(db, user)
                db.commit()
                account_block = (
                    f"<p>We've also set up a free RNTECH account for you using <b>{holder_email}</b>, "
                    f"so your ticket{plural} {'are' if len(tickets) > 1 else 'is'} always there under "
                    f"<b>My Tickets</b>. <a href=\"{setup_link}\">Set a password</a> whenever you'd like to log in.</p>"
                )

        send_email(
            holder_email, holder_name,
            f"Your ticket{plural} to {event_title}",
            f"<p>Thanks for your purchase! Your {len(tickets)} ticket{plural} to <b>{event_title}</b> "
            f"{'are' if len(tickets) > 1 else 'is'} attached to this email as a PDF — print it out or show it "
            f"on your phone at the door.</p>"
            f"<p>Ticket reference{plural}: <b>{refs}</b></p>"
            f"{account_block}"
            f"<p>If you're logged into your RNTECH account, you can also view your ticket{plural} anytime "
            f"under <b>My Tickets</b> on the website.</p>",
            attachments=[{
                "filename": "rntech-tickets.pdf" if len(tickets) > 1 else f"rntech-ticket-{tickets[0].id}.pdf",
                "content": pdf_bytes,
            }],
        )
    except Exception:
        logger.exception("Failed to send ticket confirmation email")


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    if not STRIPE_WEBHOOK_SECRET:
        # Refuse to process unsigned events rather than trust an unverified payload —
        # anyone could otherwise POST a fake "paid" event and get a free ticket.
        raise HTTPException(503, "Webhook signing secret not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        # construct_event verifies the signature; we don't use its return value
        # for data access since the SDK's response object type (and whether it
        # behaves like a plain dict) varies across stripe-python versions.
        stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Invalid webhook payload")

    event_dict = json.loads(payload)

    if event_dict.get("type") == "checkout.session.completed":
        session = event_dict.get("data", {}).get("object", {})
        order_id = (session.get("metadata") or {}).get("order_id")
        _fulfill_order(db, order_id)

    return {"received": True}
