from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging

from .config import settings
from .database import engine, Base, SessionLocal
from sqlalchemy import text
from .models import User, SystemSetting
from .api.v1 import auth, search, stream, tracks, playlists, discovery, lyrics, settings as app_settings, slskd, artists, albums, admin, uploads, rooms, stats, connect, share, scanner, wrapped, setup
from .api.subsonic import rest as subsonic_rest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("audiohub")

# Create database tables
Base.metadata.create_all(bind=engine)

# Safe SQLite migrations and defaults initialization
def init_db_defaults():
    db = SessionLocal()
    try:
        # Run column additions if upgrading existing database
        migrations = [
            ("users", "email", "VARCHAR(128)"),
            ("users", "role", "VARCHAR(32) DEFAULT 'user'"),
            ("users", "is_under_13", "BOOLEAN DEFAULT 0"),
            ("users", "is_active", "BOOLEAN DEFAULT 1"),
            ("users", "last_login_at", "DATETIME"),
            ("tracks", "is_uploaded", "BOOLEAN DEFAULT 0"),
            ("tracks", "uploader_id", "VARCHAR(36)"),
            ("tracks", "is_private", "BOOLEAN DEFAULT 0"),
            ("users", "last_playback_state", "TEXT"),
        ]
        for table, col, col_def in migrations:
            try:
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def};"))
                db.commit()
            except Exception:
                db.rollback()


        # 1. Default storage mode setting
        setting = db.query(SystemSetting).filter(SystemSetting.key == "storage_mode").first()
        if not setting:
            db.add(SystemSetting(
                key="storage_mode",
                value=settings.DEFAULT_STORAGE_MODE,
                description="Storage caching mode (stream_only or stream_and_cache)"
            ))
            db.commit()

        # 2. Re-sync role/permissions if super admin exists
        super_admin = db.query(User).filter(User.role == "super_admin").first()
        if super_admin:
            super_admin.is_admin = True
            super_admin.is_active = True
            db.commit()

        # 3. Secure or deactivate old default admin if super admin exists
        old_admin = db.query(User).filter(User.username == "admin").first()
        if old_admin and super_admin and old_admin.id != super_admin.id:
            old_admin.is_active = False
            old_admin.is_admin = False
            old_admin.role = "user"
            db.commit()

    finally:
        db.close()

init_db_defaults()

app = FastAPI(
    title="AudioHub",
    description="Self-Hosted Personal & Family Music Streaming Server with Subsonic Compatibility",
    version="0.1.0"
)

