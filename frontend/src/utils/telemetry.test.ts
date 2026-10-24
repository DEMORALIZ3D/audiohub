import { describe, expect, it } from 'vitest';
import { computePlaybackTelemetry } from './telemetry';

describe('telemetry utility', () => {
  it('marks track as skipped when listened < 30s', () => {
    const event = computePlaybackTelemetry(12, 200, undefined, 'radio');
    expect(event.skipped).toBe(true);
    expect(event.completed).toBe(false);
    expect(event.duration_listened_seconds).toBe(12);
    expect(event.track_duration_seconds).toBe(200);
    expect(event.playback_context).toBe('radio');
  });

  it('marks track as completed when listened >= 75%', () => {
    const event = computePlaybackTelemetry(160, 200, undefined, 'playlist', 'pl_123');
    expect(event.completed).toBe(true);
    expect(event.skipped).toBe(false);
    expect(event.context_id).toBe('pl_123');
  });

  it('honors forced completed signal from track ended event', () => {
    const event = computePlaybackTelemetry(50, 100, 'completed', 'album');
    expect(event.completed).toBe(true);
    expect(event.skipped).toBe(false);
  });

  it('honors forced skipped signal from user next action', () => {
    const event = computePlaybackTelemetry(40, 200, 'skipped');
    expect(event.skipped).toBe(true);
  });

  it('extracts correct hour_of_day and day_of_week for dayparting', () => {
    const fixedDate = new Date('2026-10-01T14:35:00Z');
    const event = computePlaybackTelemetry(100, 200, undefined, 'direct', undefined, fixedDate);
    expect(event.hour_of_day).toBe(fixedDate.getHours());
    expect(event.day_of_week).toBe(fixedDate.getDay());
  });
});
