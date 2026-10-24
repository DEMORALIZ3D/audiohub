import {
  ArrowLeft,
  ChevronDown,
  Heart,
  Layout,
  Loader2,
  Maximize2,
  Minimize2,
  Music2,
  Pause,
  PictureInPicture2,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react';
import type React from 'react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { usePlayer, type VisualizerTheme } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';
import { ProgressBar } from './ProgressBar';
import { TypeGPUCanvas } from './TypeGPUCanvas';
import { VideoPlayerView } from './VideoPlayerView';
import type { CameraPreset, TurntableEnvironment } from './VinylVisualizer';
import { VisualizerErrorBoundary } from './VisualizerErrorBoundary';
import { WebGLCanvas } from './WebGLCanvas';

// Lazy-load Three.js VinylVisualizer so it only downloads when turntable/vinyl is selected
const LazyVinylVisualizer = lazy(() =>
  import('./VinylVisualizer').then((m) => ({ default: m.VinylVisualizer })),
);

interface VisualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ArtLayoutMode = 'corner' | 'center' | 'hidden';

const THEMES: { id: VisualizerTheme; label: string; icon: string; experimental?: boolean }[] = [
  { id: 'turntable', label: '3D Turntable Hi-Fi', icon: '🎛️' },
  { id: 'vinyl_only', label: '12" Vinyl Record (Macro)', icon: '💿' },
  { id: 'bars', label: 'Spectrum Bars', icon: '📊' },
  { id: 'starfield', label: 'Cosmic Starfield', icon: '✨' },
  { id: 'liquid', label: 'Liquid Aurora', icon: '🌊' },
  { id: 'synthwave', label: 'Synthwave Horizon', icon: '🌅' },
  { id: 'wormhole', label: 'Hyperspace Tunnel', icon: '🌀' },
  { id: 'quantum', label: 'Quantum Singularity (TypeGPU)', icon: '⚡', experimental: true },
];

const TURNTABLE_ENVIRONMENTS: { id: TurntableEnvironment; label: string; icon: string }[] = [
  { id: 'lounge', label: 'Warm Lounge', icon: '☕' },
  { id: 'neon', label: 'Neon Loft', icon: '🌃' },
  { id: 'sunset', label: 'Golden Hour', icon: '🌅' },
  { id: 'studio', label: 'Studio Room', icon: '🎙️' },
  { id: 'minimal', label: 'Minimal Void', icon: '🌑' },
];

export const VisualizerModal: React.FC<VisualizerModalProps> = ({ isOpen, onClose }) => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    currentTime,
    duration,
    seek,
    toggleLike,
    isTrackLiked,
    visualizerTheme,
    setVisualizerTheme,
    currentPalette,
    videoDisplayMode,
    setVideoDisplayMode,
    toggleVideoMode,
    canPlayVideo,
    youtubeVideoId,
    networkInfo,
  } = usePlayer();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [artLayout, setArtLayout] = useState<ArtLayoutMode>('corner');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [controlsHovered, setControlsHovered] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('turntable');

  const [turntableEnv, setTurntableEnvState] = useState<TurntableEnvironment>(() => {
    try {
      const saved = localStorage.getItem('audiohub_turntable_env');
      if (saved && ['lounge', 'neon', 'sunset', 'studio', 'minimal'].includes(saved)) {
        return saved as TurntableEnvironment;
      }
    } catch {}
    return 'lounge';
  });

  const setTurntableEnv = (env: TurntableEnvironment) => {
    setTurntableEnvState(env);
    try {
      localStorage.setItem('audiohub_turntable_env', env);
    } catch {}
  };

  const hideTimerRef = useRef<number | null>(null);

  const isLiked = isTrackLiked(currentTrack);
  const currentThemeObj = THEMES.find((t) => t.id === visualizerTheme) || THEMES[0];
  const isVinylMode = visualizerTheme === 'turntable' || visualizerTheme === 'vinyl_only';

  const handleUserActivity = () => {
    setControlsHovered(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setControlsHovered(false);
      setShowThemeMenu(false);
    }, 4500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const cycleArtLayout = () => {
    setArtLayout((prev) => {
      if (prev === 'corner') return 'hidden';
      if (prev === 'hidden') return 'center';
      return 'corner';
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, togglePlay, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Background Stage: Full-bleed Video OR WebGL / TypeGPU / Lazy 3D Vinyl */}
      {canPlayVideo && youtubeVideoId && videoDisplayMode !== 'off' ? (
        <VideoPlayerView
          videoId={youtubeVideoId}
          title={currentTrack?.title}
          artist={currentTrack?.artist}
          startTime={currentTime}
          mode={videoDisplayMode}
        />
      ) : (
        <div className="absolute inset-0 z-0">
          <VisualizerErrorBoundary
            theme={visualizerTheme}
            onResetTheme={(target = 'turntable') => setVisualizerTheme(target)}
          >
            {visualizerTheme === 'quantum' ? (
              <TypeGPUCanvas className="w-full h-full" />
            ) : isVinylMode ? (
              <Suspense
                fallback={
                  <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white/70 gap-3">
                    <Loader2 className="w-8 h-8 text-spotify-green animate-spin" />
                    <span className="text-xs font-medium tracking-wider uppercase font-mono">
                      Loading 3D Turntable Scene...
                    </span>
                  </div>
                }
              >
                <LazyVinylVisualizer
                  mode={visualizerTheme}
                  cameraPreset={cameraPreset}
                  environment={turntableEnv}
                  onCameraPresetChange={setCameraPreset}
                  className="w-full h-full"
                />
              </Suspense>
            ) : (
              <WebGLCanvas theme={visualizerTheme} />
            )}
          </VisualizerErrorBoundary>
          {!isVinylMode && (
            <div className="absolute inset-0 bg-radial-vignette pointer-events-none opacity-40" />
          )}
        </div>
      )}

      {/* Top Header Bar - Mobile-first, responsive and never squashed */}
      <div
        className={`relative z-20 px-3 sm:px-6 py-2 sm:py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] flex items-center justify-between gap-2 max-w-full transition-opacity duration-300 ${
          controlsHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Left: Dedicated Exit/Back Button */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-full bg-black/60 hover:bg-red-500/80 active:scale-95 text-white font-bold text-xs backdrop-blur-xl border border-white/15 shadow-xl transition-all"
            title="Exit Stage (Esc)"
          >
            <ArrowLeft className="w-4 h-4 text-spotify-green" />
            <span className="hidden sm:inline font-semibold text-xs">Exit</span>
            <kbd className="hidden md:inline-block ml-0.5 px-1.5 py-0.2 text-[9px] font-mono bg-black/40 text-white/70 rounded border border-white/10">
              ESC
            </kbd>
          </button>

          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10"
            style={{ borderColor: currentPalette.primary }}
          >
            <Sparkles className="w-3.5 h-3.5 text-spotify-green animate-pulse" />
            <span className="text-[11px] font-bold text-white tracking-wider uppercase">Stage</span>
          </div>
        </div>

        {/* Center: Mode Switcher + Compact Theme Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 justify-center">
          {canPlayVideo && (
            <>
              {/* Desktop 3-Mode Pill */}
              <div className="hidden sm:flex items-center gap-0.5 bg-black/70 backdrop-blur-md p-0.5 rounded-full border border-white/10 shadow-lg text-xs">
                <button
                  onClick={() => setVideoDisplayMode('off')}
                  className={`px-2.5 py-1 rounded-full font-bold transition-all text-xs ${
                    videoDisplayMode === 'off'
                      ? 'bg-white text-black shadow'
                      : 'text-spotify-gray hover:text-white'
                  }`}
                  title="Shader Visualizer Mode"
                >
                  ⚡ Visualizer
                </button>
                <button
                  onClick={() => setVideoDisplayMode('backdrop')}
                  className={`px-2.5 py-1 rounded-full font-bold transition-all text-xs ${
                    videoDisplayMode === 'backdrop'
                      ? 'bg-spotify-green text-black shadow'
                      : 'text-spotify-gray hover:text-white'
                  }`}
                  title="Video Background behind Visualizer/Art"
                >
                  🖼️ Backdrop
                </button>
                <button
                  onClick={() => setVideoDisplayMode('cover')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-bold transition-all text-xs ${
                    videoDisplayMode === 'cover'
                      ? 'bg-spotify-green text-black shadow'
                      : 'text-spotify-gray hover:text-white'
                  }`}
                  title="Full Video Mode"
                >
                  <span>🎬 Video</span>
                  {networkInfo.isWifiOrFast && (
                    <span className="text-[8px] px-1 bg-black/40 rounded font-mono font-bold">
                      HD
                    </span>
                  )}
                </button>
              </div>

              {/* Mobile Single Cycle Pill (Prevents Squashing) */}
              <button
                onClick={toggleVideoMode}
                className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/70 backdrop-blur-xl border border-white/15 text-[11px] font-bold text-white shadow-md active:scale-95"
                title="Toggle Video Mode (Tap to cycle)"
              >
                <span>
                  {videoDisplayMode === 'off'
                    ? '⚡ Viz'
                    : videoDisplayMode === 'backdrop'
                      ? '🖼️ Back'
                      : '🎬 Vid'}
                </span>
              </button>
            </>
          )}

          {/* Theme Dropdown */}
          {videoDisplayMode === 'off' && (
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-xl text-xs font-semibold text-white border border-white/15 shadow-md active:scale-95 transition-all"
                title="Change Visualizer Theme"
              >
                <span>{currentThemeObj.icon}</span>
                <span className="max-w-[105px] sm:max-w-[150px] truncate">
                  {currentThemeObj.label}
                </span>
                {currentThemeObj.experimental && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-mono hidden sm:inline-block">
                    Exp
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-white/70" />
              </button>

              {showThemeMenu && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 sm:w-64 max-h-[60vh] overflow-y-auto bg-[#18181c] rounded-2xl shadow-2xl border border-white/15 p-1.5 z-50 flex flex-col gap-1 animate-fadeIn">
                  <div className="px-3 py-1 text-[10px] font-bold text-spotify-gray uppercase tracking-wider">
                    Select Visualizer
                  </div>
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setVisualizerTheme(t.id);
                        setShowThemeMenu(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                        visualizerTheme === t.id
                          ? 'bg-spotify-green text-black font-bold shadow'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span className="text-sm shrink-0">{t.icon}</span>
                      <span className="truncate flex-1">{t.label}</span>
                      {t.experimental && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                            visualizerTheme === t.id
                              ? 'bg-black/20 text-black font-mono'
                              : 'bg-amber-500/25 text-amber-300 border border-amber-500/40 font-mono'
                          }`}
                        >
                          Experimental
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {videoDisplayMode !== 'cover' && !isVinylMode && (
            <button
              onClick={cycleArtLayout}
              title={`Album Art: ${artLayout.toUpperCase()}`}
              className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white/80 hover:text-white text-xs font-semibold border border-white/10 transition-all active:scale-95"
            >
              <Layout className="w-3.5 h-3.5 text-spotify-green" />
              <span className="capitalize hidden sm:inline">{artLayout} Art</span>
            </button>
          )}

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('audiohub-toggle-popout'))}
            title="Popout Mini Player (Picture-in-Picture)"
            className="hidden md:flex p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white/80 hover:text-white transition-all border border-white/10 active:scale-95"
          >
            <PictureInPicture2 className="w-4 h-4 text-spotify-green" />
          </button>

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="hidden md:flex p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white/80 hover:text-white transition-all border border-white/10"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            title="Close Visualizer Stage (Esc)"
            className="hidden sm:flex p-2 rounded-full bg-black/60 hover:bg-red-500/80 backdrop-blur-md text-white/80 hover:text-white transition-all border border-white/10 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Persistent Exit Button */}
      {!controlsHovered && (
        <button
          onClick={onClose}
          className="fixed top-3 left-3 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 hover:bg-black/90 text-white/70 hover:text-white text-xs font-semibold backdrop-blur-md border border-white/10 shadow-lg opacity-60 hover:opacity-100 transition-opacity"
          title="Exit Stage (Esc)"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-spotify-green" />
          <span>Exit Stage</span>
        </button>
      )}

      {/* Center Stage: When user selects 'center' art mode and not in vinyl mode */}
      {videoDisplayMode !== 'cover' && artLayout === 'center' && currentTrack && !isVinylMode && (
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 my-auto pointer-events-none animate-fadeIn">
          <div className="relative group pointer-events-auto">
            <div
              className={`absolute -inset-4 rounded-full blur-2xl opacity-50 transition-all duration-700 ${
                isPlaying ? 'scale-105 animate-pulse' : 'scale-90 opacity-20'
              }`}
              style={{
                backgroundColor: currentPalette.primary,
                boxShadow: `0 0 60px ${currentPalette.accent}`,
              }}
            />

            <div
              className={`relative w-40 h-40 sm:w-52 sm:h-52 rounded-2xl overflow-hidden shadow-2xl border border-white/15 transition-transform duration-500 ${
                isPlaying ? 'scale-100' : 'scale-95 opacity-80'
              }`}
            >
              {currentTrack.cover_url ? (
                <img
                  src={currentTrack.cover_url}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#181818] flex items-center justify-center">
                  <Music2 className="w-16 h-16 text-white/20" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pointer-events-auto max-w-md">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow truncate">
              {currentTrack.title}
            </h1>
            <p
              className="text-sm sm:text-base font-medium text-white/80 mt-0.5 drop-shadow truncate"
              style={{ color: currentPalette.accent }}
            >
              {currentTrack.artist}
            </p>
          </div>
        </div>
      )}

      {/* Corner Docked Album Art (Hidden in vinyl mode) */}
      {videoDisplayMode !== 'cover' && artLayout === 'corner' && currentTrack && !isVinylMode && (
        <div
          className={`fixed bottom-24 left-4 z-20 hidden sm:flex items-center gap-3 p-2.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl max-w-[280px] sm:max-w-sm transition-opacity duration-300 ${
            controlsHovered ? 'opacity-100' : 'opacity-40 hover:opacity-100'
          }`}
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shadow-md flex-shrink-0 border border-white/10">
            {currentTrack.cover_url ? (
              <img
                src={currentTrack.cover_url}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#181818] flex items-center justify-center">
                <Music2 className="w-6 h-6 text-white/20" />
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0 pr-1">
            <h2 className="text-sm font-bold text-white truncate drop-shadow">
              {currentTrack.title}
            </h2>
            <p
              className="text-xs text-white/70 truncate mt-0.5"
              style={{ color: currentPalette.accent }}
            >
              {currentTrack.artist}
            </p>
            {currentTrack.album && (
              <p className="text-[10px] text-white/40 truncate mt-0.5">{currentTrack.album}</p>
            )}
          </div>
        </div>
      )}

      {/* Bottom Floating Control Bar */}
      <div
        className={`relative z-20 px-3 sm:px-6 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom,12px))] flex flex-col items-center gap-2 transition-opacity duration-300 ${
          controlsHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Compact 1-line track info pill */}
        {currentTrack && (
          <div className="flex items-center justify-center max-w-sm sm:max-w-md px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-center shadow-lg pointer-events-auto">
            <span className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[200px]">
              {currentTrack.title}
            </span>
            <span className="text-[10px] text-white/40 mx-1.5">•</span>
            <span
              className="text-xs font-medium text-white/80 truncate max-w-[110px] sm:max-w-[180px]"
              style={{ color: currentPalette.accent }}
            >
              {currentTrack.artist}
            </span>
          </div>
        )}

        {/* Turntable 3D Scene Environment & Camera Controls */}
        {isVinylMode && (
          <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
            {/* 3D Scene Environment Switcher */}
            <div className="flex items-center gap-1 p-0.5 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 shadow-lg max-w-[94vw] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TURNTABLE_ENVIRONMENTS.map((env) => (
                <button
                  key={env.id}
                  onClick={() => setTurntableEnv(env.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold transition-all whitespace-nowrap ${
                    turntableEnv === env.id
                      ? 'bg-white/20 text-white font-bold border border-white/20 shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title={`${env.label} 3D Lighting & Room Atmosphere`}
                >
                  <span className="text-[11px] sm:text-xs">{env.icon}</span>
                  <span>{env.label}</span>
                </button>
              ))}
            </div>

            {/* Camera View Switcher */}
            <div className="flex items-center gap-1 p-0.5 sm:p-1 bg-black/70 backdrop-blur-xl rounded-full border border-white/15 shadow-xl">
              <button
                onClick={() => setCameraPreset('turntable')}
                className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${
                  cameraPreset === 'turntable'
                    ? 'bg-spotify-green text-black font-bold shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title="Full Turntable Hi-Fi Isometric View"
              >
                🎛️ Turntable
              </button>
              <button
                onClick={() => setCameraPreset('macro')}
                className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${
                  cameraPreset === 'macro'
                    ? 'bg-spotify-green text-black font-bold shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title="Stylus Needle & Micro-Groove Close-up View"
              >
                🔍 Stylus
              </button>
              <button
                onClick={() => setCameraPreset('overhead')}
                className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${
                  cameraPreset === 'overhead'
                    ? 'bg-spotify-green text-black font-bold shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title="Top-Down Overhead Wax View"
              >
                💿 Overhead
              </button>
            </div>
          </div>
        )}

        {/* Scrubber Bar */}
        <div className="w-full max-w-xl flex items-center gap-2 sm:gap-3 bg-black/60 backdrop-blur-xl px-3 sm:px-4 py-1 sm:py-2 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
          <span className="text-[10px] sm:text-[11px] font-mono text-white/70 min-w-[30px] sm:min-w-[36px]">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1">
            <ProgressBar currentTime={currentTime} duration={duration} onSeek={seek} size="md" />
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono text-white/70 min-w-[30px] sm:min-w-[36px]">
            {formatTime(duration)}
          </span>
        </div>

        {/* Media Control Buttons */}
        <div className="flex items-center gap-2.5 sm:gap-5 bg-black/60 backdrop-blur-xl px-3 sm:px-6 py-1 sm:py-2 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
          {currentTrack && (
            <button
              onClick={() => toggleLike(currentTrack)}
              className="p-1.5 sm:p-2 text-white/70 hover:text-red-500 transition-colors"
              title={isLiked ? 'Unlike' : 'Like'}
            >
              <Heart
                className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${
                  isLiked ? 'text-spotify-green fill-spotify-green' : ''
                }`}
              />
            </button>
          )}

          <button
            onClick={prevTrack}
            className="p-1.5 sm:p-2 text-white/80 hover:text-white transition-all hover:scale-110 active:scale-95"
            title="Previous"
          >
            <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={togglePlay}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-xl"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-1.5 sm:p-2 text-white/80 hover:text-white transition-all hover:scale-110 active:scale-95"
            title="Next"
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
