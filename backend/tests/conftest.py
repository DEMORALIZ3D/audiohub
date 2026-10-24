import os
import sys
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend package is in python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import app.database as app_db
from app.main import app
from app.database import Base, get_db
from app.models import User, SystemSetting, Track, LikedSong, Playlist, PlaylistTrack, ListeningHistory, UserActivityLog
from app.api.v1.auth import hash_password

# Use in-memory SQLite database with StaticPool for 100% isolated and blazing fast execution
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db():
    """
    Sets up a clean in-memory database schema before each test and drops it after.
    Also overrides app.database.SessionLocal and app.database.engine to ensure
    no background tasks or services touch backend/data/audiohub.db.
    """
    orig_session_local = app_db.SessionLocal
    orig_engine = app_db.engine

    app_db.SessionLocal = TestingSessionLocal
    app_db.engine = test_engine

    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    yield

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)

    app_db.SessionLocal = orig_session_local
    app_db.engine = orig_engine


@pytest.fixture
def db():
    """Direct database session fixture for test setup and assertions."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    """FastAPI TestClient fixture configured with isolated in-memory test database."""
    return TestClient(app)


@pytest.fixture
def create_user(db):
    """Factory fixture to create test users."""
    def _create_user(
        username: str = "testuser",
        password: str = "Password123",
        role: str = "user",
        is_admin: bool = False,
        display_name: str = None,
        email: str = None,
        is_active: bool = True
    ) -> User:
        user = User(
            id=str(uuid.uuid4()),
            username=username.lower().strip(),
            email=email.lower().strip() if email else f"{username.lower().strip()}@audiohub.local",
            password_hash=hash_password(password),
            display_name=display_name or username,
            role=role,
            is_admin=is_admin or (role in ["admin", "super_admin"]),
            is_active=is_active
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return _create_user


@pytest.fixture
def auth_user(create_user):
    """Fixture providing a standard authenticated user and auth headers."""
    user = create_user(username="standarduser", password="UserPass123", role="user")
    headers = {"Authorization": f"Bearer {user.id}"}
    return user, headers


@pytest.fixture
def admin_user(create_user):
    """Fixture providing a Super Admin authenticated user and auth headers."""
    admin = create_user(username="adminowner", password="AdminPass123", role="super_admin", is_admin=True)
    headers = {"Authorization": f"Bearer {admin.id}"}
    return admin, headers


@pytest.fixture
def sample_audio_file(tmp_path):
    """Fixture creating a temporary dummy audio file on disk for streaming tests."""
    audio_file = tmp_path / "test_sample.mp3"
    # Generate 512 bytes of test audio payload
    dummy_data = b"\xFF\xFB\x90\x00" + b"\x00" * 508
    audio_file.write_bytes(dummy_data)
    return audio_file


@pytest.fixture
def sample_track(db, sample_audio_file):
    """Fixture creating a cached local Track record linked to sample_audio_file."""
    file_bytes = sample_audio_file.read_bytes()
    track = Track(
        id="test_local_track_001",
        title="Midnight Resonance",
        artist="AudioHub Ensemble",
        album="Homelab Sessions Vol. 1",
        duration_seconds=180,
        source_type="local",
        source_id="local_001",
        local_path=str(sample_audio_file),
        is_cached=True,
        is_uploaded=True,
        file_size_bytes=len(file_bytes),
        play_count=0
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    return track
