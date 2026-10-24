import { Disc3, Heart, Loader2, Pause, Play, Speaker } from 'lucide-react';
import type React from 'react';
import { useConnect } from '../context/ConnectContext';
import { usePlayer } from '../context/PlayerContext';
import { navigateToArtist } from '../utils/navigation';
import { useVinylArtPreference } from '../utils/vinylSettings';

interface MobileMiniPlayerProps {
  onExpand: () => void;
}

export const MobileMiniPlayer: React.FC<MobileMiniPlayerProps> = ({ onExpand }) => {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    togglePlay,
    toggleLike,
    isTrackLiked,
    currentTime,
    duration,
    currentPalette,
  } = usePlayer();
  const { isRemoteControlActive, activeRemoteDevice, remoteTogglePlay, isPartyMode, syncDeltaMs } =
    useConnect();
  const [isVinylArt, setVinylArt] = useVinylArtPreference();

  // Determine active track and play status (Remote or Local)
  const isRemote = isRemoteControlActive && !!activeRemoteDevice?.current_track;
  const activeTrack = isRemote ? activeRemoteDevice.current_track! : currentTrack;
  const activePlaying = isRemote ? !!activeRemoteDevice.is_playing : isPlaying;
  const activeCurrentTime = isRemote ? activeRemoteDevice.position_seconds || 0 : currentTime;
  const activeDuration = isRemote
    ? activeRemoteDevice.duration_seconds || activeRemoteDevice.current_track?.duration_seconds || 0
    : duration;
  const handleTogglePlay = isRemote ? remoteTogglePlay : togglePlay;

  if (!activeTrack) return null;

  const progressPercent = activeDuration > 0 ? (activeCurrentTime / activeDuration) * 100 : 0;

  return (
    <div
      onClick={onExpand}
      className={`md:hidden fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] left-2 right-2 h-14 rounded-lg shadow-2xl z-30 flex items-center px-2.5 justify-between cursor-pointer select-none overflow-hidden active:scale-[0.99] transition-transform ${
        isPartyMode
          ? 'bg-[#22162b] border border-purple-500/40 shadow-purple-500/10'
          : isRemote
            ? 'bg-[#1e2e22] border border-spotify-green/40 shadow-spotify-green/10'
            : 'bg-[#282828] border border-white/10'
      }`}
    >
      {/* Track Art & Info */}
      <div className="flex items-center gap-3 truncate flex-1 min-w-0 pr-2">
        <div
          onClick={(e) => {
            e.stopPropagation();
            setVinylArt(!isVinylArt);
          }}
          className={`w-10 h-10 overflow-hidden flex-shrink-0 shadow transition-all duration-500 relative cursor-pointer ${
            isVinylArt
              ? 'rounded-full ring-1 ring-white/30 bg-[#0a0a0a] p-0.5'
              : 'rounded bg-[#181818]'
          }`}
          title={
            isVinylArt ? 'Vinyl Disc Art Active (Tap to toggle)' : 'Tap to switch to Vinyl Disc Art'
          }
        >
          <div
            className={`w-full h-full relative overflow-hidden ${
              isVinylArt ? 'rounded-full' : 'rounded'
            }`}
          >
            {isVinylArt ? (
              <>
                <div
                  className={`w-full h-full relative rounded-full bg-[#0c0c0e] flex items-center justify-center overflow-hidden ${
                    activePlaying ? 'azify-vinyl-spin' : ''
                  }`}
                >
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,#0d0d0f_0%,#0d0d0f_36%,#18181c_40%,#0d0d0f_44%,#18181c_48%,#0d0d0f_52%,#18181c_56%,#0d0d0f_60%,#18181c_64%,#0d0d0f_68%,#18181c_72%,#0d0d0f_76%,#18181c_80%,#0d0d0f_84%,#18181c_88%,#0a0a0c_94%,#222228_100%)] pointer-events-none" />
                  {currentPalette?.primary && (
                    <div
                      className="absolute inset-0 rounded-full pointer-events-none opacity-30 mix-blend-screen transition-opacity duration-700"
                      style={{
                        background: `radial-gradient(circle at center, transparent 36%, ${currentPalette.primary} 65%, transparent 95%)`,
                      }}
                    />
                  )}
                  <div className="relative w-[42%] h-[42%] rounded-full overflow-hidden border border-white/30 shadow-inner z-10 flex items-center justify-center bg-[#181818]">
                    {activeTrack.cover_url ? (
                      <img
                        src={activeTrack.cover_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-[8px]">🎵</div>
                    )}
                    <div className="absolute w-1.5 h-1.5 rounded-full bg-[#0a0a0c] border border-white/60 shadow-inner z-20 pointer-events-none" />
                  </div>
                </div>

                {/* Stationary Anisotropic Light Reflection Sheen */}
                <div
                  className={`absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.18)_45deg,transparent_90deg,transparent_180deg,rgba(255,255,255,0.18)_225deg,transparent_270deg)] pointer-events-none mix-blend-screen z-20 ${
                    activePlaying ? 'azify-vinyl-sheen-sway' : ''
                  }`}
                />
              </>
            ) : activeTrack.cover_url ? (
              <img src={activeTrack.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs">🎵</div>
            )}
          </div>
        </div>

        <div className="flex flex-col truncate">
          <span className="text-xs font-bold text-white truncate">{activeTrack.title}</span>
          {isPartyMode ? (
            <span className="text-[11px] text-purple-300 font-medium truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse inline-block shrink-0" />
              <span className="truncate">
                Speaker Group (
                {syncDeltaMs === 0
                  ? 'Master'
                  : syncDeltaMs !== null
                    ? `±${Math.abs(syncDeltaMs)}ms`
                    : 'Syncing'}
                )
              </span>
            </span>
          ) : isRemote && activeRemoteDevice ? (
            <span className="text-[11px] text-spotify-green font-medium truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-spotify-green animate-pulse inline-block shrink-0" />
              <span className="truncate">{activeRemoteDevice.name} (Speakers)</span>
            </span>
          ) : (
            <span
              onClick={(e) => {
                e.stopPropagation();
                navigateToArtist(activeTrack.artist, (activeTrack as any).artist_id);
              }}
              className="text-[11px] text-spotify-gray truncate hover:underline hover:text-white cursor-pointer"
              title={`View ${activeTrack.artist}`}
            >
              {activeTrack.artist}
            </span>
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setVinylArt(!isVinylArt)}
          className={`p-1 rounded-full transition-colors ${
            isVinylArt ? 'text-spotify-green' : 'text-spotify-gray hover:text-white'
          }`}
          title="Toggle Vinyl Disc Art"
        >
          <Disc3
            className={`w-4 h-4 ${isVinylArt && activePlaying ? 'animate-spin' : ''}`}
            style={{ animationDuration: '4s' }}
          />
        </button>

        <button
          onClick={() => toggleLike(activeTrack)}
          className="text-spotify-gray hover:text-white p-1"
          title={isTrackLiked(activeTrack) ? 'Unlike' : 'Like'}
        >
          <Heart
            className={`w-5 h-5 transition-colors ${
              isTrackLiked(activeTrack) ? 'text-spotify-green fill-spotify-green' : ''
            }`}
          />
        </button>

        <button
          onClick={handleTogglePlay}
          className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center active:scale-95 shadow"
        >
          {isBuffering && !isRemote ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : activePlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
      </div>

      {/* Bottom Slim Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white/10">
        <div
          className="h-full bg-spotify-green transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
