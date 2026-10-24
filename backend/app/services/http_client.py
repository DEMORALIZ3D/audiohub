import httpx
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_shared_client: Optional[httpx.AsyncClient] = None

def get_http_client() -> httpx.AsyncClient:
    """
    Returns a shared, persistent HTTP client pool with connection reuse and keepalive.
    Prevents repeated TCP/TLS handshakes across external metadata, streaming, and lyrics requests.
    """
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(
            timeout=8.0,
            follow_redirects=True,
            limits=httpx.Limits(
                max_keepalive_connections=30,
                max_connections=100,
                keepalive_expiry=30.0
            ),
            headers={
                "User-Agent": "AudioHub/0.1.0 (High-Performance Music Server; +https://github.com/DEMORALIZ3D/audiohub)"
            }
        )
    return _shared_client

async def close_http_client() -> None:
    """
    Gracefully shuts down the persistent HTTP client pool upon application shutdown.
    """
    global _shared_client
    if _shared_client is not None and not _shared_client.is_closed:
        try:
            await _shared_client.aclose()
        except Exception as e:
            logger.warning(f"Error closing shared HTTP client pool: {e}")
        finally:
            _shared_client = None
