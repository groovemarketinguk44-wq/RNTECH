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
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")  # "user" | "admin"
    subscribed = Column(Boolean, default=True)
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
    lineup_json = Column(Text, default="[]")        # [{name, role}]
    giveaways_json = Column(Text, default="[]")
    status = Column(String, default="upcoming")     # upcoming | past
    is_free = Column(Boolean, default=True)
    featured = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket_types = relationship("TicketType", back_populates="event", cascade="all, delete-orphan")

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
    price = Column(Integer, default=0)      # pence
    capacity = Column(Integer, default=100)
    sold_count = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    description = Column(Text, default="")

    event = relationship("Event", back_populates="ticket_types")
    tickets = relationship("Ticket", back_populates="ticket_type")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String, primary_key=True, default=lambda: "RNT-" + secrets.token_hex(6).upper())
    ticket_type_id = Column(String, ForeignKey("ticket_types.id"))
    event_id = Column(String, ForeignKey("events.id"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    holder_name = Column(String)
    holder_email = Column(String)
    qr_code = Column(String)
    status = Column(String, default="valid")   # valid | used | cancelled
    issued_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="tickets")
    ticket_type = relationship("TicketType", back_populates="tickets")


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

    sends = relationship("EmailSend", back_populates="campaign", cascade="all, delete-orphan")


class EmailSend(Base):
    __tablename__ = "email_sends"

    id = Column(String, primary_key=True, default=lambda: _uid("snd-"))
    campaign_id = Column(String, ForeignKey("email_campaigns.id", ondelete="CASCADE"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    scheduled_for = Column(DateTime)
    sent_at = Column(DateTime, nullable=True)
    status = Column(String, default="pending")   # pending | sent | failed

    campaign = relationship("EmailCampaign", back_populates="sends")
    user = relationship("User", back_populates="email_sends")
