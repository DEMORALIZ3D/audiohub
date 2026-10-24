/**
 * High-Precision NTP Clock Synchronization Engine for Azify
 *
 * Synchronizes client clock with the server down to sub-millisecond precision
 * and provides continuous drift calculations for multi-device speaker groups.
 */

interface SyncSample {
  offset: number; // in seconds: server_time - (local_now / 1000)
  rtt: number; // round trip time in milliseconds
}

class TimeSyncEngine {
  private offsetSeconds: number = 0;
  private isCalibrated: boolean = false;
  private samples: SyncSample[] = [];
  private syncInterval: any = null;

  constructor() {
    this.startPeriodicSync();
  }

  /**
   * Performs an NTP-style ping exchange with the server.
   */
  public async syncWithServer(): Promise<number> {
    const t0 = performance.now();
    try {
      const res = await fetch('/api/v1/connect/time', { cache: 'no-store' });
      if (!res.ok) return this.offsetSeconds;
      const t2 = performance.now();
      const data = await res.json();
      const serverTime = data.server_time; // in seconds

      const rttMs = t2 - t0;
      const oneWayDelaySeconds = rttMs / 2 / 1000;
      const estimatedServerTimeAtT2 = serverTime + oneWayDelaySeconds;
      const calculatedOffset = estimatedServerTimeAtT2 - t2 / 1000;

      this.samples.push({ offset: calculatedOffset, rtt: rttMs });
      if (this.samples.length > 8) {
        this.samples.shift();
      }

      // Sort by lowest RTT to discard jitter / buffer bloat spikes
      const bestSamples = [...this.samples].sort((a, b) => a.rtt - b.rtt).slice(0, 4);
      const avgOffset = bestSamples.reduce((sum, s) => sum + s.offset, 0) / bestSamples.length;

      this.offsetSeconds = avgOffset;
      this.isCalibrated = true;
      return this.offsetSeconds;
    } catch {
      return this.offsetSeconds;
    }
  }

  /**
   * Calibrates via WebSocket pong message.
   */
  public handleWsPong(clientT0: number, serverTime: number): void {
    const t2 = performance.now();
    const rttMs = t2 - clientT0;
    const oneWayDelaySeconds = rttMs / 2 / 1000;
    const estimatedServerTimeAtT2 = serverTime + oneWayDelaySeconds;
    const calculatedOffset = estimatedServerTimeAtT2 - t2 / 1000;

    this.samples.push({ offset: calculatedOffset, rtt: rttMs });
    if (this.samples.length > 8) this.samples.shift();

    const bestSamples = [...this.samples].sort((a, b) => a.rtt - b.rtt).slice(0, 4);
    this.offsetSeconds = bestSamples.reduce((sum, s) => sum + s.offset, 0) / bestSamples.length;
    this.isCalibrated = true;
  }

  /**
   * Returns current synchronized server time in seconds (with fractional microseconds).
   */
  public getNow(): number {
    return performance.now() / 1000 + this.offsetSeconds;
  }

  public getIsCalibrated(): boolean {
    return this.isCalibrated;
  }

  /**
   * Computes the drift in seconds between local audio playback position
   * and the master playback position.
   *
   * A positive drift means local audio is ahead of master.
   * A negative drift means local audio is behind master.
   */
  public calculateDrift(
    localCurrentTime: number,
    masterStartPosition: number,
    scheduledStartTime: number,
    bluetoothOffsetMs: number = 0,
  ): number {
    const now = this.getNow();
    const elapsedTime = now - scheduledStartTime;
    // Expected master audio position
    const expectedPosition = masterStartPosition + Math.max(0, elapsedTime);

    // Adjust for hardware output latency (Bluetooth/DAC delay)
    // Bluetooth offset adds delay to arrival, so we must seek slightly ahead to compensate
    const adjustedExpected = expectedPosition + bluetoothOffsetMs / 1000;

    return localCurrentTime - adjustedExpected;
  }

  private startPeriodicSync(): void {
    // Initial burst
    this.syncWithServer();
    setTimeout(() => this.syncWithServer(), 1500);
    setTimeout(() => this.syncWithServer(), 4000);

    // Periodic keep-alive sync every 45 seconds
    this.syncInterval = setInterval(() => {
      this.syncWithServer();
    }, 45000);
  }

  public destroy(): void {
    if (this.syncInterval) clearInterval(this.syncInterval);
  }
}

export const timeSync = new TimeSyncEngine();
