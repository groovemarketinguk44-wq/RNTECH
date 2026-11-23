"""Search-engine pages: one real page per event, plus /sitemap.xml and /robots.txt.

The main site is a single-page app, so Google only ever sees the empty page shell. Each
event gets its own server-built page at /events/<name>-<town>-<date> with the details in
plain HTML, Event structured data (for Google's event listings), and share tags (so the
poster shows on WhatsApp, Instagram and Facebook). The Get Tickets button goes to
/buy?event=<id>, which opens the normal ticket flow in the app, so every sale still goes
through RNTECH.
"""
import html
import json
import os
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Event

router = APIRouter()
BASE = os.getenv("FRONTEND_URL", "https://rntech.live").rstrip("/")
LONDON = ZoneInfo("Europe/London")
GENRE = "Tech House & RnB"
GENRE_IN_TEXT = "tech house & RnB"
KEEP_UPPER = {"II", "III", "IV", "V", "NYE", "DJ", "DJS", "RNB", "B2B", "UK", "RNTECH", "VIP"}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    text = (text or "").lower().replace("&", " and ")
    text = re.sub(r"['’]", "", text)
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def _nice_title(title: str) -> str:
    # Titles are stored in capitals; "VALENTINE'S DAY SPECIAL" -> "Valentine's Day Special"
    words = []
    for w in (title or "").split():
        bare = re.sub(r"[^A-Za-z0-9]", "", w).upper()
        words.append(w.upper() if bare in KEEP_UPPER else w[:1].upper() + w[1:].lower())
    return " ".join(words)


def _town(e: Event) -> str:
    return (e.location or "").split(",")[0].strip() or (e.venue or "")


def event_path(e: Event) -> str:
    parts = [_slugify(e.title)]
    town = _slugify(_town(e))
    if town and town not in parts[0]:
        parts.append(town)
    if e.date:
        parts.append(e.date)
    return "/events/" + "-".join(p for p in parts if p)


def _parse_time(value: str):
    value = (value or "").strip().upper().replace(".", ":")
    for fmt in ("%I:%M %p", "%I:%M%p", "%I %p", "%I%p", "%H:%M"):
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            continue
    return None


def _start_end(e: Event):
    """ISO start/end with the UK offset. An end time earlier than the start means it runs past midnight."""
    try:
        day = datetime.strptime(e.date or "", "%Y-%m-%d").date()
    except ValueError:
        return None, None
    st, et = _parse_time(e.start_time), _parse_time(e.end_time)
    if not st:
        return day.isoformat(), None
    start = datetime.combine(day, st, LONDON)
    end = None
    if et:
        end = datetime.combine(day, et, LONDON)
        if end <= start:
            end = datetime.combine(day + timedelta(days=1), et, LONDON)
    return start.isoformat(), end.isoformat() if end else None


def _tickets(e: Event):
    out = []
    for tt in e.ticket_types:
        if not tt.active:
            continue
        tiers = json.loads(tt.tiers_json or "[]")
        cap = sum(t.get("capacity", 0) for t in tiers) if tt.is_tiered and tiers else (tt.capacity or 0)
        sold_out = bool(tt.sold_out) or (cap > 0 and (tt.sold_count or 0) >= cap)
        out.append({"name": tt.name or "Ticket", "pence": tt.effective_price or 0,
                    "sold_out": sold_out, "nearly_gone": bool(tt.nearly_gone)})
    return out


def _money(pence: int) -> str:
    return "Free" if not pence else (f"£{pence / 100:.0f}" if pence % 100 == 0 else f"£{pence / 100:.2f}")


def _abs(path: str) -> str:
    return path if path.startswith("http") else BASE + path


def _rich(text: str) -> str:
    """Escape, keep **bold**, and turn blank-line-separated chunks into paragraphs."""
    out = []
    for chunk in re.split(r"\n\s*\n", (text or "").strip()):
        if not chunk.strip():
            continue
        safe = html.escape(chunk.strip())
        safe = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", safe).replace("\n", "<br>")
        out.append(f"<p>{safe}</p>")
    return "\n".join(out)


def _plain(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("**", "")).strip()


