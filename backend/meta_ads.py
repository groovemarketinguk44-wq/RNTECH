import os
import json
import logging
from datetime import datetime, timedelta
import requests

logger = logging.getLogger(__name__)

META_AD_ACCOUNT_ID = os.getenv("META_AD_ACCOUNT_ID", "")
META_ADS_ACCESS_TOKEN = os.getenv("META_ADS_ACCESS_TOKEN", "")
META_API_VERSION = "v19.0"

_INSIGHT_FIELDS = "spend,impressions,clicks,reach,cpc,ctr,cpm"


def get_overview(days: int, since: str = None, until: str = None) -> dict:
    """Account insights for the last `days` days, or for an explicit since/until (YYYY-MM-DD) range.

    A range is used to scope spend to one event's campaign period — the ad account itself
    isn't tagged by event, so the date window is what ties spend to an event.
    """
    if not META_AD_ACCOUNT_ID or not META_ADS_ACCESS_TOKEN:
        return {"available": False}

    if since or until:
        today = datetime.utcnow().date()
        end = min(datetime.strptime(until, "%Y-%m-%d").date(), today) if until else today
        start = datetime.strptime(since, "%Y-%m-%d").date() if since else end - timedelta(days=days - 1)
        if start > end:
            return _empty_overview()
        days = (end - start).days + 1
        time_params = {"time_range": json.dumps({"since": start.isoformat(), "until": end.isoformat()})}
    else:
        end = datetime.utcnow().date()
        time_params = {"date_preset": _date_preset(days)}

    base = f"https://graph.facebook.com/{META_API_VERSION}/{META_AD_ACCOUNT_ID}/insights"
    params = {
        "access_token": META_ADS_ACCESS_TOKEN,
        "fields": _INSIGHT_FIELDS,
        **time_params,
    }
    daily_params = {**params, "time_increment": 1}

    try:
        totals_resp = requests.get(base, params=params, timeout=10)
        totals_resp.raise_for_status()
        totals_rows = totals_resp.json().get("data", [])
        totals = totals_rows[0] if totals_rows else {}

        daily_resp = requests.get(base, params=daily_params, timeout=10)
        daily_resp.raise_for_status()
        daily_rows = daily_resp.json().get("data", [])
    except Exception:
        logger.exception("Failed to fetch Meta Ads insights")
        return {"available": False, "error": True}

    daily_by_date = {row["date_start"]: row for row in daily_rows}
    series = []
    for i in range(days - 1, -1, -1):
        day = (end - timedelta(days=i)).strftime("%Y-%m-%d")
        row = daily_by_date.get(day, {})
        series.append({
            "date": day,
            "spend": float(row.get("spend", 0) or 0),
            "impressions": int(row.get("impressions", 0) or 0),
            "clicks": int(row.get("clicks", 0) or 0),
        })

    return {
        "available": True,
        "spend": float(totals.get("spend", 0) or 0),
        "impressions": int(totals.get("impressions", 0) or 0),
        "clicks": int(totals.get("clicks", 0) or 0),
        "reach": int(totals.get("reach", 0) or 0),
        "cpc": float(totals.get("cpc", 0) or 0),
        "ctr": float(totals.get("ctr", 0) or 0),
        "cpm": float(totals.get("cpm", 0) or 0),
        "dailySeries": series,
    }


def _empty_overview() -> dict:
    # Range hasn't started yet (e.g. ads-since set to a future date): nothing spent, no API call needed.
    return {
        "available": True, "spend": 0.0, "impressions": 0, "clicks": 0, "reach": 0,
        "cpc": 0.0, "ctr": 0.0, "cpm": 0.0, "dailySeries": [],
    }


def _date_preset(days: int) -> str:
    if days <= 1:
        return "yesterday"
    if days <= 7:
        return "last_7d"
    if days <= 14:
        return "last_14d"
    if days <= 30:
        return "last_30d"
    if days <= 90:
        return "last_90d"
    return "maximum"
