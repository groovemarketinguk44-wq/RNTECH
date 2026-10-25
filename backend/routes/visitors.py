"""
Website visitors for the admin Visitors tab: which sections people look at, for how long, what they click and do,
where they came from, and how many go on to buy a ticket.

Privacy by design, so no cookie banner is needed for it: nothing is stored on the visitor's device, IP addresses are
never saved, and a visitor is a hash of (IP + browser + today's date + secret) that changes every day.
Admins are skipped by the page script, script-running bots by user agent. Events older than 13 months are deleted.
"""
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import Session

from ..auth import SECRET_KEY, require_admin
from ..database import Base, SessionLocal, get_db

router = APIRouter()
UK = ZoneInfo("Europe/London")
SESSION_GAP = timedelta(minutes=30)
BOTS = re.compile(r"bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|python|curl|wget", re.I)
KINDS = ("view", "leave", "click", "event")
BOUGHT = ("ticket_bought", "ticket_free")


class SiteEvent(Base):
    __tablename__ = "site_events"
    id = Column(Integer, primary_key=True)
    ts = Column(DateTime, index=True, default=datetime.utcnow)
    visitor = Column(String, index=True)       # daily hash — never an IP
    kind = Column(String)                      # view | leave | click | event
    view_id = Column(String, index=True)       # ties a section's leave/clicks/events to its view
    path = Column(String, default="")          # section: /home, /events, /mixes… (or /buy, /qr/… on landing)
    ref = Column(String, default="")           # referring site (domain only)
    source = Column(String, default="")        # Instagram, Google, Direct… or utm_source
    medium = Column(String, default="")
    campaign = Column(String, default="")
    device = Column(String, default="")        # Phone | Tablet | Desktop
    browser = Column(String, default="")
    os = Column(String, default="")
    duration = Column(Integer, default=0)      # ms on screen (leave)
    scroll = Column(Integer, default=0)        # deepest scroll, %
    label = Column(String, default="")         # clicked text / event name
    target = Column(String, default="")        # link target / event detail (e.g. mix title)


def prune_old_events():
    db = SessionLocal()
    try:
        db.query(SiteEvent).filter(SiteEvent.ts < datetime.utcnow() - timedelta(days=400)).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


# ── Collecting ─────────────────────────────────────────────────────────────────

SOURCES = [("instagram.", "Instagram"), ("l.instagram", "Instagram"), ("facebook.", "Facebook"), ("fb.", "Facebook"),
           ("tiktok.", "TikTok"), ("google.", "Google"), ("bing.", "Bing"), ("duckduckgo.", "DuckDuckGo"),
           ("t.co", "X / Twitter"), ("twitter.", "X / Twitter"), ("x.com", "X / Twitter"), ("youtube.", "YouTube"),
           ("linkedin.", "LinkedIn"), ("snapchat.", "Snapchat"), ("linktr.ee", "Linktree"), ("ra.co", "Resident Advisor"),
           ("skiddle.", "Skiddle"), ("fatsoma.", "Fatsoma"), ("chatgpt.", "ChatGPT"), ("openai.", "ChatGPT")]


def _device(ua: str):
    u = ua.lower()
    device = "Tablet" if ("ipad" in u or ("android" in u and "mobile" not in u) or "tablet" in u) else \
        "Phone" if ("mobi" in u or "iphone" in u or "android" in u) else "Desktop"
    browser = "Instagram app" if "instagram" in u else "Facebook app" if ("fban" in u or "fbav" in u) else "TikTok app" if "tiktok" in u or "bytedance" in u else \
        "Edge" if "edg/" in u else "Samsung" if "samsungbrowser" in u else "Chrome" if ("chrome" in u or "crios" in u) else \
        "Firefox" if ("firefox" in u or "fxios" in u) else "Safari" if "safari" in u else "Other"
    os_ = "iOS" if ("iphone" in u or "ipad" in u) else "Android" if "android" in u else "Windows" if "windows" in u else \
        "Mac" if "mac os" in u else "Linux" if "linux" in u else "Other"
    return device, browser, os_


def _source(ref_host: str, q: dict, ua: str):
    if q.get("utm_source"):
        return q["utm_source"][:40].replace("_", " ").title(), (q.get("utm_medium") or "")[:40], (q.get("utm_campaign") or "")[:60]
    if q.get("fbclid"):
        return ("Instagram" if "instagram" in ua.lower() else "Facebook"), "social", ""
    if q.get("gclid"):
        return "Google Ads", "cpc", ""
    if not ref_host or "rntech" in ref_host:
        # in-app browsers often hide the referrer
        u = ua.lower()
        if "instagram" in u:
            return "Instagram", "", ""
        if "fban" in u or "fbav" in u:
            return "Facebook", "", ""
        if "tiktok" in u or "bytedance" in u:
            return "TikTok", "", ""
        return "Direct", "", ""
    for needle, name in SOURCES:
        if needle in ref_host:
            return name, "", ""
    return ref_host, "referral", ""


