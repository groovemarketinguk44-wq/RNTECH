import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@rntech.live")
FROM_NAME = os.getenv("FROM_NAME", "RNTECH")


def send_email(to_email: str, to_name: str, subject: str, html_body: str) -> bool:
    if not SMTP_HOST:
        logger.info(
            f"[EMAIL — no SMTP configured]\nTo: {to_name} <{to_email}>\nSubject: {subject}\n---\n{html_body}\n"
        )
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg["To"] = f"{to_name} <{to_email}>"
        msg.attach(MIMEText(html_body, "html"))
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
