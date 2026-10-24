from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from ...database import get_db
from ...models import User, Playlist, PlaylistTrack, Track, LikedSong, utc_now
from ...services.cache_service import cache_service
from ...services.metadata import metadata_service
from .auth import get_current_user
from .tracks import TrackCreateOrUpdate

router = APIRouter()

class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class PlaylistOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    cover_url: Optional[str] = ""
    track_count: int
    source_type: Optional[str] = "local"
    source_id: Optional[str] = None
    auto_update: Optional[bool] = False

@router.get("", response_model=List[PlaylistOut])
def get_user_playlists(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from sqlalchemy import func

    playlists = db.query(Playlist).filter(
        Playlist.user_id == user.id,
        Playlist.is_system == False
    ).order_by(Playlist.updated_at.desc()).all()

    if not playlists:
        return []

    playlist_ids = [p.id for p in playlists]

    # 1. Bulk count tracks in a single GROUP BY query (replaces O(N) queries)
    counts = (
        db.query(PlaylistTrack.playlist_id, func.count(PlaylistTrack.id))
        .filter(PlaylistTrack.playlist_id.in_(playlist_ids))
        .group_by(PlaylistTrack.playlist_id)
        .all()
    )
    track_counts = dict(counts)

    # 2. Bulk fetch first track covers for playlists with no custom cover
    missing_cover_ids = [p.id for p in playlists if not p.cover_url]
    first_track_covers = {}
    if missing_cover_ids:
        first_tracks = (
            db.query(PlaylistTrack.playlist_id, Track.cover_url)
            .join(Track, PlaylistTrack.track_id == Track.id)
            .filter(PlaylistTrack.playlist_id.in_(missing_cover_ids), PlaylistTrack.position == 0)
            .all()
        )
        first_track_covers = {pid: c for pid, c in first_tracks if c}

    result = []
    for p in playlists:
        cover = p.cover_url or first_track_covers.get(p.id) or ""
        track_cnt = track_counts.get(p.id, 0)
        if p.auto_update and track_cnt == 0:
            track_cnt = 40 if "40" in (p.name or "") else (100 if "100" in (p.name or "") else 50)

        result.append(PlaylistOut(
            id=p.id,
            name=p.name,
            description=p.description,
            cover_url=cover,
            track_count=track_cnt,
            source_type=p.source_type or "local",
            source_id=p.source_id,
            auto_update=bool(p.auto_update)
        ))
    return result

@router.post("", response_model=PlaylistOut)
def create_playlist(
    data: PlaylistCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    playlist = Playlist(
        user_id=user.id,
        name=data.name,
        description=data.description
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return PlaylistOut(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        cover_url="",
        track_count=0
    )

@router.get("/{playlist_id}")
async def get_playlist_details(
    playlist_id: str,
    title: Optional[str] = Query(None),
    artist: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    source_id: Optional[str] = Query(None),
    cover_url: Optional[str] = Query(None),
    album: Optional[str] = Query(None),
    duration: Optional[int] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from ...services.metadata import metadata_service
    from ...services.cache_service import cache_service

    # Special handler: Algorithmic Song Radio Playlist (e.g. radio_dz_12345, radio_yt_abc123)
    if playlist_id.startswith("radio_"):
        from ...services.recommender import recommender_service
        import asyncio

        seed_track_id = playlist_id[6:]
        cache_key = f"radio_view_{seed_track_id}"
        data = cache_service.get(cache_key, db)
        if not data:
            seed_title = title
            seed_artist = artist
            seed_cover = cover_url
            seed_source_type = source_type
            seed_source_id = source_id
            seed_album = album
            seed_duration = duration or 180

            # 1. Resolve seed track metadata from database if incomplete
            if not seed_title or not seed_artist:
                db_track = db.query(Track).filter(Track.id == seed_track_id).first()
                if db_track:
                    seed_title = seed_title or db_track.title
                    seed_artist = seed_artist or db_track.artist
                    seed_cover = seed_cover or db_track.cover_url
                    seed_source_type = seed_source_type or db_track.source_type
                    seed_source_id = seed_source_id or db_track.source_id
                    seed_album = seed_album or db_track.album
                    seed_duration = db_track.duration_seconds or seed_duration

            # 2. Check track cache if still missing
            if not seed_title or not seed_artist:
                cached_track = cache_service.get(f"track_{seed_track_id}", db)
                if cached_track:
                    seed_title = seed_title or cached_track.get("title")
                    seed_artist = seed_artist or cached_track.get("artist")
                    seed_cover = seed_cover or cached_track.get("cover_url")
                    seed_source_type = seed_source_type or cached_track.get("source_type")
                    seed_source_id = seed_source_id or cached_track.get("source_id")
                    seed_album = seed_album or cached_track.get("album")

            # 3. Fallback to external lookup if still missing title, artist, or cover
            if not seed_title or not seed_artist or not seed_cover:
                if seed_track_id.startswith("dz_"):
                    try:
                        clean_dz = seed_track_id.replace("dz_", "")
                        dz_info = await metadata_service.get_track_details(clean_dz)
                        if dz_info:
                            seed_title = dz_info.get("title")
                            seed_artist = dz_info.get("artist")
                            seed_cover = dz_info.get("cover_url")
                            seed_album = dz_info.get("album")
                            seed_duration = dz_info.get("duration_seconds", 180)
                            seed_source_type = "deezer"
                            seed_source_id = clean_dz
                    except Exception as e:
                        pass
                elif seed_track_id.startswith("yt_"):
                    try:
                        clean_yt = seed_track_id.replace("yt_", "")
                        ytm = metadata_service._get_ytmusic()
                        if ytm:
                            yt_info = await asyncio.to_thread(ytm.get_song, clean_yt)
                            vd = yt_info.get("videoDetails", {})
                            seed_title = vd.get("title")
                            seed_artist = vd.get("author")
                            seed_cover = vd.get("thumbnail", {}).get("thumbnails", [{}])[-1].get("url")
                            seed_duration = int(vd.get("lengthSeconds", 180))
                            seed_source_type = "youtube"
                            seed_source_id = clean_yt
                    except Exception as e:
                        pass

            seed_title = seed_title or "Song"
            seed_artist = seed_artist or "Various Artists"

            # 4. Generate continuous algorithmic radio tracks (50 related tracks)
            radio_tracks = await recommender_service.get_track_radio(
                track_title=seed_title,
                artist_name=seed_artist,
                track_id=seed_track_id,
                source_type=seed_source_type or "",
                source_id=seed_source_id or "",
                limit=50
            )

            # Build seed track object to display at track position #1
            seed_track_obj = {
                "id": seed_track_id,
                "title": seed_title,
                "artist": seed_artist,
                "album": seed_album or f"{seed_title} - Single",
                "duration_seconds": seed_duration,
                "cover_url": seed_cover,
                "source_type": seed_source_type or "radio",
                "source_id": seed_source_id or seed_track_id,
                "position": 1,
            }

            combined_tracks = [seed_track_obj]
            seen_ids = {seed_track_id}
            pos = 2
            for rt in radio_tracks:
                if rt.get("id") not in seen_ids:
                    seen_ids.add(rt.get("id"))
                    rt["position"] = pos
                    pos += 1
                    combined_tracks.append(rt)

            data = {
                "id": playlist_id,
                "name": f"{seed_title} Radio",
                "title": f"{seed_title} Radio",
                "description": f"Song Radio based on \"{seed_title}\" by {seed_artist}. Continuous algorithmic recommendations and related tracks.",
                "cover_url": seed_cover or (combined_tracks[1].get("cover_url") if len(combined_tracks) > 1 else ""),
                "curator": f"Algorithmic Radio • {seed_artist}",
                "track_count": len(combined_tracks),
                "is_chart": False,
                "is_radio": True,
                "source_type": "radio",
                "source_id": seed_track_id,
                "tracks": combined_tracks,
                "is_followed": False,
                "auto_update": False
            }
            cache_service.set(cache_key, data, ttl_seconds=3600, db=db)

        if cover_url and not data.get("cover_url"):
            data["cover_url"] = cover_url
            if data.get("tracks") and len(data["tracks"]) > 0 and not data["tracks"][0].get("cover_url"):
                data["tracks"][0]["cover_url"] = cover_url

        # Check liked songs for current user
        track_ids = [t["id"] for t in data.get("tracks", [])]
        liked_ids = set()
        if track_ids:
            liked_ids = {
                item[0] for item in db.query(LikedSong.track_id).filter(
                    LikedSong.user_id == user.id,
                    LikedSong.track_id.in_(track_ids)
                ).all()
            }
        for t in data["tracks"]:
            t["is_liked"] = t["id"] in liked_ids

        # Check if saved to user library
        followed = db.query(Playlist).filter(
            Playlist.user_id == user.id,
            (Playlist.source_id == playlist_id) | (Playlist.id == playlist_id)
        ).first()
        data["is_followed"] = followed is not None
        data["followed_playlist_id"] = followed.id if followed else None

        return data

    # Special handler: Personalized Daily Mixes (daily_mix_1 .. daily_mix_6)
    if playlist_id.startswith("daily_mix_"):
        from ...services.recommender import recommender_service
        mixes = await recommender_service.generate_daily_mixes(user.id, db)
        mix = next((m for m in mixes if m["id"] == playlist_id), None)
        if not mix and mixes:
            mix = mixes[0]
        if not mix:
            raise HTTPException(status_code=404, detail="Daily Mix not found")

        track_ids = [t["id"] for t in mix.get("tracks", [])]
        liked_ids = set()
        if track_ids:
            liked_ids = {
                item[0] for item in db.query(LikedSong.track_id).filter(
                    LikedSong.user_id == user.id,
                    LikedSong.track_id.in_(track_ids)
                ).all()
            }
        tracks_out = []
        for idx, t in enumerate(mix.get("tracks", [])):
            t_copy = dict(t)
            t_copy["is_liked"] = t_copy["id"] in liked_ids
            t_copy["position"] = idx + 1
            tracks_out.append(t_copy)

        return {
            "id": mix["id"],
            "name": mix["title"],
            "title": mix["title"],
            "description": mix["description"],
            "cover_url": mix.get("cover_url", ""),
            "curator": "Made For You",
            "track_count": len(tracks_out),
            "is_chart": False,
            "is_radio": False,
            "is_daily_mix": True,
            "source_type": "daily_mix",
            "source_id": mix["id"],
            "tracks": tracks_out,
            "is_followed": False,
            "auto_update": True
        }

    # 1. Virtual / External Curated Chart Playlist (e.g. chart_uk, genre_country, mood_sleep, dz_playlist_1111142221, yt_playlist_...)
    if playlist_id.startswith(("chart_", "genre_", "mood_", "kids_", "event_", "season_", "dz_playlist_", "yt_playlist_")):
        cache_key = f"vplaylist_{playlist_id}"
        data = cache_service.get(cache_key, db)
        if not data:
            data = await metadata_service.get_playlist_details(playlist_id)
            if data and data.get("tracks"):
                # Cache for 6 hours
                cache_service.set(cache_key, data, ttl_seconds=21600, db=db)

        if not data or not data.get("tracks"):
            raise HTTPException(status_code=404, detail="Curated playlist not found")

        # Check liked songs
        track_ids = [t["id"] for t in data.get("tracks", [])]
        liked_ids = set()
        if track_ids:
            liked_ids = {
                item[0] for item in db.query(LikedSong.track_id).filter(
                    LikedSong.user_id == user.id,
                    LikedSong.track_id.in_(track_ids)
                ).all()
            }

        # Check if user has already followed / saved this chart to library
        followed = db.query(Playlist).filter(
            Playlist.user_id == user.id,
            (Playlist.source_id == playlist_id) | (Playlist.id == playlist_id)
        ).first()

        for t in data["tracks"]:
            t["is_liked"] = t["id"] in liked_ids

        data["is_followed"] = followed is not None
        data["followed_playlist_id"] = followed.id if followed else None
        data["auto_update"] = followed.auto_update if followed else True
        return data

    # 2. Local Database Playlist
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # If this is a followed playlist set to auto_update from an external source
    if playlist.auto_update and playlist.source_id:
        cache_key = f"vplaylist_{playlist.source_id}"
        ext_data = cache_service.get(cache_key, db)
        if not ext_data:
            ext_data = await metadata_service.get_playlist_details(playlist.source_id)
            if ext_data and ext_data.get("tracks"):
                ttl = 7200 if playlist.source_type == "youtube" else 21600
                cache_service.set(cache_key, ext_data, ttl_seconds=ttl, db=db)

        if ext_data and ext_data.get("tracks"):
            track_ids = [t["id"] for t in ext_data.get("tracks", [])]
            liked_ids = set()
            if track_ids:
                liked_ids = {
                    item[0] for item in db.query(LikedSong.track_id).filter(
                        LikedSong.user_id == user.id,
                        LikedSong.track_id.in_(track_ids)
                    ).all()
                }
            for t in ext_data["tracks"]:
                t["is_liked"] = t["id"] in liked_ids

            return {
                "id": playlist.id,
                "name": playlist.name or ext_data.get("name"),
                "description": playlist.description or ext_data.get("description"),
                "cover_url": playlist.cover_url or ext_data.get("cover_url"),
                "curator": ext_data.get("curator", "Official Charts"),
                "is_chart": True,
                "is_followed": True,
                "followed_playlist_id": playlist.id,
                "auto_update": True,
                "source_type": playlist.source_type,
                "source_id": playlist.source_id,
                "tracks": ext_data["tracks"]
            }

    # Otherwise standard local playlist tracks
    tracks_entries = (
        db.query(PlaylistTrack, Track)
        .join(Track, PlaylistTrack.track_id == Track.id)
        .filter(PlaylistTrack.playlist_id == playlist_id)
        .order_by(PlaylistTrack.position.asc())
        .all()
    )

    track_ids = [t.id for _, t in tracks_entries]
    liked_ids = set()
    if track_ids:
        liked_ids = {
            item[0] for item in db.query(LikedSong.track_id).filter(
                LikedSong.user_id == user.id,
                LikedSong.track_id.in_(track_ids)
            ).all()
        }

    tracks = []
    for pt, t in tracks_entries:
        tracks.append({
            "id": t.id,
            "title": t.title,
            "artist": t.artist,
            "album": t.album,
            "duration_seconds": t.duration_seconds,
            "cover_url": t.cover_url,
            "is_cached": t.is_cached,
            "is_liked": t.id in liked_ids,
            "position": pt.position,
            "added_at": pt.added_at.isoformat()
        })

    return {
        "id": playlist.id,
        "name": playlist.name,
        "description": playlist.description,
        "cover_url": playlist.cover_url or (tracks[0]["cover_url"] if tracks else ""),
        "curator": playlist.user.username if playlist.user else "You",
        "is_chart": False,
        "is_radio": playlist.source_type == "radio",
        "is_followed": False,
        "auto_update": bool(playlist.auto_update),
        "source_type": playlist.source_type or "local",
        "tracks": tracks
    }

class FollowPlaylistRequest(BaseModel):
    source_id: str
    source_type: Optional[str] = "chart"
    name: str
    description: Optional[str] = ""
    cover_url: Optional[str] = ""
    auto_update: Optional[bool] = True

@router.post("/follow")
async def follow_playlist(
    data: FollowPlaylistRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if already followed
    existing = db.query(Playlist).filter(
        Playlist.user_id == user.id,
        Playlist.source_id == data.source_id
    ).first()

    if existing:
        return {
            "status": "already_following",
            "playlist_id": existing.id,
            "is_followed": True,
            "message": f"Already following {existing.name}"
        }

    # Create new followed playlist in user's library
    playlist = Playlist(
        user_id=user.id,
        name=data.name,
        description=data.description,
        cover_url=data.cover_url,
        source_type=data.source_type,
        source_id=data.source_id,
        auto_update=data.auto_update if not (data.source_id and data.source_id.startswith("radio_")) else False
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    # If saving a Song Radio, populate tracks into PlaylistTrack
    if data.source_id and data.source_id.startswith("radio_"):
        from ...services.cache_service import cache_service
        cache_key = f"radio_view_{data.source_id[6:]}"
        cached_data = cache_service.get(cache_key, db)
        if cached_data and cached_data.get("tracks"):
            for idx, t in enumerate(cached_data["tracks"]):
                track_uuid = t.get("id") or f"rt_{idx}"
                db_track = db.query(Track).filter(Track.id == track_uuid).first()
                if not db_track:
                    db_track = Track(
                        id=track_uuid,
                        title=t.get("title", "Unknown"),
                        artist=t.get("artist", "Unknown"),
                        album=t.get("album") or "Radio Track",
                        duration_seconds=t.get("duration_seconds", 180),
                        cover_url=t.get("cover_url"),
                        source_type=t.get("source_type") or "radio",
                        source_id=t.get("source_id") or track_uuid,
                        is_cached=False
                    )
                    db.add(db_track)
                    db.commit()

                db.add(PlaylistTrack(
                    playlist_id=playlist.id,
                    track_id=db_track.id,
                    position=idx
                ))
            db.commit()

        return {
            "status": "success",
            "playlist_id": playlist.id,
            "is_followed": True,
            "message": f"Saved {playlist.name} to Your Library"
        }

    return {
        "status": "success",
        "playlist_id": playlist.id,
        "is_followed": True,
        "message": f"Added {playlist.name} to Your Library (Auto-updates weekly)"
    }

@router.delete("/follow/{playlist_id}")
async def unfollow_playlist(
    playlist_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    playlist = db.query(Playlist).filter(
        Playlist.user_id == user.id,
        (Playlist.id == playlist_id) | (Playlist.source_id == playlist_id)
    ).first()

    if not playlist:
        raise HTTPException(status_code=404, detail="Followed playlist not found")

    db.delete(playlist)
    db.commit()

    return {
        "status": "success",
        "is_followed": False,
        "message": "Removed from Your Library"
    }

@router.post("/{playlist_id}/toggle-autoupdate")
def toggle_auto_update(
    playlist_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    playlist = db.query(Playlist).filter(
        Playlist.id == playlist_id,
        Playlist.user_id == user.id
    ).first()

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    playlist.auto_update = not bool(playlist.auto_update)
    db.commit()

    return {
        "status": "success",
        "auto_update": playlist.auto_update,
        "message": "Auto-update enabled" if playlist.auto_update else "Converted to frozen snapshot"
    }

async def sync_playlist_internal(playlist_id: str, db: Session, user_id: Optional[str] = None):
    """
    Core synchronization worker for auto-updating playlists (can be called by API or background task).
    """
    query = db.query(Playlist).filter(Playlist.id == playlist_id)
    if user_id:
        query = query.filter(Playlist.user_id == user_id)
    playlist = query.first()
    if not playlist or not playlist.source_id:
        return None

    # Invalidate cache
    cache_key = f"vplaylist_{playlist.source_id}"
    cache_service.delete(cache_key, db)

    # Fetch fresh playlist details
    ext_data = await metadata_service.get_playlist_details(playlist.source_id)
    if not ext_data or not ext_data.get("tracks"):
        return None

    # Re-cache with dynamic TTL (2 hours for YouTube, 6 hours for others)
    ttl = 7200 if playlist.source_type == "youtube" else 21600
    cache_service.set(cache_key, ext_data, ttl_seconds=ttl, db=db)

    # Update playlist cover if needed
    if ext_data.get("cover_url") and not playlist.cover_url:
        playlist.cover_url = ext_data["cover_url"]
        db.commit()

    return ext_data

@router.post("/{playlist_id}/sync")
async def sync_playlist_now(
    playlist_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Force-sync an auto-updating external playlist (e.g. YouTube or chart) immediately on-demand.
    Bypasses cache and fetches the fresh tracklist directly from the source.
    """
    ext_data = await sync_playlist_internal(playlist_id, db, user.id)
    if not ext_data:
        raise HTTPException(status_code=502, detail="Failed to sync fresh tracks from source")

    return {
        "status": "success",
        "message": f"Synced {len(ext_data['tracks'])} tracks from source",
        "track_count": len(ext_data["tracks"]),
        "tracks": ext_data["tracks"]
    }

@router.post("/{playlist_id}/tracks")
def add_track_to_playlist(
    playlist_id: str,
    data: TrackCreateOrUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Ensure track exists in db
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
        db.add(track)
        db.commit()

    # Get max position
    current_count = db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == playlist_id).count()
    entry = PlaylistTrack(
        playlist_id=playlist_id,
        track_id=track.id,
        position=current_count
    )
    db.add(entry)
    db.commit()
    return {"status": "added", "position": current_count}

@router.delete("/{playlist_id}/tracks/{track_id}")
def remove_track_from_playlist(
    playlist_id: str,
    track_id: str,
    db: Session = Depends(get_db)
):
    entry = db.query(PlaylistTrack).filter(
        PlaylistTrack.playlist_id == playlist_id,
        PlaylistTrack.track_id == track_id
    ).first()
    if entry:
        db.delete(entry)
        db.commit()
    return {"status": "removed"}

class BatchPlaylistTrackDeleteReq(BaseModel):
    track_ids: List[str]

@router.post("/{playlist_id}/tracks/batch-delete")
def batch_remove_tracks_from_playlist(
    playlist_id: str,
    data: BatchPlaylistTrackDeleteReq,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id, Playlist.user_id == user.id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    deleted = (
        db.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == playlist_id, PlaylistTrack.track_id.in_(data.track_ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"status": "ok", "deleted_count": deleted}

@router.post("/{playlist_id}/tracks/clear")
def clear_all_tracks_from_playlist(
    playlist_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id, Playlist.user_id == user.id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    deleted = (
        db.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == playlist_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"status": "ok", "deleted_count": deleted}

class ReorderPlaylistTracksReq(BaseModel):
    track_ids: List[str]

@router.put("/{playlist_id}/tracks/reorder")
@router.post("/{playlist_id}/tracks/reorder")
def reorder_playlist_tracks(
    playlist_id: str,
    data: ReorderPlaylistTracksReq,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id, Playlist.user_id == user.id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    entries = db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == playlist_id).all()
    entry_by_track = {e.track_id: e for e in entries}

    for idx, tid in enumerate(data.track_ids):
        if tid in entry_by_track:
            entry_by_track[tid].position = idx

    playlist.updated_at = utc_now()
    db.commit()
    return {"status": "ok", "reordered_count": len(data.track_ids)}


class PlaylistUpdateReq(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

@router.patch("/{playlist_id}", response_model=PlaylistOut)
def update_playlist(
    playlist_id: str,
    data: PlaylistUpdateReq,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id, Playlist.user_id == user.id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found or permission denied.")
    if data.name is not None and data.name.strip():
        playlist.name = data.name.strip()
    if data.description is not None:
        playlist.description = data.description.strip()
    db.commit()
    db.refresh(playlist)
    first_track = db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == playlist.id).first()
    cover = playlist.cover_url
    if not cover and first_track and first_track.track:
        cover = first_track.track.cover_url
    return PlaylistOut(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        cover_url=cover or "",
        track_count=len(playlist.tracks),
        source_type=playlist.source_type or "local",
        source_id=playlist.source_id,
        auto_update=bool(playlist.auto_update)
    )

@router.delete("/{playlist_id}")
def delete_playlist(
    playlist_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id, Playlist.user_id == user.id).first()
    if playlist:
        db.delete(playlist)
        db.commit()
    return {"status": "deleted"}

class ImportedTrackItem(BaseModel):
    title: str
    artist: Optional[str] = "Unknown Artist"
    album: Optional[str] = ""
    duration_seconds: Optional[int] = 180

class PlaylistImportPreviewReq(BaseModel):
    url: Optional[str] = None
    text_data: Optional[str] = None

class PlaylistImportReq(BaseModel):
    url: Optional[str] = None
    text_data: Optional[str] = None
    tracks: Optional[List[ImportedTrackItem]] = None
    target: str = "new_playlist"  # "liked_songs", "new_playlist", "existing_playlist", "playlist"
    playlist_id: Optional[str] = None
    playlist_name: Optional[str] = None
    reverse_order: bool = False

async def extract_import_tracks(url: Optional[str] = None, text_data: Optional[str] = None):
    import re
    import json
    import csv
    import io
    import httpx

    playlist_name = "Imported Playlist"
    description = "Imported into AudioHub"
    cover_url = ""
    raw_tracks = []

    # 1. Handle URL (Spotify or Apple Music)
    if url and url.strip():
        u = url.strip()
        description = f"Imported from {u}"

        if "spotify.com" in u:
            match = re.search(r'/(playlist|album)/([a-zA-Z0-9]+)', u)
            if not match:
                raise HTTPException(status_code=400, detail="Invalid Spotify playlist or album URL format.")
            
            item_type = match.group(1)
            item_id = match.group(2)
            embed_url = f"https://open.spotify.com/embed/{item_type}/{item_id}"

            try:
                from ...services.http_client import get_http_client
                client = get_http_client()
                resp = await client.get(embed_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                if resp.status_code != 200:
                    raise HTTPException(status_code=400, detail="Could not access public Spotify playlist.")
                html = resp.text

                json_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.+?)</script>', html)
                if json_match:
                    payload = json.loads(json_match.group(1))
                    entity = payload.get("props", {}).get("pageProps", {}).get("state", {}).get("data", {}).get("entity", {})
                    playlist_name = entity.get("name", playlist_name)
                    
                    cover_sources = entity.get("coverArt", {}).get("sources", [])
                    if cover_sources:
                        cover_url = cover_sources[0].get("url", "")

                    for item in entity.get("trackList", []):
                        t_title = item.get("title")
                        t_artist = item.get("subtitle") or "Unknown Artist"
                        t_duration = int(item.get("duration", 0) / 1000)
                        if t_title:
                            raw_tracks.append({
                                "title": t_title,
                                "artist": t_artist,
                                "album": playlist_name,
                                "duration_seconds": t_duration or 180
                            })
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse Spotify playlist: {str(e)}")

        elif "apple.com" in u:
            try:
                from ...services.http_client import get_http_client
                client = get_http_client()
                resp = await client.get(u, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                if resp.status_code == 200:
                        title_match = re.search(r'<meta property="og:title" content="([^"]+)"', resp.text)
                        if title_match:
                            playlist_name = title_match.group(1)
                        img_match = re.search(r'<meta property="og:image" content="([^"]+)"', resp.text)
                        if img_match:
                            cover_url = img_match.group(1)
                        songs = re.findall(r'<meta property="music:song" content="([^"]+)"', resp.text)
                        for s in songs:
                            raw_tracks.append({"title": s, "artist": "Apple Music Artist", "album": playlist_name, "duration_seconds": 210})
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse Apple Music playlist: {str(e)}")

        elif "youtube.com" in u or "youtu.be" in u:
            try:
                match = re.search(r'[?&]list=([a-zA-Z0-9_-]+)', u)
                if not match:
                    raise HTTPException(status_code=400, detail="Invalid YouTube playlist link. Missing 'list=' parameter.")
                pl_id = match.group(1)
                clean_pl_id = pl_id.replace("VL", "") if pl_id.startswith("VL") else pl_id
                from ...services.metadata import metadata_service
                ytm = metadata_service._get_ytmusic()
                if not ytm:
                    raise HTTPException(status_code=500, detail="YouTube service unavailable.")
                pl_data = ytm.get_playlist(clean_pl_id, limit=300)
                playlist_name = pl_data.get("title") or playlist_name
                thumbnails = pl_data.get("thumbnails", [])
                if thumbnails:
                    cover_url = thumbnails[-1]["url"]
                for t in pl_data.get("tracks", []):
                    t_title = t.get("title")
                    artists = t.get("artists", [])
                    t_artist = ", ".join([a["name"] for a in artists if "name" in a]) or "YouTube Artist"
                    if t_title:
                        raw_tracks.append({
                            "title": t_title,
                            "artist": t_artist,
                            "album": playlist_name,
                            "duration_seconds": t.get("duration_seconds", 180)
                        })
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse YouTube playlist: {str(e)}")

    # 2. Handle CSV or Text Data (Exportify, text lines)
    elif text_data and text_data.strip():
        text = text_data.strip()
        try:
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)
            if rows and any("Track" in k or "title" in k.lower() or "Song" in k for k in rows[0].keys()):
                for r in rows:
                    title = r.get("Track Name") or r.get("title") or r.get("Track") or r.get("Song Name")
                    artist = r.get("Artist Name(s)") or r.get("artist") or r.get("Artist") or r.get("Artists") or "Unknown Artist"
                    album = r.get("Album Name") or r.get("album") or ""
                    if title:
                        raw_tracks.append({"title": title.strip(), "artist": artist.strip(), "album": album.strip(), "duration_seconds": 180})
        except Exception:
            pass

        if not raw_tracks:
            for line in text.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if " - " in line:
                    parts = line.split(" - ", 1)
                    raw_tracks.append({"title": parts[1].strip(), "artist": parts[0].strip(), "album": "", "duration_seconds": 180})
                elif "\t" in line:
                    parts = line.split("\t", 1)
                    raw_tracks.append({"title": parts[0].strip(), "artist": parts[1].strip(), "album": "", "duration_seconds": 180})
                else:
                    raw_tracks.append({"title": line, "artist": "Various Artists", "album": "", "duration_seconds": 180})

    return playlist_name, description, cover_url, raw_tracks

@router.post("/import/preview")
async def preview_import(
    data: PlaylistImportPreviewReq,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Dry-run parses playlist source and returns list of songs before creating/saving.
    """
    if not (data.url and data.url.strip()) and not (data.text_data and data.text_data.strip()):
        raise HTTPException(status_code=400, detail="Please provide a URL or paste text/CSV data.")

    playlist_name, description, cover_url, raw_tracks = await extract_import_tracks(data.url, data.text_data)

    if not raw_tracks:
        raise HTTPException(status_code=400, detail="No tracks could be found in the provided source.")

    return {
        "playlist_name": playlist_name,
        "description": description,
        "cover_url": cover_url,
        "track_count": len(raw_tracks),
        "tracks": raw_tracks[:1000]
    }

@router.post("/import")
async def import_playlist(
    data: PlaylistImportReq,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Import public playlist from Spotify, Apple Music, or CSV/text
    directly into Liked Songs, a new Playlist, or an existing Playlist.
    Supports receiving pre-reviewed, selected tracks directly.
    """
    import hashlib
    from sqlalchemy import func

    target_mode = "new_playlist" if data.target == "playlist" else data.target
    custom_name = data.playlist_name.strip() if data.playlist_name and data.playlist_name.strip() else None
    playlist_name = custom_name or ("Imported Liked Songs" if target_mode == "liked_songs" else "Imported Playlist")
    description = "Imported into AudioHub"
    cover_url = ""
    raw_tracks = []

    # If frontend sent pre-reviewed tracks, use them
    if data.tracks and len(data.tracks) > 0:
        for t in data.tracks:
            raw_tracks.append({
                "title": t.title.strip(),
                "artist": (t.artist or "Unknown Artist").strip(),
                "album": (t.album or "").strip(),
                "duration_seconds": t.duration_seconds or 180
            })
    else:
        parsed_name, parsed_desc, parsed_cover, parsed_tracks = await extract_import_tracks(data.url, data.text_data)
        if not custom_name and parsed_name:
            playlist_name = parsed_name
        description = parsed_desc
        cover_url = parsed_cover
        raw_tracks = parsed_tracks

    if not raw_tracks:
        raise HTTPException(status_code=400, detail="No tracks could be found. Please check the URL or text input.")

    tracks_to_add = raw_tracks[:1000]
    if data.reverse_order:
        tracks_to_add = list(reversed(tracks_to_add))

    # Target A: User's Liked Songs
    if target_mode == "liked_songs":
        liked_count = 0
        from datetime import datetime, timezone, timedelta
        base_time = datetime.now(timezone.utc)

        for idx, t in enumerate(tracks_to_add):
            item_liked_at = base_time - timedelta(seconds=idx)
            clean_title = t["title"].strip()
            clean_artist = t["artist"].strip()
            h_int = int(hashlib.md5(f"{clean_artist.lower()}_{clean_title.lower()}".encode("utf-8")).hexdigest(), 16) % 10000000000
            track_uuid = f"dz_{h_int}"

            track = db.query(Track).filter(Track.id == track_uuid).first()
            if not track:
                track = Track(
                    id=track_uuid,
                    title=clean_title,
                    artist=clean_artist,
                    album=t.get("album") or "Liked Songs",
                    duration_seconds=t.get("duration_seconds", 180),
                    source_type="import",
                    source_id=track_uuid.replace("dz_", ""),
                    is_cached=False
                )
                db.add(track)
                db.commit()

            # Ensure LikedSong entry exists
            existing_like = db.query(LikedSong).filter(
                LikedSong.user_id == user.id,
                LikedSong.track_id == track.id
            ).first()

            if not existing_like:
                db.add(LikedSong(user_id=user.id, track_id=track.id, liked_at=item_liked_at))
                liked_count += 1
            else:
                existing_like.liked_at = item_liked_at

        db.commit()

        # Trigger background cover resolution
        try:
            from ...services.cover_resolver import cover_resolver
            from ...database import SessionLocal
            import asyncio
            asyncio.create_task(cover_resolver.run_enrichment(SessionLocal))
        except Exception:
            pass

        return {
            "status": "success",
            "target": "liked_songs",
            "imported_count": len(tracks_to_add),
            "newly_liked_count": liked_count
        }

    # Target B: Append to Existing Playlist
    if target_mode == "existing_playlist":
        if not data.playlist_id:
            raise HTTPException(status_code=400, detail="playlist_id is required when importing into an existing playlist.")
        existing_pl = db.query(Playlist).filter(Playlist.id == data.playlist_id, Playlist.user_id == user.id).first()
        if not existing_pl:
            raise HTTPException(status_code=404, detail="Selected playlist not found.")

        max_pos = db.query(func.max(PlaylistTrack.position)).filter(PlaylistTrack.playlist_id == existing_pl.id).scalar()
        start_pos = (max_pos + 1) if max_pos is not None else 0

        added_count = 0
        for idx, t in enumerate(tracks_to_add):
            clean_title = t["title"].strip()
            clean_artist = t["artist"].strip()
            h_int = int(hashlib.md5(f"{clean_artist.lower()}_{clean_title.lower()}".encode("utf-8")).hexdigest(), 16) % 10000000000
            track_uuid = f"dz_{h_int}"

            track = db.query(Track).filter(Track.id == track_uuid).first()
            if not track:
                track = Track(
                    id=track_uuid,
                    title=clean_title,
                    artist=clean_artist,
                    album=t.get("album") or existing_pl.name,
                    duration_seconds=t.get("duration_seconds", 180),
                    cover_url=cover_url or None,
                    source_type="import",
                    source_id=track_uuid.replace("dz_", ""),
                    is_cached=False
                )
                db.add(track)
                db.commit()

            db.add(PlaylistTrack(
                playlist_id=existing_pl.id,
                track_id=track.id,
                position=start_pos + idx
            ))
            added_count += 1

        db.commit()

        # Trigger background cover resolution
        try:
            from ...services.cover_resolver import cover_resolver
            from ...database import SessionLocal
            import asyncio
            asyncio.create_task(cover_resolver.run_enrichment(SessionLocal))
        except Exception:
            pass

        return {
            "status": "success",
            "target": "existing_playlist",
            "id": existing_pl.id,
            "name": existing_pl.name,
            "imported_count": added_count
        }

    # Target C: Dedicated New Playlist
    new_playlist = Playlist(
        user_id=user.id,
        name=playlist_name,
        description=description,
        cover_url=cover_url
    )
    db.add(new_playlist)
    db.commit()
    db.refresh(new_playlist)

    for idx, t in enumerate(tracks_to_add):
        clean_title = t["title"].strip()
        clean_artist = t["artist"].strip()
        h_int = int(hashlib.md5(f"{clean_artist.lower()}_{clean_title.lower()}".encode("utf-8")).hexdigest(), 16) % 10000000000
        track_uuid = f"dz_{h_int}"

        track = db.query(Track).filter(Track.id == track_uuid).first()
        if not track:
            track = Track(
                id=track_uuid,
                title=clean_title,
                artist=clean_artist,
                album=playlist_name,
                duration_seconds=t.get("duration_seconds", 180),
                cover_url=cover_url or None,
                source_type="import",
                source_id=track_uuid.replace("dz_", ""),
                is_cached=False
            )
            db.add(track)
            db.commit()

        db.add(PlaylistTrack(
            playlist_id=new_playlist.id,
            track_id=track.id,
            position=idx
        ))

    db.commit()

    # Trigger background cover resolution
    try:
        from ...services.cover_resolver import cover_resolver
        from ...database import SessionLocal
        import asyncio
        asyncio.create_task(cover_resolver.run_enrichment(SessionLocal))
    except Exception:
        pass

    return {
        "status": "success",
        "target": "new_playlist",
        "id": new_playlist.id,
        "name": new_playlist.name,
        "track_count": len(tracks_to_add),
        "cover_url": cover_url
    }

