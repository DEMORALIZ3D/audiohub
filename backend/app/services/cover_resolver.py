import asyncio
import logging
from typing import Optional, Dict, Any
import httpx
from ..models import Track

from .http_client import get_http_client

logger = logging.getLogger("audiohub.cover_resolver")

class CoverResolver:
    def __init__(self):
        self.is_running = False
        self.processed = 0
        self.total = 0
        self.updated = 0

    async def fetch_cover(self, artist: str, title: str) -> Optional[Dict[str, str]]:
        """
        Attempt to resolve high-res album cover and album title using Deezer and iTunes.
        """
        clean_artist = artist.strip() if artist else ""
        clean_title = title.strip() if title else ""
        if not clean_title or clean_title.lower() in ["unknown track", "audio"]:
            return None

        client = get_http_client()

        # 1. Try Deezer Search
        try:
            query = f"{clean_artist} {clean_title}".strip()
            params = {"q": query, "limit": "1"}
            resp = await client.get("https://api.deezer.com/search", params=params)
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                if data:
                    top = data[0]
                    album_data = top.get("album", {})
                    cover = (
                        album_data.get("cover_big")
                        or album_data.get("cover_xl")
                        or album_data.get("cover_medium")
                        or ""
                    )
                    album_name = album_data.get("title", "")
                    if cover:
                        return {"cover_url": cover, "album": album_name}
        except Exception as e:
            logger.debug(f"Deezer search error for '{artist} - {title}': {e}")

        # 2. Try iTunes Search API as fallback
        try:
            term = f"{clean_artist} {clean_title}".strip()
            params = {"term": term, "entity": "song", "limit": "1"}
            resp = await client.get("https://itunes.apple.com/search", params=params)
            if resp.status_code == 200:
                results = resp.json().get("results", [])
                if results:
                    top = results[0]
                    art = top.get("artworkUrl100", "")
                    if art:
                        cover = art.replace("100x100bb", "600x600bb")
                        album_name = top.get("collectionName", "")
                        return {"cover_url": cover, "album": album_name}
        except Exception as e:
            logger.debug(f"iTunes search error for '{artist} - {title}': {e}")

        return None

    async def run_enrichment(self, session_factory, limit: int = 1000):
        if self.is_running:
            logger.info("Cover enrichment task is already running.")
            return

        self.is_running = True
        self.processed = 0
        self.updated = 0
        logger.info("Starting background cover art enrichment task...")

        try:
            db = session_factory()
            try:
                tracks = (
                    db.query(Track)
                    .filter((Track.cover_url == None) | (Track.cover_url == ""))
                    .limit(limit)
                    .all()
                )
                self.total = len(tracks)
                logger.info(f"Found {self.total} tracks needing cover art.")

                # Process in small chunks to avoid rate limiting
                for track in tracks:
                    self.processed += 1
                    try:
                        res = await self.fetch_cover(track.artist, track.title)
                        if res and res.get("cover_url"):
                            track.cover_url = res["cover_url"]
                            if (not track.album or track.album in ["Liked Songs", "Single", "Unknown Album"]) and res.get("album"):
                                track.album = res["album"]
                            db.commit()
                            self.updated += 1
                    except Exception as e:
                        logger.warning(f"Error enriching track {track.id} ({track.title}): {e}")

                    # Slight throttle to be polite to external APIs
                    await asyncio.sleep(0.12)

            finally:
                db.close()

            logger.info(f"Cover enrichment completed. Updated {self.updated}/{self.total} tracks.")
        except Exception as e:
            logger.error(f"Error in cover enrichment task: {e}")
        finally:
            self.is_running = False

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_running": self.is_running,
            "processed": self.processed,
            "total": self.total,
            "updated": self.updated,
        }

cover_resolver = CoverResolver()
