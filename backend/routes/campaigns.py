import email as email_lib
import hashlib
import hmac
import html
import logging
import os
import random
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import EmailCampaign, EmailSend, User, Ticket, Event, PersonalOffer
from .offers import get_or_create_offer, offer_url, ticket_prices_html, discount_label
from ..auth import require_admin, SECRET_KEY
from ..email_service import send_email, send_email_result, build_email_html, SMTP_USER
from ..send_tracking import emails_sent_today, daily_budget, reconcile_with_mailbox, maybe_reconcile
from ..settings_utils import get_setting

router = APIRouter()
logger = logging.getLogger(__name__)

LONDON = ZoneInfo("Europe/London")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://rntech.live")
AUTO_PAUSE_AFTER_FAILURES = 3   # consecutive refused sends before a campaign pauses itself
MAX_ATTEMPTS_PER_SEND = 3
PIXEL_GIF = bytes.fromhex("47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b")

AUDIENCES = ("drip", "event_attended", "event_no_show", "event_buyers", "everyone_else", "all_subscribers")
EVENT_AUDIENCES = ("event_attended", "event_no_show", "event_buyers")
# Who claims a person first when a round has several campaigns: the more specific the rule, the earlier it goes.
AUDIENCE_RANK = {"event_attended": 0, "event_no_show": 1, "event_buyers": 2, "everyone_else": 3, "all_subscribers": 3}


# ── helpers ──────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.utcnow()


def _london(dt_utc: datetime) -> datetime:
    return dt_utc.replace(tzinfo=timezone.utc).astimezone(LONDON)


def _london_day_start_utc(now: datetime) -> datetime:
    midnight = _london(now).replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight.astimezone(timezone.utc).replace(tzinfo=None)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return (dt.isoformat() + "Z") if dt else None


def _unsub_token(user_id: str) -> str:
    return hmac.new(SECRET_KEY.encode(), f"unsub:{user_id}".encode(), hashlib.sha256).hexdigest()[:32]


def _first_name(user: User) -> str:
    return ((user.first_name or (user.name or "").split(" ")[0]) or "there").strip() or "there"


def _event_title(db: Session, event_id: Optional[str]) -> str:
    e = db.query(Event).filter(Event.id == event_id).first() if event_id else None
    return e.title if e else ""


def _user_event_titles(db: Session, user_id: str) -> str:
    rows = db.query(Event.title).join(Ticket, Ticket.event_id == Event.id).filter(
        Ticket.user_id == user_id, Ticket.status != "cancelled").distinct().all()
    return ", ".join(t for (t,) in rows)


# ── Audiences & rounds ───────────────────────────────────────────────────────
# A "round" is a group of campaigns that belong together (e.g. everything announcing Halloween).
# Inside a round every person lands in exactly ONE campaign — the most specific rule that matches them —
# and the campaigns are sent one after another, never at the same time.

def _ticket_sets(db: Session):
    """(ticketed, attended): event_id -> set(user_id). 'Attended' = at least one ticket scanned in."""
    ticketed, attended = {}, {}
    rows = db.query(Ticket.user_id, Ticket.event_id, Ticket.status).filter(
        Ticket.user_id.isnot(None), Ticket.status != "cancelled").all()
    for uid, eid, status in rows:
        ticketed.setdefault(eid, set()).add(uid)
        if status == "used":
            attended.setdefault(eid, set()).add(uid)
    return ticketed, attended


def _matches(c: EmailCampaign, uid: str, ticketed: dict, attended: dict, attended_any: set) -> bool:
    ev = c.audience_event_id
    if c.audience == "event_attended":
        return uid in attended.get(ev, ())
    if c.audience == "event_no_show":
        # Bought a ticket, never scanned in — and hasn't attended any other RNTECH event (those people
        # count as previous attendees and belong to the "everyone else" email instead).
        return uid in ticketed.get(ev, ()) and uid not in attended_any
    if c.audience == "event_buyers":
        return uid in ticketed.get(ev, ())
    return True  # everyone_else / all_subscribers: whoever hasn't been claimed by an earlier campaign


def _round_campaigns(db: Session, round_name: str):
    camps = db.query(EmailCampaign).filter(
        EmailCampaign.audience != "drip", EmailCampaign.round_name == (round_name or "default")).all()
    dates = {e.id: (e.date or "") for e in db.query(Event).all()}

    def key(c):
        date_num = int(dates.get(c.audience_event_id, "").replace("-", "") or 0)
        return (AUDIENCE_RANK.get(c.audience, 3), -date_num, c.queue_position or 0, c.created_at or datetime.min)
    return sorted(camps, key=key)


def _plan_round(db: Session, round_name: str):
    """Returns (ordered campaigns, {campaign_id: {"existing": [users], "new": [users]}}).

    existing = already queued/sent in that campaign (they stay put); new = would be queued now.
    Unsubscribed people and admins are never included, and nobody appears in two campaigns.
    """
    camps = _round_campaigns(db, round_name)
    ticketed, attended = _ticket_sets(db)
    attended_any = set().union(*attended.values()) if attended else set()
    users = db.query(User).filter(User.role == "user", User.subscribed == True).order_by(User.created_at, User.id).all()

    plan = {c.id: {"existing": [], "new": []} for c in camps}
    claimed = {}
    if camps:
        for uid, cid in db.query(EmailSend.user_id, EmailSend.campaign_id).filter(
                EmailSend.campaign_id.in_([c.id for c in camps]), EmailSend.status != "skipped").all():
            claimed.setdefault(uid, cid)
    for u in users:
        if u.id in claimed:
            plan[claimed[u.id]]["existing"].append(u)
    for c in camps:
        for u in users:
            if u.id not in claimed and _matches(c, u.id, ticketed, attended, attended_any):
                claimed[u.id] = c.id
                plan[c.id]["new"].append(u)
    return camps, plan


