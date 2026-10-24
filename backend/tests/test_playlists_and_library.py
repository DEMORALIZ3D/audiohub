import pytest
from app.models import Playlist, PlaylistTrack, Track, LikedSong


def test_create_and_fetch_playlist(client, auth_user, db):
    """
    Creates a personal playlist, adds tracks via POST /api/v1/playlists/{id}/tracks,
    and verifies the track list order and details via GET /api/v1/playlists/{id}.
    """
    user, headers = auth_user

    # 1. Create playlist
    create_res = client.post(
        "/api/v1/playlists",
        json={
            "name": "Synthwave Drive",
            "description": "Late night homelab coding beats"
        },
        headers=headers
    )
    assert create_res.status_code == 200
    playlist_data = create_res.json()
    playlist_id = playlist_data["id"]
    assert playlist_data["name"] == "Synthwave Drive"
    assert playlist_data["description"] == "Late night homelab coding beats"
    assert playlist_data["track_count"] == 0

    # 2. Add tracks to playlist
    tracks_to_add = [
        {
            "id": "yt_kavinsky_nightcall",
            "title": "Nightcall",
            "artist": "Kavinsky",
            "album": "OutRun",
            "duration_seconds": 259,
            "source_type": "youtube",
            "cover_url": "https://example.com/nightcall.jpg"
        },
        {
            "id": "yt_home_resonance",
            "title": "Resonance",
            "artist": "HOME",
            "album": "Odyssey",
            "duration_seconds": 212,
            "source_type": "youtube",
            "cover_url": "https://example.com/resonance.jpg"
        },
        {
            "id": "yt_gunship_technoir",
            "title": "Tech Noir",
            "artist": "GUNSHIP",
            "album": "GUNSHIP",
            "duration_seconds": 297,
            "source_type": "youtube",
            "cover_url": "https://example.com/technoir.jpg"
        }
    ]

    for idx, t_payload in enumerate(tracks_to_add):
        add_res = client.post(
            f"/api/v1/playlists/{playlist_id}/tracks",
            json=t_payload,
            headers=headers
        )
        assert add_res.status_code == 200
        assert add_res.json()["status"] == "added"
        assert add_res.json()["position"] == idx

    # 3. Fetch playlist details
    fetch_res = client.get(f"/api/v1/playlists/{playlist_id}", headers=headers)
    assert fetch_res.status_code == 200
    details = fetch_res.json()
    assert details["id"] == playlist_id
    assert details["name"] == "Synthwave Drive"
    assert len(details["tracks"]) == 3

    # Verify track ordering and attributes
    assert details["tracks"][0]["id"] == "yt_kavinsky_nightcall"
    assert details["tracks"][0]["position"] == 0
    assert details["tracks"][1]["id"] == "yt_home_resonance"
    assert details["tracks"][1]["position"] == 1
    assert details["tracks"][2]["id"] == "yt_gunship_technoir"
    assert details["tracks"][2]["position"] == 2

    # 4. Verify user playlists overview returns updated track count
    list_res = client.get("/api/v1/playlists", headers=headers)
    assert list_res.status_code == 200
    user_playlists = list_res.json()
    matching = next((p for p in user_playlists if p["id"] == playlist_id), None)
    assert matching is not None
    assert matching["track_count"] == 3


