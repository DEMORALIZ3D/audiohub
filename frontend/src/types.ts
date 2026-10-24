export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration_seconds: number;
  cover_url?: string;
  source_type?: string;
  source_id?: string;
  is_liked?: boolean;
  is_cached?: boolean;
  is_uploaded?: boolean;
  uploader_id?: string;
  is_private?: boolean;
  is_downloaded?: boolean;
  liked_at?: string;
  position?: number;
  track_position?: number;
}

export type TabType =
  | 'home'
  | 'search'
  | 'library'
  | 'liked'
  | 'playlist'
  | 'artist'
  | 'album'
  | 'settings'
  | 'uploads'
  | 'downloaded'
  | 'guides'
  | 'tv'
  | 'pair'
  | 'setup';

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  cover_url?: string;
  track_count?: number;
  tracks?: Track[];
  source_type?: string;
  source_id?: string;
  auto_update?: boolean;
  is_chart?: boolean;
  is_radio?: boolean;
  is_followed?: boolean;
  followed_playlist_id?: string;
  curator?: string;
  badge?: string;
}

export interface CuratedPlaylistSummary {
  id: string;
  source_id?: string;
  source_type?: string;
  title: string;
  description?: string;
  cover_url?: string;
  curator?: string;
  track_count?: number;
  is_chart?: boolean;
  category?: string;
  badge?: string;
  color?: string;
}

export interface DailyMix {
  id: string;
  title: string;
  description: string;
  cover_url?: string;
  tracks: Track[];
}

export interface ArtistSummary {
  id: string;
  artist_id: string;
  name: string;
  picture_url?: string;
  fan_count?: number;
  source_type?: string;
}

export interface AlbumSummary {
  id: string;
  album_id: string;
  title: string;
  artist: string;
  cover_url?: string;
  release_date?: string;
  track_count?: number;
  record_type?: string;
  source_type?: string;
}

export interface ArtistDetail {
  id: string;
  name: string;
  picture_url?: string;
  fan_count?: number;
  top_tracks: Track[];
  albums: AlbumSummary[];
  related_artists: ArtistSummary[];
  is_followed?: boolean;
}

export interface AlbumDetail {
  id: string;
  title: string;
  artist: string;
  artist_id?: string;
  cover_url?: string;
  release_date?: string;
  tracks: Track[];
  is_saved?: boolean;
}

export interface PlaybackContext {
  type: 'playlist' | 'album' | 'artist' | 'liked' | 'search' | 'radio' | 'custom';
  id?: string;
  name?: string;
  cover_url?: string;
}

export interface SavedAlbum {
  id: string;
  album_id: string;
  title: string;
  artist: string;
  cover_url?: string;
  track_count?: number;
  saved_at?: string;
}

export interface FollowedArtist {
  id: string;
  artist_id: string;
  name: string;
  picture_url?: string;
  fan_count?: number;
  followed_at?: string;
}

export interface StorageStats {
  storage_mode: 'stream_only' | 'stream_and_cache';
  cached_tracks_count: number;
  cached_size_mb: number;
  disk_free_gb: number;
  disk_total_gb: number;
  max_cache_gb: number;
}

export interface LyricLine {
  time: number;
  text: string;
}

export type EQPreset =
  | 'flat'
  | 'bass_boost'
  | 'vocal'
  | 'electronic'
  | 'rock'
  | 'acoustic'
  | 'night';

export interface EQBands {
  bass: number; // 60Hz (-12 to +12 dB)
  lowMid: number; // 250Hz (-12 to +12 dB)
  mid: number; // 1kHz (-12 to +12 dB)
  highMid: number; // 4kHz (-12 to +12 dB)
  treble: number; // 12kHz (-12 to +12 dB)
}

export interface RoomParticipant {
  id: string;
  name: string;
  is_host: boolean;
}

export interface RoomState {
  code: string;
  name: string;
  host_id: string;
  host_name: string;
  current_track: Track | null;
  is_playing: boolean;
  position_seconds: number;
  queue: (Track & { added_by?: string; queued_at?: number })[];
  participants: RoomParticipant[];
}

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
  isDefault?: boolean;
}

export interface ConnectDevice {
  id: string;
  name: string;
  device_type: 'desktop' | 'mobile' | 'tablet' | 'tv' | 'cast' | 'unknown';
  is_active: boolean;
  is_current_device: boolean;
  volume: number;
  current_track: Track | null;
  is_playing: boolean;
  position_seconds: number;
  duration_seconds?: number;
  last_seen: number;
}

export interface ListeningStats {
  total_plays: number;
  total_duration_minutes: number;
  total_duration_hours: number;
  unique_tracks: number;
  unique_artists: number;
  top_tracks: { track: Track; play_count: number }[];
  top_artists: { artist: string; play_count: number }[];
  recent_history: { track: Track; played_at: string }[];
}
