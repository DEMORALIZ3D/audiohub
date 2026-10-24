import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupWizardView } from './SetupWizardView';

// Mock PlayerContext for AzifyLogoMark
vi.mock('../context/PlayerContext', () => ({
  usePlayer: () => ({
    isPlaying: false,
  }),
}));

// Mock branding config
const mockFetchServerBranding = vi.fn().mockResolvedValue({});
vi.mock('../config/branding', () => ({
  fetchServerBranding: () => mockFetchServerBranding(),
  useBranding: () => ({
    appName: 'AudioHub',
    appShortName: 'AudioHub',
    tagline: 'homelab entertainment',
    logoUrl: '/icon.svg',
    themeColor: '#10b981',
    accentColor: '#1ed760',
    poweredBy: 'AudioHub',
  }),
}));

describe('SetupWizardView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default fetch mock
    globalThis.fetch = vi.fn();
  });

  it('renders Step 1 with default server branding fields and live preview', () => {
    render(<SetupWizardView />);

    expect(screen.getByText('Brand Your Server')).toBeInTheDocument();
    expect(screen.getByTestId('setup-app-name')).toHaveValue('AudioHub');
    expect(screen.getByTestId('setup-tagline')).toBeInTheDocument();
    expect(screen.getByText('Live Preview')).toBeInTheDocument();
    expect(screen.getByTestId('setup-continue-step1')).toBeInTheDocument();
  });

  it('allows updating branding fields and advancing to Step 2', async () => {
    render(<SetupWizardView />);

    const appNameInput = screen.getByTestId('setup-app-name');
    const taglineInput = screen.getByTestId('setup-tagline');
    const continueBtn = screen.getByTestId('setup-continue-step1');

    fireEvent.change(appNameInput, { target: { value: 'GroovyTunes' } });
    fireEvent.change(taglineInput, { target: { value: 'Infinite Lossless Beats' } });

    fireEvent.click(continueBtn);

    // Should now be on Step 2
    expect(screen.getByText('Create Super Admin')).toBeInTheDocument();
    expect(screen.getByTestId('setup-username')).toBeInTheDocument();
    expect(screen.getByTestId('setup-password')).toBeInTheDocument();
    expect(screen.getByTestId('setup-confirm-password')).toBeInTheDocument();
  });

  it('navigates back from Step 2 to Step 1 when clicking Back', () => {
    render(<SetupWizardView />);

    // Go to Step 2
    fireEvent.click(screen.getByTestId('setup-continue-step1'));
    expect(screen.getByText('Create Super Admin')).toBeInTheDocument();

    // Click Back
    const backBtn = screen.getByText('Back');
    fireEvent.click(backBtn);

    // Should be on Step 1 again with preserved values
    expect(screen.getByText('Brand Your Server')).toBeInTheDocument();
    expect(screen.getByTestId('setup-app-name')).toHaveValue('AudioHub');
  });

  it('validates password mismatch on Step 2', async () => {
    render(<SetupWizardView />);

    // Go to Step 2
    fireEvent.click(screen.getByTestId('setup-continue-step1'));

    fireEvent.change(screen.getByTestId('setup-username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByTestId('setup-password'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByTestId('setup-confirm-password'), {
      target: { value: 'different123' },
    });

    fireEvent.click(screen.getByTestId('setup-submit-btn'));

    expect(await screen.findByTestId('setup-error-banner')).toHaveTextContent(
      'Passwords do not match',
    );
  });

  it('validates short username or short password on Step 2', async () => {
    render(<SetupWizardView />);

    // Go to Step 2
    fireEvent.click(screen.getByTestId('setup-continue-step1'));

    fireEvent.change(screen.getByTestId('setup-username'), { target: { value: 'ab' } });
    fireEvent.change(screen.getByTestId('setup-password'), { target: { value: '123' } });
    fireEvent.change(screen.getByTestId('setup-confirm-password'), { target: { value: '123' } });

    fireEvent.click(screen.getByTestId('setup-submit-btn'));

    expect(await screen.findByTestId('setup-error-banner')).toHaveTextContent(
      'Username must be at least 3 characters',
    );
  });

  it('handles backend setup errors gracefully', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ detail: 'Setup already completed. Please log in.' }),
    });

    render(<SetupWizardView />);

    // Advance to Step 2
    fireEvent.click(screen.getByTestId('setup-continue-step1'));

    fireEvent.change(screen.getByTestId('setup-username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByTestId('setup-password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByTestId('setup-confirm-password'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByTestId('setup-submit-btn'));

    expect(await screen.findByTestId('setup-error-banner')).toHaveTextContent(
      'Setup already completed. Please log in.',
    );
  });

  it('completes the entire setup wizard and calls onComplete upon launch', async () => {
    const mockUser = {
      id: 'super-admin-uuid-1234',
      username: 'alex',
      email: 'alex@audiohub.local',
      display_name: 'Alex Rivera',
      role: 'super_admin',
      is_admin: true,
      is_active: true,
    };

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        status: 'completed',
        user: mockUser,
        token: 'super-admin-uuid-1234',
      }),
    });

    const mockOnComplete = vi.fn();
    render(<SetupWizardView onComplete={mockOnComplete} />);

    // Step 1: Customize branding
    fireEvent.change(screen.getByTestId('setup-app-name'), { target: { value: 'SonicTunes' } });
    fireEvent.change(screen.getByTestId('setup-tagline'), { target: { value: 'Hi-Fi Master' } });
    fireEvent.click(screen.getByTestId('setup-continue-step1'));

    // Step 2: Fill owner info
    fireEvent.change(screen.getByTestId('setup-username'), { target: { value: 'alex' } });
    fireEvent.change(
      screen.getByTestId(
        'setup-display_name' in screen ? 'setup-display-name' : 'setup-display-name',
      ),
      {
        target: { value: 'Alex Rivera' },
      },
    );
    fireEvent.change(screen.getByTestId('setup-email'), {
      target: { value: 'alex@audiohub.local' },
    });
    fireEvent.change(screen.getByTestId('setup-password'), {
      target: { value: 'StrongAdminPass123!' },
    });
    fireEvent.change(screen.getByTestId('setup-confirm-password'), {
      target: { value: 'StrongAdminPass123!' },
    });

    // Submit setup
    fireEvent.click(screen.getByTestId('setup-submit-btn'));

    // Step 3: Finish & Launch screen should render
    await waitFor(() => {
      expect(screen.getByText("You're Ready to Stream!")).toBeInTheDocument();
    });

    // Check localStorage user id
    expect(localStorage.getItem('audiohub_user_id')).toBe('super-admin-uuid-1234');
    expect(mockFetchServerBranding).toHaveBeenCalled();

    // Check summary card
    expect(screen.getAllByText('SonicTunes').length).toBeGreaterThan(0);
    expect(screen.getByText('Alex Rivera (@alex)')).toBeInTheDocument();

    // Launch app
    const launchBtn = screen.getByTestId('setup-launch-app-btn');
    fireEvent.click(launchBtn);

    expect(mockOnComplete).toHaveBeenCalledWith(mockUser);
  });
});
