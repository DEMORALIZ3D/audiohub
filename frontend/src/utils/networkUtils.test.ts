import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNetworkInfo } from './networkUtils';

describe('getNetworkInfo', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('returns default fast wifi values if navigator.connection is missing', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
    const info = getNetworkInfo();
    expect(info).toEqual({
      isWifiOrFast: true,
      isCellular: false,
      saveData: false,
      effectiveType: '4g',
    });
  });

  it('detects wifi connection without saveData', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        connection: {
          type: 'wifi',
          saveData: false,
          effectiveType: '4g',
        },
      },
      writable: true,
      configurable: true,
    });
    const info = getNetworkInfo();
    expect(info.isWifiOrFast).toBe(true);
    expect(info.isCellular).toBe(false);
    expect(info.saveData).toBe(false);
  });

  it('detects cellular connection with saveData on', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        connection: {
          type: 'cellular',
          saveData: true,
          effectiveType: '3g',
        },
      },
      writable: true,
      configurable: true,
    });
    const info = getNetworkInfo();
    expect(info.isWifiOrFast).toBe(false);
    expect(info.isCellular).toBe(true);
    expect(info.saveData).toBe(true);
    expect(info.effectiveType).toBe('3g');
  });
});
