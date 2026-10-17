import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from sqlalchemy import text, inspect as sa_inspect
from .database import engine, SessionLocal
from .models import Base
from .routes import auth_routes, events, mixes, tickets, contact, sponsors, admin, campaigns, inbox_routes, settings as settings_routes, checkout, offers, promos
from .routes.campaigns import process_pending_sends, run_throttled_sends, scan_bounces
from .routes.inbox_routes import sweep_side_folders_to_inbox

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", "./frontend"))

scheduler = BackgroundScheduler()


def _run_pending():
    db = SessionLocal()
    try:
        n = process_pending_sends(db)
        if n:
            logger.info(f"Email scheduler: processed {n} pending sends")
    finally:
        db.close()


def _run_throttled():
    db = SessionLocal()
    try:
        run_throttled_sends(db)
    finally:
        db.close()


def _run_budget_reconcile():
    db = SessionLocal()
    try:
        from .send_tracking import reconcile_with_mailbox
        reconcile_with_mailbox(db)
    except Exception:
        logger.exception("Email budget reconcile failed")
    finally:
        db.close()


def _run_bounce_scan():
    db = SessionLocal()
    try:
        n = scan_bounces(db)
        if n:
            logger.info(f"Bounce scan: marked {n} sends as bounced")
    except Exception:
        logger.exception("Bounce scan failed")
    finally:
        db.close()


def _run_mail_sweep():
    try:
        n = sweep_side_folders_to_inbox()
        if n:
            logger.info(f"Mail sweep: moved {n} messages into INBOX")
    except Exception:
        logger.exception("Mail sweep failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Migrate existing DBs: add columns added after initial deploy
    with engine.connect() as conn:
        inspector = sa_inspect(engine)
        def _migrate(table, col, typedef):
            try:
                cols = [c["name"] for c in inspector.get_columns(table)]
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typedef}"))
                    conn.commit()
            except Exception:
                pass
        _migrate("events",          "registration_mode", "TEXT DEFAULT 'open'")
        _migrate("users",           "first_name",        "TEXT")
        _migrate("users",           "last_name",         "TEXT")
        _migrate("users",           "instagram",         "TEXT")
        _migrate("event_interests", "first_name",        "TEXT")
        _migrate("event_interests", "last_name",         "TEXT")
        _migrate("event_interests", "instagram",         "TEXT")
        _migrate("ticket_types",    "is_tiered",         "INTEGER DEFAULT 0")
        _migrate("ticket_types",    "tiers_json",        "TEXT DEFAULT '[]'")
        _migrate("event_interests", "invite_token",           "TEXT")
        _migrate("event_interests", "invite_ticket_type_id",  "TEXT")
        _migrate("event_interests", "invite_discount_percent", "INTEGER DEFAULT 0")
        _migrate("event_interests", "invited_at",             "TIMESTAMP")
        _migrate("tickets",         "order_id",           "TEXT")
        _migrate("tickets",         "amount_paid_pence",  "INTEGER DEFAULT 0")
        _migrate("ticket_orders",   "quantity",           "INTEGER DEFAULT 1")
        _migrate("ticket_orders",   "guest_account_created", "INTEGER DEFAULT 0")
        _migrate("ticket_orders",   "client_ip",            "TEXT")
        _migrate("ticket_orders",   "client_user_agent",    "TEXT")
        _migrate("events",          "ticket_banner_image", "TEXT")
        _migrate("events",          "ticket_bio",          "TEXT")
        _migrate("ticket_types",    "sold_out",           "INTEGER DEFAULT 0")
        _migrate("ticket_types",    "nearly_gone",        "INTEGER DEFAULT 0")
        _migrate("email_campaigns", "audience", "TEXT DEFAULT 'drip'")
        _migrate("email_campaigns", "audience_event_id", "TEXT")
        _migrate("email_campaigns", "send_status", "TEXT DEFAULT 'draft'")
        _migrate("email_campaigns", "gap_minutes", "INTEGER DEFAULT 20")
        _migrate("email_campaigns", "daily_cap", "INTEGER DEFAULT 30")
        _migrate("email_campaigns", "window_start_hour", "INTEGER DEFAULT 9")
        _migrate("email_campaigns", "window_end_hour", "INTEGER DEFAULT 21")
        _migrate("email_campaigns", "next_send_at", "DATETIME")
        _migrate("email_campaigns", "started_at", "DATETIME")
        _migrate("email_campaigns", "last_success_at", "DATETIME")
        _migrate("email_campaigns", "last_error", "TEXT")
        _migrate("email_campaigns", "last_error_at", "DATETIME")
        _migrate("email_campaigns", "consecutive_failures", "INTEGER DEFAULT 0")
        _migrate("email_campaigns", "pause_reason", "TEXT")
        _migrate("email_sends", "to_email", "TEXT")
        _migrate("email_sends", "attempts", "INTEGER DEFAULT 0")
        _migrate("email_sends", "error", "TEXT")
        _migrate("email_sends", "opened_at", "DATETIME")
        _migrate("email_sends", "open_count", "INTEGER DEFAULT 0")
        _migrate("email_sends", "bounced_at", "DATETIME")
        _migrate("email_campaigns", "round_name", "TEXT DEFAULT 'default'")
        _migrate("email_campaigns", "queue_position", "INTEGER DEFAULT 0")
        _migrate("email_campaigns", "start_at", "DATETIME")
        _migrate("users", "unsubscribed_at", "DATETIME")
        _migrate("email_campaigns", "offer_event_id", "TEXT")
        _migrate("email_campaigns", "offer_discount_bp", "INTEGER DEFAULT 0")
        _migrate("email_campaigns", "offer_max_tickets", "INTEGER DEFAULT 4")
        _migrate("email_campaigns", "offer_expires_at", "DATETIME")
        _migrate("ticket_orders", "offer_id", "TEXT")
        _migrate("ticket_orders", "promo_id", "TEXT")
    # Ensure upload dirs exist
    for sub in ("images", "videos"):
        (UPLOAD_DIR / sub).mkdir(parents=True, exist_ok=True)
    # Start email scheduler (runs hourly)
    scheduler.add_job(_run_pending, "interval", hours=1, id="email_drip")
    scheduler.add_job(_run_mail_sweep, "interval", minutes=10, id="mail_sweep")
    # Paced campaign sending: one email per running campaign per tick, gated by its own gap/cap/window.
    scheduler.add_job(_run_throttled, "interval", seconds=30, id="throttled_sends", max_instances=1, coalesce=True)
    scheduler.add_job(_run_bounce_scan, "interval", minutes=10, id="bounce_scan", max_instances=1, coalesce=True)
    # Keeps the dashboard's "sent today" figure accurate even between campaign sends — e.g. right
    # after a ticket sale emails a confirmation, before any campaign is due to check again.
    scheduler.add_job(_run_budget_reconcile, "interval", minutes=5, id="budget_reconcile", max_instances=1, coalesce=True)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="RNTECH", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def no_cache_static_app_code(request, call_next):
    # /static serves the SPA's own JS (ui.jsx, pages.jsx, admin_pages.jsx, api.js, auth.js),
    # not just images — Starlette's default StaticFiles response has no Cache-Control, only
    # ETag/Last-Modified, so browsers fall back to heuristic caching. Mobile browsers cache
    # far more aggressively under that heuristic than desktop, so a deploy can update the
    # page shell (index.html already forces revalidation, see serve_app below) while a phone
    # keeps running old cached app code indefinitely. ETag still makes revalidation cheap
    # (304s), this just stops the browser from skipping the check.
    response = await call_next(request)
    if request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
    return response

