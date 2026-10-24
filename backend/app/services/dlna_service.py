import asyncio
import html
import logging
import os
import re
import socket
import time
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Any
import httpx

logger = logging.getLogger(__name__)

class DlnaDevice:
    def __init__(
        self,
        device_id: str,
        name: str,
        ip: str,
        control_url: str,
        rendering_control_url: Optional[str] = None,
        model_name: Optional[str] = None,
        device_type: str = "tv"
    ):
        self.id = device_id
        self.name = name
        self.ip = ip
        self.control_url = control_url
        self.rendering_control_url = rendering_control_url
        self.model_name = model_name
        self.device_type = device_type
        self.is_playing = False
        self.current_track: Optional[Dict[str, Any]] = None
        self.position_seconds = 0
        self.volume = 0.5
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
            "is_dlna": True,
            "ip": self.ip,
            "model": self.model_name
        }


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


class DlnaService:
    def __init__(self):
        self.devices: Dict[str, DlnaDevice] = {}
        self.last_scan_time = 0.0
        self._scan_lock = asyncio.Lock()
        self.lan_host = _detect_lan_host()
        self.lan_port = int(os.getenv("PORT", "4533"))

    async def scan_devices(self, force: bool = False) -> List[Dict[str, Any]]:
        """
        Asynchronously scan the home subnet for DLNA / UPnP MediaRenderers.
        Caches results for 45 seconds to keep device picker lightning fast.
        """
        now = time.time()
        if not force and (now - self.last_scan_time) < 45.0 and self.devices:
            return [d.to_dict() for d in self.devices.values()]

        async with self._scan_lock:
            # Recheck inside lock
            if not force and (now - self.last_scan_time) < 45.0 and self.devices:
                return [d.to_dict() for d in self.devices.values()]

            limits = httpx.Limits(max_connections=150, max_keepalive_connections=30)
            async with httpx.AsyncClient(limits=limits, timeout=1.2) as client:
                # Quick probes on known device IPs first for instant discovery
                priority_ips_env = os.getenv("DLNA_PRIORITY_IPS") or os.getenv("CAST_PRIORITY_IPS", "")
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
                    if isinstance(r, DlnaDevice):
                        self.devices[r.id] = r

            self.last_scan_time = time.time()
            return [d.to_dict() for d in self.devices.values()]

    async def _probe_candidate(self, ip: str, client: httpx.AsyncClient) -> Optional[DlnaDevice]:
        """Probes a specific LAN IP for DLNA MediaRenderer description XML."""
        endpoints = [
            (f"http://{ip}:9197/dmr", 9197),
            (f"http://{ip}:7676/rcr/", 7676),
            (f"http://{ip}:3600/ssdp/device-desc.xml", 3600)
        ]

        for url, port in endpoints:
            try:
                resp = await client.get(url)
                if resp.status_code == 200 and ("MediaRenderer" in resp.text or "AVTransport" in resp.text):
                    root = ET.fromstring(resp.text)
                    fn = root.find(".//{urn:schemas-upnp-org:device-1-0}friendlyName")
                    mn = root.find(".//{urn:schemas-upnp-org:device-1-0}modelName")
                    ctrl = root.find(".//{urn:schemas-upnp-org:device-1-0}service[{urn:schemas-upnp-org:device-1-0}serviceType='urn:schemas-upnp-org:service:AVTransport:1']/{urn:schemas-upnp-org:device-1-0}controlURL")
                    rend = root.find(".//{urn:schemas-upnp-org:device-1-0}service[{urn:schemas-upnp-org:device-1-0}serviceType='urn:schemas-upnp-org:service:RenderingControl:1']/{urn:schemas-upnp-org:device-1-0}controlURL")

                    if ctrl is not None and ctrl.text:
                        name = fn.text.replace("&quot;", '"') if fn is not None and fn.text else f"Speaker ({ip})"
                        model = mn.text if mn is not None else "DLNA DMR"
                        
                        ctrl_path = ctrl.text
                        if not ctrl_path.startswith("http"):
                            ctrl_url = f"http://{ip}:{port}{ctrl_path if ctrl_path.startswith('/') else '/' + ctrl_path}"
                        else:
                            ctrl_url = ctrl_path

                        rend_url = None
                        if rend is not None and rend.text:
                            rend_path = rend.text
                            if not rend_path.startswith("http"):
                                rend_url = f"http://{ip}:{port}{rend_path if rend_path.startswith('/') else '/' + rend_path}"
                            else:
                                rend_url = rend_path

                        clean_name = name.lower()
                        is_tv = "tv" in clean_name or "oled" in clean_name or "display" in clean_name or "screen" in clean_name
                        dev_type = "tv" if is_tv else "speaker"

                        dev_id = f"dlna_{ip.replace('.', '_')}"
                        return DlnaDevice(
                            device_id=dev_id,
                            name=name,
                            ip=ip,
                            control_url=ctrl_url,
                            rendering_control_url=rend_url,
                            model_name=model,
                            device_type=dev_type
                        )
            except Exception:
                continue

        return None

    async def play_track(
        self,
        device_id: str,
        track_id: str,
        title: str,
        artist: str,
        album: Optional[str] = None,
        cover_url: Optional[str] = None,
        position_seconds: int = 0
    ) -> bool:
        """Sends SetAVTransportURI and Play commands to the target DLNA device."""
        dev = self.devices.get(device_id)
        if not dev:
            # Try to discover if missing
            await self.scan_devices()
            dev = self.devices.get(device_id)
            if not dev:
                logger.error(f"DLNA device not found: {device_id}")
                return False

        import urllib.parse
        q_params = []
        if title:
            q_params.append(f"title={urllib.parse.quote(title)}")
        if artist:
            q_params.append(f"artist={urllib.parse.quote(artist)}")
        if album:
            q_params.append(f"album={urllib.parse.quote(album)}")
        if cover_url:
            q_params.append(f"cover_url={urllib.parse.quote(cover_url)}")
        qs = f"?{'&'.join(q_params)}" if q_params else ""
        stream_url = f"http://{self.lan_host}:{self.lan_port}/api/v1/stream/{track_id}{qs}"

        clean_title = html.escape(title or "Unknown Track")
        clean_artist = html.escape(artist or "Unknown Artist")
        clean_album = html.escape(album or "AudioHub")

        didl = (
            '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/" '
            'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" '
            'xmlns:dlna="urn:schemas-dlna-org:metadata-1-0/">'
            '<item id="0" parentID="-1" restricted="1">'
            f'<dc:title>{clean_title}</dc:title>'
            f'<dc:creator>{clean_artist}</dc:creator>'
            f'<upnp:artist>{clean_artist}</upnp:artist>'
            f'<upnp:album>{clean_album}</upnp:album>'
            '<upnp:class>object.item.audioItem.musicTrack</upnp:class>'
            f'<res protocolInfo="http-get:*:audio/mp4:DLNA.ORG_PN=AAC_ISO;DLNA.ORG_OP=01;DLNA.ORG_FLAGS=01500000000000000000000000000000">{html.escape(stream_url)}</res>'
            f'<res protocolInfo="http-get:*:audio/mpeg:DLNA.ORG_PN=MP3;DLNA.ORG_OP=01;DLNA.ORG_FLAGS=01500000000000000000000000000000">{html.escape(stream_url)}</res>'
            f'<res protocolInfo="http-get:*:*:*">{html.escape(stream_url)}</res>'
            '</item>'
            '</DIDL-Lite>'
        )

        set_uri_body = f"""<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <CurrentURI>{html.escape(stream_url)}</CurrentURI>
      <CurrentURIMetaData>{html.escape(didl)}</CurrentURIMetaData>
    </u:SetAVTransportURI>
  </s:Body>
</s:Envelope>"""

        play_body = """<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <Speed>1</Speed>
    </u:Play>
  </s:Body>
</s:Envelope>"""

        async with httpx.AsyncClient(timeout=4.0) as client:
            try:
                # 1. SetAVTransportURI
                r1 = await client.post(
                    dev.control_url,
                    headers={
                        "Content-Type": 'text/xml; charset="utf-8"',
                        "SOAPACTION": '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"'
                    },
                    content=set_uri_body.encode('utf-8')
                )
                if r1.status_code != 200:
                    logger.warning(f"DLNA SetAVTransportURI failed for {dev.name}: {r1.status_code} {r1.text}")
                    return False

                # 2. Play
                r2 = await client.post(
                    dev.control_url,
                    headers={
                        "Content-Type": 'text/xml; charset="utf-8"',
                        "SOAPACTION": '"urn:schemas-upnp-org:service:AVTransport:1#Play"'
                    },
                    content=play_body.encode('utf-8')
                )
                if r2.status_code == 200:
                    dev.is_playing = True
                    dev.current_track = {
                        "id": track_id,
                        "title": title,
                        "artist": artist,
                        "album": album,
                        "cover_url": cover_url
                    }
                    dev.position_seconds = 0
                    dev.last_seen = time.time()
                    return True
                else:
                    logger.warning(f"DLNA Play failed for {dev.name}: {r2.status_code} {r2.text}")
                    return False
            except Exception as e:
                logger.error(f"DLNA play_track error on {dev.name}: {e}")
                return False

    async def pause(self, device_id: str) -> bool:
        dev = self.devices.get(device_id)
        if not dev:
            return False
        body = """<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Pause xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:Pause>
  </s:Body>
</s:Envelope>"""
        async with httpx.AsyncClient(timeout=3.0) as client:
            try:
                r = await client.post(
                    dev.control_url,
                    headers={
                        "Content-Type": 'text/xml; charset="utf-8"',
                        "SOAPACTION": '"urn:schemas-upnp-org:service:AVTransport:1#Pause"'
                    },
                    content=body.encode('utf-8')
                )
                if r.status_code == 200:
                    dev.is_playing = False
                    return True
            except Exception as e:
                logger.error(f"DLNA pause error: {e}")
        return False

    async def resume(self, device_id: str) -> bool:
        dev = self.devices.get(device_id)
        if not dev:
            return False
        body = """<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <Speed>1</Speed>
    </u:Play>
  </s:Body>
</s:Envelope>"""
        async with httpx.AsyncClient(timeout=3.0) as client:
            try:
                r = await client.post(
                    dev.control_url,
                    headers={
                        "Content-Type": 'text/xml; charset="utf-8"',
                        "SOAPACTION": '"urn:schemas-upnp-org:service:AVTransport:1#Play"'
                    },
                    content=body.encode('utf-8')
                )
                if r.status_code == 200:
                    dev.is_playing = True
                    return True
            except Exception as e:
                logger.error(f"DLNA resume error: {e}")
        return False

    async def stop(self, device_id: str) -> bool:
        dev = self.devices.get(device_id)
        if not dev:
            return False
        body = """<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:Stop>
  </s:Body>
</s:Envelope>"""
        async with httpx.AsyncClient(timeout=3.0) as client:
            try:
                r = await client.post(
                    dev.control_url,
                    headers={
                        "Content-Type": 'text/xml; charset="utf-8"',
                        "SOAPACTION": '"urn:schemas-upnp-org:service:AVTransport:1#Stop"'
                    },
                    content=body.encode('utf-8')
                )
                if r.status_code == 200:
                    dev.is_playing = False
                    dev.current_track = None
                    return True
            except Exception as e:
                logger.error(f"DLNA stop error: {e}")
        return False

    async def set_volume(self, device_id: str, volume_percent: int) -> bool:
        dev = self.devices.get(device_id)
        if not dev or not dev.rendering_control_url:
            return False
        clamped = max(0, min(100, int(volume_percent)))
        body = f"""<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
      <InstanceID>0</InstanceID>
      <Channel>Master</Channel>
      <DesiredVolume>{clamped}</DesiredVolume>
    </u:SetVolume>
  </s:Body>
</s:Envelope>"""
        async with httpx.AsyncClient(timeout=3.0) as client:
            try:
                r = await client.post(
                    dev.rendering_control_url,
                    headers={
                        "Content-Type": 'text/xml; charset="utf-8"',
                        "SOAPACTION": '"urn:schemas-upnp-org:service:RenderingControl:1#SetVolume"'
                    },
                    content=body.encode('utf-8')
                )
                if r.status_code == 200:
                    dev.volume = clamped / 100.0
                    return True
            except Exception as e:
                logger.error(f"DLNA set_volume error: {e}")
        return False


dlna_service = DlnaService()
