import imaplib
import email as email_lib
import smtplib
import os
from email.header import decode_header as _decode_hdr
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..email_service import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, FROM_NAME, send_email
from ..settings_utils import get_setting

router = APIRouter()

IMAP_HOST = os.getenv("IMAP_HOST", "imappro.zoho.eu")
IMAP_PORT = 993
SENT_FOLDERS = ["Sent", "Sent Items", "[Gmail]/Sent Mail", "Sent Messages", "INBOX.Sent"]
JUNK_FOLDERS = ["Spam", "Junk", "Junk E-mail", "[Gmail]/Spam", "Bulk Mail", "INBOX.Spam", "INBOX.Junk"]

# Folders Zoho auto-sorts mail into that the admin Inbox page never shows —
# swept back into INBOX on a schedule so nothing sits there unseen.
SIDE_FOLDERS = ["Notification", "Newsletter", "Archive"]


def _dh(value):
    if not value:
        return ""
    parts = _decode_hdr(value)
    out = []
    for part, charset in parts:
        if isinstance(part, bytes):
            out.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            out.append(part)
    return "".join(out)


def _imap():
    mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    mail.login(SMTP_USER, SMTP_PASS)
    return mail


def _body(msg):
    html, text = "", ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/html" and not html:
                payload = part.get_payload(decode=True)
                html = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
            elif ct == "text/plain" and not text:
                payload = part.get_payload(decode=True)
                text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            if msg.get_content_type() == "text/html":
                html = payload.decode(charset, errors="replace")
            else:
                text = payload.decode(charset, errors="replace")
    return html, text


def _admin(user):
    if not user or user.role != "admin":
        raise HTTPException(403, "Admin only")


def _select_sent(mail) -> bool:
    for folder in SENT_FOLDERS:
        typ, _ = mail.select(f'"{folder}"' if " " in folder else folder)
        if typ == "OK":
            return True
    return False


def _select_junk(mail) -> bool:
    for folder in JUNK_FOLDERS:
        typ, _ = mail.select(f'"{folder}"' if " " in folder else folder)
        if typ == "OK":
            return True
    return False


def sweep_side_folders_to_inbox() -> int:
    """Moves mail out of Zoho's auto-sorted Notification/Newsletter/Archive folders
    and into INBOX, so nothing sits somewhere the admin panel never looks."""
    if not SMTP_USER:
        return 0
    mail = _imap()
    moved = 0
    for folder in SIDE_FOLDERS:
        typ, _ = mail.select(f'"{folder}"' if " " in folder else folder)
        if typ != "OK":
            continue
        _, data = mail.search(None, "ALL")
        uids = data[0].split()
        for uid in uids:
            typ, _ = mail.copy(uid, "INBOX")
            if typ == "OK":
                mail.store(uid, "+FLAGS", "\\Deleted")
                moved += 1
        mail.expunge()
    mail.logout()
    return moved


@router.get("/admin/inbox")
def get_inbox(user=Depends(get_current_user)):
    _admin(user)
    if not SMTP_USER:
        raise HTTPException(503, "Inbox not configured")
    mail = _imap()
    mail.select("INBOX")
    _, data = mail.search(None, "ALL")
    uids = data[0].split()
    uids = uids[-50:] if len(uids) > 50 else uids
    _, unseen_data = mail.search(None, "UNSEEN")
    unseen_set = set(unseen_data[0].split())
    emails = []
    for uid in reversed(uids):
        _, msg_data = mail.fetch(uid, "(RFC822.HEADER)")
        raw = msg_data[0][1]
        msg = email_lib.message_from_bytes(raw)
        emails.append({
            "uid": uid.decode(),
            "from": _dh(msg.get("From", "")),
            "subject": _dh(msg.get("Subject", "(no subject)")),
            "date": msg.get("Date", ""),
            "unread": uid in unseen_set,
        })
    mail.logout()
    return emails


@router.get("/admin/inbox/{uid}")
def get_message(uid: str, user=Depends(get_current_user)):
    _admin(user)
    if not SMTP_USER:
        raise HTTPException(503, "Inbox not configured")
    mail = _imap()
    mail.select("INBOX")
    _, msg_data = mail.fetch(uid.encode(), "(RFC822)")
    mail.store(uid.encode(), "+FLAGS", "\\Seen")
    mail.logout()
    raw = msg_data[0][1]
    msg = email_lib.message_from_bytes(raw)
    html, text = _body(msg)
    return {
        "uid": uid,
        "from": _dh(msg.get("From", "")),
        "to": _dh(msg.get("To", "")),
        "subject": _dh(msg.get("Subject", "")),
        "date": msg.get("Date", ""),
        "message_id": msg.get("Message-ID", ""),
        "body_html": html,
        "body_text": text,
    }


