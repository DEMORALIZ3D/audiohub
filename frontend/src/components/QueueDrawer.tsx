import { GripVertical, Music, Trash2, X } from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import type { Track } from '../types';
import { navigateToArtist } from '../utils/navigation';
import { TrackContextMenu } from './TrackContextMenu';

export const QueueDrawer: React.FC = () => {
  const {
    currentTrack,
    queue,
    queueIndex,
    showQueue,
    toggleQueue,
    playTrack,
    removeFromQueue,
    reorderQueue,
  } = usePlayer();
  const [activeTrackMenu, setActiveTrackMenu] = useState<{
    track: Track;
    pos: { x: number; y: number };
    onRemove?: () => void;
  } | null>(null);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const touchStartYRef = useRef<number>(0);
  const touchStartIndexRef = useRef<number | null>(null);
  const touchCurrentTargetRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<any>(null);

  const handleTouchStart = (idx: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartYRef.current = touch.clientY;
    touchStartIndexRef.current = idx;
    touchCurrentTargetRef.current = idx;

    longPressTimerRef.current = setTimeout(() => {
      setIsTouchDragging(true);
      setDraggedIndex(idx);
      setDragOverIndex(idx);
      try {
        if (navigator.vibrate) navigator.vibrate(40);
      } catch {}
    }, 250);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!longPressTimerRef.current && !isTouchDragging) return;
    const touch = e.touches[0];

    // If not dragging yet, cancel if user scrolled vertically more than 10px
    if (!isTouchDragging) {
      if (Math.abs(touch.clientY - touchStartYRef.current) > 10) {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      return;
    }

    // Currently dragging: prevent scroll and compute hover target
    e.preventDefault();
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const rowEl = el?.closest('[data-queue-index]');
    if (rowEl) {
      const targetIdx = Number(rowEl.getAttribute('data-queue-index'));
      if (!isNaN(targetIdx) && targetIdx !== touchCurrentTargetRef.current) {
        touchCurrentTargetRef.current = targetIdx;
        setDragOverIndex(targetIdx);
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (
      isTouchDragging &&
      touchStartIndexRef.current !== null &&
      touchCurrentTargetRef.current !== null
    ) {
      if (touchStartIndexRef.current !== touchCurrentTargetRef.current) {
        reorderQueue(
          queueIndex + 1 + touchStartIndexRef.current,
          queueIndex + 1 + touchCurrentTargetRef.current,
        );
      }
    }
    setIsTouchDragging(false);
    setDraggedIndex(null);
    setDragOverIndex(null);
    touchStartIndexRef.current = null;
    touchCurrentTargetRef.current = null;
  };

  const handleDragStart = (idx: number, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(idx);
  };

  const handleDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== idx) {
      setDragOverIndex(idx);
    }
  };

  const handleDrop = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== idx) {
      reorderQueue(queueIndex + 1 + draggedIndex, queueIndex + 1 + idx);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (!showQueue) return null;

  const nextTracks = queue.slice(queueIndex + 1);

  return (
    <div className="fixed right-0 top-0 bottom-0 sm:bottom-20 w-full sm:w-80 bg-[#121212] border-l border-[#282828] z-[60] flex flex-col p-4 text-white shadow-2xl animate-slideLeft pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex items-center justify-between pb-3 border-b border-[#282828]">
        <h3 className="font-bold text-lg">Play Queue</h3>
        <button
          onClick={toggleQueue}
          className="p-2 rounded-full hover:bg-[#282828] text-spotify-gray hover:text-white active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mt-4 flex flex-col gap-6">
        {/* Now Playing */}
        <div>
          <span className="text-xs font-bold text-spotify-gray uppercase tracking-wider">
            Now Playing
          </span>
          {currentTrack ? (
            <div
              onContextMenu={(e) => {
                e.preventDefault();
                setActiveTrackMenu({ track: currentTrack, pos: { x: e.clientX, y: e.clientY } });
              }}
              className="flex items-center gap-3 mt-2 p-2.5 bg-[#282828] rounded-lg cursor-pointer hover:bg-[#303030] transition-colors"
            >
              <div className="w-11 h-11 bg-black rounded overflow-hidden flex-shrink-0">
                {currentTrack.cover_url && (
                  <img src={currentTrack.cover_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-sm font-semibold truncate text-spotify-green">
                  {currentTrack.title}
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleQueue();
                    navigateToArtist(currentTrack.artist, (currentTrack as any).artist_id);
                  }}
                  className="text-xs text-spotify-gray truncate hover:underline hover:text-white cursor-pointer"
                  title={`View ${currentTrack.artist}`}
                >
                  {currentTrack.artist}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-spotify-gray mt-2 italic">Nothing playing</div>
          )}
        </div>

        {/* Up Next */}
        <div className="flex-1 flex flex-col">
          <span className="text-xs font-bold text-spotify-gray uppercase tracking-wider">
            Up Next ({nextTracks.length})
          </span>
          {nextTracks.length > 0 ? (
            <div className="flex flex-col gap-1 mt-2">
              {nextTracks.map((t, idx) => {
                const actualIndex = queueIndex + 1 + idx;
                const isDraggingThis = draggedIndex === idx;
                const isDragOverThis = dragOverIndex === idx && draggedIndex !== idx;
                const isDropTargetAbove =
                  isDragOverThis && draggedIndex !== null && draggedIndex > idx;
                const isDropTargetBelow =
                  isDragOverThis && draggedIndex !== null && draggedIndex < idx;

                return (
                  <div
                    key={`${t.id}-${actualIndex}`}
                    data-queue-index={idx}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(idx, e)}
                    onDragOver={(e) => handleDragOver(idx, e)}
                    onDrop={(e) => handleDrop(idx, e)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handleTouchStart(idx, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className={`group relative flex items-center justify-between p-2.5 rounded-lg transition-all cursor-pointer select-none ${
                      isDraggingThis
                        ? 'opacity-30 scale-[0.98] border border-dashed border-spotify-green bg-white/5 shadow-inner'
                        : isDragOverThis
                          ? 'bg-spotify-green/10'
                          : 'hover:bg-[#1a1a1a] active:bg-[#222222]'
                    } ${isDropTargetAbove ? 'border-t-2 border-t-spotify-green' : ''} ${
                      isDropTargetBelow ? 'border-b-2 border-b-spotify-green' : ''
                    }`}
                    onClick={() => {
                      if (!isTouchDragging) playTrack(t);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveTrackMenu({
                        track: t,
                        pos: { x: e.clientX, y: e.clientY },
                        onRemove: () => removeFromQueue(actualIndex),
                      });
                    }}
                  >
                    <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                      {/* Grip handle for intuitive dragging */}
                      <div
                        className="text-white/30 group-hover:text-white/80 transition-colors cursor-grab active:cursor-grabbing p-1 -ml-1 flex-shrink-0 touch-none"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      <div className="w-9 h-9 rounded bg-[#282828] overflow-hidden flex-shrink-0 shadow">
                        {t.cover_url ? (
                          <img src={t.cover_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-4 h-4 m-auto text-spotify-gray" />
                        )}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-xs font-medium truncate text-white group-hover:text-spotify-green">
                          {t.title}
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleQueue();
                            navigateToArtist(t.artist, (t as any).artist_id);
                          }}
                          className="text-[11px] text-spotify-gray truncate hover:underline hover:text-white cursor-pointer"
                          title={`View ${t.artist}`}
                        >
                          {t.artist}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(actualIndex);
                      }}
                      className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 p-2 text-spotify-gray hover:text-red-400 active:scale-95 transition-opacity"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-spotify-gray mt-2 italic">Queue is empty</div>
          )}
        </div>
      </div>

      {/* Context Menu for Queued / Now Playing Track */}
      {activeTrackMenu && (
        <TrackContextMenu
          track={activeTrackMenu.track}
          isOpen={true}
          onClose={() => setActiveTrackMenu(null)}
          anchorPosition={activeTrackMenu.pos}
          onRemove={activeTrackMenu.onRemove}
        />
      )}
    </div>
  );
};
