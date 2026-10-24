import { AlertTriangle, RefreshCw } from 'lucide-react';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import type { VisualizerTheme } from '../context/PlayerContext';
import { WebGLCanvas } from './WebGLCanvas';

interface Props {
  children: ReactNode;
  theme?: VisualizerTheme;
  onResetTheme?: (theme?: VisualizerTheme) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class VisualizerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Visualizer caught in ErrorBoundary:', error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.theme !== this.props.theme) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative w-full h-full">
          {/* Safe 2D canvas fallback */}
          <WebGLCanvas theme="bars" className="w-full h-full" />
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col sm:flex-row items-center gap-2 sm:gap-3 px-4 py-2 rounded-2xl bg-black/85 backdrop-blur-xl border border-amber-500/40 text-amber-200 text-xs shadow-2xl animate-fadeIn max-w-[92vw]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Display fallback active (visualizer recovered safely)</span>
            </div>
            {this.props.onResetTheme && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: undefined });
                    this.props.onResetTheme?.('turntable');
                  }}
                  className="px-2.5 py-1 rounded-full bg-spotify-green hover:bg-spotify-green-hover text-black font-semibold text-[11px] shadow-sm active:scale-95 transition-all"
                  title="Switch to 3D Turntable"
                >
                  3D Turntable
                </button>
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: undefined });
                    this.props.onResetTheme?.('bars');
                  }}
                  className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 text-[11px] active:scale-95 transition-all"
                  title="Retry Visualizer"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
