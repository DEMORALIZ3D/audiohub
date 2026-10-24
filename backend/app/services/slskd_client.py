import logging
from typing import List, Dict, Any
from ..config import settings
from .http_client import get_http_client

logger = logging.getLogger(__name__)

class SlskdClient:
    def __init__(self):
        self.base_url = settings.SLSKD_URL.rstrip("/")
        self.api_key = settings.SLSKD_API_KEY
        self.enabled = settings.ENABLE_SOULSEEK

    def _headers(self):
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["X-API-KEY"] = self.api_key
        return h

    async def is_available(self) -> bool:
        if not self.enabled:
            return False
        try:
            client = get_http_client()
            resp = await client.get(f"{self.base_url}/api/v0/application", headers=self._headers(), timeout=2.0)
            return resp.status_code == 200
        except Exception:
            return False

    async def search(self, query: str) -> Dict[str, Any]:
        """
        Initiate a search on the Soulseek P2P network.
        """
        if not self.enabled:
            return {"status": "disabled", "results": []}

        try:
            client = get_http_client()
            resp = await client.post(
                f"{self.base_url}/api/v0/searches",
                json={"searchText": query},
                headers=self._headers(),
                timeout=5.0
            )
            if resp.status_code in [200, 201]:
                search_data = resp.json()
                search_id = search_data.get("id")
                return {"status": "searching", "search_id": search_id}
        except Exception as e:
            logger.warning(f"Soulseek search request failed: {e}")

        return {"status": "error", "results": []}

    async def get_search_results(self, search_id: str) -> List[Dict[str, Any]]:
        """
        Poll results for a Soulseek search.
        """
        if not self.enabled:
            return []

        try:
            client = get_http_client()
            resp = await client.get(
                f"{self.base_url}/api/v0/searches/{search_id}",
                headers=self._headers(),
                timeout=5.0
            )
            if resp.status_code == 200:
                data = resp.json()
                responses = data.get("responses", [])
                files = []
                for r in responses:
                    user = r.get("username")
                    speed = r.get("uploadSpeed", 0)
                    for f in r.get("files", []):
                        filename = f.get("filename", "")
                        if any(filename.lower().endswith(ext) for ext in [".mp3", ".flac", ".m4a", ".wav"]):
                            files.append({
                                "username": user,
                                "filename": filename,
                                "size": f.get("size", 0),
                                "bitrate": f.get("bitRate", 0),
                                "speed": speed,
                                "id": f.get("id")
                            })
                return files
        except Exception as e:
            logger.warning(f"Soulseek get_search_results failed: {e}")

        return []

slskd_client = SlskdClient()
