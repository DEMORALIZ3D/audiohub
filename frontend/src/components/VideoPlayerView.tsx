import { Maximize2, Minimize2, Music2, Wifi, WifiOff, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getNetworkInfo } from '../utils/networkUtils';

type VideoPlayerMode = 'backdrop' | 'cover' | 'standard';

interface VideoPlayerViewProps {
  videoId: string;
  title?: string;
  artist?: string;
  startTime?: number;
  mode?: VideoPlayerMode;
  onSwitchToAudio?: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  videoId,
  title,
  artist,
  startTime = 0,
  mode = 'cover',
  onSwitchToAudio,
  onClose,
  isMobile = false,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const network = getNetworkInfo();

  // Stabilize startSec: Only update if videoId changes or user seeks (> 3s sudden jump).
  // If embedUrl changes every second with normal playback, iframe reloads and flickers black.
  const [startSec, setStartSec] = useState(() => Math.max(0, Math.floor(startTime)));
  const lastTimeRef = useRef(startTime);

  useEffect(() => {
    // When videoId changes, synchronize to new start position
    setStartSec(Math.max(0, Math.floor(startTime)));
    lastTimeRef.current = startTime;
  }, [videoId]);

  useEffect(() => {
    // Only update if there is a deliberate seek (> 3.5s jump from natural 1-second ticks)
    const diff = Math.abs(startTime - lastTimeRef.current);
    if (diff > 3.5) {
      setStartSec(Math.max(0, Math.floor(startTime)));
    }
    lastTimeRef.current = startTime;
  }, [startTime]);

  const toggleFullscreen = () => {
    const el = document.getElementById(`video-container-${videoId}`);
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen?.()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  // Embed URL: memoized against [videoId, startSec] so it never changes on 1-second playback ticks
  const embedUrl = useMemo(() => {
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&loop=1&playlist=${videoId}&enablejsapi=1&start=${startSec}`;
  }, [videoId, startSec]);

  // Standard modal player container mode (windowed 16:9 frame)
  const standardEmbedUrl = useMemo(() => {
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&start=${startSec}&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1`;
  }, [videoId, startSec]);

  // Full-bleed Backdrop Mode: Video runs as an animated backdrop behind album art
  if (mode === 'backdrop') {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
        {/* Full-bleed 16:9 iframe covering 100% of viewport with edge cropping */}
        <iframe
          key={`backdrop-${videoId}`}
          src={embedUrl}
          title="Backdrop Canvas Video"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-0 pointer-events-none w-[100vw] h-[56.25vw] min-h-[100vh] min-w-[177.78vh] scale-105"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
        {/* Atmospheric dark scrim + soft blur for high contrast over album art & controls */}
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[0.5px] pointer-events-none" />
      </div>
    );
  }

  // Full-bleed Cover Mode: Video takes over the entire screen instead of album art
  if (mode === 'cover') {
    return (
      <div
        id={`video-container-${videoId}`}
        className="absolute inset-0 overflow-hidden select-none z-0 bg-black"
      >
        {/* Full-bleed 16:9 iframe covering 100% of viewport with edge cropping */}
        <iframe
          key={`cover-${videoId}`}
          src={embedUrl}
          title={title ? `${title} by ${artist} - Music Video` : 'Music Video'}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-0 pointer-events-none w-[100vw] h-[56.25vw] min-h-[100vh] min-w-[177.78vh] scale-105"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />

        {/* Soft top & bottom gradient scrims for controls visibility */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/90 via-black/20 to-black/60" />
      </div>
    );
  }

  return (
    <div
      id={`video-container-${videoId}`}
      className={`relative w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl flex flex-col justify-center items-center group ${
        isMobile
          ? 'aspect-video max-w-[340px] my-auto'
          : 'aspect-video w-full max-w-4xl h-full max-h-[70vh]'
      }`}
    >
      <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between pointer-events-none transition-opacity duration-300 group-hover:opacity-100 opacity-90">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-white pointer-events-auto shadow-md">
          {network.isWifiOrFast ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-spotify-green" />
              <span>Wi-Fi HD</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-yellow-400" />
              <span>Mobile Data</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 pointer-events-auto">
          {onSwitchToAudio && (
            <button
              onClick={onSwitchToAudio}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 hover:bg-white/20 backdrop-blur-md border border-white/10 text-[11px] font-bold text-white shadow-md transition-all active:scale-95"
              title="Switch back to Song Mode"
            >
              <Music2 className="w-3.5 h-3.5 text-spotify-green" />
              <span className="hidden sm:inline">Song Mode</span>
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-full bg-black/70 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white shadow-md transition-all"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-black/70 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white shadow-md transition-all"
              title="Close Video"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <iframe
        src={standardEmbedUrl}
        title={title ? `${title} by ${artist} - Music Video` : 'Music Video'}
        className="w-full h-full border-0 rounded-2xl"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
};
