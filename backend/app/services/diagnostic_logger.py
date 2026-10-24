import logging
from typing import Optional
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models import EngineDiagnosticLog, utc_now

logger = logging.getLogger(__name__)

class DiagnosticLogger:
    @staticmethod
    def log_event(
        source: str,
        message: str,
        level: Optional[str] = None,
        details: Optional[str] = None,
        db: Optional[Session] = None
    ):
        """
        Record engine event or error. Analyzes message for YouTube bot / throttling signals.
        """
        msg_lower = (message or "").lower()
        det_lower = (details or "").lower()

        # Automatic detection of YouTube spam/bot blocks
        if any(w in msg_lower or w in det_lower for w in ["bot", "sign in to confirm", "captcha", "429", "too many requests"]):
            level = "BOT_DETECTED"
        elif not level:
            level = "INFO"

        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True

        try:
            entry = EngineDiagnosticLog(
                source=source,
                level=level,
                message=message,
                details=details,
                timestamp=utc_now()
            )
            db.add(entry)
            db.commit()
            if level == "BOT_DETECTED":
                logger.warning(f"🚨 [BOT DETECTED] {source}: {message}")
            elif level == "ERROR":
                logger.error(f"❌ [ENGINE ERROR] {source}: {message}")
            else:
                logger.info(f"ℹ️ [ENGINE LOG] {source}: {message}")
        except Exception as e:
            logger.error(f"Failed to record engine diagnostic log: {e}")
        finally:
            if close_db:
                db.close()

diagnostic_logger = DiagnosticLogger()