def _structured_data(e: Event, url: str, tickets, start, end) -> dict:
    name = _nice_title(e.title)
    town = _town(e)
    rest = ", ".join(p.strip() for p in (e.location or "").split(",")[1:] if p.strip())
    address = {"@type": "PostalAddress", "addressLocality": town, "addressCountry": "GB"}
    if rest:
        address["addressRegion"] = rest
    data = {
        "@context": "https://schema.org",
        "@type": "MusicEvent",
        "name": name,
        "description": _plain(e.description) or f"{name}: a {GENRE_IN_TEXT} night at {e.venue}, {town}.",
        "startDate": start,
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {"@type": "Place", "name": e.venue or town, "address": address},
        "organizer": {"@type": "Organization", "name": "RNTECH", "url": BASE},
        "url": url,
    }
    if end:
        data["endDate"] = end
    if e.poster_image:
        data["image"] = [_abs(f"/uploads/{e.poster_image}")]
    performers = [{"@type": "Person", "name": p.get("name")} for p in e.lineup if p.get("name")]
    if performers:
        data["performer"] = performers
    if e.is_free and not tickets:
        data["isAccessibleForFree"] = True
    if (e.registration_mode or "open") == "open" and e.status != "past":
        buy = f"{BASE}/buy?event={e.id}"
        offers = [{
            "@type": "Offer", "name": t["name"], "price": f"{t['pence'] / 100:.2f}", "priceCurrency": "GBP",
            "availability": "https://schema.org/" + ("SoldOut" if t["sold_out"] else "LimitedAvailability" if t["nearly_gone"] else "InStock"),
            "url": buy,
        } for t in tickets]
        if not offers and e.is_free:
            offers = [{"@type": "Offer", "price": "0", "priceCurrency": "GBP",
                       "availability": "https://schema.org/InStock", "url": buy}]
        if offers:
            data["offers"] = offers
    return data


# ── Page ─────────────────────────────────────────────────────────────────────

CSS = """
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#020810;color:#e8eef6;font-family:'Space Grotesk',system-ui,sans-serif;line-height:1.6}
a{color:#7cc4ff}
.wrap{max-width:860px;margin:0 auto;padding:24px 20px 64px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:28px}
header img{height:42px;width:auto}
header nav a{color:#9fb3c8;text-decoration:none;margin-left:16px;font-size:14px}
.kicker{font-family:Orbitron,sans-serif;letter-spacing:.18em;text-transform:uppercase;font-size:12px;color:#06b6d4;margin-bottom:10px}
h1{font-family:Orbitron,sans-serif;font-size:clamp(28px,6vw,46px);line-height:1.1;text-transform:uppercase;margin-bottom:16px}
h2{font-family:Orbitron,sans-serif;font-size:18px;text-transform:uppercase;letter-spacing:.08em;margin:36px 0 14px;color:#fff}
.grid{display:grid;grid-template-columns:1fr;gap:28px}
@media(min-width:760px){.grid{grid-template-columns:320px 1fr}}
.poster{width:100%;border-radius:14px;border:1px solid rgba(50,114,168,.35);display:block}
.facts{list-style:none;display:grid;gap:10px;margin:4px 0 22px}
.facts li{background:rgba(50,114,168,.10);border:1px solid rgba(50,114,168,.25);border-radius:10px;padding:10px 14px}
.facts b{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7fa6c9;font-weight:600}
.btn{display:inline-block;background:linear-gradient(90deg,#3272a8,#06b6d4,#6366f1);color:#fff;text-decoration:none;font-weight:700;
 padding:15px 30px;border-radius:999px;font-size:17px;letter-spacing:.04em}
.muted{color:#9fb3c8}
table{width:100%;border-collapse:collapse;margin-top:6px}
td{padding:10px 4px;border-bottom:1px solid rgba(255,255,255,.08)}
td:last-child{text-align:right;font-weight:700}
.tag{font-size:12px;color:#06b6d4;margin-left:8px}
.lineup{list-style:none;display:flex;flex-wrap:wrap;gap:10px}
.lineup li{border:1px solid rgba(6,182,212,.35);border-radius:999px;padding:6px 14px}
.lineup .hl{background:rgba(6,182,212,.15);font-weight:700}
.copy p{margin-bottom:14px}
.more{list-style:none;display:grid;gap:10px}
.more a{display:block;text-decoration:none;color:#e8eef6;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px 14px}
footer{margin-top:48px;font-size:13px;color:#6f8399}
"""

HEAD_FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com" />'
              '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Orbitron:wght@400;700&display=swap" rel="stylesheet" />')


