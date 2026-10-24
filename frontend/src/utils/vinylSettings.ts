import { useEffect, useState } from 'react';

export const VINYL_ART_STORAGE_KEY = 'audiohub_vinyl_art';
export const CRATE_VIEW_STORAGE_KEY = 'audiohub_crate_view';

export type CrateViewMode = 'grid' | 'coverflow';

export const getVinylArtPreference = (): boolean => {
  try {
    const val = localStorage.getItem(VINYL_ART_STORAGE_KEY);
    return val === 'true';
  } catch (e) {
    return false;
  }
};

export const setVinylArtPreference = (enabled: boolean): void => {
  try {
    localStorage.setItem(VINYL_ART_STORAGE_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('audiohub_vinyl_art_changed', { detail: enabled }));
  } catch (e) {}
};

export const useVinylArtPreference = (): [
  boolean,
  (val: boolean | ((prev: boolean) => boolean)) => void,
] => {
  const [isVinylArt, setIsVinylArtState] = useState<boolean>(() => getVinylArtPreference());

  useEffect(() => {
    const handleChanged = (e: Event) => {
      const custom = e as CustomEvent<boolean>;
      if (typeof custom.detail === 'boolean') {
        setIsVinylArtState(custom.detail);
      } else {
        setIsVinylArtState(getVinylArtPreference());
      }
    };

    window.addEventListener('audiohub_vinyl_art_changed', handleChanged);
    window.addEventListener('storage', handleChanged);
    return () => {
      window.removeEventListener('audiohub_vinyl_art_changed', handleChanged);
      window.removeEventListener('storage', handleChanged);
    };
  }, []);

  const setVinylArt = (val: boolean | ((prev: boolean) => boolean)) => {
    setIsVinylArtState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      setVinylArtPreference(next);
      return next;
    });
  };

  return [isVinylArt, setVinylArt];
};

export const getCrateViewPreference = (): CrateViewMode => {
  try {
    const val = localStorage.getItem(CRATE_VIEW_STORAGE_KEY);
    return val === 'coverflow' ? 'coverflow' : 'grid';
  } catch (e) {
    return 'grid';
  }
};

export const setCrateViewPreference = (mode: CrateViewMode): void => {
  try {
    localStorage.setItem(CRATE_VIEW_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent('audiohub_crate_view_changed', { detail: mode }));
  } catch (e) {}
};

export const useCrateViewPreference = (): [CrateViewMode, (mode: CrateViewMode) => void] => {
  const [crateView, setCrateViewState] = useState<CrateViewMode>(() => getCrateViewPreference());

  useEffect(() => {
    const handleChanged = (e: Event) => {
      const custom = e as CustomEvent<CrateViewMode>;
      if (custom.detail === 'grid' || custom.detail === 'coverflow') {
        setCrateViewState(custom.detail);
      } else {
        setCrateViewState(getCrateViewPreference());
      }
    };

    window.addEventListener('audiohub_crate_view_changed', handleChanged);
    window.addEventListener('storage', handleChanged);
    return () => {
      window.removeEventListener('audiohub_crate_view_changed', handleChanged);
      window.removeEventListener('storage', handleChanged);
    };
  }, []);

  const setCrateView = (mode: CrateViewMode) => {
    setCrateViewState(mode);
    setCrateViewPreference(mode);
  };

  return [crateView, setCrateView];
};
