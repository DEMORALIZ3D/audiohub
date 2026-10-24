import {
  Disc3,
  ExternalLink,
  Heart,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { usePlayer } from '../context/PlayerContext';
import { drawRoundRect } from '../utils/canvasPolyfill';
import { formatTime } from '../utils/formatters';
import { AzifyLogoMark } from './AzifyLogoMark';

type PopoutPlayerProps = {};

export const PopoutPlayer: React.FC<PopoutPlayerProps> = () => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    currentTime,
    duration,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    isShuffle,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    isTrackLiked,
    toggleLike,
    getAudioMetrics,
    currentPalette,
    visualizerTheme,
    videoDisplayMode,
    showVisualizer,
  } = usePlayer();

  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [autoPopout, setAutoPopout] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('audiohub_auto_popout');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Display mode inside popout: 'art' | 'visualizer'
  const [popoutMode, setPopoutMode] = useState<'art' | 'visualizer'>('art');
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoTriggeredRef = useRef(false);

  // Determine active visual state
  const effectiveMode = useMemo(() => {
    if (popoutMode === 'art') return 'art';
    if (popoutMode === 'visualizer') return 'visualizer';
    if (showVisualizer || visualizerTheme) {
      if (videoDisplayMode === 'off') return 'visualizer';
    }
    return 'art';
  }, [popoutMode, showVisualizer, visualizerTheme, videoDisplayMode]);

  // Save auto-popout setting
  const toggleAutoPopout = () => {
    setAutoPopout((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('audiohub_auto_popout', String(next));
      } catch {}
      return next;
    });
  };

  // Open Document Picture-in-Picture window (Chromium 116+)
  const openDocumentPiP = async () => {
    if (pipWindow) {
      pipWindow.focus();
      return;
    }

    if ('documentPictureInPicture' in window) {
      try {
        const pip = await (window as any).documentPictureInPicture.requestWindow({
          width: 380,
          height: 470,
        });

        // Copy parent styles
        [...document.styleSheets].forEach((sheet) => {
          try {
            if (sheet.href) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.type = sheet.type || 'text/css';
              link.media = sheet.media.mediaText;
              link.href = sheet.href;
              pip.document.head.appendChild(link);
            } else if (sheet.cssRules) {
              const style = document.createElement('style');
              style.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n');
              pip.document.head.appendChild(style);
            }
          } catch {
            if (sheet.href) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = sheet.href;
              pip.document.head.appendChild(link);
            }
          }
        });

        // Inject high-precision self-contained styles for resilient rendering
        const customStyle = document.createElement('style');
        customStyle.id = 'azify-popout-custom-css';
        customStyle.textContent = `
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #09090b;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            user-select: none;
            -webkit-font-smoothing: antialiased;
          }
          @keyframes azifySpinVinyl {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin-vinyl {
            animation: azifySpinVinyl 3.6s linear infinite;
          }
          .spin-vinyl.paused {
            animation-play-state: paused;
          }
          input[type=range] {
            -webkit-appearance: none;
            appearance: none;
            background: transparent;
            cursor: pointer;
          }
          input[type=range]:focus {
            outline: none;
          }
          input[type=range]::-webkit-slider-runnable-track {
            height: 4px;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.18);
          }
          input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #1ed760;
            margin-top: -4px;
            box-shadow: 0 0 8px rgba(30, 215, 96, 0.6);
            transition: transform 0.15s ease, background 0.15s ease;
          }
          input[type=range]:hover::-webkit-slider-thumb {
            transform: scale(1.25);
            background: #ffffff;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.9);
          }
        `;
        pip.document.head.appendChild(customStyle);

        // Set popout window title & background
        pip.document.title = currentTrack ? `${currentTrack.title} • AudioHub` : 'AudioHub Popout';
        pip.document.body.style.margin = '0';
        pip.document.body.style.backgroundColor = '#09090b';
        pip.document.body.style.color = '#ffffff';

        pip.addEventListener('pagehide', () => {
          setPipWindow(null);
          autoTriggeredRef.current = false;
        });

        setPipWindow(pip);
        return;
      } catch (err) {
        console.warn('[PopoutPlayer] Document PiP failed, falling back to Video PiP:', err);
      }
    }

    // Fallback: Standard Video/Canvas Picture-in-Picture
    openVideoPiP();
  };

  // Fallback: Video / Canvas Stream PiP
  const openVideoPiP = async () => {
    const video = hiddenVideoRef.current;
    const canvas = hiddenCanvasRef.current;
    if (!video || !canvas) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }

      if (!video.srcObject && canvas.captureStream) {
        const stream = canvas.captureStream(30);
        video.srcObject = stream;
        await video.play();
      }

      await video.requestPictureInPicture();
    } catch (err) {
      console.warn('[PopoutPlayer] Video PiP error:', err);
    }
  };

  const closePopout = () => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
    }
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    autoTriggeredRef.current = false;
  };

  // Auto Popout trigger on Desktop when switching away from tab
  useEffect(() => {
    const isDesktop = window.innerWidth >= 768;
    if (!isDesktop || !autoPopout) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (isPlaying && currentTrack && !pipWindow && !document.pictureInPictureElement) {
          autoTriggeredRef.current = true;
          openDocumentPiP().catch(() => {});
        }
      } else if (document.visibilityState === 'visible') {
        if (autoTriggeredRef.current && pipWindow) {
          closePopout();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, currentTrack, autoPopout, pipWindow]);

  // Listen to manual popout trigger events from UI buttons
  useEffect(() => {
    const handleManualToggle = () => {
      if (pipWindow) {
        closePopout();
      } else {
        openDocumentPiP();
      }
    };

    const handleManualOpen = () => {
      if (!pipWindow) {
        openDocumentPiP();
      } else {
        pipWindow.focus();
      }
    };

    window.addEventListener('audiohub-toggle-popout', handleManualToggle);
    window.addEventListener('audiohub-open-popout', handleManualOpen);
    return () => {
      window.removeEventListener('audiohub-toggle-popout', handleManualToggle);
      window.removeEventListener('audiohub-open-popout', handleManualOpen);
    };
  }, [pipWindow]);

  // Update Popout Document Title dynamically
  useEffect(() => {
    if (pipWindow && pipWindow.document) {
      pipWindow.document.title = currentTrack
        ? `${isPlaying ? '▶' : '⏸'} ${currentTrack.title} • ${currentTrack.artist}`
        : 'AudioHub Popout';
    }
  }, [pipWindow, currentTrack, isPlaying]);

  // Offscreen canvas loop for fallback Video PiP
  useEffect(() => {
    let animId: number;
    const canvas = hiddenCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    if (currentTrack?.cover_url) {
      img.src = currentTrack.cover_url;
    }

    let rotationAngle = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Dark background
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // Ambient radial backlight glow
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2 - 30,
        20,
        width / 2,
        height / 2 - 30,
        width / 1.3,
      );
      const glowRgb = currentPalette?.rgb || [30, 215, 96];
      grad.addColorStop(0, `rgba(${glowRgb[0]}, ${glowRgb[1]}, ${glowRgb[2]}, 0.27)`);
      grad.addColorStop(1, '#09090b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const metrics = getAudioMetrics();

      if (effectiveMode === 'visualizer') {
        // High-definition Spectrum Analyzer
        const freq = metrics.frequencyData;
        const barCount = 36;
        const barWidth = 6;
        const gap = 3;
        const totalW = barCount * (barWidth + gap);
        const startX = (width - totalW) / 2;

        for (let i = 0; i < barCount; i++) {
          const sampleIdx = Math.floor((i / barCount) * Math.min(freq.length, 90));
          const val = (freq[sampleIdx] || 0) / 255;
          const barH = Math.max(6, val * 160 * (1 + metrics.energy));
          const x = startX + i * (barWidth + gap);
          const y = height / 2 - barH / 2;

          ctx.fillStyle = currentPalette.accent || '#1ed760';
          ctx.beginPath();
          drawRoundRect(ctx, x, y, barWidth, barH, 3);
          ctx.fill();
        }
      } else {
        // Spinning Vinyl Disc Visual
        if (isPlaying) {
          rotationAngle += 0.035;
        }

        const discRadius = 85;
        const discCenterX = width / 2;
        const discCenterY = 135;

        // Vinyl Platter / Outer Grooves
        ctx.save();
        ctx.translate(discCenterX, discCenterY);
        ctx.rotate(rotationAngle);

        // Black Vinyl Body
        ctx.fillStyle = '#111113';
        ctx.beginPath();
        ctx.arc(0, 0, discRadius, 0, Math.PI * 2);
        ctx.fill();

        // Outer Ring
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, discRadius - 1, 0, Math.PI * 2);
        ctx.stroke();

        // Concentric Vinyl Sound Grooves
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = 1;
        for (let r = discRadius - 10; r > 38; r -= 6) {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Center Label Image
        const labelRadius = 34;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
        ctx.clip();
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
        } else {
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(-labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
        }
        ctx.restore();

        // Spindle Center Hole
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
      }

      // Track Title & Artist Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      const title = currentTrack?.title || 'No Track Selected';
      ctx.fillText(title.length > 28 ? title.slice(0, 26) + '...' : title, width / 2, height - 70);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      const artist = currentTrack?.artist || 'AudioHub Music';
      ctx.fillText(
        artist.length > 32 ? artist.slice(0, 30) + '...' : artist,
        width / 2,
        height - 50,
      );

      // Scrubber Track Line
      const barY = height - 25;
      const barW = width - 60;
      const barX = 30;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, 4, 2);
      ctx.fill();

      if (duration > 0) {
        const progressW = (currentTime / duration) * barW;
        ctx.fillStyle = '#1ed760';
        ctx.beginPath();
        ctx.roundRect(barX, barY, progressW, 4, 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    currentTrack,
    effectiveMode,
    currentPalette,
    getAudioMetrics,
    isPlaying,
    currentTime,
    duration,
  ]);

  const isLiked = isTrackLiked(currentTrack);

  // Interactive Popout Portal Content (inside Document PiP window)
  const popoutPortalContent = pipWindow ? (
    <div className="w-full h-full flex flex-col justify-between p-3.5 bg-gradient-to-b from-[#18181b] via-[#0d0d10] to-[#09090b] text-white select-none relative overflow-hidden">
      {/* Dynamic Ambient Background Glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700"
        style={{ backgroundColor: currentPalette.primary || '#1ed760' }}
      />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10 z-10">
        <div className="flex items-center gap-1.5 font-bold tracking-tight text-white/90">
          <div className="w-4 h-4 text-spotify-green">
            <AzifyLogoMark className="w-full h-full" />
          </div>
          <span>AudioHub</span>
          <span className="w-1.5 h-1.5 rounded-full bg-spotify-green animate-pulse" />
        </div>

        {/* Mode Switcher Pill */}
        <div className="flex items-center gap-0.5 bg-white/10 rounded-full p-0.5 text-[10px]">
          <button
            onClick={() => setPopoutMode('art')}
            className={`px-2.5 py-0.5 rounded-full font-medium transition-all ${
              effectiveMode === 'art'
                ? 'bg-spotify-green text-black font-bold shadow'
                : 'text-white/70 hover:text-white'
            }`}
          >
            💿 Vinyl
          </button>
          <button
            onClick={() => setPopoutMode('visualizer')}
            className={`px-2.5 py-0.5 rounded-full font-medium transition-all ${
              effectiveMode === 'visualizer'
                ? 'bg-spotify-green text-black font-bold shadow'
                : 'text-white/70 hover:text-white'
            }`}
          >
            ⚡ Visuals
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              window.focus();
            }}
            className="p-1 hover:bg-white/15 rounded-full transition-all text-white/70 hover:text-white"
            title="Focus Main Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={closePopout}
            className="p-1 hover:bg-white/15 rounded-full transition-all text-white/70 hover:text-white"
            title="Close Popout"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center Stage: Vinyl & Sleeve OR Realtime Spectrum Analyzer */}
      <div className="flex-1 flex items-center justify-center my-1 relative overflow-hidden z-10">
        {effectiveMode === 'art' ? (
          <div className="relative flex items-center justify-center group/disc py-2">
            {/* Spinning 12" Vinyl Disc peeking out */}
            <div
              className={`absolute w-36 h-36 rounded-full bg-[#101012] border border-white/10 shadow-2xl transition-all duration-700 ease-out flex items-center justify-center spin-vinyl ${
                isPlaying ? '' : 'paused'
              } translate-x-12 group-hover/disc:translate-x-16`}
            >
              {/* Concentric Grooves */}
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,transparent_34%,rgba(0,0,0,0.6)_38%,rgba(0,0,0,0.15)_65%,rgba(0,0,0,0.8)_88%,rgba(255,255,255,0.2)_96%)] pointer-events-none" />

              {/* Vinyl Center Label */}
              <div className="w-14 h-14 rounded-full overflow-hidden border border-white/30 shadow-inner relative flex items-center justify-center">
                {currentTrack?.cover_url ? (
                  <img
                    src={currentTrack.cover_url}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#22c55e] flex items-center justify-center text-[8px] font-bold text-black">
                    AUDIOHUB
                  </div>
                )}
                {/* Spindle Center Hole */}
                <div className="absolute w-3.5 h-3.5 rounded-full bg-[#09090b] border border-white/50 shadow-inner" />
              </div>
            </div>

            {/* Album Jacket / Sleeve in foreground */}
            <div className="relative z-10 w-36 h-36 rounded-lg overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.7)] border border-white/15 bg-[#18181b] transition-transform duration-300 group-hover/disc:scale-102">
              {currentTrack?.cover_url ? (
                <img
                  src={currentTrack.cover_url}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 text-white/40">
                  <Disc3 className="w-10 h-10 animate-spin" />
                  <span className="text-[10px] mt-1 font-medium">AudioHub Record</span>
                </div>
              )}

              {/* Foil Corner Badge */}
              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/20 text-[9px] font-mono font-bold tracking-wider text-white/90">
                12" 33 RPM
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-36 flex items-center justify-center px-4">
            <PopoutVisualizerCanvas
              getAudioMetrics={getAudioMetrics}
              palette={currentPalette}
              isPlaying={isPlaying}
            />
          </div>
        )}
      </div>

      {/* Track Meta & Like Button */}
      <div className="flex items-center justify-between px-2 mb-2 z-10">
        <div className="truncate min-w-0 pr-2">
          <h4
            className="font-bold text-sm truncate text-white leading-tight"
            title={currentTrack?.title}
          >
            {currentTrack?.title || 'No Track Playing'}
          </h4>
          <p className="text-xs text-zinc-400 truncate mt-0.5">
            {currentTrack?.artist || 'AudioHub Sound'}
          </p>
        </div>

        {currentTrack && (
          <button
            onClick={() => toggleLike(currentTrack)}
            className="p-1.5 rounded-full hover:bg-white/10 transition-transform active:scale-125 flex-shrink-0"
            title={isLiked ? 'Liked' : 'Like'}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                isLiked ? 'text-spotify-green fill-spotify-green' : 'text-white/50 hover:text-white'
              }`}
            />
          </button>
        )}
      </div>

      {/* Draggable Progress Scrubber */}
      <div className="w-full px-2 mb-2 z-10">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 100}
            step={0.5}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full h-1 bg-white/15 rounded-full appearance-none cursor-pointer"
            title={`Seek to ${formatTime(currentTime)}`}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono mt-1 px-0.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Transport Media Controls */}
      <div className="flex items-center justify-center gap-4 pt-0.5 pb-1 z-10">
        <button
          onClick={toggleShuffle}
          className={`p-1.5 transition-colors relative ${
            isShuffle ? 'text-spotify-green' : 'text-white/50 hover:text-white'
          }`}
          title="Shuffle"
        >
          <Shuffle className="w-3.5 h-3.5" />
          {isShuffle && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-spotify-green rounded-full" />
          )}
        </button>

        <button
          onClick={prevTrack}
          className="p-1.5 text-white/70 hover:text-white transition-all active:scale-90"
          title="Previous Track"
        >
          <SkipBack className="w-4 h-4 fill-current" />
        </button>

        <button
          onClick={togglePlay}
          className="w-10 h-10 bg-gradient-to-tr from-[#1db954] to-[#1ed760] text-black rounded-full flex items-center justify-center shadow-[0_0_16px_rgba(30,215,96,0.45)] hover:scale-105 active:scale-95 transition-transform"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        <button
          onClick={nextTrack}
          className="p-1.5 text-white/70 hover:text-white transition-all active:scale-90"
          title="Next Track"
        >
          <SkipForward className="w-4 h-4 fill-current" />
        </button>

        <button
          onClick={toggleRepeat}
          className={`p-1.5 transition-colors relative ${
            repeatMode !== 'off' ? 'text-spotify-green' : 'text-white/50 hover:text-white'
          }`}
          title="Repeat"
        >
          {repeatMode === 'one' ? (
            <Repeat1 className="w-3.5 h-3.5" />
          ) : (
            <Repeat className="w-3.5 h-3.5" />
          )}
          {repeatMode !== 'off' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-spotify-green rounded-full" />
          )}
        </button>
      </div>

      {/* Footer: Volume Slider & Auto-popout toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10 px-2 text-[10px] text-zinc-400 z-10">
        <div className="flex items-center gap-1.5 w-32">
          <button
            onClick={toggleMute}
            className="p-0.5 hover:text-white transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-20 h-1 bg-white/15 rounded-full appearance-none cursor-pointer"
            title={`Volume ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />
        </div>

        <button
          onClick={toggleAutoPopout}
          className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
            autoPopout
              ? 'text-spotify-green bg-spotify-green/10'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          title="Toggle Auto-Popout when switching browser tabs"
        >
          {autoPopout ? 'Auto-Popout ON' : 'Auto-Popout OFF'}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Offscreen Canvas & Video for Universal Fallback PiP */}
      <div className="hidden">
        <canvas ref={hiddenCanvasRef} width={380} height={380} />
        <video
          ref={hiddenVideoRef}
          playsInline
          muted
          {...({ autoPictureInPicture: true } as any)}
          className="w-1 h-1"
        />
      </div>

      {/* Document PiP Portal */}
      {pipWindow && ReactDOM.createPortal(popoutPortalContent, pipWindow.document.body)}
    </>
  );
};

