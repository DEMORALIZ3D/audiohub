import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Disc,
  Download,
  Film,
  Loader2,
  Music,
  Pause,
  Play,
  Share2,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { type ListeningStats, Track } from '../types';

interface WrappedStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: ListeningStats | null;
}

interface RenderJobStatus {
  id: string;
  status: 'queued' | 'rendering' | 'paused' | 'completed' | 'failed';
  progress: number;
  current_frame: number;
  total_frames: number;
  message: string;
  pause_reason?: string;
  download_url?: string | null;
  file_size_bytes?: number;
}

const PARTICLES = [
  { id: 1, char: '♪', left: '12%', delay: '0s', duration: '3.6s' },
  { id: 2, char: '✦', left: '84%', delay: '0.9s', duration: '4.1s' },
  { id: 3, char: '♫', left: '26%', delay: '1.4s', duration: '3.4s' },
  { id: 4, char: '★', left: '72%', delay: '2.1s', duration: '4.5s' },
  { id: 5, char: '♩', left: '46%', delay: '0.5s', duration: '3.8s' },
];

const useCountUp = (target: number, active: boolean, durationMs = 1600) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) {
      setVal(0);
      return;
    }
    const start = performance.now();
    let frameId: number;
    const update = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setVal(Math.round(eased * target));
      if (progress < 1) {
        frameId = requestAnimationFrame(update);
      }
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [target, active, durationMs]);
  return val;
};

