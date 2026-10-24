import {
  Check,
  Copy,
  ExternalLink,
  ListEnd,
  ListPlus,
  Music,
  Pencil,
  Play,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import type { Track } from '../types';
import { getPlaylistShareData, shareContent } from '../utils/shareUtils';

export interface PlaylistContextMenuProps {
  playlist: {
    id: string;
    name?: string;
    title?: string;
    cover_url?: string;
    track_count?: number;
    description?: string;
    source_type?: string;
  };
  isOpen: boolean;
  onClose: () => void;
  anchorPosition?: { x: number; y: number } | null;
  onEdit?: () => void;
  onDeleted?: () => void;
  onNavigate?: () => void;
}

export const PlaylistContextMenu: React.FC<PlaylistContextMenuProps> = ({
  playlist,
  isOpen,
  onClose,
  anchorPosition,
  onEdit,
  onDeleted,
  onNavigate,
}) => {
  const { playTrack, playNext, addToQueue } = usePlayer();
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const playlistTitle = playlist.name || playlist.title || 'Playlist';

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fetchPlaylistTracks = async (): Promise<Track[]> => {
    try {
      const res = await fetch(`/api/v1/playlists/${playlist.id}`);
      if (res.ok) {
        const data = await res.json();
        return data.tracks || [];
      }
    } catch (e) {
      console.error('Failed to load tracks for playlist', e);
    }
    return [];
  };

  const handlePlayNow = async () => {
    setLoadingAction('play');
    const tracks = await fetchPlaylistTracks();
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks, { type: 'playlist', id: playlist.id, name: playlistTitle });
    }
    setLoadingAction(null);
    onClose();
  };

  const handlePlayNext = async () => {
    setLoadingAction('next');
    const tracks = await fetchPlaylistTracks();
    if (tracks.length > 0) {
      // Play next in reverse so the first track ends up right after current
      for (let i = tracks.length - 1; i >= 0; i--) {
        playNext(tracks[i]);
      }
    }
    setLoadingAction(null);
    onClose();
  };

  const handleAddToQueue = async () => {
    setLoadingAction('queue');
    const tracks = await fetchPlaylistTracks();
    tracks.forEach((t) => {
      addToQueue(t);
    });
    setLoadingAction(null);
    onClose();
  };

  const handleShare = async () => {
    const res = await shareContent(
      getPlaylistShareData(playlist.id, playlistTitle, playlist.cover_url),
    );
    if (res === 'copied' || res === 'shared') {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1200);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${playlistTitle}"?`)) return;
    try {
      const res = await fetch(`/api/v1/playlists/${playlist.id}`, { method: 'DELETE' });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('playlists_changed'));
        if (onDeleted) onDeleted();
      }
    } catch (e) {
      console.error('Failed to delete playlist', e);
    }
    onClose();
  };

  // Position calculation for desktop right click context menu with bottom player clearance
  const getStyle = (): React.CSSProperties => {
    if (!anchorPosition) return {};
    const width = 220;
    const height = 230;
    const bottomSafety = 96;
    let x = anchorPosition.x;
    let y = anchorPosition.y;

    if (x + width > window.innerWidth - 16) x = Math.max(12, window.innerWidth - width - 16);
    if (y + height > window.innerHeight - bottomSafety) {
      const flippedY = anchorPosition.y - height;
      y = flippedY >= 12 ? flippedY : Math.max(12, window.innerHeight - bottomSafety - height);
    }

    return {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      maxHeight: `calc(100vh - ${bottomSafety + 16}px)`,
      zIndex: 99999,
    };
  };

  const isDesktop = Boolean(anchorPosition);

  return (
    <>
      {/* Mobile Backdrop */}
      {!isDesktop && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        ref={menuRef}
        style={getStyle()}
        className={`${
          isDesktop
            ? 'w-[230px] bg-[#18181c]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1.5 text-xs animate-scaleUp'
            : 'fixed bottom-0 left-0 right-0 z-[9999] bg-[#18181c] border-t border-white/10 rounded-t-2xl p-4 shadow-2xl animate-slideUp text-sm'
        }`}
      >
        {/* Header Preview */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-white/10 mb-1">
          <div className="w-9 h-9 rounded bg-[#282828] overflow-hidden flex-shrink-0 flex items-center justify-center shadow">
            {playlist.cover_url ? (
              <img src={playlist.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Music className="w-4 h-4 text-spotify-gray" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-white truncate text-xs">{playlistTitle}</span>
            <span className="text-[10px] text-spotify-gray truncate">
              {playlist.track_count ? `${playlist.track_count} songs` : 'Playlist'}
            </span>
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex flex-col">
          <button
            onClick={handlePlayNow}
            disabled={loadingAction !== null}
            className="flex items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-white/10 text-white rounded-lg transition-colors font-medium"
          >
            <Play className="w-4 h-4 text-spotify-green fill-current" />
            <span>Play Playlist</span>
          </button>

          <button
            onClick={handlePlayNext}
            disabled={loadingAction !== null}
            className="flex items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            <ListPlus className="w-4 h-4 text-spotify-gray" />
            <span>Play Next</span>
          </button>

          <button
            onClick={handleAddToQueue}
            disabled={loadingAction !== null}
            className="flex items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            <ListEnd className="w-4 h-4 text-spotify-gray" />
            <span>Add to Queue</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => {
                onNavigate();
                onClose();
              }}
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-white/10 text-white rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-spotify-gray" />
              <span>Open Playlist Page</span>
            </button>
          )}

          {onEdit && (
            <button
              onClick={() => {
                onEdit();
                onClose();
              }}
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-white/10 text-white rounded-lg transition-colors"
            >
              <Pencil className="w-4 h-4 text-spotify-gray" />
              <span>Edit Details</span>
            </button>
          )}

          <button
            onClick={handleShare}
            className="flex items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-spotify-green" />
            ) : (
              <Share2 className="w-4 h-4 text-spotify-gray" />
            )}
            <span>{copied ? 'Link Copied!' : 'Share Playlist'}</span>
          </button>

          {playlist.source_type !== 'chart' && (
            <>
              <div className="h-px bg-white/10 my-1 mx-2" />
              <button
                onClick={handleDelete}
                className="flex items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Delete Playlist</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};
