"""
Run once to create admin user and seed initial data.
  python seed.py
"""
import json
import secrets
import sys
import os
from pathlib import Path

# Use configured dirs so uploads land on the persistent volume on Fly.io
data_dir = Path(os.getenv("DATA_DIR", "./data"))
upload_dir = Path(os.getenv("UPLOAD_DIR", "./uploads"))
data_dir.mkdir(parents=True, exist_ok=True)
(upload_dir / "images").mkdir(parents=True, exist_ok=True)
(upload_dir / "videos").mkdir(parents=True, exist_ok=True)

from sqlalchemy import text, inspect as sa_inspect
from backend.database import engine, SessionLocal
from backend.models import Base, User, Event, TicketType, Mix, Sponsor
from backend.auth import hash_password

Base.metadata.create_all(bind=engine)

# Migrate existing DBs: add columns that didn't exist at initial deploy
with engine.connect() as _conn:
    try:
        _cols = [c["name"] for c in sa_inspect(engine).get_columns("events")]
        if "registration_mode" not in _cols:
            _conn.execute(text("ALTER TABLE events ADD COLUMN registration_mode TEXT DEFAULT 'open'"))
            _conn.commit()
            print("✓ Migrated: added registration_mode to events")
    except Exception as _e:
        print(f"  Migration skipped: {_e}")

db = SessionLocal()

ADMIN_EMAIL = "ben@rntech.live"
ADMIN_PASSWORD = "RNTech2025!"

# ── Admin user ──────────────────────────────────────────────────────────────
if not db.query(User).filter(User.email == ADMIN_EMAIL).first():
    admin = User(
        id="u-admin",
        name="Ben Henderson",
        email=ADMIN_EMAIL,
        password_hash=hash_password(ADMIN_PASSWORD),
        role="admin",
        subscribed=False,
    )
    db.add(admin)
    db.commit()
    print(f"✓ Admin created: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
else:
    print(f"  Admin already exists: {ADMIN_EMAIL}")

# ── Events ──────────────────────────────────────────────────────────────────
events_data = [
    {
        "id": "evt-001",
        "title": "BANK HOLIDAY ROOFTOP",
        "slug": "bank-holiday-rooftop-2026",
        "date": "2026-05-25",
        "display_date": "Mon 25th May 2026",
        "start_time": "2:00 PM",
        "end_time": "11:00 PM",
        "venue": "The White Swan",
        "location": "St Albans, Hertfordshire",
        "description": "Join us for a FREE Bank Holiday rooftop party on the terrace of The White Swan, St Albans. Where RnB meets Tech House under the open sky. Free entry, serious good vibes, and a lineup that hits different. Come up, stay up.",
        "lineup_json": json.dumps([
            {"name": "DJ MIDDO", "role": "Headliner"},
            {"name": "BEN HENDERSON", "role": "Headliner"},
            {"name": "DJ DAGZ", "role": "Support"},
            {"name": "MATT CRAWFORD", "role": "Support"},
            {"name": "DJ MIKEY T", "role": "Support"},
        ]),
        "giveaways_json": json.dumps(["Free entry all night", "Brewtini Cocktail sampling", "RNTECH merch giveaway"]),
        "status": "upcoming",
        "is_free": True,
        "featured": True,
    },
    {
        "id": "evt-002",
        "title": "NYE LAUNCH",
        "slug": "nye-launch-2024",
        "date": "2024-12-31",
        "display_date": "Tue 31st Dec 2024",
        "start_time": "8:00 PM",
        "end_time": "11:00 PM",
        "venue": "The White Swan",
        "location": "St Albans, Hertfordshire",
        "description": "The inaugural RNTECH launch event. Where it all began. NYE 2024 at The White Swan, St Albans. A night that set the tone for everything that follows.",
        "lineup_json": json.dumps([
            {"name": "BEN HENDERSON", "role": "Headliner"},
            {"name": "DJ MIDDO", "role": "Support"},
        ]),
        "giveaways_json": json.dumps(["NYE countdown", "Champagne toast at midnight"]),
        "status": "past",
        "is_free": True,
        "featured": False,
    },
]

for ed in events_data:
    if not db.query(Event).filter(Event.id == ed["id"]).first():
        db.add(Event(**ed))
        print(f"✓ Event: {ed['title']}")
    else:
        print(f"  Skipped (exists): {ed['title']}")

db.commit()

# ── Ticket types ─────────────────────────────────────────────────────────────
ticket_types_data = [
    {"id": "tkt-001", "event_id": "evt-001", "name": "General Entry",
     "price": 0, "capacity": 200, "description": "Secure your spot on the guest list. Free entry all night, no catch."},
    {"id": "tkt-002", "event_id": "evt-001", "name": "VIP Access",
     "price": 2500, "capacity": 20, "description": "Priority entry, VIP area access, and a complimentary Brewtini cocktail on arrival."},
]

for td in ticket_types_data:
    if not db.query(TicketType).filter(TicketType.id == td["id"]).first():
        db.add(TicketType(**td))
        print(f"✓ Ticket type: {td['name']}")

db.commit()

# ── Mixes ────────────────────────────────────────────────────────────────────
mixes_data = [
    {"id": "mix-001", "title": "ROOFTOP WARM UP", "resident_name": "BEN HENDERSON",
     "month": "May 2025", "duration": "60 MIN",
     "description": "Pre-event warm up for the Bank Holiday Rooftop. RnB essentials meet Tech House builds.",
     "tracklist_json": json.dumps(["01. Opening Vibes", "02. RnB Selections Vol.1", "03. The Tech Transition", "04. Peak Hour Drop", "05. Outro Groove"])},
    {"id": "mix-002", "title": "NYE REWIND", "resident_name": "DJ MIDDO",
     "month": "December 2024", "duration": "45 MIN",
     "description": "Relive the NYE 2024 launch set. Pure vibes from the night that started it all.",
     "tracklist_json": json.dumps(["01. Midnight Intro", "02. RnB Heat", "03. Peak Hour", "04. NYE Finale"])},
    {"id": "mix-003", "title": "LATE NIGHT SESSIONS", "resident_name": "DJ DAGZ",
     "month": "April 2025", "duration": "90 MIN",
     "description": "Deep into the night. Where genre lines blur and the bass hits hard.",
     "tracklist_json": json.dumps([])},
]

for md in mixes_data:
    if not db.query(Mix).filter(Mix.id == md["id"]).first():
        db.add(Mix(**md))
        print(f"✓ Mix: {md['title']}")

db.commit()

# ── Sponsors ─────────────────────────────────────────────────────────────────
sponsors_data = [
    {"id": "sp-001", "name": "THE WHITE SWAN", "subtitle": "St Albans",
     "description": "Our home venue. Rooftop terrace, great drinks, and the perfect space.",
     "logo_filename": "/static/uploads/ws-transparent.png", "link": "#", "sort_order": 1},
    {"id": "sp-002", "name": "BREWTINI", "subtitle": "Premium Canned Cocktails",
     "description": "Premium canned cocktails. Your night, elevated.",
     "logo_filename": "/static/uploads/brew-transparent.png", "link": "#", "sort_order": 2},
]

for sd in sponsors_data:
    if not db.query(Sponsor).filter(Sponsor.id == sd["id"]).first():
        db.add(Sponsor(**sd))
        print(f"✓ Sponsor: {sd['name']}")
    else:
        print(f"  Skipped (exists): {sd['name']}")

db.commit()
db.close()

print("\n✅ Seed complete.")
print(f"   Admin login: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
print("   Change password after first login!")
