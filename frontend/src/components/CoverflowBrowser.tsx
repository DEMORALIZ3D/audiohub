import { ChevronLeft, ChevronRight, Disc3, Music2, Pause, Play, Volume2 } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';

export interface CoverflowItem {
  id: string;
  title: string;
  subtitle?: string;
  coverUrl?: string;
  badge?: string;
  meta?: string;
  raw?: any;
}

export interface CoverflowBrowserProps {
  items: CoverflowItem[];
  initialIndex?: number;
  onItemSelect?: (item: CoverflowItem, index: number) => void;
  onItemPlay?: (item: CoverflowItem, index: number) => void;
  activeId?: string;
  className?: string;
}

export const CoverflowBrowser: React.FC<CoverflowBrowserProps> = ({
  items,
  initialIndex = 0,
  onItemSelect,
  onItemPlay,
  activeId,
  className = '',
}) => {
  const [activeIndex, setActiveIndex] = useState(() => {
    if (activeId) {
      const idx = items.findIndex((it) => it.id === activeId);
      if (idx !== -1) return idx;
    }
    return Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1));
  });

  const [containerWidth, setContainerWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 800,
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);

  // Connect to player state for live now-playing indicators
  const player = usePlayer();
  const currentTrackId = player?.currentTrack?.id || null;
  const isAudioPlaying = player?.isPlaying || false;

  // Observe container width for responsive 3D perspective geometry
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Sync activeId when it changes externally
  useEffect(() => {
    if (activeId) {
      const idx = items.findIndex((it) => it.id === activeId);
      if (idx !== -1 && idx !== activeIndex) {
        setActiveIndex(idx);
      }
    }
  }, [activeId, items]);

  const total = items.length;

  const goTo = useCallback(
    (index: number) => {
      if (total === 0) return;
      const target = Math.max(0, Math.min(total - 1, index));
      setActiveIndex(target);
      if (onItemSelect && items[target]) {
        onItemSelect(items[target], target);
      }
    },
    [total, onItemSelect, items],
  );

  const goNext = useCallback(() => {
    if (total === 0) return;
    goTo(activeIndex + 1 >= total ? 0 : activeIndex + 1);
  }, [activeIndex, total, goTo]);

  const goPrev = useCallback(() => {
    if (total === 0) return;
    goTo(activeIndex - 1 < 0 ? total - 1 : activeIndex - 1);
  }, [activeIndex, total, goTo]);

  // Keyboard navigation: Left/Right arrows, Space/Enter to play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const activeItem = items[activeIndex];
        if (activeItem && onItemPlay) {
          onItemPlay(activeItem, activeIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goPrev, goNext, activeIndex, items, onItemPlay]);

  // Mouse Wheel Crate Digging
  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) > 15 || Math.abs(e.deltaY) > 25) {
      if (e.deltaX > 20 || e.deltaY > 30) {
        goNext();
      } else if (e.deltaX < -20 || e.deltaY < -30) {
        goPrev();
      }
    }
  };

  // Touch Swipe Handlers with velocity/distance threshold
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.changedTouches[0].clientX;
    touchStartYRef.current = e.changedTouches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartXRef.current;
    const diffY = endY - touchStartYRef.current;

    // Only swipe if mostly horizontal
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 35) {
      if (diffX < 0) {
        goNext();
      } else {
        goPrev();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only left click
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const diff = e.clientX - dragStartXRef.current;
    if (diff < -45) {
      goNext();
    } else if (diff > 45) {
      goPrev();
    }
  };

  if (total === 0) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center text-spotify-gray">
        <Disc3 className="w-12 h-12 text-white/20 mb-3 animate-spin" />
        <span className="text-sm">No albums or tracks in this crate</span>
      </div>
    );
  }

  // Responsive 3D geometry tuned for all screen resolutions
  const isMobile = containerWidth < 640;
  const isTablet = containerWidth >= 640 && containerWidth < 1024;

  const stackSpacing = isMobile ? 24 : isTablet ? 32 : 40;
  const centerGap = isMobile ? 115 : isTablet ? 150 : 185;
  const skewAngleY = isMobile ? 56 : 62;
  const zOffset = isMobile ? -210 : -280;
  const activeZ = isMobile ? 100 : 140;

  const activeItem = items[activeIndex];

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={`relative w-full flex flex-col items-center select-none overflow-hidden py-2 sm:py-4 ${className}`}
      tabIndex={0}
      aria-label="3D Cover Flow Crate Digging Browser"
    >
      {/* 3D Perspective Stage */}
      <div
        className="relative w-full h-[250px] sm:h-[310px] md:h-[360px] flex items-center justify-center outline-none overflow-visible"
        style={{
          perspective: isMobile ? '1000px' : '1400px',
          WebkitPerspective: isMobile ? '1000px' : '1400px',
        }}
      >
        <div
          className="relative w-full h-full flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}
        >
          {items.map((item, index) => {
            const diff = index - activeIndex;
            const absDiff = Math.abs(diff);
            const isActive = diff === 0;
            const direction = diff > 0 ? 1 : -1;

            let translateX = 0;
            let rotateY = 0;
            let translateZ = zOffset;
            let opacity = 1;
            const zIndex = 100 - absDiff;

            if (isActive) {
              translateX = 0;
              rotateY = 0;
              translateZ = activeZ;
              opacity = 1;
            } else {
              rotateY = direction === 1 ? -skewAngleY : skewAngleY;
              translateX = direction * centerGap + diff * stackSpacing;
              translateZ = zOffset - absDiff * 22;
              opacity = absDiff > 7 ? 0 : Math.max(0.12, 0.85 - absDiff * 0.12);
            }

            const isCurrentlyPlaying = item.id === currentTrackId && isAudioPlaying;
            // Generate formatted track number display: e.g. "01", "02" or item.badge
            const trackNumber = item.badge?.replace('#', '') || `${index + 1}`.padStart(2, '0');

            return (
              <div
                key={item.id || index}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isActive) {
                    if (onItemPlay) onItemPlay(item, index);
                  } else {
                    goTo(index);
                  }
                }}
                className="absolute w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64 cursor-pointer transition-all ease-out"
                style={{
                  transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
                  WebkitTransform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
                  zIndex,
                  opacity,
                  transition: 'all 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
                  willChange: 'transform, opacity',
                }}
              >
                <div
                  className="relative w-full h-full group"
                  style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}
                >
                  {/* REALISTIC 12" VINYL RECORD PEEKING OUT OF SLEEVE */}
                  {/* This ensures repetitive album art has an unmistakable tactile physical vinyl identity with track numbers */}
                  <div
                    className={`absolute top-1.5 bottom-1.5 rounded-full pointer-events-none transition-all duration-700 ease-out shadow-2xl flex items-center justify-center ${
                      isActive
                        ? 'right-[-26px] sm:right-[-38px] md:right-[-46px]'
                        : 'right-[-10px] sm:right-[-16px]'
                    }`}
                    style={{
                      width: '94%',
                      aspectRatio: '1/1',
                      background:
                        'radial-gradient(circle at 45% 45%, #2a2a30 0%, #151518 35%, #08080a 75%, #030304 100%)',
                      border: '2px solid rgba(255, 255, 255, 0.08)',
                      zIndex: -1,
                    }}
                  >
                    {/* Concentric vinyl microgrooves texture */}
                    <div
                      className="absolute inset-0 rounded-full pointer-events-none opacity-40"
                      style={{
                        background:
                          'repeating-radial-gradient(circle at center, transparent 0, transparent 3px, rgba(255,255,255,0.06) 4px, transparent 5px)',
                      }}
                    />

                    {/* Vinyl Center Label Sticker with Track Number */}
                    <div className="relative w-[38%] h-[38%] rounded-full bg-gradient-to-tr from-[#121216] via-[#1f1f26] to-[#2c2c36] border-2 border-[#1ed760]/40 flex flex-col items-center justify-center shadow-inner overflow-hidden">
                      <span className="text-[10px] sm:text-xs font-black text-emerald-400 font-mono tracking-wider">
                        #{trackNumber}
                      </span>
                      <span className="text-[7px] text-white/50 uppercase tracking-widest font-sans font-semibold scale-90">
                        AUDIOHUB
                      </span>
                      {/* Spindle hole */}
                      <div className="w-2.5 h-2.5 rounded-full bg-black border border-white/20 mt-0.5" />
                    </div>
                  </div>

                  {/* VINYL ALBUM JACKET / SLEEVE */}
                  <div
                    className={`w-full h-full rounded-lg overflow-hidden bg-[#18181c] border transition-all duration-300 shadow-[0_24px_50px_rgba(0,0,0,0.85)] relative ${
                      isActive
                        ? isCurrentlyPlaying
                          ? 'border-emerald-400 ring-4 ring-emerald-500/30 shadow-[0_30px_70px_rgba(30,215,96,0.3)]'
                          : 'border-white/30 ring-2 ring-white/20 shadow-[0_30px_70px_rgba(0,0,0,0.95)]'
                        : 'border-white/10 opacity-90 hover:border-white/20'
                    }`}
                  >
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading={absDiff < 4 ? 'eager' : 'lazy'}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#242428] to-[#121214] text-spotify-gray p-3">
                        <Music2 className="w-12 h-12 opacity-30 mb-2" />
                        <span className="text-xs font-bold text-white/80 text-center line-clamp-2">
                          {item.title}
                        </span>
                      </div>
                    )}

                    {/* TOP-LEFT METALLIC FOIL TRACK NUMBER BADGE */}
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/15 shadow-md">
                      <span className="text-[11px] font-black text-emerald-400 font-mono">
                        #{trackNumber}
                      </span>
                      {isCurrentlyPlaying && (
                        <div className="flex items-end gap-0.5 h-3 ml-0.5">
                          <span className="w-0.5 h-full bg-emerald-400 animate-equalizer-1 rounded-full" />
                          <span className="w-0.5 h-full bg-emerald-400 animate-equalizer-2 rounded-full" />
                          <span className="w-0.5 h-full bg-emerald-400 animate-equalizer-3 rounded-full" />
                        </div>
                      )}
                    </div>

                    {/* TOP-RIGHT BADGE (e.g. Hi-Res / LP / Vinyl) */}
                    {item.badge && (
                      <span className="absolute top-2 right-2 z-10 bg-black/80 backdrop-blur-md text-[10px] font-bold px-2 py-0.5 rounded text-spotify-green border border-white/10 shadow">
                        {item.badge}
                      </span>
                    )}

                    {/* BOTTOM INTEGRATED TITLE BANNER ON THE SLEEVE (Solves Repetitive Cover Issue) */}
                    <div className="absolute bottom-0 left-0 right-0 z-10 p-2.5 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-6 text-left">
                      <p className="text-xs sm:text-sm font-black text-white truncate drop-shadow-md">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-[10px] sm:text-xs text-white/70 truncate drop-shadow-sm font-medium">
                          by {item.subtitle}
                        </p>
                      )}
                    </div>

                    {/* ACTIVE PLAY/PAUSE BUTTON HOVER OVERLAY */}
                    {isActive && (
                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onItemPlay) onItemPlay(item, index);
                          }}
                          className="w-14 h-14 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform"
                          title={`Play ${item.title}`}
                          aria-label={`Play ${item.title}`}
                        >
                          {isCurrentlyPlaying ? (
                            <Pause className="w-6 h-6 fill-current" />
                          ) : (
                            <Play className="w-6 h-6 fill-current ml-0.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* FLOOR REFLECTION (Classic Apple Cover Flow Glossy Floor) */}
                  <div
                    className="absolute top-[102%] left-0 w-full h-[40%] pointer-events-none overflow-hidden rounded-b-md"
                    style={{
                      transform: 'scaleY(-1)',
                      opacity: isActive ? 0.32 : 0.16,
                      maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 75%)',
                      WebkitMaskImage:
                        'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 75%)',
                    }}
                  >
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt=""
                        className="w-full h-full object-cover filter blur-[0.5px]"
                        aria-hidden="true"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#18181c]" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CRATE DIGGING NAVIGATION, SCRUBBER & METADATA BAR */}
      <div className="relative z-30 mt-2 sm:mt-4 flex flex-col items-center max-w-xl w-full px-4 text-center">
        {/* Navigation Controls + Scrubber Bar */}
        <div className="flex items-center justify-center gap-3 sm:gap-5 mb-3 w-full">
          <button
            onClick={goPrev}
            className="p-2 sm:p-2.5 rounded-full bg-[#1e1e24] hover:bg-[#2e2e38] text-white/90 hover:text-white border border-white/10 shadow-lg active:scale-90 transition-all cursor-pointer flex-shrink-0"
            aria-label="Previous Album (Left Arrow)"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Smooth Interactive Track Scrubber Trackbar */}
          <div className="flex-1 max-w-xs sm:max-w-md flex flex-col items-center px-1">
            <input
              type="range"
              min={0}
              max={total - 1}
              value={activeIndex}
              onChange={(e) => goTo(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-spotify-green hover:bg-white/30 transition-colors"
              aria-label="Crate Scrubber Slider"
            />
            <div className="flex justify-between w-full text-[10px] text-white/40 font-mono mt-1 px-0.5">
              <span>Track {activeIndex + 1}</span>
              <span>{total} items</span>
            </div>
          </div>

          <button
            onClick={goNext}
            className="p-2 sm:p-2.5 rounded-full bg-[#1e1e24] hover:bg-[#2e2e38] text-white/90 hover:text-white border border-white/10 shadow-lg active:scale-90 transition-all cursor-pointer flex-shrink-0"
            aria-label="Next Album (Right Arrow)"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Record Information Card */}
        {activeItem && (
          <div className="flex flex-col items-center justify-center animate-fadeIn min-h-[76px] max-w-md w-full">
            <h3 className="text-base sm:text-xl font-black text-white tracking-tight line-clamp-1 drop-shadow-md">
              {activeItem.title}
            </h3>
            {activeItem.subtitle && (
              <p className="text-xs sm:text-sm text-spotify-gray font-semibold line-clamp-1 mt-0.5">
                {activeItem.subtitle}
              </p>
            )}
            {activeItem.meta && (
              <span className="text-[11px] text-emerald-400/80 font-mono mt-1 font-medium">
                {activeItem.meta}
              </span>
            )}

            {/* Direct Play/Pause Button */}
            {onItemPlay && (
              <button
                onClick={() => onItemPlay(activeItem, activeIndex)}
                className="mt-3.5 flex items-center gap-2 px-6 py-2 rounded-full bg-spotify-green hover:bg-[#1ed760] text-black font-extrabold text-xs uppercase tracking-wider shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                aria-label={
                  activeItem.id === currentTrackId && isAudioPlaying ? 'Pause Now' : 'Play Now'
                }
              >
                {activeItem.id === currentTrackId && isAudioPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play Now</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
