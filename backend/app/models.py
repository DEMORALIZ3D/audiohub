import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from .database import Base

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(128), unique=True, index=True, nullable=True)
    password_hash = Column(String(256), nullable=False)
    display_name = Column(String(64), nullable=True)
    role = Column(String(32), default="user", nullable=False)  # "super_admin", "admin", "user"
    is_admin = Column(Boolean, default=False)
    is_under_13 = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    last_login_at = Column(DateTime, nullable=True)
    last_playback_state = Column(Text, nullable=True)  # JSON-serialized playback session state

    liked_songs = relationship("LikedSong", back_populates="user", cascade="all, delete-orphan")
    playlists = relationship("Playlist", back_populates="user", cascade="all, delete-orphan")
    history = relationship("ListeningHistory", back_populates="user", cascade="all, delete-orphan")


class Track(Base):
    __tablename__ = "tracks"

    id = Column(String(128), primary_key=True)  # e.g., yt_xxxxxx or custom hash
    title = Column(String(256), nullable=False, index=True)
    artist = Column(String(256), nullable=False, index=True)
    album = Column(String(256), nullable=True)
    duration_seconds = Column(Integer, default=0)
    cover_url = Column(String(512), nullable=True)
    source_type = Column(String(32), default="youtube", index=True)  # youtube, soulseek, local
    source_id = Column(String(128), nullable=True, index=True)       # youtube video id, etc.
    local_path = Column(String(512), nullable=True)      # Path if cached on disk
    is_cached = Column(Boolean, default=False)
    is_uploaded = Column(Boolean, default=False)
    uploader_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    is_private = Column(Boolean, default=False)
    file_size_bytes = Column(Integer, default=0)
    play_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)
    last_played_at = Column(DateTime, nullable=True)

    liked_by = relationship("LikedSong", back_populates="track", cascade="all, delete-orphan")
    playlist_entries = relationship("PlaylistTrack", back_populates="track", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_tracks_source_composite", "source_type", "source_id"),
        Index("idx_tracks_uploader_created", "uploader_id", "is_uploaded", "created_at"),
        Index("idx_tracks_play_count", "play_count"),
        Index("idx_tracks_cached_last_played", "is_cached", "last_played_at"),
    )


class LikedSong(Base):
    __tablename__ = "liked_songs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    track_id = Column(String(128), ForeignKey("tracks.id"), nullable=False, index=True)
    liked_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="liked_songs")
    track = relationship("Track", back_populates="liked_by")

    __table_args__ = (
        Index("idx_user_track_unique", "user_id", "track_id", unique=True),
        Index("idx_liked_songs_user_time", "user_id", "liked_at"),
        Index("idx_liked_songs_track", "track_id"),
    )

class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    description = Column(String(512), nullable=True)
    cover_url = Column(String(512), nullable=True)
    is_public = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)  # For algorithmic mixes
    source_type = Column(String(32), default="local")  # local, chart, deezer, youtube, spotify
    source_id = Column(String(128), nullable=True)     # e.g. 1111142221 or playlist ID
    auto_update = Column(Boolean, default=False)       # If True, dynamically syncs weekly
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="playlists")
    tracks = relationship("PlaylistTrack", back_populates="playlist", cascade="all, delete-orphan", order_by="PlaylistTrack.position")

    __table_args__ = (
        Index("idx_playlists_user_pub", "user_id", "is_public"),
        Index("idx_playlists_user_updated", "user_id", "is_system", "updated_at"),
    )

class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    playlist_id = Column(String(36), ForeignKey("playlists.id"), nullable=False, index=True)
    track_id = Column(String(128), ForeignKey("tracks.id"), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)
    added_at = Column(DateTime, default=utc_now)

    playlist = relationship("Playlist", back_populates="tracks")
    track = relationship("Track", back_populates="playlist_entries")

    __table_args__ = (
        Index("idx_playlist_tracks_pos", "playlist_id", "position"),
        Index("idx_playlist_tracks_track", "track_id"),
    )

class ListeningHistory(Base):
    __tablename__ = "listening_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    track_id = Column(String(128), ForeignKey("tracks.id"), nullable=False, index=True)
    played_at = Column(DateTime, default=utc_now, index=True)
    duration_listened_seconds = Column(Float, default=0.0)
    track_duration_seconds = Column(Float, default=0.0)
    completion_rate = Column(Float, default=0.0)
    completed = Column(Boolean, default=False)
    skipped = Column(Boolean, default=False)
    playback_context = Column(String(64), nullable=True)
    context_id = Column(String(128), nullable=True)
    hour_of_day = Column(Integer, nullable=True)
    day_of_week = Column(Integer, nullable=True)

    user = relationship("User", back_populates="history")
    track = relationship("Track")

    __table_args__ = (
        Index("idx_history_user_time", "user_id", "played_at"),
        Index("idx_history_user_track", "user_id", "track_id"),
        Index("idx_history_track_time", "track_id", "played_at"),
        Index("idx_history_user_completed", "user_id", "completed"),
        Index("idx_history_user_skipped", "user_id", "skipped"),
    )

class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(64), primary_key=True)
    value = Column(Text, nullable=False)
    description = Column(String(256), nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

class UserActivityLog(Base):
    __tablename__ = "user_activity_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    username = Column(String(64), nullable=True)
    action = Column(String(64), nullable=False, index=True)  # login, stream_start, like, playlist_create
    details = Column(Text, nullable=True)  # track title, artist, etc.
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=utc_now, index=True)

    __table_args__ = (
        Index("idx_user_activity_user_time", "user_id", "created_at"),
    )

class EngineDiagnosticLog(Base):
    __tablename__ = "engine_diagnostic_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime, default=utc_now, index=True)
    level = Column(String(16), default="INFO", index=True)  # INFO, WARNING, ERROR, BOT_DETECTED
    source = Column(String(32), default="yt-dlp", index=True)  # yt-dlp, ytmusicapi, deezer, stream
    message = Column(Text, nullable=False)
    details = Column(Text, nullable=True)
    is_resolved = Column(Boolean, default=False)

class MetadataCache(Base):
    __tablename__ = "metadata_cache"

    key = Column(String(256), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now)


class SavedAlbum(Base):
    __tablename__ = "saved_albums"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    album_id = Column(String(128), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    artist = Column(String(256), nullable=False)
    cover_url = Column(String(512), nullable=True)
    track_count = Column(Integer, default=0)
    saved_at = Column(DateTime, default=utc_now)

    user = relationship("User", backref="saved_albums")

    __table_args__ = (
        Index("idx_user_album_unique", "user_id", "album_id", unique=True),
        Index("idx_saved_albums_user_time", "user_id", "saved_at"),
    )


class FollowedArtist(Base):
    __tablename__ = "followed_artists"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    artist_id = Column(String(128), nullable=False, index=True)
    name = Column(String(256), nullable=False)
    picture_url = Column(String(512), nullable=True)
    fan_count = Column(Integer, default=0)
    followed_at = Column(DateTime, default=utc_now)

    user = relationship("User", backref="followed_artists")

    __table_args__ = (
        Index("idx_user_artist_unique", "user_id", "artist_id", unique=True),
        Index("idx_followed_artists_user_time", "user_id", "followed_at"),
    )



