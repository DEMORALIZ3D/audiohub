import os
import shutil
import asyncio
import time
import httpx
import logging
from pathlib import Path
from typing import Optional, Dict, Tuple, AsyncGenerator, List
from fastapi import Request, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from yt_dlp import YoutubeDL

from ..config import settings
from ..database import SessionLocal
from ..models import Track, SystemSetting
from .yt_client import get_ytmusic

logger = logging.getLogger(__name__)

# In-memory stream URL cache: {source_id: (url, format_ext, http_headers, expiry_timestamp)}
_stream_url_cache: Dict[str, Tuple[str, str, Dict[str, str], float]] = {}

# Shared persistent HTTP client pool for CDN audio streaming
_cdn_client: Optional[httpx.AsyncClient] = None

def get_cdn_client() -> httpx.AsyncClient:
    global _cdn_client
    if _cdn_client is None or _cdn_client.is_closed:
        _cdn_client = httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=30, max_connections=100)
        )
    return _cdn_client


def _score_yt_candidate(cand: dict, target_artist: str, target_title: str, target_duration: int = 0) -> float:
    import re
    def clean(s: str) -> str:
        return re.sub(r'[^\w\s]', '', (s or '').lower()).strip()

    raw_c_title = (cand.get("title") or "").lower()
    raw_t_title = (target_title or "").lower()
    c_title = clean(raw_c_title)
    t_title = clean(raw_t_title)

    c_artists = [clean(a.get("name", "")) for a in cand.get("artists", []) if isinstance(a, dict) and "name" in a]
    c_artist_str = " ".join(c_artists)
    t_artist = clean(target_artist)

    # 1. CORE TITLE ISOLATION & VALIDATION
    # Extract base song name before any dashes, parentheses, or brackets
    # e.g., "Damaged - Antilllas Remix" -> "damaged", "Cherish The Day (Antillas Remix)" -> "cherish the day"
    t_core_raw = re.split(r'[-(\[]', raw_t_title)[0].strip()
    t_core = clean(t_core_raw)
    t_core_words = [w for w in t_core.split() if len(w) > 1]

    if t_core_words:
        matched_core = [w for w in t_core_words if w in c_title.split() or (len(w) > 3 and w in c_title)]
        if len(matched_core) == 0:
            # Completely different song! Immediate disqualification!
            return -200.0
        if len(matched_core) < len(t_core_words):
            return -150.0

    score = 0.0

    # 2. Artist Matching
    if t_artist:
        if t_artist in c_artist_str or any(a in t_artist for a in c_artists if len(a) > 2):
            score += 50.0
        elif any(part.strip() in c_artist_str for part in re.split(r'[,;&]', target_artist.lower()) if len(part.strip()) > 2):
            score += 40.0
        elif any(a in t_artist for a in c_artists):
            score += 25.0
        else:
            score -= 30.0

    # 3. Full Title Matching
    if t_title == c_title:
        score += 50.0
    elif t_title in c_title or c_title in t_title:
        score += 45.0
    else:
        t_words = [w for w in t_title.split() if len(w) > 2]
        if t_words:
            matched = sum(1 for w in t_words if w in c_title)
            score += (matched / len(t_words)) * 35.0

    # 4. Version / Remix Alignment
    version_keywords = ["remix", "mix", "edit", "live", "acoustic", "instrumental", "club", "extended", "vip", "dub", "radio edit", "slowed", "sped up", "karaoke", "cover"]
    t_versions = [v for v in version_keywords if v in raw_t_title]
    c_versions = [v for v in version_keywords if v in raw_c_title]

    if t_versions:
        matched_ver = [v for v in t_versions if v in c_versions]
        if matched_ver:
            score += 35.0
            for v_tag in t_versions:
                if v_tag in ["remix", "mix", "edit"]:
                    remixer_parts = [p.strip() for p in re.split(r'[,;&]', target_artist.lower())]
                    for rp in remixer_parts:
                        if len(rp) > 2 and rp in raw_c_title:
                            score += 15.0
                            break
        else:
            score -= 40.0
    else:
        unwanted_penalties = {
            "karaoke": 80.0,
            "cover": 70.0,
            "tribute": 70.0,
            "parody": 80.0,
            "reaction": 90.0,
            "slowed": 60.0,
            "sped up": 60.0,
            "reverb": 50.0,
            "instrumental": 50.0,
            "remix": 45.0,
            "live": 30.0,
        }
        for u, penalty in unwanted_penalties.items():
            if u in raw_c_title and u not in raw_t_title:
                score -= penalty

    # 5. Channel / Topic Quality
    channel_name = clean(cand.get("author", "") or cand.get("channel", {}).get("name", ""))
    if any(k in channel_name for k in ["topic", "official", "records", "vevo"]):
        score += 15.0

    # 6. Duration Matching
    cand_dur = cand.get("duration_seconds")
    if target_duration and target_duration > 0 and cand_dur and cand_dur > 0:
        diff = abs(cand_dur - target_duration)
        if diff <= 4:
            score += 25.0
        elif diff <= 12:
            score += 15.0
        elif diff <= 25:
            score += 8.0
        elif diff > 90 and not t_versions:
            score -= 40.0

    return score


