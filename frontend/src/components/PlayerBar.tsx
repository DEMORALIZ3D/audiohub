import {
  AlertCircle,
  Cast,
  Check,
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
  Pause,
  PictureInPicture2,
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
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useConnect } from '../context/ConnectContext';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';
import { navigateToAlbum, navigateToArtist, navigateToPlaylist } from '../utils/navigation';
import { canShareTrack, getTrackShareData, shareContent } from '../utils/shareUtils';
import { useVinylArtPreference } from '../utils/vinylSettings';
import { EqualizerModal } from './EqualizerModal';
import { GroupSessionModal } from './GroupSessionModal';
import { usePopoutPlayer } from './PopoutPlayer';
import { ProgressBar } from './ProgressBar';
import { SleepTimerModal } from './SleepTimerModal';
import { SongInfoModal } from './SongInfoModal';
import { TrackContextMenu } from './TrackContextMenu';

export const PlayerBar: React.FC = () => {
  const { triggerPopout } = usePopoutPlayer();
  const {
    currentTrack,
    playbackContext,
    isPlaying,
    isBuffering,
    audioError,
    clearAudioError,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    showLyrics,
    showQueue,
    isCastAvailable,
    isCastConnected,
    castDeviceName,
    requestCastSession,
    endCastSession,
    setShowDeviceModal,
    activeAudioOutputId,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
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
    showVisualizer,
    setShowVisualizer,
    isVideoMode,
    setIsVideoMode,
    canPlayVideo,
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
  const displayTrack = isRemote ? activeRemoteDevice.current_track! : currentTrack;
  const displayPlaying = isRemote ? !!activeRemoteDevice.is_playing : isPlaying;
  const displayCurrentTime = isRemote ? activeRemoteDevice.position_seconds || 0 : currentTime;
  const displayDuration = isRemote
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
  const [shareCopied, setShareCopied] = useState(false);
  const [isVinylArt, setVinylArt] = useVinylArtPreference();

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const [showTrackMenu, setShowTrackMenu] = useState(false);
  const [trackMenuPos, setTrackMenuPos] = useState<{ x: number; y: number } | null>(null);

  // Dismiss more menu on click outside or escape
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node) &&
        moreBtnRef.current &&
        !moreBtnRef.current.contains(e.target as Node)
      ) {
        setShowMoreMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMoreMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMoreMenu]);

  const hasActiveSecondary =
    isEQEnabled ||
    sleepTimerRemaining !== null ||
    sleepTimerMode === 'end_of_track' ||
    !!activeRoom ||
    isVideoMode;

  const handleShareTrack = async () => {
    if (!displayTrack) return;
    const res = await shareContent(getTrackShareData(displayTrack));
    if (res === 'copied' || res === 'shared') {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const progressPercent = displayDuration > 0 ? (displayCurrentTime / displayDuration) * 100 : 0;

  return (
    <div
      data-testid="player-bar"
      className="hidden md:flex h-20 bg-[#181818] border-t border-[#282828] px-4 items-center justify-between text-white select-none z-40 relative"
    >
      {/* Audio Error Toast Banner */}
      {audioError && (
        <div className="absolute top-[-42px] left-1/2 -translate-x-1/2 bg-red-600/95 text-white text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 border border-red-400/40 z-50 animate-bounce">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">{audioError}</span>
          <button onClick={clearAudioError} className="ml-2 text-white/70 hover:text-white p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Left: Track Info (with right-click context menu support) */}
      <div
        onContextMenu={(e) => {
          if (displayTrack) {
            e.preventDefault();
            setTrackMenuPos({ x: e.clientX, y: e.clientY });
            setShowTrackMenu(true);
          }
        }}
        className="flex items-center gap-3 w-1/4 min-w-[180px]"
      >
        {displayTrack ? (
          <>
            <div
              data-testid="now-playing-art"
              onClick={() => setShowVisualizer(true)}
              className={`w-14 h-14 overflow-hidden flex-shrink-0 relative group/art shadow-md cursor-pointer transition-all duration-500 hover:scale-105 active:scale-95 ${
                isVinylArt
                  ? 'rounded-full bg-[#08080a] p-0.5 ring-1 ring-white/10 shadow-xl'
                  : 'rounded-md bg-[#282828]'
              }`}
              title={
                isVinylArt
                  ? 'Spinning Vinyl Art (Click to open Stage)'
                  : 'Open WebGL Visualizer Stage'
              }
            >
              <div
                className={`relative w-full h-full overflow-hidden ${
                  isVinylArt ? 'rounded-full' : 'rounded-md'
                }`}
              >
                {isVinylArt ? (
                  /* Realistic 12" Vinyl Disc */
                  <>
                    <div
                      className={`w-full h-full relative rounded-full bg-[#0c0c0e] flex items-center justify-center overflow-hidden ${
                        displayPlaying ? 'azify-vinyl-spin' : ''
                      }`}
                    >
                      {/* Concentric Grooves */}
                      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,#0d0d0f_0%,#0d0d0f_36%,#18181c_40%,#0d0d0f_44%,#18181c_48%,#0d0d0f_52%,#18181c_56%,#0d0d0f_60%,#18181c_64%,#0d0d0f_68%,#18181c_72%,#0d0d0f_76%,#18181c_80%,#0d0d0f_84%,#18181c_88%,#0a0a0c_94%,#222228_100%)] pointer-events-none" />

                      {/* Album Art Color Wax Glow / Translucent Tint */}
                      {currentPalette?.primary && (
                        <div
                          className="absolute inset-0 rounded-full pointer-events-none opacity-30 mix-blend-screen transition-opacity duration-700"
                          style={{
                            background: `radial-gradient(circle at center, transparent 38%, ${currentPalette.primary} 65%, transparent 95%)`,
                          }}
                        />
                      )}

                      {/* Center Circular Label: Album art strictly contained here */}
                      <div className="relative w-[40%] h-[40%] rounded-full overflow-hidden border border-white/30 shadow-2xl z-10 flex items-center justify-center bg-[#181818]">
                        {displayTrack.cover_url ? (
                          <img
                            src={displayTrack.cover_url}
                            alt={displayTrack.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-[10px]">🎵</div>
                        )}
                        {/* Spindle Center Hole */}
                        <div className="absolute w-2 h-2 rounded-full bg-[#0a0a0c] border border-white/60 shadow-inner z-20 pointer-events-none" />
                      </div>
                    </div>

                    {/* Stationary Anisotropic Light Reflection Sheen */}
                    <div
                      className={`absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.18)_45deg,transparent_90deg,transparent_180deg,rgba(255,255,255,0.18)_225deg,transparent_270deg)] pointer-events-none mix-blend-screen z-20 ${
                        displayPlaying ? 'azify-vinyl-sheen-sway' : ''
                      }`}
                    />
                  </>
                ) : displayTrack.cover_url ? (
                  <img
                    src={displayTrack.cover_url}
                    alt={displayTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-spotify-gray">
                    🎵
                  </div>
                )}

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/art:opacity-100 flex items-center justify-center transition-opacity z-30">
                  <Sparkles className="w-5 h-5 text-spotify-green animate-pulse" />
                </div>
              </div>
            </div>
            <div className="flex flex-col truncate min-w-0">
              {playbackContext && !isRemote && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (playbackContext.type === 'playlist' && playbackContext.id) {
                      navigateToPlaylist(playbackContext.id);
                    } else if (playbackContext.type === 'album' && playbackContext.id) {
                      navigateToAlbum(playbackContext.id);
                    } else if (playbackContext.type === 'artist' && playbackContext.id) {
                      navigateToArtist(
                        playbackContext.name || displayTrack.artist,
                        playbackContext.id,
                      );
                    }
                  }}
                  className="text-[10px] font-bold tracking-wider text-spotify-gray/80 truncate uppercase hover:underline hover:text-spotify-green cursor-pointer"
                  title="Go to playback source"
                >
                  {playbackContext.type === 'radio'
                    ? '📻 CONTINUOUS RADIO'
                    : playbackContext.type === 'playlist'
                      ? `PLAYLIST • ${playbackContext.name || 'PLAYLIST'}`
                      : playbackContext.type === 'album'
                        ? `ALBUM • ${playbackContext.name || 'ALBUM'}`
                        : playbackContext.type === 'artist'
                          ? `ARTIST • ${playbackContext.name || 'ARTIST'}`
                          : playbackContext.type === 'liked'
                            ? 'LIKED SONGS'
                            : ''}
                </span>
              )}
              <span
                data-testid="now-playing-title"
                className="text-sm font-semibold truncate hover:underline cursor-pointer text-white"
              >
                {displayTrack.title}
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToArtist(displayTrack.artist, (displayTrack as any).artist_id);
                }}
                className="text-xs text-spotify-gray truncate hover:underline cursor-pointer hover:text-white"
                title={`View ${displayTrack.artist}`}
              >
                {displayTrack.artist}
              </span>
              {isPartyMode ? (
                <span className="text-[10px] text-purple-300 font-bold flex items-center gap-1.5 mt-0.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
                  <span className="truncate">
                    Speaker Group:{' '}
                    {syncDeltaMs === null
                      ? 'Syncing...'
                      : syncDeltaMs === 0
                        ? 'Master Anchor'
                        : `±${Math.abs(syncDeltaMs)}ms`}
                  </span>
                </span>
              ) : isRemote && activeRemoteDevice ? (
                <span className="text-[10px] text-spotify-green font-bold flex items-center gap-1.5 mt-0.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-spotify-green animate-pulse shrink-0" />
                  <span className="truncate">Controlling {activeRemoteDevice.name}</span>
                  <button
                    onClick={takeOverPlaybackLocally}
                    className="ml-1 px-2 py-0.5 rounded-full bg-spotify-green text-black font-extrabold text-[9px] hover:scale-105 active:scale-95 transition-transform shadow shrink-0"
                    title="Transfer playback to this PC"
                  >
                    Play Here
                  </button>
                </span>
              ) : isCastConnected ? (
                <span className="text-[10px] text-spotify-green font-bold flex items-center gap-1 mt-0.5 animate-pulse">
                  <Cast className="w-3 h-3" /> Casting to {castDeviceName}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-0.5 ml-1">
              <button
                onClick={() => setVinylArt((prev) => !prev)}
                className={`p-1 rounded-full transition-all active:scale-125 ${
                  isVinylArt
                    ? 'text-spotify-green bg-spotify-green/10'
                    : 'text-spotify-gray hover:text-white'
                }`}
                title={
                  isVinylArt
                    ? 'Vinyl Disc Art Active (Click to switch to Square)'
                    : 'Switch to Vinyl Disc Album Art'
                }
              >
                <Disc3
                  className={`w-4 h-4 ${isVinylArt && displayPlaying ? 'animate-spin' : ''}`}
                  style={{ animationDuration: '4s' }}
                />
              </button>

              <button
                onClick={() => toggleLike(displayTrack)}
                className="text-spotify-gray hover:text-white p-1 transition-transform active:scale-125"
                title={isTrackLiked(displayTrack) ? 'Unlike' : 'Like'}
              >
                <Heart
                  className={`w-4 h-4 transition-colors ${
                    isTrackLiked(displayTrack) ? 'text-spotify-green fill-spotify-green' : ''
                  }`}
                />
              </button>

              <button
                onClick={() => setShowInfoModal(true)}
                className="text-spotify-gray hover:text-white p-1 transition-colors"
                title="Inspect Audio Source & YouTube Match"
              >
                <Info className="w-4 h-4" />
              </button>

              {canShareTrack(displayTrack) && (
                <button
                  onClick={handleShareTrack}
                  className="text-spotify-gray hover:text-white p-1 transition-colors"
                  title={
                    shareCopied ? 'Link Copied!' : 'Share Track (WhatsApp, Messenger, Copy Link)'
                  }
                >
                  {shareCopied ? (
                    <Check className="w-4 h-4 text-spotify-green animate-pulse" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs text-spotify-gray">Select a track to play</div>
        )}
      </div>

      {/* Center: Controls & Scrubber */}
      <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-[650px]">
        <div className="flex items-center gap-5">
          <button
            onClick={toggleShuffle}
            disabled={isRemote}
            className={`transition-colors ${
              isShuffle ? 'text-spotify-green' : 'text-spotify-gray hover:text-white'
            } ${isRemote ? 'opacity-40' : ''}`}
            title="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={handlePrev}
            className="text-spotify-gray hover:text-white transition-colors"
            title="Previous"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={handleTogglePlay}
            disabled={!displayTrack}
            className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
            title={
              isBuffering && !isRemote ? 'Buffering audio...' : displayPlaying ? 'Pause' : 'Play'
            }
          >
            {isBuffering && !isRemote ? (
              <Loader2 className="w-5 h-5 animate-spin text-black" />
            ) : displayPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={handleNext}
            className="text-spotify-gray hover:text-white transition-colors"
            title="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={toggleRepeat}
            disabled={isRemote}
            className={`transition-colors ${
              repeatMode !== 'off' ? 'text-spotify-green' : 'text-spotify-gray hover:text-white'
            } ${isRemote ? 'opacity-40' : ''}`}
            title="Repeat"
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full flex items-center gap-2 text-xs text-spotify-gray group">
          <span className="w-10 text-right font-mono">{formatTime(displayCurrentTime)}</span>
          <div className="flex-1">
            <ProgressBar
              currentTime={displayCurrentTime}
              duration={displayDuration}
              onSeek={handleSeek}
              size="sm"
            />
          </div>
          <span className="w-10 font-mono">{formatTime(displayDuration)}</span>
        </div>
      </div>

      {/* Right: Aux Controls (Cast/Device, Lyrics, Queue, More Options Popup, Volume) */}
      <div className="flex items-center justify-end gap-2.5 w-1/4 min-w-[200px] relative">
        {/* Device Selection & Connect Button (Speaker, Bluetooth, Cast, Remote, Party Mode) */}
        <button
          onClick={() => setShowDeviceModal(true)}
          className={`p-1.5 rounded-full transition-colors relative ${
            isPartyMode
              ? 'text-purple-400 hover:text-purple-300'
              : isRemote || isCastConnected || activeAudioOutputId !== 'default'
                ? 'text-spotify-green'
                : 'text-spotify-gray hover:text-white'
          }`}
          title={
            isPartyMode
              ? `Party Mode Active (${syncDeltaMs === null ? 'Syncing...' : syncDeltaMs === 0 ? 'Master' : `±${Math.abs(syncDeltaMs)}ms`})`
              : isRemote
                ? `Controlling ${activeRemoteDevice?.name} (Click to open Connect)`
                : isCastConnected
                  ? `Casting to ${castDeviceName}`
                  : 'Connect to a device (Speakers, Bluetooth, Cast, Remote, Party Mode)'
          }
        >
          {isPartyMode ? (
            <Layers className="w-4 h-4 animate-pulse" />
          ) : isRemote ? (
            <Speaker className="w-4 h-4 animate-pulse" />
          ) : isCastConnected ? (
            <Cast className="w-4 h-4 animate-pulse" />
          ) : (
            <Speaker className="w-4 h-4" />
          )}
          {(isPartyMode || isRemote || isCastConnected || activeAudioOutputId !== 'default') && (
            <span
              className={`absolute top-0 right-0 w-2 h-2 rounded-full ${
                isPartyMode ? 'bg-purple-400' : 'bg-spotify-green'
              }`}
            />
          )}
        </button>

        {/* Launch TV Visualizer on Connected Screen */}
        {isRemote &&
          activeRemoteDevice &&
          ((activeRemoteDevice as any).has_screen || activeRemoteDevice.device_type === 'tv') && (
            <button
              onClick={() => {
                controlRemoteDevice(activeRemoteDevice.id, 'launch_tv');
                window.dispatchEvent(
                  new CustomEvent('audiohub:toast', {
                    detail: { message: `Opening TV Visualizer on ${activeRemoteDevice.name}!` },
                  }),
                );
              }}
              className="p-1.5 rounded-full text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
              title={`Open full AudioHub TV stage with spinning vinyl & live lyrics on ${activeRemoteDevice.name}`}
            >
              <Tv className="w-4 h-4" />
            </button>
          )}

        {/* Lyrics Button */}
        <button
          onClick={toggleLyrics}
          className={`p-1.5 rounded-full transition-colors ${
            showLyrics ? 'text-spotify-green' : 'text-spotify-gray hover:text-white'
          }`}
          title="Lyrics"
        >
          <Mic2 className="w-4 h-4" />
        </button>

        {/* Queue Button */}
        <button
          onClick={toggleQueue}
          className={`p-1.5 rounded-full transition-colors ${
            showQueue ? 'text-spotify-green' : 'text-spotify-gray hover:text-white'
          }`}
          title="Queue"
        >
          <ListMusic className="w-4 h-4" />
        </button>

        {/* More Options Popover Button (...) */}
        <div className="relative">
          <button
            ref={moreBtnRef}
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className={`p-1.5 rounded-full transition-all relative ${
              showMoreMenu
                ? 'text-white bg-white/20'
                : hasActiveSecondary
                  ? 'text-spotify-green hover:text-white'
                  : 'text-spotify-gray hover:text-white hover:bg-white/10'
            }`}
            title="More options (Equalizer, Sleep Timer, Visualizer, TV Mode, Mini PiP, Jukebox, Video, Audio Specs)"
          >
            <MoreHorizontal className="w-4 h-4" />
            {hasActiveSecondary && (
              <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-spotify-green shadow" />
            )}
          </button>

          {/* More Options Dropdown Menu */}
          {showMoreMenu && (
            <div
              ref={moreMenuRef}
              className="absolute bottom-full right-0 mb-3 w-64 bg-[#242424] border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-spotify-gray/80 border-b border-white/5 flex items-center justify-between">
                <span>Player Utilities</span>
                {hasActiveSecondary && (
                  <span className="text-[10px] text-spotify-green font-normal">
                    Active features
                  </span>
                )}
              </div>

              {/* Audio Equalizer */}
              <button
                onClick={() => {
                  setShowEQModal(true);
                  setShowMoreMenu(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isEQEnabled
                    ? 'bg-spotify-green/15 text-spotify-green'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-4 h-4" />
                  <span>Equalizer</span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    isEQEnabled ? 'bg-spotify-green text-black' : 'text-spotify-gray'
                  }`}
                >
                  {isEQEnabled ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Sleep Timer */}
              <button
                onClick={() => {
                  setShowSleepModal(true);
                  setShowMoreMenu(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  sleepTimerRemaining !== null || sleepTimerMode === 'end_of_track'
                    ? 'bg-spotify-green/15 text-spotify-green'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Moon className="w-4 h-4" />
                  <span>Sleep Timer</span>
                </div>
                {(sleepTimerRemaining !== null || sleepTimerMode === 'end_of_track') && (
                  <span className="text-[10px] bg-spotify-green text-black px-1.5 py-0.5 rounded font-bold">
                    {sleepTimerRemaining !== null
                      ? `${Math.ceil(sleepTimerRemaining / 60)}m`
                      : '1 track'}
                  </span>
                )}
              </button>

              {/* Visualizer Stage */}
              <button
                onClick={() => {
                  setShowVisualizer(true);
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-white/90 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-spotify-green" />
                  <span>Visualizer Stage</span>
                </div>
                <span className="text-[10px] text-spotify-gray">3D & Waves</span>
              </button>

              {/* Floating Mini PiP Player */}
              <button
                onClick={() => {
                  triggerPopout();
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-white/90 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <PictureInPicture2 className="w-4 h-4 text-spotify-green/80" />
                  <span>Floating Mini Player</span>
                </div>
                <span className="text-[10px] text-spotify-gray">PiP</span>
              </button>

              {/* TV Leanback Mode */}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('audiohub:open-tv'));
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-white/90 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Tv className="w-4 h-4" />
                  <span>TV Leanback Screen</span>
                </div>
                <span className="text-[10px] text-spotify-gray">Big Screen</span>
              </button>

              {/* Group Session / Jukebox */}
              <button
                onClick={() => {
                  setShowRoomModal(true);
                  setShowMoreMenu(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeRoom
                    ? 'bg-spotify-green/15 text-spotify-green'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4" />
                  <span>Group Session</span>
                </div>
                {activeRoom && (
                  <span className="text-[10px] bg-spotify-green text-black px-1.5 py-0.5 rounded font-extrabold">
                    {activeRoom.participants.length} connected
                  </span>
                )}
              </button>

              {/* Music Video HD (if available) */}
              {canPlayVideo && (
                <button
                  onClick={() => {
                    setIsVideoMode(!isVideoMode);
                    setShowVisualizer(true);
                    setShowMoreMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isVideoMode
                      ? 'bg-spotify-green/15 text-spotify-green'
                      : 'text-white/90 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Film className="w-4 h-4" />
                    <span>Music Video</span>
                  </div>
                  <span className="text-[10px] bg-spotify-green/20 text-spotify-green px-1.5 py-0.5 rounded font-bold">
                    HD
                  </span>
                </button>
              )}

              <div className="my-1 border-t border-white/5" />

              {/* Song Audio Specs / Details */}
              {displayTrack && (
                <button
                  onClick={() => {
                    setShowInfoModal(true);
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-white/90 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Info className="w-4 h-4 text-spotify-gray" />
                    <span>Song Audio Specs</span>
                  </div>
                </button>
              )}

              {/* Share Song */}
              {displayTrack && (
                <button
                  onClick={() => {
                    handleShareTrack();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-white/90 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {shareCopied ? (
                      <Check className="w-4 h-4 text-spotify-green animate-pulse" />
                    ) : (
                      <Share2 className="w-4 h-4 text-spotify-gray" />
                    )}
                    <span>{shareCopied ? 'Link Copied!' : 'Share Track'}</span>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Volume slider */}
        <div className="flex items-center gap-1.5 group">
          <button onClick={toggleMute} className="text-spotify-gray hover:text-white p-1">
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Modals */}
      <SleepTimerModal isOpen={showSleepModal} onClose={() => setShowSleepModal(false)} />
      <EqualizerModal isOpen={showEQModal} onClose={() => setShowEQModal(false)} />
      <GroupSessionModal isOpen={showRoomModal} onClose={() => setShowRoomModal(false)} />
      <SongInfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        track={currentTrack}
      />

      {/* Track Context Menu for Playing Track */}
      {displayTrack && (
        <TrackContextMenu
          track={displayTrack}
          isOpen={showTrackMenu}
          onClose={() => setShowTrackMenu(false)}
          anchorPosition={trackMenuPos}
        />
      )}
    </div>
  );
};
