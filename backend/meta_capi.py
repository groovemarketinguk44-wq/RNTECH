import os
import time
import hashlib
import logging
import requests
from fastapi import Request

logger = logging.getLogger(__name__)

META_PIXEL_ID = os.getenv("META_PIXEL_ID", "1068567272281457")
META_CAPI_ACCESS_TOKEN = os.getenv("META_CAPI_ACCESS_TOKEN", "")
META_API_VERSION = "v19.0"


def _hash(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()


def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else ""


def send_event(
    event_name: str,
    event_source_url: str,
    ip_address: str = "",
    user_agent: str = "",
    email: str = "",
    event_id: str = "",
    custom_data: dict = None,
):
    if not META_PIXEL_ID or not META_CAPI_ACCESS_TOKEN:
        return

    user_data = {}
    if email:
        user_data["em"] = [_hash(email)]
    if ip_address:
        user_data["client_ip_address"] = ip_address
    if user_agent:
        user_data["client_user_agent"] = user_agent

    event = {
        "event_name": event_name,
        "event_time": int(time.time()),
        "event_source_url": event_source_url,
        "action_source": "website",
        "user_data": user_data,
    }
    if custom_data:
        event["custom_data"] = custom_data
    if event_id:
        event["event_id"] = event_id

    url = f"https://graph.facebook.com/{META_API_VERSION}/{META_PIXEL_ID}/events"
    try:
        resp = requests.post(url, params={"access_token": META_CAPI_ACCESS_TOKEN}, json={"data": [event]}, timeout=5)
        if resp.status_code >= 400:
            logger.warning(f"Meta CAPI event failed ({event_name}): {resp.status_code} {resp.text}")
    except Exception:
        logger.exception(f"Meta CAPI event send failed ({event_name})")
