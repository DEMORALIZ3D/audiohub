from fastapi import APIRouter, Request, Depends, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any

from ...database import get_db
from ...models import User, Track, LikedSong, Playlist
from ...services.metadata import metadata_service
from ...services.audio_streamer import audio_streamer

router = APIRouter()

def get_subsonic_user(
    u: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> User:
    if u:
        user = db.query(User).filter(User.username == u.lower()).first()
        if user:
            return user
    admin = db.query(User).filter(User.username == "admin").first()
    return admin

def wrap_subsonic(data: Dict[str, Any], status: str = "ok") -> Dict[str, Any]:
    res = {
        "status": status,
        "version": "1.16.1",
        "type": "audiohub",
        "serverVersion": "1.0.0",
        "openSubsonic": True
    }
    res.update(data)
    return {"subsonic-response": res}

@router.get("/ping.view")
@router.get("/ping")
def ping():
    return wrap_subsonic({})

@router.get("/getLicense.view")
@router.get("/getLicense")
def get_license():
    return wrap_subsonic({
        "license": {
            "valid": True,
            "email": "user@audiohub.local",
            "licenseExpires": "2099-01-01T00:00:00.000Z"
        }
    })

@router.get("/getMusicFolders.view")
@router.get("/getMusicFolders")
def get_music_folders():
    return wrap_subsonic({
        "musicFolders": {
            "musicFolder": [{"id": 1, "name": "Music"}]
        }
    })

@router.get("/getIndexes.view")
@router.get("/getIndexes")
def get_indexes():
    return wrap_subsonic({
        "indexes": {
            "lastModified": 0,
            "ignoredArticles": "The El La Los Las Le Les",
            "index": []
        }
    })

@router.get("/search3.view")
@router.get("/search3")
async def search3(
    query: str = Query(..., description="Search query"),
    songCount: int = Query(25),
    db: Session = Depends(get_db)
):
    results = await metadata_service.search(query=query, limit=songCount)
    
    songs = []
    for t in results["tracks"]:
        songs.append({
            "id": t["id"],
            "title": t["title"],
            "artist": t["artist"],
            "album": t["album"] or "Single",
            "duration": t["duration_seconds"],
            "coverArt": t["id"],
            "contentType": "audio/mp4",
            "suffix": "m4a",
            "isDir": False,
            "isVideo": False
        })

    return wrap_subsonic({
        "searchResult3": {
            "song": songs
        }
    })

@router.get("/getStarred.view")
@router.get("/getStarred")
def get_starred(
    user: User = Depends(get_subsonic_user),
    db: Session = Depends(get_db)
):
    liked = (
        db.query(LikedSong, Track)
        .join(Track, LikedSong.track_id == Track.id)
        .filter(LikedSong.user_id == user.id)
        .all()
    )

    songs = []
    for l, t in liked:
        songs.append({
            "id": t.id,
            "title": t.title,
            "artist": t.artist,
            "album": t.album or "Single",
            "duration": t.duration_seconds,
            "coverArt": t.id,
            "starred": l.liked_at.isoformat(),
            "contentType": "audio/mp4",
            "suffix": "m4a",
            "isDir": False
        })

    return wrap_subsonic({
        "starred": {
            "song": songs
        }
    })

@router.get("/star.view")
@router.get("/star")
def star(
    id: str = Query(...),
    user: User = Depends(get_subsonic_user),
    db: Session = Depends(get_db)
):
    existing = db.query(LikedSong).filter(LikedSong.user_id == user.id, LikedSong.track_id == id).first()
    if not existing:
        db.add(LikedSong(user_id=user.id, track_id=id))
        db.commit()
    return wrap_subsonic({})

@router.get("/unstar.view")
@router.get("/unstar")
def unstar(
    id: str = Query(...),
    user: User = Depends(get_subsonic_user),
    db: Session = Depends(get_db)
):
    existing = db.query(LikedSong).filter(LikedSong.user_id == user.id, LikedSong.track_id == id).first()
    if existing:
        db.delete(existing)
        db.commit()
    return wrap_subsonic({})

@router.get("/getPlaylists.view")
@router.get("/getPlaylists")
def get_playlists(
    user: User = Depends(get_subsonic_user),
    db: Session = Depends(get_db)
):
    playlists = db.query(Playlist).filter(Playlist.user_id == user.id).all()
    out = []
    for p in playlists:
        out.append({
            "id": p.id,
            "name": p.name,
            "songCount": len(p.tracks),
            "duration": 0,
            "created": p.created_at.isoformat()
        })
    return wrap_subsonic({"playlists": {"playlist": out}})

@router.get("/stream.view")
@router.get("/stream")
async def stream_subsonic(
    id: str = Query(...),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """
    Subsonic streaming handler - delegates directly to audio_streamer
    """
    track = db.query(Track).filter(Track.id == id).first()
    if not track:
        source_type = "youtube" if id.startswith("yt_") else "deezer"
        source_id = id.replace("yt_", "").replace("dz_", "")
        track = Track(
            id=id,
            title="Unknown Track",
            artist="Unknown Artist",
            source_type=source_type,
            source_id=source_id,
            is_cached=False
        )
        db.add(track)
        db.commit()
        db.refresh(track)

    return await audio_streamer.stream_track(track, request, db)

@router.get("/getCoverArt.view")
@router.get("/getCoverArt")
def get_cover_art(
    id: str = Query(...),
    db: Session = Depends(get_db)
):
    track = db.query(Track).filter(Track.id == id).first()
    if track and track.cover_url:
        return RedirectResponse(url=track.cover_url)
    return Response(status_code=404)
