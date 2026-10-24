import { useEffect, useState } from 'react';

/**
 * Centralized Branding Configuration
 *
 * Dynamically configurable by Super Admin or via Server Environment.
 * All UI titles, QR center logos, badges, and metadata reactively reflect these values.
 */

export interface BrandConfig {
  appName: string;
  appShortName: string;
  tagline: string;
  logoUrl: string;
  themeColor: string;
  accentColor: string;
  poweredBy: string;
}

const DEFAULT_BRAND: BrandConfig = {
  appName: 'Audiohub - homelab entertainment',
  appShortName: 'Audiohub',
  tagline: 'homelab entertainment',
  logoUrl: '/icon.svg?v=2',
  themeColor: '#10b981',
  accentColor: '#1ed760',
  poweredBy: 'Audiohub',
};

import { resolveApiUrl } from '../utils/apiConfig';

function getStoredBranding(): BrandConfig {
  try {
    const raw = localStorage.getItem('azify_branding');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.appName) {
        return { ...DEFAULT_BRAND, ...parsed };
      }
    }
  } catch {}
  return DEFAULT_BRAND;
}

export const BRAND_CONFIG: BrandConfig = getStoredBranding();

export async function fetchServerBranding(): Promise<BrandConfig> {
  try {
    const url = resolveApiUrl('/api/v1/settings/branding');
    const res = await fetch(url);
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json();
        if (data.appName) {
          BRAND_CONFIG.appName = data.appName;
          BRAND_CONFIG.appShortName = data.appName;
          BRAND_CONFIG.tagline = data.tagline || BRAND_CONFIG.tagline;
          BRAND_CONFIG.logoUrl = data.logoUrl || BRAND_CONFIG.logoUrl;
          BRAND_CONFIG.themeColor = data.accentColor || BRAND_CONFIG.themeColor;
          BRAND_CONFIG.accentColor = data.accentColor || BRAND_CONFIG.accentColor;
          BRAND_CONFIG.poweredBy = data.appName;

          try {
            localStorage.setItem('azify_branding', JSON.stringify(BRAND_CONFIG));
          } catch {}

          if (typeof document !== 'undefined' && BRAND_CONFIG.appName) {
            document.title = BRAND_CONFIG.appName;
          }

          window.dispatchEvent(
            new CustomEvent('branding_changed', { detail: { ...BRAND_CONFIG } }),
          );
        }
      }
    }
  } catch (err) {
    console.debug('Failed to fetch server branding:', err);
  }
  return BRAND_CONFIG;
}

export function useBranding(): BrandConfig {
  const [brand, setBrand] = useState<BrandConfig>(() => ({ ...BRAND_CONFIG }));

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setBrand({ ...e.detail });
      }
    };
    window.addEventListener('branding_changed', handler);
    return () => window.removeEventListener('branding_changed', handler);
  }, []);

  return brand;
}
