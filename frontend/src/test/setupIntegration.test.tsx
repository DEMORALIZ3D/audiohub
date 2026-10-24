import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

// Mock contexts and subcomponents that interact with external services/media
vi.mock('../context/PlayerContext', () => ({
  PlayerProvider: ({ children }: any) => <div data-testid="player-provider">{children}</div>,
  usePlayer: () => ({
    isPlaying: false,
    currentTrack: null,
    queue: [],
    showVisualizer: false,
    setShowVisualizer: vi.fn(),
    showDeviceModal: false,
    setShowDeviceModal: vi.fn(),
    playTrack: vi.fn(),
  }),
}));

vi.mock('../context/CastContext', () => ({
  CastProvider: ({ children }: any) => <>{children}</>,
  useCast: () => ({ isAvailable: false, isCasting: false }),
}));

vi.mock('../context/ConnectContext', () => ({
  ConnectProvider: ({ children }: any) => <>{children}</>,
  useConnect: () => ({ isConnected: false, activeSession: null }),
}));

vi.mock('../context/SearchContext', () => ({
  SearchProvider: ({ children }: any) => <>{children}</>,
  useSearch: () => ({ query: '', setQuery: vi.fn() }),
}));

vi.mock('../context/PwaInstallContext', () => ({
  PwaInstallProvider: ({ children }: any) => <>{children}</>,
  usePwaInstall: () => ({ isInstallable: false, isAppInstalled: true }),
}));

describe('Setup Wizard App Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.location.hash = '';
  });

  it('renders SetupWizardView on first boot when setup_required is true', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/setup/status')) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            is_configured: false,
            setup_required: true,
            app_name: 'AudioHub',
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Brand Your Server')).toBeInTheDocument();
    });

    expect(screen.getByTestId('setup-app-name')).toBeInTheDocument();
  });

  it('renders LoginView when setup_required is false and user is unauthenticated', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/setup/status')) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            is_configured: true,
            setup_required: false,
            app_name: 'AudioHub',
          }),
        });
      }
      if (url.includes('/api/v1/auth/profiles')) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => [],
        });
      }
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });
    });

    render(<App />);

    await waitFor(() => {
      // In LoginView, either password or QR login tab is rendered
      expect(screen.queryByText('Brand Your Server')).not.toBeInTheDocument();
    });
  });
});
