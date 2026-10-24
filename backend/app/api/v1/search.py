from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict, Any

from ...database import get_db
from ...models import User, LikedSong, Track
from ...services.metadata import metadata_service
from ...services.cache_service import cache_service
from .auth import get_current_user

router = APIRouter()

@router.get("", response_model=Dict[str, Any])
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(25, ge=1, le=50),
    include_yt: bool = Query(False, description="Include YouTube playlists and channel artists"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clean_q = q.strip().lower()

    # 1. Search uploaded tracks in local database (public or owned by user)
    local_uploads = db.query(Track).filter(
        Track.is_uploaded == True,
        (Track.is_private == False) | (Track.uploader_id == user.id),
        (Track.title.ilike(f"%{clean_q}%") | Track.artist.ilike(f"%{clean_q}%"))
    ).limit(10).all()

    upload_tracks = [
        {
            "id": t.id,
            "title": t.title,
            "artist": t.artist,
            "album": t.album,
            "duration_seconds": t.duration_seconds,
            "cover_url": t.cover_url,
            "source_type": "upload",
            "source_id": t.id,
            "is_cached": True,
            "is_uploaded": True
        }
        for t in local_uploads
    ]

    # 2. Check cache for external search results (30 min TTL)
    cache_key = f"search_{clean_q}_{limit}_{int(include_yt)}"
    cached_results = cache_service.get(cache_key, db)
    if cached_results:
        results = cached_results
    else:
        results = await metadata_service.search(query=q, limit=limit, include_yt=include_yt)
        if results and (results.get("tracks") or results.get("playlists")):
            cache_service.set(cache_key, results, ttl_seconds=1800, db=db)

    # 3. Combine: prepend uploaded tracks to search results
    all_tracks = upload_tracks + [t for t in results.get("tracks", []) if t["id"] not in {u["id"] for u in upload_tracks}]

    # Check liked status for tracks in results
    track_ids = [t["id"] for t in all_tracks]
    liked_ids = set()
    if track_ids:
        liked_query = db.query(LikedSong.track_id).filter(
            LikedSong.user_id == user.id,
            LikedSong.track_id.in_(track_ids)
        ).all()
        liked_ids = {item[0] for item in liked_query}

    # Check cached status
    cached_query = db.query(Track.id, Track.is_cached).filter(Track.id.in_(track_ids)).all()
    cached_map = {item[0]: item[1] for item in cached_query}

    for t in all_tracks:
        t["is_liked"] = t["id"] in liked_ids
        t["is_cached"] = t.get("is_uploaded") or cached_map.get(t["id"], False)

    # Local user/public playlists matching query
    from ...models import Playlist
    local_playlists = db.query(Playlist).filter(
        Playlist.is_public == True,
        Playlist.name.ilike(f"%{clean_q}%")
    ).limit(5).all()

    local_pl_list = [
        {
            "id": p.id,
            "source_id": p.id,
            "source_type": p.source_type or "local",
            "title": p.name,
            "description": p.description or f"Playlist by {p.user.username if p.user else 'User'}",
            "cover_url": p.cover_url or "",
            "curator": p.user.username if p.user else "AudioHub",
            "track_count": len(p.tracks),
            "is_chart": False,
        }
        for p in local_playlists
    ]

    all_playlists = local_pl_list + [p for p in results.get("playlists", []) if p["id"] not in {lp["id"] for lp in local_pl_list}]

    # Determine Top Result (Spotify-style highlighted card)
    top_result = None
    sorted_artists = results.get("artists", [])
    if sorted_artists and clean_q:
        first_artist = sorted_artists[0]
        a_name = first_artist.get("name", "").strip().lower()
        if a_name == clean_q or a_name.startswith(clean_q) or clean_q in a_name:
            top_result = {
                "type": "artist",
                "item": first_artist
            }

    if not top_result and all_tracks:
        first_track = all_tracks[0]
        t_title = first_track.get("title", "").strip().lower()
        if t_title == clean_q or clean_q in t_title:
            top_result = {
                "type": "track",
                "item": first_track
            }

    return {
        "top_result": top_result,
        "tracks": all_tracks[:limit],
        "artists": sorted_artists,
        "albums": results.get("albums", []),
        "playlists": all_playlists
    }
