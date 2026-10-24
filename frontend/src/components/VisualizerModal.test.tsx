import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualizerModal } from './VisualizerModal';

const mockSetVisualizerTheme = vi.fn();
const mockTogglePlay = vi.fn();
const mockNextTrack = vi.fn();
const mockPrevTrack = vi.fn();
const mockSeek = vi.fn();
const mockToggleLike = vi.fn();

vi.mock('./WebGLCanvas', () => ({
  WebGLCanvas: ({ theme }: { theme: string }) => <div data-testid={`webgl-canvas-${theme}`} />,
}));

vi.mock('./TypeGPUCanvas', () => ({
  TypeGPUCanvas: () => <div data-testid="typegpu-canvas" />,
}));

vi.mock('./VinylVisualizer', () => ({
  VinylVisualizer: ({ mode }: { mode: string }) => <div data-testid={`vinyl-visualizer-${mode}`} />,
}));

vi.mock('./VideoPlayerView', () => ({
  VideoPlayerView: () => <div data-testid="video-player-view" />,
}));

vi.mock('./ProgressBar', () => ({
  ProgressBar: () => <div data-testid="progress-bar" />,
}));

let currentTheme = 'turntable';

vi.mock('../context/PlayerContext', () => ({
  usePlayer: () => ({
    currentTrack: {
      id: 'track-1',
      title: 'Echoes in the Dark',
      artist: 'Pink Floyd',
      album: 'Meddle',
      duration: 360,
      cover_url: 'https://example.com/cover.jpg',
    },
    isPlaying: true,
    togglePlay: mockTogglePlay,
    nextTrack: mockNextTrack,
    prevTrack: mockPrevTrack,
    currentTime: 120,
    duration: 360,
    seek: mockSeek,
    toggleLike: mockToggleLike,
    isTrackLiked: () => false,
    visualizerTheme: currentTheme,
    setVisualizerTheme: mockSetVisualizerTheme,
    currentPalette: {
      primary: '#1ed760',
      secondary: '#1db954',
      accent: '#22c55e',
      rgb: [30, 215, 96],
    },
    videoDisplayMode: 'off',
    setVideoDisplayMode: vi.fn(),
    toggleVideoMode: vi.fn(),
    canPlayVideo: false,
    youtubeVideoId: null,
    networkInfo: { isWifiOrFast: true },
    getAudioMetrics: () => ({
      bass: 0.5,
      mid: 0.4,
      treble: 0.3,
      energy: 0.6,
      frequencyData: new Uint8Array(256),
    }),
  }),
}));

describe('VisualizerModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTheme = 'turntable';
  });

  it('renders correctly when open with default turntable theme', async () => {
    await act(async () => {
      render(<VisualizerModal isOpen={true} onClose={vi.fn()} />);
    });

    expect(await screen.findByText('3D Turntable Hi-Fi')).toBeInTheDocument();
    expect(screen.getByText('Echoes in the Dark')).toBeInTheDocument();
    expect(screen.getByText('Pink Floyd')).toBeInTheDocument();
  });

  it('prioritizes rock-solid themes and marks quantum as experimental', async () => {
    await act(async () => {
      render(<VisualizerModal isOpen={true} onClose={vi.fn()} />);
    });

    // Click theme dropdown button
    const themeBtn = screen.getByTitle('Change Visualizer Theme');
    fireEvent.click(themeBtn);

    // Verify prioritized themes in dropdown
    const dropdown = screen.getByText('Select Visualizer').parentElement!;
    const buttons = dropdown.querySelectorAll('button');
    const labels = Array.from(buttons).map((btn) => btn.textContent || '');

    // Check first 5 are rock-solid themes
    expect(labels[0]).toContain('3D Turntable Hi-Fi');
    expect(labels[1]).toContain('12" Vinyl Record (Macro)');
    expect(labels[2]).toContain('Spectrum Bars');
    expect(labels[3]).toContain('Cosmic Starfield');
    expect(labels[4]).toContain('Liquid Aurora');

    // Check quantum is marked experimental
    expect(labels[7]).toContain('Quantum Singularity (TypeGPU)');
    expect(labels[7]).toContain('Experimental');
  });

  it('calls setVisualizerTheme when selecting a theme from the menu', async () => {
    await act(async () => {
      render(<VisualizerModal isOpen={true} onClose={vi.fn()} />);
    });

    const themeBtn = screen.getByTitle('Change Visualizer Theme');
    fireEvent.click(themeBtn);

    const barsOption = screen.getByRole('button', { name: /Spectrum Bars/i });
    fireEvent.click(barsOption);

    expect(mockSetVisualizerTheme).toHaveBeenCalledWith('bars');
  });

  it('invokes onClose when ESC key is pressed', async () => {
    const handleClose = vi.fn();
    await act(async () => {
      render(<VisualizerModal isOpen={true} onClose={handleClose} />);
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
