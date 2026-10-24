/**
 * Centralized formatting utilities for AudioHub
 */

/**
 * Formats seconds into mm:ss or h:mm:ss string.
 * Examples:
 *   formatTime(45) -> "0:45"
 *   formatTime(228) -> "3:48"
 *   formatTime(3665) -> "1:01:05"
 */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds) || seconds <= 0) {
    return '0:00';
  }

  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const paddedSecs = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    const paddedMins = mins.toString().padStart(2, '0');
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }

  return `${mins}:${paddedSecs}`;
}

/**
 * Alias for formatTime for track duration display
 */
export const formatDuration = formatTime;

/**
 * Formats total playlist/album duration into a human readable description.
 * Examples:
 *   formatPlaylistDuration(180) -> "3 min"
 *   formatPlaylistDuration(4500) -> "1 hr 15 min"
 */
export function formatPlaylistDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) {
    return '0 min';
  }

  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);

  if (hrs > 0) {
    return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
  }

  return `${mins} min`;
}

/**
 * Formats bytes into a human-readable string (KB, MB, GB).
 */
export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);

  return `${parseFloat((bytes / k ** safeI).toFixed(dm))} ${sizes[safeI]}`;
}

/**
 * Formats large numbers compactly (e.g. 1.2M, 45K).
 */
export function formatCompactNumber(num: number | null | undefined): string {
  if (!num || isNaN(num) || num <= 0) return '0';
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return num.toString();
}
