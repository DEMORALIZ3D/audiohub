import { beforeEach, describe, expect, it } from 'vitest';
import type { Track } from '../types';
import { createShuffledQueue, shuffleArray } from '../utils/shuffleUtils';
import { buildStreamUrl } from '../utils/streamUtils';

describe('Playback Stream URL Generation & User Attribution', () => {
  const sampleTrack: Track = {
    id: 'track-42-hifi',
    title: 'Midnight Resonance',
    artist: 'Aether Wave',
    album: 'Cosmic Drift',
    duration_seconds: 264,
    cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('always appends user_id from localStorage so streams are never logged as anonymous', () => {
    const testUserId = 'user_admin_98765';
    localStorage.setItem('audiohub_user_id', testUserId);

    const streamUrl = buildStreamUrl(sampleTrack);
    const parsed = new URL(streamUrl, 'http://localhost');

    expect(parsed.searchParams.get('user_id')).toBe(testUserId);
    expect(parsed.pathname).toContain(`/api/v1/stream/${sampleTrack.id}`);
  });

  it('supports azify_user_id legacy key fallback when audiohub_user_id is unset', () => {
    const legacyUserId = 'azify_usr_555';
    localStorage.setItem('azify_user_id', legacyUserId);

    const streamUrl = buildStreamUrl(sampleTrack);
    const parsed = new URL(streamUrl, 'http://localhost');

    expect(parsed.searchParams.get('user_id')).toBe(legacyUserId);
  });

  it('supports explicit userIdOverride parameter over localStorage', () => {
    localStorage.setItem('audiohub_user_id', 'stored_user_111');
    const overrideId = 'override_speaker_user_999';

    const streamUrl = buildStreamUrl(sampleTrack, undefined, overrideId);
    const parsed = new URL(streamUrl, 'http://localhost');

    expect(parsed.searchParams.get('user_id')).toBe(overrideId);
  });

  it('preserves user_id alongside custom playback params like retry, t, or quality', () => {
    const testUserId = 'user_audiophile_444';
    localStorage.setItem('audiohub_user_id', testUserId);

    const streamUrl = buildStreamUrl(sampleTrack, {
      retry: 2,
      t: 1729630000000,
      quality: 'lossless',
    });
    const parsed = new URL(streamUrl, 'http://localhost');

    expect(parsed.searchParams.get('user_id')).toBe(testUserId);
    expect(parsed.searchParams.get('retry')).toBe('2');
    expect(parsed.searchParams.get('quality')).toBe('lossless');
    expect(parsed.searchParams.get('title')).toBe('Midnight Resonance');
    expect(parsed.searchParams.get('artist')).toBe('Aether Wave');
  });

  it('encodes special characters in metadata while keeping user_id intact', () => {
    const testUserId = 'usr_spec_chars';
    localStorage.setItem('audiohub_user_id', testUserId);

    const trackWithSpecialChars: Track = {
      id: 'spec-id-123',
      title: 'Rock & Roll / Synth 100% #1',
      artist: 'AC/DC & The Who',
      duration_seconds: 190,
    };

    const streamUrl = buildStreamUrl(trackWithSpecialChars);
    const parsed = new URL(streamUrl, 'http://localhost');

    expect(parsed.searchParams.get('user_id')).toBe(testUserId);
    expect(parsed.searchParams.get('title')).toBe('Rock & Roll / Synth 100% #1');
    expect(parsed.searchParams.get('artist')).toBe('AC/DC & The Who');
  });
});

describe('Shuffle Queue Consistency & Active Track Preservation', () => {
  const createMockTracks = (count: number): Track[] =>
    Array.from({ length: count }, (_, idx) => ({
      id: `track-${idx + 1}`,
      title: `Liked Song #${idx + 1}`,
      artist: `Artist ${(idx % 3) + 1}`,
      album: `Album ${(idx % 2) + 1}`,
      duration_seconds: 180 + idx * 10,
      cover_url: `https://art.example.com/${idx + 1}.jpg`,
    }));

  it('keeps active currentTrack at index 0 of the shuffled queue', () => {
    const tracks = createMockTracks(10);
    const currentTrack = tracks[4]; // Track #5 is currently playing

    const shuffled = createShuffledQueue(currentTrack, tracks);

    // Critical assertion: active track stays at index 0
    expect(shuffled[0]).toEqual(currentTrack);
    expect(shuffled[0].id).toBe(currentTrack.id);
    expect(shuffled[0].title).toBe(currentTrack.title);
    expect(shuffled[0].cover_url).toBe(currentTrack.cover_url);
  });

  it('contains every track from the original track list exactly once without duplicates', () => {
    const tracks = createMockTracks(8);
    const currentTrack = tracks[2];

    const shuffled = createShuffledQueue(currentTrack, tracks);

    expect(shuffled.length).toBe(tracks.length);

    const originalIds = new Set(tracks.map((t) => t.id));
    const shuffledIds = new Set(shuffled.map((t) => t.id));

    expect(shuffledIds).toEqual(originalIds);
    expect(shuffledIds.size).toBe(tracks.length);
  });

  it('handles small queues gracefully: 1 track and 2 tracks', () => {
    const singleTrackList = createMockTracks(1);
    const singleShuffled = createShuffledQueue(singleTrackList[0], singleTrackList);
    expect(singleShuffled).toHaveLength(1);
    expect(singleShuffled[0].id).toBe(singleTrackList[0].id);

    const twoTrackList = createMockTracks(2);
    const twoShuffled = createShuffledQueue(twoTrackList[1], twoTrackList);
    expect(twoShuffled).toHaveLength(2);
    expect(twoShuffled[0].id).toBe(twoTrackList[1].id);
    expect(twoShuffled[1].id).toBe(twoTrackList[0].id);
  });

  it('shuffles the remaining tracks after index 0 across repeated runs', () => {
    const tracks = createMockTracks(15);
    const currentTrack = tracks[0];

    const run1 = createShuffledQueue(currentTrack, tracks);
    const run2 = createShuffledQueue(currentTrack, tracks);

    // Both must keep currentTrack at index 0
    expect(run1[0].id).toBe(currentTrack.id);
    expect(run2[0].id).toBe(currentTrack.id);

    // Remaining order should randomize with high statistical probability
    const rest1 = run1.slice(1).map((t) => t.id);
    const rest2 = run2.slice(1).map((t) => t.id);
    const isExactMatch = rest1.every((id, idx) => id === rest2[idx]);

    expect(isExactMatch).toBe(false);
  });

  it('retains integrity when currentTrack is not part of the initial queue', () => {
    const tracks = createMockTracks(5);
    const externalTrack: Track = {
      id: 'external-bonus-track',
      title: 'Bonus Single',
      artist: 'Guest Star',
      duration_seconds: 200,
    };

    const shuffled = createShuffledQueue(externalTrack, tracks);

    expect(shuffled[0].id).toBe('external-bonus-track');
    expect(shuffled.length).toBe(tracks.length + 1);
  });
});
