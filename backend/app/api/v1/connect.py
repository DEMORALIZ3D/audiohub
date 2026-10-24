import time
import json
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from ...database import SessionLocal
from ...models import User

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory device registry:
# { user_id: { device_id: { "ws": WebSocket, "info": dict, "state": dict, "last_seen": float } } }
_connected_devices: Dict[str, Dict[str, Dict[str, Any]]] = {}
_room_subscribers: Dict[str, Dict[str, Dict[str, Any]]] = {}

async def broadcast_device_list(user_id: str):
    """Broadcasts current active devices to all connected sockets of this user."""
    if user_id not in _connected_devices:
        return

    devices = []
    now = time.time()
    for dev_id, dev_data in _connected_devices[user_id].items():
        info = dev_data.get("info", {})
        state = dev_data.get("state", {})
        devices.append({
            "id": dev_id,
            "name": info.get("name", "AudioHub Device"),
            "device_type": info.get("device_type", "desktop"),
            "is_active": state.get("is_playing", False),
            "is_current_device": False,
            "volume": state.get("volume", 0.8),
            "current_track": state.get("current_track"),
            "is_playing": state.get("is_playing", False),
            "position_seconds": state.get("position_seconds", 0),
            "last_seen": dev_data.get("last_seen", now),
        })

    payload = {
        "type": "device_list",
        "devices": devices,
    }

    dead_devices = []
    for dev_id, dev_data in list(_connected_devices[user_id].items()):
        ws = dev_data.get("ws")
        if ws:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception as e:
                logger.warning(f"Error sending to device {dev_id}: {e}")
                dead_devices.append(dev_id)

    for dev_id in dead_devices:
        if dev_id in _connected_devices[user_id]:
            del _connected_devices[user_id][dev_id]

async def notify_user_connect(user_id: str, message_type: str, data: dict):
    """Sends a targeted real-time message to all connected client devices of this user."""
    if user_id not in _connected_devices:
        return
    payload = {"type": message_type, **data}
    dead_devices = []
    for dev_id, dev_data in list(_connected_devices[user_id].items()):
        ws = dev_data.get("ws")
        if ws:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead_devices.append(dev_id)
    for dev_id in dead_devices:
        if dev_id in _connected_devices[user_id]:
            del _connected_devices[user_id][dev_id]

