import {
  Cast,
  CheckCircle2,
  Disc,
  KeyRound,
  Loader2,
  Maximize2,
  Mic2,
  Minimize2,
  Pause,
  Play,
  QrCode,
  RefreshCw,
  SkipBack,
  SkipForward,
  Smartphone,
  Sparkles,
  Tv,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AzifyLogoMark } from '../components/AzifyLogoMark';
import { useBranding } from '../config/branding';
import { useAuth } from '../context/AuthContext';
import { useConnect } from '../context/ConnectContext';
import { usePlayer } from '../context/PlayerContext';
import type { LyricLine } from '../types';
import { formatTime } from '../utils/formatters';

interface MagicSessionData {
  session_id: string;
  pin: string;
  auth_url: string;
  qr_svg_url: string;
  local_proxy_url: string;
  expires_in: number;
}

interface TvLeanbackViewProps {
  onExit?: () => void;
}

export const TvLeanbackView: React.FC<TvLeanbackViewProps> = ({ onExit }) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    volume,
    setVolume,
    currentPalette,
  } = usePlayer();

  const { onlineDevices, activeRemoteDevice } = useConnect();
  const { currentUser, refreshUser } = useAuth();
  const brand = useBranding();

  // Support playback originating from either local deck or active network/cast device
  const effectiveTrack = currentTrack || activeRemoteDevice?.current_track || null;
  const effectivePlaying = isPlaying || Boolean(activeRemoteDevice?.is_playing);
  const effectiveTime = currentTime > 0 ? currentTime : activeRemoteDevice?.position_seconds || 0;
  const effectiveDuration = duration > 0 ? duration : effectiveTrack?.duration_seconds || 0;

  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [activeVisualizerMode, setActiveVisualizerMode] = useState<'vinyl' | 'cover' | 'spectrum'>(
    'vinyl',
  );
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalTab, setQrModalTab] = useState<'remote' | 'switch_user'>('remote');
  const [switchMagicData, setSwitchMagicData] = useState<MagicSessionData | null>(null);
  const [switchQrLoading, setSwitchQrLoading] = useState(false);
  const [switchSuccessUser, setSwitchSuccessUser] = useState<string | null>(null);
  const switchPollTimerRef = useRef<number | null>(null);
  const [isIdle, setIsIdle] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);

  const activeLineRef = useRef<HTMLParagraphElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const userScrollTimeoutRef = useRef<number | null>(null);

  const closeQrModal = () => {
    setShowQrModal(false);
    setSwitchMagicData(null);
    setSwitchSuccessUser(null);
    if (switchPollTimerRef.current) clearInterval(switchPollTimerRef.current);
  };

  const fetchSwitchMagicSession = async () => {
    setSwitchQrLoading(true);
    try {
      const res = await fetch('/api/v1/auth/magic/request', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create switch session');
      const data: MagicSessionData = await res.json();
      setSwitchMagicData(data);
    } catch (e) {
      console.warn('Switch QR failed:', e);
    } finally {
      setSwitchQrLoading(false);
    }
  };

  useEffect(() => {
    if (showQrModal && qrModalTab === 'switch_user' && !switchMagicData && !switchSuccessUser) {
      fetchSwitchMagicSession();
    }
  }, [showQrModal, qrModalTab]);

  useEffect(() => {
    if (
      !showQrModal ||
      qrModalTab !== 'switch_user' ||
      !switchMagicData?.session_id ||
      switchSuccessUser
    )
      return;

    if (switchPollTimerRef.current) clearInterval(switchPollTimerRef.current);

    switchPollTimerRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/v1/auth/magic/status?session_id=${switchMagicData.session_id}`,
        );
        if (!res.ok) return;
        const statusData = await res.json();

        if (statusData.status === 'approved' && statusData.token) {
          if (switchPollTimerRef.current) clearInterval(switchPollTimerRef.current);
          setSwitchSuccessUser(
            statusData.user?.display_name || statusData.user?.username || 'User',
          );
          localStorage.setItem('audiohub_user_id', statusData.token);
          await refreshUser();
          setTimeout(() => {
            closeQrModal();
          }, 1500);
        } else if (statusData.status === 'expired') {
          if (switchPollTimerRef.current) clearInterval(switchPollTimerRef.current);
          fetchSwitchMagicSession();
        }
      } catch {}
    }, 1500);

    return () => {
      if (switchPollTimerRef.current) clearInterval(switchPollTimerRef.current);
    };
  }, [showQrModal, qrModalTab, switchMagicData?.session_id, switchSuccessUser]);

  // 1. D-Pad & TV Remote Control Navigation Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Reset idle timer on any TV remote button press
      resetIdleTimer();

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          nextTrack();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prevTrack();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;
        case 'Enter':
        case ' ':
        case 'MediaPlayPause':
          e.preventDefault();
          togglePlay();
          break;
        case 'MediaTrackNext':
          e.preventDefault();
          nextTrack();
          break;
        case 'MediaTrackPrevious':
          e.preventDefault();
          prevTrack();
          break;
        case 'v':
        case 'V':
          e.preventDefault();
          setActiveVisualizerMode((prev) =>
            prev === 'vinyl' ? 'spectrum' : prev === 'spectrum' ? 'cover' : 'vinyl',
          );
          break;
        case 'Escape':
        case 'Backspace':
        case 'GoBack':
          if (showQrModal) {
            e.preventDefault();
            closeQrModal();
          } else if (onExit) {
            e.preventDefault();
            onExit();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, nextTrack, prevTrack, togglePlay, setVolume, onExit, showQrModal]);

  // 2. OLED Screen-Burn Protection & Idle Dimmer
  const resetIdleTimer = () => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setIsIdle(true);
    }, 60000); // Dim after 60s of no remote action
  };

  useEffect(() => {
    resetIdleTimer();
    const handleMouseMove = () => resetIdleTimer();
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // 3. Fetch Time-Synced Lyrics
  useEffect(() => {
    if (!effectiveTrack) {
      setLyrics([]);
      setPlainLyrics(null);
      return;
    }

    setLoadingLyrics(true);
    setLyrics([]);
    setPlainLyrics(null);

    const query = new URLSearchParams({
      track: effectiveTrack.title,
      artist: effectiveTrack.artist,
      duration: String(effectiveTrack.duration_seconds || 0),
    });

    fetch(`/api/v1/lyrics?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.synced_lyrics) {
          const lines: LyricLine[] = [];
          const rawLines = data.synced_lyrics.split('\n');
          const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

          for (const raw of rawLines) {
            const match = raw.match(timeRegex);
            if (match) {
              const minutes = parseInt(match[1], 10);
              const seconds = parseInt(match[2], 10);
              const frac = parseFloat('0.' + match[3]);
              const time = minutes * 60 + seconds + frac;
              const text = match[4].trim();
              if (text) {
                lines.push({ time, text });
              }
            }
          }
          setLyrics(lines);
        } else if (data.plain_lyrics) {
          setPlainLyrics(data.plain_lyrics);
        }
      })
      .catch((err) => console.warn('Failed to load TV lyrics:', err))
      .finally(() => setLoadingLyrics(false));
  }, [effectiveTrack?.id]);

  // 4. Smooth Auto-Scroll to Active Lyrics Line
  useEffect(() => {
    if (userScrolled) return;
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [effectiveTime, userScrolled]);

  const handleManualScroll = () => {
    setUserScrolled(true);
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = window.setTimeout(() => {
      setUserScrolled(false);
    }, 4500); // Resume auto-scroll after 4.5s
  };

  // Find active singing line index
  const activeLineIndex = useMemo(() => {
    let index = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (effectiveTime >= lyrics[i].time) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [lyrics, effectiveTime]);

  const progressPercent = effectiveDuration > 0 ? (effectiveTime / effectiveDuration) * 100 : 0;
  const qrUrl = window.location.origin;

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#080a0f] text-white flex flex-col justify-between overflow-hidden select-none transition-all duration-1000 ${
        isIdle ? 'brightness-50' : 'brightness-100'
      }`}
    >
      {/* Dynamic Ambient Background Glow reflecting track artwork */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {effectiveTrack?.cover_url && (
          <div
            className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] bg-cover bg-center blur-[140px] opacity-25 scale-125 transition-all duration-1000"
            style={{ backgroundImage: `url(${effectiveTrack.cover_url})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-[#080a0f]/80 to-transparent" />
      </div>

      {/* Top TV Navigation Header */}
      <div className="relative z-20 px-8 py-6 flex items-center justify-between border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-spotify-green/20 text-spotify-green border border-spotify-green/40 flex items-center justify-center shadow-lg shadow-spotify-green/10">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider uppercase text-white flex items-center gap-2">
              <span>{brand.appShortName || 'Audiohub'} TV</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-spotify-green/20 text-spotify-green border border-spotify-green/30 font-bold">
                10-FOOT LEANBACK
              </span>
            </h1>
            <p className="text-xs text-spotify-gray flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-spotify-green animate-pulse" />
              <span>Living Room Display • {brand.appShortName || 'Audiohub'} Connect Ready</span>
            </p>
          </div>
        </div>

        {/* Status / Profile & Connect Controls */}
        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs">
              <div className="w-5 h-5 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center font-bold text-[10px] border border-spotify-green/30">
                {(currentUser.display_name || currentUser.username || 'U')[0].toUpperCase()}
              </div>
              <span className="font-semibold text-white/90 truncate max-w-[120px]">
                {currentUser.display_name || currentUser.username}
              </span>
              {currentUser.is_under_13 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Kids Mode
                </span>
              )}
            </div>
          )}

          <button
            onClick={() => {
              setQrModalTab('remote');
              setShowQrModal(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white/90 border border-white/10 transition-colors"
            title="Scan QR to control from phone"
          >
            <Smartphone className="w-4 h-4 text-spotify-green" />
            <span>Remote</span>
          </button>

          <button
            onClick={() => {
              setQrModalTab('switch_user');
              setShowQrModal(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white/90 border border-white/10 transition-colors"
            title="Switch TV Account via QR Code"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Switch Profile</span>
          </button>

          {/* Visualizer Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold">
            <button
              onClick={() => setActiveVisualizerMode('vinyl')}
              className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                activeVisualizerMode === 'vinyl'
                  ? 'bg-spotify-green text-black'
                  : 'text-spotify-gray hover:text-white'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              <span>Vinyl</span>
            </button>
            <button
              onClick={() => setActiveVisualizerMode('spectrum')}
              className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                activeVisualizerMode === 'spectrum'
                  ? 'bg-spotify-green text-black'
                  : 'text-spotify-gray hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Spectrum</span>
            </button>
            <button
              onClick={() => setActiveVisualizerMode('cover')}
              className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                activeVisualizerMode === 'cover'
                  ? 'bg-spotify-green text-black'
                  : 'text-spotify-gray hover:text-white'
              }`}
            >
              <span>Cover Art</span>
            </button>
          </div>

          {onExit && (
            <button
              onClick={onExit}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Exit TV Mode"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main 10-Foot Split Stage */}
      <div className="relative z-10 flex-1 px-8 py-6 grid grid-cols-12 gap-8 items-center overflow-hidden">
        {/* Left Column: Visualizer & Media Metadata (5 of 12 cols) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col items-center justify-center text-center space-y-6">
          {/* Visualizer Area */}
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 flex items-center justify-center">
            {activeVisualizerMode === 'vinyl' ? (
              /* Realistic 12" Vinyl Disc with Center Label */
              <div
                className={`relative w-full h-full rounded-full bg-[#0c0c0e] p-2 ring-2 ring-white/10 shadow-2xl shadow-black flex items-center justify-center overflow-hidden ${
                  effectivePlaying ? 'azify-vinyl-spin' : ''
                }`}
              >
                {/* Concentric Vinyl Grooves */}
                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,#0d0d0f_0%,#0d0d0f_36%,#18181c_40%,#0d0d0f_44%,#18181c_48%,#0d0d0f_52%,#18181c_56%,#0d0d0f_60%,#18181c_64%,#0d0d0f_68%,#18181c_72%,#0d0d0f_76%,#18181c_80%,#0d0d0f_84%,#18181c_88%,#0a0a0c_94%,#222228_100%)] pointer-events-none" />

                {/* Album Art Color Wax Glow / Translucent Tint */}
                {currentPalette?.primary && (
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none opacity-30 mix-blend-screen transition-opacity duration-700"
                    style={{
                      background: `radial-gradient(circle at center, transparent 36%, ${currentPalette.primary} 65%, transparent 95%)`,
                    }}
                  />
                )}

                {/* Dual Anisotropic Light Sheen Cones */}
                <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.14)_45deg,transparent_90deg,transparent_180deg,rgba(255,255,255,0.14)_225deg,transparent_270deg)] pointer-events-none" />

                {/* Center Label (Album art restricted ONLY to center circle) */}
                <div className="relative w-[38%] h-[38%] rounded-full overflow-hidden border-2 border-white/40 shadow-2xl z-10 flex items-center justify-center bg-[#181818]">
                  {effectiveTrack?.cover_url ? (
                    <img
                      src={effectiveTrack.cover_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-3xl">🎵</div>
                  )}
                  {/* Spindle Center Hole */}
                  <div className="absolute w-5 h-5 rounded-full bg-[#0a0a0c] border border-white/70 shadow-inner z-20 pointer-events-none" />
                </div>
              </div>
            ) : activeVisualizerMode === 'cover' ? (
              /* High-Res Square Cover Art with Ambient Shadow */
              <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-white/20 relative group">
                {effectiveTrack?.cover_url ? (
                  <img
                    src={effectiveTrack.cover_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#181818] flex items-center justify-center text-6xl">
                    🎵
                  </div>
                )}
              </div>
            ) : (
              /* Spectrum Mode: Giant Dancing Visualizer Bars */
              <div className="w-full h-full rounded-3xl bg-[#121620]/80 border border-white/10 p-6 flex flex-col justify-end items-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-6 left-6 flex items-center gap-2 text-xs font-bold text-spotify-green">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>32-Band DSP Audio Spectrum</span>
                </div>
                <div className="flex items-end gap-1.5 h-48 w-full justify-center">
                  {Array.from({ length: 32 }).map((_, b) => {
                    const osc = Math.sin(effectiveTime * 8 + b * 0.4);
                    const barHeight = effectivePlaying ? Math.max(12, Math.abs(osc) * 160 + 16) : 8;
                    const col = b < 12 ? 'bg-emerald-400' : b < 24 ? 'bg-cyan-400' : 'bg-amber-400';
                    return (
                      <div
                        key={b}
                        className={`w-2 ${col} rounded-full transition-all duration-75`}
                        style={{ height: `${barHeight}px` }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Track Info Typography */}
          <div className="space-y-2 max-w-lg">
            <h2 className="text-3xl md:text-4xl font-black text-white truncate tracking-tight">
              {effectiveTrack?.title || 'No Song Selected'}
            </h2>
            <p className="text-lg md:text-xl font-bold text-spotify-gray truncate">
              {effectiveTrack?.artist || `${brand.appShortName || 'Audiohub'} Infinite Catalog`}
            </p>
            {effectiveTrack?.album && (
              <p className="text-xs uppercase tracking-widest text-emerald-400 font-bold">
                {effectiveTrack.album} • Hi-Res Sovereign Lossless
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Synced Karaoke Lyrics (7 of 12 cols) */}
        <div className="col-span-12 lg:col-span-7 h-[65vh] flex flex-col justify-center relative overflow-hidden bg-black/30 rounded-3xl border border-white/10 p-6 sm:p-10 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Mic2 className="w-5 h-5 text-spotify-green animate-pulse" />
              <span className="text-xs font-black tracking-widest uppercase text-spotify-green">
                Time-Synced Karaoke Lyrics
              </span>
            </div>
            {lyrics.length > 0 && (
              <span className="text-xs text-spotify-gray">Auto-scrolling with audio sync</span>
            )}
          </div>

          {/* Lyrics Scrollable Area */}
          <div
            ref={lyricsContainerRef}
            onScroll={handleManualScroll}
            className="flex-1 overflow-y-auto space-y-8 custom-scrollbar scroll-smooth pr-4 text-center lg:text-left"
          >
            {loadingLyrics ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-spotify-gray">
                <div className="w-8 h-8 rounded-full border-2 border-spotify-green border-t-transparent animate-spin" />
                <p className="text-sm font-semibold">Synchronizing lyrics timestamps...</p>
              </div>
            ) : lyrics.length > 0 ? (
              lyrics.map((line, idx) => {
                const isActive = idx === activeLineIndex;
                const isPassed = activeLineIndex !== -1 && idx < activeLineIndex;
                return (
                  <p
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => seek(line.time)}
                    className={`transition-all duration-300 cursor-pointer select-none leading-relaxed ${
                      isActive
                        ? 'text-white text-2xl sm:text-3xl lg:text-4xl font-black scale-105 drop-shadow-[0_0_25px_rgba(16,185,129,0.8)]'
                        : isPassed
                          ? 'text-white/30 text-lg sm:text-xl lg:text-2xl font-bold'
                          : 'text-white/50 text-lg sm:text-xl lg:text-2xl font-bold hover:text-white/80'
                    }`}
                  >
                    {line.text}
                  </p>
                );
              })
            ) : plainLyrics ? (
              <div className="whitespace-pre-line text-lg sm:text-xl font-bold text-white/70 leading-loose">
                {plainLyrics}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-spotify-gray space-y-2">
                <Mic2 className="w-12 h-12 text-spotify-gray/40 mb-2" />
                <p className="text-lg font-bold text-white">Instrumental / No Lyrics Available</p>
                <p className="text-xs max-w-md text-center">
                  Enjoy the high-fidelity soundscape and 3D visualizer. Use your phone or remote to
                  skip tracks!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom TV Remote Bar: Progress, Time & Remote Control Hints */}
      <div className="relative z-20 px-8 py-5 border-t border-white/10 bg-[#080a0f]/90 backdrop-blur-xl flex flex-col gap-3">
        {/* Progress Slider */}
        <div className="w-full flex items-center gap-4">
          <span className="text-xs font-mono font-bold text-spotify-gray min-w-[45px] text-right">
            {formatTime(effectiveTime)}
          </span>
          <div className="flex-1 relative h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-spotify-green rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-spotify-gray min-w-[45px]">
            {formatTime(effectiveDuration)}
          </span>
        </div>

        {/* Remote D-Pad Keys Help Pill Row */}
        <div className="flex items-center justify-between text-xs text-spotify-gray">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono font-bold border border-white/15">
                ◄ / ►
              </span>
              <span>Skip Track</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono font-bold border border-white/15">
                OK / Space
              </span>
              <span>{effectivePlaying ? 'Pause' : 'Play'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono font-bold border border-white/15">
                ▲ / ▼
              </span>
              <span>Volume ({Math.round(volume * 100)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono font-bold border border-white/15">
                V
              </span>
              <span>Switch Visualizer</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-white/80">TV Display Active</span>
          </div>
        </div>
      </div>

      {/* TV QR Modal: Phone Remote / Cast OR Switch Profile */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={closeQrModal}
        >
          <div
            className="bg-[#121620] border border-white/20 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h3 className="text-white font-black text-lg">
                  {qrModalTab === 'remote' ? 'Control from Your Phone' : 'Switch TV Profile'}
                </h3>
                <p className="text-xs text-spotify-gray">
                  {qrModalTab === 'remote'
                    ? 'Scan to control music playback'
                    : 'Instant Magic QR account switch'}
                </p>
              </div>
              <button
                onClick={closeQrModal}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Switcher Pills */}
            <div className="flex bg-black/40 p-1 rounded-full border border-white/10 text-xs font-bold">
              <button
                onClick={() => setQrModalTab('remote')}
                className={`flex-1 py-2 rounded-full flex items-center justify-center gap-2 transition-all ${
                  qrModalTab === 'remote'
                    ? 'bg-spotify-green text-black shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Phone Remote</span>
              </button>
              <button
                onClick={() => {
                  setQrModalTab('switch_user');
                  if (!switchMagicData) fetchSwitchMagicSession();
                }}
                className={`flex-1 py-2 rounded-full flex items-center justify-center gap-2 transition-all ${
                  qrModalTab === 'switch_user'
                    ? 'bg-spotify-green text-black shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Switch Profile</span>
              </button>
            </div>

            {/* TAB 1: PHONE REMOTE */}
            {qrModalTab === 'remote' && (
              <div className="space-y-5 animate-fade-in">
                <div className="p-4 bg-white rounded-2xl inline-block shadow-xl">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl)}`}
                    alt={`Scan to open ${brand.appShortName || 'Audiohub'} on phone`}
                    className="w-52 h-52 mx-auto"
                  />
                </div>

                <div className="space-y-1.5 text-xs text-spotify-gray">
                  <p className="text-white font-bold text-sm">Scan with your smartphone camera</p>
                  <p>
                    Opens {brand.appShortName || 'Audiohub'} on your phone so you can search tracks,
                    build queues, and cast lossless audio directly to this TV screen!
                  </p>
                </div>

                <button
                  onClick={closeQrModal}
                  className="w-full py-2.5 rounded-full bg-spotify-green hover:bg-spotify-green/90 text-black font-bold text-sm transition-all"
                >
                  Done
                </button>
              </div>
            )}

            {/* TAB 2: SWITCH PROFILE VIA MAGIC QR */}
            {qrModalTab === 'switch_user' && (
              <div className="space-y-5 animate-fade-in flex flex-col items-center">
                {switchSuccessUser ? (
                  <div className="py-8 flex flex-col items-center justify-center space-y-3 animate-scaleIn">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h4 className="text-xl font-bold text-white">Profile Switched!</h4>
                    <p className="text-xs text-zinc-300">
                      Welcome, <b className="text-emerald-400">{switchSuccessUser}</b>. Loading your
                      library...
                    </p>
                  </div>
                ) : (
                  <>
                    {/* QR Code Container with Centered Logo */}
                    <div className="relative w-56 h-56 bg-white p-3 rounded-2xl shadow-2xl border-2 border-emerald-500/40 flex items-center justify-center overflow-hidden">
                      {switchQrLoading ? (
                        <div className="flex flex-col items-center gap-2 text-zinc-600">
                          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                          <span className="text-xs font-semibold">Generating QR session...</span>
                        </div>
                      ) : switchMagicData ? (
                        <div className="relative w-full h-full">
                          <img
                            src={switchMagicData.local_proxy_url || switchMagicData.qr_svg_url}
                            alt="Magic QR Switch Profile"
                            className="w-full h-full object-contain select-none"
                          />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 bg-[#121214] rounded-xl shadow-lg border border-emerald-500/30 p-1 flex items-center justify-center pointer-events-none">
                            <AzifyLogoMark
                              className="w-full h-full"
                              animated={false}
                              glow={false}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* PIN Pill */}
                    {switchMagicData && (
                      <div className="w-full bg-black/40 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between px-5">
                        <div className="flex items-center gap-2 text-xs text-zinc-300">
                          <KeyRound className="w-4 h-4 text-emerald-400" />
                          <span>Confirmation PIN:</span>
                        </div>
                        <span className="font-mono text-2xl font-black text-emerald-400 tracking-widest">
                          {switchMagicData.pin}
                        </span>
                      </div>
                    )}

                    <div className="space-y-1 text-xs text-spotify-gray text-center">
                      <p className="text-white font-bold text-xs">
                        Scan with the profile owner's phone
                      </p>
                      <p className="text-[11px]">
                        Scan with your logged-in phone camera or {brand.appShortName || 'Audiohub'}{' '}
                        app and confirm the PIN to switch this TV to your personal music.
                      </p>
                    </div>

                    <div className="w-full flex items-center justify-between text-xs text-zinc-400 border-t border-white/10 pt-3">
                      <button
                        onClick={fetchSwitchMagicSession}
                        disabled={switchQrLoading}
                        className="flex items-center gap-1.5 hover:text-white transition disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${switchQrLoading ? 'animate-spin' : ''}`}
                        />
                        <span>Refresh Code</span>
                      </button>

                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Live Listening</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
