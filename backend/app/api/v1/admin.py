import os
import hmac
import hashlib
import json
import httpx
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ...database import get_db
from ...models import User, UserActivityLog, EngineDiagnosticLog
from .auth import get_current_user, hash_password
from ...services.email_service import email_service
from ...services.diagnostic_logger import diagnostic_logger
from ...services.audio_streamer import audio_streamer
from ...config import settings

router = APIRouter()

# RBAC Dependencies
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["admin", "super_admin"] and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin permissions required")
    return current_user

def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin permissions required")
    return current_user

# Pydantic Models
class UserCreateReq(BaseModel):
    username: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    password: str
    role: str = "user"  # "super_admin", "admin", "user"
    is_under_13: bool = False
    send_invite_email: bool = False

class UserUpdateReq(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    is_under_13: Optional[bool] = None
    is_active: Optional[bool] = None

class PasswordResetReq(BaseModel):
    new_password: str
    send_email: bool = False

class EmailConfigReq(BaseModel):
    email_provider: Optional[str] = "smtp"
    mail_api_url: Optional[str] = ""
    mail_api_key: Optional[str] = ""
    mail_enabled: Optional[str] = "false"
    smtp_enabled: Optional[str] = "false"
    smtp_host: Optional[str] = "smtp.example.com"
    smtp_port: Optional[str] = "587"
    smtp_user: Optional[str] = ""
    smtp_password: Optional[str] = ""
    smtp_from: Optional[str] = "noreply@example.com"
    smtp_security: Optional[str] = "STARTTLS"

    class Config:
        extra = "allow"

class TestEmailReq(BaseModel):
    target_email: str

class PasteCookieReq(BaseModel):
    cookie_content: str

# ----------------- 1. User Management (RBAC) -----------------

@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    users = db.query(User).order_by(User.created_at.asc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "display_name": u.display_name or u.username,
            "role": u.role or ("super_admin" if u.is_admin else "user"),
            "is_admin": u.is_admin,
            "is_under_13": u.is_under_13,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        }
        for u in users
    ]

@router.post("/users")
async def create_user(
    data: UserCreateReq,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    # Only super_admin can create another admin or super_admin
    if data.role in ["admin", "super_admin"] and admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admins can assign admin/super_admin roles")

    # Check for existing username or email
    clean_username = data.username.strip().lower()
    clean_email = data.email.strip().lower() if data.email else None

    if db.query(User).filter(User.username == clean_username).first():
        raise HTTPException(status_code=400, detail="Username is already taken")
    if clean_email and db.query(User).filter(User.email == clean_email).first():
        raise HTTPException(status_code=400, detail="Email is already registered")

    new_user = User(
        username=clean_username,
        email=clean_email,
        display_name=data.display_name or clean_username,
        password_hash=hash_password(data.password),
        role=data.role,
        is_admin=(data.role in ["admin", "super_admin"]),
        is_under_13=data.is_under_13,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Activity log
    act = UserActivityLog(
        user_id=admin.id,
        username=admin.username,
        action="user_create",
        details=f"Created user {new_user.username} (Role: {new_user.role}, Under 13: {new_user.is_under_13})"
    )
    db.add(act)
    db.commit()

    # Optional invite email
    email_status = None
    if data.send_invite_email and clean_email:
        email_status = await email_service.send_invite(
            to_email=clean_email,
            display_name=new_user.display_name,
            username=new_user.username,
            temp_password=data.password,
            role=new_user.role,
            is_under_13=new_user.is_under_13,
            db=db
        )

    return {
        "status": "created",
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "display_name": new_user.display_name,
            "role": new_user.role,
            "is_under_13": new_user.is_under_13
        },
        "email_status": email_status
    }

@router.put("/users/{user_id}")
def update_user(
    user_id: str,
    data: UserUpdateReq,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Regular admin cannot modify a super_admin
    if target.role == "super_admin" and admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot edit a Super Admin account")

    # Only super_admin can grant or revoke admin/super_admin roles
    if data.role and data.role != target.role:
        if admin.role != "super_admin":
            raise HTTPException(status_code=403, detail="Only Super Admins can alter user roles")
        target.role = data.role
        target.is_admin = (data.role in ["admin", "super_admin"])

    if data.display_name is not None:
        target.display_name = data.display_name
    if data.is_under_13 is not None:
        target.is_under_13 = data.is_under_13
    if data.is_active is not None:
        if target.id == admin.id and not data.is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        target.is_active = data.is_active

    db.commit()

    db.add(UserActivityLog(
        user_id=admin.id,
        username=admin.username,
        action="user_update",
        details=f"Updated user {target.username}"
    ))
    db.commit()

    return {"status": "updated", "user_id": target.id}

@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if target.role == "super_admin" and admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot delete a Super Admin")

    username = target.username
    db.delete(target)
    db.commit()

    db.add(UserActivityLog(
        user_id=admin.id,
        username=admin.username,
        action="user_delete",
        details=f"Deleted user {username}"
    ))
    db.commit()

    return {"status": "deleted", "username": username}

@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    data: PasswordResetReq,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.role == "super_admin" and admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admins can reset a Super Admin's password")

    target.password_hash = hash_password(data.new_password)
    db.commit()

    email_status = None
    if data.send_email and target.email:
        email_status = await email_service.send_password_reset(
            to_email=target.email,
            display_name=target.display_name or target.username,
            new_password=data.new_password,
            db=db
        )

    db.add(UserActivityLog(
        user_id=admin.id,
        username=admin.username,
        action="password_reset",
        details=f"Reset password for {target.username}"
    ))
    db.commit()

    return {"status": "success", "email_status": email_status}

# ----------------- 2. Transactional Email (SMTP / HTTP API) -----------------

@router.get("/email/settings")
def get_email_settings(
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin)
):
    return email_service.get_config(db)

@router.post("/email/settings")
def update_email_settings(
    data: EmailConfigReq,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin)
):
    saved = email_service.save_config(data.dict(), db)
    return {"status": "saved", "config": saved}