@router.websocket("/ws")
async def connect_websocket(websocket: WebSocket, user_id: Optional[str] = Query(None)):
    """
    WebSocket endpoint for AudioHub Connect multi-device coordination and remote control.
    """
    await websocket.accept()

    # Authenticate user
    current_user_id = user_id
    if not current_user_id:
        # Fallback to super_admin or first active user in DB
        db = SessionLocal()
        try:
            admin = db.query(User).filter(User.role == "super_admin").first()
            if not admin:
                admin = db.query(User).first()
            current_user_id = admin.id if admin else "anonymous"
        finally:
            db.close()

    if current_user_id not in _connected_devices:
        _connected_devices[current_user_id] = {}

    assigned_device_id: Optional[str] = None
    subscribed_rooms: set = set()

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                msg = json.loads(raw_data)
            except Exception:
                continue

            msg_type = msg.get("type")

            if msg_type == "register":
                assigned_device_id = msg.get("device_id")
                device_name = msg.get("name", "AudioHub Client")
                device_type = msg.get("device_type", "desktop")

                if assigned_device_id:
                    _connected_devices[current_user_id][assigned_device_id] = {
                        "ws": websocket,
                        "info": {
                            "name": device_name,
                            "device_type": device_type,
                        },
                        "state": msg.get("state", {}),
                        "last_seen": time.time(),
                    }
                    await broadcast_device_list(current_user_id)

            elif msg_type in ["room_subscribe", "join_room"]:
                rcode = (msg.get("room_code") or "").upper().strip()
                if rcode and assigned_device_id:
                    if rcode not in _room_subscribers:
                        _room_subscribers[rcode] = {}
                    _room_subscribers[rcode][assigned_device_id] = {
                        "ws": websocket,
                        "user_id": current_user_id,
                        "last_seen": time.time(),
                    }
                    subscribed_rooms.add(rcode)

            elif msg_type in ["room_unsubscribe", "leave_room"]:
                rcode = (msg.get("room_code") or "").upper().strip()
                if rcode and rcode in _room_subscribers and assigned_device_id:
                    _room_subscribers[rcode].pop(assigned_device_id, None)
                    subscribed_rooms.discard(rcode)

            elif msg_type == "state":
                if assigned_device_id and assigned_device_id in _connected_devices[current_user_id]:
                    _connected_devices[current_user_id][assigned_device_id]["state"] = msg.get("state", {})
                    _connected_devices[current_user_id][assigned_device_id]["last_seen"] = time.time()
                    await broadcast_device_list(current_user_id)

            elif msg_type == "command":
                target_id = msg.get("target_id")
                action = msg.get("action")
                data = msg.get("data", {})
                if target_id and target_id in _connected_devices[current_user_id]:
                    target_ws = _connected_devices[current_user_id][target_id].get("ws")
                    if target_ws:
                        await target_ws.send_text(json.dumps({
                            "type": "command",
                            "from_device_id": assigned_device_id,
                            "action": action,
                            "data": data,
                        }))

            elif msg_type == "transfer":
                target_id = msg.get("target_id")
                playback = msg.get("playback", {})
                if target_id and target_id in _connected_devices[current_user_id]:
                    target_ws = _connected_devices[current_user_id][target_id].get("ws")
                    if target_ws:
                        await target_ws.send_text(json.dumps({
                            "type": "transfer",
                            "from_device_id": assigned_device_id,
                            "playback": playback,
                        }))

            elif msg_type == "time_ping":
                client_t0 = msg.get("client_t0", 0)
                await websocket.send_text(json.dumps({
                    "type": "time_pong",
                    "client_t0": client_t0,
                    "server_time": time.time(),
                }))

            elif msg_type == "party_broadcast":
                action = msg.get("action", "play")
                scheduled_start = msg.get("scheduled_start", time.time() + 1.0)
                track = msg.get("track")
                position = msg.get("position", 0.0)
                is_playing = msg.get("is_playing", True)
                room_code = (msg.get("room_code") or "").upper().strip()

                sync_payload = {
                    "type": "party_sync",
                    "from_device_id": assigned_device_id,
                    "action": action,
                    "scheduled_start": scheduled_start,
                    "track": track,
                    "position": position,
                    "is_playing": is_playing,
                    "server_time": time.time(),
                    "room_code": room_code or None,
                }
                sync_json = json.dumps(sync_payload)
                dispatched_ids = {assigned_device_id}

                # 1. Broadcast to all devices in the collaborative room (even across different user accounts!)
                if room_code and room_code in _room_subscribers:
                    for r_dev_id, r_dev_data in list(_room_subscribers[room_code].items()):
                        if r_dev_id not in dispatched_ids and r_dev_data.get("ws"):
                            try:
                                await r_dev_data["ws"].send_text(sync_json)
                                dispatched_ids.add(r_dev_id)
                            except Exception:
                                pass

                # 2. Broadcast to all devices under current user account
                for dev_id, dev_data in _connected_devices.get(current_user_id, {}).items():
                    if dev_id not in dispatched_ids and dev_data.get("ws"):
                        try:
                            await dev_data["ws"].send_text(sync_json)
                            dispatched_ids.add(dev_id)
                        except Exception as e:
                            logger.warning(f"Error broadcasting party sync to {dev_id}: {e}")

            elif msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"Connect WebSocket exception: {e}")
    finally:
        for rcode in list(subscribed_rooms):
            if rcode in _room_subscribers and assigned_device_id:
                _room_subscribers[rcode].pop(assigned_device_id, None)

        if current_user_id in _connected_devices and assigned_device_id:
            if assigned_device_id in _connected_devices[current_user_id]:
                del _connected_devices[current_user_id][assigned_device_id]
                await broadcast_device_list(current_user_id)


