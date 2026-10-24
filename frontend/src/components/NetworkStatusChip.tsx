import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  ShieldCheck,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';
import { type PlaybackLogEntry, playbackLogger } from '../utils/playbackLogger';

export const NetworkStatusChip: React.FC = () => {
  const { currentTrack, currentTime, isPlaying, retryCurrentTrack, audioError } = usePlayer();
  const [isOffline, setIsOffline] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const [streamHiccup, setStreamHiccup] = useState<string | null>(null);
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [logs, setLogs] = useState<PlaybackLogEntry[]>([]);
  const [pausedAtTime, setPausedAtTime] = useState<number | null>(null);

  // If audio is actively playing, dismiss any offline or hiccup indicator immediately
  useEffect(() => {
    if (isPlaying) {
      setIsOffline(false);
      setStreamHiccup(null);
      setIsReconnecting(false);
      setJustReconnected(false);
      setPausedAtTime(null);
    } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      setPausedAtTime(Math.floor(currentTime));
    }
  }, [isPlaying, currentTime]);

  // Monitor network online/offline events
  useEffect(() => {
    const handlePlaybackHealthy = () => {
      setIsOffline(false);
      setIsReconnecting(false);
      setStreamHiccup(null);
      setPausedAtTime(null);
    };

    const handleOffline = async () => {
      // If audio is actively playing, don't trigger offline state
      if (isPlaying) return;

      // Verify reachability to avoid false-positives from OS or virtual network adapters
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('/api/v1/version', {
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeout);
        if (res.ok) {
          setIsOffline(false);
          return;
        }
      } catch {}

      setIsOffline(true);
      setPausedAtTime(Math.floor(currentTime));
      playbackLogger.log(
        'warn',
        'network',
        `Network connection lost. Playback paused at ${formatTime(currentTime)}.`,
      );
    };

    const handleOnline = () => {
      setIsOffline(false);
      setIsReconnecting(true);
      setJustReconnected(true);
      playbackLogger.log(
        'info',
        'network',
        'Network connection restored. Re-establishing audio stream...',
      );

      setTimeout(() => {
        setIsReconnecting(false);
      }, 2500);

      setTimeout(() => {
        setJustReconnected(false);
      }, 4000);
    };

    const handleStreamHiccup = (e: any) => {
      // Don't show hiccup if audio is actively playing
      if (isPlaying) return;

      const msg = e?.detail?.message || 'Audio stream hiccup. Resuming...';
      const time = e?.detail?.time ?? currentTime;
      setStreamHiccup(msg);
      setPausedAtTime(Math.floor(time));
      playbackLogger.log('warn', 'stream', msg, { time });

      setTimeout(() => {
        setStreamHiccup(null);
      }, 4000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('audiohub:stream-hiccup', handleStreamHiccup);
    window.addEventListener('audiohub:playback-healthy', handlePlaybackHealthy);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('audiohub:stream-hiccup', handleStreamHiccup);
      window.removeEventListener('audiohub:playback-healthy', handlePlaybackHealthy);
    };
  }, [currentTime, isPlaying]);

  // Subscribe to playback logs
  useEffect(() => {
    setLogs(playbackLogger.getLogs());
    const unsub = playbackLogger.subscribe(() => {
      setLogs(playbackLogger.getLogs());
    });
    return unsub;
  }, []);

  const isErrorOrOffline = isOffline || Boolean(audioError) || Boolean(streamHiccup);
  const visible =
    (!isPlaying && isErrorOrOffline) ||
    (!isPlaying && isReconnecting) ||
    (!isPlaying && justReconnected);

  if (!visible && !showDiagModal) return null;

  return (
    <>
      {/* Floating Status Pill Chip above the Bottom Player */}
      {visible && (
        <div
          data-testid="network-status-chip"
          className="fixed bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto"
        >
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-2xl backdrop-blur-xl border transition-all ${
              isOffline || audioError
                ? 'bg-amber-950/80 text-amber-200 border-amber-500/30 shadow-amber-950/50'
                : isReconnecting
                  ? 'bg-blue-950/80 text-blue-200 border-blue-500/30 shadow-blue-950/50 animate-pulse'
                  : justReconnected
                    ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/30 shadow-emerald-950/50'
                    : 'bg-yellow-950/80 text-yellow-200 border-yellow-500/30 shadow-yellow-950/50'
            }`}
          >
            {isOffline || audioError ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowDiagModal(true)}
                  className="flex items-center gap-2 text-inherit hover:underline cursor-pointer bg-transparent border-0 p-0"
                >
                  <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>
                    {audioError
                      ? audioError
                      : `No Network Connection${pausedAtTime !== null ? ` • Paused at ${formatTime(pausedAtTime)}` : ''}`}
                  </span>
                  <Info className="w-3 h-3 opacity-60 ml-0.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    retryCurrentTrack?.();
                  }}
                  className="ml-1 px-2.5 py-0.5 rounded-full bg-amber-500/30 hover:bg-amber-500/40 text-amber-200 border border-amber-500/40 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Retry Now
                </button>
              </>
            ) : isReconnecting ? (
              <button
                type="button"
                onClick={() => setShowDiagModal(true)}
                className="flex items-center gap-2 text-inherit hover:underline cursor-pointer bg-transparent border-0 p-0"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                <span>Reconnecting audio stream...</span>
                <Info className="w-3 h-3 opacity-60 ml-0.5" />
              </button>
            ) : justReconnected ? (
              <button
                type="button"
                onClick={() => setShowDiagModal(true)}
                className="flex items-center gap-2 text-inherit hover:underline cursor-pointer bg-transparent border-0 p-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Back Online • Resuming Playback</span>
                <Info className="w-3 h-3 opacity-60 ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowDiagModal(true)}
                className="flex items-center gap-2 text-inherit hover:underline cursor-pointer bg-transparent border-0 p-0"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                <span>{streamHiccup || 'Recovering stream...'}</span>
                <Info className="w-3 h-3 opacity-60 ml-0.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stream Health & Diagnostic Details Modal */}
      {showDiagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-spotify-green/10 text-spotify-green">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Playback & Stream Health</h3>
                  <p className="text-xs text-spotify-gray">
                    Real-time connection status and recovery
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-spotify-gray hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              {/* Status Overview Card */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-spotify-gray text-xs mb-1">Network Status</div>
                  <div className="flex items-center gap-2 font-bold text-white">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${isOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}
                    />
                    {isOffline ? 'Offline / Spotty Signal' : 'Connected'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-spotify-gray text-xs mb-1">Playback Position</div>
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <Volume2 className="w-4 h-4 text-spotify-green" />
                    <span>{formatTime(currentTime)} preserved</span>
                  </div>
                </div>
              </div>

              {/* Current Track Info */}
              {currentTrack && (
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-spotify-gray text-xs">Now Playing</div>
                    <div className="font-bold text-white truncate">{currentTrack.title}</div>
                    <div className="text-xs text-spotify-gray truncate">{currentTrack.artist}</div>
                  </div>
                  <button
                    onClick={() => {
                      retryCurrentTrack();
                      setShowDiagModal(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-spotify-green text-black font-bold text-xs hover:scale-105 active:scale-95 transition-transform flex-shrink-0 shadow-lg"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Now</span>
                  </button>
                </div>
              )}

              {/* Info banner */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2.5 leading-relaxed">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
                <span>
                  AudioHub automatically remembers your exact second during signal drops, screen
                  locks, or provider hiccups. Playback will smoothly resume right where you left
                  off.
                </span>
              </div>

              {/* Live Event Log */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-spotify-gray uppercase tracking-wider">
                    Recent Diagnostic Events
                  </span>
                  <button
                    onClick={() => playbackLogger.clear()}
                    className="text-[11px] text-spotify-gray hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-[11px] max-h-40 overflow-y-auto space-y-1.5">
                  {logs.length === 0 ? (
                    <div className="text-white/40 italic">
                      No events recorded yet. Playback is running normally.
                    </div>
                  ) : (
                    logs.slice(0, 15).map((l) => (
                      <div key={l.id} className="flex items-start gap-2 leading-tight">
                        <span className="text-white/40 flex-shrink-0">[{l.timestamp}]</span>
                        <span
                          className={`font-semibold flex-shrink-0 ${
                            l.level === 'error'
                              ? 'text-red-400'
                              : l.level === 'warn'
                                ? 'text-yellow-400'
                                : l.level === 'success'
                                  ? 'text-emerald-400'
                                  : 'text-blue-400'
                          }`}
                        >
                          [{l.category}]
                        </span>
                        <span className="text-white/90 break-words">{l.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-4 border-t border-white/10 bg-black/20 flex justify-end">
              <button
                onClick={() => setShowDiagModal(false)}
                className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
