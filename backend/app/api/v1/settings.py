from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ...database import get_db
from ...models import User, SystemSetting
from ...config import settings
from ...services.storage_manager import storage_manager
from .admin import require_super_admin, require_admin

router = APIRouter()

class BrandingUpdate(BaseModel):
    appName: Optional[str] = None
    tagline: Optional[str] = None
    logoUrl: Optional[str] = None
    accentColor: Optional[str] = None

def _get_setting_val(db: Session, key: str, default: str) -> str:
    s = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    return s.value if s and s.value else default

def _set_setting_val(db: Session, key: str, value: str, desc: str = ""):
    s = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not s:
        s = SystemSetting(key=key, value=value, description=desc)
        db.add(s)
    else:
        s.value = value
    db.commit()

@router.get("/branding")
def get_branding(db: Session = Depends(get_db)):
    custom_logo_exists = any((settings.DATA_DIR / f"custom_logo{ext}").exists() for ext in [".png", ".svg", ".jpg", ".jpeg", ".webp"])
    default_logo = "/api/v1/settings/branding/logo" if custom_logo_exists else settings.BRAND_LOGO_URL
    return {
        "appName": _get_setting_val(db, "brand_name", settings.BRAND_NAME),
        "tagline": _get_setting_val(db, "brand_tagline", "homelab entertainment"),
        "logoUrl": _get_setting_val(db, "brand_logo_url", default_logo),
        "accentColor": _get_setting_val(db, "brand_accent_color", settings.BRAND_PRIMARY_COLOR),
    }

@router.put("/branding")
def update_branding(
    data: BrandingUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin)
):
    if data.appName is not None:
        clean_name = data.appName.strip() or "Audiohub - homelab entertainment"
        _set_setting_val(db, "brand_name", clean_name, "Server custom brand name")
    if data.tagline is not None:
        _set_setting_val(db, "brand_tagline", data.tagline.strip() or "homelab entertainment", "Server custom tagline")
    if data.logoUrl is not None:
        _set_setting_val(db, "brand_logo_url", data.logoUrl.strip(), "Server custom logo URL")
    if data.accentColor is not None:
        _set_setting_val(db, "brand_accent_color", data.accentColor.strip(), "Server custom accent color")
    
    return get_branding(db)

@router.post("/branding/logo")
async def upload_branding_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin)
):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in [".png", ".svg", ".jpg", ".jpeg", ".webp"]:
        raise HTTPException(status_code=400, detail="Supported image formats: PNG, SVG, JPG, WebP")
    
    # Remove previous custom logos
    for old_ext in [".png", ".svg", ".jpg", ".jpeg", ".webp"]:
        old_file = settings.DATA_DIR / f"custom_logo{old_ext}"
        if old_file.exists():
            try:
                old_file.unlink()
            except Exception:
                pass
    
    target_path = settings.DATA_DIR / f"custom_logo{suffix}"
    content = await file.read()
    with open(target_path, "wb") as f:
        f.write(content)
    
    logo_url = f"/api/v1/settings/branding/logo?v={int(target_path.stat().st_mtime)}"
    _set_setting_val(db, "brand_logo_url", logo_url, "Server custom logo URL")
    return get_branding(db)

@router.delete("/branding/logo")
def reset_branding_logo(
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin)
):
    for ext in [".png", ".svg", ".jpg", ".jpeg", ".webp"]:
        old_file = settings.DATA_DIR / f"custom_logo{ext}"
        if old_file.exists():
            try:
                old_file.unlink()
            except Exception:
                pass
    
    _set_setting_val(db, "brand_logo_url", settings.BRAND_LOGO_URL, "Server default logo URL")
    return get_branding(db)

@router.get("/branding/logo")
def get_branding_logo():
    for ext in [".png", ".svg", ".jpg", ".jpeg", ".webp"]:
        p = settings.DATA_DIR / f"custom_logo{ext}"
        if p.exists() and p.is_file():
            content_type = "image/svg+xml" if ext == ".svg" else f"image/{ext.replace('.', '')}"
            return FileResponse(path=str(p), media_type=content_type)
    
    # Fallback to default icon
    default_icon = settings.BASE_DIR / "frontend_dist" / "icon.svg"
    if default_icon.exists():
        return FileResponse(path=str(default_icon), media_type="image/svg+xml")
    raise HTTPException(status_code=404, detail="Default logo not found")

class ModeUpdate(BaseModel):
    mode: str

@router.get("/storage")
def get_storage_settings(
    db: Session = Depends(get_db)
):
    return storage_manager.get_stats(db)

@router.post("/storage/mode")
def update_storage_mode(
    data: ModeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    try:
        updated = storage_manager.set_storage_mode(data.mode, db)
        return {"status": "updated", "storage_mode": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/storage/clear-cache")
def clear_cache(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    count = storage_manager.clear_cache(db)
    return {"status": "cleared", "deleted_files": count}

from ...services.engine_updater import engine_updater

@router.get("/engine-versions")
def get_engine_versions():
    return engine_updater.get_installed_versions()

@router.post("/update-engines")
async def trigger_engine_update(
    current_user: User = Depends(require_super_admin)
):
    result = await engine_updater.update_engines()
    return result