from pydantic import BaseModel

class RemoteCommandRequest(BaseModel):
    target_id: str
    action: str
    data: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None

class DeviceStateRequest(BaseModel):
    device_id: str
    name: str
    device_type: str = "desktop"
    state: Dict[str, Any]
    user_id: Optional[str] = None


@router.get("/devices")
async def get_online_devices(user_id: Optional[str] = Query(None)):
    """REST endpoint returning online devices for current user."""
    target_user = user_id or "anonymous"
    devices = []
    now = time.time()
    if target_user in _connected_devices:
        # Purge stale devices inactive for > 60 seconds
        for dev_id, dev_data in list(_connected_devices[target_user].items()):
            if now - dev_data.get("last_seen", now) > 60:
                del _connected_devices[target_user][dev_id]
                continue

            info = dev_data.get("info", {})
            state = dev_data.get("state", {})
            devices.append({
                "id": dev_id,
                "name": info.get("name", "AudioHub Device"),
                "device_type": info.get("device_type", "desktop"),
                "is_active": state.get("is_playing", False),
                "is_current_device": False,
                "volume": state.get("volume", 0.8),
                "current_track": state.get("current_track"),
                "is_playing": state.get("is_playing", False),
                "position_seconds": state.get("position_seconds", 0),
                "last_seen": dev_data.get("last_seen", now),
            })

    # Include discovered Smart TVs & DLNA speakers on home network
    try:
        from ...services.dlna_service import dlna_service
        dlna_devs = await dlna_service.scan_devices()
        devices.extend(dlna_devs)
    except Exception as e:
        logger.debug(f"DLNA device scan error: {e}")

    # Include discovered Google Cast devices (Nest Audio, Nest Hub, Chromecast)
    try:
        from ...services.cast_service import cast_service
        cast_devs = await cast_service.scan_devices()
        devices.extend(cast_devs)
    except Exception as e:
        logger.debug(f"Google Cast scan error: {e}")

    return {"devices": devices}


@router.post("/scan")
async def scan_network_devices():
    """Forces an on-demand scan for Smart TVs, DLNA speakers, and Google Cast devices on the home network."""
    try:
        from ...services.dlna_service import dlna_service
        from ...services.cast_service import cast_service
        import asyncio

        dlna_task = dlna_service.scan_devices(force=True)
        cast_task = cast_service.scan_devices(force=True)
        dlna_devs, cast_devs = await asyncio.gather(dlna_task, cast_task, return_exceptions=True)

        devices = []
        if isinstance(dlna_devs, list):
            devices.extend(dlna_devs)
        if isinstance(cast_devs, list):
            devices.extend(cast_devs)
        return {"status": "ok", "devices": devices}
    except Exception as e:
        logger.error(f"Error scanning network devices: {e}")
        return {"status": "error", "devices": []}


@router.post("/state")
async def update_device_state(payload: DeviceStateRequest):
    """REST endpoint for devices to announce or update their active playback state."""
    target_user = payload.user_id or "anonymous"
    if target_user not in _connected_devices:
        _connected_devices[target_user] = {}

    if payload.device_id not in _connected_devices[target_user]:
        _connected_devices[target_user][payload.device_id] = {
            "ws": None,
            "info": {
                "name": payload.name,
                "device_type": payload.device_type,
            },
            "state": payload.state,
            "last_seen": time.time(),
        }
    else:
        _connected_devices[target_user][payload.device_id]["state"] = payload.state
        _connected_devices[target_user][payload.device_id]["info"]["name"] = payload.name
        _connected_devices[target_user][payload.device_id]["info"]["device_type"] = payload.device_type
        _connected_devices[target_user][payload.device_id]["last_seen"] = time.time()

    await broadcast_device_list(target_user)
    return {"status": "ok"}


