"""Tracks how many emails have actually left this mailbox today, across EVERYTHING — campaigns, the
signup drip, ticket confirmations, contact-form replies, test sends. Mail providers (Zoho etc.) rate-limit
the whole account, not just one feature, so a campaign must know the account's real total before it sends
another one, not just its own count.
"""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from .settings_utils import get_setting, set_setting

logger = logging.getLogger(__name__)

LONDON = ZoneInfo("Europe/London")
DEFAULT_DAILY_BUDGET = 100


def _today_key() -> str:
    return "emails_sent_total:" + datetime.now(LONDON).date().isoformat()


def record_email_sent(db, n: int = 1):
    key = _today_key()
    set_setting(db, key, str(int(get_setting(db, key, "0")) + n))


def emails_sent_today(db) -> int:
    return int(get_setting(db, _today_key(), "0"))


def daily_budget(db) -> int:
    return int(get_setting(db, "email_daily_budget", str(DEFAULT_DAILY_BUDGET)))


_RECONCILE_GAP_SECONDS = 60  # don't hit Zoho's IMAP more than once a minute just because the dashboard is open


def maybe_reconcile(db) -> int:
    """Same as reconcile_with_mailbox, but skipped if we checked within the last minute — so the
    dashboard can call this on every load/poll without hammering Zoho's IMAP with a request every
    few seconds while someone's just watching the screen."""
    last = get_setting(db, "email_reconcile_last_at", "")
    now = datetime.now(LONDON)
    if last:
        try:
            if (now - datetime.fromisoformat(last)).total_seconds() < _RECONCILE_GAP_SECONDS:
                return emails_sent_today(db)
        except ValueError:
            pass
    set_setting(db, "email_reconcile_last_at", now.isoformat())
    return reconcile_with_mailbox(db)


def reconcile_with_mailbox(db) -> int:
    """Cross-checks our own counter against the mailbox's REAL Sent folder for today.

    Our own counter only sees sends this app made — it's already missed one path before (Inbox
    replies) and could miss a future one, or a send made from outside the app entirely (Zoho's own
    webmail, another device signed into the same account). The Sent folder can't miss anything,
    since it's what Zoho itself is actually rate-limiting against. If it shows more than we've
    logged, that's the true number — we only ever raise our count to match it, never lower it (our
    own log is always real sends too, so it's a floor).

    Called right before a campaign send actually goes out, not on every check — an IMAP round trip
    every 20+ minutes is fine; every few seconds would hammer Zoho and slow the whole app down.
    """
    from .routes.inbox_routes import _imap, _select_sent, SMTP_USER
    current = emails_sent_today(db)
    if not SMTP_USER:
        return current
    today = datetime.now(LONDON).date()
    tomorrow = today + timedelta(days=1)
    try:
        mail = _imap()
        try:
            if not _select_sent(mail):
                return current
            typ, data = mail.search(None, "SINCE", today.strftime("%d-%b-%Y"), "BEFORE", tomorrow.strftime("%d-%b-%Y"))
            real_count = len(data[0].split()) if typ == "OK" and data and data[0] else 0
        finally:
            mail.logout()
    except Exception:
        logger.exception("Could not reconcile the email counter against the real Sent folder")
        return current
    if real_count > current:
        set_setting(db, _today_key(), str(real_count))
        return real_count
    return current
