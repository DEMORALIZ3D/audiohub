import httpx
import logging
from typing import Dict, Any

from .http_client import get_http_client

logger = logging.getLogger(__name__)

class LyricsService:
    BASE_URL = "https://lrclib.net/api"

    async def get_lyrics(self, track_name: str, artist_name: str, duration_seconds: int = 0) -> Dict[str, Any]:
        """
        Fetch synced LRC lyrics from LRCLIB.
        """
        params = {
            "track_name": track_name,
            "artist_name": artist_name,
        }
        if duration_seconds > 0:
            params["duration"] = duration_seconds

        try:
            client = get_http_client()
            headers = {"User-Agent": "AudioHub/0.1.0 (https://github.com/DEMORALIZ3D/audiohub)"}
            resp = await client.get(f"{self.BASE_URL}/get", params=params, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "synced_lyrics": data.get("syncedLyrics"),
                    "plain_lyrics": data.get("plainLyrics"),
                    "instrumental": data.get("instrumental", False)
                }
            
            # If exact match failed, try search
            search_resp = await client.get(f"{self.BASE_URL}/search", params={"q": f"{track_name} {artist_name}"}, headers=headers)
            if search_resp.status_code == 200:
                results = search_resp.json()
                if results and len(results) > 0:
                    first = results[0]
                    return {
                        "synced_lyrics": first.get("syncedLyrics"),
                        "plain_lyrics": first.get("plainLyrics"),
                        "instrumental": first.get("instrumental", False)
                    }
        except Exception as e:
            logger.warning(f"Failed to fetch lyrics for {track_name} by {artist_name}: {e}")

        return {"synced_lyrics": None, "plain_lyrics": None, "instrumental": False}

lyrics_service = LyricsService()
