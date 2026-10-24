import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from app.services.powqr import create_powqr_code, fetch_and_cache_rendered_svg

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/share", tags=["Share & QR"])

class QRGenerateRequest(BaseModel):
    url: str
    title: Optional[str] = None
    dot_shape: Optional[str] = "star"
    eye_shape: Optional[str] = "leaf"
    animation: Optional[str] = "spin-eyes"

@router.post("/qr")
async def generate_dynamic_qr(req: QRGenerateRequest):
    """
    Generate or retrieve a high-aesthetic, dynamic vector QR code.
    Features radiating star spikes, organic leaf eye frames, smooth rotating nodes, and center brand badge.
    """
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Target URL is required")

    return await create_powqr_code(
        url,
        req.title,
        dot_shape=req.dot_shape or "star",
        eye_shape=req.eye_shape or "leaf",
        animation=req.animation or "spin-eyes"
    )

@router.get("/render/{short_code}.svg")
async def render_qr_svg(short_code: str):
    """
    Proxy & local-cache rendered SVG with baked-in center brand logo.
    """
    svg_content = await fetch_and_cache_rendered_svg(short_code)
    return Response(content=svg_content, media_type="image/svg+xml")
