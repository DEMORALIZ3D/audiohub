import {
  Check,
  Clock,
  Disc3,
  GripVertical,
  LayoutGrid,
  Loader2,
  Music,
  Pencil,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Share2,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { CoverflowBrowser } from '../components/CoverflowBrowser';
import { PlaylistManagerModal } from '../components/PlaylistManagerModal';
import { PlaylistViewSkeleton } from '../components/SkeletonLoaders';
import { TrackRow } from '../components/TrackRow';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import type { PlaybackContext, Track } from '../types';
import { formatTime } from '../utils/formatters';
import { getPlaylistShareData, shareContent } from '../utils/shareUtils';
import { useCrateViewPreference } from '../utils/vinylSettings';

interface PlaylistViewProps {
  playlistId: string;
  onDeleted: () => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({ playlistId, onDeleted }) => {
  const { playTrack, playShuffle } = usePlayer();
  const { currentUser } = useAuth();
  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [crateView, setCrateView] = useCrateViewPreference();
  const [isSyncing, setIsSyncing] = useState(false);

  // Drag and drop & touch long-press reorder states
  const [draggedTrackIndex, setDraggedTrackIndex] = useState<number | null>(null);
  const [dragOverTrackIndex, setDragOverTrackIndex] = useState<number | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const touchStartYRef = useRef<number>(0);
  const touchStartIndexRef = useRef<number | null>(null);
  const touchCurrentTargetRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<any>(null);

  const handleSyncNow = async () => {
    if (!playlist || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/v1/playlists/${playlist.id}/sync`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.tracks && Array.isArray(data.tracks)) {
          setPlaylist((prev: any) => ({ ...prev, tracks: data.tracks }));
        }
      }
    } catch (e) {
      console.warn('Failed to sync playlist:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchPlaylist = () => {
    let url = `/api/v1/playlists/${playlistId}`;
    if (playlistId.startsWith('radio_')) {
      let meta: any = null;
      try {
        const raw = sessionStorage.getItem(`radio_seed_${playlistId}`);
        if (raw) meta = JSON.parse(raw);
      } catch (e) {}

      const params = new URLSearchParams(window.location.search);
      if (window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.split('?')[1];
        const hashParams = new URLSearchParams(hashQuery);
        hashParams.forEach((val, key) => {
          if (!params.has(key)) params.set(key, val);
        });
      }

      if (meta) {
        if (!params.has('title') && meta.title) params.set('title', meta.title);
        if (!params.has('artist') && meta.artist) params.set('artist', meta.artist);
        if (!params.has('source_type') && meta.source_type)
          params.set('source_type', meta.source_type);
        if (!params.has('source_id') && meta.source_id) params.set('source_id', meta.source_id);
        if (!params.has('cover_url') && meta.cover_url) params.set('cover_url', meta.cover_url);
        if (!params.has('album') && meta.album) params.set('album', meta.album);
        if (!params.has('duration') && meta.duration_seconds)
          params.set('duration', String(meta.duration_seconds));
      }

      const q = params.toString();
      if (q) url += `?${q}`;
    }

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setPlaylist(data);
        setEditName(data.name || '');
        setEditDescription(data.description || '');
      })
      .catch((e) => console.error('Failed to load playlist', e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlaylist();
  }, [playlistId]);

  const handleFollow = async () => {
    if (!playlist || followLoading) return;
    const previousFollowed = playlist.is_followed;
    const previousFollowedId = playlist.followed_playlist_id;

    // Optimistic update
    setPlaylist((prev: any) => ({
      ...prev,
      is_followed: true,
      auto_update: true,
    }));
    setFollowLoading(true);

    try {
      const res = await fetch('/api/v1/playlists/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: playlist.source_id || playlist.id,
          source_type: playlist.source_type || 'chart',
          name: playlist.name,
          description: playlist.description,
          cover_url: playlist.cover_url,
          auto_update: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylist((prev: any) => ({
          ...prev,
          is_followed: true,
          followed_playlist_id: data.playlist_id,
          auto_update: true,
        }));
        window.dispatchEvent(new CustomEvent('playlists_changed'));
      } else {
        // Rollback
        setPlaylist((prev: any) => ({
          ...prev,
          is_followed: previousFollowed,
          followed_playlist_id: previousFollowedId,
        }));
      }
    } catch (e) {
      console.error('Failed to follow chart', e);
      // Rollback
      setPlaylist((prev: any) => ({
        ...prev,
        is_followed: previousFollowed,
        followed_playlist_id: previousFollowedId,
      }));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!playlist) return;
    const targetId = playlist.followed_playlist_id || playlist.id;
    if (!confirm(`Remove ${playlist.name} from your library?`)) return;

    const previousFollowed = playlist.is_followed;
    const previousFollowedId = playlist.followed_playlist_id;

    // Optimistic update
    setPlaylist((prev: any) => ({
      ...prev,
      is_followed: false,
      followed_playlist_id: null,
    }));
    window.dispatchEvent(new CustomEvent('playlists_changed'));

    try {
      const res = await fetch(`/api/v1/playlists/follow/${targetId}`, { method: 'DELETE' });
      if (res.ok) {
        if (
          !playlistId.startsWith('chart_') &&
          !playlistId.startsWith('dz_') &&
          !playlistId.startsWith('yt_')
        ) {
          onDeleted();
        }
      } else {
        // Rollback
        setPlaylist((prev: any) => ({
          ...prev,
          is_followed: previousFollowed,
          followed_playlist_id: previousFollowedId,
        }));
        window.dispatchEvent(new CustomEvent('playlists_changed'));
      }
    } catch (e) {
      console.error('Failed to unfollow', e);
      // Rollback
      setPlaylist((prev: any) => ({
        ...prev,
        is_followed: previousFollowed,
        followed_playlist_id: previousFollowedId,
      }));
      window.dispatchEvent(new CustomEvent('playlists_changed'));
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !playlist) return;
    const previousName = playlist.name;
    const previousDesc = playlist.description;
    const newName = editName.trim();
    const newDesc = editDescription.trim();

    // Optimistic update
    setPlaylist((prev: any) => ({
      ...prev,
      name: newName,
      description: newDesc,
    }));
    setIsEditingDetails(false);

    setSavingDetails(true);
    try {
      const res = await fetch(`/api/v1/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
        }),
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('playlists_changed'));
      } else {
        // Rollback
        setPlaylist((prev: any) => ({
          ...prev,
          name: previousName,
          description: previousDesc,
        }));
      }
    } catch (err) {
      console.error('Failed to update playlist details, rolling back', err);
      setPlaylist((prev: any) => ({
        ...prev,
        name: previousName,
        description: previousDesc,
      }));
    } finally {
      setSavingDetails(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this playlist? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/v1/playlists/${playlistId}`, { method: 'DELETE' });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('playlists_changed'));
        onDeleted();
      }
    } catch (e) {
      console.error('Failed to delete playlist', e);
    }
  };

  const handleShare = async () => {
    if (!playlist) return;
    const res = await shareContent(
      getPlaylistShareData(playlist.id, playlist.name || 'Playlist', playlist.cover_url),
    );
    if (res === 'copied' || res === 'shared') {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!playlist) return;
    const previousTracks = playlist.tracks || [];
    const previousCount = playlist.track_count ?? previousTracks.length;

    // Optimistic update: remove track immediately from UI
    setPlaylist((prev: any) =>
      prev
        ? {
            ...prev,
            tracks: (prev.tracks || []).filter((t: Track) => t.id !== trackId),
            track_count: Math.max(0, (prev.track_count ?? prev.tracks?.length ?? 1) - 1),
          }
        : null,
    );

    try {
      const res = await fetch(`/api/v1/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to remove track');
      }
      window.dispatchEvent(new CustomEvent('playlists_changed'));
    } catch (e) {
      console.error('Failed to remove track, rolling back:', e);
      // Rollback
      setPlaylist((prev: any) =>
        prev
          ? {
              ...prev,
              tracks: previousTracks,
              track_count: previousCount,
            }
          : null,
      );
    }
  };

  const handleReorderTracks = async (fromIdx: number, toIdx: number) => {
    const currentTracks: Track[] = playlist?.tracks || [];
    if (
      fromIdx === toIdx ||
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= currentTracks.length ||
      toIdx >= currentTracks.length
    )
      return;

    const previousTracks = [...currentTracks];
    const nextTracks = [...currentTracks];
    const [moved] = nextTracks.splice(fromIdx, 1);
    nextTracks.splice(toIdx, 0, moved);

    // Optimistic UI update
    setPlaylist((prev: any) => (prev ? { ...prev, tracks: nextTracks } : null));

    if (!isVirtualOrChart && playlistId) {
      try {
        const token = localStorage.getItem('audiohub_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (currentUser?.id) headers['X-User-Id'] = currentUser.id;

        const res = await fetch(`/api/v1/playlists/${playlistId}/tracks/reorder`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ track_ids: nextTracks.map((t) => t.id) }),
        });

        if (res.ok) {
          window.dispatchEvent(
            new CustomEvent('audiohub:toast', {
              detail: { message: 'Playlist order saved' },
            }),
          );
        } else {
          throw new Error('Failed to reorder playlist on server');
        }
      } catch (e) {
        console.error('Failed to reorder playlist tracks', e);
        // Rollback
        setPlaylist((prev: any) => (prev ? { ...prev, tracks: previousTracks } : null));
      }
    }
  };

  const handleDragStart = (idx: number, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTrackIndex(idx);
  };

  const handleDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTrackIndex !== idx) {
      setDragOverTrackIndex(idx);
    }
  };

  const handleDrop = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedTrackIndex !== null && draggedTrackIndex !== idx) {
      handleReorderTracks(draggedTrackIndex, idx);
    }
    setDraggedTrackIndex(null);
    setDragOverTrackIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedTrackIndex(null);
    setDragOverTrackIndex(null);
  };

  const handleTouchStart = (idx: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartYRef.current = touch.clientY;
    touchStartIndexRef.current = idx;
    touchCurrentTargetRef.current = idx;

    longPressTimerRef.current = setTimeout(() => {
      setIsTouchDragging(true);
      setDraggedTrackIndex(idx);
      setDragOverTrackIndex(idx);
      try {
        if (navigator.vibrate) navigator.vibrate(40);
      } catch {}
    }, 280);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!longPressTimerRef.current && !isTouchDragging) return;
    const touch = e.touches[0];

    if (!isTouchDragging) {
      if (Math.abs(touch.clientY - touchStartYRef.current) > 10) {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      return;
    }

    e.preventDefault();
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const rowEl = el?.closest('[data-playlist-track-index]');
    if (rowEl) {
      const targetIdx = Number(rowEl.getAttribute('data-playlist-track-index'));
      if (!isNaN(targetIdx) && targetIdx !== touchCurrentTargetRef.current) {
        touchCurrentTargetRef.current = targetIdx;
        setDragOverTrackIndex(targetIdx);
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
        handleReorderTracks(touchStartIndexRef.current, touchCurrentTargetRef.current);
      }
    }
    setIsTouchDragging(false);
    setDraggedTrackIndex(null);
    setDragOverTrackIndex(null);
    touchStartIndexRef.current = null;
    touchCurrentTargetRef.current = null;
  };

  if (loading) {
    return <PlaylistViewSkeleton />;
  }

  if (!playlist) {
    return <div className="flex-1 bg-[#121212] p-8 text-spotify-gray">Playlist not found</div>;
  }

  const tracks: Track[] = playlist.tracks || [];
  const isVirtualOrChart =
    playlist.is_chart ||
    playlist.is_radio ||
    playlistId.startsWith('chart_') ||
    playlistId.startsWith('dz_playlist_') ||
    playlistId.startsWith('yt_playlist_') ||
    playlistId.startsWith('radio_') ||
    Boolean(playlist.source_id);

  const currentPlaybackContext: PlaybackContext = {
    type: playlist.is_radio || playlistId.startsWith('radio_') ? 'radio' : 'playlist',
    id: playlist.id || playlistId,
    name: playlist.name || playlist.title || 'Playlist',
    cover_url: playlist.cover_url,
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#2a2a2a] via-[#121212] to-[#121212] text-white flex flex-col pb-44">
      {/* Navigation Breadcrumbs */}
      <div className="pt-2 px-1">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', tab: 'home' },
            { label: 'Your Library', tab: 'library' },
            { label: playlist.name || 'Playlist' },
          ]}
          backLabel="Library"
          onBack={() => {
            window.dispatchEvent(
              new CustomEvent('audiohub:navigate', { detail: { tab: 'library', id: null } }),
            );
          }}
        />
      </div>

      {/* Header */}
      <div
        className={`p-4 md:p-8 pt-2 md:pt-4 flex flex-col sm:flex-row items-center sm:items-end gap-4 md:gap-6 text-center sm:text-left transition-all duration-300 ${
          crateView === 'coverflow'
            ? 'py-2 md:py-3 pb-1 md:pb-2 border-b border-white/5'
            : 'pb-4 md:pb-6'
        }`}
      >
        <div
          className={`rounded-2xl bg-[#282828] shadow-2xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10 relative group transition-all duration-300 ${
            crateView === 'coverflow'
              ? 'w-14 h-14 sm:w-16 sm:h-16'
              : 'w-36 h-36 sm:w-48 sm:h-48 md:w-52 md:h-52'
          }`}
        >
          {playlist.cover_url ? (
            <img src={playlist.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music className="w-8 h-8 md:w-12 md:h-12 text-white/20" />
          )}
          {playlist.is_radio && crateView !== 'coverflow' && (
            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-purple-500 text-black font-black text-xs shadow-lg flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 fill-current" />
              <span>Song Radio</span>
            </div>
          )}
          {playlist.is_chart && !playlist.is_radio && crateView !== 'coverflow' && (
            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-emerald-500 text-black font-black text-xs shadow-lg">
              Official Chart
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 md:gap-1.5 min-w-0 flex-1">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-spotify-gray">
              {playlist.is_radio
                ? 'Song Radio'
                : playlist.source_type === 'youtube'
                  ? 'YouTube Playlist'
                  : playlist.is_chart
                    ? 'Curated Chart'
                    : 'Playlist'}
            </span>
            {playlist.is_radio && (
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-extrabold text-[10px] tracking-wider uppercase border border-purple-500/30 flex items-center gap-1">
                <Radio className="w-3 h-3 text-purple-400 animate-pulse" />
                <span>Continuous Radio</span>
              </span>
            )}
            {playlist.auto_update && !playlist.is_radio && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold text-[10px] tracking-wider uppercase border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>
                  {playlist.source_type === 'youtube'
                    ? 'Live / Dynamic Sync'
                    : 'Auto-Updates Weekly'}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
            <h1
              className={`font-black tracking-tight truncate ${
                crateView === 'coverflow'
                  ? 'text-xl sm:text-2xl md:text-3xl'
                  : 'text-2xl sm:text-4xl md:text-5xl lg:text-6xl'
              }`}
            >
              {playlist.name}
            </h1>
            {!isVirtualOrChart && (
              <button
                onClick={() => {
                  setEditName(playlist.name || '');
                  setEditDescription(playlist.description || '');
                  setIsEditingDetails(true);
                }}
                className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-spotify-gray hover:text-white transition-all hover:scale-110 active:scale-95"
                title="Edit playlist name & description"
              >
                <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
          {playlist.description && crateView !== 'coverflow' && (
            <p className="text-xs md:text-sm text-spotify-gray leading-relaxed max-w-2xl">
              {playlist.description}
            </p>
          )}
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs md:text-sm text-white/80 mt-1 font-medium">
            <span>{playlist.curator ? `Curated by ${playlist.curator}` : 'Your Library'}</span>
            <span>•</span>
            <span>{tracks.length} songs</span>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="px-4 md:px-8 py-3 md:py-4 flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4">
        <button
          onClick={() => {
            if (tracks.length > 0) {
              playTrack(tracks[0], tracks, currentPlaybackContext);
            }
          }}
          disabled={tracks.length === 0}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-spotify-green text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl disabled:opacity-50"
          title="Play All"
        >
          <Play className="w-6 h-6 md:w-7 md:h-7 fill-current ml-1" />
        </button>

        <button
          onClick={() => {
            if (tracks.length > 0) {
              playShuffle(tracks, currentPlaybackContext);
            }
          }}
          disabled={tracks.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all hover:scale-105 active:scale-95 border border-white/10 shadow-md disabled:opacity-50"
          title="Shuffle Play"
        >
          <Shuffle className="w-4 h-4 text-spotify-green" />
          <span>Shuffle</span>
        </button>

        {/* Follow / Save to Library Button for Curated Charts */}
        {isVirtualOrChart &&
          (playlist.is_followed ? (
            <button
              onClick={handleUnfollow}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 font-semibold text-xs transition-all group"
              title="Click to remove from Your Library"
            >
              <Check className="w-4 h-4 text-emerald-400 group-hover:hidden" />
              <X className="w-4 h-4 hidden group-hover:block text-red-400" />
              <span className="group-hover:hidden">
                {playlist.is_radio ? 'Saved to Library' : 'Saved to Library (Auto-Updates)'}
              </span>
              <span className="hidden group-hover:block">Remove from Library</span>
            </button>
          ) : (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 font-bold text-xs transition-all shadow-lg"
              title={
                playlist.is_radio
                  ? 'Save this song radio permanently to your personal library'
                  : 'Add to your library and keep auto-synced with weekly updates'
              }
            >
              <Plus className="w-4 h-4 text-black stroke-[3]" />
              <span>
                {playlist.is_radio
                  ? 'Save Radio to Library'
                  : 'Save to Library (Auto-Updates Weekly)'}
              </span>
            </button>
          ))}

        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all hover:scale-105 active:scale-95 border border-white/10 shadow-md"
          title={shareCopied ? 'Link Copied!' : 'Share Playlist (WhatsApp, Messenger, Copy Link)'}
        >
          {shareCopied ? (
            <Check className="w-3.5 h-3.5 text-spotify-green animate-pulse" />
          ) : (
            <Share2 className="w-3.5 h-3.5 text-spotify-green" />
          )}
          <span>{shareCopied ? 'Link Copied!' : 'Share Playlist'}</span>
        </button>

        {playlist.auto_update && (
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all hover:scale-105 active:scale-95 border border-white/10 shadow-md disabled:opacity-50"
            title="Force refresh playlist from source right now"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-spotify-green' : 'text-spotify-green'}`}
            />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        )}

        {!isVirtualOrChart && (
          <>
            <button
              onClick={() => {
                setEditName(playlist.name || '');
                setEditDescription(playlist.description || '');
                setIsEditingDetails(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all hover:scale-105 active:scale-95 border border-white/10 shadow-md"
              title="Edit name and description"
            >
              <Pencil className="w-3.5 h-3.5 text-spotify-green" />
              <span>Edit Details</span>
            </button>

            <button
              onClick={() => setIsManagerModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all hover:scale-105 active:scale-95 border border-white/10 shadow-md"
              title="Manage, select all, batch delete & export"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-spotify-green" />
              <span>Manage & Export</span>
            </button>

            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-semibold text-xs transition-all hover:scale-105 active:scale-95 border border-red-500/20 ml-auto sm:ml-0"
              title="Delete Playlist"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </>
        )}

        {/* Crate Digging View Toggle: [ Grid ] [ Cover Flow ] */}
        <div className="flex items-center bg-black/50 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-lg text-xs ml-auto">
          <button
            onClick={() => setCrateView('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
              crateView === 'grid'
                ? 'bg-white text-black shadow'
                : 'text-spotify-gray hover:text-white'
            }`}
            title="Standard Tracklist View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid / List</span>
          </button>
          <button
            onClick={() => setCrateView('coverflow')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
              crateView === 'coverflow'
                ? 'bg-spotify-green text-black shadow'
                : 'text-spotify-gray hover:text-white'
            }`}
            title="3D Cover Flow Crate Digging View"
          >
            <Disc3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cover Flow</span>
          </button>
        </div>
      </div>

      {/* Edit Details Modal */}
      {isEditingDetails && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#242424] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsEditingDetails(false)}
              className="absolute top-4 right-4 text-spotify-gray hover:text-white p-1 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-spotify-green" />
              <span>Edit Playlist Details</span>
            </h2>
            <form onSubmit={handleSaveDetails} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-spotify-gray uppercase tracking-wider mb-1">
                  Playlist Name *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  placeholder="e.g. My Favorite Bangers"
                  className="w-full bg-[#181818] border border-white/10 focus:border-spotify-green rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-spotify-gray uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  placeholder="Add an optional description..."
                  className="w-full bg-[#181818] border border-white/10 focus:border-spotify-green rounded-xl px-4 py-2 text-sm text-white placeholder-white/20 focus:outline-none resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingDetails(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-spotify-gray hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDetails || !editName.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-spotify-green hover:bg-[#1ed760] text-black font-bold text-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  {savingDetails ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Track List: Either 3D Cover Flow or Classic Table */}
      {crateView === 'coverflow' ? (
        <div className="px-2 md:px-8 flex-1 pb-12 animate-fadeIn">
          {tracks.length > 0 ? (
            <CoverflowBrowser
              items={tracks.map((track, idx) => ({
                id: track.id,
                title: track.title,
                subtitle: track.artist,
                coverUrl: track.cover_url || playlist.cover_url,
                badge: `#${idx + 1}`,
                meta: track.album
                  ? `${track.album} • ${formatTime(track.duration_seconds)}`
                  : formatTime(track.duration_seconds),
                raw: track,
              }))}
              onItemPlay={(item) => {
                if (item.raw) {
                  playTrack(item.raw, tracks, currentPlaybackContext);
                }
              }}
            />
          ) : (
            <div className="text-center py-16 text-spotify-gray">This playlist is empty.</div>
          )}
        </div>
      ) : (
        /* Classic Track List Table */
        <div className="px-2 md:px-8 flex-1 pb-12 animate-fadeIn">
          <div className="grid grid-cols-[24px_1fr_1fr_48px] md:grid-cols-[24px_1fr_1fr_1fr_48px] px-4 py-2 border-b border-white/10 text-xs text-spotify-gray font-semibold uppercase tracking-wider mb-2">
            <span>#</span>
            <span>Title</span>
            <span className="hidden md:block">Album</span>
            <span></span>
            <span className="text-right flex justify-end">
              <Clock className="w-4 h-4" />
            </span>
          </div>

          {tracks.length > 0 ? (
            <div className="flex flex-col gap-1">
              {tracks.map((track, idx) => {
                const isDragging = draggedTrackIndex === idx;
                const isDragOver = dragOverTrackIndex === idx && draggedTrackIndex !== idx;
                const isDropAbove =
                  isDragOver && draggedTrackIndex !== null && draggedTrackIndex > idx;
                const isDropBelow =
                  isDragOver && draggedTrackIndex !== null && draggedTrackIndex < idx;

                return (
                  <div
                    key={`${track.id}-${idx}`}
                    data-playlist-track-index={idx}
                    draggable={!isVirtualOrChart}
                    onDragStart={!isVirtualOrChart ? (e) => handleDragStart(idx, e) : undefined}
                    onDragOver={!isVirtualOrChart ? (e) => handleDragOver(idx, e) : undefined}
                    onDrop={!isVirtualOrChart ? (e) => handleDrop(idx, e) : undefined}
                    onDragEnd={!isVirtualOrChart ? handleDragEnd : undefined}
                    onTouchStart={!isVirtualOrChart ? (e) => handleTouchStart(idx, e) : undefined}
                    onTouchMove={!isVirtualOrChart ? handleTouchMove : undefined}
                    onTouchEnd={!isVirtualOrChart ? handleTouchEnd : undefined}
                    className={`group/reorder relative flex items-center transition-all ${
                      isDragging
                        ? 'opacity-30 scale-[0.98] border border-dashed border-spotify-green bg-white/5 rounded-md'
                        : isDragOver
                          ? 'bg-spotify-green/10 rounded-md'
                          : ''
                    } ${isDropAbove ? 'border-t-2 border-t-spotify-green' : ''} ${
                      isDropBelow ? 'border-b-2 border-b-spotify-green' : ''
                    }`}
                  >
                    {!isVirtualOrChart && (
                      <div
                        className="text-white/20 group-hover/reorder:text-white/80 transition-colors cursor-grab active:cursor-grabbing p-1 pl-2 -mr-1 flex-shrink-0 touch-none hidden sm:block"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <TrackRow
                        track={track}
                        index={idx}
                        playlistContext={tracks}
                        playbackContext={currentPlaybackContext}
                        onRemove={!isVirtualOrChart ? () => handleRemoveTrack(track.id) : undefined}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-spotify-gray gap-3">
              <p className="text-sm">This playlist is empty.</p>
            </div>
          )}
        </div>
      )}

      <PlaylistManagerModal
        isOpen={isManagerModalOpen}
        onClose={() => setIsManagerModalOpen(false)}
        title={playlist.name}
        tracks={tracks}
        onRefresh={fetchPlaylist}
        playlistId={playlistId}
      />
    </div>
  );
};
