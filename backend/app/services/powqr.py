import hashlib
import logging
import re
import urllib.parse
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import HTTPException
import qrcode
import qrcode.image.svg
import qrcode.constants
from app.config import settings

logger = logging.getLogger(__name__)

_qr_cache: Dict[str, Dict[str, Any]] = {}
_svg_cache: Dict[str, bytes] = {}

# Directory for persisting generated QR SVG files offline across restarts
QR_CACHE_DIR: Path = settings.CACHE_DIR / "qr"
try:
    QR_CACHE_DIR.mkdir(parents=True, exist_ok=True)
except Exception as e:
    logger.warning(f"Could not initialize QR cache directory: {e}")

def inject_center_logo_into_svg(svg_content: bytes) -> bytes:
    """
    Embeds the brand logo in the center badge of the QR code with high-contrast styling.
    """
    try:
        svg_text = svg_content.decode("utf-8")

        # Strip any rotation/spin animations from SVG to guarantee instant camera scan
        svg_text = re.sub(r'animation:[^;]+;', '', svg_text)
        svg_text = re.sub(r'@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '', svg_text)
        svg_text = re.sub(r'<style>.*?</style>', '', svg_text, flags=re.DOTALL)

        if 'id="center-brand-logo"' in svg_text:
            return svg_text.encode("utf-8")

        match = re.search(r'viewBox=["\']([-\d\.\s]+)["\']', svg_text)
        if not match:
            return svg_text.encode("utf-8")

        coords = [float(v) for v in match.group(1).split()]
        if len(coords) != 4:
            return svg_text.encode("utf-8")

        min_x, min_y, width, height = coords
        cx = min_x + width / 2.0
        cy = min_y + height / 2.0
        badge_size = min(width, height) * 0.22
        half_badge = badge_size / 2.0
        corner_r = badge_size * 0.28
        inner_icon_size = badge_size * 0.72
        half_icon = inner_icon_size / 2.0

        badge_xml = f'''  <g id="center-brand-logo" transform="translate({cx:.1f}, {cy:.1f})">
    <rect x="-{half_badge:.1f}" y="-{half_badge:.1f}" width="{badge_size:.1f}" height="{badge_size:.1f}" rx="{corner_r:.1f}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
    <image href="{settings.BRAND_LOGO_URL}" x="-{half_icon:.1f}" y="-{half_icon:.1f}" width="{inner_icon_size:.1f}" height="{inner_icon_size:.1f}" />
  </g>
</svg>'''
        new_svg_text = re.sub(r'</svg>\s*$', badge_xml, svg_text, flags=re.IGNORECASE)
        return new_svg_text.encode("utf-8")
    except Exception as e:
        logger.warning(f"Failed to inject center logo into SVG: {e}")
        return svg_content

def generate_local_qr_svg(url: str) -> bytes:
    """
    Generates a clean vector SVG QR code 100% locally and offline.
    Uses ERROR_CORRECT_H to ensure scannability even with center badge overlay.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
        image_factory=qrcode.image.svg.SvgPathFillImage,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image()
    raw_svg_bytes = img.to_string()
    return inject_center_logo_into_svg(raw_svg_bytes)

async def create_powqr_code(
    url: str,
    title: Optional[str] = None,
    dot_shape: str = "square",
    eye_shape: str = "square",
    animation: str = "none",
    pin: Optional[str] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Generates high-contrast, camera-scannable vector QR code locally and offline.
    Maintains backwards-compatible interface with legacy PowQR provider.
    """
    url = url.strip()
    cache_key = f"{url}:{title}:{pin}"
    if cache_key in _qr_cache:
        cached = dict(_qr_cache[cache_key])
        cached["cached"] = True
        return cached

    # Deterministic short code based on URL
    short_code = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]

    # Generate offline SVG QR code
    svg_bytes = generate_local_qr_svg(url)
    svg_str = svg_bytes.decode("utf-8")

    # Cache in memory
    _svg_cache[short_code] = svg_bytes
    if len(_svg_cache) > 500:
        _svg_cache.clear()
        _svg_cache[short_code] = svg_bytes

    # Cache to disk for persistence across restarts
    try:
        (QR_CACHE_DIR / f"{short_code}.svg").write_bytes(svg_bytes)
    except Exception as e:
        logger.debug(f"Could not persist QR code SVG to disk: {e}")

    # Build data URI and local proxy URL
    data_url = f"data:image/svg+xml;utf8,{urllib.parse.quote(svg_str)}"
    local_proxy_url = f"/api/v1/share/render/{short_code}.svg"

    result: Dict[str, Any] = {
        "success": True,
        "short_code": short_code,
        "qr_svg_url": data_url,
        "local_proxy_url": local_proxy_url,
        "scan_url": url,
        "destination_url": url,
        "title": title,
        "svg": svg_str,
        "cached": False,
    }

    if pin is not None:
        result["pin"] = pin

    if len(_qr_cache) > 500:
        _qr_cache.clear()
    _qr_cache[cache_key] = result
    return result

async def fetch_and_cache_rendered_svg(short_code: str) -> bytes:
    """
    Retrieves locally cached SVG vector content by short code.
    Completely offline: checks in-memory cache and persistent cache directory.
    """
    if short_code in _svg_cache:
        return _svg_cache[short_code]

    # Check local disk cache
    cached_file = QR_CACHE_DIR / f"{short_code}.svg"
    if cached_file.is_file():
        try:
            svg_bytes = cached_file.read_bytes()
            _svg_cache[short_code] = svg_bytes
            return svg_bytes
        except Exception as e:
            logger.warning(f"Failed to read cached SVG from disk: {e}")

    raise HTTPException(status_code=404, detail="SVG not found for QR code")
