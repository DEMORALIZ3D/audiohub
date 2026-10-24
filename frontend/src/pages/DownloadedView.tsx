import { ArrowDownCircle, Clock, HardDrive, Music, Play, Trash2 } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  DetailHeaderSkeleton,
  SkeletonBox,
  TrackListSkeleton,
} from '../components/SkeletonLoaders';
import { TrackRow } from '../components/TrackRow';
import { usePlayer } from '../context/PlayerContext';
import { getDownloadedTracks, removeDownloadedTrack } from '../services/offlineStorage';
import type { Track } from '../types';
import { formatPlaylistDuration } from '../utils/formatters';

export const DownloadedView: React.FC = () => {
  const { playTrack } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDownloaded = async () => {
    try {
      const data = await getDownloadedTracks();
      setTracks(data);
    } catch (e) {
      console.error('Failed to load offline tracks', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDownloaded();
  }, []);

  const handleDelete = async (trackId: string) => {
    // Optimistic deletion
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    await removeDownloadedTrack(trackId);
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#14532d]/40 via-[#121212] to-[#121212] text-white flex flex-col pb-44 select-none">
        <DetailHeaderSkeleton themeGradient="from-[#14532d]/40" />
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

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#14532d]/60 via-[#121212] to-[#121212] text-white flex flex-col pb-44 select-none">
      {/* Header */}
      <div className="p-4 md:p-8 pb-4 md:pb-6 pt-[max(env(safe-area-inset-top,0px),2rem)] md:pt-8 flex flex-col sm:flex-row items-center sm:items-end gap-4 md:gap-6 text-center sm:text-left">
        <div className="w-36 h-36 sm:w-48 sm:h-48 md:w-52 md:h-52 rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-green-700 shadow-2xl flex items-center justify-center flex-shrink-0">
          <ArrowDownCircle className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 fill-white text-white drop-shadow-md" />
        </div>
        <div className="flex flex-col gap-1 md:gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-spotify-gray">
            Device Storage
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold tracking-tight">
            Offline Music
          </h1>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs md:text-sm text-white/80 mt-1 font-medium">
            <span>Stored in Browser / Phone Storage</span>
            <span>•</span>
            <span>{tracks.length} downloaded tracks</span>
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
      <div className="px-4 md:px-8 py-3 md:py-4 flex items-center gap-6">
        <button
          onClick={() => {
            if (tracks.length > 0)
              playTrack(tracks[0], tracks, {
                type: 'playlist',
                id: 'downloaded',
                name: 'Downloaded Offline',
              });
          }}
          disabled={tracks.length === 0}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-spotify-green text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl disabled:opacity-50"
          title="Play All Offline"
        >
          <Play className="w-6 h-6 md:w-7 md:h-7 fill-current ml-1" />
        </button>
      </div>

      {/* Table Header */}
      <div className="px-2 md:px-8 flex-1">
        <div className="grid grid-cols-[24px_1fr_1fr_48px] md:grid-cols-[24px_1fr_1fr_48px] px-4 py-2 border-b border-white/10 text-xs text-spotify-gray font-semibold uppercase tracking-wider mb-2">
          <span>#</span>
          <span>Title</span>
          <span className="hidden md:block">Album</span>
          <span className="text-right flex justify-end">
            <Clock className="w-4 h-4" />
          </span>
        </div>

        {/* Tracks List */}
        {loading ? (
          <div className="text-spotify-gray p-8 text-center">Loading offline audio...</div>
        ) : tracks.length > 0 ? (
          <div className="flex flex-col gap-1 pb-12">
            {tracks.map((track, idx) => (
              <div key={track.id} className="group relative flex items-center">
                <div className="flex-1">
                  <TrackRow
                    track={track}
                    index={idx}
                    playlistContext={tracks}
                    playbackContext={{
                      type: 'playlist',
                      id: 'downloaded',
                      name: 'Downloaded Offline',
                    }}
                  />
                </div>
                {/* Delete offline track button on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(track.id);
                  }}
                  className="absolute right-12 top-1/2 -translate-y-1/2 flex opacity-70 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-full hover:bg-white/10 active:scale-95 text-spotify-gray hover:text-red-400 transition-all"
                  title="Remove from offline downloads"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-spotify-gray flex flex-col items-center gap-3">
            <ArrowDownCircle className="w-12 h-12 text-white/20" />
            <p className="text-lg font-bold text-white">No offline music saved</p>
            <p className="text-xs text-white/50 max-w-sm">
              Save any song or album for offline flights and subways by tapping the download icon on
              any track row.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
