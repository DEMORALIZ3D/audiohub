import pytest
from app.models import User, SystemSetting


def test_setup_status_when_empty(client):
    """Verifies setup_required: True and is_configured: False when 0 users exist."""
    res = client.get("/api/v1/setup/status")
    assert res.status_code == 200
    data = res.json()
    assert data["is_configured"] is False
    assert data["setup_required"] is True
    assert "app_name" in data


def test_setup_flow_success(client, db):
    """
    Verifies POST /api/v1/setup saves custom instance branding
    (app_name, tagline, logo_url, accent_color) and creates the Super Admin owner account.
    """
    payload = {
        "app_name": "MyAudioHub",
        "tagline": "Family Hi-Fi Homelab",
        "logo_url": "https://example.com/logo.png",
        "accent_color": "#1ed760",
        "username": "SuperAdmin",
        "email": "owner@audiohub.local",
        "display_name": "Alex",
        "password": "SuperSecretPassword123"
    }

    res = client.post("/api/v1/setup", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "completed"
    assert "user" in data
    assert data["user"]["username"] == "superadmin"
    assert data["user"]["email"] == "owner@audiohub.local"
    assert data["user"]["display_name"] == "Alex"
    assert data["user"]["role"] == "super_admin"
    assert data["user"]["is_admin"] is True
    assert data["user"]["is_active"] is True
    assert data["token"] == data["user"]["id"]

    # Verify status changed
    status_res = client.get("/api/v1/setup/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["is_configured"] is True
    assert status_data["setup_required"] is False
    assert status_data["app_name"] == "MyAudioHub"

    # Verify branding settings are properly persisted in DB
    settings_in_db = {s.key: s.value for s in db.query(SystemSetting).all()}
    assert settings_in_db.get("app_name") == "MyAudioHub"
    assert settings_in_db.get("tagline") == "Family Hi-Fi Homelab"
    assert settings_in_db.get("logo_url") == "https://example.com/logo.png"
    assert settings_in_db.get("accent_color") == "#1ed760"


def test_setup_forbidden_when_already_configured(client):
    """Verifies POST /api/v1/setup returns HTTP 403 once any user exists."""
    payload = {
        "app_name": "AudioHub",
        "username": "owner",
        "password": "Password123"
    }
    res = client.post("/api/v1/setup", json=payload)
    assert res.status_code == 201

    # Attempt second setup
    res2 = client.post("/api/v1/setup", json=payload)
    assert res2.status_code == 403
    assert "already completed" in res2.json()["detail"].lower()


def test_setup_validation(client):
    """Verifies short username and empty password rejection."""
    # Empty username
    res_empty = client.post("/api/v1/setup", json={"username": "  ", "password": "Password123"})
    assert res_empty.status_code == 400
    assert "username" in res_empty.json()["detail"].lower()

    # Short username (< 3 characters)
    res_short = client.post("/api/v1/setup", json={"username": "ab", "password": "Password123"})
    assert res_short.status_code == 400
    assert "3 characters" in res_short.json()["detail"].lower()

    # Empty password
    res_no_pass = client.post("/api/v1/setup", json={"username": "valid_user", "password": ""})
    assert res_no_pass.status_code == 400
    assert "password" in res_no_pass.json()["detail"].lower()