@router.post("/email/test")
async def test_email_settings(
    data: TestEmailReq,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin)
):
    res = await email_service.send_email(
        to_email=data.target_email,
        subject="AudioHub SMTP Test Email 🚀",
        html_content="<div style='background:#121212;color:#1ed760;padding:20px;border-radius:8px;'><h3>AudioHub SMTP Working!</h3><p style='color:#ffffff;'>Your mail server configuration is fully functional.</p></div>",
        db=db
    )
    return res

# ----------------- 3. YouTube Cookie Upload Tool -----------------

@router.get("/cookies/status")
def get_cookies_status(admin: User = Depends(require_admin)):
    cookie_path = Path("/data/cookies.txt")
    if not cookie_path.exists():
        # Check local dev fallback
        cookie_path = Path("backend/data/cookies.txt")
    
    if cookie_path.exists():
        stat = cookie_path.stat()
        lines = 0
        try:
            with open(cookie_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = sum(1 for line in f if line.strip() and not line.startswith("#"))
        except Exception:
            pass
        return {
            "has_cookies": True,
            "file_size_bytes": stat.st_size,
            "active_cookie_entries": lines,
            "last_modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "path": str(cookie_path)
        }
    return {
        "has_cookies": False,
        "active_cookie_entries": 0,
        "message": "No cookies.txt installed"
    }

@router.post("/cookies/upload")
async def upload_cookies_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    content = await file.read()
    content_str = content.decode("utf-8", errors="ignore")
    return _save_cookies(content_str, db, admin)

@router.post("/cookies/paste")
def paste_cookies(
    data: PasteCookieReq,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return _save_cookies(data.cookie_content, db, admin)

def _save_cookies(content_str: str, db: Session, admin: User):
    if not content_str.strip():
        raise HTTPException(status_code=400, detail="Cookie content is empty")

    cookie_path = Path("/data/cookies.txt")
    if not cookie_path.parent.exists():
        cookie_path = Path("backend/data/cookies.txt")
    cookie_path.parent.mkdir(parents=True, exist_ok=True)

    with open(cookie_path, "w", encoding="utf-8") as f:
        f.write(content_str)

    # Reload yt-dlp cookie config in audio_streamer
    audio_streamer.ydl_opts["cookiefile"] = str(cookie_path)

    # Count valid lines
    active_lines = sum(1 for line in content_str.splitlines() if line.strip() and not line.startswith("#"))

    # Log diagnostic & activity
    diagnostic_logger.log_event(
        source="yt-dlp",
        message=f"YouTube cookies updated by {admin.username} ({active_lines} cookies loaded)",
        level="INFO",
        db=db
    )
    db.add(UserActivityLog(
        user_id=admin.id,
        username=admin.username,
        action="cookies_update",
        details=f"Updated cookies.txt with {active_lines} entries"
    ))
    db.commit()

    return {
        "status": "success",
        "message": "YouTube cookies updated and applied to streaming engine!",
        "active_cookie_entries": active_lines,
        "file_size": len(content_str)
    }

@router.delete("/cookies")
def delete_cookies(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    cookie_path = Path("/data/cookies.txt")
    if not cookie_path.exists():
        cookie_path = Path("backend/data/cookies.txt")
    if cookie_path.exists():
        cookie_path.unlink()
    audio_streamer.ydl_opts.pop("cookiefile", None)
    return {"status": "deleted"}

# ----------------- 4. User Activity & Streaming Logs -----------------

@router.get("/activity-logs")
def get_activity_logs(
    limit: int = 100,
    action: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    q = db.query(UserActivityLog)
    if action:
        q = q.filter(UserActivityLog.action == action)
    logs = q.order_by(UserActivityLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "username": l.username or "Anonymous",
            "action": l.action,
            "details": l.details,
            "ip_address": l.ip_address,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]

# ----------------- 5. Engine Diagnostics & Bot Detection -----------------

@router.get("/engine-diagnostics")
def get_engine_diagnostics(
    limit: int = 50,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    logs = db.query(EngineDiagnosticLog).order_by(EngineDiagnosticLog.timestamp.desc()).limit(limit).all()
    # Check if any recent logs flagged bot detection
    has_bot_alert = any(l.level == "BOT_DETECTED" for l in logs[:10])
    return {
        "has_bot_alert": has_bot_alert,
        "logs": [
            {
                "id": l.id,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                "level": l.level,
                "source": l.source,
                "message": l.message,
                "details": l.details,
                "is_resolved": l.is_resolved
            }
            for l in logs
        ]
    }

@router.delete("/engine-diagnostics/clear")
def clear_engine_diagnostics(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    db.query(EngineDiagnosticLog).delete()
    db.commit()
    return {"status": "cleared"}


# ----------------- 6. GitHub Auto-Deploy Webhook -----------------

WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "ah_wh_sec_49b821a7c03e8912")
DEPLOYER_URL = os.getenv("HOST_DEPLOYER_URL", "http://localhost:4534")
DEPLOYER_TOKEN = os.getenv("HOST_DEPLOYER_TOKEN", "ah_local_dep_f98231")

@router.post("/github-webhook")
async def github_webhook(request: Request):
    raw_body = await request.body()
    signature_header = request.headers.get("X-Hub-Signature-256")

    if WEBHOOK_SECRET and signature_header:
        expected_signature = "sha256=" + hmac.new(
            WEBHOOK_SECRET.encode("utf-8"),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected_signature, signature_header):
            raise HTTPException(status_code=403, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        payload = {}

    ref = payload.get("ref", "")
    if ref in ["refs/heads/master", "refs/heads/main"]:
        head_commit = payload.get("head_commit") or {}
        commit_info = {
            "message": head_commit.get("message", "Git push event"),
            "author": head_commit.get("author", {}).get("name", "GitHub"),
            "url": head_commit.get("url")
        }

        async def trigger_host():
            targets = [
                DEPLOYER_URL,
                "http://172.17.0.1:4534"
            ]
            async with httpx.AsyncClient(timeout=10.0) as client:
                for base in targets:
                    try:
                        url = f"{base}/deploy" if not base.endswith("/deploy") else base
                        res = await client.post(
                            url,
                            json={"commit": commit_info},
                            headers={"X-Deploy-Token": DEPLOYER_TOKEN}
                        )
                        if res.status_code == 200:
                            break
                    except Exception:
                        continue

        import asyncio
        asyncio.create_task(trigger_host())

        return {"status": "accepted", "message": "Deployment initiated on media server"}

    return {"status": "ignored", "ref": ref}


@router.post("/apk/upload")
async def upload_apk_file(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin)
):
    if not file.filename.lower().endswith(".apk"):
        raise HTTPException(status_code=400, detail="Only .apk files are supported")
    
    dest_path = settings.DOWNLOADS_DIR / "audiohub.apk"
    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)
    
    size_mb = round(len(content) / (1024 * 1024), 1)
    return {
        "status": "success",
        "message": f"Successfully uploaded {file.filename} ({size_mb} MB)",
        "filename": "audiohub.apk",
        "size_mb": size_mb,
        "download_url": "/api/v1/download/apk"
    }

