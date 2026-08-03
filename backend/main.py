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
from .routes import auth_routes, events, mixes, tickets, contact, sponsors, admin, campaigns, inbox_routes, settings as settings_routes, checkout
from .routes.campaigns import process_pending_sends
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
    # Ensure upload dirs exist
    for sub in ("images", "videos"):
        (UPLOAD_DIR / sub).mkdir(parents=True, exist_ok=True)
    # Start email scheduler (runs hourly)
    scheduler.add_job(_run_pending, "interval", hours=1, id="email_drip")
    scheduler.add_job(_run_mail_sweep, "interval", minutes=10, id="mail_sweep")
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
def serve_app():
    # Always revalidate — this is a single-page app, so a stale cached copy in a
    # long-lived open tab silently keeps running old frontend code indefinitely.
    return FileResponse(
        str(FRONTEND_DIR / "index.html"),
        headers={"Cache-Control": "no-cache, must-revalidate"},
    )


@app.get("/health")
def health():
    return {"status": "ok"}
