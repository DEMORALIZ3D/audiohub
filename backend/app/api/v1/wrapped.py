import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import User
from ...config import settings
from .auth import get_current_user
from .stats import get_personal_listening_stats
from ...services.video_renderer import video_renderer, HostLoadMonitor

logger = logging.getLogger("audiohub.api.wrapped")
router = APIRouter()

@router.get("/host-status")
def get_host_load_status() -> Dict[str, Any]:
    """
    Returns real-time host machine load status (CPU, memory, load average)
    used for load-adaptive video rendering throttling.
    """
    return HostLoadMonitor.get_status()

@router.post("/jobs", status_code=status.HTTP_202_ACCEPTED)
async def create_wrapped_video_job(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Queues a high-definition 9:16 vertical video render of the user's Year in Review listening stats.
    The background worker renders asynchronously and automatically pauses if the host machine
    is under high load to protect audio streaming.
    """
    stats_data = get_personal_listening_stats(current_user=current_user, db=db)
    job = await video_renderer.submit_job(
        user_id=current_user.id,
        username=current_user.display_name or current_user.username,
        stats_data=stats_data
    )
    return job.to_dict()

@router.get("/jobs/{job_id}")
def get_wrapped_video_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Polls the progress and load status of an active or completed Wrapped video render job.
    """
    job = video_renderer.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Render job not found.")
    if job.user_id != current_user.id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied to this render job.")
    return job.to_dict()

@router.get("/jobs/{job_id}/download")
def download_wrapped_video(
    job_id: str
):
    """
    Downloads the completed 9:16 Wrapped MP4 video file.
    """
    job = video_renderer.get_job(job_id)
    if job:
        if job.status != "completed" or not job.output_path.exists():
            raise HTTPException(status_code=400, detail="Video is still rendering or unavailable.")
        file_path = job.output_path
        filename = job.output_filename
    else:
        safe_id = "".join(c for c in job_id if c.isalnum() or c == "_")
        fallback_path = settings.EXPORTS_DIR / f"audiohub_wrapped_2026_{safe_id}.mp4"
        if not fallback_path.exists():
            raise HTTPException(status_code=404, detail="Render job or video file not found.")
        file_path = fallback_path
        filename = f"audiohub_wrapped_2026_{safe_id}.mp4"

    return FileResponse(
        path=str(file_path),
        media_type="video/mp4",
        filename=filename,
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
