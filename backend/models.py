import json
import secrets
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


def _uid(prefix=""):
    return prefix + secrets.token_hex(8).upper()


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: _uid("u-"))
    name = Column(String, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    instagram = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")  # "user" | "admin"
    subscribed = Column(Boolean, default=True)
    unsubscribed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tickets = relationship("Ticket", back_populates="user", cascade="all, delete-orphan")
    email_sends = relationship("EmailSend", back_populates="user", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=lambda: _uid("evt-"))
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True)
    date = Column(String)            # YYYY-MM-DD
    display_date = Column(String)
    start_time = Column(String)
    end_time = Column(String)
    venue = Column(String)
    location = Column(String)
    description = Column(Text, default="")
    poster_image = Column(String, nullable=True)   # path relative to /uploads/
    ticket_banner_image = Column(String, nullable=True)  # banner shown on the ticket-buying modal, path relative to /uploads/
    ticket_bio = Column(Text, nullable=True)             # short marketing blurb shown on the ticket-buying modal, supports **bold**
    lineup_json = Column(Text, default="[]")        # [{name, role}]
    giveaways_json = Column(Text, default="[]")
    status = Column(String, default="upcoming")     # upcoming | past
    is_free = Column(Boolean, default=True)
    featured = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket_types = relationship("TicketType", back_populates="event", cascade="all, delete-orphan")
    interests = relationship("EventInterest", back_populates="event", cascade="all, delete-orphan")
    registration_mode = Column(String, default="open")  # open | interest | closed

    @property
    def lineup(self):
        return json.loads(self.lineup_json or "[]")

    @property
    def giveaways(self):
        return json.loads(self.giveaways_json or "[]")


class TicketType(Base):
    __tablename__ = "ticket_types"

    id = Column(String, primary_key=True, default=lambda: _uid("tkt-"))
    event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"))
    name = Column(String)
    price = Column(Integer, default=0)      # pence (base price, used when not tiered)
    capacity = Column(Integer, default=100)
    sold_count = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    sold_out = Column(Boolean, default=False)  # manual admin override, independent of capacity/sold_count
    nearly_gone = Column(Boolean, default=False)  # manual admin flag: shows a "Nearly Gone" label on the buy screen
    description = Column(Text, default="")
    is_tiered = Column(Boolean, default=False)
    tiers_json = Column(Text, default="[]")  # [{capacity, price_pence}]

    event = relationship("Event", back_populates="ticket_types")
    tickets = relationship("Ticket", back_populates="ticket_type")

    @property
    def effective_price(self) -> int:
        if self.is_tiered:
            tiers = json.loads(self.tiers_json or "[]")
            if tiers:
                cumulative = 0
                for tier in tiers:
                    cumulative += tier.get("capacity", 0)
                    if self.sold_count < cumulative:
                        return tier.get("price_pence", 0)
                return tiers[-1].get("price_pence", 0)
        return self.price


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String, primary_key=True, default=lambda: "RNT-" + secrets.token_hex(6).upper())
    ticket_type_id = Column(String, ForeignKey("ticket_types.id"))
    event_id = Column(String, ForeignKey("events.id"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    order_id = Column(String, ForeignKey("ticket_orders.id"), nullable=True)
    holder_name = Column(String)
    holder_email = Column(String)
    qr_code = Column(String)
    status = Column(String, default="valid")   # valid | used | cancelled
    amount_paid_pence = Column(Integer, default=0)
    issued_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="tickets")
    ticket_type = relationship("TicketType", back_populates="tickets")


class EventInterest(Base):
    __tablename__ = "event_interests"

    id = Column(String, primary_key=True, default=lambda: _uid("int-"))
    event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"))
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    email = Column(String, nullable=False)
    instagram = Column(String, nullable=True)
    message = Column(Text, default="")
    status = Column(String, default="pending")  # pending | invited | approved | rejected
    invite_token = Column(String, unique=True, nullable=True, index=True)
    invite_ticket_type_id = Column(String, ForeignKey("ticket_types.id"), nullable=True)
    invite_discount_percent = Column(Integer, default=0)
    invited_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="interests")


class TicketOrder(Base):
    __tablename__ = "ticket_orders"

    id = Column(String, primary_key=True, default=lambda: _uid("ord-"))
    event_id = Column(String, ForeignKey("events.id"))
    ticket_type_id = Column(String, ForeignKey("ticket_types.id"))
    interest_id = Column(String, ForeignKey("event_interests.id"), nullable=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    holder_name = Column(String)
    holder_email = Column(String)
    quantity = Column(Integer, default=1)
    unit_price_pence = Column(Integer, default=0)
    discount_pence = Column(Integer, default=0)
    total_pence = Column(Integer, default=0)
    stripe_session_id = Column(String, unique=True, nullable=True, index=True)
    status = Column(String, default="pending")  # pending | paid | failed_capacity | cancelled
    guest_account_created = Column(Boolean, default=False)
    offer_id = Column(String, nullable=True)   # PersonalOffer this order redeemed, if any
    client_ip = Column(String, nullable=True)
    client_user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)


