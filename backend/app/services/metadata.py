import asyncio
import httpx
import logging
import urllib.parse
from typing import List, Dict, Any, Optional

from .http_client import get_http_client
from .yt_client import get_ytmusic
from .cache_service import cache_service

logger = logging.getLogger(__name__)

class MetadataService:
    def __init__(self):
        pass

    def _get_ytmusic(self):
        return get_ytmusic()

    async def search(self, query: str, limit: int = 20, include_yt: bool = False) -> Dict[str, Any]:
        """
        Unified search for Songs, Artists, and Albums.
        """
        results = {
            "tracks": [],
            "artists": [],
            "albums": [],
            "playlists": []
        }

        # Intercept YouTube playlist URLs directly
        if "youtube.com" in query or "youtu.be" in query:
            import re
            pl_match = re.search(r'[?&]list=([a-zA-Z0-9_-]+)', query)
            if pl_match:
                pl_id = pl_match.group(1)
                clean_pl_id = pl_id.replace("VL", "") if pl_id.startswith("VL") else pl_id
                ytm = self._get_ytmusic()
                if ytm:
                    try:
                        pl_info = ytm.get_playlist(clean_pl_id, limit=5)
                        thumbnails = pl_info.get("thumbnails", [])
                        cover = thumbnails[-1]["url"] if thumbnails else ""
                        author = pl_info.get("author") or "YouTube"
                        if isinstance(author, dict):
                            author = author.get("name", "YouTube")
                        results["playlists"].append({
                            "id": f"yt_playlist_{clean_pl_id}",
                            "source_id": f"yt_playlist_{clean_pl_id}",
                            "source_type": "youtube",
                            "title": pl_info.get("title", "YouTube Playlist"),
                            "description": pl_info.get("description") or f"YouTube Playlist by {author}",
                            "cover_url": cover,
                            "curator": str(author),
                            "track_count": pl_info.get("trackCount") or len(pl_info.get("tracks", [])),
                            "is_chart": False
                        })
                    except Exception as e:
                        logger.warning(f"Direct YouTube playlist resolution failed: {e}")

        # Intercept Spotify URLs (tracks, albums, playlists) and resolve title/artist
        if "spotify.com" in query:
            try:
                clean_url = query.strip()
                if " " in clean_url:
                    for part in clean_url.split():
                        if "spotify.com" in part:
                            clean_url = part
                            break
                client = get_http_client()
                oembed_resp = await client.get(f"https://open.spotify.com/oembed?url={clean_url}")
                if oembed_resp.status_code == 200:
                    oembed_data = oembed_resp.json()
                    title = oembed_data.get("title", "")
                    if title:
                        query = title
            except Exception as e:
                logger.warning(f"Spotify link resolution failed: {e}")

        # 1. Search YouTube Music for tracks (great for remixes, singles, TikTok)
        ytm = self._get_ytmusic()
        if ytm:
            try:
                yt_results = ytm.search(query, filter="songs", limit=limit)
                for item in yt_results:
                    video_id = item.get("videoId")
                    if not video_id:
                        continue
                    thumbnails = item.get("thumbnails", [])
                    cover_url = thumbnails[-1]["url"] if thumbnails else ""
                    artists = item.get("artists", [])
                    artist_name = ", ".join([a["name"] for a in artists if "name" in a]) or "Unknown Artist"

                    duration_seconds = item.get("duration_seconds", 0)
                    if not duration_seconds and "duration" in item:
                        parts = str(item["duration"]).split(":")
                        if len(parts) == 2:
                            duration_seconds = int(parts[0]) * 60 + int(parts[1])
                        elif len(parts) == 3:
                            duration_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])

                    album_info = item.get("album")
                    album_name = album_info.get("name") if isinstance(album_info, dict) else (album_info or "")

                    results["tracks"].append({
                        "id": f"yt_{video_id}",
                        "title": item.get("title", "Unknown Title"),
                        "artist": artist_name,
                        "album": album_name,
                        "duration_seconds": duration_seconds,
                        "cover_url": cover_url,
                        "source_type": "youtube",
                        "source_id": video_id
                    })
            except Exception as e:
                logger.warning(f"YTMusic search tracks failed: {e}")

        # 2. Search Deezer for Artists, Albums, and additional studio tracks concurrently
        try:
            client = get_http_client()
            artist_task = client.get(f"https://api.deezer.com/search/artist?q={query}&limit=6")
            album_task = client.get(f"https://api.deezer.com/search/album?q={query}&limit=8")

            resps = await asyncio.gather(artist_task, album_task, return_exceptions=True)
            artist_resp, album_resp = resps[0], resps[1]

            if not isinstance(artist_resp, Exception) and artist_resp.status_code == 200:
                for a in artist_resp.json().get("data", []):
                    results["artists"].append({
                        "id": f"dz_artist_{a['id']}",
                        "artist_id": str(a["id"]),
                        "name": a.get("name", "Unknown Artist"),
                        "picture_url": a.get("picture_xl") or a.get("picture_big") or a.get("picture_medium"),
                        "fan_count": a.get("nb_fan", 0),
                    })

            if not isinstance(album_resp, Exception) and album_resp.status_code == 200:
                for alb in album_resp.json().get("data", []):
                    results["albums"].append({
                        "id": f"dz_album_{alb['id']}",
                        "album_id": str(alb["id"]),
                        "title": alb.get("title", "Unknown Album"),
                        "artist": alb.get("artist", {}).get("name", "Unknown Artist"),
                        "cover_url": alb.get("cover_xl") or alb.get("cover_big") or alb.get("cover_medium"),
                        "release_date": alb.get("release_date", ""),
                        "track_count": alb.get("nb_tracks", 0),
                    })

            # Supplementary tracks if needed
            if len(results["tracks"]) < 5:
                track_resp = await client.get(f"https://api.deezer.com/search/track?q={query}&limit={limit}")
                if track_resp.status_code == 200:
                    for item in track_resp.json().get("data", []):
                        title = item.get("title", "")
                        artist = item.get("artist", {}).get("name", "")
                        if any(t["title"].lower() == title.lower() and t["artist"].lower() == artist.lower() for t in results["tracks"]):
                            continue
                        results["tracks"].append({
                            "id": f"dz_{item['id']}",
                            "title": title,
                            "artist": artist,
                            "album": item.get("album", {}).get("title", ""),
                            "duration_seconds": item.get("duration", 0),
                            "cover_url": item.get("album", {}).get("cover_big", "") or item.get("album", {}).get("cover_medium", ""),
                            "source_type": "deezer",
                            "source_id": str(item["id"])
                        })
        except Exception as e:
            logger.warning(f"Deezer search failed: {e}")

        # 3. Search curated playlists and charts
        try:
            results["playlists"] = await self.search_playlists(query=query, limit=10)
        except Exception as e:
            logger.warning(f"Playlist search failed: {e}")

        # 4. Search YouTube for Playlists and Channel Artists if include_yt is enabled
        if include_yt and ytm:
            try:
                yt_playlists = ytm.search(query, filter="playlists", limit=12)
                for item in yt_playlists:
                    browse_id = item.get("browseId") or ""
                    pl_id = browse_id.replace("VL", "") if browse_id.startswith("VL") else browse_id
                    if not pl_id or any(p.get("source_id") == f"yt_playlist_{pl_id}" for p in results["playlists"]):
                        continue
                    thumbnails = item.get("thumbnails", [])
                    cover = thumbnails[-1]["url"] if thumbnails else ""
                    author = item.get("author") or "YouTube"
                    if isinstance(author, dict):
                        author = author.get("name", "YouTube")
                    results["playlists"].append({
                        "id": f"yt_playlist_{pl_id}",
                        "source_id": f"yt_playlist_{pl_id}",
                        "source_type": "youtube",
                        "title": item.get("title", "YouTube Playlist"),
                        "description": f"YouTube Playlist by {author}",
                        "cover_url": cover,
                        "curator": str(author),
                        "track_count": item.get("itemCount") or 0,
                        "is_chart": False
                    })
            except Exception as e:
                logger.warning(f"YTMusic search playlists failed: {e}")

            try:
                yt_artists = ytm.search(query, filter="artists", limit=6)
                for a in yt_artists:
                    browse_id = a.get("browseId")
                    if not browse_id:
                        continue
                    thumbnails = a.get("thumbnails", [])
                    picture = thumbnails[-1]["url"] if thumbnails else ""
                    if any(ea["name"].lower() == a.get("artist", "").lower() for ea in results["artists"]):
                        continue
                    results["artists"].append({
                        "id": f"yt_artist_{browse_id}",
                        "artist_id": browse_id,
                        "name": a.get("artist", "Unknown Artist"),
                        "picture_url": picture,
                        "fan_count": 0,
                        "source_type": "youtube"
                    })
            except Exception as e:
                logger.warning(f"YTMusic search artists failed: {e}")

        # Smart Artist Re-ranking & Deduplication by match relevance and fan count
        norm_q = query.strip().lower()

        def artist_rank_key(a: Dict[str, Any]) -> tuple:
            name = a.get("name", "").strip().lower()
            is_exact = 1 if name == norm_q else 0
            is_word_match = 1 if norm_q in name.split() else 0
            is_prefix = 1 if name.startswith(norm_q) else 0
            fan_count = a.get("fan_count", 0) or 0
            return (is_exact, is_word_match, is_prefix, fan_count)

        if results.get("artists"):
            # Deduplicate by normalized name keeping highest fan count
            seen_artists: Dict[str, Dict[str, Any]] = {}
            for a in results["artists"]:
                norm_name = a.get("name", "").strip().lower()
                if norm_name not in seen_artists or (a.get("fan_count", 0) or 0) > (seen_artists[norm_name].get("fan_count", 0) or 0):
                    seen_artists[norm_name] = a

            sorted_artists = list(seen_artists.values())
            sorted_artists.sort(key=artist_rank_key, reverse=True)
            results["artists"] = sorted_artists

        return results

    async def get_artist_details(self, artist_id: str) -> Dict[str, Any]:
        """
        Fetch full artist page data: header details, top popular tracks, and full album discography.
        Cached in-memory and in SQLite for ultra-fast navigation.
        """
        cache_key = f"artist_details_{artist_id}"
        cached = cache_service.get(cache_key)
        if cached:
            return cached

        clean_id = artist_id.replace("dz_artist_", "").replace("dz_", "")
        
        # If artist identifier is a plain name (e.g. 'Ella Langley' or 'Oasis') and not a numeric ID or yt_artist_
        if not clean_id.isdigit() and not artist_id.startswith("yt_artist_"):
            try:
                client = get_http_client()
                search_resp = await client.get(f"https://api.deezer.com/search/artist?q={urllib.parse.quote(clean_id)}&limit=1")
                if search_resp.status_code == 200:
                    search_data = search_resp.json().get("data", [])
                    if search_data:
                        clean_id = str(search_data[0]["id"])
            except Exception as e:
                logger.warning(f"Failed to resolve artist by name '{clean_id}' on Deezer: {e}")

            if not clean_id.isdigit():
                ytm = self._get_ytmusic()
                if ytm:
                    try:
                        yt_artists = ytm.search(clean_id, filter="artists", limit=1)
                        if yt_artists and yt_artists[0].get("browseId"):
                            artist_id = f"yt_artist_{yt_artists[0]['browseId']}"
                    except Exception as e:
                        logger.warning(f"Failed to resolve artist on YT: {e}")

        data = {
            "id": f"dz_artist_{clean_id}",
            "name": "Unknown Artist",
            "picture_url": "",
            "fan_count": 0,
            "top_tracks": [],
            "albums": [],
            "related_artists": []
        }

        if artist_id.startswith("yt_artist_"):
            clean_id = artist_id.replace("yt_artist_", "")
            data["id"] = f"yt_artist_{clean_id}"
            ytm = self._get_ytmusic()
            if ytm:
                try:
                    art = ytm.get_artist(clean_id)
                    data["name"] = art.get("name", "YouTube Artist")
                    thumbnails = art.get("thumbnails", [])
                    data["picture_url"] = thumbnails[-1]["url"] if thumbnails else ""
                    if "subscribers" in art:
                        data["fan_count"] = art["subscribers"]

                    if "songs" in art and "results" in art["songs"]:
                        for s in art["songs"]["results"]:
                            vid = s.get("videoId")
                            if not vid:
                                continue
                            s_thumbs = s.get("thumbnails", [])
                            s_cover = s_thumbs[-1]["url"] if s_thumbs else data["picture_url"]
                            artists = s.get("artists", [])
                            art_str = ", ".join([a["name"] for a in artists if "name" in a]) or data["name"]
                            data["top_tracks"].append({
                                "id": f"yt_{vid}",
                                "title": s.get("title", "Unknown Track"),
                                "artist": art_str,
                                "album": s.get("album", {}).get("name", "") if isinstance(s.get("album"), dict) else "",
                                "duration_seconds": s.get("duration_seconds") or 180,
                                "cover_url": s_cover,
                                "source_type": "youtube",
                                "source_id": vid
                            })

                    for section_key in ["singles", "albums"]:
                        if section_key in art and "results" in art[section_key]:
                            for alb in art[section_key]["results"]:
                                alb_thumbs = alb.get("thumbnails", [])
                                alb_cover = alb_thumbs[-1]["url"] if alb_thumbs else data["picture_url"]
                                data["albums"].append({
                                    "id": f"yt_playlist_{alb.get('browseId', '')}",
                                    "album_id": alb.get("browseId", ""),
                                    "title": alb.get("title", "Unknown Release"),
                                    "artist": data["name"],
                                    "cover_url": alb_cover,
                                    "release_date": alb.get("year", ""),
                                    "track_count": 0
                                })
                    cache_service.set(cache_key, data, ttl_seconds=86400)
                    return data
                except Exception as e:
                    logger.error(f"Failed to fetch YouTube artist details {clean_id}: {e}")

        try:
            client = get_http_client()
            info_task = client.get(f"https://api.deezer.com/artist/{clean_id}")
            top_task = client.get(f"https://api.deezer.com/artist/{clean_id}/top?limit=10")
            albums_task = client.get(f"https://api.deezer.com/artist/{clean_id}/albums?limit=50")
            rel_task = client.get(f"https://api.deezer.com/artist/{clean_id}/related?limit=8")

            resps = await asyncio.gather(info_task, top_task, albums_task, rel_task, return_exceptions=True)
            info_resp, top_resp, album_resp, rel_resp = resps[0], resps[1], resps[2], resps[3]

            # 1. Base Artist Info
            if not isinstance(info_resp, Exception) and info_resp.status_code == 200:
                info = info_resp.json()
                data["name"] = info.get("name", "Unknown Artist")
                data["picture_url"] = info.get("picture_xl") or info.get("picture_big") or info.get("picture_medium", "")
                data["fan_count"] = info.get("nb_fan", 0)

            # 2. Top Popular Songs
            if not isinstance(top_resp, Exception) and top_resp.status_code == 200:
                for t in top_resp.json().get("data", []):
                    data["top_tracks"].append({
                        "id": f"dz_{t['id']}",
                        "title": t.get("title", ""),
                        "artist": data["name"],
                        "album": t.get("album", {}).get("title", ""),
                        "duration_seconds": t.get("duration", 0),
                        "cover_url": t.get("album", {}).get("cover_big", "") or t.get("album", {}).get("cover_medium", ""),
                        "source_type": "deezer",
                        "source_id": str(t["id"])
                    })

            # 3. Discography / Albums
            if not isinstance(album_resp, Exception) and album_resp.status_code == 200:
                for alb in album_resp.json().get("data", []):
                    data["albums"].append({
                        "id": f"dz_album_{alb['id']}",
                        "album_id": str(alb["id"]),
                        "title": alb.get("title", ""),
                        "artist": data["name"],
                        "cover_url": alb.get("cover_xl") or alb.get("cover_big") or alb.get("cover_medium", ""),
                        "release_date": alb.get("release_date", ""),
                        "track_count": alb.get("nb_tracks", 0),
                        "record_type": alb.get("record_type", "album")
                    })

            # 4. Related Artists
            if not isinstance(rel_resp, Exception) and rel_resp.status_code == 200:
                for rel in rel_resp.json().get("data", []):
                    data["related_artists"].append({
                        "id": f"dz_artist_{rel['id']}",
                        "artist_id": str(rel["id"]),
                        "name": rel.get("name", ""),
                        "picture_url": rel.get("picture_xl") or rel.get("picture_big") or rel.get("picture_medium", ""),
                        "fan_count": rel.get("nb_fan", 0)
                    })

            if data["name"] != "Unknown Artist":
                cache_service.set(cache_key, data, ttl_seconds=86400)
        except Exception as e:
            logger.error(f"Failed to fetch artist details for {artist_id}: {e}")

        return data

    async def get_album_details(self, album_id: str) -> Dict[str, Any]:
        """
        Fetch full album details and tracklist.
        Cached in-memory and in SQLite for instant repeat lookups.
        """
        clean_id = album_id.replace("dz_album_", "").replace("dz_", "")
        cache_key = f"album_details_{clean_id}"
        cached = cache_service.get(cache_key)
        if cached:
            return cached

        data = {
            "id": f"dz_album_{clean_id}",
            "title": "Unknown Album",
            "artist": "Unknown Artist",
            "artist_id": "",
            "cover_url": "",
            "release_date": "",
            "tracks": []
        }

        try:
            client = get_http_client()
            resp = await client.get(f"https://api.deezer.com/album/{clean_id}")
            if resp.status_code == 200:
                alb = resp.json()
                data["title"] = alb.get("title", "")
                data["artist"] = alb.get("artist", {}).get("name", "")
                data["artist_id"] = f"dz_artist_{alb.get('artist', {}).get('id', '')}"
                data["cover_url"] = alb.get("cover_xl") or alb.get("cover_big") or alb.get("cover_medium", "")
                data["release_date"] = alb.get("release_date", "")

                tracks_data = alb.get("tracks", {}).get("data", [])
                for idx, t in enumerate(tracks_data):
                    data["tracks"].append({
                        "id": f"dz_{t['id']}",
                        "title": t.get("title", ""),
                        "artist": t.get("artist", {}).get("name") or data["artist"],
                        "album": data["title"],
                        "duration_seconds": t.get("duration", 0),
                        "cover_url": data["cover_url"],
                        "source_type": "deezer",
                        "source_id": str(t["id"]),
                        "track_position": idx + 1
                    })

                if data["title"] != "Unknown Album":
                    cache_service.set(cache_key, data, ttl_seconds=86400)
        except Exception as e:
            logger.error(f"Failed to fetch album details for {album_id}: {e}")

        return data

    async def get_trending_charts(self, limit: int = 30) -> List[Dict[str, Any]]:
        """
        Fetch current trending tracks & charts with full metadata pre-populated.
        Cached for 3 hours.
        """
        cache_key = f"trending_charts_{limit}"
        cached = cache_service.get(cache_key)
        if cached:
            return cached

        tracks = []
        try:
            client = get_http_client()
            resp = await client.get(f"https://api.deezer.com/chart/0/tracks?limit={limit}")
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                for item in data:
                    tracks.append({
                        "id": f"dz_{item['id']}",
                        "title": item.get("title", "Unknown"),
                        "artist": item.get("artist", {}).get("name", "Unknown Artist"),
                        "album": item.get("album", {}).get("title", ""),
                        "duration_seconds": item.get("duration", 0),
                        "cover_url": item.get("album", {}).get("cover_big", "") or item.get("album", {}).get("cover_medium", ""),
                        "source_type": "deezer",
                        "source_id": str(item["id"])
                    })
                if tracks:
                    cache_service.set(cache_key, tracks, ttl_seconds=10800)
                return tracks
        except Exception as e:
            logger.warning(f"Failed to fetch Deezer charts: {e}")

        return tracks

    async def get_featured_charts(self) -> List[Dict[str, Any]]:
        """
        Returns official curated charts for UK, US, and Global top tracks.
        """
        return [
            {
                "id": "chart_uk",
                "source_id": "1111142221",
                "source_type": "chart",
                "title": "Official UK Top 40",
                "description": "The UK's biggest songs of the week, updated every Friday with official chart data.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/61230f228f1a14d6c5dd58bb42f65213/500x500-000000-80-0-0.jpg",
                "curator": "Official UK Charts",
                "track_count": 40,
                "is_chart": True,
                "badge": "🇬🇧 Top 40"
            },
            {
                "id": "chart_us",
                "source_id": "1313621735",
                "source_type": "chart",
                "title": "Billboard Hot 100",
                "description": "The standard music industry chart in the United States for songs across all genres.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/93ce61d763eb8784adfa00570b77b1e1/500x500-000000-80-0-0.jpg",
                "curator": "Billboard Charts",
                "track_count": 100,
                "is_chart": True,
                "badge": "🇺🇸 Hot 100"
            },
            {
                "id": "chart_global",
                "source_id": "3155776842",
                "source_type": "chart",
                "title": "Global Top 50",
                "description": "The most streamed tracks right now across the entire world, updated daily.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/e08fdf1fb762ab8f62f3e8b4e72304d9/500x500-000000-80-0-0.jpg",
                "curator": "Global Charts",
                "track_count": 50,
                "is_chart": True,
                "badge": "🌍 Global Top"
            },
            {
                "id": "chart_viral",
                "source_id": "1109890291",
                "source_type": "chart",
                "title": "Global Viral & Trending 50",
                "description": "Tracks blowing up across TikTok, YouTube, and streaming platforms worldwide.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/2ea7b539b78be4c940b2f6dfbb6b9a89/500x500-000000-80-0-0.jpg",
                "curator": "Viral Discovery",
                "track_count": 50,
                "is_chart": True,
                "badge": "🔥 Viral Hits"
            },
        ]

    async def get_genre_playlists(self) -> List[Dict[str, Any]]:
        """
        Returns official curated playlists for popular genres: Country, Reggae, Dance, Hip-Hop, Rock, R&B, Afrobeats, Latin, Indie, Acoustic.
        """
        return [
            {
                "id": "genre_country",
                "source_id": "1130102843",
                "source_type": "genre",
                "title": "Country Hits",
                "description": "The hottest modern and classic country anthems, storytelling, and Nashville hits.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/99d1e27b0eef892e67af71352c980de9/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Country Editor",
                "track_count": 75,
                "badge": "🤠 Country",
                "color": "from-amber-700 to-amber-950"
            },
            {
                "id": "genre_reggae",
                "source_id": "1503415633",
                "source_type": "genre",
                "title": "Reggae Hits",
                "description": "Roots, dub, dancehall and classic reggae vibes to lift your spirits.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/999d0c0c75fb293fa9f36ebc94195958/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Reggae Editor",
                "track_count": 50,
                "badge": "🇯🇲 Reggae",
                "color": "from-emerald-700 to-emerald-950"
            },
            {
                "id": "genre_dance",
                "source_id": "706093725",
                "source_type": "genre",
                "title": "Global Dance Hits",
                "description": "Club bangers, house, EDM, tech house and electronic festival heaters.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/2f1d4193f98aaa3ab20c75b408119de2/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Dance & EDM Editor",
                "track_count": 50,
                "badge": "🪩 Dance & EDM",
                "color": "from-cyan-700 to-blue-950"
            },
            {
                "id": "genre_hiphop",
                "source_id": "1677006641",
                "source_type": "genre",
                "title": "Hot Urban & Hip-Hop",
                "description": "Heavy hitters in trap, drill, US and UK hip-hop dominating the streets.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/8f5934e0624fa50df71326b7839c7a09/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Rap Editor",
                "track_count": 50,
                "badge": "🎤 Hip-Hop",
                "color": "from-purple-800 to-indigo-950"
            },
            {
                "id": "genre_rock",
                "source_id": "752286631",
                "source_type": "genre",
                "title": "Rock Hits",
                "description": "Alternative, indie, classic and modern rock anthems with pure guitar power.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/93808e766e0946dc891f56d8dc7e75a9/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Rock Editor",
                "track_count": 80,
                "badge": "🎸 Rock",
                "color": "from-red-800 to-stone-950"
            },
            {
                "id": "genre_rnb",
                "source_id": "1999466402",
                "source_type": "genre",
                "title": "R&B Hits",
                "description": "Silky smooth vocals, modern slow jams and soulful contemporary grooves.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/d21efd833a2057fe4e9d55bb3828f4a9/500x500-000000-80-0-0.jpg",
                "curator": "Deezer R&B Editor",
                "track_count": 50,
                "badge": "✨ R&B & Soul",
                "color": "from-rose-700 to-pink-950"
            },
            {
                "id": "genre_afrobeats",
                "source_id": "3153080842",
                "source_type": "genre",
                "title": "Afrobeats Hits",
                "description": "Amapiano, Naija pop, highlife and the rhythmic sound taking over the globe.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/fcf0fab13657785633794d73908d9249/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Afro Editor",
                "track_count": 50,
                "badge": "🌍 Afrobeats",
                "color": "from-yellow-600 to-amber-950"
            },
            {
                "id": "genre_latin",
                "source_id": "178699142",
                "source_type": "genre",
                "title": "Fuego Latino",
                "description": "Reggaeton, bachata, Latin trap and fiery urban rhythms that never stop.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/a0b09c1e7c0f55bbcb20e948d1c26ba7/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Latin Editor",
                "track_count": 60,
                "badge": "🔥 Latin",
                "color": "from-orange-700 to-red-950"
            },
            {
                "id": "genre_indie",
                "source_id": "2558779444",
                "source_type": "genre",
                "title": "Indie Party",
                "description": "Essential indie rock, post-punk revival, and fresh alternative tracks.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/88b63dd081c0c7aac946135f7bb67662/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Alternative Editor",
                "track_count": 50,
                "badge": "🌿 Indie",
                "color": "from-teal-700 to-slate-950"
            },
            {
                "id": "genre_acoustic",
                "source_id": "9346933942",
                "source_type": "genre",
                "title": "Acoustic Hits",
                "description": "Stripped down acoustic, folk, and unplugged intimate listening.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/edd19d9f68500b7c96348505fa27c8b0/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Pop Editor",
                "track_count": 50,
                "category": "genres",
                "badge": "☕ Acoustic",
                "color": "from-amber-800 to-orange-950"
            },
            # Moods & Activities
            {
                "id": "mood_sleep",
                "source_id": "1323023495",
                "source_type": "genre",
                "category": "moods",
                "title": "Sleep & Deep Relaxation",
                "description": "Calming ambient soundscapes, soft piano, and delta tones for deep restorative sleep.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/acf1b0bd271fa9e868f3fecf1b6572d9/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Sleep Editor",
                "track_count": 50,
                "badge": "🌙 Sleep",
                "color": "from-indigo-950 to-slate-950"
            },
            {
                "id": "mood_focus",
                "source_id": "6399367984",
                "source_type": "genre",
                "category": "moods",
                "title": "Lofi Study & Deep Focus",
                "description": "Mellow beats, instrumental chillhop, and continuous flow for productive focus and study.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/dd65e37cd15fd92d2d4a24f71ecd9990/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Focus Editor",
                "track_count": 100,
                "badge": "🧠 Focus & Study",
                "color": "from-purple-900 to-slate-950"
            },
            {
                "id": "mood_workout",
                "source_id": "2532117644",
                "source_type": "genre",
                "category": "moods",
                "title": "Workout Beast Mode",
                "description": "High-tempo electronic, bass-heavy hip-hop, and gym energy motivation anthems.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/5f55d4c9033ff8e3b4bf5aa9f40c99d1/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Fitness Editor",
                "track_count": 80,
                "badge": "⚡ Workout",
                "color": "from-red-600 to-amber-950"
            },
            {
                "id": "event_dinner",
                "source_id": "7103686464",
                "source_type": "genre",
                "category": "moods",
                "title": "Chill Dinner Party",
                "description": "Sophisticated acoustic, vocal jazz, and warm lounge grooves for evening dining with friends.",
                "cover_url": "https://cdn-images.dzcdn.net/images/cover/0a4fad203aae90b9b5b66012664c8688-34c3b1660ae925f3a0d9053878b267c7-f8c73badf6e0722a1e07303dc104f420-eaa11823ef67e53e42dc3b4c0de1cf9f/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Moods Editor",
                "track_count": 50,
                "badge": "🥂 Dinner Party",
                "color": "from-amber-900 to-stone-950"
            },
            {
                "id": "event_roadtrip",
                "source_id": "2251726662",
                "source_type": "genre",
                "category": "moods",
                "title": "Road Trip Anthems",
                "description": "Open-highway singalongs, classic rock heaters, and upbeat adventure tracks.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/be59974d4f20e810827c83ad79685dbc/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Travel Editor",
                "track_count": 70,
                "badge": "🚗 Road Trip",
                "color": "from-sky-700 to-indigo-950"
            },
            # Kids & Family
            {
                "id": "kids_party",
                "source_id": "11629543264",
                "source_type": "genre",
                "category": "kids",
                "title": "Kids Birthday Party",
                "description": "High-energy singalongs, dance-party anthems, and celebration hits for children and families.",
                "cover_url": "https://cdn-images.dzcdn.net/images/cover/b4ff500ac3523e2ce881818f9ffb1879-b3071f0993c43043ccd8bf99e376cff1-7c1ef971128c0e68a4922dae481ac0e4-fe781ecd9879a82beed80f6d3e80745b/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Kids Editor",
                "track_count": 100,
                "badge": "🎈 Kids Party",
                "color": "from-pink-600 to-purple-950"
            },
            {
                "id": "kids_lullaby",
                "source_id": "6574809584",
                "source_type": "genre",
                "category": "kids",
                "title": "Baby Sleep & Lullabies",
                "description": "Gentle acoustic melodies, music box lullabies, and soothing bedtime sounds for infants and toddlers.",
                "cover_url": "https://cdn-images.dzcdn.net/images/cover/c18d62eabe1f6e0eca7dc5450491ee2d-6841ba816dce2ca4cf6b3b8fc04a8558-b917c49f811a414764a579cac4fb24e6-963eb510872a1c355aaba38dc45fb8b6/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Family Editor",
                "track_count": 100,
                "badge": "👶 Baby Lullaby",
                "color": "from-cyan-700 to-sky-950"
            },
            # Seasons & Events
            {
                "id": "season_summer",
                "source_id": "10265663282",
                "source_type": "genre",
                "category": "seasons",
                "title": "Summer Poolside Vibes",
                "description": "Sun-drenched tropical house, feel-good pop, and warm poolside rhythms for warm sunny days.",
                "cover_url": "https://cdn-images.dzcdn.net/images/cover/42e13c6a1f25fd821407b4d4762eb3ce-a7fb466d3186650ced59307edcf0306f-c9438c79814887bda6e6e624d9307c58-552d4b14030ff623aa13567f27705b68/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Summer Editor",
                "track_count": 100,
                "badge": "☀️ Summer Hits",
                "color": "from-yellow-500 to-amber-950"
            },
            {
                "id": "season_halloween",
                "source_id": "3726971126",
                "source_type": "genre",
                "category": "seasons",
                "title": "Halloween Party Hits",
                "description": "Spooky monster mash classics, creepy dancefloor heaters, and haunting October essentials.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/6b8670760e4b04b7ec67b2cae7e4c930/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Seasonal Editor",
                "track_count": 50,
                "badge": "🎃 Halloween",
                "color": "from-orange-600 to-zinc-950"
            },
            {
                "id": "season_christmas",
                "source_id": "8454338222",
                "source_type": "genre",
                "category": "seasons",
                "title": "Christmas Classics & Holiday",
                "description": "Cozy fireside warmth, timeless Christmas standards, and festive holiday celebration songs.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/d2ea6cd34136caa84a0f95f5ab4a85e0/500x500-000000-80-0-0.jpg",
                "curator": "Deezer Holiday Editor",
                "track_count": 50,
                "badge": "🎄 Holiday & Christmas",
                "color": "from-emerald-700 to-red-950"
            },
        ]

    async def search_playlists(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for curated playlists and charts across Deezer and YouTube Music.
        """
        playlists = []
        seen_titles = set()

        # Check if query matches UK Top 40 or Billboard
        q_lower = query.lower()
        if "uk" in q_lower and ("top" in q_lower or "chart" in q_lower or "40" in q_lower):
            playlists.append({
                "id": "chart_uk",
                "source_id": "1111142221",
                "source_type": "chart",
                "title": "Official UK Top 40",
                "description": "The UK's official singles chart, updated every Friday.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/61230f228f1a14d6c5dd58bb42f65213/500x500-000000-80-0-0.jpg",
                "curator": "Official Charts Company",
                "track_count": 40,
                "is_chart": True
            })
            seen_titles.add("official uk top 40")

        if "billboard" in q_lower or ("hot" in q_lower and "100" in q_lower) or ("us" in q_lower and "top" in q_lower):
            playlists.append({
                "id": "chart_us",
                "source_id": "1313621735",
                "source_type": "chart",
                "title": "Billboard Hot 100",
                "description": "The official standard United States singles chart.",
                "cover_url": "https://cdn-images.dzcdn.net/images/playlist/93ce61d763eb8784adfa00570b77b1e1/500x500-000000-80-0-0.jpg",
                "curator": "Billboard Charts",
                "track_count": 100,
                "is_chart": True
            })
            seen_titles.add("billboard hot 100")

        # 1. Deezer playlist search
        try:
            client = get_http_client()
            resp = await client.get(f"https://api.deezer.com/search/playlist?q={query}&limit={limit}")
            if resp.status_code == 200:
                for p in resp.json().get("data", []):
                    t_norm = p.get("title", "").strip().lower()
                    if t_norm in seen_titles:
                        continue
                    seen_titles.add(t_norm)
                    playlists.append({
                        "id": f"dz_playlist_{p['id']}",
                        "source_id": str(p["id"]),
                        "source_type": "deezer",
                        "title": p.get("title", "Untitled Playlist"),
                        "description": f"Curated by {p.get('user', {}).get('name', 'Community')}",
                        "cover_url": p.get("picture_xl") or p.get("picture_big") or p.get("picture_medium", ""),
                        "curator": p.get("user", {}).get("name", "Curated"),
                        "track_count": p.get("nb_tracks", 0),
                        "is_chart": "chart" in t_norm or "top" in t_norm or "billboard" in t_norm
                    })
        except Exception as e:
            logger.warning(f"Deezer search playlist failed: {e}")

        # 2. YouTube Music playlist search
        ytm = self._get_ytmusic()
        if ytm and len(playlists) < limit:
            try:
                yt_results = ytm.search(query, filter="playlists", limit=limit)
                for item in yt_results:
                    browse_id = item.get("browseId")
                    if not browse_id:
                        continue
                    t_norm = item.get("title", "").strip().lower()
                    if t_norm in seen_titles:
                        continue
                    seen_titles.add(t_norm)

                    thumbnails = item.get("thumbnails", [])
                    cover_url = thumbnails[-1]["url"] if thumbnails else ""
                    author = item.get("author", "YouTube Music")

                    playlists.append({
                        "id": f"yt_playlist_{browse_id}",
                        "source_id": browse_id,
                        "source_type": "youtube",
                        "title": item.get("title", "Untitled Playlist"),
                        "description": f"Curated by {author}",
                        "cover_url": cover_url,
                        "curator": author,
                        "track_count": int(item.get("itemCount", 0)) if item.get("itemCount") and str(item.get("itemCount")).isdigit() else 25,
                        "is_chart": "chart" in t_norm or "top" in t_norm or "billboard" in t_norm
                    })
            except Exception as e:
                logger.warning(f"YTMusic playlist search failed: {e}")

        return playlists

    async def get_playlist_details(self, playlist_id: str) -> Dict[str, Any]:
        """
        Resolve a virtual chart or external curated playlist into its full metadata and tracklist.
        """
        CHART_MAP = {
            "chart_uk": ("1111142221", "Official UK Top 40", 40, "The UK's biggest songs of the week, updated every Friday with official chart data."),
            "chart_us": ("1313621735", "Billboard Hot 100", 100, "The standard music industry chart in the United States for songs across all genres."),
            "chart_global": ("3155776842", "Global Top 50", 50, "The most streamed tracks right now across the entire world, updated daily."),
            "chart_viral": ("1109890291", "Global Viral & Trending 50", 50, "Tracks blowing up across TikTok, YouTube, and streaming platforms worldwide."),
            "genre_country": ("1130102843", "Country Hits", 75, "The hottest modern and classic country anthems, storytelling, and Nashville hits."),
            "genre_reggae": ("yt:PLxvodScTx2RsV2VIDIBksBmuLFngu3mgU", "Reggae Hits 2026", 50, "Roots, dub, dancehall and fresh weekly reggae anthems to lift your spirits."),
            "genre_dance": ("706093725", "Global Dance Hits", 50, "Club bangers, house, EDM, tech house and electronic festival heaters."),
            "genre_hiphop": ("1677006641", "Hot Urban & Hip-Hop", 50, "Heavy hitters in trap, drill, US and UK hip-hop dominating the streets."),
            "genre_rock": ("752286631", "Rock Hits", 80, "Alternative, indie, classic and modern rock anthems with pure guitar power."),
            "genre_rnb": ("1999466402", "R&B Hits", 50, "Silky smooth vocals, modern slow jams and soulful contemporary grooves."),
            "genre_afrobeats": ("3153080842", "Afrobeats Hits", 50, "Amapiano, Naija pop, highlife and the rhythmic sound taking over the globe."),
            "genre_latin": ("178699142", "Fuego Latino", 60, "Reggaeton, bachata, Latin trap and fiery urban rhythms that never stop."),
            "genre_indie": ("2558779444", "Indie Party", 50, "Essential indie rock, post-punk revival, and fresh alternative tracks."),
            "genre_acoustic": ("9346933942", "Acoustic Hits", 50, "Stripped down acoustic, folk, and unplugged intimate listening."),
            "mood_sleep": ("1323023495", "Sleep & Deep Relaxation", 50, "Calming ambient soundscapes, soft piano, and delta tones for deep restorative sleep."),
            "mood_focus": ("6399367984", "Lofi Study & Deep Focus", 100, "Mellow beats, instrumental chillhop, and continuous flow for productive focus and study."),
            "mood_workout": ("2532117644", "Workout Beast Mode", 80, "High-tempo electronic, bass-heavy hip-hop, and gym energy motivation anthems."),
            "event_dinner": ("7103686464", "Chill Dinner Party", 50, "Sophisticated acoustic, vocal jazz, and warm lounge grooves for evening dining with friends."),
            "event_roadtrip": ("2251726662", "Road Trip Anthems", 70, "Open-highway singalongs, classic rock heaters, and upbeat adventure tracks."),
            "kids_party": ("11629543264", "Kids Birthday Party", 100, "High-energy singalongs, dance-party anthems, and celebration hits for children and families."),
            "kids_lullaby": ("6574809584", "Baby Sleep & Lullabies", 100, "Gentle acoustic melodies, music box lullabies, and soothing bedtime sounds for infants and toddlers."),
            "season_summer": ("10265663282", "Summer Poolside Vibes", 100, "Sun-drenched tropical house, feel-good pop, and warm poolside rhythms for warm sunny days."),
            "season_halloween": ("3726971126", "Halloween Party Hits", 50, "Spooky monster mash classics, creepy dancefloor heaters, and haunting October essentials."),
            "season_christmas": ("8454338222", "Christmas Classics & Holiday", 50, "Cozy fireside warmth, timeless Christmas standards, and festive holiday celebration songs."),
        }

        clean_id = playlist_id
        override_title = None
        override_limit = None
        override_desc = None

        if clean_id in CHART_MAP:
            source_id, override_title, override_limit, override_desc = CHART_MAP[clean_id]
            if str(source_id).startswith("yt:") or str(source_id).startswith("PL") or str(source_id).startswith("RD"):
                clean_id = f"yt_playlist_{str(source_id).replace('yt:', '')}"
            else:
                clean_id = f"dz_playlist_{source_id}"

        data = {
            "id": playlist_id,
            "name": override_title or "Curated Playlist",
            "description": override_desc or "",
            "cover_url": "",
            "curator": "Official Charts",
            "is_chart": playlist_id.startswith(("chart_", "genre_", "mood_", "kids_", "season_", "event_")) or "top" in playlist_id.lower() or "chart" in playlist_id.lower(),
            "tracks": []
        }

        if clean_id.startswith("dz_playlist_"):
            real_id = clean_id.replace("dz_playlist_", "")
            try:
                client = get_http_client()
                resp = await client.get(f"https://api.deezer.com/playlist/{real_id}")
                if resp.status_code == 200:
                    pl = resp.json()
                    data["name"] = override_title or pl.get("title", data["name"])
                    data["description"] = override_desc or pl.get("description", "")
                    data["curator"] = pl.get("creator", {}).get("name") or pl.get("user", {}).get("name", "Curated")
                    data["cover_url"] = pl.get("picture_xl") or pl.get("picture_big") or pl.get("picture_medium", "")

                    raw_tracks = pl.get("tracks", {}).get("data", [])
                    if override_limit:
                        raw_tracks = raw_tracks[:override_limit]

                    for idx, t in enumerate(raw_tracks):
                        data["tracks"].append({
                            "id": f"dz_{t['id']}",
                            "title": t.get("title", "Unknown"),
                            "artist": t.get("artist", {}).get("name", "Unknown Artist"),
                            "album": t.get("album", {}).get("title", ""),
                            "duration_seconds": t.get("duration", 0),
                            "cover_url": t.get("album", {}).get("cover_big", "") or t.get("album", {}).get("cover_medium", "") or data["cover_url"],
                            "source_type": "deezer",
                            "source_id": str(t["id"]),
                            "position": idx + 1
                        })
            except Exception as e:
                logger.error(f"Failed to fetch Deezer playlist {real_id}: {e}")

        elif clean_id.startswith("yt_playlist_"):
            real_id = clean_id.replace("yt_playlist_", "")
            ytm = self._get_ytmusic()
            if ytm:
                try:
                    pl = ytm.get_playlist(real_id, limit=override_limit or 500)
                    data["name"] = override_title or pl.get("title", data["name"])
                    data["description"] = override_desc or pl.get("description", "")
                    data["curator"] = pl.get("author", {}).get("name", "YouTube") if isinstance(pl.get("author"), dict) else str(pl.get("author") or "YouTube")
                    data["source_type"] = "youtube"
                    data["source_id"] = f"yt_playlist_{real_id}"
                    data["is_chart"] = False
                    thumbnails = pl.get("thumbnails", [])
                    data["cover_url"] = thumbnails[-1]["url"] if thumbnails else ""

                    raw_tracks = pl.get("tracks", [])
                    if override_limit:
                        raw_tracks = raw_tracks[:override_limit]

                    for idx, t in enumerate(raw_tracks):
                        video_id = t.get("videoId")
                        if not video_id:
                            continue
                        t_thumbs = t.get("thumbnails", [])
                        t_cover = t_thumbs[-1]["url"] if t_thumbs else data["cover_url"]
                        artists = t.get("artists", [])
                        artist_str = ", ".join([a["name"] for a in artists if "name" in a]) or "Unknown Artist"

                        dur = t.get("duration_seconds")
                        if not dur:
                            raw_dur = t.get("duration") or t.get("length")
                            if raw_dur:
                                parts = str(raw_dur).split(":")
                                if len(parts) == 2:
                                    dur = int(parts[0]) * 60 + int(parts[1])
                                elif len(parts) == 3:
                                    dur = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                        dur = dur or 0

                        data["tracks"].append({
                            "id": f"yt_{video_id}",
                            "title": t.get("title", "Unknown"),
                            "artist": artist_str,
                            "album": t.get("album", {}).get("name", "") if isinstance(t.get("album"), dict) else "",
                            "duration_seconds": dur,
                            "cover_url": t_cover,
                            "source_type": "youtube",
                            "source_id": video_id,
                            "position": idx + 1
                        })
                except Exception as e:
                    logger.error(f"Failed to fetch YTMusic playlist {real_id}: {e}")

        return data

    async def resolve_shared_track(self, text_or_url: str) -> Optional[Dict[str, Any]]:
        """
        Resolve a shared URL or text from YouTube, YouTube Music, Spotify, or Deezer
        into a complete Track dictionary ready for playlist addition and playback.
        """
        import re
        s = text_or_url.strip()

        # 1. YouTube / YouTube Music URL
        yt_match = re.search(r'(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/watch\?v=)([a-zA-Z0-9_-]{11})', s)
        if yt_match:
            video_id = yt_match.group(1)
            title = "YouTube Track"
            artist = "YouTube"
            cover_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
            duration = 180

            # Try YouTube oEmbed for official video title & author
            try:
                client = get_http_client()
                resp = await client.get(f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json")
                if resp.status_code == 200:
                    info = resp.json()
                    raw_title = info.get("title", "")
                    author = info.get("author_name", "")
                    if " - " in raw_title:
                        parts = raw_title.split(" - ", 1)
                        artist = parts[0].strip()
                        title = parts[1].strip()
                    else:
                        title = raw_title
                        if author:
                            artist = author
                    if info.get("thumbnail_url"):
                        cover_url = info.get("thumbnail_url")
            except Exception as e:
                logger.warning(f"YouTube oEmbed failed for {video_id}: {e}")

            # Try YTMusic for more precise duration and album
            ytm = self._get_ytmusic()
            if ytm:
                try:
                    song_data = await asyncio.to_thread(ytm.get_song, video_id)
                    vd = song_data.get("videoDetails", {})
                    if vd:
                        if vd.get("title"):
                            title = vd.get("title")
                        if vd.get("author"):
                            artist = vd.get("author")
                        if vd.get("lengthSeconds"):
                            duration = int(vd.get("lengthSeconds"))
                        thumbs = vd.get("thumbnail", {}).get("thumbnails", [])
                        if thumbs:
                            cover_url = thumbs[-1]["url"]
                except Exception as e:
                    logger.debug(f"YTMusic get_song detail fallback: {e}")

            return {
                "id": f"yt_{video_id}",
                "title": title,
                "artist": artist,
                "album": "YouTube",
                "duration_seconds": duration,
                "cover_url": cover_url,
                "source_type": "youtube",
                "source_id": video_id
            }

        # 2. Deezer Track URL
        dz_match = re.search(r'deezer\.com\/(?:\w+\/)?track\/(\d+)', s)
        if dz_match:
            dz_id = dz_match.group(1)
            try:
                client = get_http_client()
                resp = await client.get(f"https://api.deezer.com/track/{dz_id}")
                if resp.status_code == 200:
                    d = resp.json()
                    return {
                        "id": f"dz_{dz_id}",
                        "title": d.get("title", "Unknown"),
                        "artist": d.get("artist", {}).get("name", "Unknown Artist"),
                        "album": d.get("album", {}).get("title", ""),
                        "duration_seconds": d.get("duration", 0),
                        "cover_url": d.get("album", {}).get("cover_xl") or d.get("album", {}).get("cover_big") or d.get("album", {}).get("cover_medium"),
                        "source_type": "deezer",
                        "source_id": str(dz_id)
                    }
            except Exception as e:
                logger.warning(f"Deezer resolve failed: {e}")

        # 3. Spotify Track URL
        if "spotify.com" in s:
            try:
                client = get_http_client()
                resp = await client.get(f"https://open.spotify.com/oembed?url={s}")
                if resp.status_code == 200:
                    data = resp.json()
                    title = data.get("title", "")
                    if title:
                        search_res = await self.search(title, limit=1)
                        if search_res.get("tracks"):
                            return search_res["tracks"][0]
            except Exception as e:
                logger.warning(f"Spotify resolve failed: {e}")

        return None

metadata_service = MetadataService()
