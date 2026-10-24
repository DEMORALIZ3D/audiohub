import asyncio
import json
import logging
import os
import socket
import time
import uuid
from typing import Dict, List, Optional, Any
import httpx

try:
    import pychromecast
    from pychromecast.controllers.dashcast import DashCastController
    PYCHROMECAST_AVAILABLE = True
except ImportError:
    PYCHROMECAST_AVAILABLE = False

logger = logging.getLogger(__name__)

SCREEN_KEYWORDS = [
    "hub", "display", "clock", "tv", "oled", "chromecast", "smart display",
    "screen", "desk", "kitchen clock", "aftkm", "airreceiver", "nest hub"
]


class CastDevice:
    def __init__(
        self,
        device_id: str,
        name: str,
        ip: str,
        port: int = 8009,
        model_name: Optional[str] = None,
        has_screen: bool = False,
    ):
        self.id = device_id
        self.name = name
        self.ip = ip
        self.port = port
        self.model_name = model_name or "Google Cast Device"
        self.has_screen = has_screen
        self.device_type = "tv" if has_screen else "speaker"
        self.is_playing = False
        self.current_track: Optional[Dict[str, Any]] = None
        self.position_seconds = 0
        self.volume = 0.8
        self.last_seen = time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "device_type": self.device_type,
            "is_active": self.is_playing,
            "is_current_device": False,
            "volume": self.volume,
            "current_track": self.current_track,
            "is_playing": self.is_playing,
            "position_seconds": self.position_seconds,
            "last_seen": self.last_seen,
            "is_cast": True,
            "has_screen": self.has_screen,
            "ip": self.ip,
            "model": self.model_name,
        }


class CastMediaListener:
    def __init__(self, service: "CastService", dev_id: str):
        self.service = service
        self.dev_id = dev_id
        self._last_state = None

    def new_media_status(self, status):
        dev = self.service.devices.get(self.dev_id)
        if not dev:
            return

        state = getattr(status, "player_state", None)
        idle_reason = getattr(status, "idle_reason", None)
        current_time = getattr(status, "current_time", None)

        if current_time is not None:
            dev.position_seconds = current_time

        if state == "PLAYING":
            dev.is_playing = True
        elif state == "PAUSED":
            dev.is_playing = False
        elif state == "IDLE":
            dev.is_playing = False
            if idle_reason == "FINISHED" or (self._last_state == "PLAYING" and idle_reason != "INTERRUPTED"):
                logger.info(f"Cast device {dev.name} ({self.dev_id}) finished track playback (reason: {idle_reason}).")
                if self.service.on_track_ended_callback and self.service.loop and not self.service.loop.is_closed():
                    try:
                        asyncio.run_coroutine_threadsafe(
                            self.service.on_track_ended_callback(self.dev_id),
                            self.service.loop
                        )
                    except Exception as e:
                        logger.warning(f"Error calling on_track_ended_callback: {e}")

        self._last_state = state

    def load_media_failed(self, queue_item_id, error_code):
        logger.warning(f"Cast device {self.dev_id} load media failed: code {error_code}")


