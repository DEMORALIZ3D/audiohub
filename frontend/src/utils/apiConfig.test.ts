import { beforeEach, describe, expect, it } from 'vitest';
import { getServerBaseUrl, resolveApiUrl, SERVER_STORAGE_KEY, setServerBaseUrl } from './apiConfig';

describe('apiConfig utility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and retrieves server URL correctly, trimming trailing slashes', () => {
    setServerBaseUrl('http://192.168.1.100:4533///');
    expect(localStorage.getItem(SERVER_STORAGE_KEY)).toBe('http://192.168.1.100:4533');
    expect(getServerBaseUrl()).toBe('http://192.168.1.100:4533');
  });

  it('removes stored URL if set with empty string', () => {
    setServerBaseUrl('https://music.example.com');
    expect(getServerBaseUrl()).toBe('https://music.example.com');
    setServerBaseUrl('');
    expect(localStorage.getItem(SERVER_STORAGE_KEY)).toBeNull();
  });

  it('resolves relative paths to full server URLs when configured', () => {
    setServerBaseUrl('http://192.168.1.100:4533');
    expect(resolveApiUrl('/api/v1/stream/123')).toBe('http://192.168.1.100:4533/api/v1/stream/123');
    expect(resolveApiUrl('api/v1/stream/123')).toBe('http://192.168.1.100:4533/api/v1/stream/123');
  });

  it('leaves absolute HTTP/HTTPS and blob URLs untouched', () => {
    setServerBaseUrl('http://192.168.1.100:4533');
    expect(resolveApiUrl('https://images.unsplash.com/photo')).toBe(
      'https://images.unsplash.com/photo',
    );
    expect(resolveApiUrl('blob:http://localhost/123')).toBe('blob:http://localhost/123');
    expect(resolveApiUrl('data:image/png;base64,...')).toBe('data:image/png;base64,...');
  });

  it('defaults to window.location.origin on web when no custom URL is stored', () => {
    // In jsdom environment, origin is http://localhost:3000
    const origin = window.location.origin.replace(/\/+$/, '');
    expect(getServerBaseUrl()).toBe(origin);
  });
});