@router.post("/t", include_in_schema=False)
async def collect(request: Request):
    """The page script's beacon. Always answers 204 so it never shows an error on the site."""
    try:
        raw = await request.body()
        if len(raw) > 4000:
            return Response(status_code=204)
        d = json.loads(raw or b"{}")
        ua = request.headers.get("user-agent", "")
        path = str(d.get("p") or "")[:120]
        if not ua or BOTS.search(ua) or path.startswith("/admin") or d.get("k") not in KINDS:
            return Response(status_code=204)
        ip = request.headers.get("fly-client-ip") or (request.client.host if request.client else "")
        day = datetime.now(UK).strftime("%Y-%m-%d")
        visitor = hashlib.sha256(f"{SECRET_KEY}|{day}|{ip}|{ua}".encode()).hexdigest()[:16]
        ev = SiteEvent(visitor=visitor, kind=d["k"], view_id=str(d.get("v") or "")[:24], path=path,
                       duration=max(0, min(int(d.get("t") or 0), 6 * 3600 * 1000)), scroll=max(0, min(int(d.get("s") or 0), 100)),
                       label=str(d.get("l") or "")[:80], target=str(d.get("h") or "")[:200])
        if d["k"] == "view":
            ref_host = (urlparse(str(d.get("r") or "")).hostname or "").lower().removeprefix("www.")
            ev.ref = ref_host[:80]
            q = {k: v[0] for k, v in parse_qs(str(d.get("q") or "").lstrip("?")).items()}
            ev.source, ev.medium, ev.campaign = _source(ref_host, q, ua)
            ev.device, ev.browser, ev.os = _device(ua)
        db = SessionLocal()
        try:
            db.add(ev)
            db.commit()
        finally:
            db.close()
    except Exception:
        pass
    return Response(status_code=204)


# ── The dashboard ──────────────────────────────────────────────────────────────

PAGE_NAMES = {"/home": "Home", "/": "Home", "/events": "Events", "/mixes": "Mixes", "/tickets": "My tickets",
              "/contact": "Contact", "/buy": "Buy link (/buy)"}
EVENT_NAMES = {"event_open": "Opened an event", "checkout_start": "Started checkout", "ticket_bought": "Bought a ticket",
               "ticket_free": "Got a free ticket", "signup": "Signed up", "interest": "Joined a waitlist",
               "contact_sent": "Sent a message", "mix_play": "Played a mix", "qr_link": "Came from a QR code"}


def _page_name(path: str) -> str:
    p = (path or "/").rstrip("/") or "/"
    if p.startswith("/qr/"):
        return "QR link (" + p[4:] + ")"
    return PAGE_NAMES.get(p, p.strip("/").replace("-", " ").title() or "Home")


def _uk(dt: datetime) -> datetime:
    return dt.replace(tzinfo=ZoneInfo("UTC")).astimezone(UK)


