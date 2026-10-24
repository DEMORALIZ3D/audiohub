import pytest
from app.models import ListeningHistory, UserActivityLog, Track


def test_stream_rejects_anonymous_or_attributes_user(client, auth_user, sample_track, sample_audio_file, db):
    """
    Verifies /api/v1/stream/{track_id}:
    1. Authenticated via Bearer token: serves local audio with HTTP 200 and records
       user attribution in ListeningHistory and UserActivityLog.
    2. Range request: serves partial content with HTTP 206 and byte-range slicing.
    3. Anonymous request: serves content with HTTP 200 and logs stream under 'Anonymous'.
    """
    user, headers = auth_user
    expected_bytes = sample_audio_file.read_bytes()
    total_size = len(expected_bytes)

    # 1. Stream with Bearer token (Full Content HTTP 200)
    full_res = client.get(f"/api/v1/stream/{sample_track.id}", headers=headers)
    assert full_res.status_code == 200
    assert full_res.headers.get("accept-ranges") == "bytes"
    assert len(full_res.content) == total_size
    assert full_res.content == expected_bytes

    # Verify user attribution in database
    history_entry = (
        db.query(ListeningHistory)
        .filter(ListeningHistory.user_id == user.id, ListeningHistory.track_id == sample_track.id)
        .first()
    )
    assert history_entry is not None

    user_stream_log = (
        db.query(UserActivityLog)
        .filter(UserActivityLog.user_id == user.id, UserActivityLog.action == "stream")
        .first()
    )
    assert user_stream_log is not None
    assert user.username in user_stream_log.username or user.display_name in user_stream_log.username

    # Verify play count incremented
    db.refresh(sample_track)
    assert sample_track.play_count >= 1

    # 2. Stream with Range header and query param ?user_id= (HTTP 206 Partial Content)
    range_headers = {"Range": "bytes=0-127"}
    range_res = client.get(
        f"/api/v1/stream/{sample_track.id}?user_id={user.id}",
        headers=range_headers
    )
    assert range_res.status_code == 206
    assert range_res.headers.get("content-range") == f"bytes 0-127/{total_size}"
    assert range_res.headers.get("content-length") == "128"
    assert len(range_res.content) == 128
    assert range_res.content == expected_bytes[0:128]

    # 3. Anonymous stream request (without user authentication)
    # Clear session to ensure fresh DB query
    db.expire_all()
    anon_res = client.get(f"/api/v1/stream/{sample_track.id}")
    assert anon_res.status_code == 200
    assert len(anon_res.content) == total_size

    # Verify anonymous stream logged with 'Anonymous' username and no user_id
    anon_log = (
        db.query(UserActivityLog)
        .filter(UserActivityLog.action == "stream", UserActivityLog.username == "Anonymous")
        .first()
    )
    assert anon_log is not None
    assert anon_log.user_id is None


def test_subsonic_ping(client):
    """
    Verifies Subsonic API endpoint (/rest/ping.view and /rest/ping) compatibility
    for third-party clients like Symfonium, DSub, and Audinaut.
    """
    # 1. Ping with .view extension and standard Subsonic query params
    res_view = client.get(
        "/rest/ping.view",
        params={
            "u": "admin",
            "p": "enc:61646d696e",
            "v": "1.16.1",
            "c": "Symfonium",
            "f": "json"
        }
    )
    assert res_view.status_code == 200
    data_view = res_view.json()
    assert "subsonic-response" in data_view
    resp_body = data_view["subsonic-response"]
    assert resp_body["status"] == "ok"
    assert resp_body["version"] == "1.16.1"
    assert resp_body["openSubsonic"] is True
    assert resp_body["type"] == "audiohub"

    # 2. Ping without .view extension
    res_clean = client.get("/rest/ping")
    assert res_clean.status_code == 200
    assert res_clean.json()["subsonic-response"]["status"] == "ok"

    # 3. Subsonic getLicense compatibility
    res_license = client.get(
        "/rest/getLicense.view",
        params={"u": "admin", "p": "test", "v": "1.16.1", "c": "DSub", "f": "json"}
    )
    assert res_license.status_code == 200
    lic_body = res_license.json()["subsonic-response"]
    assert lic_body["status"] == "ok"
    assert lic_body["license"]["valid"] is True
