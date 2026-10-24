export const SERVER_STORAGE_KEY = 'audiohub_server_url';
export const DEFAULT_HOMELAB_URL = 'http://localhost:4533';

/**
 * Checks if the frontend is running on a Smart TV (Tizen, webOS, leanback route).
 * This controls the 10-foot TV UI mode (D-pad focus, TV remote keybindings, large layout).
 * NOTE: This is purely for UI rendering and does NOT determine if the app is a packaged native app.
 */
export function isTvPlatform(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).tizen ||
      (window as any).webOS ||
      window.location.hash.includes('tv') ||
      window.location.pathname.includes('/tv') ||
      (typeof navigator !== 'undefined' &&
        /SmartTV|Tizen|webOS|HbbTV|BRAVIA/i.test(navigator.userAgent)),
  );
}

/**
 * Checks if the frontend is running inside a packaged native container
 * (Capacitor Android/iOS APK, or Tizen / webOS standalone package loaded via file://).
 *
 * IMPORTANT: Web browsers and PWAs loaded over HTTP/HTTPS are NEVER standalone apps.
 * They are served directly from a server origin, so they must never be prompted for a backend.
 */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;

  // Any app served over HTTP or HTTPS is a Web / PWA site with a known server origin
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return false;
  }

  // Local file protocol (Samsung Tizen WGT, LG webOS IPK, Electron file package)
  const isFile = window.location.protocol === 'file:';

  // Capacitor native platform (packaged Android/iOS app)
  const isCapacitorNative = Boolean(
    typeof (window as any).Capacitor?.isNativePlatform === 'function' &&
      (window as any).Capacitor.isNativePlatform(),
  );

  return isFile || isCapacitorNative;
}

/**
 * Returns the active server base URL (e.g. 'https://music.example.com' or 'http://192.168.1.100:4533').
 * For Web and PWA, always defaults to window.location.origin.
 * For packaged apps (Capacitor / Tizen file://), returns the stored URL or empty string.
 */
export function getServerBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(SERVER_STORAGE_KEY);
  if (stored && stored.trim()) {
    return stored.trim().replace(/\/+$/, '');
  }
  // For Web & PWA (HTTP/HTTPS): the origin that served the app IS the backend server!
  if (
    typeof window.location !== 'undefined' &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
    window.location.origin &&
    window.location.origin !== 'null'
  ) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return '';
}

/**
 * Persists custom server base URL to localStorage.
 */
export function setServerBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const clean = url.trim().replace(/\/+$/, '');
  if (clean) {
    localStorage.setItem(SERVER_STORAGE_KEY, clean);
  } else {
    localStorage.removeItem(SERVER_STORAGE_KEY);
  }
}

/**
 * Resolves a relative path (/api/v1/...) to an absolute URL pointing to the configured backend.
 */
export function resolveApiUrl(pathOrUrl: string | undefined | null): string {
  if (!pathOrUrl) return '';
  if (
    pathOrUrl.startsWith('http://') ||
    pathOrUrl.startsWith('https://') ||
    pathOrUrl.startsWith('blob:') ||
    pathOrUrl.startsWith('data:')
  ) {
    return pathOrUrl;
  }
  const base = getServerBaseUrl();
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
