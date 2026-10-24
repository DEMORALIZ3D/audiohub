import { beforeEach, describe, expect, it, vi } from 'vitest';
import { timeSync } from './timeSync';

describe('timeSync', () => {
  it('calculates expected master time accurately', () => {
    const now = timeSync.getNow();
    expect(typeof now).toBe('number');
    expect(now).toBeGreaterThan(0);
  });

  it('correctly calculates drift when local audio is ahead', () => {
    const now = timeSync.getNow();
    const scheduledStart = now - 10; // started 10 seconds ago
    const masterStart = 0; // started at 0.0s
    // Expected position is 10.0s
    const localTime = 10.05; // local is at 10.050s (+50ms ahead)

    const drift = timeSync.calculateDrift(localTime, masterStart, scheduledStart, 0);
    expect(Math.round(drift * 1000)).toBe(50);
  });

  it('correctly calculates drift when local audio is behind', () => {
    const now = timeSync.getNow();
    const scheduledStart = now - 10;
    const masterStart = 0;
    const localTime = 9.92; // local is at 9.920s (-80ms behind)

    const drift = timeSync.calculateDrift(localTime, masterStart, scheduledStart, 0);
    expect(Math.round(drift * 1000)).toBe(-80);
  });

  it('accounts for bluetooth hardware delay offset correctly', () => {
    const now = timeSync.getNow();
    const scheduledStart = now - 10;
    const masterStart = 0;
    const localTime = 10.0;
    const bluetoothDelayMs = 150; // speaker delays sound by 150ms

    // To compensate, the audio engine needs to run +150ms ahead
    const drift = timeSync.calculateDrift(localTime, masterStart, scheduledStart, bluetoothDelayMs);
    expect(Math.round(drift * 1000)).toBe(-150);
  });
});
