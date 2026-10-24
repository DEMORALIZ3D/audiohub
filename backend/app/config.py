import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    APP_NAME: str = "AudioHub"
    DEBUG: bool = False
    SECRET_KEY: str = os.getenv("SECRET_KEY", "audiohub-super-secret-key-change-in-prod")
    HOST: str = "0.0.0.0"
    PORT: int = int(os.getenv("PORT", "4533"))

    # Branding Configuration (Configurable for easy future rebrand)
    BRAND_NAME: str = os.getenv("BRAND_NAME", "Audiohub - homelab entertainment")
    BRAND_LOGO_URL: str = os.getenv("BRAND_LOGO_URL", "/icon.svg")
    BRAND_PRIMARY_COLOR: str = os.getenv("BRAND_PRIMARY_COLOR", "#10b981")
    BRAND_ACCENT_COLOR: str = os.getenv("BRAND_ACCENT_COLOR", "#047857")

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
    MUSIC_DIR: Path = Path(os.getenv("MUSIC_DIR", str(DATA_DIR / "music")))
    CACHE_DIR: Path = Path(os.getenv("CACHE_DIR", str(DATA_DIR / "cache")))
    TEMP_DIR: Path = Path(os.getenv("TEMP_DIR", str(DATA_DIR / "temp")))
    EXPORTS_DIR: Path = Path(os.getenv("EXPORTS_DIR", str(DATA_DIR / "exports")))
    DOWNLOADS_DIR: Path = Path(os.getenv("DOWNLOADS_DIR", str(DATA_DIR / "downloads")))

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"sqlite:///{DATA_DIR}/audiohub.db"
    )

    # Storage Mode: "stream_only" or "stream_and_cache"
    # When stream_only, audio is proxied with zero permanent disk footprint.
    # When stream_and_cache, audio is streamed instantly while saving to disk in background.
    DEFAULT_STORAGE_MODE: str = os.getenv("STORAGE_MODE", "stream_only")
    MAX_CACHE_GB: float = float(os.getenv("MAX_CACHE_GB", "25.0"))

    # External APIs (Optional)
    SPOTIFY_CLIENT_ID: str = os.getenv("SPOTIFY_CLIENT_ID", "")
    SPOTIFY_CLIENT_SECRET: str = os.getenv("SPOTIFY_CLIENT_SECRET", "")
    LASTFM_API_KEY: str = os.getenv("LASTFM_API_KEY", "")

    # Soulseek (slskd) Integration
    ENABLE_SOULSEEK: bool = os.getenv("ENABLE_SOULSEEK", "false").lower() == "true"
    SLSKD_URL: str = os.getenv("SLSKD_URL", "http://localhost:5030")
    SLSKD_API_KEY: str = os.getenv("SLSKD_API_KEY", "")

    # powQR Dynamic QR Code Service
    POWQR_API_KEY: str = os.getenv("POWQR_API_KEY", "")
    POWQR_API_URL: str = os.getenv("POWQR_API_URL", "https://api.powqr.com")

    # Laya Decision API
    LAYA_API_KEY: str = os.getenv("LAYA_API_KEY", "")
    LAYA_API_URL: str = os.getenv("LAYA_API_URL", "https://api.laya.ai")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Ensure data directories exist
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.MUSIC_DIR.mkdir(parents=True, exist_ok=True)
settings.CACHE_DIR.mkdir(parents=True, exist_ok=True)
settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)
settings.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
settings.DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