class Mix(Base):
    __tablename__ = "mixes"

    id = Column(String, primary_key=True, default=lambda: _uid("mix-"))
    title = Column(String)
    resident_name = Column(String)
    month = Column(String)
    cover_image = Column(String, nullable=True)      # path relative to /uploads/
    video_filename = Column(String, nullable=True)   # path relative to /uploads/
    video_url = Column(String, nullable=True)        # external URL fallback
    description = Column(Text, default="")
    tracklist_json = Column(Text, default="[]")
    active = Column(Boolean, default=True)
    duration = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def tracklist(self):
        return json.loads(self.tracklist_json or "[]")


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(String, primary_key=True, default=lambda: _uid("msg-"))
    name = Column(String)
    email = Column(String)
    message = Column(Text)
    sent_at = Column(DateTime, default=datetime.utcnow)
    read = Column(Boolean, default=False)


class Sponsor(Base):
    __tablename__ = "sponsors"

    id = Column(String, primary_key=True, default=lambda: _uid("sp-"))
    name = Column(String)
    subtitle = Column(String, default="")
    description = Column(Text, default="")
    logo_filename = Column(String, nullable=True)   # path relative to /uploads/
    link = Column(String, default="#")
    active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class EmailCampaign(Base):
    __tablename__ = "email_campaigns"

    id = Column(String, primary_key=True, default=lambda: _uid("cmp-"))
    name = Column(String)
    subject = Column(String)
    body_html = Column(Text)
    delay_days = Column(Integer, default=0)     # days after user signup
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Throttled broadcast campaigns (audience != "drip"): queued on Start, then trickled out one email at a time.
    audience = Column(String, default="drip")            # drip | event_attended | event_no_show | event_buyers | everyone_else | all_subscribers
    # Optional personal discount: every recipient gets their own single-use link (see PersonalOffer).
    offer_event_id = Column(String, nullable=True)       # event the discount applies to
    offer_discount_bp = Column(Integer, default=0)       # basis points off: 3333 = 1/3 off, 0 = no offer
    offer_max_tickets = Column(Integer, default=4)       # most tickets one link can buy
    offer_expires_at = Column(DateTime, nullable=True)   # optional hard expiry (UTC); links also die when the event starts
    round_name = Column(String, default="default")       # campaigns in one round never email the same person and run one after another
    queue_position = Column(Integer, default=0)          # send order inside a round once queued
    start_at = Column(DateTime, nullable=True)           # queued campaign won't begin before this (UTC)
    audience_event_id = Column(String, nullable=True)    # event whose ticket buyers are emailed (event_buyers)
    send_status = Column(String, default="draft")        # draft | running | paused | completed
    gap_minutes = Column(Integer, default=20)            # average gap between two emails (jittered ±25%)
    daily_cap = Column(Integer, default=30)              # max emails per London day
    window_start_hour = Column(Integer, default=9)       # only send between these London hours
    window_end_hour = Column(Integer, default=21)
    next_send_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    last_success_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    last_error_at = Column(DateTime, nullable=True)
    consecutive_failures = Column(Integer, default=0)
    pause_reason = Column(Text, nullable=True)

    sends = relationship("EmailSend", back_populates="campaign", cascade="all, delete-orphan")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    token = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)


class EmailSend(Base):
    __tablename__ = "email_sends"

    id = Column(String, primary_key=True, default=lambda: _uid("snd-"))
    campaign_id = Column(String, ForeignKey("email_campaigns.id", ondelete="CASCADE"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    scheduled_for = Column(DateTime)
    sent_at = Column(DateTime, nullable=True)
    status = Column(String, default="pending")   # pending | sent | failed | skipped
    to_email = Column(String, nullable=True)     # snapshot of the address used, for bounce matching
    attempts = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    opened_at = Column(DateTime, nullable=True)
    open_count = Column(Integer, default=0)
    bounced_at = Column(DateTime, nullable=True)

    campaign = relationship("EmailCampaign", back_populates="sends")
    user = relationship("User", back_populates="email_sends")


class SiteSettings(Base):
    __tablename__ = "site_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, default="")


class PersonalOffer(Base):
    """A discount link that belongs to exactly one person and can be redeemed exactly once.

    The token is the only secret. Everything else (who the tickets go to, the price) is fixed server-side
    from this row, so nothing the buyer's browser sends can change who benefits or by how much.
    """
    __tablename__ = "personal_offers"

    id = Column(String, primary_key=True, default=lambda: _uid("off-"))
    token = Column(String, unique=True, nullable=False, index=True)
    campaign_id = Column(String, ForeignKey("email_campaigns.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"))
    discount_bp = Column(Integer, default=0)
    max_tickets = Column(Integer, default=4)
    expires_at = Column(DateTime, nullable=True)
    status = Column(String, default="unused")   # unused | used | revoked
    created_at = Column(DateTime, default=datetime.utcnow)
    used_at = Column(DateTime, nullable=True)
    used_order_id = Column(String, nullable=True)
    reserved_order_id = Column(String, nullable=True)   # the one checkout currently in progress
    reserved_until = Column(DateTime, nullable=True)

    user = relationship("User")