@router.get("/admin/junk")
def get_junk(user=Depends(get_current_user)):
    _admin(user)
    if not SMTP_USER:
        raise HTTPException(503, "Inbox not configured")
    mail = _imap()
    if not _select_junk(mail):
        mail.logout()
        raise HTTPException(503, "Junk folder not found")
    _, data = mail.search(None, "ALL")
    uids = data[0].split()
    uids = uids[-50:] if len(uids) > 50 else uids
    _, unseen_data = mail.search(None, "UNSEEN")
    unseen_set = set(unseen_data[0].split())
    emails = []
    for uid in reversed(uids):
        _, msg_data = mail.fetch(uid, "(RFC822.HEADER)")
        raw = msg_data[0][1]
        msg = email_lib.message_from_bytes(raw)
        emails.append({
            "uid": uid.decode(),
            "from": _dh(msg.get("From", "")),
            "subject": _dh(msg.get("Subject", "(no subject)")),
            "date": msg.get("Date", ""),
            "unread": uid in unseen_set,
        })
    mail.logout()
    return emails


@router.get("/admin/junk/{uid}")
def get_junk_message(uid: str, user=Depends(get_current_user)):
    _admin(user)
    if not SMTP_USER:
        raise HTTPException(503, "Inbox not configured")
    mail = _imap()
    if not _select_junk(mail):
        mail.logout()
        raise HTTPException(503, "Junk folder not found")
    _, msg_data = mail.fetch(uid.encode(), "(RFC822)")
    mail.store(uid.encode(), "+FLAGS", "\\Seen")
    mail.logout()
    raw = msg_data[0][1]
    msg = email_lib.message_from_bytes(raw)
    html, text = _body(msg)
    return {
        "uid": uid,
        "from": _dh(msg.get("From", "")),
        "to": _dh(msg.get("To", "")),
        "subject": _dh(msg.get("Subject", "")),
        "date": msg.get("Date", ""),
        "message_id": msg.get("Message-ID", ""),
        "body_html": html,
        "body_text": text,
    }


@router.get("/admin/sent")
def get_sent(user=Depends(get_current_user)):
    _admin(user)
    if not SMTP_USER:
        raise HTTPException(503, "Inbox not configured")
    mail = _imap()
    if not _select_sent(mail):
        mail.logout()
        raise HTTPException(503, "Sent folder not found")
    _, data = mail.search(None, "ALL")
    uids = data[0].split()
    uids = uids[-50:] if len(uids) > 50 else uids
    emails = []
    for uid in reversed(uids):
        _, msg_data = mail.fetch(uid, "(RFC822.HEADER)")
        raw = msg_data[0][1]
        msg = email_lib.message_from_bytes(raw)
        emails.append({
            "uid": uid.decode(),
            "to": _dh(msg.get("To", "")),
            "subject": _dh(msg.get("Subject", "(no subject)")),
            "date": msg.get("Date", ""),
        })
    mail.logout()
    return emails


@router.get("/admin/sent/{uid}")
def get_sent_message(uid: str, user=Depends(get_current_user)):
    _admin(user)
    if not SMTP_USER:
        raise HTTPException(503, "Inbox not configured")
    mail = _imap()
    if not _select_sent(mail):
        mail.logout()
        raise HTTPException(503, "Sent folder not found")
    _, msg_data = mail.fetch(uid.encode(), "(RFC822)")
    mail.logout()
    raw = msg_data[0][1]
    msg = email_lib.message_from_bytes(raw)
    html, text = _body(msg)
    return {
        "uid": uid,
        "from": _dh(msg.get("From", "")),
        "to": _dh(msg.get("To", "")),
        "subject": _dh(msg.get("Subject", "")),
        "date": msg.get("Date", ""),
        "body_html": html,
        "body_text": text,
    }


@router.post("/admin/inbox/reply")
def reply_message(data: dict, user=Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user)
    if not SMTP_USER:
        raise HTTPException(503, "SMTP not configured")
    to_email = (data.get("to") or "").strip()
    subject = (data.get("subject") or "").strip()
    body = (data.get("body") or "").strip()
    message_id = data.get("message_id", "")
    if not to_email or not body:
        raise HTTPException(400, "Missing to or body")
    if not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"

    # Convert plain-text newlines to HTML paragraphs
    paragraphs = [p.strip() for p in body.split("\n") if p.strip()]
    body_html = "".join(f"<p style='margin:0 0 12px;'>{p}</p>" for p in paragraphs) if paragraphs else body

    sig = get_setting(db, "email_signature")

    # Use send_email for the branded template + signature; also set In-Reply-To via raw SMTP
    from ..email_service import build_email_html
    html_body = build_email_html(body_html, sig)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"] = to_email
    if message_id:
        msg["In-Reply-To"] = message_id
        msg["References"] = message_id
    msg.attach(MIMEText(html_body, "html"))

    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as srv:
            srv.login(SMTP_USER, SMTP_PASS)
            srv.sendmail(FROM_EMAIL, to_email, msg.as_string())
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as srv:
            srv.ehlo()
            srv.starttls()
            srv.login(SMTP_USER, SMTP_PASS)
            srv.sendmail(FROM_EMAIL, to_email, msg.as_string())
    return {"ok": True}
