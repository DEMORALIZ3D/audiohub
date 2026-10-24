import os
import smtplib
import ssl
import logging
import asyncio
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..models import SystemSetting
from ..database import SessionLocal
from ..config import settings

logger = logging.getLogger(__name__)

class EmailService:
    DEFAULT_CONFIG = {
        "email_provider": os.getenv("EMAIL_PROVIDER", "smtp"),  # "smtp" or "http_api"
        "mail_api_url": os.getenv("MAIL_API_URL", ""),
        "mail_api_key": os.getenv("MAIL_API_KEY", ""),
        "mail_enabled": "true",
        "smtp_enabled": "false",
        "smtp_host": os.getenv("SMTP_HOST", "smtp.example.com"),
        "smtp_port": os.getenv("SMTP_PORT", "587"),
        "smtp_user": os.getenv("SMTP_USER", ""),
        "smtp_password": os.getenv("SMTP_PASS", ""),
        "smtp_from": os.getenv("SMTP_FROM", "noreply@example.com"),
        "smtp_security": "STARTTLS",  # STARTTLS or SSL
    }

    def get_config(self, db: Optional[Session] = None) -> Dict[str, str]:
        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True

        config = dict(self.DEFAULT_CONFIG)
        try:
            settings = db.query(SystemSetting).filter(
                or_(
                    SystemSetting.key.like("smtp_%"),
                    SystemSetting.key.like("mail_%"),
                    SystemSetting.key.like("email_%")
                )
            ).all()
            for s in settings:
                config[s.key] = s.value
        finally:
            if close_db:
                db.close()
        return config

    def save_config(self, new_config: Dict[str, str], db: Session) -> Dict[str, str]:
        allowed_prefixes = ("smtp_", "mail_", "email_")
        for k, v in new_config.items():
            if any(k.startswith(p) for p in allowed_prefixes):
                setting = db.query(SystemSetting).filter(SystemSetting.key == k).first()
                if not setting:
                    setting = SystemSetting(key=k, value=str(v), description=f"Email config {k}")
                    db.add(setting)
                else:
                    setting.value = str(v)
        db.commit()
        return self.get_config(db)

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Send an email asynchronously via an HTTP Mail API or direct SMTP.
        """
        config = self.get_config(db)
        provider = config.get("email_provider", "smtp")
        mail_enabled = (
            config.get("mail_enabled", "true").lower() == "true" or
            config.get("smtp_enabled", "false").lower() == "true"
        )

        if not mail_enabled:
            logger.info(f"Mail service is disabled. Simulated email to {to_email} with subject: {subject}")
            return {"success": False, "error": "Mail service is disabled in Settings"}

        # 1. HTTP Mail API (Primary / Webhook)
        if provider == "http_api":
            api_url = config.get("mail_api_url", "")
            api_key = config.get("mail_api_key", "").strip()

            if not api_key:
                return {"success": False, "error": "Mail Server API key missing"}

            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    headers = {
                        "Content-Type": "application/json",
                        "User-Agent": "AudioHub/1.0 (Ubuntu; x86_64)",
                        "x-api-key": api_key,
                    }
                    payload = {
                        "to": to_email,
                        "subject": subject,
                        "html": html_content,
                        "data": {"recipient": to_email, "service": "AudioHub"},
                    }
                    resp = await client.post(api_url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        logger.info(f"Transactional email sent via HTTP Mail API to {to_email}: {data}")
                        return {"success": True, "message": "Email sent successfully"}
                    else:
                        logger.error(f"HTTP Mail API error {resp.status_code}: {resp.text}")
                        return {"success": False, "error": f"Mail server returned HTTP {resp.status_code}: {resp.text}"}
            except Exception as e:
                logger.error(f"Failed to send email via HTTP Mail API to {to_email}: {e}")
                return {"success": False, "error": str(e)}

        # 2. SMTP Direct Fallback
        host = config.get("smtp_host", "smtp.example.com")
        port = int(config.get("smtp_port", 587))
        user = config.get("smtp_user", "")
        password = config.get("smtp_password", "")
        from_email = config.get("smtp_from") or user or "noreply@example.com"
        security = config.get("smtp_security", "STARTTLS").upper()

        if not user or not password:
            return {"success": False, "error": "SMTP username or password missing"}

        def _sync_send():
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{settings.BRAND_NAME} <{from_email}>"
            msg["To"] = to_email

            if text_content:
                msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            if security == "SSL" or port == 465:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as server:
                    server.login(user, password)
                    server.sendmail(from_email, to_email, msg.as_string())
            else:
                with smtplib.SMTP(host, port, timeout=15) as server:
                    server.ehlo()
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                    server.ehlo()
                    server.login(user, password)
                    server.sendmail(from_email, to_email, msg.as_string())
            return True

        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(None, _sync_send)
            logger.info(f"Transactional email sent successfully via SMTP to {to_email}")
            return {"success": True}
        except Exception as e:
            logger.error(f"Failed to send email via SMTP to {to_email}: {e}")
            return {"success": False, "error": str(e)}

    async def send_invite(
        self,
        to_email: str,
        display_name: str,
        username: str,
        temp_password: str,
        role: str,
        is_under_13: bool,
        server_url: str = "http://localhost:4533",
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        brand = settings.BRAND_NAME
        subject = f"You're Invited to {brand}! 🎵"
        under_13_badge = "<p style='color: #1ed760; font-size: 13px;'>👶 <i>Kid Profile (Under 13 restrictions enabled)</i></p>" if is_under_13 else ""
        html = f"""
        <div style="background-color: #121212; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
            <h2 style="color: #1ed760; margin-bottom: 8px;">Welcome to {brand}!</h2>
            <p>Hi <b>{display_name}</b>,</p>
            <p>You have been invited to your private family music streaming server.</p>
            {under_13_badge}
            <div style="background-color: #1f1f1f; padding: 16px; border-radius: 8px; border: 1px solid #333333; margin: 20px 0;">
                <p style="margin: 4px 0;"><b>Server URL:</b> <a href="{server_url}" style="color: #1ed760;">{server_url}</a></p>
                <p style="margin: 4px 0;"><b>Username / Email:</b> {to_email}</p>
                <p style="margin: 4px 0;"><b>Temporary Password:</b> <code style="background: #2a2a2a; padding: 2px 6px; border-radius: 4px; color: #1ed760;">{temp_password}</code></p>
                <p style="margin: 4px 0;"><b>Role:</b> {role.capitalize()}</p>
            </div>
            <p>You can also connect on Android with <b>Symfonium</b> via Subsonic using the same credentials.</p>
            <div style="text-align: center; margin-top: 24px;">
                <a href="{server_url}" style="background-color: #1ed760; color: #000000; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">Log In to {brand}</a>
            </div>
        </div>
        """
        return await self.send_email(to_email, subject, html, db=db)

    async def send_password_reset(
        self,
        to_email: str,
        display_name: str,
        new_password: str,
        server_url: str = "http://localhost:4533",
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        brand = settings.BRAND_NAME
        subject = f"Your {brand} Password Has Been Reset 🔑"
        html = f"""
        <div style="background-color: #121212; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
            <h2 style="color: #1ed760; margin-bottom: 8px;">{brand} Password Reset</h2>
            <p>Hi <b>{display_name}</b>,</p>
            <p>Your password for your {brand} account has been updated by an administrator:</p>
            <div style="background-color: #1f1f1f; padding: 16px; border-radius: 8px; border: 1px solid #333333; margin: 20px 0;">
                <p style="margin: 4px 0;"><b>New Password:</b> <code style="background: #2a2a2a; padding: 2px 6px; border-radius: 4px; color: #1ed760;">{new_password}</code></p>
            </div>
            <p>Please log in and update your password if desired.</p>
            <div style="text-align: center; margin-top: 24px;">
                <a href="{server_url}" style="background-color: #1ed760; color: #000000; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">Open {brand}</a>
            </div>
        </div>
        """
        return await self.send_email(to_email, subject, html, db=db)

email_service = EmailService()