# CORS setup for Web/PWA clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.middleware("http")
async def add_cache_control_header(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path in ["/", "/index.html", "/manifest.webmanifest"] or "sw.js" in path:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

import asyncio

@app.on_event("startup")
async def startup_event():
    from .database import run_migrations
    run_migrations()

    async def periodic_engine_updater():
        # Wait 30 seconds after boot before checking for updates
        await asyncio.sleep(30)
        while True:
            try:
                logger.info("Running background yt-dlp & ytmusicapi update check...")
                from .services.engine_updater import engine_updater
                res = await engine_updater.update_engines()
                logger.info(f"Engine update check completed: {res.get('versions')}")
            except Exception as e:
                logger.error(f"Error in engine auto-update task: {e}")
            # Check every 3 days (259200 seconds)
            await asyncio.sleep(259200)

    asyncio.create_task(periodic_engine_updater())

    async def cover_enricher_task():
        # Wait 4 seconds after boot before starting cover enrichment
        await asyncio.sleep(4)
        try:
            from .services.cover_resolver import cover_resolver
            from .database import SessionLocal
            await cover_resolver.run_enrichment(SessionLocal)
        except Exception as e:
            logger.error(f"Error in cover enricher startup task: {e}")

    asyncio.create_task(cover_enricher_task())

    async def periodic_playlist_updater():
        # Wait 45 seconds after boot before checking for auto-updating playlists
        await asyncio.sleep(45)
        while True:
            try:
                logger.info("Running daily background auto-playlist synchronization...")
                from .database import SessionLocal
                from .models import Playlist
                from .api.v1.playlists import sync_playlist_internal
                db = SessionLocal()
                try:
                    auto_playlists = db.query(Playlist).filter(
                        Playlist.auto_update == True,
                        Playlist.source_id.isnot(None)
                    ).all()
                    for p in auto_playlists:
                        try:
                            await sync_playlist_internal(p.id, db)
                            await asyncio.sleep(2) # Gentle pacing between sources
                        except Exception as pe:
                            logger.warning(f"Background sync failed for playlist {p.name} ({p.id}): {pe}")
                finally:
                    db.close()
                logger.info("Daily background auto-playlist synchronization complete.")
            except Exception as e:
                logger.error(f"Error in background playlist sync task: {e}")
            # Run every 24 hours (86400 seconds)
            await asyncio.sleep(86400)

    asyncio.create_task(periodic_playlist_updater())

@app.on_event("shutdown")
async def shutdown_event():
    try:
        from .services.http_client import close_http_client
        await close_http_client()
    except Exception as e:
        logger.warning(f"Error during shutdown: {e}")


# API v1 routes
app.include_router(setup.router, prefix="/api/v1/setup", tags=["Setup"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])
app.include_router(stream.router, prefix="/api/v1/stream", tags=["Stream"])
app.include_router(tracks.router, prefix="/api/v1/tracks", tags=["Tracks"])
app.include_router(playlists.router, prefix="/api/v1/playlists", tags=["Playlists"])
app.include_router(discovery.router, prefix="/api/v1/discovery", tags=["Discovery"])
app.include_router(lyrics.router, prefix="/api/v1/lyrics", tags=["Lyrics"])
app.include_router(app_settings.router, prefix="/api/v1/settings", tags=["Settings"])
app.include_router(slskd.router, prefix="/api/v1/slskd", tags=["Soulseek"])
app.include_router(artists.router, prefix="/api/v1/artists", tags=["Artists"])
app.include_router(albums.router, prefix="/api/v1/albums", tags=["Albums"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(uploads.router, prefix="/api/v1/uploads", tags=["Uploads"])
app.include_router(rooms.router, prefix="/api/v1/rooms", tags=["Rooms"])
app.include_router(stats.router, prefix="/api/v1/stats", tags=["Stats"])
app.include_router(connect.router, prefix="/api/v1/connect", tags=["Connect"])
app.include_router(share.router, prefix="/api/v1", tags=["Share & QR"])
app.include_router(scanner.router, prefix="/api/v1", tags=["Optical Album Scanner"])
app.include_router(wrapped.router, prefix="/api/v1/wrapped", tags=["Wrapped & Shorts"])


# Subsonic API compatibility endpoint for Symfonium
app.include_router(subsonic_rest.router, prefix="/rest", tags=["Subsonic API"])

@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "service": "audiohub"}



# Serve frontend static build if available
frontend_dist = Path(__file__).resolve().parent.parent / "frontend_dist"

@app.get("/api/v1/version")
def get_app_version():
    index_file = frontend_dist / "index.html"
    build_time = int(index_file.stat().st_mtime * 1000) if index_file.exists() else 0
    return {
        "version": "1.0.0",
        "build_time": build_time,
        "etag": hex(build_time)[2:] if build_time else "dev"
    }

# APK Download & Sideload Distribution
def _get_downloads_dirs():
    dirs = [settings.DOWNLOADS_DIR, settings.BASE_DIR / "data" / "downloads", Path("/data/downloads")]
    seen = set()
    res = []
    for d in dirs:
        try:
            p = Path(d).resolve()
            if p not in seen:
                seen.add(p)
                res.append(p)
        except Exception:
            pass
    return res

def find_apk_file():
    for d in _get_downloads_dirs():
        for candidate in ["audiohub.apk", "azify.apk", "app-release.apk", "app-debug.apk"]:
            p = d / candidate
            if p.exists() and p.is_file():
                return p
    return None

def find_tizen_file():
    for d in _get_downloads_dirs():
        for candidate in ["audiohub.wgt", "azify.wgt"]:
            p = d / candidate
            if p.exists() and p.is_file():
                return p
    return None

def find_webos_file():
    for d in _get_downloads_dirs():
        for candidate in ["audiohub.ipk", "azify.ipk", "audiohub_1.0.0_all.ipk"]:
            p = d / candidate
            if p.exists() and p.is_file():
                return p
    return None

@app.get("/api/v1/download/apk/info")
def get_apk_info():
    apk = find_apk_file()
    if apk:
        size_bytes = apk.stat().st_size
        return {
            "available": True,
            "filename": apk.name,
            "size_bytes": size_bytes,
            "size_mb": round(size_bytes / (1024 * 1024), 1),
            "updated_at": int(apk.stat().st_mtime * 1000),
            "download_url": "/api/v1/download/apk"
        }
    return {
        "available": False,
        "message": "APK sideload file not found in downloads folder.",
        "download_url": None
    }

@app.api_route("/api/v1/download/apk", methods=["GET", "HEAD"])
def download_apk():
    apk = find_apk_file()
    if not apk:
        raise HTTPException(status_code=404, detail="AudioHub APK file has not been uploaded yet.")
    return FileResponse(
        path=str(apk),
        media_type="application/vnd.android.package-archive",
        filename=apk.name if apk else "audiohub.apk"
    )

@app.api_route("/azify.apk", methods=["GET", "HEAD"])
def download_azify_apk_direct():
    return download_apk()

@app.api_route("/audiohub.apk", methods=["GET", "HEAD"])
def download_apk_direct():
    return download_apk()

@app.get("/api/v1/download/apps")
def get_companion_apps_info():
    apk = find_apk_file()
    wgt = find_tizen_file()
    ipk = find_webos_file()
    return {
        "android": {
            "available": bool(apk),
            "filename": apk.name if apk else None,
            "size_mb": round(apk.stat().st_size / (1024 * 1024), 2) if apk else None,
            "download_url": "/api/v1/download/apk" if apk else None
        },
        "tizen": {
            "available": bool(wgt),
            "filename": wgt.name if wgt else None,
            "size_mb": round(wgt.stat().st_size / (1024 * 1024), 2) if wgt else None,
            "download_url": "/api/v1/download/tizen" if wgt else None
        },
        "webos": {
            "available": bool(ipk),
            "filename": ipk.name if ipk else None,
            "size_mb": round(ipk.stat().st_size / (1024 * 1024), 2) if ipk else None,
            "download_url": "/api/v1/download/webos" if ipk else None
        }
    }

@app.api_route("/api/v1/download/tizen", methods=["GET", "HEAD"])
def download_tizen_wgt():
    wgt = find_tizen_file()
    if not wgt:
        raise HTTPException(status_code=404, detail="Samsung Tizen .wgt package not found.")
    return FileResponse(
        path=str(wgt),
        media_type="application/widget",
        filename=wgt.name
    )

@app.api_route("/audiohub.wgt", methods=["GET", "HEAD"])
@app.api_route("/azify.wgt", methods=["GET", "HEAD"])
def download_tizen_direct():
    return download_tizen_wgt()

@app.api_route("/api/v1/download/webos", methods=["GET", "HEAD"])
def download_webos_ipk():
    ipk = find_webos_file()
    if not ipk:
        raise HTTPException(status_code=404, detail="LG webOS .ipk package not found.")
    return FileResponse(
        path=str(ipk),
        media_type="application/octet-stream",
        filename=ipk.name
    )

@app.api_route("/audiohub.ipk", methods=["GET", "HEAD"])
@app.api_route("/azify.ipk", methods=["GET", "HEAD"])
def download_webos_direct():
    return download_webos_ipk()

# SPA Fallback for client-side routing on refresh (e.g. /liked, /playlist/123, /settings)
@app.exception_handler(404)
async def spa_404_fallback(request: Request, _exc: StarletteHTTPException):
    path = request.url.path
    if request.method in ["GET", "HEAD"] and not path.startswith(("/api", "/rest", "/assets")):
        index_file = frontend_dist / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
    return Response(content="Not Found", status_code=404)

class CacheControlledStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            req_path = scope.get("path", "")
            if "/assets/" in req_path or path.startswith("assets/"):
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            elif path.endswith(".html") or path == "" or path == "/":
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            else:
                response.headers["Cache-Control"] = "public, max-age=86400"
        return response

if frontend_dist.exists():
    app.mount("/", CacheControlledStaticFiles(directory=str(frontend_dist), html=True), name="frontend")
else:
    @app.get("/")
    def index():
        return {
            "name": "AudioHub Server",
            "status": "online",
            "version": "0.1.0",
            "docs": "/docs",
            "subsonic_endpoint": "/rest/ping.view"
        }
