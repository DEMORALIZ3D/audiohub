import pytest


def test_login_valid_and_invalid(client, create_user):
    """
    Tests POST /api/v1/auth/login with:
    - Valid credentials by username (returns 200 + token)
    - Valid credentials by email (returns 200 + token)
    - Wrong password (returns 401)
    - Non-existent user (returns 401)
    - Deactivated user account (returns 403)
    """
    # 1. Create active test user
    user = create_user(
        username="audiophile",
        password="ValidPassword123",
        email="audiophile@homelab.internal",
        display_name="Sonic Master"
    )

    # 2. Login with valid username
    res_user = client.post("/api/v1/auth/login", json={
        "username": "audiophile",
        "password": "ValidPassword123"
    })
    assert res_user.status_code == 200
    data_user = res_user.json()
    assert data_user["id"] == user.id
    assert data_user["username"] == "audiophile"
    assert data_user["email"] == "audiophile@homelab.internal"
    assert "token" in data_user
    assert data_user["token"] == user.id

    # 3. Login with valid email
    res_email = client.post("/api/v1/auth/login", json={
        "username": "audiophile@homelab.internal",
        "password": "ValidPassword123"
    })
    assert res_email.status_code == 200
    data_email = res_email.json()
    assert data_email["token"] == user.id

    # 4. Login with incorrect password -> 401
    res_wrong_pw = client.post("/api/v1/auth/login", json={
        "username": "audiophile",
        "password": "WrongPassword999"
    })
    assert res_wrong_pw.status_code == 401
    assert "invalid" in res_wrong_pw.json()["detail"].lower()

    # 5. Login with non-existent user -> 401
    res_unknown = client.post("/api/v1/auth/login", json={
        "username": "non_existent_user",
        "password": "ValidPassword123"
    })
    assert res_unknown.status_code == 401

    # 6. Deactivated user account -> 403
    deactivated_user = create_user(
        username="banneduser",
        password="BannedPassword123",
        is_active=False
    )
    res_deactivated = client.post("/api/v1/auth/login", json={
        "username": "banneduser",
        "password": "BannedPassword123"
    })
    assert res_deactivated.status_code == 403
    assert "deactivated" in res_deactivated.json()["detail"].lower()


def test_get_me_authenticated_vs_anonymous(client, create_user):
    """
    Tests GET /api/v1/auth/me:
    - With valid Bearer token (returns 200 + profile details)
    - With valid X-User-Id header (returns 200)
    - Unauthenticated without headers (returns 401)
    - With unknown/invalid token (returns 401)
    """
    user = create_user(
        username="streamer",
        password="StreamPassword123",
        role="user",
        display_name="DJ Streamer"
    )

    # 1. Authenticated via Bearer token
    res_bearer = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {user.id}"}
    )
    assert res_bearer.status_code == 200
    data = res_bearer.json()
    assert data["id"] == user.id
    assert data["username"] == "streamer"
    assert data["display_name"] == "DJ Streamer"
    assert data["role"] == "user"
    assert data["is_active"] is True

    # 2. Authenticated via X-User-Id header
    res_header = client.get(
        "/api/v1/auth/me",
        headers={"X-User-Id": user.id}
    )
    assert res_header.status_code == 200
    assert res_header.json()["id"] == user.id

    # 3. Anonymous / Unauthenticated
    res_anon = client.get("/api/v1/auth/me")
    assert res_anon.status_code == 401
    assert "authentication required" in res_anon.json()["detail"].lower()

    # 4. Invalid or expired token
    res_invalid = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer deadbeef-0000-0000-0000-000000000000"}
    )
    assert res_invalid.status_code == 401
    assert "expired or invalid" in res_invalid.json()["detail"].lower()


def test_playback_state_persistence(client, auth_user):
    """
    Tests saving current track, position_seconds, queue, and shuffle state via
    POST /api/v1/auth/playback-state and restoring it via GET /api/v1/auth/playback-state
    (simulating accidental app close or mobile data drop recovery).
    """
    user, headers = auth_user

    # 1. Initially, no playback state exists
    initial_res = client.get("/api/v1/auth/playback-state", headers=headers)
    assert initial_res.status_code == 200
    assert initial_res.json()["state"] is None

    # 2. Save complete playback state snapshot (simulating player state before disconnect)
    state_payload = {
        "current_track": {
            "id": "yt_dQw4w9WgXcQ",
            "title": "Never Gonna Give You Up",
            "artist": "Rick Astley",
            "album": "Whenever You Need Somebody",
            "duration_seconds": 213,
            "cover_url": "https://example.com/rick.jpg"
        },
        "position_seconds": 142.5,
        "current_time": 142.5,
        "duration": 213.0,
        "queue": [
            {
                "id": "yt_dQw4w9WgXcQ",
                "title": "Never Gonna Give You Up",
                "artist": "Rick Astley"
            },
            {
                "id": "yt_L_jWHffIx5E",
                "title": "Smells Like Teen Spirit",
                "artist": "Nirvana"
            }
        ],
        "queue_index": 0,
        "shuffle": True,
        "is_playing": True
    }

    save_res = client.post("/api/v1/auth/playback-state", json=state_payload, headers=headers)
    assert save_res.status_code == 200
    save_data = save_res.json()
    assert save_data["success"] is True
    assert "updated_at" in save_data

    # 3. Restore state via GET /api/v1/auth/playback-state
    restore_res = client.get("/api/v1/auth/playback-state", headers=headers)
    assert restore_res.status_code == 200
    state = restore_res.json()["state"]
    assert state is not None

    # Verify track identity, seek offset, queue, and shuffle flags are accurately restored
    assert state["current_track"]["id"] == "yt_dQw4w9WgXcQ"
    assert state["current_track"]["title"] == "Never Gonna Give You Up"
    assert state["current_track"]["artist"] == "Rick Astley"
    assert state["position_seconds"] == 142.5
    assert state["current_time"] == 142.5
    assert state["duration"] == 213.0
    assert state["queue_index"] == 0
    assert len(state["queue"]) == 2
    assert state["queue"][1]["title"] == "Smells Like Teen Spirit"
    assert state["shuffle"] is True
    assert state["is_playing"] is True

    # 4. Verify PUT method also functions seamlessly
    state_payload["position_seconds"] = 180.0
    state_payload["current_time"] = 180.0
    put_res = client.put("/api/v1/auth/playback-state", json=state_payload, headers=headers)
    assert put_res.status_code == 200
    assert put_res.json()["success"] is True

    updated_state = client.get("/api/v1/auth/playback-state", headers=headers).json()["state"]
    assert updated_state["position_seconds"] == 180.0
