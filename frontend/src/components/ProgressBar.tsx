import type React from 'react';
import { useRef, useState } from 'react';
import { formatTime } from '../utils/formatters';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentTime,
  duration,
  onSeek,
  className = '',
  size = 'md',
  showTooltip = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveDuration = duration > 0 ? duration : 100;
  const displayTime = isDragging && dragTime !== null ? dragTime : currentTime;
  const progressPercent = Math.min(100, Math.max(0, (displayTime / effectiveDuration) * 100));

  const calculateTimeFromEvent = (
    e: React.MouseEvent | MouseEvent | React.TouchEvent | TouchEvent,
  ): { time: number; percent: number; clientX: number } | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX =
      'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clampedX = Math.min(Math.max(0, clientX - rect.left), rect.width);
    const percent = rect.width > 0 ? clampedX / rect.width : 0;
    const time = percent * effectiveDuration;
    return { time, percent: percent * 100, clientX: clampedX };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const res = calculateTimeFromEvent(e);
    if (res) {
      setHoverTime(res.time);
      setHoverX(res.clientX);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const res = calculateTimeFromEvent(e);
    if (!res) return;
    setIsDragging(true);
    setDragTime(res.time);

    const onGlobalMouseMove = (moveEvent: MouseEvent) => {
      const moveRes = calculateTimeFromEvent(moveEvent);
      if (moveRes) {
        setDragTime(moveRes.time);
        setHoverTime(moveRes.time);
        setHoverX(moveRes.clientX);
      }
    };

    const onGlobalMouseUp = (upEvent: MouseEvent) => {
      const upRes = calculateTimeFromEvent(upEvent);
      if (upRes) {
        onSeek(upRes.time);
      } else if (dragTime !== null) {
        onSeek(dragTime);
      }
      setIsDragging(false);
      setDragTime(null);
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const res = calculateTimeFromEvent(e);
    if (!res) return;
    setIsDragging(true);
    setDragTime(res.time);
    setHoverTime(res.time);
    setHoverX(res.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const res = calculateTimeFromEvent(e);
    if (res) {
      setDragTime(res.time);
      setHoverTime(res.time);
      setHoverX(res.clientX);
    }
  };

  const handleTouchEnd = () => {
    if (dragTime !== null) {
      onSeek(dragTime);
    }
    setIsDragging(false);
    setDragTime(null);
    setHoverTime(null);
    setHoverX(null);
  };

  const trackHeight =
    size === 'sm'
      ? 'h-1 group-hover/bar:h-1.5'
      : size === 'lg'
        ? 'h-2 group-hover/bar:h-2.5'
        : 'h-1.5 group-hover/bar:h-2';

  const thumbSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  const thumbOffset = size === 'lg' ? 8 : 6;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoverTime(null);
        setHoverX(null);
      }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full py-2 flex items-center cursor-pointer group/bar select-none ${className}`}
      role="slider"
      aria-valuenow={displayTime}
      aria-valuemin={0}
      aria-valuemax={effectiveDuration}
    >
      {/* Floating Timestamp Tooltip on Hover / Drag */}
      {showTooltip && (isHovered || isDragging) && hoverTime !== null && hoverX !== null && (
        <div
          className="absolute -top-7 px-2 py-0.5 rounded bg-[#242424] text-white text-[11px] font-mono font-bold shadow-2xl border border-white/20 pointer-events-none -translate-x-1/2 z-30 transition-opacity"
          style={{ left: `${hoverX}px` }}
        >
          {formatTime(hoverTime)}
        </div>
      )}

      {/* Track Background */}
      <div
        className={`w-full ${trackHeight} bg-white/20 rounded-full overflow-hidden relative transition-all duration-150`}
      >
        {/* Ghost Seek Preview Bar (on hover) */}
        {isHovered && hoverX !== null && containerRef.current && (
          <div
            className="absolute top-0 bottom-0 left-0 bg-white/25 rounded-full pointer-events-none"
            style={{
              width: `${(hoverX / (containerRef.current.clientWidth || 1)) * 100}%`,
            }}
          />
        )}

        {/* Active Progress Fill (Spotify Green on hover/drag, Crisp White otherwise) */}
        <div
          className={`h-full rounded-full transition-colors duration-150 ${
            isHovered || isDragging ? 'bg-spotify-green' : 'bg-white'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Scrub Thumb / Playhead Knob */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 ${thumbSize} bg-white rounded-full shadow-md border border-black/10 pointer-events-none transition-all duration-150 ${
          isHovered || isDragging
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-75 group-hover/bar:opacity-100 group-hover/bar:scale-100'
        }`}
        style={{ left: `calc(${progressPercent}% - ${thumbOffset}px)` }}
      />
    </div>
  );
};
