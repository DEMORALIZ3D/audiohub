import os
import json
import asyncio
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Request, Response, HTTPException, Header, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...database import get_db, SessionLocal
from ...models import Track, ListeningHistory, User, UserActivityLog, utc_now
from ...services.audio_streamer import audio_streamer
from ...services.diagnostic_logger import diagnostic_logger

logger = logging.getLogger(__name__)
router = APIRouter()

class PrefetchReq(BaseModel):
    track_ids: List[str]

@router.post("/prefetch")
async def prefetch_queue_tracks(
    data: PrefetchReq,
    db: Session = Depends(get_db)
):
    """
    Preemptively resolve audio stream URLs in the background for upcoming tracks in queue.
    Enables instant (0ms delay) song switching.
    """
    if data.track_ids:
        asyncio.create_task(audio_streamer.prefetch_tracks(data.track_ids[:4], SessionLocal))
    return {"status": "prefetching", "count": len(data.track_ids[:4])}

@router.get("/{track_id}/info")
async def get_track_audio_info(
    track_id: str,
    db: Session = Depends(get_db)
):
    """
    Returns audio source metadata, YouTube video match details, and stream status.
    """
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        # Fallback: Resolve external track details directly for shared link previews
        try:
            from ...services.metadata import get_http_client
            if track_id.startswith("dz_"):
                clean_id = track_id.replace("dz_", "")
                client = get_http_client()
                resp = await client.get(f"https://api.deezer.com/track/{clean_id}")
                if resp.status_code == 200:
                    d = resp.json()
                    if d.get("title"):
                        return {
                            "id": track_id,
                            "title": d.get("title"),
                            "artist": d.get("artist", {}).get("name", "Unknown Artist"),
                            "album": d.get("album", {}).get("title", ""),
                            "cover_url": d.get("album", {}).get("cover_xl") or d.get("album", {}).get("cover_big") or d.get("album", {}).get("cover_medium"),
                            "duration_seconds": d.get("duration", 0),
                            "source_type": "deezer",
                            "source_id": clean_id,
                            "is_cached": False,
                            "is_uploaded": False,
                            "youtube_id": None,
                            "youtube_url": None
                        }
        except Exception as e:
            logger.warning(f"Failed to resolve shared track {track_id}: {e}")

        raise HTTPException(status_code=404, detail="Track not found")

    yt_id = track.source_id if track.source_type == "youtube" else None
    return {
        "id": track.id,
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "cover_url": track.cover_url,
        "duration_seconds": track.duration_seconds,
        "source_type": track.source_type,
        "source_id": track.source_id,
        "is_cached": track.is_cached,
        "is_uploaded": track.is_uploaded,
        "youtube_id": yt_id,
        "youtube_url": f"https://www.youtube.com/watch?v={yt_id}" if yt_id else None
    }