def _audience_users(db: Session, c: EmailCampaign):
    if c.audience == "drip":
        return []
    _camps, plan = _plan_round(db, c.round_name)
    p = plan.get(c.id, {"existing": [], "new": []})
    return p["existing"] + p["new"]


def _audience_reason(db: Session, c: EmailCampaign) -> str:
    title = _event_title(db, c.audience_event_id)
    return {
        "event_attended": f"Scanned in at {title}",
        "event_no_show": f"Bought a ticket to {title} but never scanned in",
        "event_buyers": f"Bought a ticket to {title}",
    }.get(c.audience, "On the RNTECH list — not covered by another campaign in this round")


# ── Rendering ────────────────────────────────────────────────────────────────

def _render(db: Session, c: EmailCampaign, user: User, send: Optional[EmailSend] = None, live_offer: bool = False):
    """Returns (subject, body_html, footer_html, headers) for one recipient.

    The saved email signature is deliberately NOT added — it's for personal Inbox emails, not campaigns.
    A real personal offer link is only minted for an actual send (or a test to a real account);
    previews show a placeholder so looking at a draft never creates working discount links.
    """
    first = html.escape(_first_name(user))
    event_title = html.escape(_event_title(db, c.audience_event_id))
    has_offer = bool(c.offer_discount_bp and c.offer_event_id)
    link = f"{FRONTEND_URL}/buy"
    if has_offer:
        if send is not None or live_offer:
            link = offer_url(get_or_create_offer(db, c, user).token)
        else:
            link = f"{FRONTEND_URL}/?offer=YOUR-PERSONAL-LINK-GOES-HERE"
    prices = ticket_prices_html(db, c)
    discount = discount_label(c.offer_discount_bp) if has_offer else ""

    def fill(text: str) -> str:
        return ((text or "").replace("{{first_name}}", first).replace("{{name}}", html.escape(user.name or first))
                .replace("{{event}}", event_title).replace("{{offer_link}}", link)
                .replace("{{ticket_prices}}", prices).replace("{{discount}}", discount))

    body = fill(c.body_html)
    if send is not None:
        body += f'<img src="{FRONTEND_URL}/api/track/open/{send.id}.gif" width="1" height="1" alt="" style="display:none">'
    unsub_url = f"{FRONTEND_URL}/api/unsubscribe?u={user.id}&t={_unsub_token(user.id)}"
    footer = (
        '<p style="font-size:11px;color:#888;margin-top:28px;line-height:1.5;">'
        "You're getting this because you've bought a ticket to, or joined, RNTECH. "
        f'<a href="{unsub_url}" style="color:#888;">Unsubscribe</a></p>'
    )
    headers = {"List-Unsubscribe": f"<{unsub_url}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}
    return fill(c.subject), body, footer, headers


# ── Stats & health ───────────────────────────────────────────────────────────

def _counts(db: Session, campaign_id: str) -> dict:
    by_status = dict(db.query(EmailSend.status, func.count()).filter(EmailSend.campaign_id == campaign_id).group_by(EmailSend.status).all())
    bounced = db.query(EmailSend).filter(EmailSend.campaign_id == campaign_id, EmailSend.bounced_at.isnot(None)).count()
    opened = db.query(EmailSend).filter(EmailSend.campaign_id == campaign_id, EmailSend.opened_at.isnot(None)).count()
    sent = by_status.get("sent", 0)
    return {
        "queued": sum(by_status.values()),
        "pending": by_status.get("pending", 0),
        "sent": sent,
        "failed": by_status.get("failed", 0),
        "skipped": by_status.get("skipped", 0),
        "bounced": bounced,
        "delivered": max(sent - bounced, 0),
        "opened": opened,
    }


def _sent_today(db: Session, now: datetime) -> int:
    """Broadcast emails sent since London midnight across ALL campaigns — the daily cap is one shared budget."""
    return db.query(EmailSend).join(EmailCampaign, EmailCampaign.id == EmailSend.campaign_id).filter(
        EmailCampaign.audience != "drip", EmailSend.status == "sent",
        EmailSend.sent_at >= _london_day_start_utc(now),
    ).count()


def _in_window(c: EmailCampaign, now: datetime) -> bool:
    return (c.window_start_hour or 0) <= _london(now).hour < (c.window_end_hour or 24)


def _health(c: EmailCampaign, counts: dict, sent_today: int, now: datetime, mailbox_sent: int, mailbox_budget: int):
    """(level, message) where level is ok | idle | warning | blocked."""
    if c.send_status == "running" and mailbox_sent >= mailbox_budget:
        return "ok", (f"Today's mailbox limit ({mailbox_sent}/{mailbox_budget} emails — this counts EVERYTHING "
                      "sent from this mailbox today, including tests, ticket confirmations and contact replies, "
                      "not just this campaign) is used up — resumes automatically after midnight UK time.")
    if c.send_status == "draft":
        return "idle", "Draft — nothing has been sent."
    if c.send_status == "queued":
        if c.start_at and c.start_at > now:
            return "idle", f"Queued — set to start {_london(c.start_at).strftime('%a %d %b, %H:%M')} UK."
        return "idle", "Queued — starts automatically when the campaign before it finishes."
    if c.send_status == "completed":
        return "ok", "Finished — every queued email has been processed."
    if c.send_status == "paused":
        if c.pause_reason and c.pause_reason.startswith("Auto-paused"):
            return "blocked", c.pause_reason
        return "idle", c.pause_reason or "Paused."
    # running
    if c.consecutive_failures:
        return "warning", f"The last {c.consecutive_failures} send(s) were refused: {c.last_error or 'unknown error'}"
    if c.next_send_at and _in_window(c, now) and sent_today < (c.daily_cap or 0):
        overdue = (now - c.next_send_at).total_seconds() / 60
        if overdue > max(15, (c.gap_minutes or 20) * 2):
            return "blocked", f"An email was due {int(overdue)} min ago and nothing has gone out — likely blocked/throttled by your mail provider (or the server is down)."
    if counts["sent"] >= 10 and counts["bounced"] / max(counts["sent"], 1) > 0.10:
        return "warning", f"{counts['bounced']} of {counts['sent']} emails bounced — check the addresses / your sender reputation."
    if sent_today >= (c.daily_cap or 0):
        return "ok", f"Daily cap of {c.daily_cap} reached — resumes tomorrow at {c.window_start_hour}:00."
    if not _in_window(c, now):
        return "ok", f"Outside sending hours ({c.window_start_hour}:00–{c.window_end_hour}:00 UK) — resumes at {c.window_start_hour}:00."
    return "ok", "Sending normally."


def _campaign_dict(c: EmailCampaign, db: Session, now: Optional[datetime] = None) -> dict:
    now = now or _utcnow()
    counts = _counts(db, c.id)
    broadcast = c.audience != "drip"
    audience_size = counts["queued"] if counts["queued"] else (len(_audience_users(db, c)) if broadcast else 0)
    today = _sent_today(db, now) if broadcast else 0
    mailbox_sent, mailbox_budget = (emails_sent_today(db), daily_budget(db)) if broadcast else (0, 0)
    level, message = _health(c, counts, today, now, mailbox_sent, mailbox_budget) if broadcast else ("ok", "")
    return {
        "id": c.id, "name": c.name, "subject": c.subject,
        "bodyHtml": c.body_html, "delayDays": c.delay_days,
        "active": c.active, "createdAt": c.created_at.isoformat(),
        "sentCount": counts["sent"], "pendingCount": counts["pending"],
        "audience": c.audience or "drip", "audienceEventId": c.audience_event_id,
        "audienceEventTitle": _event_title(db, c.audience_event_id),
        "roundName": c.round_name or "default", "queuePosition": c.queue_position or 0, "startAt": _iso(c.start_at),
        "sendStatus": c.send_status or "draft", "gapMinutes": c.gap_minutes, "dailyCap": c.daily_cap,
        "windowStartHour": c.window_start_hour, "windowEndHour": c.window_end_hour,
        "audienceSize": audience_size, "counts": counts, "sentToday": today,
        "nextSendAt": _iso(c.next_send_at) if c.send_status == "running" else None,
        "lastSuccessAt": _iso(c.last_success_at),
        "lastError": c.last_error, "lastErrorAt": _iso(c.last_error_at),
        "consecutiveFailures": c.consecutive_failures or 0, "pauseReason": c.pause_reason,
        "startedAt": _iso(c.started_at),
        "health": level, "healthMessage": message,
        "offerEventId": c.offer_event_id, "offerDiscountBp": c.offer_discount_bp or 0,
        "offerEventTitle": _event_title(db, c.offer_event_id), "offerMaxTickets": c.offer_max_tickets or 4,
        "offerExpiresAt": _iso(c.offer_expires_at),
        "offerLabel": discount_label(c.offer_discount_bp) if c.offer_discount_bp else "",
        "mailboxSentToday": mailbox_sent, "mailboxBudget": mailbox_budget,
        # Test sends to your own admin account mint a real offer link so you can try the flow — excluded
        # here so trying it out never inflates the real campaign performance numbers.
        "offerLinks": db.query(PersonalOffer).join(User, User.id == PersonalOffer.user_id).filter(
            PersonalOffer.campaign_id == c.id, User.role == "user").count(),
        "offerRedeemed": db.query(PersonalOffer).join(User, User.id == PersonalOffer.user_id).filter(
            PersonalOffer.campaign_id == c.id, PersonalOffer.status == "used", User.role == "user").count(),
    }


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("/admin/campaigns")
def get_campaigns(db: Session = Depends(get_db), _=Depends(require_admin)):
    campaigns = db.query(EmailCampaign).order_by(EmailCampaign.created_at.desc()).all()
    return [_campaign_dict(c, db) for c in campaigns]


class CampaignIn(BaseModel):
    name: str
    subject: str
    bodyHtml: str
    delayDays: int = 0
    active: bool = True
    audience: str = "drip"
    audienceEventId: Optional[str] = None
    roundName: str = "default"
    offerEventId: Optional[str] = None
    offerDiscountBp: int = 0          # 3333 = 1/3 off; 0 = no personal offer
    offerMaxTickets: int = 4
    offerExpiresAt: Optional[str] = None
    gapMinutes: int = 20
    dailyCap: int = 30
    windowStartHour: int = 9
    windowEndHour: int = 21


def _apply(c: EmailCampaign, data: CampaignIn, db: Session):
    if data.audience not in AUDIENCES:
        raise HTTPException(400, "Unknown audience")
    if data.audience in EVENT_AUDIENCES:
        if not data.audienceEventId or not db.query(Event).filter(Event.id == data.audienceEventId).first():
            raise HTTPException(400, "Pick the event this audience is based on")
    if data.audience != "drip" and data.offerDiscountBp:
        if not (1 <= data.offerDiscountBp <= 9500):
            raise HTTPException(400, "Discount must be between 0.01% and 95%")
        if not data.offerEventId or not db.query(Event).filter(Event.id == data.offerEventId).first():
            raise HTTPException(400, "Pick the event the personal offer applies to")
        if not (1 <= data.offerMaxTickets <= 10):
            raise HTTPException(400, "Tickets per personal link must be 1–10")
        if "{{offer_link}}" not in data.bodyHtml:
            raise HTTPException(400, "This campaign has a personal offer, but the email body has no {{offer_link}} — nobody would get their link")
    if not (1 <= data.gapMinutes <= 1440):
        raise HTTPException(400, "Gap between emails must be 1–1440 minutes")
    if not (1 <= data.dailyCap <= 500):
        raise HTTPException(400, "Daily cap must be 1–500")
    if not (0 <= data.windowStartHour < data.windowEndHour <= 24):
        raise HTTPException(400, "Sending window must start before it ends (hours 0–24)")
    c.name = data.name
    c.subject = data.subject
    c.body_html = data.bodyHtml
    c.delay_days = data.delayDays
    c.audience = data.audience
    c.audience_event_id = data.audienceEventId if data.audience in EVENT_AUDIENCES else None
    c.round_name = (data.roundName or "default").strip() or "default"
    offer_on = data.audience != "drip" and bool(data.offerDiscountBp)
    c.offer_discount_bp = data.offerDiscountBp if offer_on else 0
    c.offer_event_id = data.offerEventId if offer_on else None
    c.offer_max_tickets = data.offerMaxTickets if offer_on else 4
    c.offer_expires_at = _parse_start(data.offerExpiresAt) if offer_on else None
    # Broadcast campaigns are never auto-sent to new signups — only the queue/start buttons send them.
    c.active = data.active if data.audience == "drip" else False
    c.gap_minutes = data.gapMinutes
    c.daily_cap = data.dailyCap
    c.window_start_hour = data.windowStartHour
    c.window_end_hour = data.windowEndHour


@router.post("/admin/campaigns")
def create_campaign(data: CampaignIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = EmailCampaign(id="cmp-" + secrets.token_hex(8), send_status="draft")
    _apply(c, data, db)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _campaign_dict(c, db)


@router.put("/admin/campaigns/{campaign_id}")
def update_campaign(campaign_id: str, data: CampaignIn,
                    db: Session = Depends(get_db), _=Depends(require_admin)):
    c = db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    if (c.send_status or "draft") != "draft":
        changed = (data.audience != c.audience or (data.roundName or "default") != (c.round_name or "default")
                   or (data.audience in EVENT_AUDIENCES and data.audienceEventId != c.audience_event_id))
        if changed:
            raise HTTPException(400, "The audience and round can't be changed once a campaign is queued or sending — move it back to draft first")
    _apply(c, data, db)
    db.commit()
    db.refresh(c)
    return _campaign_dict(c, db)


@router.delete("/admin/campaigns/{campaign_id}", status_code=204)
def delete_campaign(campaign_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    db.query(PersonalOffer).filter(PersonalOffer.campaign_id == c.id, PersonalOffer.status == "unused").delete()
    db.delete(c)
    db.commit()


# ── Draft checking: preview, test, recipients ────────────────────────────────

def _get_broadcast(db: Session, campaign_id: str) -> EmailCampaign:
    c = db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    if c.audience == "drip":
        raise HTTPException(400, "This is a signup drip campaign — it sends automatically to new members, not from here")
    return c


def _sample_user(users):
    return users[0] if users else User(name="Alex Example", first_name="Alex", id="u-preview", email="alex@example.com")


@router.get("/admin/campaigns/{campaign_id}/preview")
def preview_campaign(campaign_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    sample = _sample_user(_audience_users(db, c))
    subject, body, footer, _h = _render(db, c, sample)
    return {"subject": subject, "html": build_email_html(body, footer), "sampleName": _first_name(sample)}


class TestIn(BaseModel):
    to: Optional[str] = None


@router.post("/admin/campaigns/{campaign_id}/test")
def send_test(campaign_id: str, data: TestIn, db: Session = Depends(get_db), admin=Depends(require_admin)):
    """Sends ONE test copy to the admin (or a given address) so the real email can be checked in an inbox."""
    c = db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    to = (data.to or get_setting(db, "admin_notify_email") or admin.email).strip()
    # Rendered for the admin's own account, so the personal link in a test email really works — for the admin only.
    subject, body, footer, headers = _render(db, c, admin, live_offer=True)
    ok, err = send_email_result(to, admin.name, "[TEST] " + subject, body, footer, extra_headers=headers)
    db.commit()
    if not ok:
        raise HTTPException(502, f"Test email failed: {err}")
    return {"sentTo": to}


@router.get("/admin/campaigns/{campaign_id}/recipients")
def campaign_recipients(campaign_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = _get_broadcast(db, campaign_id)
    why = _audience_reason(db, c)
    sends = db.query(EmailSend).filter(EmailSend.campaign_id == c.id).all()
    redeemed = {uid for (uid,) in db.query(PersonalOffer.user_id).filter(
        PersonalOffer.campaign_id == c.id, PersonalOffer.status == "used").all()}
    rows = []
    if sends:
        for s in sorted(sends, key=lambda s: (s.sent_at or datetime.max, s.id)):
            u = s.user
            rows.append({
                "name": u.name if u else "", "email": s.to_email or (u.email if u else ""),
                "events": _user_event_titles(db, s.user_id) if u else "", "why": why,
                "status": "bounced" if s.bounced_at else s.status, "sentAt": _iso(s.sent_at),
                "opened": bool(s.opened_at), "error": s.error,
                "redeemed": s.user_id in redeemed,
            })
    else:
        for u in _audience_users(db, c):
            rows.append({"name": u.name, "email": u.email, "events": _user_event_titles(db, u.id), "why": why,
                         "status": "not queued", "sentAt": None, "opened": False, "error": None})
    return {"recipients": rows}


# ── Round plan: preview every draft in a round side by side ──────────────────

def _est_days(size: int, c: EmailCampaign) -> int:
    per_day = max(1, min(c.daily_cap or 30, ((c.window_end_hour or 21) - (c.window_start_hour or 9)) * 60 // max(c.gap_minutes or 20, 1)))
    return max(1, -(-size // per_day)) if size else 0


@router.get("/admin/rounds/plan")
def round_plan(round: str = "default", db: Session = Depends(get_db), _=Depends(require_admin)):
    camps, plan = _plan_round(db, round)
    seen, overlaps = set(), 0
    out = []
    for c in camps:
        users = plan[c.id]["existing"] + plan[c.id]["new"]
        for u in users:
            overlaps += u.id in seen
            seen.add(u.id)
        sample = _sample_user(users)
        subject, body, footer, _h = _render(db, c, sample)
        out.append({
            "id": c.id, "name": c.name, "subject": subject, "html": build_email_html(body, footer),
            "sampleName": _first_name(sample), "audience": c.audience, "audienceEventTitle": _event_title(db, c.audience_event_id),
            "reason": _audience_reason(db, c), "audienceSize": len(users), "estDays": _est_days(len(users), c),
            "sendStatus": c.send_status or "draft", "queuePosition": c.queue_position or 0, "startAt": _iso(c.start_at),
            "recipients": [{"name": u.name, "email": u.email, "events": _user_event_titles(db, u.id)} for u in users],
        })
    unsub = db.query(User).filter(User.role == "user", User.subscribed == False).count()
    subscribed = db.query(User).filter(User.role == "user", User.subscribed == True).count()
    # Campaigns in a round share ONE daily pool (whoever's running draws against the same shared count),
    # so the round's total time is total people ÷ that shared per-day rate — NOT the sum of each
    # campaign's own rounded-up estimate, which overcounts (e.g. 2 days + 1 day + 5 days for a round
    # that actually clears in 7, because each campaign's leftover capacity doesn't carry over to the last).
    per_day_rates = [min(c.daily_cap or 30, ((c.window_end_hour or 21) - (c.window_start_hour or 9)) * 60 // max(c.gap_minutes or 20, 1)) for c in camps]
    shared_per_day = max(1, min(per_day_rates)) if per_day_rates else 30
    est_total_days = -(-len(seen) // shared_per_day) if seen else 0
    return {
        "round": round, "campaigns": out, "totalPeople": len(seen), "overlaps": overlaps,
        "unsubscribed": unsub, "subscribedNotCovered": max(subscribed - len(seen), 0),
        "estTotalDays": est_total_days,
    }


class QueueIn(BaseModel):
    startAt: Optional[str] = None   # ISO datetime — the first campaign won't begin before this


def _parse_start(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, "Invalid start time")
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


def _next_position(db: Session, round_name: str) -> int:
    top = db.query(func.max(EmailCampaign.queue_position)).filter(
        EmailCampaign.audience != "drip", EmailCampaign.round_name == round_name).scalar()
    return (top or 0) + 1


class RoundQueueIn(BaseModel):
    round: str = "default"
    startAt: Optional[str] = None


@router.post("/admin/rounds/queue")
def queue_round(data: RoundQueueIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Queues every draft in the round, in the order they'll send: attended → no-show → everyone else."""
    camps, plan = _plan_round(db, data.round)
    drafts = [c for c in camps if (c.send_status or "draft") == "draft"]
    if not drafts:
        raise HTTPException(400, "No draft campaigns in this round to queue")
    if not any(plan[c.id]["existing"] or plan[c.id]["new"] for c in drafts):
        raise HTTPException(400, "Nobody is in any of these campaigns' audiences")
    start = _parse_start(data.startAt)
    pos = _next_position(db, data.round or "default")
    for i, c in enumerate(drafts):
        c.send_status = "queued"
        c.queue_position = pos + i
        c.start_at = start if i == 0 else None
        c.pause_reason = None
    db.commit()
    return {"queued": [c.name for c in drafts]}


@router.post("/admin/campaigns/{campaign_id}/queue")
def queue_campaign(campaign_id: str, data: QueueIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = _get_broadcast(db, campaign_id)
    if (c.send_status or "draft") != "draft":
        raise HTTPException(400, f"Campaign is already {c.send_status}")
    if not _audience_users(db, c):
        raise HTTPException(400, "There's nobody to send to — the audience is empty")
    c.send_status = "queued"
    c.queue_position = _next_position(db, c.round_name or "default")
    c.start_at = _parse_start(data.startAt)
    db.commit()
    return _campaign_dict(c, db)


@router.post("/admin/campaigns/{campaign_id}/unqueue")
def unqueue_campaign(campaign_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = _get_broadcast(db, campaign_id)
    if c.send_status != "queued":
        raise HTTPException(400, "Campaign isn't queued")
    c.send_status = "draft"
    c.queue_position = 0
    c.start_at = None
    db.commit()
    return _campaign_dict(c, db)


# ── Actions: start / pause / resume / retry ──────────────────────────────────

def _queue_audience(db: Session, c: EmailCampaign) -> int:
    """Creates the send rows for everyone assigned to this campaign right now."""
    _camps, plan = _plan_round(db, c.round_name)
    now = _utcnow()
    added = 0
    for u in plan.get(c.id, {"new": []})["new"]:
        db.add(EmailSend(id="snd-" + secrets.token_hex(8), campaign_id=c.id, user_id=u.id,
                         to_email=u.email, scheduled_for=now, status="pending"))
        added += 1
    return added


def _set_running(db: Session, c: EmailCampaign):
    now = _utcnow()
    c.send_status = "running"
    c.pause_reason = None
    c.consecutive_failures = 0
    # Keep the same spacing when one campaign hands over to the next: don't fire the first email of the
    # new campaign straight after the last email of the old one.
    prev = db.query(func.max(EmailCampaign.next_send_at)).filter(
        EmailCampaign.audience != "drip", EmailCampaign.round_name == c.round_name, EmailCampaign.id != c.id,
        EmailCampaign.send_status == "completed").scalar()
    c.next_send_at = max(now, prev) if prev else now
    if not c.started_at:
        c.started_at = now


def _round_busy(db: Session, c: EmailCampaign) -> bool:
    return db.query(EmailCampaign).filter(
        EmailCampaign.audience != "drip", EmailCampaign.round_name == c.round_name, EmailCampaign.id != c.id,
        EmailCampaign.send_status.in_(("running", "paused"))).count() > 0


@router.post("/admin/campaigns/{campaign_id}/start")
def start_campaign(campaign_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = _get_broadcast(db, campaign_id)
    if c.send_status in ("running", "completed"):
        raise HTTPException(400, f"Campaign is already {c.send_status}")
    if _round_busy(db, c):
        raise HTTPException(400, "Another campaign in this round is sending or paused — campaigns in a round go one after another. Queue this one instead.")
    _queue_audience(db, c)
    db.flush()  # SessionLocal has autoflush off — make the queued rows visible to the count below
    pending = db.query(EmailSend).filter(EmailSend.campaign_id == c.id, EmailSend.status == "pending").count()
    if pending == 0:
        raise HTTPException(400, "There's nobody to send to — the audience is empty")
    c.queue_position = c.queue_position or _next_position(db, c.round_name or "default")
    c.start_at = None
    _set_running(db, c)
    db.commit()
    return _campaign_dict(c, db)


@router.post("/admin/campaigns/{campaign_id}/pause")
def pause_campaign(campaign_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = _get_broadcast(db, campaign_id)
    if c.send_status != "running":
        raise HTTPException(400, "Campaign isn't running")
    c.send_status = "paused"
    c.pause_reason = "Paused by you."
    db.commit()
    return _campaign_dict(c, db)


@router.post("/admin/campaigns/{campaign_id}/resume")
def resume_campaign(campaign_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = _get_broadcast(db, campaign_id)
    if c.send_status != "paused":
        raise HTTPException(400, "Campaign isn't paused")
    _set_running(db, c)
    db.commit()
    return _campaign_dict(c, db)


@router.post("/admin/campaigns/{campaign_id}/retry-failed")
def retry_failed(campaign_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = _get_broadcast(db, campaign_id)
    n = db.query(EmailSend).filter(EmailSend.campaign_id == c.id, EmailSend.status == "failed").update(
        {"status": "pending", "attempts": 0, "error": None})
    if n and c.send_status == "completed":
        _set_running(db, c)
    db.commit()
    return {"requeued": n}


@router.post("/admin/campaigns/{campaign_id}/blast")
def blast_campaign(campaign_id: str, _=Depends(require_admin)):
    # The old "send to everyone instantly" loop is what tripped the mail provider's limits.
    raise HTTPException(400, "Instant blasting has been replaced by paced sending — use Queue or Start sending on a broadcast campaign.")


# ── Live dashboard ───────────────────────────────────────────────────────────

def _unsubscribed_list(db: Session):
    people = db.query(User).filter(User.role == "user", User.subscribed == False).order_by(
        User.unsubscribed_at.desc(), User.name).all()
    return [{"name": u.name, "email": u.email, "unsubscribedAt": _iso(u.unsubscribed_at)} for u in people]


@router.get("/admin/email-dashboard")
def email_dashboard(db: Session = Depends(get_db), _=Depends(require_admin)):
    now = _utcnow()
    maybe_reconcile(db)  # keep "sent today" fresh whenever the dashboard is actually being looked at (throttled)
    campaigns = db.query(EmailCampaign).filter(EmailCampaign.audience != "drip").order_by(EmailCampaign.created_at.desc()).all()
    broadcast_ids = [c.id for c in campaigns]
    names = {c.id: c.name for c in campaigns}

    sends = db.query(EmailSend).filter(EmailSend.campaign_id.in_(broadcast_ids)).all() if broadcast_ids else []
    sent_users = {s.user_id for s in sends if s.status == "sent"}
    bounced_users = {s.user_id for s in sends if s.bounced_at}

    events = []
    for e in db.query(Event).order_by(Event.date.desc()).all():
        buyer_ids = {uid for (uid,) in db.query(Ticket.user_id).filter(
            Ticket.event_id == e.id, Ticket.status != "cancelled", Ticket.user_id.isnot(None)).distinct().all()}
        if not buyer_ids:
            continue
        events.append({
            "eventId": e.id, "title": e.title, "date": e.date, "buyers": len(buyer_ids),
            "contacted": len(buyer_ids & sent_users), "bounced": len(buyer_ids & bounced_users),
        })

    hourly = {}
    for s in sends:
        if s.status == "sent" and s.sent_at and s.sent_at >= now - timedelta(hours=24):
            key = s.sent_at.replace(minute=0, second=0, microsecond=0)
            hourly[key] = hourly.get(key, 0) + 1
    series = []
    for i in range(23, -1, -1):
        h = (now - timedelta(hours=i)).replace(minute=0, second=0, microsecond=0)
        series.append({"hour": h.isoformat() + "Z", "sent": hourly.get(h, 0)})

    recent = sorted([s for s in sends if s.sent_at or s.error], key=lambda s: s.sent_at or datetime.min, reverse=True)[:30]
    log = [{
        "at": _iso(s.sent_at), "campaign": names.get(s.campaign_id, ""),
        "email": s.to_email or (s.user.email if s.user else ""),
        "status": "bounced" if s.bounced_at else s.status, "error": s.error, "opened": bool(s.opened_at),
    } for s in recent]

    last_sent = max((s.sent_at for s in sends if s.status == "sent" and s.sent_at), default=None)
    day_start = _london_day_start_utc(now)
    unsub = _unsubscribed_list(db)
    return {
        "serverTime": now.isoformat() + "Z",
        "smtpConfigured": bool(SMTP_USER),
        "campaigns": [_campaign_dict(c, db, now) for c in campaigns],
        "events": events,
        "hourly": series,
        "log": log,
        "unsubscribed": unsub,
        "totals": {
            "sentToday": sum(1 for s in sends if s.status == "sent" and s.sent_at and s.sent_at >= day_start),
            "sentLastHour": sum(1 for s in sends if s.status == "sent" and s.sent_at and s.sent_at >= now - timedelta(hours=1)),
            "lastSentAt": _iso(last_sent),
            "unsubscribed": len(unsub),
            "mailboxSentToday": emails_sent_today(db), "mailboxBudget": daily_budget(db),
        },
    }


# ── Public: open tracking + unsubscribe ──────────────────────────────────────

@router.get("/track/open/{send_id}.gif")
def track_open(send_id: str, db: Session = Depends(get_db)):
    s = db.query(EmailSend).filter(EmailSend.id == send_id).first()
    if s:
        s.opened_at = s.opened_at or _utcnow()
        s.open_count = (s.open_count or 0) + 1
        db.commit()
    return Response(content=PIXEL_GIF, media_type="image/gif", headers={"Cache-Control": "no-store, max-age=0"})


def _do_unsubscribe(db: Session, u: str, t: str) -> bool:
    if not u or not t or not hmac.compare_digest(_unsub_token(u), t):
        return False
    user = db.query(User).filter(User.id == u).first()
    if not user:
        return False
    if user.subscribed:
        user.subscribed = False
        user.unsubscribed_at = _utcnow()
    # Drop anything still queued for them right away so the dashboard counts stay honest.
    db.query(EmailSend).filter(EmailSend.user_id == user.id, EmailSend.status == "pending").update({"status": "skipped"})
    db.commit()
    return True


def _page(message: str, button: str = "") -> HTMLResponse:
    return HTMLResponse(
        '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>RNTECH emails</title></head>'
        '<body style="font-family:Arial,sans-serif;background:#040c18;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;">'
        f'<div style="max-width:420px;padding:24px;text-align:center;"><h2>RNTECH</h2><p>{message}</p>{button}</div></body></html>'
    )


@router.get("/unsubscribe", response_class=HTMLResponse)
def unsubscribe_page(u: str = "", t: str = "", db: Session = Depends(get_db)):
    # GET only shows a confirm button. Unsubscribing on a plain GET would let email security scanners
    # (which pre-open every link) silently unsubscribe people who never clicked.
    user = db.query(User).filter(User.id == u).first() if u else None
    if not user or not t or not hmac.compare_digest(_unsub_token(u), t):
        return _page("That unsubscribe link isn't valid.")
    if not user.subscribed:
        return _page("You're already unsubscribed — you won't get any more emails from us.")
    button = (f'<form method="post" action="/api/unsubscribe?u={html.escape(u)}&t={html.escape(t)}">'
              '<button type="submit" style="background:#3272a8;color:#fff;border:0;padding:12px 24px;font-size:15px;font-weight:bold;cursor:pointer;border-radius:4px;">Unsubscribe me</button></form>')
    return _page("Stop all emails from RNTECH?", button)


@router.post("/unsubscribe", response_class=HTMLResponse)
def unsubscribe_confirm(u: str = "", t: str = "", db: Session = Depends(get_db)):
    """Used by the confirm button AND by mail apps' one-click List-Unsubscribe (Gmail/Apple Mail POST here)."""
    if not _do_unsubscribe(db, u, t):
        raise HTTPException(400, "Invalid unsubscribe link")
    return _page("You've been unsubscribed and won't get any more emails from us.")


# ── Senders (called by the scheduler) ────────────────────────────────────────

def _advance_queues(db: Session, now: datetime):
    """Starts the next queued campaign of a round once nothing in that round is sending or paused.

    Campaigns in a round run strictly one after another, in queue order; a campaign with a start time
    holds up everything behind it until that time.
    """
    rounds = [r for (r,) in db.query(EmailCampaign.round_name).filter(
        EmailCampaign.audience != "drip", EmailCampaign.send_status == "queued").distinct().all()]
    for rn in rounds:
        for _ in range(10):  # a campaign with an empty audience completes instantly — carry on to the next
            busy = db.query(EmailCampaign).filter(
                EmailCampaign.audience != "drip", EmailCampaign.round_name == rn,
                EmailCampaign.send_status.in_(("running", "paused"))).count()
            if busy:
                break
            nxt = db.query(EmailCampaign).filter(
                EmailCampaign.audience != "drip", EmailCampaign.round_name == rn, EmailCampaign.send_status == "queued"
            ).order_by(EmailCampaign.queue_position, EmailCampaign.created_at).first()
            if not nxt or (nxt.start_at and nxt.start_at > now):
                break
            _queue_audience(db, nxt)
            db.flush()
            if db.query(EmailSend).filter(EmailSend.campaign_id == nxt.id, EmailSend.status == "pending").count() == 0:
                nxt.send_status = "completed"
                db.commit()
                continue
            _set_running(db, nxt)
            db.commit()
            break


def run_throttled_sends(db: Session) -> int:
    """Sends at most ONE email per running campaign per call, honouring gap, daily cap and sending window."""
    now = _utcnow()
    try:
        _advance_queues(db, now)
    except Exception:
        db.rollback()
        logger.exception("Advancing the campaign queue failed")
    sent = 0
    for c in db.query(EmailCampaign).filter(EmailCampaign.send_status == "running").all():
        try:
            sent += _send_next(db, c, now)
        except Exception:
            db.rollback()
            logger.exception(f"Throttled send failed for campaign {c.id}")
    return sent


def _already_emailed_in_round(db: Session, c: EmailCampaign, user_id: str) -> bool:
    return db.query(EmailSend).join(EmailCampaign, EmailCampaign.id == EmailSend.campaign_id).filter(
        EmailSend.user_id == user_id, EmailSend.status == "sent", EmailSend.campaign_id != c.id,
        EmailCampaign.audience != "drip", EmailCampaign.round_name == c.round_name).count() > 0


def _send_next(db: Session, c: EmailCampaign, now: datetime) -> int:
    if c.next_send_at and now < c.next_send_at:
        return 0
    if not _in_window(c, now):
        return 0
    if _sent_today(db, now) >= (c.daily_cap or 0):
        return 0
    # Reconcile against the real Sent folder right before actually sending — catches anything our own
    # tracking didn't see (an email sent from Zoho's webmail directly, or a path we haven't wired up),
    # so the check that matters most uses the true total, not just what this app thinks it sent.
    if reconcile_with_mailbox(db) >= daily_budget(db):
        return 0  # the whole mailbox has used its daily quota today (tests/tickets/contact count too) — wait for tomorrow

    send = db.query(EmailSend).filter(EmailSend.campaign_id == c.id, EmailSend.status == "pending") \
        .order_by(EmailSend.scheduled_for, EmailSend.id).first()
    if not send:
        c.send_status = "completed"
        db.commit()
        return 0

    user = send.user
    if not user or not user.subscribed:
        send.status = "skipped"          # unsubscribed since queueing — never emailed; no delay needed before the next one
        db.commit()
        return 0
    if _already_emailed_in_round(db, c, user.id):
        send.status = "skipped"          # belt and braces: nobody gets two campaigns from one round
        db.commit()
        return 0

    subject, body, footer, headers = _render(db, c, user, send)
    to_email = send.to_email or user.email
    ok, err = send_email_result(to_email, user.name, subject, body, footer, extra_headers=headers)
    send.attempts = (send.attempts or 0) + 1
    if ok:
        send.status = "sent"
        send.sent_at = now
        send.error = None
        c.consecutive_failures = 0
        c.last_success_at = now
    else:
        send.error = err
        send.status = "failed" if send.attempts >= MAX_ATTEMPTS_PER_SEND else "pending"
        c.consecutive_failures = (c.consecutive_failures or 0) + 1
        c.last_error = err
        c.last_error_at = now
        if c.consecutive_failures >= AUTO_PAUSE_AFTER_FAILURES:
            c.send_status = "paused"
            c.pause_reason = (f"Auto-paused after {c.consecutive_failures} refused sends in a row — your mail "
                              f"provider is probably blocking/limiting you. Last error: {err}")
    gap = max(c.gap_minutes or 20, 1)
    c.next_send_at = now + timedelta(minutes=gap * random.uniform(0.75, 1.25))
    if ok and not db.query(EmailSend).filter(EmailSend.campaign_id == c.id, EmailSend.status == "pending").count():
        c.send_status = "completed"
    db.commit()
    return 1 if ok else 0


def process_pending_sends(db: Session):
    """Called by scheduler — flush due signup-drip sends (broadcast campaigns use run_throttled_sends)."""
    now = _utcnow()
    pending = db.query(EmailSend).join(EmailCampaign, EmailCampaign.id == EmailSend.campaign_id).filter(
        EmailSend.status == "pending",
        EmailSend.scheduled_for <= now,
        EmailCampaign.audience == "drip",
    ).all()
    for send in pending:
        user = send.user
        campaign = send.campaign
        if not user or not campaign or not user.subscribed:
            send.status = "skipped"
            continue
        ok = send_email(user.email, user.name, campaign.subject, campaign.body_html)
        send.status = "sent" if ok else "failed"
        send.sent_at = now
    db.commit()
    return len(pending)


# ── Bounce detection (reads mailer-daemon notices from the sending mailbox) ──

_BOUNCE_SEARCHES = [
    ("FROM", '"mailer-daemon"'), ("FROM", '"postmaster"'),
    ("SUBJECT", '"Undeliverable"'), ("SUBJECT", '"Undelivered"'),
    ("SUBJECT", '"Delivery Status Notification"'), ("SUBJECT", '"Mail delivery failed"'),
    ("SUBJECT", '"Returned mail"'), ("SUBJECT", '"failure notice"'),
]


def _message_text(raw: bytes) -> str:
    msg = email_lib.message_from_bytes(raw)
    parts = []
    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        payload = part.get_payload(decode=True)
        if payload:
            parts.append(payload.decode(part.get_content_charset() or "utf-8", errors="replace"))
    return (msg.get("Subject", "") + "\n" + "\n".join(parts)).lower()


def mark_bounces_in_text(db: Session, text: str, recent: dict) -> int:
    """Marks sends whose recipient appears in a bounce notice's text. `recent` maps email -> [EmailSend]."""
    if "delayed" in text[:200] and "delivery" in text[:200] and "fail" not in text[:400]:
        return 0  # a "still trying" notice, not a final failure
    n = 0
    for addr, sends in recent.items():
        if addr in text:
            for s in sends:
                if not s.bounced_at:
                    s.bounced_at = _utcnow()
                    n += 1
    return n


def scan_bounces(db: Session) -> int:
    if not SMTP_USER:
        return 0
    cutoff = _utcnow() - timedelta(days=14)
    recent = {}
    for s in db.query(EmailSend).join(EmailCampaign, EmailCampaign.id == EmailSend.campaign_id).filter(
            EmailCampaign.audience != "drip", EmailSend.status == "sent", EmailSend.sent_at >= cutoff,
            EmailSend.bounced_at.is_(None), EmailSend.to_email.isnot(None)).all():
        recent.setdefault(s.to_email.lower(), []).append(s)
    if not recent:
        return 0

    from .inbox_routes import _imap
    mail = _imap()
    try:
        mail.select("INBOX")
        since = cutoff.strftime("%d-%b-%Y")
        uids = set()
        for field, needle in _BOUNCE_SEARCHES:
            typ, data = mail.search(None, "SINCE", since, field, needle)
            if typ == "OK" and data and data[0]:
                uids.update(data[0].split())
        marked = 0
        for uid in sorted(uids)[-300:]:
            typ, msg_data = mail.fetch(uid, "(BODY.PEEK[])")
            if typ != "OK" or not msg_data or not msg_data[0]:
                continue
            marked += mark_bounces_in_text(db, _message_text(msg_data[0][1]), recent)
        db.commit()
        return marked
    finally:
        try:
            mail.logout()
        except Exception:
            pass
