from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from ...database import get_db
from ...models import User, Track, LikedSong, ListeningHistory, utc_now
from .auth import get_current_user

router = APIRouter()

class TrackCreateOrUpdate(BaseModel):
    id: str
    title: str
    artist: str
    album: Optional[str] = ""
    duration_seconds: Optional[int] = 0
    cover_url: Optional[str] = ""
    source_type: Optional[str] = "youtube"
    source_id: Optional[str] = ""

@router.post("/ensure", response_model=Dict[str, Any])
def ensure_track(
    data: TrackCreateOrUpdate,
    db: Session = Depends(get_db)
):
    """
    Ensure track metadata exists in database before liking or adding to playlist.
    """
    track = db.query(Track).filter(Track.id == data.id).first()
    if not track:
        track = Track(
            id=data.id,
            title=data.title,
            artist=data.artist,
            album=data.album,
            duration_seconds=data.duration_seconds,
            cover_url=data.cover_url,
            source_type=data.source_type,
            source_id=data.source_id or data.id.replace("yt_", "").replace("dz_", ""),
            is_cached=False
        )
        try:
            db.add(track)
            db.commit()
            db.refresh(track)
        except Exception:
            db.rollback()
            track = db.query(Track).filter(Track.id == data.id).first()
    else:
        # If existing record had Unknown Track or Unknown Artist, heal it with incoming metadata
        needs_repair = not track.title or track.title == "Unknown Track" or not track.artist or track.artist == "Unknown Artist"
        if needs_repair and data.title and data.title != "Unknown Track":
            track.title = data.title
            if data.artist and data.artist != "Unknown Artist":
                track.artist = data.artist
            if data.album:
                track.album = data.album
            if data.cover_url:
                track.cover_url = data.cover_url
            if track.source_id in ["QQp0uV11d1g", "PzsCRfat_QQ"]:
                track.source_type = data.source_type or ("deezer" if track.id.startswith("dz_") else "youtube")
                track.source_id = data.source_id or track.id.replace("dz_", "").replace("yt_", "")
            db.commit()
            db.refresh(track)
    return {
        "id": track.id,
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "duration_seconds": track.duration_seconds,
        "cover_url": track.cover_url,
        "is_cached": track.is_cached
    }

@router.get("/resolve-share")
async def resolve_shared_url(
    query: str,
    db: Session = Depends(get_db)
):
    """
    Resolve a shared link from YouTube, Spotify, or Deezer into a playable Track,
    and automatically ensure it in the local database.
    """
    from ...services.metadata import metadata_service
    track_dict = await metadata_service.resolve_shared_track(query)
    if not track_dict:
        raise HTTPException(status_code=400, detail="Could not resolve shared track link")

    # Ensure track in database
    track = db.query(Track).filter(Track.id == track_dict["id"]).first()
    if not track:
        track = Track(
            id=track_dict["id"],
            title=track_dict["title"],
            artist=track_dict["artist"],
            album=track_dict.get("album", ""),
            duration_seconds=track_dict.get("duration_seconds", 0),
            cover_url=track_dict.get("cover_url", ""),
            source_type=track_dict.get("source_type", "youtube"),
            source_id=track_dict.get("source_id", ""),
            is_cached=False
        )
        try:
            db.add(track)
            db.commit()
            db.refresh(track)
        except Exception:
            db.rollback()
            track = db.query(Track).filter(Track.id == track_dict["id"]).first()

    return track_dict