class AudioStreamerService:
    def __init__(self):
        cookies_file = Path("/data/cookies.txt")
        self.ydl_opts = {
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
            "skip_download": True,
        }
        if cookies_file.exists():
            self.ydl_opts["cookiefile"] = str(cookies_file)
            logger.info("Loaded custom cookies.txt for yt-dlp")

    async def get_stream_url(
        self,
        source_id: str,
        query: Optional[str] = None,
        force_refresh: bool = False
    ) -> Tuple[str, str, Dict[str, str]]:
        """
        Extract direct CDN audio stream URL using yt-dlp.
        Returns (stream_url, format_ext, http_headers).
        """
        now = time.time()
        cache_key = source_id or f"q:{query}"
        if not force_refresh and cache_key in _stream_url_cache:
            url, ext, headers, expiry = _stream_url_cache[cache_key]
            if now < expiry:
                return url, ext, headers

        target = f"https://www.youtube.com/watch?v={source_id}" if (source_id and not source_id.startswith("http")) else source_id
        if query and not source_id:
            target = f"ytsearch1:{query}"

        def _extract():
            with YoutubeDL(self.ydl_opts) as ydl:
                info = ydl.extract_info(target, download=False)
                if "entries" in info:
                    if not info["entries"]:
                        raise ValueError(f"No search results found for: {query or target}")
                    info = info["entries"][0]
                url = info.get("url")
                ext = info.get("ext", "m4a")
                http_headers = info.get("http_headers", {})
                return url, ext, http_headers

        loop = asyncio.get_event_loop()
        try:
            url, ext, http_headers = await loop.run_in_executor(None, _extract)
            if not url:
                raise ValueError("Could not extract audio stream URL from YouTube")
            # Cache URL for 45 minutes to stay well within YouTube CDN token validity
            _stream_url_cache[cache_key] = (url, ext, http_headers, now + 2700)
            return url, ext, http_headers
        except Exception as e:
            logger.error(f"Failed to extract stream URL for {source_id or query}: {e}")
            raise HTTPException(status_code=502, detail=f"Audio resolution failed: {str(e)}")


    async def resolve_audio_source(self, track: Track, db) -> Tuple[str, str, Dict[str, str]]:
        """
        Ensures track has a valid YouTube video ID and returns (stream_url, ext, headers).
        CRITICAL: Never overwrite valid track.artist or track.title!
        """
        # If track has completely missing title/artist, try to rescue metadata from Deezer or YouTube
        is_unknown = not track.title or track.title == "Unknown Track" or not track.artist or track.artist == "Unknown Artist"
        clean_dz_id = (track.source_id or track.id).replace("dz_", "").replace("yt_", "")

        if is_unknown and clean_dz_id.isdigit():
            try:
                http_c = get_cdn_client()
                dz_resp = await http_c.get(f"https://api.deezer.com/track/{clean_dz_id}", timeout=5.0)
                if dz_resp.status_code == 200:
                        dz_data = dz_resp.json()
                        if "title" in dz_data:
                            track.title = dz_data.get("title", track.title)
                            track.artist = dz_data.get("artist", {}).get("name", track.artist)
                            if "album" in dz_data:
                                track.album = dz_data["album"].get("title", track.album)
                                track.cover_url = dz_data["album"].get("cover_xl", track.cover_url)
                            if "duration" in dz_data:
                                track.duration_seconds = dz_data.get("duration", track.duration_seconds)
                            # Reset bogus placeholder ID if assigned previously
                            if track.source_id in ["QQp0uV11d1g", "PzsCRfat_QQ"]:
                                track.source_id = clean_dz_id
                                track.source_type = "deezer"
                            db.commit()
            except Exception as e:
                logger.debug(f"Deezer fallback lookup error: {e}")

        # If still unknown and track is a YouTube ID, rescue title from YouTube
        if (not track.title or track.title == "Unknown Track") and track.source_id and len(track.source_id) == 11 and track.source_id not in ["QQp0uV11d1g", "PzsCRfat_QQ"]:
            try:
                ytm = get_ytmusic()
                if ytm:
                    s_info = ytm.get_song(track.source_id)
                    v_det = s_info.get("videoDetails", {})
                    if v_det.get("title"):
                        track.title = v_det.get("title", track.title)
                        track.artist = v_det.get("author", track.artist)
                        if v_det.get("lengthSeconds"):
                            try:
                                track.duration_seconds = int(v_det["lengthSeconds"])
                            except Exception:
                                pass
                        db.commit()
            except Exception as e:
                logger.debug(f"YouTube metadata rescue error: {e}")

        # 1. If track has a valid cached 11-char YouTube videoId, use it immediately
        # Enables 0ms instant playback on repeat plays for all matched or user-selected tracks
        has_cached_yt = (
            track.source_id
            and len(track.source_id) == 11
            and not track.source_id.isdigit()
            and track.source_id not in ["QQp0uV11d1g", "PzsCRfat_QQ"]
            and track.title
            and track.title != "Unknown Track"
        )
        if has_cached_yt:
            try:
                return await self.get_stream_url(track.source_id)
            except Exception as e:
                logger.warning(f"Cached YouTube source {track.source_id} failed extraction, will search: {e}")

        # Guard: Never search YouTube for "Unknown Track"
        import re
        clean_title = (track.title or "").replace("\xa0", " ").strip()
        clean_artist = (track.artist or "").replace(";", ", ").replace("\xa0", " ").strip()
        if not clean_title or clean_title == "Unknown Track":
            raise HTTPException(status_code=400, detail="Cannot stream track: title and artist metadata are missing.")

        primary_artist = re.split(r'[,;&]|(\bfeat\.?\b)', clean_artist)[0].strip()
        primary_query = f"{primary_artist} - {clean_title}".strip()
        full_query = f"{clean_artist} - {clean_title}".strip() if clean_artist != primary_artist else primary_query

        yt_matched_id = None
        matched_thumbnail = None
        matched_duration = None

        try:
            ytm = get_ytmusic()
            candidates = []

            # Step A: Search primary artist (official songs filter)
            if ytm:
                yt_res = ytm.search(primary_query, filter="songs", limit=10) or []
                for item in yt_res:
                    if item.get("videoId"):
                        score = _score_yt_candidate(item, clean_artist, clean_title, track.duration_seconds or 0)
                        if score > 0:
                            candidates.append((score, item))

            # Step B: If no solid match (>= 60) and full artist differs, search full query
            candidates.sort(key=lambda x: x[0], reverse=True)
            if (not candidates or candidates[0][0] < 60.0) and full_query != primary_query and ytm:
                yt_res_full = ytm.search(full_query, filter="songs", limit=10) or []
                for item in yt_res_full:
                    if item.get("videoId"):
                        score = _score_yt_candidate(item, clean_artist, clean_title, track.duration_seconds or 0)
                        if score > 0:
                            candidates.append((score, item))
                candidates.sort(key=lambda x: x[0], reverse=True)

            # Step C: Fallback to general search (without songs filter, for remixes and indie releases)
            if (not candidates or candidates[0][0] < 50.0) and ytm:
                yt_res_gen = ytm.search(primary_query, limit=10) or []
                for item in yt_res_gen:
                    if item.get("videoId"):
                        score = _score_yt_candidate(item, clean_artist, clean_title, track.duration_seconds or 0)
                        if score > 0:
                            candidates.append((score, item))
                candidates.sort(key=lambda x: x[0], reverse=True)

            # Step D: Fallback to title-only search (handles curator/label channels like BABEL, NCS, Trap Nation)
            if (not candidates or candidates[0][0] < 50.0) and ytm:
                yt_res_title = ytm.search(clean_title, limit=10) or []
                for item in yt_res_title:
                    if item.get("videoId"):
                        score = _score_yt_candidate(item, clean_artist, clean_title, track.duration_seconds or 0)
                        item_title = (item.get("title") or "").lower()
                        if clean_title.lower() in item_title or item_title in clean_title.lower():
                            score = max(score, 65.0)
                        if score > 0:
                            candidates.append((score, item))
                candidates.sort(key=lambda x: x[0], reverse=True)

            if candidates and candidates[0][0] >= 50.0:
                best = candidates[0][1]
                yt_matched_id = best.get("videoId")
                matched_duration = best.get("duration_seconds")
                if "thumbnails" in best and best["thumbnails"]:
                    matched_thumbnail = best["thumbnails"][-1].get("url")

            # Update missing cover art or duration if matched
            if yt_matched_id:
                if matched_thumbnail and not track.cover_url:
                    track.cover_url = matched_thumbnail
                if matched_duration and (not track.duration_seconds or track.duration_seconds == 180):
                    track.duration_seconds = matched_duration

            # If cover art still missing, fetch high-res cover from Deezer/iTunes
            if not track.cover_url:
                try:
                    from .cover_resolver import cover_resolver
                    cov = await cover_resolver.fetch_cover(clean_artist, clean_title)
                    if cov and cov.get("cover_url"):
                        track.cover_url = cov["cover_url"]
                        if cov.get("album") and (not track.album or track.album in ["Liked Songs", "Single"]):
                            track.album = cov["album"]
                except Exception:
                    pass

        except Exception as e:
            logger.warning(f"YTMusic search failed for '{primary_query}': {e}")

        if yt_matched_id:
            track.source_id = yt_matched_id
            if not track.id.startswith("dz_"):
                track.source_type = "youtube"
            try:
                db.commit()
            except Exception:
                pass
            return await self.get_stream_url(yt_matched_id)

        # 3. Last fallback: ytsearch with yt-dlp using refined query
        logger.info(f"Falling back to ytsearch for: {primary_query}")
        try:
            return await self.get_stream_url("", query=f"{primary_artist} - {clean_title} audio")
        except Exception:
            # Fallback to searching clean_title alone
            return await self.get_stream_url("", query=f"{clean_title} audio")

    async def prefetch_tracks(self, track_ids: List[str], session_factory):
        """
        Preemptively resolves YouTube videoId and stream URL in memory for upcoming tracks in queue.
        Enables instant 0-delay playback when transitioning between songs.
        """
        db = session_factory()
        try:
            # Prefetch only immediate next track to prevent triggering upstream rate limits
            for tid in track_ids[:1]:
                track = db.query(Track).filter(Track.id == tid).first()
                if not track or track.is_cached or track.is_uploaded:
                    continue
                # If already in memory cache, skip
                cache_key = track.source_id if (track.source_type == "youtube" and track.source_id) else None
                if cache_key and cache_key in _stream_url_cache:
                    continue
                try:
                    logger.info(f"Pre-fetching audio stream for queue track: {track.artist} - {track.title}")
                    stream_url, ext, _ = await self.resolve_audio_source(track, db)
                    if stream_url:
                        # Warm up TCP/TLS and CDN connection pool in background
                        client = get_cdn_client()
                        warm_req = client.build_request("GET", stream_url, headers={"Range": "bytes=0-1024"})
                        warm_resp = await client.send(warm_req)
                        logger.debug(f"Warmed up CDN connection for {track.title}: status={warm_resp.status_code}")
                except Exception as e:
                    logger.debug(f"Pre-fetch skipped for {tid}: {e}")
                # Brief sleep between prefetch requests to avoid thread contention
                await asyncio.sleep(0.08)
        except Exception as e:
            logger.debug(f"Prefetch queue error: {e}")
        finally:
            db.close()

    def get_current_storage_mode(self, db) -> str:
        """Check setting in DB or default to config"""
        setting = db.query(SystemSetting).filter(SystemSetting.key == "storage_mode").first()
        if setting:
            return setting.value
        return settings.DEFAULT_STORAGE_MODE

    async def stream_track(self, track: Track, request: Request, db, force_refresh: bool = False):
        """
        Handle streaming with full HTTP 206 Partial Content (Range requests).
        If cached locally or user uploaded, serves directly from disk with kernel sendfile via FileResponse.
        If remote, proxies live audio stream from CDN.
        """
        # 1. Check if track exists locally on disk (cached or uploaded)
        if (track.is_cached or track.is_uploaded) and track.local_path and os.path.exists(track.local_path):
            file_path = Path(track.local_path)
            import mimetypes
            content_type = mimetypes.guess_type(file_path)[0] or "audio/mpeg"
            is_mp4 = any(x in content_type.lower() for x in ["mp4", "m4a", "aac"])
            dlna_pn = "AAC_ISO" if is_mp4 else "MP3"

            headers = {
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=86400",
                "contentFeatures.dlna.org": f"DLNA.ORG_PN={dlna_pn};DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01500000000000000000000000000000",
                "transferMode.dlna.org": "Streaming",
            }
            return FileResponse(file_path, media_type=content_type, headers=headers)

        # 2. Track is remote: resolve stream URL
        if force_refresh and track.source_id:
            _stream_url_cache.pop(track.source_id, None)

        try:
            stream_url, ext, upstream_headers_extra = await self.resolve_audio_source(track, db)
        except Exception as e:
            logger.error(f"Could not resolve audio for '{track.artist} - {track.title}': {e}")
            raise HTTPException(
                status_code=404,
                detail=f"Audio for '{track.title}' by '{track.artist}' is currently unavailable on YouTube Music."
            )

        storage_mode = self.get_current_storage_mode(db)

        # 3. Stream from remote CDN with Range forwarding & proper headers
        client_range = request.headers.get("Range", "bytes=0-")
        upstream_headers = {"Range": client_range}
        if upstream_headers_extra:
            for k, v in upstream_headers_extra.items():
                if k.lower() not in ["range", "host", "connection"]:
                    upstream_headers[k] = v

        client = get_cdn_client()
        upstream_resp = None
        for attempt in range(2):
            try:
                upstream_req = client.build_request("GET", stream_url, headers=upstream_headers)
                upstream_resp = await client.send(upstream_req, stream=True)

                # If 403 Forbidden: stream URL expired or was blocked. Force refresh fresh URL from YouTube
                if upstream_resp.status_code == 403 and track.source_id:
                    logger.info(f"Stream URL returned 403 Forbidden. Forcing fresh extraction for {track.source_id} (attempt {attempt+1})...")
                    _stream_url_cache.pop(track.source_id, None)
                    stream_url, ext, upstream_headers_extra = await self.get_stream_url(track.source_id, force_refresh=True)
                    if upstream_headers_extra:
                        for k, v in upstream_headers_extra.items():
                            if k.lower() not in ["range", "host", "connection"]:
                                upstream_headers[k] = v
                    upstream_req = client.build_request("GET", stream_url, headers=upstream_headers)
                    upstream_resp = await client.send(upstream_req, stream=True)

                if upstream_resp.status_code in [200, 206]:
                    break
            except Exception as e:
                logger.warning(f"CDN stream attempt {attempt+1} failed: {e}")
                if attempt == 1:
                    logger.error(f"Failed to connect to upstream audio CDN: {e}")
                    raise HTTPException(status_code=502, detail="Failed to connect to audio CDN")
                await asyncio.sleep(0.3)

        if not upstream_resp:
            raise HTTPException(status_code=502, detail="Failed to connect to audio CDN")

        status_code = upstream_resp.status_code
        content_type = upstream_resp.headers.get("Content-Type", "audio/mp4")
        content_length = upstream_resp.headers.get("Content-Length")
        content_range = upstream_resp.headers.get("Content-Range")

        response_headers = {
            "Accept-Ranges": "bytes",
            "Content-Type": content_type,
            "contentFeatures.dlna.org": "DLNA.ORG_PN=AAC_ISO;DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01500000000000000000000000000000" if any(x in content_type.lower() for x in ["mp4", "m4a", "aac"]) else "DLNA.ORG_PN=MP3;DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01500000000000000000000000000000",
            "transferMode.dlna.org": "Streaming",
        }
        if content_length:
            response_headers["Content-Length"] = content_length
        if content_range:
            response_headers["Content-Range"] = content_range

        # Background caching preparation (only cache full streams from bytes=0)
        should_cache = (storage_mode == "stream_and_cache" and not track.is_cached and client_range.startswith("bytes=0-"))
        download_complete = False

        async def stream_generator() -> AsyncGenerator[bytes, None]:
            nonlocal download_complete
            temp_file = None
            temp_path = None
            if should_cache:
                temp_path = settings.TEMP_DIR / f"{track.id}.tmp"
                try:
                    temp_file = open(temp_path, "wb")
                except Exception as e:
                    logger.warning(f"Could not open temp file for caching: {e}")

            try:
                async for chunk in upstream_resp.aiter_bytes(chunk_size=128 * 1024):
                    if temp_file:
                        temp_file.write(chunk)
                    yield chunk
                download_complete = True
            finally:
                await upstream_resp.aclose()
                if temp_file:
                    temp_file.close()
                    # Only finalize and move to library if the entire stream was downloaded without interruption
                    if download_complete:
                        asyncio.create_task(self._finalize_cached_track(track.id, temp_path))
                    else:
                        if temp_path and temp_path.exists():
                            try:
                                temp_path.unlink()
                            except Exception:
                                pass

        return StreamingResponse(
            stream_generator(),
            status_code=status_code,
            headers=response_headers
        )

    async def _finalize_cached_track(self, track_id: str, temp_path: Path):
        """
        Background task to tag audio file with ID3/MP4 metadata and move to music library.
        """
        if not temp_path.exists() or temp_path.stat().st_size < 100000:
            if temp_path.exists():
                temp_path.unlink()
            return

        db = SessionLocal()
        try:
            track = db.query(Track).filter(Track.id == track_id).first()
            if not track:
                temp_path.unlink()
                return

            clean_artist = "".join(c for c in track.artist if c.isalnum() or c in " .-_").strip() or "Unknown"
            clean_title = "".join(c for c in track.title if c.isalnum() or c in " .-_").strip() or "Unknown"
            
            target_dir = settings.MUSIC_DIR / clean_artist
            target_dir.mkdir(parents=True, exist_ok=True)
            target_file = target_dir / f"{clean_title}.m4a"

            if target_file.exists():
                target_file.unlink()
            shutil.move(str(temp_path), str(target_file))

            try:
                from mutagen.mp4 import MP4, MP4Cover
                audio = MP4(str(target_file))
                audio["\xa9nam"] = track.title
                audio["\xa9ART"] = track.artist
                if track.album:
                    audio["\xa9alb"] = track.album
                
                if track.cover_url:
                    client = get_cdn_client()
                    resp = await client.get(track.cover_url)
                    if resp.status_code == 200:
                        image_format = MP4Cover.FORMAT_JPEG if "jpeg" in resp.headers.get("content-type", "") or "jpg" in track.cover_url else MP4Cover.FORMAT_PNG
                        audio["covr"] = [MP4Cover(resp.content, imageformat=image_format)]
                audio.save()
            except Exception as tag_err:
                logger.warning(f"Could not embed ID3 metadata into {target_file}: {tag_err}")

            track.is_cached = True
            track.local_path = str(target_file)
            track.file_size_bytes = target_file.stat().st_size
            db.commit()
            logger.info(f"Successfully cached and tagged track: {track.artist} - {track.title}")
        except Exception as e:
            logger.error(f"Error finalizing cached track {track_id}: {e}")
            if temp_path.exists():
                temp_path.unlink()
        finally:
            db.close()

audio_streamer = AudioStreamerService()
