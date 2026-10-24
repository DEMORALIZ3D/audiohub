import re
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.audio_streamer import get_cdn_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scanner", tags=["Optical Album Scanner"])

class ScanRequest(BaseModel):
    text: Optional[str] = None
    barcode: Optional[str] = None
    image_data: Optional[str] = None
    mode: Optional[str] = "cover"  # "cover", "barcode", "tracklist", "label"

# Common vinyl/CD print noise to strip before search querying
NOISE_PATTERNS = [
    r'\b(stereo|mono|quadraphonic|rpm|33\s*1/3|45\s*rpm|78\s*rpm)\b',
    r'\b(produced\s+by|arranged\s+by|mixed\s+by|mastered\s+by|recorded\s+at)\b.*?(?=\n|$)',
    r'\b(all\s+rights\s+reserved|unauthorized\s+duplication|printed\s+in|made\s+in)\b.*?(?=\n|$)',
    r'\b(compact\s+disc|digital\s+audio|dolby\s+system|side\s+[ab12]|matrix|catalog\s+no)\b',
    r'[©℗®™\(\)]',
    r'\b(19\d{2}|20\d{2})\b',  # Years
    r'\b(lp|ep|cd|vinyl|record)\b',
]

def normalize_spaced_letters(text: str) -> str:
    """
    Handles artistic wide letter-spacing on sleeves (e.g., 'F O R E I G N E R' -> 'FOREIGNER')
    """
    lines = text.splitlines()
    normalized_lines = []
    for line in lines:
        segments = re.split(r'\s{2,}|\t', line.strip())
        norm_segments = []
        for seg in segments:
            tokens = seg.strip().split()
            # If a word is composed of single characters separated by spaces (e.g. ['F', 'O', 'R', 'E', 'I', 'G', 'N', 'E', 'R'])
            if len(tokens) >= 3 and all(len(t) == 1 and t.isalpha() for t in tokens):
                norm_segments.append("".join(tokens))
            else:
                norm_segments.append(seg)
        normalized_lines.append(" ".join(norm_segments))
    return " ".join(normalized_lines)

