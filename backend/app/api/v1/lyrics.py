from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from ...database import get_db
from ...services.lyrics import lyrics_service
from ...services.cache_service import cache_service

router = APIRouter()

@router.get("")
async def get_lyrics(
    track: str = Query(..., description="Track title"),
    artist: str = Query(..., description="Artist name"),
    duration: Optional[int] = Query(0, description="Duration in seconds"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    cache_key = f"lyrics_{artist.lower()}_{track.lower()}"
    cached = cache_service.get(cache_key, db)
    if cached:
        return cached

    res = await lyrics_service.get_lyrics(track, artist, duration)
    if res and res.get("plain_lyrics"):
        # Cache for 14 days
        cache_service.set(cache_key, res, ttl_seconds=86400 * 14, db=db)
    return res
