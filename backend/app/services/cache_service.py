import json
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Optional, Tuple
from sqlalchemy.orm import Session
from ..models import MetadataCache, utc_now
from ..database import SessionLocal

logger = logging.getLogger(__name__)

from collections import OrderedDict

# Bounded in-memory LRU cache to prevent RAM growth on low-spec systems:
# Max 512 lightweight JSON entries (~4-8MB RAM maximum)
MAX_MEM_ENTRIES = 512
_mem_cache: OrderedDict[str, Tuple[Any, float]] = OrderedDict()

class CacheService:
    def _evict_excess(self):
        now = time.time()
        # Remove expired keys first
        expired = [k for k, (_, exp) in _mem_cache.items() if now >= exp]
        for k in expired:
            _mem_cache.pop(k, None)
        # Pop oldest if still over capacity
        while len(_mem_cache) > MAX_MEM_ENTRIES:
            _mem_cache.popitem(last=False)

    def get(self, key: str, db: Optional[Session] = None) -> Optional[Any]:
        """
        Retrieve cached value from memory or SQLite database.
        """
        now = time.time()
        # 1. Check in-memory cache first (sub-millisecond)
        if key in _mem_cache:
            data, expire_epoch = _mem_cache[key]
            if now < expire_epoch:
                _mem_cache.move_to_end(key)
                return data
            else:
                _mem_cache.pop(key, None)

        # 2. Check persistent database cache
        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True

        try:
            entry = db.query(MetadataCache).filter(
                MetadataCache.key == key,
                MetadataCache.expires_at > utc_now()
            ).first()

            if entry:
                try:
                    data = json.loads(entry.value)
                    # Backfill memory cache
                    remaining_ttl = max(5.0, (entry.expires_at.replace(tzinfo=timezone.utc) - utc_now()).total_seconds())
                    self._evict_excess()
                    _mem_cache[key] = (data, now + remaining_ttl)
                    _mem_cache.move_to_end(key)
                    return data
                except Exception as e:
                    logger.warning(f"Error deserializing cached data for {key}: {e}")
            return None
        finally:
            if close_db:
                db.close()

    def set(self, key: str, value: Any, ttl_seconds: int = 3600, db: Optional[Session] = None) -> None:
        """
        Store value in both in-memory cache and SQLite database.
        """
        now = time.time()
        # Update memory with bounded eviction
        self._evict_excess()
        _mem_cache[key] = (value, now + ttl_seconds)
        _mem_cache.move_to_end(key)

        # Update persistent SQLite
        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True

        try:
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
            json_str = json.dumps(value)

            entry = db.query(MetadataCache).filter(MetadataCache.key == key).first()
            if entry:
                entry.value = json_str
                entry.expires_at = expires_at
            else:
                entry = MetadataCache(
                    key=key,
                    value=json_str,
                    expires_at=expires_at
                )
                db.add(entry)
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to persist cache key {key}: {e}")
            if db:
                db.rollback()
        finally:
            if close_db:
                db.close()

    def delete(self, key: str, db: Optional[Session] = None) -> None:
        _mem_cache.pop(key, None)
        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True
        try:
            db.query(MetadataCache).filter(MetadataCache.key == key).delete()
            db.commit()
        finally:
            if close_db:
                db.close()

    def clear_expired(self, db: Optional[Session] = None) -> int:
        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True
        try:
            count = db.query(MetadataCache).filter(MetadataCache.expires_at <= utc_now()).delete()
            db.commit()
            return count
        finally:
            if close_db:
                db.close()

cache_service = CacheService()