def clean_ocr_text(raw_text: str) -> str:
    # First collapse artistic letter spacing
    despaced = normalize_spaced_letters(raw_text)
    cleaned = despaced
    for pat in NOISE_PATTERNS:
        cleaned = re.sub(pat, ' ', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'[\r\n]+', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def httpx_quote(s: str) -> str:
    import urllib.parse
    return urllib.parse.quote_plus(s)

@router.post("/scan")
async def scan_album_optical(req: ScanRequest):
    """
    Zero-cost multi-layer album identification:
    Layer 1: Exact Barcode lookup (UPC/EAN against Discogs and MusicBrainz).
    Layer 2: Letter-spaced OCR text normalization + Discogs & MusicBrainz physical catalog search + Deezer streamable matching.
    """
    barcode = (req.barcode or "").strip()
    raw_text = (req.text or "").strip()

    if not barcode and not raw_text and not req.image_data:
        raise HTTPException(status_code=400, detail="Either barcode, text, or image_data is required")

    client = get_cdn_client()
    matches: List[Dict[str, Any]] = []
    seen_keys = set()
    headers_musicbrainz = {"User-Agent": "AudioHub/0.1.0 (https://github.com/DEMORALIZ3D/audiohub)"}
    headers_discogs = {"User-Agent": "AudioHub/1.0.0"}

    # =========================================================================
    # LAYER 1: BARCODE SCANNING (100% Accurate & Zero-Cost)
    # =========================================================================
    if barcode:
        logger.info(f"[Scanner] Querying barcode: {barcode}")
        
        # 1. Discogs Barcode Query
        try:
            dc_resp = await client.get(
                f"https://api.discogs.com/database/search?barcode={httpx_quote(barcode)}&type=release",
                headers=headers_discogs,
                timeout=4.0
            )
            if dc_resp.status_code == 200:
                dc_data = dc_resp.json()
                for item in dc_data.get("results", []):
                    title_full = item.get("title", "")
                    artist_name = "Unknown Artist"
                    album_title = title_full
                    if " - " in title_full:
                        parts = title_full.split(" - ", 1)
                        artist_name = parts[0].strip()
                        album_title = parts[1].strip()

                    key = f"{artist_name}_{album_title}".lower()
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)

                    matches.append({
                        "id": f"dc_release_{item.get('id')}",
                        "source_id": str(item.get("id")),
                        "source_type": "discogs",
                        "title": album_title,
                        "artist": artist_name,
                        "cover_url": item.get("cover_image") or item.get("thumb") or "",
                        "track_count": 0,
                        "release_date": str(item.get("year", "")),
                        "record_type": "album",
                    })
        except Exception as e:
            logger.warning(f"[Scanner] Discogs barcode lookup failed: {e}")

        # 2. MusicBrainz Barcode Query
        if not matches:
            try:
                mb_resp = await client.get(
                    f"https://musicbrainz.org/ws/2/release?query=barcode:{httpx_quote(barcode)}&fmt=json&limit=5",
                    headers=headers_musicbrainz,
                    timeout=4.0
                )
                if mb_resp.status_code == 200:
                    mb_data = mb_resp.json()
                    for rel in mb_data.get("releases", []):
                        artist_credit = rel.get("artist-credit", [])
                        artist_name = artist_credit[0].get("name", "Unknown Artist") if artist_credit else "Unknown Artist"
                        album_title = rel.get("title", "Unknown Album")
                        key = f"{artist_name}_{album_title}".lower()
                        if key in seen_keys:
                            continue
                        seen_keys.add(key)

                        matches.append({
                            "id": f"mb_release_{rel.get('id')}",
                            "source_id": rel.get("id"),
                            "source_type": "musicbrainz",
                            "title": album_title,
                            "artist": artist_name,
                            "cover_url": f"https://coverartarchive.org/release/{rel.get('id')}/front-500",
                            "track_count": rel.get("track-count", 0),
                            "release_date": rel.get("date", ""),
                            "record_type": "album",
                        })
            except Exception as e:
                logger.warning(f"[Scanner] MusicBrainz barcode lookup failed: {e}")

        if matches:
            return {
                "success": True,
                "query_used": f"Barcode {barcode}",
                "media_type": "barcode",
                "confidence": 1.0,
                "matches": matches[:6]
            }

    # =========================================================================
    # LAYER 2: OCR TEXT NORMALIZATION & MULTI-CATALOG SEARCH
    # =========================================================================
    cleaned_text = clean_ocr_text(raw_text) if raw_text else ""
    logger.info(f"[Scanner] Normalized OCR text: '{cleaned_text}'")

    search_candidates: List[str] = []
    if cleaned_text:
        words = cleaned_text.split()
        # Candidate 1: Full cleaned string
        search_candidates.append(cleaned_text)
        # Candidate 2: First 4 words
        if len(words) > 4:
            search_candidates.append(" ".join(words[:4]))
        # Candidate 3: First 2 words (Artist name)
        if len(words) > 2:
            search_candidates.append(" ".join(words[:2]))

    # 1. Query Discogs API (Specializes in physical vinyl/CD titles)
    for q in search_candidates[:2]:
        if not q.strip() or len(matches) >= 3:
            continue
        try:
            dc_resp = await client.get(
                f"https://api.discogs.com/database/search?q={httpx_quote(q)}&type=release&per_page=5",
                headers=headers_discogs,
                timeout=4.0
            )
            if dc_resp.status_code == 200:
                dc_data = dc_resp.json()
                for item in dc_data.get("results", []):
                    title_full = item.get("title", "")
                    artist_name = "Unknown Artist"
                    album_title = title_full
                    if " - " in title_full:
                        parts = title_full.split(" - ", 1)
                        artist_name = parts[0].strip()
                        album_title = parts[1].strip()

                    key = f"{artist_name}_{album_title}".lower()
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)

                    matches.append({
                        "id": f"dc_{item.get('id')}",
                        "source_id": str(item.get("id")),
                        "source_type": "discogs",
                        "title": album_title,
                        "artist": artist_name,
                        "cover_url": item.get("cover_image") or item.get("thumb") or "",
                        "track_count": 0,
                        "release_date": str(item.get("year", "")),
                        "record_type": "album",
                    })
        except Exception as e:
            logger.warning(f"[Scanner] Discogs search failed for '{q}': {e}")

    # 2. Query Deezer API (For instant streamable album IDs)
    for q in search_candidates[:2]:
        if not q.strip():
            continue
        try:
            dz_resp = await client.get(
                f"https://api.deezer.com/search/album?q={httpx_quote(q)}&limit=5",
                timeout=4.0
            )
            if dz_resp.status_code == 200:
                dz_data = dz_resp.json()
                for item in dz_data.get("data", []):
                    aid = str(item.get("id"))
                    artist_obj = item.get("artist", {})
                    artist_name = artist_obj.get("name", "Unknown Artist")
                    album_title = item.get("title", "Unknown Album")
                    key = f"{artist_name}_{album_title}".lower()
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)

                    cover = item.get("cover_xl") or item.get("cover_big") or item.get("cover_medium") or ""
                    matches.append({
                        "id": f"dz_album_{aid}",
                        "source_id": aid,
                        "source_type": "deezer",
                        "title": album_title,
                        "artist": artist_name,
                        "artist_id": str(artist_obj.get("id", "")),
                        "cover_url": cover,
                        "track_count": item.get("nb_tracks", 0),
                        "release_date": item.get("release_date", ""),
                        "record_type": item.get("record_type", "album"),
                    })
        except Exception as e:
            logger.warning(f"[Scanner] Deezer search failed for '{q}': {e}")

    # 3. Fallback: Query MusicBrainz fuzzy index
    if len(matches) < 2 and search_candidates:
        try:
            mb_q = search_candidates[0]
            mb_resp = await client.get(
                f"https://musicbrainz.org/ws/2/release?query={httpx_quote(mb_q)}&fmt=json&limit=4",
                headers=headers_musicbrainz,
                timeout=4.0
            )
            if mb_resp.status_code == 200:
                mb_data = mb_resp.json()
                for rel in mb_data.get("releases", []):
                    rid = rel.get("id")
                    artist_credit = rel.get("artist-credit", [])
                    artist_name = artist_credit[0].get("name", "Unknown Artist") if artist_credit else "Unknown Artist"
                    album_title = rel.get("title", "Unknown Album")
                    key = f"{artist_name}_{album_title}".lower()
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)

                    matches.append({
                        "id": f"mb_album_{rid}",
                        "source_id": rid,
                        "source_type": "musicbrainz",
                        "title": album_title,
                        "artist": artist_name,
                        "cover_url": f"https://coverartarchive.org/release/{rid}/front-500",
                        "track_count": rel.get("track-count", 0),
                        "release_date": rel.get("date", ""),
                        "record_type": "album",
                    })
        except Exception as e:
            logger.warning(f"[Scanner] MusicBrainz search failed: {e}")

    return {
        "success": True,
        "query_used": search_candidates[0] if search_candidates else "",
        "raw_text": raw_text,
        "cleaned_text": cleaned_text,
        "media_type": req.mode or "cover",
        "confidence": 0.85 if matches else 0.0,
        "matches": matches[:6]
    }
