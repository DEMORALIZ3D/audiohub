/**
 * Web NFC Utility for Azify Admin Instant Tap-to-Invite / Tap-to-Share
 * Uses the W3C Web NFC API (NDEFReader) supported in Android Chrome.
 */

export const isNfcSupported = (): boolean => {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
};

export interface NfcWriteResult {
  success: boolean;
  error?: string;
}

/**
 * Write a URL record to an NFC tag or tap directly phone-to-phone.
 */
export const writeNfcUrl = async (url: string, signal?: AbortSignal): Promise<NfcWriteResult> => {
  if (!isNfcSupported()) {
    return {
      success: false,
      error: 'Web NFC is not supported in this browser. Use Android Chrome or scan the QR code.',
    };
  }

  try {
    const ndef = new (window as any).NDEFReader();
    await ndef.write(
      {
        records: [
          {
            recordType: 'url',
            data: url,
          },
        ],
      },
      { signal },
    );

    // Haptic success confirmation
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 150]);
    }

    return { success: true };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'aborted' };
    }
    console.error('NFC Write Error:', err);
    return {
      success: false,
      error:
        err.message || 'Failed to transmit NFC payload. Please ensure NFC is enabled in settings.',
    };
  }
};
