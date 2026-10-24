import type { Track } from '../types';

export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Shuffles a queue of tracks while ensuring the active track remains at index 0.
 * This guarantees the playing song matches the album art and queue drawer list.
 */
export function createShuffledQueue(currentTrack: Track, tracks: Track[]): Track[] {
  if (!tracks || tracks.length === 0) return currentTrack ? [currentTrack] : [];
  const otherTracks = tracks.filter((t) => t.id !== currentTrack.id);
  return [currentTrack, ...shuffleArray(otherTracks)];
}
