import { describe, expect, it } from 'vitest';

function reorderArray<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= list.length ||
    toIndex < 0 ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return list;
  }
  const result = [...list];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

describe('Queue & Playlist Reordering Logic', () => {
  const sampleTracks = [
    { id: 'track_1', title: 'Track 1' },
    { id: 'track_2', title: 'Track 2' },
    { id: 'track_3', title: 'Track 3' },
    { id: 'track_4', title: 'Track 4' },
    { id: 'track_5', title: 'Track 5' },
  ];

  it('moves an item forward in the queue/playlist', () => {
    // Move track_2 (index 1) to position 3
    const reordered = reorderArray(sampleTracks, 1, 3);
    expect(reordered.map((t) => t.id)).toEqual([
      'track_1',
      'track_3',
      'track_4',
      'track_2',
      'track_5',
    ]);
  });

  it('moves an item backward in the queue/playlist', () => {
    // Move track_4 (index 3) to position 1
    const reordered = reorderArray(sampleTracks, 3, 1);
    expect(reordered.map((t) => t.id)).toEqual([
      'track_1',
      'track_4',
      'track_2',
      'track_3',
      'track_5',
    ]);
  });

  it('moves an item to the very beginning (index 0)', () => {
    const reordered = reorderArray(sampleTracks, 4, 0);
    expect(reordered[0].id).toBe('track_5');
    expect(reordered.length).toBe(5);
  });

  it('moves an item to the very end', () => {
    const reordered = reorderArray(sampleTracks, 0, 4);
    expect(reordered[4].id).toBe('track_1');
    expect(reordered.length).toBe(5);
  });

  it('safely ignores out-of-bounds or identical indices', () => {
    expect(reorderArray(sampleTracks, -1, 2)).toEqual(sampleTracks);
    expect(reorderArray(sampleTracks, 1, 99)).toEqual(sampleTracks);
    expect(reorderArray(sampleTracks, 2, 2)).toEqual(sampleTracks);
  });
});
