import asyncio
import logging
import random
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, joinedload
from ..models import LikedSong, ListeningHistory, Track
from .http_client import get_http_client
from .yt_client import get_ytmusic
from .cache_service import cache_service

logger = logging.getLogger(__name__)

class RecommenderService:
    async def get_track_radio(
        self,
        track_title: str,
        artist_name: str,
        track_id: str = "",
        source_type: str = "",
        source_id: str = "",
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Generate a high-affinity dynamic radio queue seeded from a track and artist.
        1. Uses YouTube Music's algorithmic radio watch endpoint (ytmusic.get_watch_playlist)
           for exact subgenre, tempo, energy, and vibe continuity matching.
        2. Fallback to Deezer related artists & track radio.
        """
        radio_tracks = []
        seed_video_id = None

        # 1. Check if we already have a YouTube video ID
        if source_type == "youtube" and source_id:
            seed_video_id = source_id
        elif track_id and (track_id.startswith("yt_") or len(track_id) == 11):
            seed_video_id = track_id.replace("yt_", "")

        # 2. Try YouTube Music Algorithmic Radio
        yt = get_ytmusic()
        if yt:
            try:
                # If we don't have a direct video ID, find it via quick song search
                if not seed_video_id and (track_title or artist_name):
                    query = f"{track_title} {artist_name}".strip()
                    search_res = await asyncio.to_thread(yt.search, query, filter="songs")
                    if search_res and isinstance(search_res, list) and len(search_res) > 0:
                        seed_video_id = search_res[0].get("videoId")

                if seed_video_id:
                    # Request up to limit + 5 to account for seed deduplication
                    watch_data = await asyncio.to_thread(
                        yt.get_watch_playlist,
                        videoId=seed_video_id,
                        radio=True,
                        limit=limit + 5
                    )
                    raw_tracks = watch_data.get("tracks", []) if isinstance(watch_data, dict) else []

                    norm_seed_title = (track_title or "").lower().strip()
                    norm_seed_artist = (artist_name or "").lower().strip()

                    for t in raw_tracks:
                        vid = t.get("videoId")
                        if not vid or vid == seed_video_id:
                            continue

                        t_title = t.get("title", "Unknown")
                        t_artists = t.get("artists") or []
                        t_artist = ", ".join([a["name"] for a in t_artists if "name" in a]) or "Unknown Artist"

                        # Skip exact duplicate of seed
                        if norm_seed_title and norm_seed_artist and t_title.lower().strip() == norm_seed_title and norm_seed_artist in t_artist.lower():
                            continue

                        # Extract highest resolution thumbnail
                        thumbs = t.get("thumbnails") or []
                        cover = thumbs[-1]["url"] if thumbs else ""

                        # Parse duration
                        dur = t.get("duration_seconds")
                        if not dur and t.get("length"):
                            parts = str(t.get("length")).split(":")
                            if len(parts) == 2:
                                dur = int(parts[0]) * 60 + int(parts[1])
                            elif len(parts) == 3:
                                dur = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                            else:
                                dur = 0
                        dur = dur or 0

                        radio_tracks.append({
                            "id": f"yt_{vid}",
                            "title": t_title,
                            "artist": t_artist,
                            "album": t.get("album", {}).get("name", "") if isinstance(t.get("album"), dict) else "",
                            "duration_seconds": dur,
                            "cover_url": cover,
                            "source_type": "youtube",
                            "source_id": vid
                        })

                        if len(radio_tracks) >= limit:
                            break
            except Exception as yt_err:
                logger.warning(f"YouTube Music radio generation failed: {yt_err}")

        # If YouTube Music returned a solid queue of tracks, return immediately
        if len(radio_tracks) >= 8:
            return radio_tracks

        # 3. Fallback to Deezer Related Artists & Track Radio
        try:
            client = get_http_client()
            search_query = f"{track_title} {artist_name}".strip()
            search_resp = await client.get(f"https://api.deezer.com/search?q={search_query}&limit=1")
            if search_resp.status_code == 200:
                data = search_resp.json().get("data", [])
                if data:
                    artist_id = data[0].get("artist", {}).get("id")

                    # Fetch related artists to ensure broad genre continuity rather than just repeating 1 artist
                    related_resp = await client.get(f"https://api.deezer.com/artist/{artist_id}/related?limit=5")
                    related_ids = [artist_id]
                    if related_resp.status_code == 200:
                        for rel in related_resp.json().get("data", []):
                            if rel.get("id"):
                                related_ids.append(rel["id"])

                    # Fetch radio or top tracks from primary and related artists
                    for a_id in related_ids:
                        sub_limit = max(5, limit // len(related_ids))
                        r_resp = await client.get(f"https://api.deezer.com/artist/{a_id}/radio?limit={sub_limit}")
                        if r_resp.status_code == 200:
                            tracks_data = r_resp.json().get("data", [])
                            for t in tracks_data:
                                tid = f"dz_{t['id']}"
                                if any(x["id"] == tid for x in radio_tracks):
                                    continue
                                radio_tracks.append({
                                    "id": tid,
                                    "title": t.get("title", ""),
                                    "artist": t.get("artist", {}).get("name", ""),
                                    "album": t.get("album", {}).get("title", ""),
                                    "duration_seconds": t.get("duration", 0),
                                    "cover_url": t.get("album", {}).get("cover_big", "") or t.get("album", {}).get("cover_medium", ""),
                                    "source_type": "deezer",
                                    "source_id": str(t["id"])
                                })
                        if len(radio_tracks) >= limit:
                            break
        except Exception as e:
            logger.warning(f"Error generating fallback Deezer track radio: {e}")

        return radio_tracks[:limit]

    def get_user_implicit_feedback(self, user_id: str, db: Session) -> Dict[str, Any]:
        """
        Extracts implicit telemetry signals:
        - Penalized artists (frequently skipped with low completion)
        - Completed artists (rewarded/boosted)
        - Dayparting hours distribution
        """
        try:
            recent_events = (
                db.query(ListeningHistory)
                .options(joinedload(ListeningHistory.track))
                .filter(ListeningHistory.user_id == user_id)
                .order_by(ListeningHistory.played_at.desc())
                .limit(100)
                .all()
            )
            skipped_artists = set()
            completed_artists = set()
            hour_counts: Dict[int, Dict[str, int]] = {}

            for h in recent_events:
                if not h.track:
                    continue
                art = (h.track.artist or "").strip().lower()
                if h.skipped or (h.completion_rate and h.completion_rate < 0.25):
                    if art:
                        skipped_artists.add(art)
                elif h.completed or (h.completion_rate and h.completion_rate >= 0.75):
                    if art:
                        completed_artists.add(art)
                if h.hour_of_day is not None and art:
                    hour_counts.setdefault(h.hour_of_day, {}).setdefault(art, 0)
                    hour_counts[h.hour_of_day][art] += 1

            penalized = {a for a in skipped_artists if a not in completed_artists}
            return {
                "penalized_artists": penalized,
                "completed_artists": completed_artists,
                "hour_counts": hour_counts
            }
        except Exception as e:
            logger.warning(f"Error fetching user implicit feedback: {e}")
            return {"penalized_artists": set(), "completed_artists": set(), "hour_counts": {}}

    async def generate_daily_mixes(
        self,
        user_id: str,
        db: Session,
        client_hour: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate personalized Daily Mixes (1 to 3) based on user's Liked Songs and Listening History.
        Enhanced with:
        - Skip-penalty filtering (penalized artists with low completion are deprioritized)
        - Completion boost (frequently completed tracks prioritized as seeds)
        - Time-of-day / dayparting contextual mixes
        """
        # Fetch implicit feedback profile
        telemetry = self.get_user_implicit_feedback(user_id, db)
        penalized_artists = telemetry["penalized_artists"]

        # Get user's liked tracks in a single JOIN query
        liked = (
            db.query(LikedSong)
            .options(joinedload(LikedSong.track))
            .filter(LikedSong.user_id == user_id)
            .order_by(LikedSong.liked_at.desc())
            .limit(60)
            .all()
        )
        # Get recently played in a single JOIN query
        history = (
            db.query(ListeningHistory)
            .options(joinedload(ListeningHistory.track))
            .filter(ListeningHistory.user_id == user_id)
            .order_by(ListeningHistory.played_at.desc())
            .limit(60)
            .all()
        )

        seed_tracks = []
        seen_ids = set()
        for l in liked:
            if l.track and l.track.id not in seen_ids:
                seen_ids.add(l.track.id)
                seed_tracks.append(l.track)
        for h in history:
            if h.track and h.track.id not in seen_ids:
                seen_ids.add(h.track.id)
                seed_tracks.append(h.track)

        # Check daily cache
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        cache_key = f"daily_mixes_{user_id}_{date_str}"
        cached = cache_service.get(cache_key, db)
        if cached and isinstance(cached, list) and len(cached) >= 3:
            return cached

        # Detect time-of-day dayparting
        now_hour = client_hour if client_hour is not None else datetime.now(timezone.utc).hour
        if 5 <= now_hour < 12:
            daypart_title = "Morning Flow"
            daypart_desc = "Fresh acoustic, lo-fi beats, and steady rhythm for your morning."
        elif 12 <= now_hour < 18:
            daypart_title = "Afternoon Energy"
            daypart_desc = "High-energy grooves and upbeat tracks to power your afternoon."
        elif 18 <= now_hour < 23:
            daypart_title = "Evening Wind Down"
            daypart_desc = "Mellow melodies, warm vocals, and sunset relaxation."
        else:
            daypart_title = "Night Owl Chill"
            daypart_desc = "Atmospheric synth, ambient sounds, and midnight vibes."

        from .metadata import metadata_service

        curated_defaults = [
            ("Daily Mix 1", "genre_dance", "Club bangers, house, and electronic festival heaters"),
            ("Daily Mix 2", "genre_hiphop", "Heavy hitters in trap, drill, US and UK hip-hop"),
            ("Daily Mix 3", "genre_reggae", "Roots, dub, dancehall and weekly reggae vibes"),
            ("Daily Mix 4", "chart_global", "The biggest streaming hits worldwide"),
            ("Daily Mix 5", "genre_rock", "Alternative, indie, classic and modern rock anthems"),
            ("Daily Mix 6", "mood_focus", "Mellow beats, instrumental chillhop, and focus flow"),
        ]

        if not seed_tracks:
            # Generate 6 curated mixes from genres
            mixes = []
            for i, (mix_title_def, chart_key, fallback_desc) in enumerate(curated_defaults):
                mix_num = i + 1
                chart_data = await metadata_service.get_playlist_details(chart_key)
                tracks = chart_data.get("tracks", []) if chart_data else []
                rng = random.Random(f"default_{date_str}_{mix_num}")
                rotated_tracks = list(tracks)
                rng.shuffle(rotated_tracks)
                mix_title = f"Daily Mix {mix_num}"
                if mix_num == 1:
                    mix_title = f"Daily Mix 1 • {daypart_title}"
                mixes.append({
                    "id": f"daily_mix_{mix_num}",
                    "title": mix_title,
                    "description": fallback_desc,
                    "cover_url": rotated_tracks[0]["cover_url"] if rotated_tracks else "",
                    "tracks": rotated_tracks[:30]
                })
            cache_service.set(cache_key, mixes, ttl_seconds=86400, db=db)
            return mixes

        # Cluster by artist, filtering out penalized artists
        artist_groups: Dict[str, List[Track]] = {}
        for t in seed_tracks:
            if t.artist:
                art_norm = t.artist.strip().lower()
                if art_norm in penalized_artists:
                    continue # Skip penalized artist
                artist_groups.setdefault(t.artist, []).append(t)

        # If all artists were penalized, fall back to unfiltered artist groups
        if not artist_groups:
            for t in seed_tracks:
                if t.artist:
                    artist_groups.setdefault(t.artist, []).append(t)

        sorted_artists = sorted(artist_groups.keys(), key=lambda a: len(artist_groups[a]), reverse=True)[:6]

        # Concurrently fetch recommendations for all top seed artists
        tasks = [
            self.get_track_radio(artist_groups[art][0].title, art, limit=25)
            for art in sorted_artists
        ]
        recommended_results = await asyncio.gather(*tasks, return_exceptions=True)

        mixes = []
        for idx, seed_artist in enumerate(sorted_artists):
            user_artist_tracks = artist_groups[seed_artist]
            first_track = user_artist_tracks[0]

            rec_res = recommended_results[idx]
            recommended = rec_res if not isinstance(rec_res, Exception) else []

            # Filter out any penalized artists from recommendations as well
            recommended = [
                r for r in recommended
                if r.get("artist", "").strip().lower() not in penalized_artists
            ]

            # Rotate discoveries daily with date seed
            rng = random.Random(f"{user_id}_{date_str}_{idx}")
            rng.shuffle(recommended)

            # Combine known favorite tracks + recommended similar tracks
            combined = []
            for t in user_artist_tracks:
                combined.append({
                    "id": t.id,
                    "title": t.title,
                    "artist": t.artist,
                    "album": t.album,
                    "duration_seconds": t.duration_seconds,
                    "cover_url": t.cover_url,
                    "source_type": t.source_type,
                    "source_id": t.source_id
                })
            for r in recommended:
                if not any(c["title"].lower() == r["title"].lower() for c in combined):
                    combined.append(r)

            mix_num = idx + 1
            mix_title = f"Daily Mix {mix_num}"
            if mix_num == 1:
                mix_title = f"Daily Mix 1 • {daypart_title}"

            second_artist = recommended[0]["artist"] if recommended and recommended[0].get("artist") != seed_artist else "more"
            mixes.append({
                "id": f"daily_mix_{mix_num}",
                "title": mix_title,
                "description": f"Featuring {seed_artist}, {second_artist} and similar music.",
                "cover_url": first_track.cover_url or (recommended[0]["cover_url"] if recommended else ""),
                "tracks": combined[:30]
            })

        # If user had fewer than 6 artist clusters, backfill remaining mixes up to 6
        if len(mixes) < 6:
            for fallback_idx in range(len(mixes), 6):
                mix_num = fallback_idx + 1
                _, chart_key, fallback_desc = curated_defaults[fallback_idx]
                try:
                    chart_data = await metadata_service.get_playlist_details(chart_key)
                    tracks = chart_data.get("tracks", []) if chart_data else []
                    rng = random.Random(f"{user_id}_{date_str}_{mix_num}")
                    rotated_tracks = list(tracks)
                    rng.shuffle(rotated_tracks)
                    mixes.append({
                        "id": f"daily_mix_{mix_num}",
                        "title": f"Daily Mix {mix_num}",
                        "description": fallback_desc,
                        "cover_url": rotated_tracks[0]["cover_url"] if rotated_tracks else "",
                        "tracks": rotated_tracks[:30]
                    })
                except Exception as e:
                    logger.warning(f"Failed to generate fallback Daily Mix {mix_num}: {e}")

        cache_service.set(cache_key, mixes, ttl_seconds=86400, db=db)
        return mixes

recommender_service = RecommenderService()
