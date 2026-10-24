/**
 * In-App Browser (IAB) Detection & Breakout Engine
 *
 * When users open shared links inside Facebook Messenger, Instagram, or TikTok,
 * social platforms trap the browsing session in a sandboxed, restricted WebView.
 * In this sandbox:
 * 1. Saved localStorage / cookies from Chrome / Safari / PWA are absent, prompting an unwanted login screen.
 * 2. Hardware media sessions, WebGL, background playback, and PWA integration are throttled.
 *
 * This engine detects the in-app browser and provides:
 * - Automatic Android Chrome / WebAPK intent redirection to open the installed PWA directly.
 * - Native app deep link integration (audiohub://).
 * - Clear, one-tap escape UI for iOS and Android fallback.
 */

export function getInAppBrowserDetails(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
) {
  const isAndroid = /Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua);

  const isFbMessenger = /FBAN\/Messenger|FB_IAB.*Messenger|MessengerForAndroid/i.test(ua);
  const isFacebook = !isFbMessenger && /FBAN|FBAV|FB_IAB/i.test(ua);
  const isInstagram = /Instagram/i.test(ua);
  const isTikTok = /musical_ly|ByteDanceWebview|TikTok/i.test(ua);
  const isTwitter = /Twitter|Tweetbot/i.test(ua);
  const isLine = /Line\//i.test(ua);
  const isWeChat = /MicroMessenger/i.test(ua);

  const isInApp =
    isFbMessenger || isFacebook || isInstagram || isTikTok || isTwitter || isLine || isWeChat;

  let name = 'In-App Browser';
  if (isFbMessenger) name = 'Facebook Messenger';
  else if (isFacebook) name = 'Facebook';
  else if (isInstagram) name = 'Instagram';
  else if (isTikTok) name = 'TikTok';
  else if (isTwitter) name = 'Twitter / X';
  else if (isLine) name = 'LINE';
  else if (isWeChat) name = 'WeChat';

  return {
    isInApp,
    name,
    isAndroid,
    isIos,
    isFbMessenger,
    isFacebook,
    isInstagram,
  };
}

/**
 * Builds an Android Intent URL that asks Android OS to open the link directly
 * in Chrome or the installed PWA WebAPK, completely breaking out of Facebook Messenger's sandbox.
 */
export function buildChromeIntentUrl(
  targetUrl: string = typeof window !== 'undefined' ? window.location.href : '',
): string {
  try {
    const parsed = new URL(targetUrl);
    const hostAndPath = parsed.host + parsed.pathname + parsed.search + parsed.hash;
    const scheme = parsed.protocol.replace(':', '');
    return `intent://${hostAndPath}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.android.chrome;end;`;
  } catch {
    return targetUrl;
  }
}

/**
 * Builds a custom scheme URL (audiohub://) to target the installed native Android / iOS app.
 */
export function buildAppCustomSchemeUrl(
  targetUrl: string = typeof window !== 'undefined' ? window.location.href : '',
): string {
  try {
    const parsed = new URL(targetUrl);
    // audiohub://open?track=... or audiohub://open?playlist=...
    const cleanSearch = parsed.search ? parsed.search.replace(/^\?/, '') : '';
    const cleanPath = parsed.pathname.replace(/^\//, '');
    const fullTarget = cleanPath ? `${cleanPath}?${cleanSearch}` : `open?${cleanSearch}`;
    return `audiohub://${fullTarget}`;
  } catch {
    return `audiohub://open`;
  }
}

/**
 * Attempts an automatic breakout if running on Android inside an in-app browser.
 * Uses sessionStorage guard to ensure it only fires once per session and doesn't create an infinite redirect loop.
 */
export function attemptAutoBreakout(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const { isInApp, isAndroid } = getInAppBrowserDetails(navigator.userAgent);
  if (!isInApp || !isAndroid) return false;

  try {
    const attempted = sessionStorage.getItem('audiohub_auto_breakout_attempted');
    if (attempted === 'true') {
      return false;
    }
    sessionStorage.setItem('audiohub_auto_breakout_attempted', 'true');

    const intentUrl = buildChromeIntentUrl(window.location.href);
    window.location.href = intentUrl;
    return true;
  } catch {
    return false;
  }
}

/**
 * Explicit user-triggered action: opens in native app or external system browser.
 */
export function openInSystemBrowserOrApp(
  targetUrl: string = typeof window !== 'undefined' ? window.location.href : '',
) {
  if (typeof window === 'undefined') return;

  const { isAndroid, isIos } = getInAppBrowserDetails(navigator.userAgent);

  if (isAndroid) {
    // Attempt Chrome Intent which dispatches directly to installed PWA WebAPK or Chrome
    window.location.href = buildChromeIntentUrl(targetUrl);
  } else if (isIos) {
    // Try custom scheme first for installed native app
    const appUrl = buildAppCustomSchemeUrl(targetUrl);
    window.location.href = appUrl;

    // Fallback: If app not installed or in Safari, copy link or alert user
    setTimeout(() => {
      // In iOS FB Messenger, top right ••• -> Open in Safari is the standard Apple gesture
      window.location.href = targetUrl;
    }, 1200);
  } else {
    window.open(targetUrl, '_blank');
  }
}