def _page(title, description, url, body, image=None, jsonld=None, track=None, status=200, noindex=False):
    esc = html.escape
    tags = [
        f'<title>{esc(title)}</title>',
        f'<meta name="description" content="{esc(description)}" />',
        f'<link rel="canonical" href="{esc(url)}" />',
        f'<meta property="og:type" content="website" />',
        f'<meta property="og:site_name" content="RNTECH" />',
        f'<meta property="og:title" content="{esc(title)}" />',
        f'<meta property="og:description" content="{esc(description)}" />',
        f'<meta property="og:url" content="{esc(url)}" />',
        f'<meta name="twitter:card" content="{"summary_large_image" if image else "summary"}" />',
    ]
    if image:
        tags.append(f'<meta property="og:image" content="{esc(image)}" />')
    if noindex:
        tags.append('<meta name="robots" content="noindex" />')
    if jsonld:
        tags.append('<script type="application/ld+json">' + json.dumps(jsonld, ensure_ascii=False).replace("</", "<\\/") + "</script>")
    tracker = ""
    if track:
        tracker = (f'<script src="/static/rt.js"></script>'
                   f'<script>window.rtTrack&&window.rtTrack.page({json.dumps(track)});</script>')
    doc = f"""<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#020810" />
<link rel="icon" type="image/png" href="/static/favicon.png" />
{chr(10).join(tags)}
{HEAD_FONTS}
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
<header><a href="/"><img src="/static/uploads/logo-transparent.png" alt="RNTECH" /></a>
<nav><a href="/events">Events</a><a href="/mixes">Mixes</a><a href="/contact">Contact</a></nav></header>
{body}
<footer>RNTECH · RnB meets Tech House · Hertfordshire · <a href="/">rntech.live</a></footer>
</div>
{tracker}
</body>
</html>"""
    return HTMLResponse(doc, status_code=status, headers={"Cache-Control": "public, max-age=300"})


def _not_found():
    body = ('<p class="kicker">Not found</p><h1>Event not found</h1>'
            '<p class="muted">That event may have moved. <a href="/events">See all RNTECH events</a>.</p>')
    return _page("Event not found | RNTECH", "RNTECH events: RnB meets Tech House.", BASE + "/events", body, status=404, noindex=True)


