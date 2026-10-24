from fastapi import APIRouter, Depends, HTTPException, Header, Request, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import hashlib
import uuid
import time
import secrets
import json

from app.config import settings
from app.services.powqr import create_powqr_code
from ...database import get_db
from ...models import User, UserActivityLog, utc_now

router = APIRouter()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

class UserRegister(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None
    email: Optional[str] = None

class UserLogin(BaseModel):
    username: str  # Can be username or email
    password: str

class UserProfileOut(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: str = "user"
    is_admin: bool = False
    is_under_13: bool = False
    is_active: bool = True
    token: Optional[str] = None

def ensure_super_admin(db: Session) -> Optional[User]:
    return db.query(User).filter(User.role == "super_admin").first()

def get_current_user(
    request: Request,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Authenticate user via X-User-Id header, Authorization: Bearer, or query param.
    Strict authentication: requires a valid, active user profile session.
    """
    query_id = request.query_params.get("user_id") or request.query_params.get("token")
    effective_id = x_user_id or query_id
    if not effective_id and authorization:
        if authorization.startswith("Bearer "):
            effective_id = authorization[7:].strip()
        else:
            effective_id = authorization.strip()

    if effective_id:
        user = db.query(User).filter(User.id == effective_id, User.is_active == True).first()
        if user:
            return user
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please sign in.")

    raise HTTPException(status_code=401, detail="Authentication required. Please sign in.")


@router.get("/me", response_model=UserProfileOut)
def get_me(user: User = Depends(get_current_user)):
    return UserProfileOut(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name or user.username,
        role=user.role or ("super_admin" if user.is_admin else "user"),
        is_admin=user.is_admin or (user.role in ["admin", "super_admin"]),
        is_under_13=bool(user.is_under_13),
        is_active=bool(user.is_active),
        token=user.id
    )

@router.get("/profiles", response_model=List[UserProfileOut])
def list_profiles(db: Session = Depends(get_db)):
    """
    List all active family profiles.
    """
    users = db.query(User).filter(User.is_active == True).all()

    return [
        UserProfileOut(
            id=u.id,
            username=u.username,
            email=u.email,
            display_name=u.display_name or u.username,
            role=u.role or ("super_admin" if u.is_admin else "user"),
            is_admin=u.is_admin or (u.role in ["admin", "super_admin"]),
            is_under_13=bool(u.is_under_13),
            is_active=bool(u.is_active)
        )
        for u in users
    ]

@router.post("/register")
def register_profile(data: UserRegister):
    """
    Public registration is strictly disabled.
    """
    raise HTTPException(
        status_code=403,
        detail="Public sign-ups are disabled on this server. Please contact an administrator to be invited."
    )

@router.post("/login", response_model=UserProfileOut)
def login_profile(
    data: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    identifier = data.username.strip().lower()
    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()

    if not user or user.password_hash != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid username/email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account has been deactivated. Please contact an administrator.")

    # Record login timestamp & activity log
    user.last_login_at = utc_now()
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")[:250]
    
    db.add(UserActivityLog(
        user_id=user.id,
        username=user.username,
        action="login",
        details="User logged in",
        ip_address=client_ip,
        user_agent=user_agent
    ))
    db.commit()

    return UserProfileOut(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name or user.username,
        role=user.role or ("super_admin" if user.is_admin else "user"),
        is_admin=user.is_admin or (user.role in ["admin", "super_admin"]),
        is_under_13=bool(user.is_under_13),
        is_active=bool(user.is_active),
        token=user.id
    )

# =========================================================================
# MAGIC QR LOGIN & PAIRING SYSTEM
# =========================================================================

class MagicRequestResponse(BaseModel):
    session_id: str
    pin: str
    auth_url: str
    pair_url: Optional[str] = ""
    qr_svg_url: str
    local_proxy_url: str
    expires_in: int
    app_name: str
    logo_url: str

class MagicApproveRequest(BaseModel):
    session_id: str
    pin: str

class MagicPinClaimRequest(BaseModel):
    pin: str

class MagicTransferRequest(BaseModel):
    device_name: Optional[str] = "Companion Device"

class MagicTransferClaimRequest(BaseModel):
    token: str
    pin: str

_magic_sessions: Dict[str, Dict[str, Any]] = {}
_transfer_sessions: Dict[str, Dict[str, Any]] = {}

def cleanup_expired_magic_sessions():
    now = time.time()
    expired = [k for k, v in _magic_sessions.items() if v.get("expires_at", 0) < now]
    for k in expired:
        _magic_sessions.pop(k, None)
    expired_t = [k for k, v in _transfer_sessions.items() if v.get("expires_at", 0) < now]
    for k in expired_t:
        _transfer_sessions.pop(k, None)

@router.post("/magic/request", response_model=MagicRequestResponse)
async def request_magic_session(request: Request):
    """
    Step 1: Logged-out device (e.g. TV / desktop) requests a magic login session.
    Generates a secure session + random 4-digit PIN + high-contrast square scannable QR code.
    """
    cleanup_expired_magic_sessions()
    session_id = f"mls_{uuid.uuid4().hex[:12]}"
    pin = f"{secrets.randbelow(9000) + 1000}"
    expires_in = 300
    expires_at = time.time() + expires_in

    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "localhost:4533"
    proto = request.headers.get("x-forwarded-proto") or "https"
    base_url = f"{proto}://{host}"
    pair_url = f"{base_url}/#/pair?pin={pin}&magic_auth={session_id}"
    auth_url = f"{base_url}/login?magic_auth={session_id}&pin={pin}"

    qr_res = await create_powqr_code(
        auth_url,
        title=f"{settings.BRAND_NAME} Magic Login",
        dot_shape="square",
        eye_shape="square",
        animation="none"
    )

    _magic_sessions[session_id] = {
        "session_id": session_id,
        "pin": pin,
        "status": "pending",
        "user_id": None,
        "user_profile": None,
        "created_at": time.time(),
        "expires_at": expires_at,
        "client_ip": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown")[:200]
    }

    return MagicRequestResponse(
        session_id=session_id,
        pin=pin,
        auth_url=auth_url,
        pair_url=pair_url,
        qr_svg_url=qr_res.get("qr_svg_url", ""),
        local_proxy_url=qr_res.get("local_proxy_url", ""),
        expires_in=expires_in,
        app_name=settings.BRAND_NAME,
        logo_url=settings.BRAND_LOGO_URL
    )

@router.get("/magic/status")
async def check_magic_status(session_id: str, db: Session = Depends(get_db)):
    """
    Step 2: Logged-out device polls this to know when the phone has approved the login.
    """
    cleanup_expired_magic_sessions()
    session = _magic_sessions.get(session_id)
    if not session:
        return {"status": "expired"}

    if session["expires_at"] < time.time():
        _magic_sessions.pop(session_id, None)
        return {"status": "expired"}

    if session["status"] == "approved":
        user_id = session.get("user_id")
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if not user:
            return {"status": "error", "detail": "User account deactivated"}

        # Consume the session so it cannot be reused
        _magic_sessions.pop(session_id, None)

        user_out = UserProfileOut(
            id=user.id,
            username=user.username,
            email=user.email,
            display_name=user.display_name or user.username,
            role=user.role or ("super_admin" if user.is_admin else "user"),
            is_admin=user.is_admin or (user.role in ["admin", "super_admin"]),
            is_under_13=bool(user.is_under_13),
            is_active=bool(user.is_active)
        )
        return {
            "status": "approved",
            "token": user.id,
            "user": user_out.model_dump()
        }

    return {
        "status": "pending",
        "expires_in": max(0, int(session["expires_at"] - time.time()))
    }

@router.post("/magic/approve")
async def approve_magic_session(
    data: MagicApproveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 3: Logged-in device (e.g. phone) approves the login request after confirming the PIN.
    """
    cleanup_expired_magic_sessions()
    session = _magic_sessions.get(data.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Login request expired or invalid")

    if session["expires_at"] < time.time():
        _magic_sessions.pop(data.session_id, None)
        raise HTTPException(status_code=400, detail="Login session has expired")

    if session["pin"] != data.pin.strip():
        raise HTTPException(status_code=400, detail="Incorrect security PIN")

    session["status"] = "approved"
    session["user_id"] = current_user.id

    db.add(UserActivityLog(
        user_id=current_user.id,
        username=current_user.username,
        action="magic_login_approved",
        details=f"Approved Magic QR login for {session.get('user_agent', 'desktop device')}",
        ip_address=session.get("client_ip", "unknown")
    ))
    db.commit()

    return {"success": True, "message": "Login authorized successfully"}

@router.post("/magic/claim-by-pin")
async def claim_magic_by_pin(
    data: MagicPinClaimRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 3b: User enters the 4-digit PIN on phone/web to pair the TV.
    """
    cleanup_expired_magic_sessions()
    pin = data.pin.strip()
    if not pin or len(pin) < 4:
        raise HTTPException(status_code=400, detail="Please enter a valid 4-digit PIN")

    target_session = None
    target_id = None
    for s_id, s_data in _magic_sessions.items():
        if s_data.get("pin") == pin and s_data.get("status") == "pending":
            target_session = s_data
            target_id = s_id
            break

    if not target_session:
        raise HTTPException(status_code=404, detail="No pending TV login session found for this PIN. Check the TV screen.")

    target_session["status"] = "approved"
    target_session["user_id"] = current_user.id

    db.add(UserActivityLog(
        user_id=current_user.id,
        username=current_user.username,
        action="magic_pin_approved",
        details=f"Approved TV PIN pair ({pin}) for {target_session.get('user_agent', 'Smart TV')}",
        ip_address=target_session.get("client_ip", "unknown")
    ))
    db.commit()

    return {"success": True, "message": "Smart TV paired and signed in successfully!"}

@router.post("/magic/transfer-qr")
async def create_transfer_qr(
    data: MagicTransferRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Reverse Magic Flow: A logged-in device generates a temporary transfer QR code
    so you can pair another device (e.g. tablet or phone) by scanning the desktop screen.
    """
    cleanup_expired_magic_sessions()
    token = f"mlt_{uuid.uuid4().hex[:16]}"
    pin = f"{secrets.randbelow(9000) + 1000}"
    expires_in = 300
    expires_at = time.time() + expires_in

    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "localhost:4533"
    proto = request.headers.get("x-forwarded-proto") or "https"
    base_url = f"{proto}://{host}"
    claim_url = f"{base_url}/login?magic_claim={token}&pin={pin}"

    qr_res = await create_powqr_code(claim_url, title=f"Pair with {current_user.username}", animation="spin-eyes")

    _transfer_sessions[token] = {
        "token": token,
        "pin": pin,
        "user_id": current_user.id,
        "expires_at": expires_at,
        "device_name": data.device_name
    }

    return {
        "success": True,
        "token": token,
        "pin": pin,
        "claim_url": claim_url,
        "qr_svg_url": qr_res.get("qr_svg_url", ""),
        "local_proxy_url": qr_res.get("local_proxy_url", ""),
        "expires_in": expires_in,
        "app_name": settings.BRAND_NAME,
        "logo_url": settings.BRAND_LOGO_URL
    }

@router.post("/magic/claim-transfer")
async def claim_transfer_session(
    data: MagicTransferClaimRequest,
    db: Session = Depends(get_db)
):
    """
    Reverse Magic Flow (Claim): New device submits token + PIN from scanned QR code.
    """
    cleanup_expired_magic_sessions()
    transfer = _transfer_sessions.get(data.token)
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer link expired or invalid")

    if transfer["expires_at"] < time.time():
        _transfer_sessions.pop(data.token, None)
        raise HTTPException(status_code=400, detail="Transfer code expired")

    if transfer["pin"] != data.pin.strip():
        raise HTTPException(status_code=400, detail="Incorrect security PIN")

    user_id = transfer["user_id"]
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found or deactivated")

    _transfer_sessions.pop(data.token, None)

    user_out = UserProfileOut(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name or user.username,
        role=user.role or ("super_admin" if user.is_admin else "user"),
        is_admin=user.is_admin or (user.role in ["admin", "super_admin"]),
        is_under_13=bool(user.is_under_13),
        is_active=bool(user.is_active)
    )

    return {
        "success": True,
        "token": user.id,
        "user": user_out.model_dump()
    }

# =========================================================================
# WEB NFC INSTANT TAP-TO-INVITE & SIGNUP
# =========================================================================

_nfc_invites: Dict[str, Dict[str, Any]] = {}

def cleanup_expired_nfc_invites():
    now = time.time()
    expired = [k for k, v in _nfc_invites.items() if v.get("expires_at", 0) < now]
    for k in expired:
        _nfc_invites.pop(k, None)

class NfcSignupRequest(BaseModel):
    invite_token: str
    username: str
    password: str
    display_name: Optional[str] = None
    email: Optional[str] = None

@router.post("/nfc/create-invite")
async def create_nfc_invite(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Generate an NFC invite payload (token + URL + QR fallback) created by an authenticated Admin.
    """
    if current_user.role not in ["admin", "super_admin"] and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin permissions required to generate NFC invite")

    cleanup_expired_nfc_invites()
    token = f"nfc_{uuid.uuid4().hex[:16]}"
    expires_in = 86400  # 24 hours
    expires_at = time.time() + expires_in

    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "localhost:4533"
    proto = request.headers.get("x-forwarded-proto") or "https"
    base_url = f"{proto}://{host}"
    admin_name = current_user.display_name or current_user.username
    invite_url = f"{base_url}/login?mode=signup&invite={token}&invited_by={admin_name}"

    qr_res = await create_powqr_code(invite_url, title=f"{settings.BRAND_NAME} Invite by {admin_name}", animation="spin-eyes")

    _nfc_invites[token] = {
        "token": token,
        "admin_id": current_user.id,
        "admin_name": admin_name,
        "expires_at": expires_at
    }

    return {
        "success": True,
        "token": token,
        "invite_url": invite_url,
        "admin_name": admin_name,
        "qr_svg_url": qr_res.get("qr_svg_url", ""),
        "local_proxy_url": qr_res.get("local_proxy_url", ""),
        "expires_in": expires_in,
        "app_name": settings.BRAND_NAME
    }

@router.post("/nfc/signup", response_model=Dict[str, Any])
async def nfc_signup(
    data: NfcSignupRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Direct Guest Signup via NFC tap invite.
    """
    cleanup_expired_nfc_invites()
    invite = _nfc_invites.get(data.invite_token)
    if not invite:
        raise HTTPException(status_code=400, detail="Invitation link is invalid or has expired.")

    username = data.username.strip().lower()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")

    existing = db.query(User).filter(
        (User.username == username) | (User.email == username)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username is already taken")

    new_user = User(
        username=username,
        email=data.email.strip().lower() if data.email else None,
        display_name=data.display_name.strip() if data.display_name else username,
        password_hash=hash_password(data.password),
        role="user",
        is_admin=False,
        is_under_13=False,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")[:250]
    db.add(UserActivityLog(
        user_id=new_user.id,
        username=new_user.username,
        action="nfc_signup",
        details=f"Registered account via NFC invite from {invite['admin_name']}",
        ip_address=client_ip,
        user_agent=user_agent
    ))
    db.commit()

    user_out = UserProfileOut(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        display_name=new_user.display_name or new_user.username,
        role=new_user.role,
        is_admin=new_user.is_admin,
        is_under_13=bool(new_user.is_under_13),
        is_active=bool(new_user.is_active)
    )

    return {
        "success": True,
        "token": new_user.id,
        "user": user_out.model_dump()
    }


# =========================================================================
# CROSS-DEVICE & REBOOT PLAYBACK CONTINUITY
# =========================================================================

class PlaybackStatePayload(BaseModel):
    current_track: Optional[Dict[str, Any]] = None
    current_time: float = 0.0
    duration: float = 0.0
    playback_context: Optional[Dict[str, Any]] = None
    queue: Optional[List[Dict[str, Any]]] = None
    queue_index: int = -1
    is_playing: bool = False
    position_seconds: Optional[float] = None
    shuffle: Optional[bool] = None

    class Config:
        extra = "allow"

@router.get("/playback-state")
def get_playback_state(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get user's last saved playback session (track, seek position, queue, context).
    Used for instant cross-device continuity (PC to mobile, reboots, tab restores).
    If called without auth headers (e.g. from a Smart TV or Google Nest Hub via DashCast),
    it gracefully returns the active playback state of the primary user so displays can sync immediately.
    """
    effective_id = user_id or x_user_id
    if not effective_id and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            effective_id = parts[1]
        elif authorization:
            effective_id = authorization.strip()

    user = None
    if effective_id:
        user = db.query(User).filter(User.id == effective_id, User.is_active == True).first()

    if not user:
        # Fallback for TV and smart displays to primary user
        admin = db.query(User).filter(User.role == "super_admin").first()
        if admin and admin.last_playback_state:
            user = admin
        else:
            user_with_state = db.query(User).filter(User.last_playback_state.isnot(None)).first()
            user = user_with_state or admin or db.query(User).first()

    if not user or not user.last_playback_state:
        return {"state": None}
    try:
        data = json.loads(user.last_playback_state)
        return {"state": data}
    except Exception:
        return {"state": None}

@router.put("/playback-state")
@router.post("/playback-state")
def save_playback_state(
    payload: PlaybackStatePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Persist user's playback session state.
    """
    data = payload.model_dump()
    data["updated_at"] = time.time()
    user.last_playback_state = json.dumps(data)
    db.commit()
    return {"success": True, "updated_at": data["updated_at"]}

