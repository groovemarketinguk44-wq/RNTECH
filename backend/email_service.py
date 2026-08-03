import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@rntech.live")
FROM_NAME = os.getenv("FROM_NAME", "RNTECH")


def build_email_html(body_content: str, signature_html: str = "") -> str:
    sig_block = ""
    if signature_html and signature_html.strip():
        sig_block = f'<div style="margin-top:24px;">{signature_html}</div>'
    return (
        f'<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.7;max-width:600px;">'
        f'{body_content}{sig_block}'
        f'</div>'
    )


def send_email(to_email: str, to_name: str, subject: str, body_content: str, signature_html: str = "", attachments: list = None) -> bool:
    html_body = build_email_html(body_content, signature_html)
    if not SMTP_HOST:
        names = ", ".join(a["filename"] for a in (attachments or []))
        logger.info(f"[EMAIL — no SMTP]\nTo: {to_name} <{to_email}>\nSubject: {subject}\nAttachments: {names}\n---\n{html_body}\n")
        return True
    try:
        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg["To"] = f"{to_name} <{to_email}>"
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(html_body, "html"))
        msg.attach(alt)
        for att in (attachments or []):
            part = MIMEApplication(att["content"], Name=att["filename"])
            part["Content-Disposition"] = f'attachment; filename="{att["filename"]}"'
            msg.attach(part)
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as srv:
                if SMTP_USER:
                    srv.login(SMTP_USER, SMTP_PASS)
                srv.sendmail(FROM_EMAIL, to_email, msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as srv:
                srv.ehlo()
                srv.starttls()
                if SMTP_USER:
                    srv.login(SMTP_USER, SMTP_PASS)
                srv.sendmail(FROM_EMAIL, to_email, msg.as_string())
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as exc:
        logger.error(f"Email send failed to {to_email}: {exc}")
        return False
