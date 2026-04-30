import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from .database import engine, SessionLocal
from .models import Base
from .routes import auth_routes, events, mixes, tickets, contact, sponsors, admin, campaigns
from .routes.campaigns import process_pending_sends

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Ensure upload dirs exist
    for sub in ("images", "videos"):
        (UPLOAD_DIR / sub).mkdir(parents=True, exist_ok=True)
    # Start email scheduler (runs hourly)
    scheduler.add_job(_run_pending, "interval", hours=1, id="email_drip")
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
def serve_app():
    return FileResponse(str(FRONTEND_DIR / "index.html"))


@app.get("/health")
def health():
    return {"status": "ok"}
