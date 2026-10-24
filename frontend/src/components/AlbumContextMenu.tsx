import {
  Bookmark,
  BookmarkCheck,
  Check,
  Disc3,
  ExternalLink,
  ListEnd,
  ListPlus,
  Loader2,
  Play,
  Share2,
  User,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import type { Track } from '../types';
import { getAlbumShareData, shareContent } from '../utils/shareUtils';

export interface AlbumContextMenuProps {
  album: {
    id: string;
    title: string;
    artist?: string;
    artist_id?: string;
    cover_url?: string;
    tracks_count?: number;
    year?: string | number;
  };
  isOpen: boolean;
  onClose: () => void;
  anchorPosition?: { x: number; y: number } | null;
  onNavigateAlbum?: () => void;
  onNavigateArtist?: (artistId: string) => void;
}

export const AlbumContextMenu: React.FC<AlbumContextMenuProps> = ({
  album,
  isOpen,
  onClose,
  anchorPosition,
  onNavigateAlbum,
  onNavigateArtist,
}) => {
  const { playTrack, playNext, addToQueue } = usePlayer();
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Check if saved to library
  useEffect(() => {
    if (!isOpen || !album.id) return;
    fetch('/api/v1/library/albums')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        setIsSaved(data.some((a) => a.album_id === album.id || a.id === album.id));
      })
      .catch(() => {});
  }, [isOpen, album.id]);

  // Click outside and escape handling
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

  const fetchAlbumTracks = async (): Promise<Track[]> => {
    try {
      const res = await fetch(`/api/v1/albums/${album.id}`);
      if (res.ok) {
        const data = await res.json();
        return data.tracks || [];
      }
    } catch (e) {
      console.error('Failed to load album tracks', e);
    }
    return [];
  };

  const handlePlayNow = async () => {
    setLoadingAction('play');
    const tracks = await fetchAlbumTracks();
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks, { type: 'album', id: album.id, name: album.title });
    }
    setLoadingAction(null);
    onClose();
  };

  const handlePlayNext = async () => {
    setLoadingAction('next');
    const tracks = await fetchAlbumTracks();
    if (tracks.length > 0) {
      for (let i = tracks.length - 1; i >= 0; i--) {
        playNext(tracks[i]);
      }
    }
    setLoadingAction(null);
    onClose();
  };

  const handleAddToQueue = async () => {
    setLoadingAction('queue');
    const tracks = await fetchAlbumTracks();
    tracks.forEach((t) => {
      addToQueue(t);
    });
    setLoadingAction(null);
    onClose();
  };

  const handleToggleSave = async () => {
    setSavingLibrary(true);
    try {
      const endpoint = `/api/v1/library/albums/${album.id}`;
      const method = isSaved ? 'DELETE' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: album.title,
          artist: album.artist,
          cover_url: album.cover_url,
          year: album.year,
        }),
      });
      if (res.ok) {
        setIsSaved(!isSaved);
        window.dispatchEvent(new CustomEvent('library_changed'));
      }
    } catch (e) {
      console.error('Failed to toggle album in library', e);
    } finally {
      setSavingLibrary(false);
    }
  };

  const handleShare = async () => {
    const res = await shareContent(
      getAlbumShareData(album.id, album.title, album.artist || 'Unknown Artist', album.cover_url),
    );
    if (res === 'copied' || res === 'shared') {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1200);
    }
  };

  const getStyle = (): React.CSSProperties => {
    if (!anchorPosition) return {};
    const width = 220;
    const height = 250;
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
            {album.cover_url ? (
              <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Disc3 className="w-4 h-4 text-spotify-gray" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-white truncate text-xs">{album.title}</span>
            <span className="text-[10px] text-spotify-gray truncate">
              {album.artist || 'Album'}
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
            <span>Play Album</span>
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

          <button
            onClick={handleToggleSave}
            disabled={savingLibrary}
            className="flex items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            {savingLibrary ? (
              <Loader2 className="w-4 h-4 text-spotify-green animate-spin" />
            ) : isSaved ? (
              <BookmarkCheck className="w-4 h-4 text-spotify-green" />
            ) : (
              <Bookmark className="w-4 h-4 text-spotify-gray" />
            )}
            <span>{isSaved ? 'Remove from Library' : 'Save to Library'}</span>
          </button>

          {onNavigateAlbum && (
            <button
              onClick={() => {
                onNavigateAlbum();
                onClose();
              }}
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-white/10 text-white rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-spotify-gray" />
              <span>Open Album Page</span>
            </button>
          )}

          {album.artist_id && onNavigateArtist && (
            <button
              onClick={() => {
                onNavigateArtist(album.artist_id!);
                onClose();
              }}
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-white/10 text-white rounded-lg transition-colors"
            >
              <User className="w-4 h-4 text-spotify-gray" />
              <span>Go to Artist</span>
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
            <span>{copied ? 'Link Copied!' : 'Share Album'}</span>
          </button>
        </div>
      </div>
    </>
  );
};
