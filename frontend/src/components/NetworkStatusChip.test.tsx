import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkStatusChip } from './NetworkStatusChip';

let mockPlayerState = {
  currentTrack: {
    id: 'track-1',
    title: 'Neon Nights',
    artist: 'Synthetix',
    duration: 210,
  } as any,
  currentTime: 75,
  isPlaying: false,
  retryCurrentTrack: vi.fn(),
  audioError: null as string | null,
};

vi.mock('../context/PlayerContext', () => ({
  usePlayer: () => mockPlayerState,
}));

describe('NetworkStatusChip', () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayerState = {
      currentTrack: {
        id: 'track-1',
        title: 'Neon Nights',
        artist: 'Synthetix',
        duration: 210,
      },
      currentTime: 75,
      isPlaying: false,
      retryCurrentTrack: vi.fn(),
      audioError: null,
    };
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  describe('When isPlaying is true', () => {
    it('NEVER renders an offline banner even if navigator.onLine is false', () => {
      mockPlayerState.isPlaying = true;
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });

      render(<NetworkStatusChip />);

      expect(screen.queryByTestId('network-status-chip')).not.toBeInTheDocument();
      expect(screen.queryByText(/No Network Connection/i)).not.toBeInTheDocument();
    });

    it('NEVER renders an error banner even if audioError is set', () => {
      mockPlayerState.isPlaying = true;
      mockPlayerState.audioError = 'Stream buffer underrun';

      render(<NetworkStatusChip />);

      expect(screen.queryByTestId('network-status-chip')).not.toBeInTheDocument();
      expect(screen.queryByText(/Stream buffer underrun/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Retry Now/i)).not.toBeInTheDocument();
    });

    it('NEVER renders offline or error banner when both offline and audioError occur during playback', () => {
      mockPlayerState.isPlaying = true;
      mockPlayerState.audioError = 'Network packet drop';
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });

      render(<NetworkStatusChip />);

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(screen.queryByTestId('network-status-chip')).not.toBeInTheDocument();
      expect(screen.queryByText(/No Network Connection/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Network packet drop/i)).not.toBeInTheDocument();
    });
  });

  describe('When paused and genuinely offline', () => {
    it('renders user-friendly connection banner when navigator.onLine is false', () => {
      mockPlayerState.isPlaying = false;
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });

      render(<NetworkStatusChip />);

      const banner = screen.getByTestId('network-status-chip');
      expect(banner).toBeInTheDocument();
      expect(screen.getByText(/No Network Connection/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Now/i })).toBeInTheDocument();
    });

    it('triggers retryCurrentTrack when Retry Now button on banner is clicked', () => {
      mockPlayerState.isPlaying = false;
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });

      render(<NetworkStatusChip />);

      const retryBtn = screen.getByRole('button', { name: /Retry Now/i });
      fireEvent.click(retryBtn);

      expect(mockPlayerState.retryCurrentTrack).toHaveBeenCalledTimes(1);
    });

    it('renders connection banner on window offline event when paused and allows retry', async () => {
      mockPlayerState.isPlaying = false;
      mockPlayerState.currentTime = 84;

      // Mock failed ping to /api/v1/version
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network disconnected'));

      render(<NetworkStatusChip />);

      expect(screen.queryByTestId('network-status-chip')).not.toBeInTheDocument();

      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(screen.getByTestId('network-status-chip')).toBeInTheDocument();
      expect(screen.getByText(/No Network Connection/i)).toBeInTheDocument();
      expect(screen.getByText(/Paused at 1:24/i)).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /Retry Now/i });
      fireEvent.click(retryBtn);
      expect(mockPlayerState.retryCurrentTrack).toHaveBeenCalledTimes(1);
    });
  });
});