@router.get("/admin/visitors")
def visitors_summary(days: int = 7, db: Session = Depends(get_db), _=Depends(require_admin)):
    days = days if days in (1, 7, 30, 90) else 7
    now = datetime.utcnow()
    if days == 1:   # "Today": since midnight UK time
        start = datetime.now(UK).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    else:
        start = now - timedelta(days=days)
    prev_start = start - (now - start)
    evs = db.query(SiteEvent).filter(SiteEvent.ts >= prev_start).order_by(SiteEvent.ts).all()
    cur = [e for e in evs if e.ts >= start]
    prev = [e for e in evs if e.ts < start]

    def crunch(events):
        views = [e for e in events if e.kind == "view"]
        leave = {}
        for e in events:
            if e.kind == "leave" and e.view_id:
                a = leave.get(e.view_id)
                leave[e.view_id] = (max(a[0], e.duration), max(a[1], e.scroll)) if a else (e.duration, e.scroll)
        sessions, open_by = [], {}
        for v in views:
            s = open_by.get(v.visitor)
            if not s or v.ts - s["last"] > SESSION_GAP:
                s = {"visitor": v.visitor, "start": v.ts, "last": v.ts, "views": [], "events": [], "source": v.source or "Direct",
                     "campaign": v.campaign, "device": v.device, "browser": v.browser}
                sessions.append(s); open_by[v.visitor] = s
            s["last"] = v.ts
            s["views"].append(v)
        by_view = {v.view_id: s for s in sessions for v in s["views"]}
        for e in events:
            if e.kind in ("click", "event") and e.view_id in by_view:
                by_view[e.view_id]["events"].append(e)
        for s in sessions:
            s["time"] = sum(leave.get(v.view_id, (0, 0))[0] for v in s["views"])
            s["bought"] = any(e.kind == "event" and e.label in BOUGHT for e in s["events"])
        return views, leave, sessions

    views, leave, sessions = crunch(cur)
    pviews, _, psessions = crunch(prev)

    def kpis(vs, ss):
        n = len(ss)
        return {"visitors": len({s["visitor"] + s["start"].strftime("%Y%m%d") for s in ss}), "sessions": n, "pageviews": len(vs),
                "avgTime": round(sum(s["time"] for s in ss) / n / 1000) if n else 0,
                "bounce": round(100 * sum(1 for s in ss if len(s["views"]) == 1 and s["time"] < 10000 and not s["events"]) / n) if n else 0,
                "buyers": sum(1 for s in ss if s["bought"])}

    series = defaultdict(lambda: {"visitors": set(), "views": 0})
    for v in views:
        t = _uk(v.ts)
        k = t.strftime("%H:00") if days == 1 else t.strftime("%Y-%m-%d")
        series[k]["visitors"].add(v.visitor); series[k]["views"] += 1
    if days == 1:
        keys = [f"{h:02d}:00" for h in range(0, datetime.now(UK).hour + 1)]
    else:
        d0 = _uk(start).date()
        keys = [(d0 + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days + 1) if d0 + timedelta(days=i) <= datetime.now(UK).date()]
    trend = [{"date": k, "visitors": len(series[k]["visitors"]), "views": series[k]["views"]} for k in keys]

    pages = defaultdict(lambda: {"views": 0, "visitors": set(), "time": [], "scroll": [], "entries": 0})
    for v in views:
        p = pages[_page_name(v.path)]
        p["views"] += 1; p["visitors"].add(v.visitor)
        if v.view_id in leave:
            p["time"].append(leave[v.view_id][0]); p["scroll"].append(leave[v.view_id][1])
    for s in sessions:
        pages[_page_name(s["views"][0].path)]["entries"] += 1
    page_rows = sorted(({"name": k, "views": p["views"], "visitors": len(p["visitors"]),
                         "avgTime": round(sum(p["time"]) / len(p["time"]) / 1000) if p["time"] else 0,
                         "scroll": round(sum(p["scroll"]) / len(p["scroll"])) if p["scroll"] else 0,
                         "entries": p["entries"]} for k, p in pages.items()), key=lambda r: -r["views"])

    def tally(key, top=12):
        c, conv = Counter(), Counter()
        for s in sessions:
            c[s[key] or "Unknown"] += 1
            if s["bought"]:
                conv[s[key] or "Unknown"] += 1
        return [{"name": k, "sessions": n, "buyers": conv[k]} for k, n in c.most_common(top)]

    actions, details, clicks = Counter(), defaultdict(Counter), Counter()
    for s in sessions:
        for e in s["events"]:
            if e.kind == "event":
                actions[e.label] += 1
                if e.target:
                    details[e.label][e.target] += 1
            elif e.kind == "click" and e.label:
                clicks[(e.label, e.target)] += 1
    action_rows = [{"name": EVENT_NAMES.get(k, k), "key": k, "count": n,
                    "top": [{"name": t, "count": c} for t, c in details[k].most_common(5)]} for k, n in actions.most_common()]
    click_rows = [{"label": l, "target": t, "count": n,
                   "type": "outbound" if t.startswith("http") and "rntech" not in t else "email" if t.startswith("mailto:") else "site"}
                  for (l, t), n in clicks.most_common(25)]

    n = len(sessions)
    has = lambda s, k: any(e.kind == "event" and e.label == k for e in s["events"])
    funnel = [{"step": "Visited the site", "n": n},
              {"step": "Looked at an event", "n": sum(1 for s in sessions if has(s, "event_open") or any(_page_name(v.path) in ("Events", "Buy link (/buy)") or v.path.startswith("/qr/") for v in s["views"]))},
              {"step": "Started checkout", "n": sum(1 for s in sessions if has(s, "checkout_start") or has(s, "ticket_free"))},
              {"step": "Got a ticket", "n": sum(1 for s in sessions if s["bought"])}]

    live_cut = now - timedelta(minutes=5)
    live = {}
    for e in cur:
        if e.ts >= live_cut and e.kind == "view":
            live[e.visitor] = _page_name(e.path)

    recent = []
    for s in sorted(sessions, key=lambda s: s["start"], reverse=True)[:40]:
        recent.append({"start": _uk(s["start"]).isoformat(), "source": s["source"], "campaign": s["campaign"], "device": s["device"],
                       "browser": s["browser"], "time": round(s["time"] / 1000), "bought": s["bought"],
                       "pages": [{"name": _page_name(v.path), "time": round(leave.get(v.view_id, (0, 0))[0] / 1000)} for v in s["views"]][:30],
                       "actions": [EVENT_NAMES.get(e.label, e.label) + (f": {e.target}" if e.target else "") for e in s["events"] if e.kind == "event"][:12]})

    return {"days": days, "kpis": kpis(views, sessions), "prev": kpis(pviews, psessions), "trend": trend, "pages": page_rows,
            "sources": tally("source"), "campaigns": [r for r in tally("campaign") if r["name"] != "Unknown"],
            "devices": tally("device"), "browsers": tally("browser", 6), "actions": action_rows, "clicks": click_rows,
            "funnel": funnel, "live": list(live.values()), "recent": recent}