export const WrappedStoryModal: React.FC<WrappedStoryModalProps> = ({ isOpen, onClose, stats }) => {
  const [currentSegment, setCurrentSegment] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [segmentProgress, setSegmentProgress] = useState(0);

  // Video Export Queue State
  const [isExporting, setIsExporting] = useState(false);
  const [activeJob, setActiveJob] = useState<RenderJobStatus | null>(null);
  const [hostStatus, setHostStatus] = useState<{
    cpu_percent: number;
    is_under_load: boolean;
  } | null>(null);

  const SEGMENT_DURATION_MS = 5000;
  const TOTAL_SEGMENTS = 5;

  const topTrack = stats?.top_tracks?.[0]?.track;
  const topArtist = stats?.top_artists?.[0]?.artist || 'Top Artist';
  const countUpMinutes = useCountUp(stats?.total_duration_minutes || 0, currentSegment === 0);

  // Load existing active job from localStorage on mount
  useEffect(() => {
    try {
      const savedJobId = localStorage.getItem('audiohub_active_wrapped_job');
      if (savedJobId) {
        fetch(`/api/v1/wrapped/jobs/${savedJobId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) {
              setActiveJob(data);
              if (data.status !== 'completed' && data.status !== 'failed') {
                setIsExporting(true);
              }
            }
          })
          .catch(() => {});
      }
    } catch {}
  }, []);

  // Poll active render job progress
  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/wrapped/jobs/${activeJob.id}`);
        if (res.ok) {
          const updated: RenderJobStatus = await res.json();
          setActiveJob(updated);
          if (updated.status === 'completed' || updated.status === 'failed') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.warn('Error polling render job:', err);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [activeJob]);

  // Poll host load status periodically when export drawer is open
  useEffect(() => {
    if (!isExporting) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/v1/wrapped/host-status');
        if (res.ok) {
          const data = await res.json();
          setHostStatus({
            cpu_percent: data.cpu_percent,
            is_under_load: data.is_under_load,
          });
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [isExporting]);

  // Story progression timer (runs when not held down)
  useEffect(() => {
    if (!isOpen || isPaused || isExporting) return;

    const tickInterval = 50;
    const step = (tickInterval / SEGMENT_DURATION_MS) * 100;

    const timer = setInterval(() => {
      setSegmentProgress((prev) => {
        if (prev >= 100) {
          if (currentSegment < TOTAL_SEGMENTS - 1) {
            setCurrentSegment((c) => c + 1);
            return 0;
          } else {
            return 100;
          }
        }
        return prev + step;
      });
    }, tickInterval);

    return () => clearInterval(timer);
  }, [isOpen, isPaused, isExporting, currentSegment]);

  const handleNext = () => {
    if (currentSegment < TOTAL_SEGMENTS - 1) {
      setCurrentSegment((s) => s + 1);
      setSegmentProgress(0);
    }
  };

  const handlePrev = () => {
    if (currentSegment > 0) {
      setCurrentSegment((s) => s - 1);
      setSegmentProgress(0);
    }
  };

  const handleStartExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/v1/wrapped/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const jobData: RenderJobStatus = await res.json();
        setActiveJob(jobData);
        localStorage.setItem('audiohub_active_wrapped_job', jobData.id);
      } else {
        throw new Error('Failed to create render job');
      }
    } catch (err) {
      console.error('Failed to submit export job:', err);
    }
  };

  const handleShareVideo = async () => {
    if (!activeJob?.download_url) return;
    const fullUrl = `${window.location.origin}${activeJob.download_url}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My AudioHub Year in Review 2026',
          text: `Check out my 2026 Year in Review Short on AudioHub! Over ${stats?.total_duration_minutes || 0} minutes listened!`,
          url: fullUrl,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(fullUrl);
      alert('Video download link copied to clipboard!');
    }
  };

  if (!isOpen || !stats) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/90 backdrop-blur-xl animate-fade-in select-none">
      {/* 9:16 Vertical Story Frame */}
      <div
        className="relative w-full h-full md:w-[400px] md:h-[720px] md:rounded-3xl bg-[#0b0e14] overflow-hidden shadow-2xl flex flex-col justify-between border border-white/10"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Dynamic Animated Ambient Background Glow & Shifting Aurora */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-[100px] opacity-40 transition-all duration-1000 animate-pulse"
            style={{
              background:
                currentSegment === 0
                  ? '#10b981'
                  : currentSegment === 1
                    ? '#8b5cf6'
                    : currentSegment === 2
                      ? '#ec4899'
                      : currentSegment === 3
                        ? '#f59e0b'
                        : '#3b82f6',
            }}
          />
          <div
            className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-[110px] bg-emerald-950/60 opacity-50 animate-pulse"
            style={{ animationDelay: '1.5s' }}
          />

          {/* Floating Music Notes & Sparkle Particles */}
          {PARTICLES.map((p) => (
            <div
              key={p.id}
              className="absolute bottom-10 text-white/30 select-none pointer-events-none text-lg animate-story-float"
              style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration }}
            >
              {p.char}
            </div>
          ))}
        </div>

        {/* Top Controls & Segment Progress Bars */}
        <div className="relative z-20 px-4 pt-4 pb-2 space-y-3 bg-gradient-to-b from-black/80 to-transparent">
          {/* Multi-segment story bars */}
          <div className="flex items-center gap-1.5 w-full">
            {Array.from({ length: TOTAL_SEGMENTS }).map((_, idx) => {
              const width =
                idx < currentSegment ? 100 : idx === currentSegment ? segmentProgress : 0;
              return (
                <div key={idx} className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-75 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 animate-story-glow">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-black tracking-widest text-emerald-400 uppercase">
                Wrapped 2026
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Story Card Content Body */}
        <div className="relative z-10 flex-1 px-6 flex flex-col justify-center select-none">
          {/* Segment 0: Welcome & Minutes with Count-Up Easing */}
          {currentSegment === 0 && (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider animate-story-pop">
                ⚡ Sound In Review
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
                You lived inside the music.
              </h1>
              <div className="py-4 relative flex flex-col items-center justify-center">
                {/* Concentric pulsing aura ring */}
                <div className="absolute w-44 h-44 rounded-full border border-emerald-500/30 animate-ping opacity-30 pointer-events-none" />
                <span className="text-6xl md:text-7xl font-black tracking-tighter bg-gradient-to-r from-emerald-400 via-teal-200 to-emerald-400 bg-clip-text text-transparent animate-gradient-flow scale-105 transition-transform">
                  {countUpMinutes.toLocaleString()}
                </span>
                <p className="text-sm font-bold uppercase tracking-widest text-emerald-400 mt-2">
                  Minutes Listened
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md text-left space-y-1 animate-story-spring-left">
                <div className="flex items-center justify-between text-xs text-spotify-gray">
                  <span>Total Tracks Played</span>
                  <span className="text-white font-bold">{stats.total_plays.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-spotify-gray">
                  <span>Fidelity Listening Time</span>
                  <span className="text-white font-bold">{stats.total_duration_hours} Hours</span>
                </div>
              </div>
            </div>
          )}

          {/* Segment 1: Top 5 Artists with Staggered Alternating Springs */}
          {currentSegment === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center space-y-1 mb-4">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">
                  Constant Companions
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-white">Your Top Artists</h2>
              </div>
              <div className="space-y-2.5">
                {stats.top_artists.slice(0, 5).map((a, i) => (
                  <div
                    key={a.artist}
                    className={`flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-white/10 transition-all ${
                      i % 2 === 0 ? 'animate-story-spring-left' : 'animate-story-spring-right'
                    }`}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                          i === 0
                            ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/30 animate-pulse'
                            : 'bg-white/10 text-white'
                        }`}
                      >
                        #{i + 1}
                      </div>
                      <span className="text-white font-bold text-sm tracking-tight">
                        {a.artist}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-purple-300">
                      {a.play_count} plays
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Segment 2: Top Tracks with Mini Equalizers & Staggered Fly-In */}
          {currentSegment === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center space-y-1 mb-4">
                <span className="text-xs font-bold text-pink-400 uppercase tracking-widest">
                  On Repeat
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-white">Your Top Songs</h2>
              </div>
              <div className="space-y-2.5">
                {stats.top_tracks.slice(0, 5).map((item, i) => (
                  <div
                    key={item.track.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl bg-white/5 border hover:border-pink-500/50 hover:bg-white/10 transition-all animate-story-spring-right ${
                      i === 0
                        ? 'border-pink-500/40 shadow-lg shadow-pink-500/10'
                        : 'border-white/10'
                    }`}
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {item.track.cover_url ? (
                        <img
                          src={item.track.cover_url}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center flex-shrink-0">
                          <Music className="w-5 h-5" />
                        </div>
                      )}
                      <div className="truncate">
                        <p className="text-white font-bold text-xs truncate">{item.track.title}</p>
                        <p className="text-spotify-gray text-[11px] truncate">
                          {item.track.artist}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {/* Mini bouncing equalizer bars on tracks */}
                      <div className="flex items-end gap-0.5 h-3.5">
                        <div className="w-0.5 bg-pink-400 rounded-full animate-equalizer-1" />
                        <div className="w-0.5 bg-pink-400 rounded-full animate-equalizer-2" />
                        <div className="w-0.5 bg-pink-400 rounded-full animate-equalizer-3" />
                      </div>
                      <span className="text-xs font-bold text-pink-400">#{i + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Segment 3: #1 Hit with Concentric Shockwaves & Rotating Vinyl Record */}
          {currentSegment === 3 && (
            <div className="text-center space-y-4 animate-fade-in">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest animate-pulse">
                ⭐ #1 Song of the Year
              </span>
              <div>
                <h2 className="text-2xl font-black text-white truncate px-4 animate-story-pop">
                  {topTrack?.title || 'Favorite Hit'}
                </h2>
                <p className="text-sm font-bold text-spotify-gray">
                  {topTrack?.artist || 'Unknown Artist'}
                </p>
              </div>

              {/* Realistic Spinning Vinyl Record with Shockwave Rings */}
              <div className="relative py-4 flex items-center justify-center">
                {/* Concentric Bass Shockwaves */}
                <div className="absolute w-56 h-56 rounded-full border-2 border-amber-400/40 animate-story-shockwave pointer-events-none" />
                <div
                  className="absolute w-56 h-56 rounded-full border border-emerald-400/30 animate-story-shockwave pointer-events-none"
                  style={{ animationDelay: '0.7s' }}
                />
                <div
                  className="absolute w-56 h-56 rounded-full border border-purple-400/30 animate-story-shockwave pointer-events-none"
                  style={{ animationDelay: '1.4s' }}
                />

                <div className="relative w-56 h-56 rounded-full bg-[#0d0d0f] border-4 border-white/20 shadow-2xl shadow-amber-500/20 flex items-center justify-center azify-vinyl-spin">
                  {/* Subtle Grooves */}
                  <div className="absolute inset-3 rounded-full border border-white/5" />
                  <div className="absolute inset-7 rounded-full border border-white/5" />
                  <div className="absolute inset-11 rounded-full border border-white/5" />
                  <div className="absolute inset-15 rounded-full border border-white/5" />

                  {/* Grooved light reflection glare cones */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 via-transparent to-white/15 pointer-events-none" />

                  {/* Center Cover Label */}
                  {topTrack?.cover_url ? (
                    <img
                      src={topTrack.cover_url}
                      alt=""
                      className="w-24 h-24 rounded-full object-cover border-2 border-white/30 shadow-inner"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-amber-500/20 border-2 border-white/30 flex items-center justify-center text-amber-400">
                      <Disc className="w-10 h-10" />
                    </div>
                  )}

                  {/* Spindle hole */}
                  <div className="absolute w-4 h-4 rounded-full bg-[#0a0a0c] border border-white/60 shadow-inner" />
                </div>
              </div>

              {/* Dynamic bouncing audio visualizer spectrum */}
              <div className="flex items-center justify-center gap-1 h-8">
                {Array.from({ length: 20 }).map((_, b) => (
                  <div
                    key={b}
                    className="w-1 bg-gradient-to-t from-emerald-500 to-amber-300 rounded-full animate-pulse"
                    style={{
                      height: `${Math.max(6, Math.sin(b * 0.45) * 26 + 8)}px`,
                      animationDelay: `${(b % 5) * 120}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Segment 4: Persona & Outro with Confetti Stars & Elastic Pop */}
          {currentSegment === 4 && (
            <div className="space-y-6 text-center animate-fade-in">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                Listening Identity
              </span>
              <h2 className="text-3xl font-black text-white animate-story-pop">The Crate Digger</h2>
              <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-900/30 via-white/5 to-transparent border border-blue-500/30 text-left space-y-3 shadow-xl animate-story-glow">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-200 text-black flex items-center justify-center font-black text-xl shadow-lg">
                    🎧
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Pure Audiophile Depth</h4>
                    <p className="text-spotify-gray text-xs">
                      You listen without borders or algorithms.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-white/80 leading-relaxed">
                  You delve into deep tracklists, spin full studio master releases, and prioritize
                  fidelity over compressed streams.
                </p>
              </div>

              <div className="pt-2 animate-story-pop" style={{ animationDelay: '200ms' }}>
                <span className="text-xs font-black tracking-widest text-emerald-400 uppercase">
                  AudioHub • Sovereign Sound
                </span>
                <p className="text-[11px] text-spotify-gray">
                  {typeof window !== 'undefined' ? window.location.host : 'audiohub'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tap navigation hotspots (invisible left/right buttons for Stories feel) */}
        <button
          onClick={handlePrev}
          className="absolute inset-y-16 left-0 w-1/3 z-10 cursor-default opacity-0"
          aria-label="Previous story segment"
        />
        <button
          onClick={handleNext}
          className="absolute inset-y-16 right-0 w-1/3 z-10 cursor-default opacity-0"
          aria-label="Next story segment"
        />

        {/* Bottom Drawer: Export & Share Actions */}
        <div className="relative z-20 p-4 bg-gradient-to-t from-black via-black/90 to-transparent border-t border-white/10">
          {!isExporting && !activeJob ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleStartExport}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                <Film className="w-4 h-4 fill-current" />
                Export Video (9:16 Short)
              </button>
            </div>
          ) : (
            <div className="space-y-3 bg-[#141822] p-3.5 rounded-2xl border border-white/10 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeJob?.status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : activeJob?.status === 'paused' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  )}
                  <span className="text-xs font-bold text-white capitalize">
                    {activeJob?.status === 'paused'
                      ? 'Render Paused (Host Protected)'
                      : activeJob?.status === 'completed'
                        ? 'Video Ready!'
                        : 'Rendering on Server'}
                  </span>
                </div>
                <span className="text-xs font-black text-emerald-400">
                  {activeJob?.progress ? `${Math.round(activeJob.progress)}%` : '0%'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    activeJob?.status === 'paused'
                      ? 'bg-amber-400'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  }`}
                  style={{ width: `${activeJob?.progress || 0}%` }}
                />
              </div>

              {/* Dynamic Host Load Protection Notice */}
              {activeJob?.status === 'paused' && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-snug flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Load-Adaptive Throttle Active: </span>
                    {activeJob.pause_reason || 'Host CPU under load'}. Rendering will automatically
                    resume once load subsides so audio playback is never disrupted.
                  </div>
                </div>
              )}

              {activeJob?.status === 'completed' ? (
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={activeJob.download_url || '#'}
                    download={`audiohub_wrapped_2026_${activeJob.id}.mp4`}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download MP4
                  </a>
                  <button
                    onClick={handleShareVideo}
                    className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-spotify-gray pt-0.5">
                  <span>
                    Frame {activeJob?.current_frame || 0} / {activeJob?.total_frames || 600}
                  </span>
                  {hostStatus && (
                    <span className="text-[10px] text-white/50">
                      Host CPU: {hostStatus.cpu_percent}%
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
