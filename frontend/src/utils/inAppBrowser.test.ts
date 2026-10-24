import { describe, expect, it } from 'vitest';
import {
  buildAppCustomSchemeUrl,
  buildChromeIntentUrl,
  getInAppBrowserDetails,
} from './inAppBrowser';

describe('inAppBrowser utility', () => {
  it('detects Facebook Messenger on Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/447.0.0.32.118;] FBAN/Messenger';
    const details = getInAppBrowserDetails(ua);

    expect(details.isInApp).toBe(true);
    expect(details.isFbMessenger).toBe(true);
    expect(details.isAndroid).toBe(true);
    expect(details.name).toBe('Facebook Messenger');
  });

  it('detects Instagram on iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 324.0.0.18.109';
    const details = getInAppBrowserDetails(ua);

    expect(details.isInApp).toBe(true);
    expect(details.isInstagram).toBe(true);
    expect(details.isIos).toBe(true);
    expect(details.name).toBe('Instagram');
  });

  it('returns false for normal Chrome on Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36';
    const details = getInAppBrowserDetails(ua);

    expect(details.isInApp).toBe(false);
    expect(details.isFbMessenger).toBe(false);
  });

  it('builds valid Chrome intent URL for Android breakout', () => {
    const url = 'https://music.homelab.local/?track=dz_718';
    const intent = buildChromeIntentUrl(url);

    expect(intent).toContain('intent://music.homelab.local/?track=dz_718#Intent');
    expect(intent).toContain('scheme=https');
    expect(intent).toContain('package=com.android.chrome');
    expect(intent).toContain('action=android.intent.action.VIEW');
  });

  it('builds custom scheme URL for native app launch', () => {
    const url = 'https://music.homelab.local/?track=dz_718';
    const scheme = buildAppCustomSchemeUrl(url);

    expect(scheme).toBe('audiohub://open?track=dz_718');
  });
});
