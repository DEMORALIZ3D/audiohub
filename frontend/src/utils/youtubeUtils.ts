import type { Track } from '../types';

export function getTrackYoutubeId(track: Track | null | undefined): string | null {
  if (!track) return null;

  // Non-YouTube sources (Deezer, Spotify, Uploads, etc.) are never YouTube video IDs
  if (track.source_type && track.source_type !== 'youtube') {
    return null;
  }
  if (
    track.id &&
    (track.id.startsWith('dz_') || track.id.startsWith('sp_') || track.id.startsWith('up_'))
  ) {
    return null;
  }

  // 1. Explicit 11-char video ID in source_id
  if (track.source_id && /^[a-zA-Z0-9_-]{11}$/.test(track.source_id)) {
    return track.source_id;
  }

  // 2. ID prefix yt_
  if (track.id && track.id.startsWith('yt_')) {
    const raw = track.id.replace('yt_', '');
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  }

  // 3. Raw 11-char id
  if (track.id && /^[a-zA-Z0-9_-]{11}$/.test(track.id)) {
    return track.id;
  }

  // 4. Fallback if source_type is youtube
  if (track.source_type === 'youtube' && track.source_id) {
    return track.source_id;
  }

  return null;
}
