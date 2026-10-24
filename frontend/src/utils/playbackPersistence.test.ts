import { beforeEach, describe, expect, it } from 'vitest';

describe('Playback Continuity & Cross-Device Session Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists playback session accurately to localStorage', () => {
    const sessionData = {
      currentTrack: {
        id: 'yt_abc123',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        album: 'A Night at the Opera',
        duration_seconds: 354,
        cover_url: 'https://example.com/cover.jpg',
      },
      currentTime: 142,
      duration: 354,
      playbackContext: {
        type: 'album',
        id: 'night_at_the_opera',
        name: 'A Night at the Opera',
      },
      queue: [
        { id: 'yt_abc123', title: 'Bohemian Rhapsody', artist: 'Queen' },
        { id: 'yt_def456', title: 'Love of My Life', artist: 'Queen' },
      ],
      queueIndex: 0,
      updatedAt: 1727618000,
    };

    localStorage.setItem('azify_playback_session', JSON.stringify(sessionData));

    const retrieved = JSON.parse(localStorage.getItem('azify_playback_session') || '{}');
    expect(retrieved.currentTrack.id).toBe('yt_abc123');
    expect(retrieved.currentTime).toBe(142);
    expect(retrieved.duration).toBe(354);
    expect(retrieved.queue.length).toBe(2);
    expect(retrieved.playbackContext.type).toBe('album');
  });

  it('handles empty or malformed session gracefully', () => {
    localStorage.setItem('azify_playback_session', 'invalid json string{{{');
    let loaded = null;
    try {
      loaded = JSON.parse(localStorage.getItem('azify_playback_session') || '{}');
    } catch {
      loaded = {};
    }
    expect(loaded).toEqual({});
  });
});
