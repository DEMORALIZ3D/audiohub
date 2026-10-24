from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

# SQLite connection args for multi-threaded FastAPI
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

from sqlalchemy import event

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,
    pool_pre_ping=True
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, _connection_record):
    if settings.DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA cache_size=-64000") # 64MB cache
        cursor.execute("PRAGMA mmap_size=268435456") # 256MB memory-mapped I/O
        cursor.execute("PRAGMA temp_store=MEMORY") # In-memory temporary tables & sorts
        cursor.execute("PRAGMA busy_timeout=5000") # 5s busy timeout under concurrency
        cursor.execute("PRAGMA foreign_keys=ON") # Enforce cascade deletes & relational integrity
        cursor.execute("PRAGMA threads=4") # Multi-threaded query execution for sorts & index joins
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

from sqlalchemy import inspect, text

def run_migrations():
    try:
        with engine.connect() as conn:
            inspector = inspect(conn)
            tables = inspector.get_table_names()

            if "playlists" in tables:
                cols = [c["name"] for c in inspector.get_columns("playlists")]
                if "source_type" not in cols:
                    conn.execute(text("ALTER TABLE playlists ADD COLUMN source_type VARCHAR(32) DEFAULT 'local'"))
                if "source_id" not in cols:
                    conn.execute(text("ALTER TABLE playlists ADD COLUMN source_id VARCHAR(128)"))
                if "auto_update" not in cols:
                    conn.execute(text("ALTER TABLE playlists ADD COLUMN auto_update BOOLEAN DEFAULT 0"))

            if "listening_history" in tables:
                lh_cols = [c["name"] for c in inspector.get_columns("listening_history")]
                if "duration_listened_seconds" not in lh_cols:
                    conn.execute(text("ALTER TABLE listening_history ADD COLUMN duration_listened_seconds FLOAT DEFAULT 0.0"))
                if "track_duration_seconds" not in lh_cols:
                    conn.execute(text("ALTER TABLE listening_history ADD COLUMN track_duration_seconds FLOAT DEFAULT 0.0"))
                if "completion_rate" not in lh_cols:
                    conn.execute(text("ALTER TABLE listening_history ADD COLUMN completion_rate FLOAT DEFAULT 0.0"))
                if "completed" not in lh_cols:
                    conn.execute(text("ALTER TABLE listening_history ADD COLUMN completed BOOLEAN DEFAULT 0"))
                if "skipped" not in lh_cols:
                    conn.execute(text("ALTER TABLE listening_history ADD COLUMN skipped BOOLEAN DEFAULT 0"))
                if "playback_context" not in lh_cols:
                    conn.execute(text("ALTER TABLE listening_history ADD COLUMN playback_context VARCHAR(64)"))
                if "context_id" not in lh_cols:
                    conn.execute(text("ALTER TABLE listening_history ADD COLUMN context_id VARCHAR(128)"))
                if "hour_of_day" not in lh_cols:
                    conn.execute(text("ALTER TABLE listening_history ADD COLUMN hour_of_day INTEGER"))
                if "day_of_week" not in lh_cols:
                    conn.execute(text("ALTER TABLE listening_history ADD COLUMN day_of_week INTEGER"))

            # Create strategic indexes to accelerate queries
            indexes_to_create = [
                # Existing indexes
                "CREATE INDEX IF NOT EXISTS idx_tracks_source_id ON tracks (source_id)",
                "CREATE INDEX IF NOT EXISTS idx_tracks_source_type ON tracks (source_type)",
                "CREATE INDEX IF NOT EXISTS idx_liked_songs_user_time ON liked_songs (user_id, liked_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos ON playlist_tracks (playlist_id, position)",
                "CREATE INDEX IF NOT EXISTS idx_history_user_time ON listening_history (user_id, played_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_playlists_user_pub ON playlists (user_id, is_public)",

                # High-performance composite indexes
                "CREATE INDEX IF NOT EXISTS idx_tracks_source_composite ON tracks (source_type, source_id)",
                "CREATE INDEX IF NOT EXISTS idx_tracks_uploader_created ON tracks (uploader_id, is_uploaded, created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks (play_count DESC)",
                "CREATE INDEX IF NOT EXISTS idx_tracks_cached_last_played ON tracks (is_cached, last_played_at)",
                "CREATE INDEX IF NOT EXISTS idx_history_user_track ON listening_history (user_id, track_id)",
                "CREATE INDEX IF NOT EXISTS idx_history_track_time ON listening_history (track_id, played_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks (track_id)",
                "CREATE INDEX IF NOT EXISTS idx_liked_songs_track ON liked_songs (track_id)",
                "CREATE INDEX IF NOT EXISTS idx_playlists_user_updated ON playlists (user_id, is_system, updated_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_user_activity_user_time ON user_activity_logs (user_id, created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_history_user_completed ON listening_history (user_id, completed)",
                "CREATE INDEX IF NOT EXISTS idx_history_user_skipped ON listening_history (user_id, skipped)",
                "CREATE INDEX IF NOT EXISTS idx_history_hour ON listening_history (hour_of_day)",
            ]
            for idx_sql in indexes_to_create:
                try:
                    conn.execute(text(idx_sql))
                except Exception as ex:
                    print(f"Index migration note ({idx_sql}): {ex}")

            conn.commit()
    except Exception as e:
        print(f"Migration error: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

