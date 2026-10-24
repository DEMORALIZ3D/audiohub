import { describe, expect, it } from 'vitest';
import type { Track } from '../types';
import { getTrackYoutubeId } from './youtubeUtils';

describe('getTrackYoutubeId', () => {
  it('returns null for null or undefined tracks', () => {
    expect(getTrackYoutubeId(null)).toBeNull();
    expect(getTrackYoutubeId(undefined)).toBeNull();
  });

  it('extracts 11-char video ID from source_id', () => {
    const track: Track = {
      id: 'custom_id_123',
      title: 'Test Song',
      artist: 'Test Artist',
      duration_seconds: 180,
      source_id: 'LLhNxbuGkpA',
      source_type: 'youtube',
    };
    expect(getTrackYoutubeId(track)).toBe('LLhNxbuGkpA');
  });

  it('extracts video ID from yt_ prefixed id', () => {
    const track: Track = {
      id: 'yt_ar1fKDXnw2o',
      title: 'Smalltown Boy',
      artist: 'JGS & Intent',
      duration_seconds: 240,
    };
    expect(getTrackYoutubeId(track)).toBe('ar1fKDXnw2o');
  });

  it('extracts raw 11-char id', () => {
    const track: Track = {
      id: '--Ff0qTs1jU',
      title: 'Man I Need',
      artist: 'JGS & Intent',
      duration_seconds: 240,
    };
    expect(getTrackYoutubeId(track)).toBe('--Ff0qTs1jU');
  });

  it('falls back to source_id if source_type is youtube', () => {
    const track: Track = {
      id: 'some_long_track_id_here',
      title: 'Test Track',
      artist: 'Artist',
      duration_seconds: 150,
      source_type: 'youtube',
      source_id: 'video_id_11',
    };
    expect(getTrackYoutubeId(track)).toBe('video_id_11');
  });

  it('returns null when no YouTube ID can be matched', () => {
    const track: Track = {
      id: 'dz_12345678',
      title: 'Deezer Track',
      artist: 'Studio Artist',
      duration_seconds: 210,
      source_type: 'deezer',
      source_id: '12345678',
    };
    expect(getTrackYoutubeId(track)).toBeNull();
  });
});
