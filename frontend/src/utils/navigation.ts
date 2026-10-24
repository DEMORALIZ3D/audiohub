/**
 * Global navigation helper to navigate across views in AudioHub
 * Dispatches audiohub:navigate event and updates the window URL hash.
 */

export function navigateToArtist(artist: string, artistId?: string) {
  const target = artistId || artist;
  if (!target) return;
  window.dispatchEvent(
    new CustomEvent('audiohub:navigate', {
      detail: { tab: 'artist', id: target },
    }),
  );
  window.location.hash = `#/artist/${encodeURIComponent(target)}`;
}

export function navigateToAlbum(albumId: string) {
  if (!albumId) return;
  window.dispatchEvent(
    new CustomEvent('audiohub:navigate', {
      detail: { tab: 'album', id: albumId },
    }),
  );
  window.location.hash = `#/album/${encodeURIComponent(albumId)}`;
}

export function navigateToPlaylist(playlistId: string) {
  if (!playlistId) return;
  window.dispatchEvent(
    new CustomEvent('audiohub:navigate', {
      detail: { tab: 'playlist', id: playlistId },
    }),
  );
  window.location.hash = `#/playlist/${encodeURIComponent(playlistId)}`;
}

export function navigateToSongRadio(track: {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration_seconds?: number;
  cover_url?: string;
  source_type?: string;
  source_id?: string;
}) {
  if (!track || !track.id) return;
  const radioId = `radio_${track.id}`;

  try {
    sessionStorage.setItem(`radio_seed_${radioId}`, JSON.stringify(track));
  } catch (e) {}

  window.dispatchEvent(
    new CustomEvent('audiohub:navigate', {
      detail: { tab: 'playlist', id: radioId },
    }),
  );

  const params = new URLSearchParams();
  if (track.title) params.set('title', track.title);
  if (track.artist) params.set('artist', track.artist);
  if (track.source_type) params.set('source_type', track.source_type);
  if (track.source_id) params.set('source_id', track.source_id);
  if (track.cover_url) params.set('cover_url', track.cover_url);
  if (track.album) params.set('album', track.album);
  if (track.duration_seconds) params.set('duration', String(track.duration_seconds));

  const q = params.toString();
  window.location.hash = `#/playlist/${encodeURIComponent(radioId)}${q ? '?' + q : ''}`;
}
