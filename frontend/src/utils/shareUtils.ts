import { BRAND_CONFIG } from '../config/branding';
import type { Track } from '../types';

export interface ShareOptions {
  title: string;
  text: string;
  url: string;
  coverUrl?: string;
  subtitle?: string;
  type?: 'track' | 'album' | 'artist' | 'playlist';
}

export function canShareTrack(track: Track | null | undefined): boolean {
  if (!track) return false;
  // Private uploaded tracks cannot be shared outside
  if (track.is_uploaded && track.is_private) {
    return false;
  }
  return true;
}

export function getTrackShareData(track: Track): ShareOptions {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/?track=${encodeURIComponent(track.id)}`;
  const title = `${track.title} - ${track.artist}`;
  const subtitle = track.artist;
  const text = `Listen to "${track.title}" by ${track.artist} on ${BRAND_CONFIG.appName}`;
  return {
    title,
    subtitle,
    text,
    url,
    coverUrl: track.cover_url,
    type: 'track',
  };
}

export function getPlaylistShareData(
  playlistId: string,
  playlistName: string,
  coverUrl?: string,
): ShareOptions {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/?playlist=${encodeURIComponent(playlistId)}`;
  const title = playlistName;
  const subtitle = 'Playlist';
  const text = `Check out the playlist "${playlistName}" on ${BRAND_CONFIG.appName}`;
  return {
    title,
    subtitle,
    text,
    url,
    coverUrl,
    type: 'playlist',
  };
}

export function getArtistShareData(
  artistId: string,
  artistName: string,
  coverUrl?: string,
): ShareOptions {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/?artist=${encodeURIComponent(artistId)}`;
  const title = artistName;
  const subtitle = 'Artist';
  const text = `Explore ${artistName} on ${BRAND_CONFIG.appName}`;
  return {
    title,
    subtitle,
    text,
    url,
    coverUrl,
    type: 'artist',
  };
}

export function getAlbumShareData(
  albumId: string,
  albumTitle: string,
  artistName?: string,
  coverUrl?: string,
): ShareOptions {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/?album=${encodeURIComponent(albumId)}`;
  const byArtist = artistName ? ` by ${artistName}` : '';
  const title = albumTitle;
  const subtitle = artistName || 'Album';
  const text = `Listen to the album "${albumTitle}"${byArtist} on ${BRAND_CONFIG.appName}`;
  return {
    title,
    subtitle,
    text,
    url,
    coverUrl,
    type: 'album',
  };
}

/**
 * Triggers the rich ShareModal with dynamic QR pass and direct messenger links
 */
export function openShareModal(options: ShareOptions): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('audiohub:open-share', { detail: options }));
  }
}

/**
 * Direct share fallback for headless/programmatic contexts
 */
export async function shareContent(options: ShareOptions): Promise<'shared' | 'copied' | 'failed'> {
  // If in browser, preferred default is opening the rich ShareModal
  if (typeof window !== 'undefined') {
    openShareModal(options);
    return 'shared';
  }

  // Fallback to clipboard
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(options.url);
      return 'copied';
    }
  } catch {}

  return 'failed';
}
