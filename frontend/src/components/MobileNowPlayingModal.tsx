import {
  Cast,
  Check,
  ChevronDown,
  Disc3,
  Film,
  Heart,
  Info,
  Layers,
  ListMusic,
  Loader2,
  Mic2,
  Moon,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Sparkles,
  Speaker,
  Tv,
  Users,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useConnect } from '../context/ConnectContext';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';
import { navigateToArtist } from '../utils/navigation';
import { canShareTrack, getTrackShareData, shareContent } from '../utils/shareUtils';
import { useVinylArtPreference } from '../utils/vinylSettings';
import { EqualizerModal } from './EqualizerModal';
import { GroupSessionModal } from './GroupSessionModal';
import { ProgressBar } from './ProgressBar';
import { SleepTimerModal } from './SleepTimerModal';
import { SongInfoModal } from './SongInfoModal';
import { TrackContextMenu } from './TrackContextMenu';
import { VideoPlayerView } from './VideoPlayerView';

interface MobileNowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNowPlayingModal: React.FC<MobileNowPlayingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentTrack,
    playbackContext,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    isShuffle,
    repeatMode,
    isCastConnected,
    castDeviceName,
    requestCastSession,
    endCastSession,
    setShowDeviceModal,
    activeAudioOutputId,
    togglePlay,
    seek,
    toggleShuffle,
    toggleRepeat,
    nextTrack,
    prevTrack,
    toggleLike,
    isTrackLiked,
    toggleLyrics,
    toggleQueue,
    sleepTimerRemaining,
    sleepTimerMode,
    isEQEnabled,
    activeRoom,
    setShowVisualizer,
    videoDisplayMode,
    setVideoDisplayMode,
    canPlayVideo,
    youtubeVideoId,
    networkInfo,
    currentPalette,
  } = usePlayer();

  const {
    isRemoteControlActive,
    activeRemoteDevice,
    remoteTogglePlay,
    remoteNext,
    remotePrev,
    remoteSeek,
    controlRemoteDevice,
    takeOverPlaybackLocally,
    isPartyMode,
    syncDeltaMs,
  } = useConnect();

  const isRemote = isRemoteControlActive && !!activeRemoteDevice?.current_track;
  const activeTrack = isRemote ? activeRemoteDevice.current_track! : currentTrack;
  const activePlaying = isRemote ? !!activeRemoteDevice.is_playing : isPlaying;
  const activeCurrentTime = isRemote ? activeRemoteDevice.position_seconds || 0 : currentTime;
  const activeDuration = isRemote
    ? activeRemoteDevice.duration_seconds || activeRemoteDevice.current_track?.duration_seconds || 0
    : duration;

  const handleTogglePlay = isRemote ? remoteTogglePlay : togglePlay;
  const handleNext = isRemote ? remoteNext : nextTrack;
  const handlePrev = isRemote ? remotePrev : prevTrack;
  const handleSeek = isRemote ? remoteSeek : seek;

  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showEQModal, setShowEQModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showTrackMenu, setShowTrackMenu] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isVinylArt, setVinylArt] = useVinylArtPreference();

  const handleShareTrack = async () => {
    if (!activeTrack) return;
    const res = await shareContent(getTrackShareData(activeTrack));
    if (res === 'copied' || res === 'shared') {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  if (!isOpen || !activeTrack) return null;

  const isLiked = isTrackLiked(activeTrack);

  return (
    <div className="md:hidden fixed inset-0 z-50 bg-gradient-to-b from-[#333333] via-[#181818] to-[#121212] flex flex-col p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] text-white select-none animate-slideUp overflow-hidden">
      {/* Background Full-Bleed Video (Cover or Backdrop behind Album Art) */}
      {!isRemote && canPlayVideo && youtubeVideoId && videoDisplayMode !== 'off' && (
        <VideoPlayerView
          videoId={youtubeVideoId}
          title={activeTrack.title}
          artist={activeTrack.artist}
          startTime={activeCurrentTime}
          mode={videoDisplayMode}
          isMobile
        />
      )}

      {/* Foreground Interactive Content */}
      <div className="relative z-10 flex flex-col justify-between h-full">
        {/* Top Bar with Down Chevron */}
        <div className="flex items-center justify-between pb-2">
          <button onClick={onClose} className="p-2 -ml-2 text-white hover:text-spotify-gray">
            <ChevronDown className="w-7 h-7" />
          </button>
          <div className="flex flex-col items-center max-w-[220px]">
            {isRemote && activeRemoteDevice ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-widest text-spotify-green flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-spotify-green animate-pulse" />
                  Remote Control
                </span>
                <span className="text-xs font-bold truncate max-w-[200px]">
                  {activeRemoteDevice.name}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-bold uppercase tracking-widest text-spotify-gray truncate">
                  {playbackContext?.type === 'radio'
                    ? '📻 Continuous Radio'
                    : playbackContext?.type === 'playlist'
                      ? `Playing From Playlist`
                      : playbackContext?.type === 'album'
                        ? `Playing From Album`
                        : playbackContext?.type === 'artist'
                          ? `Playing From Artist`
                          : playbackContext?.type === 'liked'
                            ? 'Liked Songs'
                            : 'Playing From AudioHub'}
                </span>
                <span className="text-xs font-bold truncate max-w-[200px]">
                  {playbackContext?.name || activeTrack.album || activeTrack.artist}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 -mr-2">
            <button
              onClick={() => setVinylArt(!isVinylArt)}
              className={`p-2 transition-colors ${
                isVinylArt ? 'text-spotify-green' : 'text-spotify-gray hover:text-white'
              }`}
              title="Toggle Vinyl Disc Art"
            >
              <Disc3
                className={`w-5 h-5 ${isVinylArt && activePlaying ? 'animate-spin' : ''}`}
                style={{ animationDuration: '4s' }}
              />
            </button>
            <button
              onClick={() => setShowVisualizer(true)}
              className="p-2 text-spotify-gray hover:text-white"
              title="Open WebGL Visualizer"
            >
              <Sparkles className="w-5 h-5 text-spotify-green animate-pulse" />
            </button>
            <button
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('audiohub:open-tv'));
              }}
              className="p-2 text-spotify-gray hover:text-white"
              title="Launch TV Leanback View"
            >
              <Tv className="w-5 h-5 text-spotify-gray hover:text-spotify-green transition-colors" />
            </button>
            <button onClick={toggleQueue} className="p-2 text-spotify-gray hover:text-white">
              <ListMusic className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Spotify Connect Active Device Banner */}
        {isRemote && activeRemoteDevice && (
          <div className="mx-1 my-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-spotify-green/20 via-spotify-green/10 to-transparent border border-spotify-green/40 flex items-center justify-between shadow-lg shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="relative flex items-center justify-center shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-spotify-green animate-ping absolute opacity-75" />
                <span className="w-2 h-2 rounded-full bg-spotify-green relative" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-spotify-green tracking-wider uppercase truncate">
                  Listening on
                </span>
                <span className="text-xs font-semibold text-white truncate">
                  {activeRemoteDevice.name} (Speakers)
                </span>
              </div>
            </div>
            <button
              onClick={takeOverPlaybackLocally}
              className="shrink-0 px-3 py-1.5 rounded-full bg-spotify-green text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-1"
            >
              <span>🎧 Play on this phone</span>
            </button>
          </div>
        )}

        {/* 3-Mode Segmented Pill Switcher: Song / Backdrop / Video */}
        {!isRemote && canPlayVideo && (
          <div className="flex items-center justify-center my-1 z-20">
            <div className="bg-[#181818]/80 backdrop-blur-xl p-1 rounded-full flex items-center gap-1 border border-white/10 shadow-2xl">
              <button
                onClick={() => setVideoDisplayMode('off')}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  videoDisplayMode === 'off'
                    ? 'bg-white text-black shadow-md'
                    : 'text-spotify-gray hover:text-white'
                }`}
                title="Song Mode (Album Art Only)"
              >
                <Music2 className="w-3.5 h-3.5" />
                <span>Song</span>
              </button>

              <button
                onClick={() => setVideoDisplayMode('backdrop')}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  videoDisplayMode === 'backdrop'
                    ? 'bg-spotify-green text-black shadow-md'
                    : 'text-spotify-gray hover:text-white'
                }`}
                title="Play Video behind Album Art"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Backdrop</span>
              </button>

              <button
                onClick={() => setVideoDisplayMode('cover')}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  videoDisplayMode === 'cover'
                    ? 'bg-spotify-green text-black shadow-md'
                    : 'text-spotify-gray hover:text-white'
                }`}
                title="Full Video Mode (Instead of Album Art)"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Video</span>
                {networkInfo.isWifiOrFast && (
                  <span className="text-[9px] px-1 py-0.2 bg-black/30 text-black font-extrabold rounded font-mono">
                    HD
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Center Stage: Either Floating Album Art or Open Screen for Video */}
        <div className="my-auto py-2 flex justify-center items-center w-full">
          {!isRemote && videoDisplayMode === 'cover' ? (
            /* Video Mode: Album art hidden, video occupies screen. Tap to toggle play/pause */
            <div
              onClick={handleTogglePlay}
              className="w-full h-48 sm:h-64 flex items-center justify-center cursor-pointer group"
            >
              <div className="opacity-0 group-active:opacity-100 transition-opacity bg-black/60 backdrop-blur-md p-4 rounded-full">
                {activePlaying ? (
                  <Pause className="w-8 h-8 text-white" />
                ) : (
                  <Play className="w-8 h-8 text-white" />
                )}
              </div>
            </div>
          ) : (
            /* Song Mode or Backdrop Mode: Album Art centered */
            <div
              onClick={() => setShowVisualizer(true)}
              className={`w-full max-w-[300px] aspect-square overflow-hidden shadow-2xl relative group cursor-pointer active:scale-95 transition-all duration-500 ${
                isVinylArt
                  ? 'rounded-full bg-[#08080a] p-1.5 ring-2 ring-white/10 shadow-black'
                  : 'rounded-2xl bg-[#282828] border border-white/10'
              }`}
              title="Tap to open Visualizer Stage"
            >
              <div
                className={`w-full h-full relative overflow-hidden ${
                  isVinylArt ? 'rounded-full' : 'rounded-2xl'
                }`}
              >
                {isVinylArt ? (
                  /* Realistic 12" Vinyl Disc: Black grooved platter with center circular sticker */
                  <>
                    <div
                      className={`w-full h-full relative rounded-full bg-[#0c0c0e] flex items-center justify-center overflow-hidden ${
                        activePlaying ? 'azify-vinyl-spin' : ''
                      }`}
                    >
                      {/* Concentric Grooves */}
                      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,#0d0d0f_0%,#0d0d0f_36%,#18181c_40%,#0d0d0f_44%,#18181c_48%,#0d0d0f_52%,#18181c_56%,#0d0d0f_60%,#18181c_64%,#0d0d0f_68%,#18181c_72%,#0d0d0f_76%,#18181c_80%,#0d0d0f_84%,#18181c_88%,#0a0a0c_94%,#222228_100%)] pointer-events-none" />

                      {/* Album Art Color Wax Glow / Translucent Tint */}
                      {currentPalette?.primary && (
                        <div
                          className="absolute inset-0 rounded-full pointer-events-none opacity-30 mix-blend-screen transition-opacity duration-700"
                          style={{
                            background: `radial-gradient(circle at center, transparent 36%, ${currentPalette.primary} 65%, transparent 95%)`,
                          }}
                        />
                      )}

                      {/* Center Circular Label: Album art strictly contained here */}
                      <div className="relative w-[38%] h-[38%] rounded-full overflow-hidden border-2 border-white/30 shadow-2xl z-10 flex items-center justify-center bg-[#181818]">
                        {activeTrack.cover_url ? (
                          <img
                            src={activeTrack.cover_url}
                            alt={activeTrack.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl bg-[#282828]">
                            🎵
                          </div>
                        )}
                        {/* Spindle Center Hole */}
                        <div className="absolute w-4 h-4 rounded-full bg-[#0a0a0c] border border-white/60 shadow-inner z-20 pointer-events-none" />
                      </div>
                    </div>

                    {/* Stationary Anisotropic Light Reflection (Sways subtly with room lighting instead of rotating with disc) */}
                    <div
                      className={`absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.16)_45deg,transparent_90deg,transparent_180deg,rgba(255,255,255,0.16)_225deg,transparent_270deg)] pointer-events-none mix-blend-screen z-20 ${
                        activePlaying ? 'azify-vinyl-sheen-sway' : ''
                      }`}
                    />
                  </>
                ) : /* Standard Square Album Art */
                activeTrack.cover_url ? (
                  <img
                    src={activeTrack.cover_url}
                    alt={activeTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🎵</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Track Details & Heart */}
        <div className="flex items-center justify-between mb-4 mt-2">
          <div className="flex flex-col truncate pr-4">
            <h2 className="text-xl font-extrabold truncate text-white">{activeTrack.title}</h2>
            <p
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                navigateToArtist(activeTrack.artist, (activeTrack as any).artist_id);
              }}
              className="text-sm text-spotify-gray truncate mt-0.5 hover:underline hover:text-white cursor-pointer"
              title={`View ${activeTrack.artist}`}
            >
              {activeTrack.artist}
            </p>
            {isPartyMode ? (
              <span className="text-[11px] text-purple-300 font-bold flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
                <span>
                  Speaker Group:{' '}
                  {syncDeltaMs === null
                    ? 'Syncing...'
                    : syncDeltaMs === 0
                      ? 'Master Anchor'
                      : `±${Math.abs(syncDeltaMs)}ms`}
                </span>
              </span>
            ) : isRemote && activeRemoteDevice ? (
              <span className="text-[11px] text-spotify-green font-bold flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-spotify-green animate-pulse shrink-0" />
                <span>Controlling {activeRemoteDevice.name}</span>
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setShowInfoModal(true)}
              className="text-spotify-gray hover:text-white p-2 transition-colors"
              title="Inspect Audio Source"
            >
              <Info className="w-5 h-5" />
            </button>
            {canShareTrack(activeTrack) && (
              <button
                onClick={handleShareTrack}
                className="text-spotify-gray hover:text-white p-2 transition-colors"
                title={shareCopied ? 'Link Copied!' : 'Share Track'}
              >
                {shareCopied ? (
                  <Check className="w-5 h-5 text-spotify-green animate-pulse" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
              </button>
            )}
            <button
              onClick={() => toggleLike(activeTrack)}
              className="text-spotify-gray hover:text-white p-2 transition-transform active:scale-125"
              title={isLiked ? 'Unlike' : 'Like'}
            >
              <Heart
                className={`w-7 h-7 transition-colors ${
                  isLiked ? 'text-spotify-green fill-spotify-green' : ''
                }`}
              />
            </button>
            <button
              onClick={() => setShowTrackMenu(true)}
              className="text-spotify-gray hover:text-white p-2 transition-colors"
              title="More Options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrubber Bar */}
        <div className="flex flex-col gap-1 mb-6">
          <ProgressBar
            currentTime={activeCurrentTime}
            duration={activeDuration}
            onSeek={handleSeek}
            size="md"
          />
          <div className="flex justify-between text-xs text-spotify-gray font-mono mt-0.5">
            <span>{formatTime(activeCurrentTime)}</span>
            <span>{formatTime(activeDuration)}</span>
          </div>
        </div>

        {/* Play Controls Row */}
        <div className="flex items-center justify-between mb-8 px-2">
          <button
            onClick={toggleShuffle}
            disabled={isRemote}
            className={`transition-colors ${
              isShuffle ? 'text-spotify-green' : 'text-spotify-gray'
            } ${isRemote ? 'opacity-40' : ''}`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button onClick={handlePrev} className="text-white hover:text-spotify-gray">
            <SkipBack className="w-8 h-8 fill-current" />
          </button>

          <button
            onClick={handleTogglePlay}
            className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl active:scale-95 transition-transform"
          >
            {isBuffering && !isRemote ? (
              <Loader2 className="w-8 h-8 animate-spin text-black" />
            ) : activePlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>

          <button onClick={handleNext} className="text-white hover:text-spotify-gray">
            <SkipForward className="w-8 h-8 fill-current" />
          </button>

          <button
            onClick={toggleRepeat}
            disabled={isRemote}
            className={`transition-colors ${
              repeatMode !== 'off' ? 'text-spotify-green' : 'text-spotify-gray'
            } ${isRemote ? 'opacity-40' : ''}`}
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Bottom Controls (Lyrics, Cast, Sleep Timer, EQ, Group Session) */}
        <div className="flex items-center justify-between pb-2 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={toggleLyrics}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
            >
              <Mic2 className="w-3.5 h-3.5 text-spotify-green" />
              <span>Lyrics</span>
            </button>

            {/* Device Selection & Connect Button */}
            <button
              onClick={() => setShowDeviceModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                isPartyMode
                  ? 'bg-purple-950/60 text-purple-300 border border-purple-500/40 shadow-sm'
                  : isRemote
                    ? 'bg-spotify-green text-black font-bold shadow-md'
                    : isCastConnected || activeAudioOutputId !== 'default'
                      ? 'bg-spotify-green/20 text-spotify-green border border-spotify-green/40'
                      : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {isPartyMode ? (
                <Layers className="w-3.5 h-3.5 animate-pulse text-purple-300" />
              ) : isRemote ? (
                <Speaker className="w-3.5 h-3.5 animate-pulse" />
              ) : isCastConnected ? (
                <Cast className="w-3.5 h-3.5 animate-pulse" />
              ) : (
                <Speaker className="w-3.5 h-3.5" />
              )}
              <span className="truncate max-w-[100px]">
                {isPartyMode
                  ? syncDeltaMs === 0
                    ? 'Master'
                    : syncDeltaMs !== null
                      ? `±${Math.abs(syncDeltaMs)}ms`
                      : 'Party'
                  : isRemote
                    ? activeRemoteDevice?.name || 'Remote'
                    : isCastConnected
                      ? castDeviceName
                      : activeAudioOutputId !== 'default'
                        ? 'Speaker'
                        : 'Device'}
              </span>
            </button>

            {/* Launch TV Visualizer on Connected Screen */}
            {isRemote &&
              activeRemoteDevice &&
              ((activeRemoteDevice as any).has_screen ||
                activeRemoteDevice.device_type === 'tv') && (
                <button
                  onClick={() => {
                    controlRemoteDevice(activeRemoteDevice.id, 'launch_tv');
                    window.dispatchEvent(
                      new CustomEvent('audiohub:toast', {
                        detail: { message: `Opening TV Visualizer on ${activeRemoteDevice.name}!` },
                      }),
                    );
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/40 hover:bg-purple-600 hover:text-white transition-colors text-xs font-semibold shadow-sm"
                  title="Open full AudioHub TV stage with spinning vinyl & live lyrics on this screen"
                >
                  <Tv className="w-3.5 h-3.5 text-purple-300" />
                  <span>TV Stage</span>
                </button>
              )}

            {/* Sleep Timer */}
            <button
              onClick={() => setShowSleepModal(true)}
              className={`p-2 rounded-full transition-colors relative ${
                sleepTimerRemaining !== null || sleepTimerMode === 'end_of_track'
                  ? 'bg-spotify-green/20 text-spotify-green border border-spotify-green/40'
                  : 'bg-white/10 text-white'
              }`}
              title="Sleep Timer"
            >
              <Moon className="w-3.5 h-3.5" />
              {(sleepTimerRemaining !== null || sleepTimerMode === 'end_of_track') && (
                <span className="absolute -top-1 -right-1 text-[8px] font-extrabold text-spotify-green">
                  {sleepTimerRemaining !== null ? `${Math.ceil(sleepTimerRemaining / 60)}m` : '1s'}
                </span>
              )}
            </button>

            {/* Equalizer */}
            <button
              onClick={() => setShowEQModal(true)}
              className={`p-2 rounded-full transition-colors relative ${
                isEQEnabled
                  ? 'bg-spotify-green/20 text-spotify-green border border-spotify-green/40'
                  : 'bg-white/10 text-white'
              }`}
              title="Audio Equalizer"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            {/* Group Session */}
            <button
              onClick={() => setShowRoomModal(true)}
              className={`p-2 rounded-full transition-colors relative ${
                activeRoom
                  ? 'bg-spotify-green/20 text-spotify-green border border-spotify-green/40'
                  : 'bg-white/10 text-white'
              }`}
              title="Group Session"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-[10px] font-mono text-spotify-gray">
            {activeTrack.source_type?.toUpperCase() || 'AUDIO'}
          </span>
        </div>
      </div>

      {/* Modals */}
      <SleepTimerModal isOpen={showSleepModal} onClose={() => setShowSleepModal(false)} />
      <EqualizerModal isOpen={showEQModal} onClose={() => setShowEQModal(false)} />
      <GroupSessionModal isOpen={showRoomModal} onClose={() => setShowRoomModal(false)} />
      <SongInfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        track={activeTrack}
      />
      {showTrackMenu && activeTrack && (
        <TrackContextMenu
          track={activeTrack}
          isOpen={showTrackMenu}
          onClose={() => setShowTrackMenu(false)}
        />
      )}
    </div>
  );
};
