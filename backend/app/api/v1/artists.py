from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

from ...database import get_db
from ...services.metadata import metadata_service
from .auth import get_current_user
from ...models import User, LikedSong, FollowedArtist

router = APIRouter()

class FollowArtistPayload(BaseModel):
    name: Optional[str] = None
    picture_url: Optional[str] = None
    fan_count: Optional[int] = 0

@router.get("/library/followed")
async def get_followed_artists(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    List all artists followed by the user.
    """
    records = db.query(FollowedArtist).filter(FollowedArtist.user_id == user.id).order_by(FollowedArtist.followed_at.desc()).all()
    return [
        {
            "id": r.id,
            "artist_id": r.artist_id,
            "name": r.name,
            "picture_url": r.picture_url,
            "fan_count": r.fan_count,
            "followed_at": r.followed_at.isoformat() if r.followed_at else None
        }
        for r in records
    ]

@router.get("/{artist_id}")
async def get_artist_page(
    artist_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Fetch comprehensive artist page: header, top tracks, discography, and related artists.
    """
    data = await metadata_service.get_artist_details(artist_id)
    if not data or not data.get("name"):
        raise HTTPException(status_code=404, detail="Artist not found")

    followed = db.query(FollowedArtist).filter(FollowedArtist.user_id == user.id, FollowedArtist.artist_id == artist_id).first()
    data["is_followed"] = bool(followed)

    # Annotate liked songs
    track_ids = [t["id"] for t in data.get("top_tracks", [])]
    if track_ids:
        liked_ids = {
            item[0] for item in db.query(LikedSong.track_id).filter(
                LikedSong.user_id == user.id,
                LikedSong.track_id.in_(track_ids)
            ).all()
        }
        for t in data.get("top_tracks", []):
            t["is_liked"] = t["id"] in liked_ids

    return data

@router.post("/{artist_id}/follow")
async def follow_artist(
    artist_id: str,
    payload: Optional[FollowArtistPayload] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Follow an artist and save to user's library for quick access.
    """
    existing = db.query(FollowedArtist).filter(FollowedArtist.user_id == user.id, FollowedArtist.artist_id == artist_id).first()
    if existing:
        return {"status": "already_followed", "artist_id": artist_id}

    name = payload.name if payload and payload.name else None
    picture_url = payload.picture_url if payload and payload.picture_url else None
    fan_count = payload.fan_count if payload and payload.fan_count is not None else 0

    if not name:
        artist_data = await metadata_service.get_artist_details(artist_id)
        if artist_data:
            name = name or artist_data.get("name", f"Artist {artist_id}")
            picture_url = picture_url or artist_data.get("picture_url")
            fan_count = fan_count or artist_data.get("fan_count", 0)

    new_follow = FollowedArtist(
        user_id=user.id,
        artist_id=artist_id,
        name=name or f"Artist {artist_id}",
        picture_url=picture_url,
        fan_count=fan_count
    )
    db.add(new_follow)
    db.commit()
    return {"status": "followed", "artist_id": artist_id}

@router.delete("/{artist_id}/follow")
async def unfollow_artist(
    artist_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Unfollow an artist from user's library.
    """
    record = db.query(FollowedArtist).filter(FollowedArtist.user_id == user.id, FollowedArtist.artist_id == artist_id).first()
    if record:
        db.delete(record)
        db.commit()
    return {"status": "unfollowed", "artist_id": artist_id}

