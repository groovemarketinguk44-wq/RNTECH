"""
Phone widget: rntech.live/api/widget/<token> — latest event's name, tickets sold and profit as JSON.

Read by a Scriptable home-screen widget on Ben's phone (script handed out from the admin dashboard).
No login on the phone: the secret token in the URL is the key, and "New link" in admin kills the old one.
Profit is the same sum as the admin Payments card for that event (Stripe net + cash − DJ − ads).
"""
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Event, TicketOrder
from ..settings_utils import get_setting, set_setting
from .admin import get_payments_overview
from .door import UK

router = APIRouter()
SITE = "https://rntech.live"
TOKEN_KEY = "widget_token"


def _latest_event(db: Session):
    """The next event coming up (today counts), or the most recent one when nothing is scheduled."""
    today = datetime.now(UK).date().isoformat()
    upcoming = db.query(Event).filter(Event.date >= today).order_by(Event.date.asc()).first()
    return upcoming or db.query(Event).order_by(Event.date.desc()).first()


def _event_numbers(db: Session, ev: Event) -> dict:
    # Cover every sale for this event: the window runs back to its first paid order
    first = db.query(TicketOrder.paid_at).filter(TicketOrder.event_id == ev.id, TicketOrder.status == "paid",
                                                TicketOrder.paid_at != None).order_by(TicketOrder.paid_at.asc()).first()
    days = (datetime.utcnow() - first[0]).days + 1 if first else 30
    p = get_payments_overview(days=days, event_id=ev.id, db=db, _=None)
    return {"ticketsSold": p["ticketsSoldTotal"],
            "grossPence": p["grossRevenueTotalPence"], "profitPence": p["profitPence"]}


@router.get("/widget/{token}")
def widget_data(token: str, db: Session = Depends(get_db)):
    saved = get_setting(db, TOKEN_KEY, "")
    if not saved or not secrets.compare_digest(token, saved):
        raise HTTPException(404, "Widget link not valid")
    ev = _latest_event(db)
    if not ev:
        return {"event": None, "updatedAt": datetime.now(UK).isoformat()}
    return {"event": {"id": ev.id, "title": ev.title, "displayDate": ev.display_date or ev.date, "date": ev.date,
                      "venue": ev.venue, "startTime": ev.start_time},
            **_event_numbers(db, ev), "updatedAt": datetime.now(UK).isoformat()}


# ── Admin: get / reset the widget link, and the Scriptable script with it baked in ──

def _link(db: Session, reset: bool = False) -> dict:
    tok = get_setting(db, TOKEN_KEY, "")
    if reset or not tok:
        tok = secrets.token_urlsafe(24)
        set_setting(db, TOKEN_KEY, tok)
    url = f"{SITE}/api/widget/{tok}"
    return {"url": url, "script": SCRIPT.replace("__URL__", url)}


@router.get("/admin/widget-link")
def get_widget_link(db: Session = Depends(get_db), _=Depends(require_admin)):
    return _link(db)


@router.post("/admin/widget-link/reset")
def reset_widget_link(db: Session = Depends(get_db), _=Depends(require_admin)):
    return _link(db, reset=True)


SCRIPT = r"""// RNTECH — latest event widget (Scriptable). Paste into a new script, then add a Scriptable widget.
const URL = "__URL__";
const BLUE = new Color("#3272a8"), GREEN = new Color("#10b981"), RED = new Color("#ef4444");
const gbp = p => (p < 0 ? "-£" : "£") + (Math.abs(p) / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 });

// Logo is cached on the phone so it still shows when offline
async function loadLogo() {
  const fm = FileManager.local(), path = fm.joinPath(fm.cacheDirectory(), "rntech-logo.png");
  try { const img = await new Request("https://rntech.live/static/uploads/logo-transparent.png").loadImage(); fm.writeImage(path, img); return img; }
  catch (e) { return fm.fileExists(path) ? fm.readImage(path) : null; }
}

async function load() {
  try {
    const r = new Request(URL); r.timeoutInterval = 15;
    const d = await r.loadJSON();
    if (r.response.statusCode !== 200) return { error: d.detail || "Widget link not valid — copy the new script from admin" };
    Keychain.set("rntech_widget", JSON.stringify(d));
    return d;
  } catch (e) {
    // Offline: show the last numbers rather than a blank widget
    if (Keychain.contains("rntech_widget")) { const d = JSON.parse(Keychain.get("rntech_widget")); d.stale = true; return d; }
    return { error: String(e.message || e) };
  }
}

function build(d, logo) {
  const w = new ListWidget();
  const bg = new LinearGradient(); bg.colors = [new Color("#06142a"), new Color("#020810")]; bg.locations = [0, 1];
  w.backgroundGradient = bg; w.setPadding(14, 14, 14, 14); w.url = "https://rntech.live/admin";
  const small = config.widgetFamily === "small";

  const head = w.addStack(); head.centerAlignContent();
  const top = head.addText(small ? "NEXT UP" : "LATEST EVENT"); top.font = Font.heavySystemFont(9); top.textColor = BLUE;
  head.addSpacer();
  if (logo) { const l = head.addImage(logo); l.imageSize = small ? new Size(56, 24) : new Size(80, 34); l.rightAlignImage(); }
  else { const t = head.addText("RNTECH"); t.font = Font.heavySystemFont(11); t.textColor = Color.white(); }
  w.addSpacer(2);
  if (d.error || !d.event) {
    const t = w.addText(d.error || "No events yet"); t.font = Font.mediumSystemFont(13); t.textColor = Color.white();
    return w;
  }
  const title = w.addText(d.event.title); title.font = Font.heavySystemFont(small ? 14 : 16);
  title.textColor = Color.white(); title.lineLimit = 2; title.minimumScaleFactor = 0.7;
  const sub = w.addText([d.event.displayDate, small ? null : d.event.venue].filter(Boolean).join(" · "));
  sub.font = Font.systemFont(10); sub.textColor = new Color("#ffffff", 0.5); sub.lineLimit = 1;
  w.addSpacer();

  const row = w.addStack(); row.centerAlignContent();
  const stat = (label, value, color) => {
    const s = row.addStack(); s.layoutVertically();
    const v = s.addText(value); v.font = Font.heavySystemFont(small ? 20 : 24); v.textColor = color; v.minimumScaleFactor = 0.6; v.lineLimit = 1;
    const l = s.addText(label); l.font = Font.semiboldSystemFont(9); l.textColor = new Color("#ffffff", 0.45);
  };
  stat("TICKETS SOLD", String(d.ticketsSold), GREEN);
  row.addSpacer();
  stat("PROFIT", d.profitPence == null ? "—" : gbp(d.profitPence), d.profitPence < 0 ? RED : Color.white());

  w.addSpacer(6);
  const df = new DateFormatter(); df.useNoDateStyle(); df.useShortTimeStyle();
  const foot = w.addText((d.stale ? "Offline · " : "Updated ") + df.string(new Date(d.updatedAt)));
  foot.font = Font.systemFont(9); foot.textColor = new Color("#ffffff", 0.35);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  return w;
}

const [data, logo] = await Promise.all([load(), loadLogo()]);
const w = build(data, logo);
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
"""

