import time
import uuid
import random
import string
import logging
from typing import Dict, Optional, Any, List
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...models import User
from ...database import get_db
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory collaborative rooms
# { room_code: RoomData }
_rooms: Dict[str, Dict[str, Any]] = {}

def generate_room_code() -> str:
    chars = string.ascii_uppercase + string.digits
    for _ in range(10):
        code = "".join(random.choices(chars, k=6))
        if code not in _rooms:
            return code
    return uuid.uuid4().hex[:6].upper()

def get_optional_user(
    request: Request,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    try:
        return get_current_user(request, x_user_id, authorization, db)
    except Exception:
        return None

class CreateRoomReq(BaseModel):
    name: Optional[str] = "Group Session"
    device_id: Optional[str] = None
    user_name: Optional[str] = None

class JoinRoomReq(BaseModel):
    name: Optional[str] = None
    device_id: Optional[str] = None

class SyncRoomReq(BaseModel):
    current_track: Optional[Dict[str, Any]] = None
    is_playing: Optional[bool] = None
    position_seconds: Optional[float] = None
    device_id: Optional[str] = None

class QueueTrackReq(BaseModel):
    track: Dict[str, Any]
    user_name: Optional[str] = None

@router.post("/create")
def create_room(
    data: CreateRoomReq,
    current_user: Optional[User] = Depends(get_optional_user)
):
    code = generate_room_code()
    dev_id = (data.device_id or "").strip()
    
    if current_user:
        user_id = current_user.id
        user_name = current_user.display_name or current_user.username
    else:
        user_id = dev_id or f"guest_{uuid.uuid4().hex[:6]}"
        user_name = (data.user_name or "Host").strip()

    room_name = data.name or f"{user_name}'s Room"
    participant_id = f"{user_id}_{dev_id}" if dev_id else user_id

    room = {
        "code": code,
        "name": room_name,
        "host_id": user_id,
        "host_device_id": dev_id,
        "host_name": user_name,
        "current_track": None,
        "is_playing": False,
        "position_seconds": 0.0,
        "queue": [],
        "participants": [
            {
                "id": user_id,
                "participant_id": participant_id,
                "device_id": dev_id,
                "name": user_name,
                "is_host": True
            }
        ],
        "created_at": time.time(),
        "updated_at": time.time()
    }
    _rooms[code] = room
    return room

@router.get("/{code}")
def get_room(code: str):
    code = code.upper()
    if code not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or session ended")
    return _rooms[code]

@router.post("/{code}/join")
def join_room(
    code: str,
    data: Optional[JoinRoomReq] = None,
    current_user: Optional[User] = Depends(get_optional_user)
):
    code = code.upper()
    if code not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found or session ended")
    
    room = _rooms[code]
    data_name = (data.name if data and data.name else "").strip()
    data_dev = (data.device_id if data and data.device_id else "").strip()

    if current_user:
        user_id = current_user.id
        user_name = data_name or current_user.display_name or current_user.username
    else:
        user_id = data_dev or f"guest_{uuid.uuid4().hex[:6]}"
        user_name = data_name or "Guest"

    participant_id = f"{user_id}_{data_dev}" if data_dev else user_id
    is_host = (user_id == room["host_id"] and (not data_dev or data_dev == room.get("host_device_id")))

    # Update or append participant
    existing = next((p for p in room["participants"] if p.get("participant_id") == participant_id or (data_dev and p.get("device_id") == data_dev)), None)
    if existing:
        if data_name:
            existing["name"] = data_name
        existing["device_id"] = data_dev
    else:
        room["participants"].append({
            "id": user_id,
            "participant_id": participant_id,
            "device_id": data_dev,
            "name": user_name,
            "is_host": is_host
        })

    room["updated_at"] = time.time()
    return room

@router.post("/{code}/sync")
def sync_room_state(
    code: str,
    data: SyncRoomReq,
    current_user: Optional[User] = Depends(get_optional_user)
):
    code = code.upper()
    if code not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = _rooms[code]
    user_id = current_user.id if current_user else None
    dev_id = (data.device_id or "").strip()

    is_host = (
        (user_id and user_id == room["host_id"]) or
        (dev_id and dev_id == room.get("host_device_id"))
    )

    if is_host:
        if data.current_track is not None:
            room["current_track"] = data.current_track
        if data.is_playing is not None:
            room["is_playing"] = data.is_playing
        if data.position_seconds is not None:
            room["position_seconds"] = data.position_seconds
        room["updated_at"] = time.time()

    return room

@router.post("/{code}/queue")
def add_to_room_queue(
    code: str,
    data: QueueTrackReq,
    current_user: Optional[User] = Depends(get_optional_user)
):
    code = code.upper()
    if code not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = _rooms[code]
    sender_name = data.user_name or (current_user.display_name if current_user else None) or (current_user.username if current_user else None) or "Guest"

    track_item = {
        **data.track,
        "added_by": sender_name,
        "added_by_id": current_user.id if current_user else None,
        "queued_at": time.time()
    }
    room["queue"].append(track_item)
    room["updated_at"] = time.time()
    return {"status": "queued", "queue": room["queue"]}

@router.post("/{code}/next")
def pop_room_queue(
    code: str,
    current_user: Optional[User] = Depends(get_optional_user)
):
    code = code.upper()
    if code not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = _rooms[code]
    next_track = None
    if room["queue"]:
        next_track = room["queue"].pop(0)
        room["current_track"] = next_track
        room["position_seconds"] = 0.0
        room["updated_at"] = time.time()

    return {"current_track": next_track, "queue": room["queue"]}

@router.delete("/{code}")
def leave_or_close_room(
    code: str,
    device_id: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_user)
):
    code = code.upper()
    if code not in _rooms:
        return {"status": "ok"}
    
    room = _rooms[code]
    user_id = current_user.id if current_user else None
    dev_id = (device_id or "").strip()

    is_host = (
        (user_id and user_id == room["host_id"]) or
        (dev_id and dev_id == room.get("host_device_id"))
    )

    if is_host:
        _rooms.pop(code, None)
        return {"status": "room_closed"}
    else:
        room["participants"] = [
            p for p in room["participants"]
            if (not user_id or p["id"] != user_id) and (not dev_id or p.get("device_id") != dev_id)
        ]
        room["updated_at"] = time.time()
        return {"status": "left"}
