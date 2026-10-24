import { describe, expect, it } from 'vitest';
import {
  detectDeviceNameFromUa,
  detectDeviceTypeFromUa,
  isAudioSinkSupported,
} from './deviceUtils';

describe('deviceUtils', () => {
  it('correctly identifies iPhone user agents as mobile', () => {
    const iphoneUa =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
    expect(detectDeviceTypeFromUa(iphoneUa)).toBe('mobile');
    expect(detectDeviceNameFromUa(iphoneUa)).toBe('Safari on iPhone');
  });

  it('correctly identifies Android phone user agents as mobile', () => {
    const androidPhoneUa =
      'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';
    expect(detectDeviceTypeFromUa(androidPhoneUa)).toBe('mobile');
    expect(detectDeviceNameFromUa(androidPhoneUa)).toBe('Chrome on Android');
  });

  it('correctly identifies iPad user agents as tablet', () => {
    const ipadUa =
      'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
    expect(detectDeviceTypeFromUa(ipadUa)).toBe('tablet');
    expect(detectDeviceNameFromUa(ipadUa)).toBe('Safari on iPad');
  });

  it('correctly identifies Windows desktop browser user agents', () => {
    const winEdgeUa =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    expect(detectDeviceTypeFromUa(winEdgeUa)).toBe('desktop');
    expect(detectDeviceNameFromUa(winEdgeUa)).toBe('Edge on Windows');
  });

  it('handles empty user agent gracefully', () => {
    expect(detectDeviceTypeFromUa('')).toBe('desktop');
    expect(detectDeviceNameFromUa('')).toBe('Web Player');
  });

  it('correctly identifies Smart TV user agents', () => {
    const tvUa =
      'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/4.0 Chrome/76.0.3809.146 TV Safari/537.36';
    expect(detectDeviceTypeFromUa(tvUa)).toBe('tv');
    expect(detectDeviceNameFromUa(tvUa)).toBe('Samsung TV');
  });

  it('evaluates isAudioSinkSupported safely in jsdom test environment', () => {
    expect(typeof isAudioSinkSupported()).toBe('boolean');
  });
});
