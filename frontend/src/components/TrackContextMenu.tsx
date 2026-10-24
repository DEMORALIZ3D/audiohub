import {
  ArrowDownCircle,
  Check,
  CheckCircle2,
  Disc3,
  FolderPlus,
  Heart,
  ListEnd,
  ListPlus,
  Loader2,
  Music,
  Play,
  Radio,
  Share2,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { downloadTrack, isDownloaded, removeDownloadedTrack } from '../services/offlineStorage';
import type { Track } from '../types';
import { navigateToAlbum, navigateToArtist, navigateToSongRadio } from '../utils/navigation';
import { canShareTrack, getTrackShareData, shareContent } from '../utils/shareUtils';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { SongInfoModal } from './SongInfoModal';

export interface TrackContextMenuProps {
  track: Track;
  isOpen: boolean;
  onClose: () => void;
  anchorPosition?: { x: number; y: number } | null;
  onRemove?: () => void;
}

export const TrackContextMenu: React.FC<TrackContextMenuProps> = ({
  track,
  isOpen,
  onClose,
  anchorPosition,
  onRemove,
}) => {
  const {
    playTrack,
    playNext,
    addToQueue,
    toggleLike,
    isTrackLiked,
    activeRoom,
    addTrackToRoomQueue,
  } = usePlayer();

  const isLiked = isTrackLiked(track);
  const [downloaded, setDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [subModal, setSubModal] = useState<'info' | 'playlist' | null>(null);
  const [copied, setCopied] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && track.id) {
      isDownloaded(track.id).then(setDownloaded);
    }
  }, [isOpen, track.id]);

  // Click outside to dismiss (desktop)
  useEffect(() => {
    if (!isOpen || subModal !== null) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, subModal, onClose]);

  if (!isOpen) return null;

  const handlePlayNow = () => {
    playTrack(track);
    onClose();
  };

  const handlePlayNext = () => {
    playNext(track);
    onClose();
  };

  const handleAddToQueue = () => {
    addToQueue(track);
    onClose();
  };

  const handleToggleLike = async () => {
    await toggleLike(track);
  };

  const handleDownload = async () => {
    if (downloaded) {
      await removeDownloadedTrack(track.id);
      setDownloaded(false);
    } else {
      setIsDownloading(true);
      const ok = await downloadTrack(track);
      setIsDownloading(false);
      if (ok) setDownloaded(true);
    }
  };

  const handleAddToRoom = async () => {
    if (activeRoom) {
      await addTrackToRoomQueue(track);
      onClose();
    }
  };

  const handleShare = async () => {
    const res = await shareContent(getTrackShareData(track));
    if (res === 'copied' || res === 'shared') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Calculate clamped coordinates for desktop dropdown with bottom player clearance
  const desktopStyle: React.CSSProperties = {};
  if (!isMobile && anchorPosition) {
    const menuWidth = 224;
    const bottomSafety = 96; // Space for bottom player bar
    const estimatedHeight = 380; // Compact height
    const x = Math.max(12, Math.min(anchorPosition.x, window.innerWidth - menuWidth - 16));
    let y = anchorPosition.y;

    // If opening near bottom, flip up or clamp above bottom player bar
    if (y + estimatedHeight > window.innerHeight - bottomSafety) {
      const flippedY = anchorPosition.y - estimatedHeight;
      y =
        flippedY >= 12
          ? flippedY
          : Math.max(12, window.innerHeight - bottomSafety - estimatedHeight);
    }

    desktopStyle.left = `${x}px`;
    desktopStyle.top = `${y}px`;
    desktopStyle.maxHeight = `calc(100vh - ${bottomSafety + 16}px)`;
  }

  if (subModal === 'info') {
    return (
      <SongInfoModal
        isOpen={true}
        onClose={() => {
          setSubModal(null);
          onClose();
        }}
        track={track}
      />
    );
  }

  if (subModal === 'playlist') {
    return (
      <AddToPlaylistModal
        isOpen={true}
        onClose={() => {
          setSubModal(null);
          onClose();
        }}
        track={track}
      />
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 md:bg-black/30 backdrop-blur-[2px] transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Menu / Bottom Sheet */}
      <div
        ref={menuRef}
        style={!isMobile && anchorPosition ? desktopStyle : undefined}
        className={`fixed z-[60] bg-[#1c1c20] border border-white/10 text-white shadow-2xl overflow-hidden select-none ${
          isMobile
            ? 'inset-x-0 bottom-0 rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up pb-8'
            : 'rounded-xl w-56 py-1 animate-scale-in flex flex-col'
        }`}
      >
        {/* Mobile Pull Indicator */}
        {isMobile && (
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />
        )}

        {/* Track Preview Header */}
        <div className="flex items-center gap-2.5 p-2.5 border-b border-white/10 bg-white/5 flex-shrink-0">
          <div className="w-9 h-9 rounded-md bg-[#282828] overflow-hidden flex-shrink-0 shadow flex items-center justify-center">
            {track.cover_url ? (
              <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Music className="w-4 h-4 text-white/40" />
            )}
          </div>
          <div className="flex-1 min-w-0 pr-1.5">
            <h4 className="text-white font-bold text-xs truncate leading-tight">{track.title}</h4>
            <p className="text-spotify-gray text-[10px] truncate mt-0.5">{track.artist}</p>
          </div>
          {isMobile && (
            <button
              onClick={onClose}
              className="p-1 rounded-full text-spotify-gray hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Items List */}
        <div className="flex flex-col py-1 overflow-y-auto">
          {/* Play Now */}
          <button
            onClick={handlePlayNow}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-xs transition-colors group"
          >
            <Play className="w-3.5 h-3.5 text-spotify-green fill-spotify-green flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-white">Play Now</span>
          </button>

          {/* Play Next */}
          <button
            onClick={handlePlayNext}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-xs transition-colors group"
          >
            <ListPlus className="w-3.5 h-3.5 text-spotify-green flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-white">Play Next</span>
          </button>

          {/* Add to End of Queue */}
          <button
            onClick={handleAddToQueue}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-xs transition-colors group"
          >
            <ListEnd className="w-3.5 h-3.5 text-spotify-green flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-white">Add to Queue</span>
          </button>

          <div className="h-[1px] bg-white/10 my-1 mx-2.5" />

          {/* Go to Song Radio */}
          <button
            onClick={() => {
              onClose();
              navigateToSongRadio(track);
            }}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-xs transition-colors group"
          >
            <Radio className="w-3.5 h-3.5 text-spotify-green flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-white truncate font-medium">Go to Song Radio</span>
          </button>

          {/* Add to Playlist */}
          <button
            onClick={() => setSubModal('playlist')}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-xs transition-colors group"
          >
            <FolderPlus className="w-3.5 h-3.5 text-white/70 group-hover:text-white flex-shrink-0" />
            <span className="text-white">Add to Playlist</span>
          </button>

          {/* Like / Unlike */}
          <button
            onClick={handleToggleLike}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-xs transition-colors group"
          >
            <Heart
              className={`w-3.5 h-3.5 flex-shrink-0 transition-transform group-hover:scale-110 ${
                isLiked
                  ? 'text-spotify-green fill-spotify-green'
                  : 'text-white/70 group-hover:text-white'
              }`}
            />
            <span className="text-white">{isLiked ? 'Liked Song' : 'Save to Liked Songs'}</span>
          </button>

          {/* Go to Artist */}
          <button
            onClick={() => {
              onClose();
              navigateToArtist(track.artist, (track as any).artist_id);
            }}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-xs transition-colors group"
          >
            <User className="w-3.5 h-3.5 text-white/70 group-hover:text-white flex-shrink-0" />
            <span className="text-white truncate">Go to Artist</span>
          </button>

          {/* Go to Album (if album_id exists) */}
          {(track as any).album_id && (
            <button
              onClick={() => {
                onClose();
                navigateToAlbum((track as any).album_id);
              }}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-xs transition-colors group"
            >
              <Disc3 className="w-3.5 h-3.5 text-white/70 group-hover:text-white flex-shrink-0" />
              <span className="text-white truncate">Go to Album</span>
            </button>
          )}

          <div className="h-[1px] bg-white/10 my-1 mx-2.5" />

          {/* Inspect & Fix Match */}
          <button
            onClick={() => setSubModal('info')}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-xs transition-colors group"
          >
            <Sparkles className="w-3.5 h-3.5 text-spotify-green flex-shrink-0" />
            <span className="text-white">Inspect & Fix Match</span>
          </button>

          {/* Offline Download */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-xs transition-colors group disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 text-spotify-green animate-spin flex-shrink-0" />
            ) : downloaded ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-spotify-green fill-spotify-green/20 flex-shrink-0" />
            ) : (
              <ArrowDownCircle className="w-3.5 h-3.5 text-white/70 group-hover:text-white flex-shrink-0" />
            )}
            <span className="text-white">{downloaded ? 'Downloaded' : 'Download for Offline'}</span>
          </button>

          {/* Share */}
          {canShareTrack(track) && (
            <button
              onClick={handleShare}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-xs transition-colors group"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-spotify-green flex-shrink-0" />
              ) : (
                <Share2 className="w-3.5 h-3.5 text-white/70 group-hover:text-white flex-shrink-0" />
              )}
              <span className="text-white">{copied ? 'Link Copied!' : 'Share Song'}</span>
            </button>
          )}

          {/* Room Speaker Queue */}
          {activeRoom && (
            <button
              onClick={handleAddToRoom}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-xs transition-colors group"
            >
              <Radio className="w-3.5 h-3.5 text-spotify-green flex-shrink-0" />
              <span className="text-white">Queue on Speaker</span>
            </button>
          )}

          {/* Remove from Playlist (if in custom playlist) */}
          {onRemove && (
            <>
              <div className="h-[1px] bg-white/10 my-1 mx-2.5" />
              <button
                onClick={() => {
                  onClose();
                  onRemove();
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-red-500/15 text-left text-xs transition-colors text-red-400 hover:text-red-300 group"
              >
                <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Remove from Playlist</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};
