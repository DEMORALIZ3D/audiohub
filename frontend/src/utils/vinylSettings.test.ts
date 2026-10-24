import { beforeEach, describe, expect, it } from 'vitest';
import {
  CRATE_VIEW_STORAGE_KEY,
  getCrateViewPreference,
  getVinylArtPreference,
  setCrateViewPreference,
  setVinylArtPreference,
  VINYL_ART_STORAGE_KEY,
} from './vinylSettings';

describe('vinylSettings utility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults vinyl art preference to false when unset', () => {
    expect(getVinylArtPreference()).toBe(false);
  });

  it('correctly sets and retrieves vinyl art preference', () => {
    setVinylArtPreference(true);
    expect(localStorage.getItem(VINYL_ART_STORAGE_KEY)).toBe('true');
    expect(getVinylArtPreference()).toBe(true);

    setVinylArtPreference(false);
    expect(localStorage.getItem(VINYL_ART_STORAGE_KEY)).toBe('false');
    expect(getVinylArtPreference()).toBe(false);
  });

  it('defaults crate view preference to grid when unset', () => {
    expect(getCrateViewPreference()).toBe('grid');
  });

  it('correctly sets and retrieves crate view preference', () => {
    setCrateViewPreference('coverflow');
    expect(localStorage.getItem(CRATE_VIEW_STORAGE_KEY)).toBe('coverflow');
    expect(getCrateViewPreference()).toBe('coverflow');

    setCrateViewPreference('grid');
    expect(localStorage.getItem(CRATE_VIEW_STORAGE_KEY)).toBe('grid');
    expect(getCrateViewPreference()).toBe('grid');
  });
});
