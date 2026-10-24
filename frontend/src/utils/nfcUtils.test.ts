import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isNfcSupported, writeNfcUrl } from './nfcUtils';

describe('nfcUtils', () => {
  const originalNDEFReader = (window as any).NDEFReader;

  afterEach(() => {
    (window as any).NDEFReader = originalNDEFReader;
    vi.restoreAllMocks();
  });

  it('detects when Web NFC is not supported', () => {
    delete (window as any).NDEFReader;
    expect(isNfcSupported()).toBe(false);
  });

  it('detects when Web NFC is supported', () => {
    (window as any).NDEFReader = class {};
    expect(isNfcSupported()).toBe(true);
  });

  it('returns graceful error when writeNfcUrl called without Web NFC support', async () => {
    delete (window as any).NDEFReader;
    const res = await writeNfcUrl('https://music.example.com/login');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Web NFC is not supported');
  });

  it('writes NDEF url record when Web NFC is available', async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    (window as any).NDEFReader = class {
      write = mockWrite;
    };

    const res = await writeNfcUrl('https://music.example.com/login?mode=signup&invite=test123');
    expect(res.success).toBe(true);
    expect(mockWrite).toHaveBeenCalledWith(
      {
        records: [
          {
            recordType: 'url',
            data: 'https://music.example.com/login?mode=signup&invite=test123',
          },
        ],
      },
      { signal: undefined },
    );
  });

  it('handles write errors gracefully', async () => {
    (window as any).NDEFReader = class {
      write = vi.fn().mockRejectedValue(new Error('NFC permission denied'));
    };

    const res = await writeNfcUrl('https://music.example.com/login');
    expect(res.success).toBe(false);
    expect(res.error).toBe('NFC permission denied');
  });
});
