import os
import sys
import time
import math
import uuid
import asyncio
import logging
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
from io import BytesIO

import psutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter

from ..config import settings

logger = logging.getLogger("audiohub.video_renderer")

# Ensure exports directory exists
settings.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

class HostLoadMonitor:
    """
    Monitors host CPU, memory, and load average to protect media playback and NVR workloads.
    """
    CPU_THRESHOLD_HIGH = 75.0    # Pause rendering if CPU exceeds this
    CPU_THRESHOLD_RESUME = 60.0  # Resume rendering once CPU drops below this
    MEM_THRESHOLD_HIGH = 88.0    # Pause rendering if host RAM is critically high

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        try:
            cpu_pct = psutil.cpu_percent(interval=None)
            mem_pct = psutil.virtual_memory().percent
            cores = os.cpu_count() or 4
            load_avg = os.getloadavg()[0] if hasattr(os, "getloadavg") else (cpu_pct / 100.0 * cores)
            is_loaded = cpu_pct >= cls.CPU_THRESHOLD_HIGH or mem_pct >= cls.MEM_THRESHOLD_HIGH or load_avg > (cores * 1.25)
            return {
                "cpu_percent": round(cpu_pct, 1),
                "memory_percent": round(mem_pct, 1),
                "load_average": round(load_avg, 2),
                "cpu_cores": cores,
                "is_under_load": is_loaded
            }
        except Exception as e:
            logger.warning(f"Error checking host load: {e}")
            return {
                "cpu_percent": 0.0,
                "memory_percent": 0.0,
                "load_average": 0.0,
                "cpu_cores": 4,
                "is_under_load": False
            }

    @classmethod
    def is_under_load(cls) -> Tuple[bool, str]:
        st = cls.get_status()
        if st["cpu_percent"] >= cls.CPU_THRESHOLD_HIGH:
            return True, f"Host CPU busy ({st['cpu_percent']}%)"
        if st["memory_percent"] >= cls.MEM_THRESHOLD_HIGH:
            return True, f"Host RAM high ({st['memory_percent']}%)"
        if st["load_average"] > (st["cpu_cores"] * 1.25):
            return True, f"Host load average high ({st['load_average']})"
        return False, "Host load normal"


class VideoRenderJob:
    def __init__(self, user_id: str, username: str, stats_data: Dict[str, Any]):
        self.id = f"wrap_{uuid.uuid4().hex[:10]}"
        self.user_id = user_id
        self.username = username
        self.stats_data = stats_data
        self.status = "queued"  # queued, rendering, paused, completed, failed
        self.progress = 0.0     # 0 to 100
        self.current_frame = 0
        self.total_frames = 600 # 20 seconds at 30 fps
        self.message = "Queued in background..."
        self.pause_reason = ""
        self.created_at = time.time()
        self.completed_at: Optional[float] = None
        self.output_filename = f"audiohub_wrapped_2026_{self.id}.mp4"
        self.output_path = settings.EXPORTS_DIR / self.output_filename
        self.download_url = f"/api/v1/wrapped/jobs/{self.id}/download"
        self.file_size_bytes = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "status": self.status,
            "progress": round(self.progress, 1),
            "current_frame": self.current_frame,
            "total_frames": self.total_frames,
            "message": self.message,
            "pause_reason": self.pause_reason,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
            "download_url": self.download_url if self.status == "completed" else None,
            "file_size_bytes": self.file_size_bytes,
        }


