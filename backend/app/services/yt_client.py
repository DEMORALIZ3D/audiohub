import logging
from typing import Optional

logger = logging.getLogger(__name__)

_ytmusic_instance = None
_ytmusic_init_failed = False

def get_ytmusic():
    """
    Thread-safe cached singleton for YTMusic client.
    Avoids expensive repeated instantiation, header parsing, and connection recreation.
    """
    global _ytmusic_instance, _ytmusic_init_failed
    if _ytmusic_instance is not None:
        return _ytmusic_instance
    if _ytmusic_init_failed:
        return None

    try:
        from ytmusicapi import YTMusic
        _ytmusic_instance = YTMusic()
        return _ytmusic_instance
    except Exception as e:
        logger.error(f"Failed to initialize shared YTMusic singleton: {e}")
        _ytmusic_init_failed = True
        return None
