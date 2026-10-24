import { Clock, Globe, Lock, Music, Play, Plus, Trash2, UploadCloud } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  DetailHeaderSkeleton,
  SkeletonBox,
  TrackListSkeleton,
} from '../components/SkeletonLoaders';
import { TrackRow } from '../components/TrackRow';
import { UploadModal } from '../components/UploadModal';
import { usePlayer } from '../context/PlayerContext';
import type { Track } from '../types';
import { formatPlaylistDuration } from '../utils/formatters';

export const UploadsView: React.FC = () => {
  const { playTrack, currentTrack } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const fetchUploads = async () => {
    try {
      const res = await fetch('/api/v1/uploads/my-uploads');
      if (res.ok) {
        const data = await res.json();
        setTracks(data);
      }
    } catch (e) {
      console.error('Failed to load uploads', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const handleDelete = async (trackId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    const previousTracks = tracks;
    // Optimistic deletion
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    try {
      const res = await fetch(`/api/v1/uploads/${trackId}`, { method: 'DELETE' });
      if (!res.ok) {
        setTracks(previousTracks);
      }
    } catch (e) {
      console.error('Failed to delete upload', e);
      setTracks(previousTracks);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#1e3a5f]/40 via-[#121212] to-[#121212] text-white flex flex-col pb-44 select-none">
        <DetailHeaderSkeleton themeGradient="from-[#1e3a5f]/40" />
        <div className="px-4 md:px-8 py-3 md:py-4">
          <SkeletonBox className="w-12 h-12 md:w-14 md:h-14 rounded-full" />
        </div>
        <div className="px-2 md:px-8 flex-1">
          <TrackListSkeleton count={6} />
        </div>
      </div>
    );
  }

  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration_seconds || 0), 0);
  const durationLabel = formatPlaylistDuration(totalDuration);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#1e3a5f]/60 via-[#121212] to-[#121212] text-white flex flex-col pb-44 select-none">
      {/* Header Banner */}
      <div className="p-4 md:p-8 pb-4 md:pb-6 pt-[max(env(safe-area-inset-top,0px),2rem)] md:pt-8 flex flex-col sm:flex-row items-center sm:items-end gap-4 md:gap-6 text-center sm:text-left">
        <div className="w-36 h-36 sm:w-48 sm:h-48 md:w-52 md:h-52 rounded-xl bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 shadow-2xl flex items-center justify-center flex-shrink-0">
          <UploadCloud className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 fill-white text-white drop-shadow-md" />
        </div>
        <div className="flex flex-col gap-1 md:gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-spotify-gray">
            Personal Collection
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold tracking-tight">
            Your Uploads
          </h1>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs md:text-sm text-white/80 mt-1 font-medium">
            <span>AI Generations & Custom Audio</span>
            <span>•</span>
            <span>{tracks.length} tracks</span>
            {totalDuration > 0 && (
              <>
                <span>•</span>
                <span className="text-spotify-gray">{durationLabel}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="px-4 md:px-8 py-3 md:py-4 flex items-center justify-between sm:justify-start gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (tracks.length > 0)
                playTrack(tracks[0], tracks, {
                  type: 'playlist',
                  id: 'uploads',
                  name: 'Your Uploads',
                });
            }}
            disabled={tracks.length === 0}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-spotify-green text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl disabled:opacity-50"
            title="Play All"
          >
            <Play className="w-6 h-6 md:w-7 md:h-7 fill-current ml-1" />
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full text-xs font-bold transition-all border border-white/10"
          >
            <Plus className="w-4 h-4 text-spotify-green" />
            <span>Upload New Song</span>
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div className="px-2 md:px-8 flex-1">
        <div className="grid grid-cols-[24px_1fr_1fr_48px] md:grid-cols-[24px_1fr_1fr_120px_48px] px-4 py-2 border-b border-white/10 text-xs text-spotify-gray font-semibold uppercase tracking-wider mb-2">
          <span>#</span>
          <span>Title</span>
          <span className="hidden md:block">Album</span>
          <span className="hidden md:block">Privacy</span>
          <span className="text-right flex justify-end">
            <Clock className="w-4 h-4" />
          </span>
        </div>

        {/* Tracks List */}
        {loading ? (
          <div className="text-spotify-gray p-8 text-center">Loading uploaded audio...</div>
        ) : tracks.length > 0 ? (
          <div className="flex flex-col gap-1 pb-12">
            {tracks.map((track, idx) => (
              <div key={track.id} className="group relative flex items-center">
                <div className="flex-1">
                  <TrackRow
                    track={track}
                    index={idx}
                    playlistContext={tracks}
                    playbackContext={{ type: 'playlist', id: 'uploads', name: 'Your Uploads' }}
                  />
                </div>
                {/* Delete and privacy status */}
                <div className="absolute right-14 top-1/2 -translate-y-1/2 flex opacity-85 sm:opacity-0 sm:group-hover:opacity-100 items-center gap-2 bg-[#181818]/95 px-2 py-1 rounded shadow border border-white/5 transition-opacity">
                  <span className="text-[11px] text-spotify-gray flex items-center gap-1">
                    {track.is_private ? (
                      <>
                        <Lock className="w-3 h-3 text-yellow-400" />
                        <span className="text-yellow-400">Private</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3 h-3 text-spotify-green" />
                        <span className="text-spotify-green">Shared</span>
                      </>
                    )}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(track.id, track.title);
                    }}
                    className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-white/10 transition-colors"
                    title="Delete Upload"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-spotify-gray flex flex-col items-center gap-3">
            <Music className="w-12 h-12 text-white/20" />
            <p className="text-lg font-bold text-white">No uploaded music yet</p>
            <p className="text-xs text-white/50 max-w-sm">
              Upload AI creations from Suno, Udio, or your personal audio collection to stream
              anywhere.
            </p>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="mt-2 px-5 py-2.5 bg-spotify-green text-black font-bold rounded-full text-xs hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              Upload Your First Song
            </button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={(newTrack) => {
          setTracks((prev) => [newTrack, ...prev]);
        }}
      />
    </div>
  );
};
