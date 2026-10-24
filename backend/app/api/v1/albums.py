from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

from ...database import get_db
from ...services.metadata import metadata_service
from .auth import get_current_user
from ...models import User, Playlist, PlaylistTrack, Track, LikedSong, SavedAlbum

router = APIRouter()

class SaveAlbumPayload(BaseModel):
    playlist_id: str

class SaveToLibraryPayload(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    cover_url: Optional[str] = None
    track_count: Optional[int] = 0

@router.get("/library/saved")
async def get_saved_albums(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    List all albums saved to user's personal library.
    """
    records = db.query(SavedAlbum).filter(SavedAlbum.user_id == user.id).order_by(SavedAlbum.saved_at.desc()).all()
    return [
        {
            "id": r.id,
            "album_id": r.album_id,
            "title": r.title,
            "artist": r.artist,
            "cover_url": r.cover_url,
            "track_count": r.track_count,
            "saved_at": r.saved_at.isoformat() if r.saved_at else None
        }
        for r in records
    ]

@router.get("/{album_id}")
async def get_album_page(
    album_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Fetch album details and complete tracklist.
    """
    data = await metadata_service.get_album_details(album_id)
    if not data or not data.get("title"):
        raise HTTPException(status_code=404, detail="Album not found")

    saved = db.query(SavedAlbum).filter(SavedAlbum.user_id == user.id, SavedAlbum.album_id == album_id).first()
    data["is_saved"] = bool(saved)

    track_ids = [t["id"] for t in data["tracks"]]
    if track_ids:
        liked_ids = {
            item[0] for item in db.query(LikedSong.track_id).filter(
                LikedSong.user_id == user.id,
                LikedSong.track_id.in_(track_ids)
            ).all()
        }
        for t in data["tracks"]:
            t["is_liked"] = t["id"] in liked_ids

    return data

@router.post("/{album_id}/save")
async def save_album_to_library(
    album_id: str,
    payload: Optional[SaveToLibraryPayload] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save an album directly to the user's library for quick access.
    """
    existing = db.query(SavedAlbum).filter(SavedAlbum.user_id == user.id, SavedAlbum.album_id == album_id).first()
    if existing:
        return {"status": "already_saved", "album_id": album_id}

    title = payload.title if payload and payload.title else None
    artist = payload.artist if payload and payload.artist else None
    cover_url = payload.cover_url if payload and payload.cover_url else None
    track_count = payload.track_count if payload and payload.track_count is not None else 0

    if not title or not artist:
        album_data = await metadata_service.get_album_details(album_id)
        if album_data:
            title = title or album_data.get("title", f"Album {album_id}")
            artist = artist or album_data.get("artist", "Unknown Artist")
            cover_url = cover_url or album_data.get("cover_url")
            track_count = track_count or len(album_data.get("tracks", []))

    new_saved = SavedAlbum(
        user_id=user.id,
        album_id=album_id,
        title=title or f"Album {album_id}",
        artist=artist or "Unknown Artist",
        cover_url=cover_url,
        track_count=track_count
    )
    db.add(new_saved)
    db.commit()
    return {"status": "saved", "album_id": album_id}

@router.delete("/{album_id}/save")
async def unsave_album_from_library(
    album_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove a saved album from the user's library.
    """
    record = db.query(SavedAlbum).filter(SavedAlbum.user_id == user.id, SavedAlbum.album_id == album_id).first()
    if record:
        db.delete(record)
        db.commit()
    return {"status": "unsaved", "album_id": album_id}


@router.post("/{album_id}/save-to-playlist")
async def save_album_to_playlist(
    album_id: str,
    payload: SaveAlbumPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Append all tracks from an album directly to a custom playlist.
    """
    playlist = db.query(Playlist).filter(Playlist.id == payload.playlist_id, Playlist.user_id == user.id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    album_data = await metadata_service.get_album_details(album_id)
    tracks = album_data.get("tracks", [])
    if not tracks:
        raise HTTPException(status_code=400, detail="Album has no tracks")

    current_count = db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == playlist.id).count()

    for idx, t in enumerate(tracks):
        # Ensure track in db
        track = db.query(Track).filter(Track.id == t["id"]).first()
        if not track:
            track = Track(
                id=t["id"],
                title=t["title"],
                artist=t["artist"],
                album=t["album"],
                duration_seconds=t["duration_seconds"],
                cover_url=t["cover_url"],
                source_type=t["source_type"],
                source_id=t["source_id"],
                is_cached=False
            )
            db.add(track)
            db.commit()

        entry = PlaylistTrack(
            playlist_id=playlist.id,
            track_id=track.id,
            position=current_count + idx
        )
        db.add(entry)

    db.commit()
    return {"status": "saved", "added_tracks": len(tracks)}
