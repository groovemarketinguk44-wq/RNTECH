import os
import logging
import requests

logger = logging.getLogger(__name__)

ONESIGNAL_APP_ID = os.getenv("ONESIGNAL_APP_ID", "")
ONESIGNAL_REST_API_KEY = os.getenv("ONESIGNAL_REST_API_KEY", "")


def notify_ticket_sale(quantity: int, event_title: str, buyer_name: str, total_pence: int):
    if not ONESIGNAL_APP_ID or not ONESIGNAL_REST_API_KEY:
        return

    amount = f"£{total_pence / 100:.2f}"
    ticket_word = "ticket" if quantity == 1 else "tickets"
    payload = {
        "app_id": ONESIGNAL_APP_ID,
        "filters": [{"field": "tag", "key": "role", "relation": "=", "value": "admin"}],
        "headings": {"en": "🎟 Ticket Sale"},
        "contents": {"en": f"{quantity} {ticket_word} sold for {event_title} — {buyer_name} ({amount})"},
    }
    try:
        resp = requests.post(
            "https://api.onesignal.com/notifications",
            json=payload,
            headers={"Authorization": f"Basic {ONESIGNAL_REST_API_KEY}", "Content-Type": "application/json"},
            timeout=5,
        )
        if resp.status_code >= 400:
            logger.warning(f"OneSignal notify failed: {resp.status_code} {resp.text}")
    except Exception:
        logger.exception("OneSignal notify failed")