# ── API routes ───────────────────────────────────────────────────────────────
for router in [
    auth_routes.router,
    events.router,
    mixes.router,
    tickets.router,
    contact.router,
    sponsors.router,
    admin.router,
    campaigns.router,
    inbox_routes.router,
    settings_routes.router,
    checkout.router,
    offers.router,
    promos.router,
]:
    app.include_router(router, prefix="/api")

# ── Static file serving ───────────────────────────────────────────────────────
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR / "static")), name="static")


@app.get("/")
@app.get("/events")
@app.get("/mixes")
@app.get("/tickets")
@app.get("/contact")
@app.get("/admin")
@app.get("/buy")
@app.get("/qr/{code}")
def serve_app(code: str = ""):
    # Always revalidate — this is a single-page app, so a stale cached copy in a
    # long-lived open tab silently keeps running old frontend code indefinitely.
    return FileResponse(
        str(FRONTEND_DIR / "index.html"),
        headers={"Cache-Control": "no-cache, must-revalidate"},
    )


@app.get("/health")
def health():
    return {"status": "ok"}


# OneSignal's Web Push SDK requires these served from the site root (not /static) so the
# service worker's scope covers the whole origin — without this, push permission/opt-in can
# silently "succeed" client-side while no real subscription is ever created server-side.
@app.get("/OneSignalSDKWorker.js")
@app.get("/OneSignalSDKUpdaterWorker.js")
def serve_onesignal_worker():
    return FileResponse(
        str(FRONTEND_DIR / "OneSignalSDKWorker.js"),
        media_type="application/javascript",
        headers={"Service-Worker-Allowed": "/"},
    )
