import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import EmailCampaign, EmailSend, User
from ..auth import require_admin
from ..email_service import send_email

router = APIRouter()


def _campaign_dict(c: EmailCampaign, db: Session) -> dict:
    sent = db.query(EmailSend).filter(EmailSend.campaign_id == c.id, EmailSend.status == "sent").count()
    pending = db.query(EmailSend).filter(EmailSend.campaign_id == c.id, EmailSend.status == "pending").count()
    return {
        "id": c.id, "name": c.name, "subject": c.subject,
        "bodyHtml": c.body_html, "delayDays": c.delay_days,
        "active": c.active, "createdAt": c.created_at.isoformat(),
        "sentCount": sent, "pendingCount": pending,
    }


@router.get("/admin/campaigns")
def get_campaigns(db: Session = Depends(get_db), _=Depends(require_admin)):
    campaigns = db.query(EmailCampaign).order_by(EmailCampaign.delay_days).all()
    return [_campaign_dict(c, db) for c in campaigns]


class CampaignIn(BaseModel):
    name: str
    subject: str
    bodyHtml: str
    delayDays: int = 0
    active: bool = True


@router.post("/admin/campaigns")
def create_campaign(data: CampaignIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = EmailCampaign(
        id="cmp-" + secrets.token_hex(8),
        name=data.name, subject=data.subject, body_html=data.bodyHtml,
        delay_days=data.delayDays, active=data.active,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _campaign_dict(c, db)


@router.put("/admin/campaigns/{campaign_id}")
def update_campaign(campaign_id: str, data: CampaignIn,
                    db: Session = Depends(get_db), _=Depends(require_admin)):
    c = db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    c.name = data.name
    c.subject = data.subject
    c.body_html = data.bodyHtml
    c.delay_days = data.delayDays
    c.active = data.active
    db.commit()
    db.refresh(c)
    return _campaign_dict(c, db)


@router.delete("/admin/campaigns/{campaign_id}", status_code=204)
def delete_campaign(campaign_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    db.delete(c)
    db.commit()


@router.post("/admin/campaigns/{campaign_id}/blast")
def blast_campaign(campaign_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Send campaign immediately to all active subscribers not yet sent to."""
    c = db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")

    already_sent = {
        s.user_id for s in
        db.query(EmailSend).filter(EmailSend.campaign_id == c.id, EmailSend.status == "sent").all()
    }
    subscribers = db.query(User).filter(User.subscribed == True, User.role == "user").all()

    sent = 0
    for user in subscribers:
        if user.id in already_sent:
            continue
        ok = send_email(user.email, user.name, c.subject, c.body_html)
        existing = db.query(EmailSend).filter(
            EmailSend.campaign_id == c.id, EmailSend.user_id == user.id
        ).first()
        if existing:
            existing.status = "sent" if ok else "failed"
            existing.sent_at = datetime.utcnow()
        else:
            db.add(EmailSend(
                id="snd-" + secrets.token_hex(8),
                campaign_id=c.id, user_id=user.id,
                scheduled_for=datetime.utcnow(), sent_at=datetime.utcnow(),
                status="sent" if ok else "failed",
            ))
        if ok:
            sent += 1

    db.commit()
    return {"sent": sent}


def process_pending_sends(db: Session):
    """Called by scheduler — flush due email sends."""
    now = datetime.utcnow()
    pending = db.query(EmailSend).filter(
        EmailSend.status == "pending",
        EmailSend.scheduled_for <= now,
    ).all()
    for send in pending:
        user = send.user
        campaign = send.campaign
        if not user or not campaign or not user.subscribed:
            send.status = "skipped"
            continue
        ok = send_email(user.email, user.name, campaign.subject, campaign.body_html)
        send.status = "sent" if ok else "failed"
        send.sent_at = now
    db.commit()
    return len(pending)
