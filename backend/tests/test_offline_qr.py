import os
import sys
import pytest
from pathlib import Path

# Ensure backend package is in python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.powqr import (
    create_powqr_code,
    fetch_and_cache_rendered_svg,
    generate_local_qr_svg,
    QR_CACHE_DIR,
    _qr_cache,
    _svg_cache,
)
from app.config import settings


@pytest.mark.asyncio
async def test_offline_qr_generation_no_api_key():
    """Verify QR code generates offline without requiring POWQR_API_KEY or internet."""
    # Ensure api key is empty
    old_key = settings.POWQR_API_KEY
    settings.POWQR_API_KEY = ""
    try:
        url = "https://audiohub.local/login?magic_auth=test_offline_123&pin=4567"
        result = await create_powqr_code(url, title="Offline Test QR", pin="4567")

        assert result["success"] is True
        assert "short_code" in result
        assert len(result["short_code"]) > 0
        assert "qr_svg_url" in result
        assert result["qr_svg_url"].startswith("data:image/svg+xml;utf8,")
        assert "local_proxy_url" in result
        assert result["local_proxy_url"] == f"/api/v1/share/render/{result['short_code']}.svg"
        assert result["destination_url"] == url
        assert result["pin"] == "4567"
        assert "svg" in result
        assert "<svg" in result["svg"]
        assert "</svg>" in result["svg"]

        # Verify cached fetch
        cached_svg = await fetch_and_cache_rendered_svg(result["short_code"])
        assert isinstance(cached_svg, bytes)
        assert b"<svg" in cached_svg
    finally:
        settings.POWQR_API_KEY = old_key


@pytest.mark.asyncio
async def test_offline_qr_caching():
    """Verify that repeated calls for the same URL return cached results in memory and on disk."""
    url = "https://audiohub.local/albums/test-cache-id"
    res1 = await create_powqr_code(url, title="Cached Album")
    assert res1["cached"] is False
    short_code = res1["short_code"]

    res2 = await create_powqr_code(url, title="Cached Album")
    assert res2["cached"] is True
    assert res1["short_code"] == res2["short_code"]

    # Verify disk caching persistence: clear in-memory cache and retrieve from disk
    disk_file = QR_CACHE_DIR / f"{short_code}.svg"
    assert disk_file.is_file(), f"Expected QR SVG file on disk at {disk_file}"

    # Clear memory cache
    _svg_cache.pop(short_code, None)

    # Must load from disk cache seamlessly
    disk_recovered_svg = await fetch_and_cache_rendered_svg(short_code)
    assert isinstance(disk_recovered_svg, bytes)
    assert b"<svg" in disk_recovered_svg
    assert _svg_cache.get(short_code) == disk_recovered_svg


def test_generate_local_qr_svg_validity():
    """Verify the generated vector SVG is valid and includes high-contrast elements for scannability."""
    svg_bytes = generate_local_qr_svg("https://example.com/share/test")
    svg_text = svg_bytes.decode("utf-8")

    assert "viewBox" in svg_text
    assert "<path" in svg_text
    # High-contrast elements: viewBox, path data, and white/dark contrast
    assert 'fill="white"' in svg_text or 'fill="#ffffff"' in svg_text or 'rect' in svg_text
