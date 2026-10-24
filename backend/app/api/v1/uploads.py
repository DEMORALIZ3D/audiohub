import os
import shutil
import uuid
import httpx
import logging
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ...config import settings
from ...database import get_db
from ...models import User, Track, LikedSong, UserActivityLog, utc_now
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOADS_DIR = settings.MUSIC_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

class SaveUploadReq(BaseModel):
    temp_file_id: str
    title: str
    artist: str
    album: Optional[str] = None
    cover_url: Optional[str] = None
    is_private: bool = True  # True = private to uploader, False = shared with family

@router.post("/inspect")
async def inspect_uploaded_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Accept an uploaded audio file (.mp3, .wav, .m4a, .flac, .ogg),
    inspect embedded tags using mutagen, and return candidate metadata.
    """
    ext = Path(file.filename or "song.mp3").suffix.lower()
    if ext not in [".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac"]:
        raise HTTPException(status_code=400, detail="Unsupported audio format. Supported: MP3, M4A, WAV, FLAC, OGG")

    temp_id = f"upl_{uuid.uuid4().hex[:12]}{ext}"
    temp_path = settings.TEMP_DIR / temp_id

    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    title = Path(file.filename or "My Song").stem
    artist = current_user.display_name or current_user.username
    album = "AI & Original Creations"
    duration = 0

    # Inspect embedded audio tags with mutagen
    try:
        from mutagen import File as MutagenFile
        audio = MutagenFile(str(temp_path))
        if audio:
            if audio.info and hasattr(audio.info, "length"):
                duration = int(audio.info.length)
            
            # Common tag extractors
            tags = getattr(audio, "tags", None) or {}
            if "TIT2" in tags:
                title = str(tags["TIT2"])
            elif "\xa9nam" in tags:
                title = str(tags["\xa9nam"][0])
            elif "title" in tags:
                title = str(tags["title"][0])

            if "TPE1" in tags:
                artist = str(tags["TPE1"])
            elif "\xa9ART" in tags:
                artist = str(tags["\xa9ART"][0])
            elif "artist" in tags:
                artist = str(tags["artist"][0])

            if "TALB" in tags:
                album = str(tags["TALB"])
            elif "\xa9alb" in tags:
                album = str(tags["\xa9alb"][0])
            elif "album" in tags:
                album = str(tags["album"][0])
    except Exception as e:
        logger.warning(f"Could not parse ID3 tags from upload: {e}")

    return {
        "temp_file_id": temp_id,
        "title": title,
        "artist": artist,
        "album": album,
        "duration_seconds": duration,
        "original_filename": file.filename,
        "file_size_bytes": len(content)
    }

@router.get("/match-metadata")
async def match_metadata(query: str = Query(..., min_length=2)):
    """
    Search Deezer public catalog to auto-fill metadata for an uploaded song.
    """
    results = []
    try:
        from ...services.http_client import get_http_client
        client = get_http_client()
        resp = await client.get(f"https://api.deezer.com/search?q={query}&limit=6")
        if resp.status_code == 200:
            data = resp.json().get("data", [])
            for d in data:
                results.append({
                    "title": d.get("title"),
                    "artist": d.get("artist", {}).get("name"),
                    "album": d.get("album", {}).get("title"),
                    "cover_url": d.get("album", {}).get("cover_xl") or d.get("album", {}).get("cover_medium"),
                    "duration_seconds": d.get("duration", 0)
                })
    except Exception as e:
        logger.warning(f"Metadata auto-search failed: {e}")

    return results

@router.post("/save")
async def save_uploaded_audio(
    file: Optional[UploadFile] = File(None),
    temp_file_id: Optional[str] = Form(None),
    title: str = Form(...),
    artist: str = Form(...),
    album: Optional[str] = Form(None),
    cover_url: Optional[str] = Form(None),
    is_private: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finalize audio upload: move from temp or upload directly,
    embed metadata, and register in database.
    """
    ext = ".mp3"
    track_id = f"upl_{uuid.uuid4().hex[:12]}"
    user_upload_dir = UPLOADS_DIR / current_user.id
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    clean_name = "".join(c for c in f"{artist} - {title}" if c.isalnum() or c in " .-_").strip()

    if file:
        ext = Path(file.filename or "song.mp3").suffix.lower()
        dest_path = user_upload_dir / f"{clean_name}_{track_id}{ext}"
        content = await file.read()
        with open(dest_path, "wb") as f:
            f.write(content)
        file_size = len(content)
    elif temp_file_id:
        temp_path = settings.TEMP_DIR / temp_file_id
        if not temp_path.exists():
            raise HTTPException(status_code=404, detail="Upload temporary file expired or not found")
        ext = temp_path.suffix.lower()
        dest_path = user_upload_dir / f"{clean_name}_{track_id}{ext}"
        shutil.move(str(temp_path), str(dest_path))
        file_size = dest_path.stat().st_size
    else:
        raise HTTPException(status_code=400, detail="Missing audio file or temporary upload ID")

    # Duration check
    duration = 0
    try:
        from mutagen import File as MutagenFile
        audio = MutagenFile(str(dest_path))
        if audio and audio.info and hasattr(audio.info, "length"):
            duration = int(audio.info.length)
    except Exception:
        pass

    new_track = Track(
        id=track_id,
        title=title.strip(),
        artist=artist.strip(),
        album=album.strip() if album else "AI & Original Creations",
        duration_seconds=duration,
        cover_url=cover_url.strip() if cover_url else None,
        source_type="upload",
        source_id=track_id,
        local_path=str(dest_path),
        is_cached=True,
        is_uploaded=True,
        uploader_id=current_user.id,
        is_private=is_private,
        file_size_bytes=file_size,
        created_at=utc_now()
    )
    db.add(new_track)

    # Automatically add to user's Liked Songs
    db.add(LikedSong(
        user_id=current_user.id,
        track_id=new_track.id,
        liked_at=utc_now()
    ))

    # Log activity
    db.add(UserActivityLog(
        user_id=current_user.id,
        username=current_user.username,
        action="upload",
        details=f"Uploaded '{new_track.artist} - {new_track.title}' (Private: {new_track.is_private})"
    ))
    db.commit()
    db.refresh(new_track)

    return {
        "id": new_track.id,
        "title": new_track.title,
        "artist": new_track.artist,
        "album": new_track.album,
        "cover_url": new_track.cover_url,
        "duration_seconds": new_track.duration_seconds,
        "is_uploaded": True,
        "is_private": new_track.is_private,
        "is_liked": True,
        "source_type": new_track.source_type
    }

@router.get("/my-uploads")
def get_my_uploads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all music tracks uploaded by the current user.
    """
    tracks = db.query(Track).filter(
        Track.is_uploaded == True,
        Track.uploader_id == current_user.id
    ).order_by(Track.created_at.desc()).all()

    return [
        {
            "id": t.id,
            "title": t.title,
            "artist": t.artist,
            "album": t.album,
            "duration_seconds": t.duration_seconds,
            "cover_url": t.cover_url,
            "is_uploaded": True,
            "is_private": t.is_private,
            "is_liked": True,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "file_size_bytes": t.file_size_bytes
        }
        for t in tracks
    ]

@router.delete("/{track_id}")
def delete_uploaded_track(
    track_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Only uploader or admin can delete
    if track.uploader_id != current_user.id and current_user.role not in ["admin", "super_admin"] and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Permission denied")

    # Remove file from disk
    if track.local_path and os.path.exists(track.local_path):
        try:
            os.remove(track.local_path)
        except Exception as e:
            logger.warning(f"Could not remove upload file: {e}")

    db.delete(track)
    db.commit()
    return {"status": "deleted", "track_id": track_id}