@router.post("/command")
async def send_command(payload: RemoteCommandRequest):
    """REST endpoint to send remote control commands to a target playing device."""
    target_user = payload.user_id or "anonymous"

    # Route to DLNA device (Samsung TV, Soundbar, Smart Displays)
    if payload.target_id.startswith("dlna_"):
        try:
            from ...services.dlna_service import dlna_service
            action = payload.action
            data = payload.data or {}
            success = False

            if action == "play_track":
                track = data.get("track") or {}
                tid = track.get("id") or data.get("track_id")
                if tid:
                    success = await dlna_service.play_track(
                        device_id=payload.target_id,
                        track_id=tid,
                        title=track.get("title", "Music"),
                        artist=track.get("artist", "AudioHub"),
                        album=track.get("album"),
                        cover_url=track.get("cover_url"),
                        position_seconds=int(data.get("position", 0))
                    )
            elif action == "pause":
                success = await dlna_service.pause(payload.target_id)
            elif action in ["play", "resume"]:
                success = await dlna_service.resume(payload.target_id)
            elif action == "toggle_play":
                dev = dlna_service.devices.get(payload.target_id)
                if dev and dev.is_playing:
                    success = await dlna_service.pause(payload.target_id)
                else:
                    success = await dlna_service.resume(payload.target_id)
            elif action == "stop":
                success = await dlna_service.stop(payload.target_id)
            elif action == "set_volume":
                vol = data.get("volume", 0.5)
                success = await dlna_service.set_volume(payload.target_id, int(vol * 100))

            await broadcast_device_list(target_user)
            return {"status": "ok" if success else "failed", "action": action, "is_dlna": True}
        except Exception as e:
            logger.error(f"DLNA remote command error: {e}")
            return {"status": "error", "detail": str(e)}

    # Route to Google Cast device (Nest Audio, Nest Hub, Chromecast)
    elif payload.target_id.startswith("cast_"):
        try:
            from ...services.cast_service import cast_service
            action = payload.action
            data = payload.data or {}
            success = False

            if action == "play_track":
                track = data.get("track") or {}
                tid = track.get("id") or data.get("track_id")
                if tid:
                    success = await cast_service.play_track(
                        device_id=payload.target_id,
                        track_id=tid,
                        title=track.get("title", "Music"),
                        artist=track.get("artist", "AudioHub"),
                        album=track.get("album"),
                        cover_url=track.get("cover_url"),
                        position_seconds=int(data.get("position", 0))
                    )
            elif action == "launch_tv":
                success = await cast_service.launch_custom_view(payload.target_id)
            elif action == "pause":
                success = await cast_service.pause(payload.target_id)
            elif action in ["play", "resume"]:
                success = await cast_service.resume(payload.target_id)
            elif action == "toggle_play":
                dev = cast_service.devices.get(payload.target_id)
                if dev and dev.is_playing:
                    success = await cast_service.pause(payload.target_id)
                else:
                    success = await cast_service.resume(payload.target_id)
            elif action == "stop":
                success = await cast_service.stop(payload.target_id)
            elif action == "seek":
                pos = data.get("position", 0)
                success = await cast_service.seek(payload.target_id, float(pos))
            elif action == "set_volume":
                vol = data.get("volume", 0.8)
                success = await cast_service.set_volume(payload.target_id, float(vol))

            await broadcast_device_list(target_user)
            return {"status": "ok" if success else "failed", "action": action, "is_cast": True}
        except Exception as e:
            logger.error(f"Cast remote command error: {e}")
            return {"status": "error", "detail": str(e)}

    if target_user in _connected_devices and payload.target_id in _connected_devices[target_user]:
        dev = _connected_devices[target_user][payload.target_id]
        state = dev.setdefault("state", {})
        action = payload.action
        data = payload.data or {}

        # Update in-memory state on server
        if action == "toggle_play":
            state["is_playing"] = not state.get("is_playing", False)
        elif action == "play":
            state["is_playing"] = True
        elif action == "pause":
            state["is_playing"] = False
        elif action == "seek" and "position" in data:
            state["position_seconds"] = data["position"]
        elif action == "set_volume" and "volume" in data:
            state["volume"] = data["volume"]
        elif action == "play_track" and "track" in data:
            state["current_track"] = data["track"]
            state["is_playing"] = True
            state["position_seconds"] = 0

        dev["last_seen"] = time.time()

        ws = dev.get("ws")
        if ws:
            try:
                await ws.send_text(json.dumps({
                    "type": "command",
                    "action": action,
                    "data": data,
                }))
            except Exception as e:
                logger.warning(f"Error sending command via ws: {e}")

        await broadcast_device_list(target_user)
        return {"status": "ok", "action": action}

    return {"status": "target_offline"}


