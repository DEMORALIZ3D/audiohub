import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ...database import get_db
from ...models import User, Track, ListeningHistory
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/me")
def get_personal_listening_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns personal listening statistics for the authenticated user ("AudioHub Wrapped").
    Includes total plays, total listening time, top tracks, top artists, and recent listening history.
    """
    user_id = current_user.id

    # 1. Consolidated single-pass aggregate for totals and unique metrics
    stats_row = (
        db.query(
            func.count(ListeningHistory.id).label("total_plays"),
            func.sum(func.coalesce(func.nullif(Track.duration_seconds, 0), 180)).label("total_duration"),
            func.count(func.distinct(ListeningHistory.track_id)).label("unique_tracks"),
            func.count(func.distinct(func.nullif(Track.artist, ""))).label("unique_artists")
        )
        .outerjoin(Track, ListeningHistory.track_id == Track.id)
        .filter(ListeningHistory.user_id == user_id)
        .first()
    )

    total_plays = stats_row.total_plays if stats_row and stats_row.total_plays else 0
    total_duration_seconds = int(stats_row.total_duration or 0) if stats_row else 0
    total_duration_minutes = round(total_duration_seconds / 60, 1)
    total_duration_hours = round(total_duration_seconds / 3600, 1)
    unique_tracks = stats_row.unique_tracks if stats_row and stats_row.unique_tracks else 0
    unique_artists = stats_row.unique_artists if stats_row and stats_row.unique_artists else 0

    # 4. Top 10 tracks
    top_track_query = (
        db.query(Track, func.count(ListeningHistory.id).label("play_count"))
        .join(ListeningHistory, ListeningHistory.track_id == Track.id)
        .filter(ListeningHistory.user_id == user_id)
        .group_by(Track.id)
        .order_by(func.count(ListeningHistory.id).desc())
        .limit(10)
        .all()
    )
    top_tracks = [
        {
            "track": {
                "id": t.id,
                "title": t.title,
                "artist": t.artist,
                "album": t.album,
                "duration_seconds": t.duration_seconds,
                "cover_url": t.cover_url,
                "source_type": t.source_type,
                "source_id": t.source_id,
                "is_uploaded": t.is_uploaded,
                "is_private": t.is_private,
            },
            "play_count": count
        }
        for t, count in top_track_query
    ]

    # 5. Top 10 artists
    top_artist_query = (
        db.query(Track.artist, func.count(ListeningHistory.id).label("play_count"))
        .join(ListeningHistory, ListeningHistory.track_id == Track.id)
        .filter(ListeningHistory.user_id == user_id, Track.artist != None, Track.artist != "")
        .group_by(Track.artist)
        .order_by(func.count(ListeningHistory.id).desc())
        .limit(10)
        .all()
    )
    top_artists = [
        {"artist": artist, "play_count": count}
        for artist, count in top_artist_query
    ]

    # 6. Recent 20 played tracks
    recent_query = (
        db.query(ListeningHistory, Track)
        .join(Track, ListeningHistory.track_id == Track.id)
        .filter(ListeningHistory.user_id == user_id)
        .order_by(ListeningHistory.played_at.desc())
        .limit(20)
        .all()
    )
    recent_history = [
        {
            "track": {
                "id": t.id,
                "title": t.title,
                "artist": t.artist,
                "album": t.album,
                "duration_seconds": t.duration_seconds,
                "cover_url": t.cover_url,
                "source_type": t.source_type,
                "source_id": t.source_id,
                "is_uploaded": t.is_uploaded,
                "is_private": t.is_private,
            },
            "played_at": h.played_at.isoformat() if h.played_at else ""
        }
        for h, t in recent_query
    ]

    return {
        "total_plays": total_plays,
        "total_duration_minutes": total_duration_minutes,
        "total_duration_hours": total_duration_hours,
        "unique_tracks": unique_tracks,
        "unique_artists": unique_artists,
        "top_tracks": top_tracks,
        "top_artists": top_artists,
        "recent_history": recent_history,
    }