@router.api_route("/{track_id}", methods=["GET", "HEAD"])
async def stream_audio(
    track_id: str,
    request: Request,
    title: Optional[str] = None,
    artist: Optional[str] = None,
    album: Optional[str] = None,
    cover_url: Optional[str] = None,
    retry: Optional[int] = None,
    force_refresh: bool = False,
    user_id: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Direct audio streaming endpoint with full HTTP 206 Range Request support.
    """
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        # Create virtual track record from id and incoming metadata
        source_type = "youtube" if track_id.startswith("yt_") else "deezer"
        source_id = track_id.replace("yt_", "").replace("dz_", "")
        clean_title = title.strip() if (title and title.strip() and title != "Unknown Track") else "Unknown Track"
        clean_artist = artist.strip() if (artist and artist.strip() and artist != "Unknown Artist") else "Unknown Artist"
        track = Track(
            id=track_id,
            title=clean_title,
            artist=clean_artist,
            album=album,
            cover_url=cover_url,
            source_type=source_type,
            source_id=source_id,
            is_cached=False
        )
        try:
            db.add(track)
            db.commit()
            db.refresh(track)
        except Exception:
            db.rollback()
            track = db.query(Track).filter(Track.id == track_id).first()
    else:
        # If existing track has Unknown Track / Unknown Artist, repair it with incoming parameters!
        needs_repair = not track.title or track.title == "Unknown Track" or not track.artist or track.artist == "Unknown Artist"
        if needs_repair and title and title.strip() and title != "Unknown Track":
            track.title = title.strip()
            if artist and artist.strip() and artist != "Unknown Artist":
                track.artist = artist.strip()
            if album:
                track.album = album.strip()
            if cover_url:
                track.cover_url = cover_url.strip()
            if track.source_id in ["QQp0uV11d1g", "PzsCRfat_QQ"]:
                track.source_type = "deezer" if track.id.startswith("dz_") else "youtube"
                track.source_id = track.id.replace("dz_", "").replace("yt_", "")
            db.commit()
            db.refresh(track)

    if request.method == "HEAD":
        file_size = track.file_size_bytes or 0
        if not file_size and track.local_path and os.path.exists(track.local_path):
            file_size = os.path.getsize(track.local_path)
        content_length = str(file_size) if file_size > 0 else "5242880"

        # Determine container type (YouTube & Deezer CDN streams are audio/mp4 AAC)
        is_mp4 = True
        if track.local_path:
            is_mp4 = any(track.local_path.lower().endswith(x) for x in [".m4a", ".mp4", ".aac"])
        elif getattr(track, "source_type", None) == "local":
            is_mp4 = False

        mime_type = "audio/mp4" if is_mp4 else "audio/mpeg"
        dlna_pn = "AAC_ISO" if is_mp4 else "MP3"

        return Response(
            status_code=200,
            headers={
                "Content-Type": mime_type,
                "Accept-Ranges": "bytes",
                "Content-Length": content_length,
                "contentFeatures.dlna.org": f"DLNA.ORG_PN={dlna_pn};DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01500000000000000000000000000000",
                "transferMode.dlna.org": "Streaming"
            }
        )

    range_header = request.headers.get("Range", "")
    is_initial_start = (not range_header or range_header.startswith("bytes=0-"))

    # If this is the start of a song, log user activity & listening history
    if is_initial_start:
        user = None
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")[:250]

        # 1. Resolve effective user ID from query param, header, or bearer token
        effective_id = user_id or token or x_user_id
        if not effective_id:
            effective_id = request.query_params.get("user_id") or request.query_params.get("token")
        if not effective_id and authorization:
            parts = authorization.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                effective_id = parts[1]
            elif authorization:
                effective_id = authorization.strip()
        if not effective_id:
            effective_id = request.cookies.get("audiohub_user_id") or request.cookies.get("user_id")

        if effective_id:
            user = db.query(User).filter(User.id == effective_id, User.is_active == True).first()

        # 2. Smart fallback for Cast/DLNA devices or legacy WebViews missing query param
        if not user:
            # Check users with recently saved playback state matching this track
            active_users = db.query(User).filter(User.last_playback_state.isnot(None)).all()
            for u in active_users:
                try:
                    state = json.loads(u.last_playback_state)
                    cur_t = state.get("current_track") or {}
                    if cur_t.get("id") == track.id:
                        user = u
                        break
                except Exception:
                    pass

        if not user and client_ip and client_ip != "unknown":
            # Match against recent authenticated activity from the same client IP
            recent_act = db.query(UserActivityLog).filter(
                UserActivityLog.ip_address == client_ip,
                UserActivityLog.user_id.isnot(None),
                UserActivityLog.action != "stream"
            ).order_by(UserActivityLog.created_at.desc()).first()
            if recent_act and recent_act.user_id:
                user = db.query(User).filter(User.id == recent_act.user_id, User.is_active == True).first()

        try:
            track.play_count = (track.play_count or 0) + 1
            track.last_played_at = utc_now()

            if user:
                db.add(ListeningHistory(
                    user_id=user.id,
                    track_id=track.id,
                    played_at=utc_now()
                ))

            # Clearly identify user in activity log
            username_display = "Anonymous"
            if user:
                username_display = user.display_name or user.username or user.email or user.id

            db.add(UserActivityLog(
                user_id=user.id if user else None,
                username=username_display,
                action="stream",
                details=f"{track.artist} - {track.title}",
                ip_address=client_ip,
                user_agent=user_agent
            ))
            db.commit()
        except Exception as e:
            logger.warning(f"Could not record stream activity: {e}")

    try:
        return await audio_streamer.stream_track(track, request, db, force_refresh=bool(force_refresh or retry))
    except Exception as e:
        diagnostic_logger.log_event(
            source="stream",
            message=f"Stream error on '{track.artist} - {track.title}' ({track.id}): {str(e)}",
            level="ERROR",
            details=str(e),
            db=db
        )
        raise