@router.get("/time")
async def get_server_time():
    """Ultra-lightweight endpoint for NTP clock sync (returns timestamp in seconds with fractional microseconds)."""
    return {"server_time": time.time()}


class PartyBroadcastRequest(BaseModel):
    user_id: Optional[str] = None
    room_code: Optional[str] = None
    from_device_id: Optional[str] = None
    action: str = "play"  # "play", "pause", "seek", "track"
    scheduled_start: Optional[float] = None
    track: Optional[Dict[str, Any]] = None
    position: Optional[float] = 0.0
    is_playing: Optional[bool] = True


@router.post("/party_broadcast")
async def broadcast_party_sync(payload: PartyBroadcastRequest):
    """REST endpoint to broadcast synchronized party audio state to all user devices and room subscribers."""
    target_user = payload.user_id or "anonymous"
    now = time.time()
    scheduled_start = payload.scheduled_start or (now + 1.0)
    rcode = (payload.room_code or "").upper().strip()

    sync_payload = {
        "type": "party_sync",
        "from_device_id": payload.from_device_id,
        "action": payload.action,
        "scheduled_start": scheduled_start,
        "track": payload.track,
        "position": payload.position,
        "is_playing": payload.is_playing,
        "server_time": now,
        "room_code": rcode or None,
    }
    sync_json = json.dumps(sync_payload)
    dispatched_ids = set()
    if payload.from_device_id:
        dispatched_ids.add(payload.from_device_id)

    # 1. Room-level broadcast (cross-account / family participants)
    if rcode and rcode in _room_subscribers:
        for r_dev_id, r_dev_data in list(_room_subscribers[rcode].items()):
            if r_dev_id not in dispatched_ids and r_dev_data.get("ws"):
                try:
                    await r_dev_data["ws"].send_text(sync_json)
                    dispatched_ids.add(r_dev_id)
                except Exception:
                    pass

    # 2. User-level broadcast
    if target_user in _connected_devices:
        for dev_id, dev_data in _connected_devices[target_user].items():
            if dev_id not in dispatched_ids and dev_data.get("ws"):
                try:
                    await dev_data["ws"].send_text(sync_json)
                    dispatched_ids.add(dev_id)
                except Exception as e:
                    logger.warning(f"Error sending party sync to {dev_id}: {e}")

    return {
        "status": "broadcast_sent",
        "server_time": now,
        "scheduled_start": scheduled_start,
        "dispatched_count": len(dispatched_ids),
    }


async def broadcast_remote_track_ended(target_id: str):
    """
    Broadcasts remote_track_ended event to all connected clients when a Cast/DLNA device finishes playback.
    Allows phones and control clients to immediately advance queue and play the next song.
    """
    logger.info(f"Broadcasting remote_track_ended for device: {target_id}")
    payload = {
        "type": "remote_track_ended",
        "target_id": target_id,
    }
    msg_str = json.dumps(payload)
    for u_id, devices in list(_connected_devices.items()):
        dead_devices = []
        for dev_id, dev_data in list(devices.items()):
            ws = dev_data.get("ws")
            if ws:
                try:
                    await ws.send_text(msg_str)
                except Exception:
                    dead_devices.append(dev_id)
        for dev_id in dead_devices:
            if dev_id in _connected_devices.get(u_id, {}):
                del _connected_devices[u_id][dev_id]

# Wire cast_service callback
try:
    from ...services.cast_service import cast_service
    cast_service.on_track_ended_callback = broadcast_remote_track_ended
except Exception as e:
    logger.warning(f"Error wiring cast_service.on_track_ended_callback: {e}")


