from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import User, ListeningHistory, Track
from ...services.metadata import metadata_service
from ...services.recommender import recommender_service
from .auth import get_current_user

router = APIRouter()

@router.get("/home")
async def get_home_feed(
    hour: Optional[int] = Query(None, description="Client local hour 0-23"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Recently played tracks (top 6 for Spotify-style quick access grid)
    recent_history = (
        db.query(ListeningHistory, Track)
        .join(Track, ListeningHistory.track_id == Track.id)
        .filter(ListeningHistory.user_id == user.id)
        .order_by(ListeningHistory.played_at.desc())
        .limit(20)
        .all()
    )
    
    seen_ids = set()
    quick_access = []
    for h, t in recent_history:
        if t.id not in seen_ids and len(quick_access) < 6:
            seen_ids.add(t.id)
            quick_access.append({
                "id": t.id,
                "title": t.title,
                "artist": t.artist,
                "cover_url": t.cover_url,
                "source_type": t.source_type,
                "source_id": t.source_id,
            })

    # 2. Daily Mixes (Dayparting & Telemetry feedback aware)
    daily_mixes = await recommender_service.generate_daily_mixes(user.id, db, client_hour=hour)

    # 3. Trending Charts (cached for 3 hours)
    from ...services.cache_service import cache_service
    trending = cache_service.get("trending_charts_15", db)
    if not trending:
        trending = await metadata_service.get_trending_charts(limit=15)
        if trending:
            cache_service.set("trending_charts_15", trending, ttl_seconds=10800, db=db)

    # 4. Featured Curated Charts (UK Top 40, Billboard Hot 100, Global Top 50, etc.)
    featured_charts = await metadata_service.get_featured_charts()

    # 5. Official Genre Playlists (Country, Reggae, Dance, Hip-Hop, Rock, R&B, etc.)
    genre_playlists = await metadata_service.get_genre_playlists()

    return {
        "quick_access": quick_access,
        "daily_mixes": daily_mixes,
        "featured_charts": featured_charts,
        "genre_playlists": genre_playlists,
        "trending": trending
    }


@router.get("/charts")
async def get_charts(user: User = Depends(get_current_user)):
    return await metadata_service.get_featured_charts()


@router.get("/genres")
async def get_genres(user: User = Depends(get_current_user)):
    return await metadata_service.get_genre_playlists()


@router.get("/daily-mixes")
async def get_daily_mixes(
    hour: Optional[int] = Query(None, description="Client local hour 0-23"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return await recommender_service.generate_daily_mixes(user.id, db, client_hour=hour)

@router.get("/radio/{track_id}")
async def get_radio(
    track_id: str,
    title: str = Query(..., description="Track title"),
    artist: str = Query(..., description="Artist name"),
    source_type: Optional[str] = Query(None, description="Track source type"),
    source_id: Optional[str] = Query(None, description="Track source ID"),
    db: Session = Depends(get_db)
):
    radio_tracks = await recommender_service.get_track_radio(
        track_title=title,
        artist_name=artist,
        track_id=track_id,
        source_type=source_type or "",
        source_id=source_id or "",
        limit=30
    )
    return {
        "seed_track": {"id": track_id, "title": title, "artist": artist},
        "tracks": radio_tracks
    }
