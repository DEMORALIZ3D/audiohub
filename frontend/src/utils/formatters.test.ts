import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatCompactNumber,
  formatDuration,
  formatPlaylistDuration,
  formatTime,
} from './formatters';

describe('formatTime & formatDuration', () => {
  it('handles zero, negative, null, and undefined values', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(-15)).toBe('0:00');
    expect(formatTime(null)).toBe('0:00');
    expect(formatTime(undefined)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
  });

  it('formats seconds under one minute', () => {
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(45)).toBe('0:45');
    expect(formatTime(59)).toBe('0:59');
  });

  it('formats standard song durations (minutes & seconds)', () => {
    expect(formatTime(60)).toBe('1:00');
    expect(formatTime(214)).toBe('3:34');
    expect(formatTime(3599)).toBe('59:59');
  });

  it('formats durations over an hour with hours, padded minutes and seconds', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3665)).toBe('1:01:05');
    expect(formatTime(7325)).toBe('2:02:05');
  });

  it('formatDuration behaves identically to formatTime', () => {
    expect(formatDuration(180)).toBe('3:00');
    expect(formatDuration(4205)).toBe('1:10:05');
  });
});

describe('formatPlaylistDuration', () => {
  it('handles zero and invalid durations', () => {
    expect(formatPlaylistDuration(0)).toBe('0 min');
    expect(formatPlaylistDuration(null)).toBe('0 min');
    expect(formatPlaylistDuration(undefined)).toBe('0 min');
    expect(formatPlaylistDuration(-10)).toBe('0 min');
  });

  it('formats minutes under an hour', () => {
    expect(formatPlaylistDuration(180)).toBe('3 min');
    expect(formatPlaylistDuration(2700)).toBe('45 min');
  });

  it('formats hours and minutes', () => {
    expect(formatPlaylistDuration(3600)).toBe('1 hr');
    expect(formatPlaylistDuration(4500)).toBe('1 hr 15 min');
    expect(formatPlaylistDuration(7200)).toBe('2 hr');
    expect(formatPlaylistDuration(7560)).toBe('2 hr 6 min');
  });
});

describe('formatBytes', () => {
  it('handles zero and invalid bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(null)).toBe('0 B');
    expect(formatBytes(-100)).toBe('0 B');
  });

  it('formats bytes, kilobytes, megabytes, and gigabytes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(5242880)).toBe('5 MB');
    expect(formatBytes(1073741824)).toBe('1 GB');
    expect(formatBytes(2684354560)).toBe('2.5 GB');
  });
});

describe('formatCompactNumber', () => {
  it('handles zero and small numbers', () => {
    expect(formatCompactNumber(0)).toBe('0');
    expect(formatCompactNumber(null)).toBe('0');
    expect(formatCompactNumber(450)).toBe('450');
  });

  it('formats thousands into K', () => {
    expect(formatCompactNumber(1000)).toBe('1K');
    expect(formatCompactNumber(1500)).toBe('1.5K');
    expect(formatCompactNumber(84200)).toBe('84.2K');
  });

  it('formats millions into M', () => {
    expect(formatCompactNumber(1000000)).toBe('1M');
    expect(formatCompactNumber(2500000)).toBe('2.5M');
  });
});
