import shutil
import logging
from typing import Dict, Any
from sqlalchemy.orm import Session
from ..config import settings
from ..models import SystemSetting, Track

logger = logging.getLogger(__name__)

class StorageManager:
    def get_stats(self, db: Session) -> Dict[str, Any]:
        """
        Get disk space stats and cache breakdown.
        """
        # Disk usage for data dir
        total, used, free = shutil.disk_usage(settings.DATA_DIR)

        # Calculate cached music size
        cache_size = 0
        cached_count = 0
        if settings.MUSIC_DIR.exists():
            for p in settings.MUSIC_DIR.rglob("*"):
                if p.is_file():
                    cache_size += p.stat().st_size
                    cached_count += 1

        # Current storage mode
        mode_setting = db.query(SystemSetting).filter(SystemSetting.key == "storage_mode").first()
        storage_mode = mode_setting.value if mode_setting else settings.DEFAULT_STORAGE_MODE

        return {
            "storage_mode": storage_mode,
            "cached_tracks_count": cached_count,
            "cached_size_mb": round(cache_size / (1024 * 1024), 2),
            "disk_free_gb": round(free / (1024 * 1024 * 1024), 2),
            "disk_total_gb": round(total / (1024 * 1024 * 1024), 2),
            "max_cache_gb": settings.MAX_CACHE_GB,
        }

    def set_storage_mode(self, mode: str, db: Session) -> str:
        """
        Toggle between 'stream_only' and 'stream_and_cache'.
        """
        if mode not in ["stream_only", "stream_and_cache"]:
            raise ValueError("Invalid mode. Must be 'stream_only' or 'stream_and_cache'")

        setting = db.query(SystemSetting).filter(SystemSetting.key == "storage_mode").first()
        if not setting:
            setting = SystemSetting(key="storage_mode", value=mode, description="Storage caching mode")
            db.add(setting)
        else:
            setting.value = mode
        db.commit()
        return mode

    def clear_cache(self, db: Session) -> int:
        """
        Delete streaming cache files and mark non-uploaded tracks as not cached.
        Uploaded songs in settings.MUSIC_DIR / "uploads" are strictly preserved.
        """
        deleted_count = 0
        uploads_dir = settings.MUSIC_DIR / "uploads"
        if settings.MUSIC_DIR.exists():
            for p in settings.MUSIC_DIR.rglob("*"):
                # Do not delete files in uploads folder
                if uploads_dir in p.parents or p == uploads_dir:
                    continue
                if p.is_file():
                    try:
                        p.unlink()
                        deleted_count += 1
                    except Exception as e:
                        logger.warning(f"Failed to delete {p}: {e}")

        # Update DB for streamed/cached tracks only
        db.query(Track).filter(Track.is_uploaded == False).update({
            Track.is_cached: False,
            Track.local_path: None,
            Track.file_size_bytes: 0
        })
        db.commit()
        return deleted_count

storage_manager = StorageManager()