def test_playlist_track_reorder(client, auth_user, db):
    """
    Tests drag-and-drop track reordering endpoint ('PUT /api/v1/playlists/{id}/tracks/reorder')
    and verifies the new track sequence persists reliably in SQLite.
    """
    user, headers = auth_user

    # 1. Create playlist with 3 tracks
    playlist = Playlist(
        name="Focus Flow",
        description="Deep focus study beats",
        user_id=user.id
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    track_ids = ["focus_track_A", "focus_track_B", "focus_track_C"]
    for idx, tid in enumerate(track_ids):
        t = Track(
            id=tid,
            title=f"Track {tid[-1]}",
            artist="Ambient Flow",
            duration_seconds=180,
            source_type="local"
        )
        db.add(t)
        pt = PlaylistTrack(
            playlist_id=playlist.id,
            track_id=tid,
            position=idx
        )
        db.add(pt)
    db.commit()

    # 2. Reorder tracks using PUT endpoint (Reverse order: C, A, B)
    reordered_ids = ["focus_track_C", "focus_track_A", "focus_track_B"]
    put_res = client.put(
        f"/api/v1/playlists/{playlist.id}/tracks/reorder",
        json={"track_ids": reordered_ids},
        headers=headers
    )
    assert put_res.status_code == 200
    assert put_res.json()["status"] == "ok"
    assert put_res.json()["reordered_count"] == 3

    # 3. Verify SQLite persisted new positions directly
    entries = (
        db.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == playlist.id)
        .order_by(PlaylistTrack.position.asc())
        .all()
    )
    persisted_order = [e.track_id for e in entries]
    assert persisted_order == ["focus_track_C", "focus_track_A", "focus_track_B"]

    # 4. Verify API GET endpoint returns tracks in the newly reordered sequence
    get_res = client.get(f"/api/v1/playlists/{playlist.id}", headers=headers)
    assert get_res.status_code == 200
    tracks = get_res.json()["tracks"]
    api_order = [t["id"] for t in tracks]
    assert api_order == ["focus_track_C", "focus_track_A", "focus_track_B"]
    assert tracks[0]["position"] == 0
    assert tracks[1]["position"] == 1
    assert tracks[2]["position"] == 2

    # 5. Verify POST method also works for clients using POST
    post_reorder = ["focus_track_B", "focus_track_C", "focus_track_A"]
    post_res = client.post(
        f"/api/v1/playlists/{playlist.id}/tracks/reorder",
        json={"track_ids": post_reorder},
        headers=headers
    )
    assert post_res.status_code == 200

    entries_post = (
        db.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == playlist.id)
        .order_by(PlaylistTrack.position.asc())
        .all()
    )
    assert [e.track_id for e in entries_post] == post_reorder


def test_like_and_unlike_song(client, auth_user, db):
    """
    Tests liking a track (POST /api/v1/tracks/{track_id}/like) and fetching
    the user's liked songs collection (GET /api/v1/tracks/liked).
    """
    user, headers = auth_user

    # 1. Seed a track in the database
    track = Track(
        id="fav_track_99",
        title="Starlight Serenade",
        artist="Cosmic Strings",
        album="Galactic Overture",
        duration_seconds=240,
        source_type="local"
    )
    db.add(track)
    db.commit()

    # 2. Initially liked songs library is empty
    initial_res = client.get("/api/v1/tracks/liked", headers=headers)
    assert initial_res.status_code == 200
    assert len(initial_res.json()) == 0

    # 3. Like the song
    like_res = client.post(f"/api/v1/tracks/{track.id}/like", headers=headers)
    assert like_res.status_code == 200
    assert like_res.json()["is_liked"] is True
    assert like_res.json()["track_id"] == track.id

    # 4. Verify song is present in liked library
    fetch_liked = client.get("/api/v1/tracks/liked", headers=headers)
    assert fetch_liked.status_code == 200
    liked_list = fetch_liked.json()
    assert len(liked_list) == 1
    assert liked_list[0]["id"] == track.id
    assert liked_list[0]["title"] == "Starlight Serenade"
    assert liked_list[0]["artist"] == "Cosmic Strings"
    assert liked_list[0]["is_liked"] is True

    # 5. Toggle unlike the song
    unlike_res = client.post(f"/api/v1/tracks/{track.id}/like", headers=headers)
    assert unlike_res.status_code == 200
    assert unlike_res.json()["is_liked"] is False

    # 6. Verify liked library is now empty
    after_unlike = client.get("/api/v1/tracks/liked", headers=headers)
    assert after_unlike.status_code == 200
    assert len(after_unlike.json()) == 0
