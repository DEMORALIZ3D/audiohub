export interface PlaybackTelemetryEvent {
  duration_listened_seconds: number;
  track_duration_seconds: number;
  completed: boolean;
  skipped: boolean;
  playback_context: string;
  context_id?: string;
  hour_of_day: number;
  day_of_week: number;
}

/**
 * Computes implicit feedback signals (completed vs. skipped) and dayparting metadata
 * for tracking listening habits and tuning continuous radio / daily mix algorithms.
 */
export function computePlaybackTelemetry(
  listenedSec: number,
  trackDurationSec: number,
  forcedReason?: 'completed' | 'skipped',
  playbackContext?: string,
  contextId?: string,
  date: Date = new Date(),
): PlaybackTelemetryEvent {
  const dur = Math.max(0, trackDurationSec);
  const listened = Math.max(0, Math.min(listenedSec, dur > 0 ? dur : listenedSec));

  const isCompleted = forcedReason === 'completed' || (dur > 0 && listened / dur >= 0.75);

  const isSkipped = forcedReason === 'skipped' || (!isCompleted && listened < 30);

  return {
    duration_listened_seconds: Math.round(listened * 10) / 10,
    track_duration_seconds: Math.round(dur * 10) / 10,
    completed: isCompleted,
    skipped: isSkipped,
    playback_context: playbackContext || 'direct',
    context_id: contextId,
    hour_of_day: date.getHours(),
    day_of_week: date.getDay(),
  };
}
