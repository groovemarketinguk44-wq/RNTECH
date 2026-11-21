# RNTECH

RNTECH: RnB / Tech House event platform: events, mixes, tickets (Stripe), campaigns, background audio with Media Session API.

## Stack

FastAPI + SQLAlchemy, APScheduler, Stripe, ReportLab; frontend in /frontend

## Commands

```bash
# install
python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
# run
uvicorn backend.main:app --reload --port 8000
# test
(no automated tests yet: run it and check the changed pages by hand)
```

## Deploy

Fly app `rntech`. Deploys automatically: GitHub Action `.github/workflows/fly-deploy.yml` runs `flyctl deploy` whenever main changes (merging a PR = deploying; it can also be run by hand from the Actions tab). Uses the FLY_API_TOKEN repo secret (deploy-only token). Work on a branch; only merge to main when it should go live.

## Environment variables (names only; values live in Fly secrets / local .env, never in git)

SECRET_KEY DATABASE_URL BASE_URL FRONTEND_URL FRONTEND_DIR DATA_DIR UPLOAD_DIR FROM_EMAIL FROM_NAME SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS IMAP_HOST STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET META_ADS_ACCESS_TOKEN META_AD_ACCOUNT_ID META_CAPI_ACCESS_TOKEN META_PIXEL_ID ONESIGNAL_APP_ID ONESIGNAL_REST_API_KEY

Needed in a cloud session: SECRET_KEY

## Conventions

- Work on a branch and open a PR; Ben merges. Never commit secrets or .env files.
- Keep changes small and explain them in plain words.
- Ben's defaults for his apps: OneSignal push alerts, an admin Visitors tab, full SEO (landing pages, sitemap) where it fits.