@router.get("/events/{name}", response_class=HTMLResponse, include_in_schema=False)
def event_page(name: str, db: Session = Depends(get_db)):
    events = db.query(Event).all()
    wanted = "/events/" + name.strip("/").lower()
    e = next((x for x in events if event_path(x) == wanted), None)
    if not e:
        # Old or shared links by stored slug or id still land on the right page
        old = next((x for x in events if name in (x.slug, x.id)), None)
        return RedirectResponse(event_path(old), status_code=301) if old else _not_found()

    esc = html.escape
    url = BASE + event_path(e)
    name_nice = _nice_title(e.title)
    town = _town(e)
    where = ", ".join(p for p in [e.venue, e.location] if p)
    when = " – ".join(p for p in [e.start_time, e.end_time] if p)
    date_txt = e.display_date or e.date or ""
    tickets = _tickets(e)
    start, end = _start_end(e)
    past = e.status == "past"
    mode = e.registration_mode or "open"
    priced = [t["pence"] for t in tickets if not t["sold_out"]] or [t["pence"] for t in tickets]
    from_price = min(priced) if priced else 0
    price_txt = "Free entry" if (e.is_free and not from_price) else f"Tickets from {_money(from_price)}"
    all_gone = bool(tickets) and all(t["sold_out"] for t in tickets)

    title = f"{name_nice} | {GENRE} in {town} | {date_txt} | RNTECH"
    description = (f"{name_nice}: {GENRE_IN_TEXT} at {e.venue}, {town} on {date_txt}"
                   f"{', ' + when if when else ''}. {price_txt}. Book on RNTECH.")
    poster = _abs(f"/uploads/{e.poster_image}") if e.poster_image else None

    if past:
        cta = '<p class="muted">This event has finished. <a href="/events">See what\'s next</a>.</p>'
    elif mode == "closed":
        cta = '<p class="muted">Tickets aren\'t on sale for this one yet. Check back soon.</p>'
    elif all_gone:
        cta = '<p class="muted"><b>Sold out.</b> <a href="/events">See other RNTECH events</a>.</p>'
    else:
        label = "Join the waitlist" if mode == "interest" else ("Get free tickets" if not from_price else "Get tickets")
        cta = f'<a class="btn" href="/buy?event={esc(e.id)}" data-track="{esc(label)} (event page)">{esc(label)}</a>'

    facts = [("Date", date_txt), ("Time", when), ("Venue", where), ("Music", GENRE), ("Entry", price_txt)]
    facts_html = "".join(f"<li><b>{k}</b>{esc(v)}</li>" for k, v in facts if v)

    lineup = sorted(e.lineup, key=lambda p: 0 if (p.get("role") or "").lower() == "headliner" else 1)
    if lineup:
        lineup_html = '<ul class="lineup">' + "".join(
            f'<li class="{"hl" if (p.get("role") or "").lower() == "headliner" else ""}">{esc(p.get("name", ""))}</li>'
            for p in lineup if p.get("name")) + "</ul>"
    else:
        lineup_html = '<p class="muted">Lineup to be announced.</p>'

    tickets_html = ""
    if tickets and not past:
        rows = "".join(
            f'<tr><td>{esc(t["name"])}{"<span class=tag>Sold out</span>" if t["sold_out"] else "<span class=tag>Nearly gone</span>" if t["nearly_gone"] else ""}</td>'
            f'<td>{_money(t["pence"])}</td></tr>' for t in tickets)
        tickets_html = f"<h2>Tickets</h2><table>{rows}</table>"

    intro = (f"<p><strong>{esc(name_nice)}</strong> is a {esc(GENRE_IN_TEXT)} night at {esc(e.venue or town)}"
             f"{', ' + esc(town) if town and town != e.venue else ''} on {esc(date_txt)}"
             f"{', ' + esc(when) if when else ''}. RNTECH brings RnB and tech house together, "
             f"with a lineup built to keep {esc(town or 'Hertfordshire')} dancing all night.</p>")

    today = datetime.now(LONDON).date().isoformat()
    others = [x for x in events if x.id != e.id and x.status != "past" and (x.date or "") >= today]
    others.sort(key=lambda x: x.date or "")
    more_html = ""
    if others:
        more_html = "<h2>More RNTECH events</h2><ul class=more>" + "".join(
            f'<li><a href="{event_path(x)}"><b>{esc(_nice_title(x.title))}</b> · '
            f'{esc(x.display_date or x.date or "")} · {esc(_town(x))}</a></li>' for x in others[:6]) + "</ul>"

    poster_html = (f'<img class="poster" src="/uploads/{esc(e.poster_image)}" alt="{esc(name_nice)} poster, '
                   f'{esc(GENRE_IN_TEXT)} in {esc(town)}" />') if e.poster_image else ""
    body = f"""
<p class="kicker">{esc(GENRE)} · {esc(town)}</p>
<h1>{esc(name_nice)}</h1>
<div class="grid">
<div>{poster_html}</div>
<div>
<ul class="facts">{facts_html}</ul>
{cta}
{tickets_html}
</div>
</div>
<h2>Lineup</h2>
{lineup_html}
<h2>About the night</h2>
<div class="copy">{intro}{_rich(e.description)}</div>
{more_html}
"""
    jsonld = _structured_data(e, url, tickets, start, end) if start else None
    return _page(title, description[:300], url, body, image=poster, jsonld=jsonld, track=event_path(e).lstrip("/"))


# ── Sitemap and robots ───────────────────────────────────────────────────────

@router.get("/sitemap.xml", include_in_schema=False)
def sitemap(db: Session = Depends(get_db)):
    urls = [("/", "1.0"), ("/events", "0.9"), ("/mixes", "0.6"), ("/contact", "0.4")]
    events = db.query(Event).order_by(Event.date.desc()).all()
    urls += [(event_path(e), "0.9" if e.status != "past" else "0.4") for e in events]
    urls += [(f"/{p}", "0.1") for p in ("terms", "privacy", "cookies", "accessibility")]
    body = "".join(f"<url><loc>{html.escape(BASE + u)}</loc><priority>{pr}</priority></url>" for u, pr in urls)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'
    return Response(xml, media_type="application/xml", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/robots.txt", include_in_schema=False)
def robots():
    return PlainTextResponse(
        "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /door/\nDisallow: /qr/\nDisallow: /buy\n\n"
        f"Sitemap: {BASE}/sitemap.xml\n"
    )
