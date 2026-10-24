import {
  ArrowDownCircle,
  Check,
  CheckCircle2,
  Heart,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Radio,
  Share2,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { downloadTrack, isDownloaded, removeDownloadedTrack } from '../services/offlineStorage';
import type { PlaybackContext, Track } from '../types';
import { formatDuration } from '../utils/formatters';
import { navigateToAlbum, navigateToArtist } from '../utils/navigation';
import { canShareTrack, getTrackShareData, shareContent } from '../utils/shareUtils';

import { useLongPress } from '../utils/useLongPress';
import { DancingBars } from './DancingBars';
import { TrackContextMenu } from './TrackContextMenu';

interface TrackRowProps {
  track: Track;
  index: number;
  playlistContext?: Track[];
  playbackContext?: PlaybackContext;
  onRemove?: () => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  playlistContext,
  playbackContext,
  onRemove,
}) => {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    toggleLike,
    activeRoom,
    addTrackToRoomQueue,
    isTrackLiked,
    playbackContext: activePlaybackContext,
  } = usePlayer();
  const isLiked = isTrackLiked(track);
  const [downloaded, setDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    isDownloaded(track.id).then(setDownloaded);
  }, [track.id]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleAddToRoom = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeRoom) {
      await addTrackToRoomQueue(track);
    }
  };

  const isCurrent = currentTrack?.id === track.id;
  const isDifferentContext =
    playbackContext &&
    activePlaybackContext &&
    (playbackContext.type !== activePlaybackContext.type ||
      playbackContext.id !== activePlaybackContext.id);

  const handlePlay = () => {
    if (isCurrent && !isDifferentContext) {
      togglePlay();
    } else {
      playTrack(track, playlistContext, playbackContext);
    }
  };

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleLike(track);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await shareContent(getTrackShareData(track));
    if (res === 'copied' || res === 'shared') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenContextMenu = (pos?: { x: number; y: number }) => {
    setContextMenuPos(pos || null);
    setShowContextMenu(true);
  };

  const longPressProps = useLongPress({
    threshold: 450,
    onLongPress: () => {
      handleOpenContextMenu();
    },
    onClick: () => {
      handlePlay();
    },
  });

  return (
    <div
      {...longPressProps}
      onContextMenu={(e) => {
        e.preventDefault();
        handleOpenContextMenu({ x: e.clientX, y: e.clientY });
      }}
      className={`group flex items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2.5 sm:py-2 rounded-md hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer text-sm select-none ${
        isCurrent ? 'bg-white/10' : ''
      }`}
    >
      {/* Index or Play icon */}
      <div className="w-5 sm:w-6 text-center text-spotify-gray flex-shrink-0 flex items-center justify-center text-xs">
        {isCurrent ? (
          <div className="group-hover:hidden flex items-center justify-center">
            <DancingBars isPlaying={isPlaying} />
          </div>
        ) : (
          <span className={`group-hover:hidden ${isCurrent ? 'text-spotify-green font-bold' : ''}`}>
            {index + 1}
          </span>
        )}
        <button className="hidden group-hover:block text-white">
          {isCurrent && isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
      </div>

      {/* Artwork & Title & Artist */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 bg-[#282828] rounded overflow-hidden flex-shrink-0 shadow">
          {track.cover_url ? (
            <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs">🎵</div>
          )}
        </div>
        <div className="flex flex-col min-w-0 truncate">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span
              className={`font-medium text-xs sm:text-sm truncate ${
                isCurrent ? 'text-spotify-green font-bold' : 'text-white'
              }`}
            >
              {track.title}
            </span>
            {track.is_uploaded && (
              <span className="flex-shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Uploaded
              </span>
            )}
          </div>
          <span
            onClick={(e) => {
              e.stopPropagation();
              navigateToArtist(track.artist, (track as any).artist_id);
            }}
            className="text-[11px] sm:text-xs text-spotify-gray truncate hover:underline hover:text-white cursor-pointer z-10"
            title={`View ${track.artist}`}
          >
            {track.artist}
          </span>
        </div>
      </div>

      {/* Album (Desktop Only) */}
      <div className="w-1/4 truncate text-xs text-spotify-gray hidden md:block">
        {(track as any).album_id ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              navigateToAlbum((track as any).album_id);
            }}
            className="hover:underline hover:text-white cursor-pointer z-10"
            title={`View ${track.album || 'Single'}`}
          >
            {track.album || 'Single'}
          </span>
        ) : (
          track.album || 'Single'
        )}
      </div>

      {/* Action Buttons: Add to Room, Download Offline, Like */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        {/* Add to Room Speaker Queue button if in a session */}
        {activeRoom && (
          <button
            onClick={handleAddToRoom}
            onTouchStart={(e) => e.stopPropagation()}
            className="text-spotify-gray hover:text-spotify-green p-1.5 transition-colors"
            title="Queue track on Room Speaker"
          >
            <Radio className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Offline Download button - Always visible on mobile, hover on desktop */}
        <button
          onClick={handleDownload}
          onTouchStart={(e) => e.stopPropagation()}
          disabled={isDownloading}
          className="text-spotify-gray hover:text-white p-1.5 transition-colors"
          title={downloaded ? 'Remove offline download' : 'Download for offline playback'}
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 text-spotify-green animate-spin" />
          ) : downloaded ? (
            <CheckCircle2 className="w-4 h-4 text-spotify-green fill-spotify-green/20" />
          ) : (
            <ArrowDownCircle className="w-4 h-4 opacity-40 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
          )}
        </button>

        {/* Like Heart Button - Subtle visible on mobile, hover on desktop */}
        <button
          onClick={handleLikeToggle}
          onTouchStart={(e) => e.stopPropagation()}
          className="text-spotify-gray hover:text-white p-1.5 transition-transform active:scale-125"
        >
          <Heart
            className={`w-4 h-4 transition-all ${
              isLiked
                ? 'text-spotify-green fill-spotify-green opacity-100'
                : 'opacity-40 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
            }`}
          />
        </button>

        {/* Share Track Button (Enabled for all except private uploaded songs) */}
        {canShareTrack(track) && (
          <button
            onClick={handleShare}
            onTouchStart={(e) => e.stopPropagation()}
            className="text-spotify-gray hover:text-white p-1.5 transition-colors opacity-40 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            title={copied ? 'Link Copied!' : 'Share Track'}
          >
            {copied ? (
              <Check className="w-4 h-4 text-spotify-green animate-pulse" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Duration */}
      <div className="w-10 sm:w-12 text-right text-[11px] sm:text-xs text-spotify-gray font-mono flex-shrink-0">
        {formatDuration(track.duration_seconds)}
      </div>

      {/* 3-dots Context Menu Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleOpenContextMenu({ x: e.clientX, y: e.clientY });
        }}
        onTouchStart={(e) => e.stopPropagation()}
        className="text-spotify-gray hover:text-white p-1.5 transition-colors opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0"
        title="More Options (Play Next, Add to Queue, Playlist...)"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {/* Remove Track from Playlist */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onTouchStart={(e) => e.stopPropagation()}
          className="text-spotify-gray hover:text-red-400 p-1.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 text-xs active:scale-95 transition-opacity flex-shrink-0"
          title="Remove from playlist"
        >
          ✕
        </button>
      )}

      {/* Context Menu Modal / Bottom Sheet */}
      <TrackContextMenu
        track={track}
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        anchorPosition={contextMenuPos}
        onRemove={onRemove}
      />
    </div>
  );
};