def _detect_lan_host() -> str:
    env_host = os.getenv("LAN_HOST")
    if env_host:
        return env_host
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class CastService:
    def __init__(self):
        self.devices: Dict[str, CastDevice] = {}
        self.last_scan_time = 0.0
        self._scan_lock = asyncio.Lock()
        self.lan_host = _detect_lan_host()
        self.lan_port = int(os.getenv("PORT", "4533"))
        self._cast_clients: Dict[str, Any] = {}
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.on_track_ended_callback: Optional[Any] = None

    def _determine_has_screen(self, name: str, model_name: str) -> bool:
        combined = f"{name} {model_name}".lower()
        return any(k in combined for k in SCREEN_KEYWORDS)

    async def scan_devices(self, force: bool = False) -> List[Dict[str, Any]]:
        """
        Scans local subnet for Google Cast devices via HTTP Eureka endpoint (port 8008).
        Results are cached for 45s for instant snappy UI rendering.
        """
        try:
            self.loop = asyncio.get_running_loop()
        except Exception:
            pass

        now = time.time()
        if not force and (now - self.last_scan_time) < 45.0 and self.devices:
            return [d.to_dict() for d in self.devices.values()]

        async with self._scan_lock:
            if not force and (now - self.last_scan_time) < 45.0 and self.devices:
                return [d.to_dict() for d in self.devices.values()]

            limits = httpx.Limits(max_connections=120, max_keepalive_connections=20)
            async with httpx.AsyncClient(limits=limits, timeout=1.2) as client:
                priority_ips_env = os.getenv("CAST_PRIORITY_IPS", "")
                priority_ips = [ip.strip() for ip in priority_ips_env.split(",") if ip.strip()]

                parts = self.lan_host.split(".")
                if len(parts) == 4 and parts[0] != "127":
                    subnet_prefix = ".".join(parts[:3])
                    candidate_ips = [
                        f"{subnet_prefix}.{i}" for i in range(1, 255) if f"{subnet_prefix}.{i}" not in priority_ips
                    ]
                else:
                    candidate_ips = []

                all_ips = priority_ips + candidate_ips

                tasks = [self._probe_candidate(ip, client) for ip in all_ips]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for r in results:
                    if isinstance(r, CastDevice):
                        self.devices[r.id] = r

            self.last_scan_time = time.time()
            return [d.to_dict() for d in self.devices.values()]

    async def _probe_candidate(self, ip: str, client: httpx.AsyncClient) -> Optional[CastDevice]:
        """Probes port 8008 eureka_info for Google Cast device metadata."""
        url = f"http://{ip}:8008/setup/eureka_info?params=name,device_info"
        try:
            res = await client.get(url, headers={"User-Agent": "AudioHub-Scanner/1.0"})
            if res.status_code == 200:
                data = res.json()
                name = data.get("name") or data.get("device_info", {}).get("name")
                if not name:
                    return None
                model = data.get("device_info", {}).get("model_name") or "Google Cast Device"
                has_screen = self._determine_has_screen(name, model)
                dev_id = f"cast_{ip.replace('.', '_')}"
                return CastDevice(
                    device_id=dev_id,
                    name=name,
                    ip=ip,
                    port=8009,
                    model_name=model,
                    has_screen=has_screen,
                )
        except Exception:
            pass
        return None

    def _sync_get_chromecast(self, dev: CastDevice) -> Any:
        """Internal synchronous helper to instantiate and connect to a Chromecast device."""
        if not PYCHROMECAST_AVAILABLE:
            raise RuntimeError("pychromecast is not installed")

        client = self._cast_clients.get(dev.id)
        if client and client.socket_client and client.socket_client.is_connected:
            return client

        host_tuple = (dev.ip, dev.port, uuid.uuid4(), dev.model_name, dev.name)
        cast = pychromecast.get_chromecast_from_host(host_tuple, tries=2, timeout=3.5)
        cast.wait(timeout=3.5)
        
        # Attach MediaStatusListener to detect when a song finishes
        listener = CastMediaListener(self, dev.id)
        cast.media_controller.register_status_listener(listener)

        self._cast_clients[dev.id] = cast
        return cast

    async def get_cast_client(self, dev: CastDevice) -> Any:
        return await asyncio.to_thread(self._sync_get_chromecast, dev)

    async def play_track(
        self,
        device_id: str,
        track_id: str,
        title: str,
        artist: str,
        album: Optional[str] = None,
        cover_url: Optional[str] = None,
        position_seconds: int = 0,
    ) -> bool:
        """Streams audio to Google Cast device using native CastV2 protocol."""
        try:
            self.loop = asyncio.get_running_loop()
        except Exception:
            pass

        dev = self.devices.get(device_id)
        if not dev:
            await self.scan_devices()
            dev = self.devices.get(device_id)
            if not dev:
                logger.error(f"Google Cast device not found: {device_id}")
                return False

        def _do_play():
            cast = self._sync_get_chromecast(dev)
            stream_url = f"http://{self.lan_host}:{self.lan_port}/api/v1/stream/{track_id}"
            
            # Format high-res album cover URL
            full_cover = cover_url
            if full_cover and full_cover.startswith("/"):
                full_cover = f"http://{self.lan_host}:{self.lan_port}{full_cover}"

            metadata = {
                "metadataType": 3,  # MusicTrackMediaMetadata
                "title": title or "Unknown Track",
                "artist": artist or "Unknown Artist",
                "albumName": album or "AudioHub",
            }
            if full_cover:
                metadata["images"] = [{"url": full_cover}]

            mc = cast.media_controller
            mc.play_media(
                url=stream_url,
                content_type="audio/mp4",
                title=title or "AudioHub Track",
                thumb=full_cover,
                current_time=float(position_seconds) if position_seconds else 0.0,
                autoplay=True,
                stream_type="BUFFERED",
                metadata=metadata,
            )
            mc.block_until_active(timeout=4.0)
            return True

        try:
            ok = await asyncio.to_thread(_do_play)
            if ok:
                dev.is_playing = True
                dev.current_track = {
                    "id": track_id,
                    "title": title,
                    "artist": artist,
                    "album": album,
                    "cover_url": cover_url,
                }
                dev.position_seconds = position_seconds
                dev.last_seen = time.time()
                return True
        except Exception as e:
            logger.error(f"Error streaming to Google Cast device {dev.name}: {e}")
            # Reset client socket on failure
            self._cast_clients.pop(dev.id, None)

        return False

    async def pause(self, device_id: str) -> bool:
        dev = self.devices.get(device_id)
        if not dev:
            return False

        def _do_pause():
            cast = self._sync_get_chromecast(dev)
            cast.media_controller.pause()
            return True

        try:
            await asyncio.to_thread(_do_pause)
            dev.is_playing = False
            return True
        except Exception as e:
            logger.error(f"Cast pause error: {e}")
            return False

    async def resume(self, device_id: str) -> bool:
        dev = self.devices.get(device_id)
        if not dev:
            return False

        def _do_play():
            cast = self._sync_get_chromecast(dev)
            cast.media_controller.play()
            return True

        try:
            await asyncio.to_thread(_do_play)
            dev.is_playing = True
            return True
        except Exception as e:
            logger.error(f"Cast resume error: {e}")
            return False

    async def stop(self, device_id: str) -> bool:
        dev = self.devices.get(device_id)
        if not dev:
            return False

        def _do_stop():
            cast = self._sync_get_chromecast(dev)
            cast.media_controller.stop()
            return True

        try:
            await asyncio.to_thread(_do_stop)
            dev.is_playing = False
            dev.current_track = None
            return True
        except Exception as e:
            logger.error(f"Cast stop error: {e}")
            return False

    async def seek(self, device_id: str, position_seconds: float) -> bool:
        dev = self.devices.get(device_id)
        if not dev:
            return False

        def _do_seek():
            cast = self._sync_get_chromecast(dev)
            cast.media_controller.seek(position_seconds)
            return True

        try:
            await asyncio.to_thread(_do_seek)
            dev.position_seconds = position_seconds
            return True
        except Exception as e:
            logger.error(f"Cast seek error: {e}")
            return False

    async def set_volume(self, device_id: str, volume: float) -> bool:
        dev = self.devices.get(device_id)
        if not dev:
            return False

        def _do_volume():
            cast = self._sync_get_chromecast(dev)
            vol_clamp = max(0.0, min(1.0, float(volume)))
            cast.set_volume(vol_clamp)
            return True

        try:
            await asyncio.to_thread(_do_volume)
            dev.volume = volume
            return True
        except Exception as e:
            logger.error(f"Cast set_volume error: {e}")
            return False

    async def launch_custom_view(self, device_id: str) -> bool:
        """
        Launches the full AudioHub TV Leanback Player on Google Cast smart displays & TVs.
        Uses DashCast web receiver to render the live synced player, lyrics, and vinyl animations.
        """
        dev = self.devices.get(device_id)
        if not dev:
            await self.scan_devices()
            dev = self.devices.get(device_id)
            if not dev:
                logger.error(f"Cast device not found: {device_id}")
                return False

        def _do_launch():
            cast = self._sync_get_chromecast(dev)
            dashcast = DashCastController()
            cast.register_handler(dashcast)
            tv_url = f"http://{self.lan_host}:{self.lan_port}/?tab=tv"
            dashcast.load_url(tv_url, force=True)
            return True

        try:
            ok = await asyncio.to_thread(_do_launch)
            if ok:
                dev.is_playing = True
                dev.last_seen = time.time()
                return True
        except Exception as e:
            logger.error(f"Error launching TV view on Google Cast device {dev.name}: {e}")

        return False


cast_service = CastService()
