import {
  ArrowDownToLine,
  ArrowUpDown,
  Clock,
  Heart,
  Loader2,
  Play,
  Shuffle,
  SlidersHorizontal,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { ImportPlaylistModal } from '../components/ImportPlaylistModal';
import { PlaylistManagerModal } from '../components/PlaylistManagerModal';
import { LikedSongsSkeleton } from '../components/SkeletonLoaders';
import { TrackRow } from '../components/TrackRow';
import { usePlayer } from '../context/PlayerContext';
import type { Track } from '../types';
import { formatPlaylistDuration } from '../utils/formatters';

export const LikedSongs: React.FC = () => {
  const { playTrack, playShuffle, currentTrack } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [reversing, setReversing] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

  const fetchLikedSongs = () => {
    fetch('/api/v1/tracks/liked')
      .then((res) => res.json())
      .then((data) => setTracks(data))
      .catch((e) => console.error('Failed to load liked songs', e))
      .finally(() => setLoading(false));
  };

  const handleReverseOrder = async () => {
    if (tracks.length === 0 || reversing) return;
    setReversing(true);
    try {
      const res = await fetch('/api/v1/tracks/liked/reverse', { method: 'POST' });
      if (res.ok) {
        fetchLikedSongs();
      }
    } catch (err) {
      console.error('Failed to reverse order', err);
    } finally {
      setReversing(false);
    }
  };

  useEffect(() => {
    fetchLikedSongs();

    const handleTrackLikeToggled = (e: Event) => {
      const { track, isLiked } = (e as CustomEvent).detail || {};
      if (!track) return;
      setTracks((prev) => {
        if (!isLiked) {
          return prev.filter((t) => t.id !== track.id);
        } else {
          if (prev.some((t) => t.id === track.id)) return prev;
          return [track, ...prev];
        }
      });
    };

    window.addEventListener('track_like_toggled', handleTrackLikeToggled);
    return () => {
      window.removeEventListener('track_like_toggled', handleTrackLikeToggled);
    };
  }, []);

  if (loading) {
    return <LikedSongsSkeleton />;
  }

  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration_seconds || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#491f8f]/60 via-[#121212] to-[#121212] text-white flex flex-col pb-44">
      {/* Big Spotify Header */}
      <div className="p-4 md:p-8 pb-4 md:pb-6 pt-[max(env(safe-area-inset-top,0px),2rem)] md:pt-8 flex flex-col sm:flex-row items-center sm:items-end gap-4 md:gap-6 text-center sm:text-left">
        <div className="w-36 h-36 sm:w-48 sm:h-48 md:w-52 md:h-52 rounded-xl bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-500 shadow-2xl flex items-center justify-center flex-shrink-0">
          <Heart className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 fill-white text-white drop-shadow-md" />
        </div>
        <div className="flex flex-col gap-1 md:gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-spotify-gray">
            Playlist
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold tracking-tight">
            Liked Songs
          </h1>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs md:text-sm text-white/80 mt-1 font-medium">
            <span>Family Master Library</span>
            <span>•</span>
            <span>{tracks.length} songs</span>
            {totalDuration > 0 && (
              <>
                <span>•</span>
                <span className="text-spotify-gray">{formatPlaylistDuration(totalDuration)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="px-4 md:px-8 py-3 md:py-4 flex flex-wrap items-center justify-center sm:justify-start gap-3">
        <button
          onClick={() => {
            if (tracks.length > 0)
              playTrack(tracks[0], tracks, { type: 'liked', name: 'Liked Songs' });
          }}
          disabled={tracks.length === 0}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-spotify-green text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl disabled:opacity-50"
          title="Play All"
        >
          <Play className="w-6 h-6 md:w-7 md:h-7 fill-current ml-1" />
        </button>

        <button
          onClick={() => {
            if (tracks.length > 0) playShuffle(tracks, { type: 'liked', name: 'Liked Songs' });
          }}
          disabled={tracks.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all hover:scale-105 active:scale-95 border border-white/10 shadow-md disabled:opacity-50"
          title="Shuffle Play Liked Songs"
        >
          <Shuffle className="w-4 h-4 text-spotify-green" />
          <span>Shuffle</span>
        </button>

        <button
          onClick={() => setIsImportModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all hover:scale-105 active:scale-95 border border-white/10 shadow-md"
          title="Import Liked Songs"
        >
          <ArrowDownToLine className="w-4 h-4 text-spotify-green" />
          <span>Import from Spotify / Exportify</span>
        </button>

        <button
          onClick={() => setIsManagerModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all hover:scale-105 active:scale-95 border border-white/10 shadow-md"
          title="Manage, select all, batch delete & export"
        >
          <SlidersHorizontal className="w-4 h-4 text-spotify-green" />
          <span>Manage & Export</span>
        </button>

        {tracks.length > 1 && (
          <button
            onClick={handleReverseOrder}
            disabled={reversing}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-semibold text-xs transition-all hover:scale-105 active:scale-95 border border-white/5 shadow-md"
            title="Reverse order of current liked songs"
          >
            {reversing ? (
              <Loader2 className="w-4 h-4 animate-spin text-spotify-green" />
            ) : (
              <ArrowUpDown className="w-4 h-4 text-spotify-green" />
            )}
            <span>Reverse Order</span>
          </button>
        )}
      </div>

      {/* Table Header */}
      <div className="px-2 md:px-8 flex-1">
        <div className="grid grid-cols-[24px_1fr_1fr_48px] md:grid-cols-[24px_1fr_1fr_1fr_48px] px-4 py-2 border-b border-white/10 text-xs text-spotify-gray font-semibold uppercase tracking-wider mb-2">
          <span>#</span>
          <span>Title</span>
          <span className="hidden md:block">Album</span>
          <span></span>
          <span className="text-right flex justify-end">
            <Clock className="w-4 h-4" />
          </span>
        </div>

        {/* Tracks List */}
        {tracks.length > 0 ? (
          <div className="flex flex-col gap-1 pb-12">
            {tracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                playlistContext={tracks}
                playbackContext={{ type: 'liked', name: 'Liked Songs' }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-spotify-gray flex flex-col items-center gap-3">
            <Heart className="w-12 h-12 text-white/20" />
            <p className="text-lg font-bold text-white">Songs you like will appear here</p>
            <p className="text-xs text-white/50">
              Save songs by tapping the heart icon anywhere in AudioHub, or import your entire
              library.
            </p>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-full bg-spotify-green text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Import from Spotify / Exportify</span>
            </button>
          </div>
        )}
      </div>

      <ImportPlaylistModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        defaultTarget="liked_songs"
        onSuccess={() => fetchLikedSongs()}
      />

      <PlaylistManagerModal
        isOpen={isManagerModalOpen}
        onClose={() => setIsManagerModalOpen(false)}
        title="Liked Songs"
        tracks={tracks}
        onRefresh={fetchLikedSongs}
        isLikedSongs
      />
    </div>
  );
};