// High-fidelity spectrum analyzer canvas for popout
const PopoutVisualizerCanvas: React.FC<{
  getAudioMetrics: () => { energy: number; frequencyData: Uint8Array };
  palette: { primary: string; accent: string };
  isPlaying: boolean;
}> = ({ getAudioMetrics, palette, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const metrics = getAudioMetrics();
      const freq = metrics.frequencyData;
      const barCount = 30;
      const gap = 3;
      const barWidth = (w - gap * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const sampleIdx = Math.floor((i / barCount) * Math.min(freq.length, 80));
        const val = isPlaying ? (freq[sampleIdx] || 0) / 255 : 0.05;
        const barH = Math.max(4, val * (h * 0.88) * (1 + metrics.energy * 0.4));
        const x = i * (barWidth + gap);
        const y = h / 2 - barH / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, palette.primary || '#1ed760');
        grad.addColorStop(1, palette.accent || '#1db954');

        ctx.fillStyle = grad;
        ctx.beginPath();
        drawRoundRect(ctx, x, y, barWidth, barH, 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [getAudioMetrics, palette, isPlaying]);

  return <canvas ref={canvasRef} width={320} height={140} className="w-full h-full" />;
};

// Custom Hook to trigger popout from any button
export const usePopoutPlayer = () => {
  const triggerPopout = async () => {
    const event = new CustomEvent('audiohub-toggle-popout');
    window.dispatchEvent(event);
  };

  return { triggerPopout };
};