class VideoRenderService:
    def __init__(self):
        self._jobs: Dict[str, VideoRenderJob] = {}
        self._queue: asyncio.Queue = asyncio.Queue()
        self._worker_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        self.font_regular = self._load_font("DejaVuSans.ttf", 36)
        self.font_bold = self._load_font("DejaVuSans-Bold.ttf", 48)
        self.font_hero = self._load_font("DejaVuSans-Bold.ttf", 72)
        self.font_small = self._load_font("DejaVuSans.ttf", 26)

    def _load_font(self, font_name: str, size: int):
        font_paths = [
            f"/usr/share/fonts/truetype/dejavu/{font_name}",
            f"C:/Windows/Fonts/{font_name.replace('DejaVu', 'arial')}",
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/seguiemj.ttf",
        ]
        for p in font_paths:
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    pass
        return ImageFont.load_default()

    def start_worker(self):
        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._process_queue())

    async def submit_job(self, user_id: str, username: str, stats_data: Dict[str, Any]) -> VideoRenderJob:
        job = VideoRenderJob(user_id=user_id, username=username, stats_data=stats_data)
        self._jobs[job.id] = job
        await self._queue.put(job.id)
        self.start_worker()
        return job

    def get_job(self, job_id: str) -> Optional[VideoRenderJob]:
        return self._jobs.get(job_id)

    async def _process_queue(self):
        logger.info("VideoRenderService queue processor started.")
        while True:
            job_id = await self._queue.get()
            job = self._jobs.get(job_id)
            if not job:
                self._queue.task_done()
                continue

            try:
                await self._render_wrapped_video(job)
            except Exception as e:
                logger.error(f"Error rendering wrapped video {job_id}: {e}", exc_info=True)
                job.status = "failed"
                job.message = f"Rendering error: {str(e)}"
            finally:
                self._queue.task_done()

    async def _render_wrapped_video(self, job: VideoRenderJob):
        job.status = "rendering"
        job.message = "Synthesizing Wrapped Story video..."
        logger.info(f"Starting render for Wrapped Video Job: {job.id}")

        width, height = 1080, 1920
        fps = 30
        total_frames = job.total_frames
        stats = job.stats_data

        # 1. Prepare Top Track Album Art for Vinyl Record
        top_tracks = stats.get("top_tracks", [])
        top_track = top_tracks[0]["track"] if top_tracks else {}
        top_title = top_track.get("title", "Top Track")
        top_artist = top_track.get("artist", "Favorite Artist")
        top_cover_url = top_track.get("cover_url", "")

        cover_img: Optional[Image.Image] = None
        if top_cover_url:
            try:
                from .http_client import get_http_client
                client = get_http_client()
                resp = await client.get(top_cover_url, timeout=5.0)
                if resp.status_code == 200:
                    cover_img = Image.open(BytesIO(resp.content)).convert("RGB")
                    cover_img = cover_img.resize((360, 360), Image.Resampling.LANCZOS)
            except Exception as e:
                logger.debug(f"Could not load cover for video: {e}")

        if not cover_img:
            # Fallback procedural cover art
            cover_img = Image.new("RGB", (360, 360), color=(16, 185, 129))
            d = ImageDraw.Draw(cover_img)
            d.text((40, 160), "🎵 Top Hit", fill=(255, 255, 255), font=self.font_bold)

        # 2. Check for Top Track audio snippet
        audio_snippet_path: Optional[str] = None
        top_track_id = top_track.get("id")
        if top_track_id:
            # Check disk cache
            possible_cache = settings.CACHE_DIR / f"{top_track_id}.mp4"
            if not possible_cache.exists():
                possible_cache = settings.CACHE_DIR / f"{top_track_id}.m4a"
            if possible_cache.exists():
                audio_snippet_path = str(possible_cache)

        # 3. Setup FFmpeg subprocess pipe
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-f", "rawvideo",
            "-vcodec", "rawvideo",
            "-s", f"{width}x{height}",
            "-pix_fmt", "rgb24",
            "-r", str(fps),
            "-i", "-"
        ]

        if audio_snippet_path and os.path.exists(audio_snippet_path):
            ffmpeg_cmd.extend([
                "-ss", "15", # start at 15s chorus
                "-t", "20",
                "-i", audio_snippet_path,
                "-af", "afade=t=in:ss=0:d=1,afade=t=out:st=18.5:d=1.5",
                "-c:a", "aac",
                "-b:a", "192k"
            ])
        else:
            # Generate synth soundscape if no local audio cached
            ffmpeg_cmd.extend([
                "-f", "lavfi",
                "-i", "sine=frequency=220:sample_rate=44100:beep_factor=2",
                "-t", "21",
                "-af", "volume=0.08,afade=t=in:ss=0:d=1,afade=t=out:st=18.5:d=1.5",
                "-c:a", "aac",
                "-b:a", "128k"
            ])

        ffmpeg_cmd.extend([
            "-threads", "2",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-t", "20",
            str(job.output_path)
        ])

        proc = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE
        )

        try:
            # Render 600 frames at 30 fps (20 seconds)
            for frame_idx in range(total_frames):
                # Check host load every 15 frames (~0.5s of video)
                if frame_idx % 15 == 0:
                    under_load, load_reason = HostLoadMonitor.is_under_load()
                    if under_load:
                        job.status = "paused"
                        job.pause_reason = load_reason
                        job.message = f"Paused — {load_reason}. Waiting for host load to normalize..."
                        logger.warning(f"Video job {job.id} paused: {load_reason}")

                        # Notify WebSocket clients
                        try:
                            from ..api.v1.connect import notify_user_connect
                            await notify_user_connect(job.user_id, "wrapped_video_paused", {
                                "job_id": job.id,
                                "reason": load_reason,
                                "progress": job.progress
                            })
                        except Exception:
                            pass

                        # Loop until host load drops
                        while True:
                            await asyncio.sleep(2.5)
                            still_loaded, _ = HostLoadMonitor.is_under_load()
                            if not still_loaded:
                                job.status = "rendering"
                                job.pause_reason = ""
                                job.message = f"Resumed rendering (frame {frame_idx}/{total_frames})..."
                                logger.info(f"Video job {job.id} resumed.")
                                break

                # Render frame in memory
                frame_bytes = self._draw_frame(frame_idx, total_frames, width, height, stats, top_title, top_artist, cover_img)
                if proc.stdin:
                    try:
                        proc.stdin.write(frame_bytes)
                        proc.stdin.flush()
                    except (BrokenPipeError, OSError):
                        logger.info(f"FFmpeg closed stdin at frame {frame_idx}/{total_frames}")
                        del frame_bytes
                        break
                del frame_bytes

                job.current_frame = frame_idx + 1
                job.progress = (job.current_frame / total_frames) * 100.0
                if frame_idx % 30 == 0:
                    job.message = f"Rendering {int(job.progress)}% (frame {frame_idx}/{total_frames})"
                    await asyncio.sleep(0.001) # yield to event loop

            if proc.stdin and not proc.stdin.closed:
                try:
                    proc.stdin.close()
                except Exception:
                    pass
            proc.wait(timeout=30)

            if proc.returncode != 0:
                err_output = proc.stderr.read().decode() if proc.stderr else "Unknown error"
                raise RuntimeError(f"FFmpeg exited with code {proc.returncode}: {err_output[-200:]}")

            job.status = "completed"
            job.progress = 100.0
            job.completed_at = time.time()
            job.message = "Video ready for download and sharing!"
            if job.output_path.exists():
                job.file_size_bytes = job.output_path.stat().st_size

            logger.info(f"Successfully finished rendering Wrapped video: {job.output_path} ({job.file_size_bytes} bytes)")

            # Send real-time notification to user via WebSocket
            try:
                from ..api.v1.connect import notify_user_connect
                await notify_user_connect(job.user_id, "wrapped_video_ready", {
                    "job_id": job.id,
                    "download_url": job.download_url,
                    "file_size_bytes": job.file_size_bytes
                })
            except Exception as e:
                logger.debug(f"Failed to send WS notify: {e}")

        except Exception as ex:
            if proc.stdin:
                try:
                    proc.stdin.close()
                except Exception:
                    pass
            proc.kill()
            raise ex

    def _draw_frame(
        self,
        frame_idx: int,
        total_frames: int,
        width: int,
        height: int,
        stats: Dict[str, Any],
        top_title: str,
        top_artist: str,
        cover_img: Image.Image
    ) -> bytes:
        """
        Draws a single frame of the 9:16 vertical video with energetic motion graphics.
        5 Scenes across 600 frames (20 seconds at 30 fps).
        """
        # Base background: deep aesthetic midnight gradient with dynamic aurora glow
        img = Image.new("RGB", (width, height), color=(10, 14, 22))
        draw = ImageDraw.Draw(img)

        t = frame_idx / 30.0

        # Ambient Dynamic Aurora Glow Orbs that drift across the frame
        glow1_x = int(width * 0.5 + 140 * math.cos(t * 1.4))
        glow1_y = int(height * 0.42 + 90 * math.sin(t * 1.7))
        r1 = int(280 + 50 * math.sin(t * 2.0))
        draw.ellipse([glow1_x - r1, glow1_y - r1, glow1_x + r1, glow1_y + r1], fill=(16, 45, 36))

        glow2_x = int(width * 0.3 + 120 * math.sin(t * 1.1))
        glow2_y = int(height * 0.65 + 100 * math.cos(t * 1.3))
        r2 = int(240 + 40 * math.cos(t * 1.8))
        draw.ellipse([glow2_x - r2, glow2_y - r2, glow2_x + r2, glow2_y + r2], fill=(36, 18, 52))

        glow3_x = int(width * 0.7 + 90 * math.cos(t * 2.2))
        glow3_y = int(height * 0.28 + 70 * math.sin(t * 1.5))
        r3 = int(200 + 35 * math.sin(t * 2.4))
        draw.ellipse([glow3_x - r3, glow3_y - r3, glow3_x + r3, glow3_y + r3], fill=(32, 26, 18))

        # Floating Particles / Specks drifting upwards
        for p_idx in range(16):
            px = int(((p_idx * 79 + 40) % (width - 120)) + 60 + 18 * math.sin(t * 1.8 + p_idx))
            py = int((height - ((t * 90 + p_idx * 115) % height)))
            p_rad = 3 + (p_idx % 4)
            p_col = (16, 185, 129) if p_idx % 2 == 0 else (245, 158, 11)
            draw.ellipse([px - p_rad, py - p_rad, px + p_rad, py + p_rad], fill=p_col)

        # Header: Brand mark & progress pill
        draw.text((60, 80), f"🎵 {settings.BRAND_NAME.upper()} WRAPPED", fill=(16, 185, 129), font=self.font_small)
        draw.text((width - 240, 80), "2026 EDITION", fill=(156, 163, 175), font=self.font_small)

        # Multi-segment progress bar at top (like Stories)
        seg_count = 5
        seg_w = (width - 120 - (seg_count - 1) * 12) // seg_count
        cur_seg = min(seg_count - 1, int(frame_idx / (total_frames / seg_count)))
        for s in range(seg_count):
            sx = 60 + s * (seg_w + 12)
            fill_col = (16, 185, 129) if s <= cur_seg else (55, 65, 81)
            draw.rounded_rectangle([sx, 125, sx + seg_w, 131], radius=3, fill=fill_col)

        # Scene Dispatcher based on frame timing
        # 0s - 4s (0 - 120): Intro & Listening Time
        # 4s - 8s (120 - 240): Top Artists
        # 8s - 13s (240 - 390): Top Tracks
        # 13s - 17.5s (390 - 525): #1 Hit Vinyl Spotlight
        # 17.5s - 20s (525 - 600): Outro & Personality Badge

        if frame_idx < 120:
            # Scene 1: Minutes Count-Up with Shockwave Pulse & Elastic Impact
            ease = 1.0 - math.pow(1.0 - min(1.0, frame_idx / 80.0), 3)
            total_mins = int(stats.get("total_duration_minutes", 0))
            display_mins = int(total_mins * ease)

            # Animated concentric pulse rings behind the number
            pulse_rad = int(180 + 45 * abs(math.sin(t * 3.5)))
            draw.ellipse([width//2 - pulse_rad, 520 - pulse_rad, width//2 + pulse_rad, 520 + pulse_rad], outline=(16, 185, 129), width=2)
            if frame_idx >= 75:
                # Shockwave expansion wave when completed
                exp_rad = int(pulse_rad + ((frame_idx - 75) * 8))
                if exp_rad < 400:
                    draw.ellipse([width//2 - exp_rad, 520 - exp_rad, width//2 + exp_rad, 520 + exp_rad], outline=(52, 211, 153), width=3)

            draw.text((60, 360), "You lived inside the music.", fill=(156, 163, 175), font=self.font_bold)
            draw.text((60, 480), f"{display_mins:,}", fill=(255, 255, 255), font=self.font_hero)
            draw.text((60, 580), "MINUTES LISTENED", fill=(16, 185, 129), font=self.font_bold)

            hours = stats.get("total_duration_hours", 0)
            plays = stats.get("total_plays", 0)
            draw.rounded_rectangle([60, 720, width - 60, 920], radius=24, fill=(20, 26, 38), outline=(38, 48, 64), width=1)
            draw.text((100, 760), f"⚡ {plays} Total Song Plays", fill=(255, 255, 255), font=self.font_regular)
            draw.text((100, 830), f"⏱ Over {hours} hours of pure fidelity sound", fill=(156, 163, 175), font=self.font_small)

        elif frame_idx < 240:
            # Scene 2: Top Artists with Alternating Left/Right Staggered Spring Cards
            draw.text((60, 320), "YOUR TOP ARTISTS", fill=(16, 185, 129), font=self.font_small)
            draw.text((60, 370), "The voices in your ear.", fill=(255, 255, 255), font=self.font_hero)

            top_artists = stats.get("top_artists", [])[:5]
            for idx, a in enumerate(top_artists):
                start_f = 120 + idx * 8
                p = max(0.0, min(1.0, (frame_idx - start_f) / 14.0))
                # Spring overshoot ease
                ease = 1.0 + 2.0 * math.pow(p - 1.0, 3) + 1.0 * math.pow(p - 1.0, 2) if p < 1.0 else 1.0
                offset_x = int((1.0 - ease) * (-360 if idx % 2 == 0 else 360))
                y = 560 + idx * 170

                # Card with dynamic animated highlight
                card_col = (26, 34, 48) if idx == 0 else (20, 26, 38)
                card_border = (245, 158, 11) if idx == 0 else (38, 48, 64)
                draw.rounded_rectangle([160 + offset_x, y, width - 60 + offset_x, y + 80], radius=16, fill=card_col, outline=card_border, width=2 if idx == 0 else 1)
                draw.text((190 + offset_x, y + 16), a.get("artist", "Artist"), fill=(255, 255, 255), font=self.font_bold)
                draw.text((width - 200 + offset_x, y + 24), f"{a.get('play_count', 0)} plays", fill=(16, 185, 129), font=self.font_small)

                # Rank pill
                rank_col = (245, 158, 11) if idx == 0 else (31, 41, 55)
                draw.rounded_rectangle([60 + offset_x, y, 140 + offset_x, y + 80], radius=16, fill=rank_col)
                draw.text((88 + offset_x, y + 16), f"#{idx + 1}", fill=(0, 0, 0) if idx == 0 else (255, 255, 255), font=self.font_bold)

        elif frame_idx < 390:
            # Scene 3: Top Tracks with Staggered Entrance & Dancing Mini-Equalizer
            draw.text((60, 320), "SONGS ON REPEAT", fill=(16, 185, 129), font=self.font_small)
            draw.text((60, 370), "Your Soundtrack of 2026", fill=(255, 255, 255), font=self.font_hero)

            top_tracks_list = stats.get("top_tracks", [])[:5]
            for idx, t_item in enumerate(top_tracks_list):
                tr = t_item.get("track", {})
                start_f = 240 + idx * 8
                p = max(0.0, min(1.0, (frame_idx - start_f) / 14.0))
                ease = 1.0 + 1.8 * math.pow(p - 1.0, 3) + 0.9 * math.pow(p - 1.0, 2) if p < 1.0 else 1.0
                offset_x = int((1.0 - ease) * 400)
                y = 560 + idx * 170

                # Card
                draw.rounded_rectangle([160 + offset_x, y, width - 60 + offset_x, y + 80], radius=16, fill=(20, 26, 38), outline=(236, 72, 153) if idx == 0 else (38, 48, 64), width=2 if idx == 0 else 1)
                clean_title = tr.get("title", "Track")
                if len(clean_title) > 20:
                    clean_title = clean_title[:18] + "..."
                draw.text((190 + offset_x, y + 12), clean_title, fill=(255, 255, 255), font=self.font_bold)
                draw.text((190 + offset_x, y + 54), tr.get("artist", ""), fill=(156, 163, 175), font=self.font_small)

                # Mini animated equalizer bars on each track row
                eq_start_x = width - 140 + offset_x
                for b in range(4):
                    bh = int(8 + 26 * abs(math.sin(t * 14.0 + idx * 1.8 + b * 0.9)))
                    bx = eq_start_x + b * 10
                    draw.rounded_rectangle([bx, y + 58 - bh, bx + 6, y + 58], radius=2, fill=(236, 72, 153))

                # Rank badge
                draw.rounded_rectangle([60 + offset_x, y, 140 + offset_x, y + 80], radius=16, fill=(20, 26, 38))
                draw.text((88 + offset_x, y + 16), f"#{idx + 1}", fill=(236, 72, 153), font=self.font_bold)

        elif frame_idx < 525:
            # Scene 4: #1 Song Spotlight with Expanding Bass Shockwaves & 32-Bar Jumping Spectrum
            draw.text((60, 280), "YOUR #1 SONG OF THE YEAR", fill=(16, 185, 129), font=self.font_bold)
            draw.text((60, 350), top_title[:28], fill=(255, 255, 255), font=self.font_hero)
            draw.text((60, 440), f"by {top_artist}", fill=(156, 163, 175), font=self.font_bold)

            center_x, center_y = width // 2, 940
            vinyl_radius = 320

            # Concentric Expanding Bass Shockwaves
            for ring_idx in range(3):
                r_offset = ((frame_idx * 8 + ring_idx * 70) % 240)
                shock_r = vinyl_radius + r_offset
                if shock_r < vinyl_radius + 230:
                    ring_col = (245, 158, 11) if ring_idx % 2 == 0 else (16, 185, 129)
                    draw.ellipse(
                        [center_x - shock_r, center_y - shock_r, center_x + shock_r, center_y + shock_r],
                        outline=ring_col,
                        width=2
                    )

            # 1. Dark vinyl disc base
            draw.ellipse(
                [center_x - vinyl_radius, center_y - vinyl_radius, center_x + vinyl_radius, center_y + vinyl_radius],
                fill=(12, 12, 14),
                outline=(28, 28, 32),
                width=6
            )
            # 2. Vinyl grooves
            for r in range(160, vinyl_radius - 10, 18):
                draw.ellipse(
                    [center_x - r, center_y - r, center_x + r, center_y + r],
                    outline=(22, 22, 26),
                    width=2
                )

            # 3. Rotating Center Label with Album Cover
            rot_deg = (frame_idx * 5.0) % 360
            if cover_img:
                rot_cover = cover_img.rotate(-rot_deg, resample=Image.Resampling.BICUBIC)
                mask = Image.new("L", (360, 360), 0)
                mask_draw = ImageDraw.Draw(mask)
                mask_draw.ellipse([0, 0, 360, 360], fill=255)
                # Spindle center hole
                mask_draw.ellipse([155, 155, 205, 205], fill=0)

                img.paste(rot_cover, (center_x - 180, center_y - 180), mask)

            # Spindle hole rim
            draw.ellipse([center_x - 26, center_y - 26, center_x + 26, center_y + 26], fill=(8, 8, 10), outline=(200, 200, 200), width=3)

            # 32-Band Dynamic Dancing Equalizer Spectrum
            bar_count = 32
            bar_w = 12
            gap = 8
            start_x = (width - (bar_count * (bar_w + gap))) // 2
            for b in range(bar_count):
                osc1 = math.sin(t * 12.0 + b * 0.35)
                osc2 = math.cos(t * 7.5 - b * 0.45)
                osc3 = math.sin(t * 22.0 + b * 0.8) * 0.3
                bar_h = int(14 + 110 * abs(osc1 * 0.6 + osc2 * 0.4 + osc3))
                bx = start_x + b * (bar_w + gap)
                by = 1390 - bar_h
                bar_col = (16, 185, 129) if b < 12 else (6, 182, 212) if b < 24 else (245, 158, 11)
                draw.rounded_rectangle([bx, by, bx + bar_w, 1390], radius=4, fill=bar_col)

        else:
            # Scene 5: Outro & Personality Badge with Celebration Starbursts
            # Floating celebration particles bursting from trophy card
            for star in range(24):
                angle = star * (2.0 * math.pi / 24.0) + (t * 0.8)
                dist = 220 + 80 * math.sin(t * 3.0 + star)
                sx = int(width // 2 + dist * math.cos(angle))
                sy = int(760 + dist * 0.7 * math.sin(angle))
                star_col = (245, 158, 11) if star % 3 == 0 else (16, 185, 129) if star % 3 == 1 else (236, 72, 153)
                s_size = 4 + (star % 3) * 2
                draw.ellipse([sx - s_size, sy - s_size, sx + s_size, sy + s_size], fill=star_col)

            draw.text((60, 340), "YOUR LISTENING PERSONA", fill=(16, 185, 129), font=self.font_small)
            draw.text((60, 400), "The Crate Digger", fill=(255, 255, 255), font=self.font_hero)

            draw.rounded_rectangle([60, 560, width - 60, 960], radius=28, fill=(20, 26, 38), outline=(245, 158, 11), width=2)
            draw.text((100, 620), "🎧 Pure Sovereign Audiophile", fill=(245, 158, 11), font=self.font_bold)
            draw.text((100, 700), "You explore albums end-to-end, dive deep", fill=(255, 255, 255), font=self.font_regular)
            draw.text((100, 760), "into high-bitrate studio masters, and reject", fill=(255, 255, 255), font=self.font_regular)
            draw.text((100, 820), "algorithmic compression.", fill=(255, 255, 255), font=self.font_regular)

            draw.text((width // 2 - 160, 1420), f"{settings.BRAND_NAME.upper()} • MUSIC", fill=(16, 185, 129), font=self.font_bold)
            draw.text((width // 2 - 190, 1490), settings.APP_NAME or "AudioHub", fill=(156, 163, 175), font=self.font_small)

        # Footer timestamp watermark
        draw.text((60, height - 80), "Powered by AudioHub DSP", fill=(75, 85, 99), font=self.font_small)
        draw.text((width - 240, height - 80), "9:16 HD SHORT", fill=(75, 85, 99), font=self.font_small)

        return img.tobytes()

video_renderer = VideoRenderService()
