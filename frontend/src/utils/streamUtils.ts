import type { Track } from '../types';
import { resolveApiUrl } from './apiConfig';

/**
 * Builds canonical stream URL ensuring user identification is appended
 * so that streams are never logged as anonymous.
 */
export function buildStreamUrl(
  track: Track,
  extraParams?: Record<string, string | number | boolean | undefined | null>,
  userIdOverride?: string | null,
): string {
  const streamParams = new URLSearchParams();
  if (track.title && track.title !== 'Unknown Track') streamParams.set('title', track.title);
  if (track.artist && track.artist !== 'Unknown Artist') streamParams.set('artist', track.artist);
  if (track.album) streamParams.set('album', track.album);
  if (track.cover_url) streamParams.set('cover_url', track.cover_url);

  const userId =
    userIdOverride !== undefined
      ? userIdOverride
      : typeof localStorage !== 'undefined'
        ? localStorage.getItem('audiohub_user_id') || localStorage.getItem('azify_user_id')
        : null;

  if (userId) {
    streamParams.set('user_id', userId);
  }

  if (extraParams) {
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        streamParams.set(k, String(v));
      }
    });
  }

  const qs = streamParams.toString() ? `?${streamParams.toString()}` : '';
  return resolveApiUrl(`/api/v1/stream/${track.id}${qs}`);
}
