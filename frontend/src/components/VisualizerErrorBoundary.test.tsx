import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { drawRoundRect } from '../utils/canvasPolyfill';
import { VisualizerErrorBoundary } from './VisualizerErrorBoundary';

vi.mock('../context/PlayerContext', () => ({
  usePlayer: () => ({
    getAudioMetrics: () => ({
      bass: 0.5,
      mid: 0.4,
      treble: 0.3,
      energy: 0.6,
      frequencyData: new Uint8Array(256),
    }),
    currentPalette: {
      primary: '#1ed760',
      secondary: '#1db954',
      accent: '#22c55e',
      rgb: [30, 215, 96],
    },
    isPlaying: true,
  }),
}));

// Component that throws on render
const CrashingComponent = () => {
  throw new Error('WebGL hardware crash simulation');
};

const WorkingComponent = () => {
  return <div data-testid="working-visualizer">Normal Visualizer</div>;
};

describe('VisualizerErrorBoundary', () => {
  it('renders children normally when there is no error', () => {
    render(
      <VisualizerErrorBoundary theme="bars">
        <WorkingComponent />
      </VisualizerErrorBoundary>,
    );

    expect(screen.getByTestId('working-visualizer')).toBeInTheDocument();
  });

  it('catches crashes and renders fallback without crashing the app', () => {
    // Suppress console.error during expected boundary test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <VisualizerErrorBoundary theme="synthwave">
        <CrashingComponent />
      </VisualizerErrorBoundary>,
    );

    expect(screen.getByText(/Display fallback active/i)).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('allows retry and calls onResetTheme', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handleReset = vi.fn();

    render(
      <VisualizerErrorBoundary theme="synthwave" onResetTheme={handleReset}>
        <CrashingComponent />
      </VisualizerErrorBoundary>,
    );

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);

    expect(handleReset).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it('allows switching directly to 3D Turntable from fallback banner', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handleReset = vi.fn();

    render(
      <VisualizerErrorBoundary theme="synthwave" onResetTheme={handleReset}>
        <CrashingComponent />
      </VisualizerErrorBoundary>,
    );

    const turntableBtn = screen.getByRole('button', { name: /3D Turntable/i });
    expect(turntableBtn).toBeInTheDocument();
    fireEvent.click(turntableBtn);

    expect(handleReset).toHaveBeenCalledWith('turntable');
    consoleSpy.mockRestore();
  });
});

describe('canvasPolyfill', () => {
  it('drawRoundRect works with or without native ctx.roundRect', () => {
    const mockCtx = {
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    drawRoundRect(mockCtx, 10, 10, 50, 50, 5);
    expect(mockCtx.roundRect).toHaveBeenCalledWith(10, 10, 50, 50, 5);

    // Test fallback path when roundRect is undefined
    const mockLegacyCtx = {
      roundRect: undefined,
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    drawRoundRect(mockLegacyCtx, 10, 10, 50, 50, 5);
    expect(mockLegacyCtx.moveTo).toHaveBeenCalled();
    expect(mockLegacyCtx.quadraticCurveTo).toHaveBeenCalled();
    expect(mockLegacyCtx.closePath).toHaveBeenCalled();
  });
});