@router.post("/{track_id}/like")
def toggle_like(
    track_id: str,
    track_data: Optional[TrackCreateOrUpdate] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Toggle like status on a track (Heart button).
    """
    # Ensure track exists in database
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track and track_data:
        track = Track(
            id=track_id,
            title=track_data.title,
            artist=track_data.artist,
            album=track_data.album,
            duration_seconds=track_data.duration_seconds,
            cover_url=track_data.cover_url,
            source_type=track_data.source_type,
            source_id=track_data.source_id or track_id.replace("yt_", "").replace("dz_", ""),
            is_cached=False
        )
        try:
            db.add(track)
            db.commit()
        except Exception:
            db.rollback()
            track = db.query(Track).filter(Track.id == track_id).first()
    elif track and track_data and (track.title == "Unknown Track" or not track.title):
        track.title = track_data.title
        track.artist = track_data.artist
        if track_data.album:
            track.album = track_data.album
        if track_data.duration_seconds:
            track.duration_seconds = track_data.duration_seconds
        if track_data.cover_url:
            track.cover_url = track_data.cover_url
        db.commit()

    liked = db.query(LikedSong).filter(
        LikedSong.user_id == user.id,
        LikedSong.track_id == track_id
    ).first()

    # Also match across sources if track was liked with another ID (e.g. dz_ vs yt_)
    if not liked and track and track.title and track.artist:
        liked = (
            db.query(LikedSong)
            .join(Track, LikedSong.track_id == Track.id)
            .filter(
                LikedSong.user_id == user.id,
                Track.title.ilike(track.title.strip()),
                Track.artist.ilike(track.artist.strip())
            )
            .first()
        )

    if liked:
        db.delete(liked)
        db.commit()
        return {"track_id": track_id, "is_liked": False}
    else:
        new_liked = LikedSong(user_id=user.id, track_id=track_id)
        db.add(new_liked)
        db.commit()
        return {"track_id": track_id, "is_liked": True}

@router.get("/liked")
def get_liked_songs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch all liked songs for the current user ("Liked Songs" master playlist).
    """
    liked = (
        db.query(LikedSong, Track)
        .join(Track, LikedSong.track_id == Track.id)
        .filter(LikedSong.user_id == user.id)
        .order_by(LikedSong.liked_at.desc())
        .all()
    )

    songs = []
    for l, t in liked:
        songs.append({
            "id": t.id,
            "title": t.title,
            "artist": t.artist,
            "album": t.album,
            "duration_seconds": t.duration_seconds,
            "cover_url": t.cover_url,
            "source_type": t.source_type,
            "source_id": t.source_id,
            "is_cached": t.is_cached,
            "is_liked": True,
            "liked_at": l.liked_at.isoformat()
        })
    return songs

@router.post("/liked/reverse")
def reverse_liked_songs_order(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reverse the order of the user's liked songs library.
    """
    liked_entries = (
        db.query(LikedSong)
        .filter(LikedSong.user_id == user.id)
        .order_by(LikedSong.liked_at.asc())
        .all()
    )
    if not liked_entries:
        return {"status": "ok", "count": 0}

    from datetime import datetime, timezone, timedelta
    base_time = datetime.now(timezone.utc)
    for idx, entry in enumerate(liked_entries):
        entry.liked_at = base_time - timedelta(seconds=idx)
    db.commit()
    return {"status": "ok", "count": len(liked_entries)}

class BatchTrackDeleteReq(BaseModel):
    track_ids: List[str]

@router.post("/liked/batch-delete")
def batch_delete_liked_songs(
    data: BatchTrackDeleteReq,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete multiple selected tracks from user's Liked Songs.
    """
    if not data.track_ids:
        return {"status": "ok", "deleted_count": 0}

    deleted = (
        db.query(LikedSong)
        .filter(LikedSong.user_id == user.id, LikedSong.track_id.in_(data.track_ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"status": "ok", "deleted_count": deleted}

@router.post("/liked/clear")
def clear_all_liked_songs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Clear all tracks from user's Liked Songs library.
    """
    deleted = (
        db.query(LikedSong)
        .filter(LikedSong.user_id == user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"status": "ok", "deleted_count": deleted}


@router.post("/enrich-covers")
async def trigger_cover_enrichment(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger background resolution of missing album covers for tracks.
    """
    from ...services.cover_resolver import cover_resolver
    from ...database import SessionLocal
    import asyncio
    asyncio.create_task(cover_resolver.run_enrichment(SessionLocal))
    return {"status": "started", "details": cover_resolver.get_status()}


@router.get("/enrich-covers/status")
def get_cover_enrichment_status(
    user: User = Depends(get_current_user)
):
    from ...services.cover_resolver import cover_resolver
    return cover_resolver.get_status()


class PlaybackEventReq(BaseModel):
    duration_listened_seconds: float = 0.0
    track_duration_seconds: float = 0.0
    completed: bool = False
    skipped: bool = False
    playback_context: Optional[str] = None
    context_id: Optional[str] = None
    hour_of_day: Optional[int] = None
    day_of_week: Optional[int] = None


@router.post("/{track_id}/playback-event")
def record_playback_event(
    track_id: str,
    event: PlaybackEventReq,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record rich playback telemetry for implicit feedback and algorithmic tuning:
    - Skip vs. completion rate
    - Duration listened
    - Playback context (radio, playlist, album, daily_mix, etc.)
    - Time-of-day / dayparting
    """
    comp_rate = 0.0
    if event.track_duration_seconds > 0:
        comp_rate = round(min(1.0, event.duration_listened_seconds / event.track_duration_seconds), 3)

    is_completed = event.completed or comp_rate >= 0.75
    is_skipped = event.skipped or (not is_completed and event.duration_listened_seconds < 30)

    history = ListeningHistory(
        user_id=user.id,
        track_id=track_id,
        duration_listened_seconds=round(event.duration_listened_seconds, 2),
        track_duration_seconds=round(event.track_duration_seconds, 2),
        completion_rate=comp_rate,
        completed=is_completed,
        skipped=is_skipped,
        playback_context=event.playback_context,
        context_id=event.context_id,
        hour_of_day=event.hour_of_day,
        day_of_week=event.day_of_week,
    )
    db.add(history)

    # Increment track play count if completed or listened >= 30s
    if is_completed or event.duration_listened_seconds >= 30:
        track = db.query(Track).filter(Track.id == track_id).first()
        if track:
            track.play_count = (track.play_count or 0) + 1
            track.last_played_at = utc_now()

    db.commit()
    return {
        "status": "ok",
        "completed": is_completed,
        "skipped": is_skipped,
        "completion_rate": comp_rate
    }


@router.post("/{track_id}/scrobble")
def scrobble_track(
    track_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record that a track was played (backward compatible legacy scrobble).
    """
    history = ListeningHistory(
        user_id=user.id,
        track_id=track_id,
        duration_listened_seconds=30.0,
        completed=False,
        skipped=False
    )
    db.add(history)
    db.commit()
    return {"status": "ok"}


class SetTrackSourceReq(BaseModel):
    source_id: str
    source_type: str = "youtube"


@router.get("/{track_id}/alternatives")
async def get_track_search_alternatives(
    track_id: str,
    q: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search YouTube Music for alternative audio matches for this track.
    Supports custom user search queries and direct YouTube video URLs.
    """
    import re
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    search_q = q.strip() if (q and q.strip()) else f"{track.artist} - {track.title}".strip()
    results = []

    try:
        from ...services.yt_client import get_ytmusic
        ytm = get_ytmusic()

        # Check if user pasted direct YouTube URL or raw 11-char videoId
        custom_vid = None
        if q:
            yt_match = re.search(r"(?:v=|\/|be\/)([0-9A-Za-z_-]{11})", q)
            if yt_match:
                custom_vid = yt_match.group(1)
            elif len(q.strip()) == 11 and not re.search(r"\s", q.strip()):
                custom_vid = q.strip()

        if custom_vid and ytm:
            try:
                s_info = ytm.get_song(custom_vid)
                v_det = s_info.get("videoDetails", {})
                results.append({
                    "video_id": custom_vid,
                    "title": v_det.get("title", f"YouTube Video ({custom_vid})"),
                    "artist": v_det.get("author", "YouTube"),
                    "duration": f"{int(v_det.get('lengthSeconds', 0)) // 60}:{int(v_det.get('lengthSeconds', 0)) % 60:02d}",
                    "thumbnail": f"https://i.ytimg.com/vi/{custom_vid}/hqdefault.jpg",
                    "youtube_url": f"https://www.youtube.com/watch?v={custom_vid}",
                    "is_current": track.source_id == custom_vid
                })
            except Exception:
                results.append({
                    "video_id": custom_vid,
                    "title": f"Direct Video ({custom_vid})",
                    "artist": "Direct Link",
                    "duration": "",
                    "thumbnail": f"https://i.ytimg.com/vi/{custom_vid}/hqdefault.jpg",
                    "youtube_url": f"https://www.youtube.com/watch?v={custom_vid}",
                    "is_current": track.source_id == custom_vid
                })

        # Regular search if not a direct URL or to fill remaining slots
        if ytm and len(results) < 8:
            raw_res = ytm.search(search_q, filter="songs", limit=8) or []
            if not raw_res:
                raw_res = ytm.search(search_q, limit=8) or []

            seen_ids = set(r["video_id"] for r in results)
            for r in raw_res:
                vid = r.get("videoId")
                if vid and vid not in seen_ids:
                    seen_ids.add(vid)
                    artists = ", ".join(a.get("name", "") for a in r.get("artists", [])) if "artists" in r else ""
                    thumb = r.get("thumbnails", [{}])[-1].get("url") if r.get("thumbnails") else None
                    results.append({
                        "video_id": vid,
                        "title": r.get("title", ""),
                        "artist": artists,
                        "duration": r.get("duration", ""),
                        "thumbnail": thumb,
                        "youtube_url": f"https://www.youtube.com/watch?v={vid}",
                        "is_current": track.source_id == vid
                    })
    except Exception as e:
        logger.warning(f"Failed to search alternatives for query '{search_q}': {e}")

    return {
        "track_id": track.id,
        "search_query": search_q,
        "current_source_id": track.source_id,
        "alternatives": results[:10]
    }


@router.post("/{track_id}/rematch")
async def rematch_track_audio(
    track_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Force clear cached video match and re-run smart matching engine with scoring.
    """
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    old_source_id = track.source_id
    from ...services.audio_streamer import audio_streamer, _stream_url_cache
    if old_source_id:
        _stream_url_cache.pop(old_source_id, None)

    # Reset source_id so resolver is forced to search fresh
    track.source_id = None
    db.commit()

    stream_url, ext, headers = await audio_streamer.resolve_audio_source(track, db)
    return {
        "status": "rematched",
        "track_id": track.id,
        "new_source_id": track.source_id,
        "youtube_url": f"https://www.youtube.com/watch?v={track.source_id}" if track.source_id else None
    }


@router.post("/{track_id}/set-source")
async def set_track_source(
    track_id: str,
    data: SetTrackSourceReq,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually lock in a specific YouTube video as the audio source for this track.
    """
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    track.source_type = data.source_type
    track.source_id = data.source_id
    db.commit()

    # Clear cached stream URL so fresh URL is pulled
    from ...services.audio_streamer import _stream_url_cache
    _stream_url_cache.pop(data.source_id, None)

    return {"status": "ok", "source_id": track.source_id}

