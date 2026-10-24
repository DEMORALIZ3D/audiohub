from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ...database import get_db
from ...models import User, SystemSetting
from ...config import settings
from .auth import hash_password

router = APIRouter()


class SetupRequest(BaseModel):
    app_name: Optional[str] = "AudioHub"
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    accent_color: Optional[str] = "#1ed760"
    username: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    password: str


def _set_setting(db: Session, key: str, value: Optional[str], desc: str = ""):
    if value is None:
        return
    s = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not s:
        s = SystemSetting(key=key, value=str(value), description=desc)
        db.add(s)
    else:
        s.value = str(value)


@router.get("/status")
def get_setup_status(db: Session = Depends(get_db)):
    """
    Check if the initial instance setup is completed or required.
    """
    count = db.query(User).count()
    app_setting = db.query(SystemSetting).filter(
        SystemSetting.key.in_(["app_name", "brand_name"])
    ).first()
    current_app_name = (
        app_setting.value if app_setting and app_setting.value else (settings.BRAND_NAME or "AudioHub")
    )
    if not current_app_name:
        current_app_name = "AudioHub"

    return {
        "is_configured": count > 0,
        "setup_required": count == 0,
        "app_name": current_app_name
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def perform_setup(data: SetupRequest, db: Session = Depends(get_db)):
    """
    First-run instance setup wizard.
    Creates initial super administrator and sets custom instance branding.
    Forbidden if any user already exists.
    """
    user_count = db.query(User).count()
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Setup already completed. Please log in."
        )

    clean_username = data.username.strip().lower()
    if not clean_username or len(clean_username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters."
        )

    if not data.password or len(data.password.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required."
        )

    clean_email = data.email.strip().lower() if data.email and data.email.strip() else None
    display_name = (
        data.display_name.strip()
        if data.display_name and data.display_name.strip()
        else data.username.strip()
    )

    # Save branding settings
    app_name = data.app_name.strip() if data.app_name and data.app_name.strip() else "AudioHub"
    accent = data.accent_color.strip() if data.accent_color and data.accent_color.strip() else "#1ed760"
    tagline = data.tagline.strip() if data.tagline else ""
    logo_url = data.logo_url.strip() if data.logo_url else ""

    _set_setting(db, "app_name", app_name, "Instance application name")
    _set_setting(db, "brand_name", app_name, "Server custom brand name")
    if tagline:
        _set_setting(db, "tagline", tagline, "Instance tagline")
        _set_setting(db, "brand_tagline", tagline, "Server custom tagline")
    if logo_url:
        _set_setting(db, "logo_url", logo_url, "Instance logo URL")
        _set_setting(db, "brand_logo_url", logo_url, "Server custom logo URL")
    _set_setting(db, "accent_color", accent, "Instance accent color")
    _set_setting(db, "brand_accent_color", accent, "Server custom accent color")

    # Create initial Super Admin
    super_admin = User(
        username=clean_username,
        email=clean_email,
        password_hash=hash_password(data.password),
        display_name=display_name,
        role="super_admin",
        is_admin=True,
        is_under_13=False,
        is_active=True
    )
    db.add(super_admin)
    db.commit()
    db.refresh(super_admin)

    return {
        "status": "completed",
        "user": {
            "id": super_admin.id,
            "username": super_admin.username,
            "email": super_admin.email,
            "display_name": super_admin.display_name,
            "role": super_admin.role,
            "is_admin": super_admin.is_admin,
            "is_under_13": super_admin.is_under_13,
            "is_active": super_admin.is_active,
        },
        "token": super_admin.id
    }
