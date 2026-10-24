import { describe, expect, it } from 'vitest';
import type { Track } from '../types';
import {
  canShareTrack,
  getAlbumShareData,
  getArtistShareData,
  getPlaylistShareData,
  getTrackShareData,
  openShareModal,
} from './shareUtils';

describe('shareUtils', () => {
  it('allows sharing catalog and public tracks', () => {
    const catalogTrack: Track = {
      id: 'dz_12345',
      title: 'Song',
      artist: 'Artist',
      duration_seconds: 180,
    };
    expect(canShareTrack(catalogTrack)).toBe(true);

    const publicUpload: Track = {
      id: 'up_67890',
      title: 'My Song',
      artist: 'Me',
      duration_seconds: 210,
      is_uploaded: true,
      is_private: false,
    };
    expect(canShareTrack(publicUpload)).toBe(true);
  });

  it('prevents sharing private uploaded tracks', () => {
    const privateUpload: Track = {
      id: 'up_99999',
      title: 'Secret Demo',
      artist: 'Me',
      duration_seconds: 120,
      is_uploaded: true,
      is_private: true,
    };
    expect(canShareTrack(privateUpload)).toBe(false);
  });

  it('generates proper track share metadata', () => {
    const track: Track = {
      id: 'dz_98765',
      title: 'Starboy',
      artist: 'The Weeknd',
      duration_seconds: 230,
    };
    const data = getTrackShareData(track);
    expect(data.title).toContain('Starboy - The Weeknd');
    expect(data.text).toContain('The Weeknd');
    expect(data.url).toContain('/?track=dz_98765');
  });

  it('generates playlist, artist, and album share metadata', () => {
    const pl = getPlaylistShareData('pl_123', 'Top Hits');
    expect(pl.url).toContain('/?playlist=pl_123');

    const art = getArtistShareData('art_456', 'Daft Punk');
    expect(art.url).toContain('/?artist=art_456');

    const alb = getAlbumShareData('alb_789', 'Discovery', 'Daft Punk');
    expect(alb.url).toContain('/?album=alb_789');
  });

  it('enriches metadata with type tags and dispatches open-share event', () => {
    let capturedEvent: any = null;
    const listener = (e: any) => {
      capturedEvent = e.detail;
    };
    window.addEventListener('audiohub:open-share', listener);

    const track: Track = {
      id: 'dz_123',
      title: 'Midnight City',
      artist: 'M83',
      duration_seconds: 243,
      cover_url: 'https://cdn.example.com/cover.jpg',
    };
    const data = getTrackShareData(track);
    expect(data.type).toBe('track');
    expect(data.coverUrl).toBe('https://cdn.example.com/cover.jpg');

    openShareModal(data);
    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.title).toContain('Midnight City');
    window.removeEventListener('audiohub:open-share', listener);
  });
});
