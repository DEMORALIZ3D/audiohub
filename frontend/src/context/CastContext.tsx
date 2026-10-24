import type React from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Track } from '../types';

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: any;
    chrome?: any;
  }
}

interface CastContextType {
  isCastAvailable: boolean;
  isConnected: boolean;
  castState: string;
  deviceName: string;
  castTime: number;
  castDuration: number;
  isCastPaused: boolean;
  requestSession: () => Promise<void>;
  endCurrentSession: () => void;
  castTrack: (track: Track, startTime?: number) => Promise<boolean>;
  castPlayOrPause: () => void;
  castSeek: (seconds: number) => void;
  castSetVolume: (volume: number) => void;
}

const CastContext = createContext<CastContextType | null>(null);

export const CastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [castState, setCastState] = useState('NO_DEVICES_AVAILABLE');
  const [deviceName, setDeviceName] = useState('');
  const [castTime, setCastTime] = useState(0);
  const [castDuration, setCastDuration] = useState(0);
  const [isCastPaused, setIsCastPaused] = useState(false);

  const remotePlayerRef = useRef<any>(null);
  const remotePlayerControllerRef = useRef<any>(null);

  // Initialize Cast SDK
  useEffect(() => {
    const initCast = (isAvailable: boolean) => {
      if (!isAvailable || !window.cast?.framework || !window.chrome?.cast) {
        setIsCastAvailable(false);
        return;
      }

      try {
        const castContext = window.cast.framework.CastContext.getInstance();
        castContext.setOptions({
          receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });

        const player = new window.cast.framework.RemotePlayer();
        const controller = new window.cast.framework.RemotePlayerController(player);

        remotePlayerRef.current = player;
        remotePlayerControllerRef.current = controller;
        setIsCastAvailable(true);

        // Listen for Cast State changes
        castContext.addEventListener(
          window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          (event: any) => {
            setCastState(event.castState);
          },
        );

        // Listen for connection changes
        controller.addEventListener(
          window.cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
          () => {
            const connected = player.isConnected;
            setIsConnected(connected);
            if (connected) {
              const session = castContext.getCurrentSession();
              setDeviceName(session?.getCastDevice()?.friendlyName || 'Google Cast Speaker');
            } else {
              setDeviceName('');
            }
          },
        );

        // Listen for pause / play changes
        controller.addEventListener(
          window.cast.framework.RemotePlayerEventType.IS_PAUSED_CHANGED,
          () => {
            setIsCastPaused(player.isPaused);
          },
        );

        // Listen for current time
        controller.addEventListener(
          window.cast.framework.RemotePlayerEventType.CURRENT_TIME_CHANGED,
          () => {
            setCastTime(player.currentTime);
          },
        );

        // Listen for duration
        controller.addEventListener(
          window.cast.framework.RemotePlayerEventType.DURATION_CHANGED,
          () => {
            setCastDuration(player.duration);
          },
        );
      } catch (err) {
        console.warn('Cast initialization warning:', err);
      }
    };

    if (window.cast?.framework) {
      initCast(true);
    } else {
      window.__onGCastApiAvailable = (isAvailable: boolean) => {
        initCast(isAvailable);
      };
    }
  }, []);

  const requestSession = async () => {
    if (!window.cast?.framework) return;
    try {
      const castContext = window.cast.framework.CastContext.getInstance();
      await castContext.requestSession();
    } catch (e: any) {
      if (e !== 'cancel') {
        console.warn('Cast request session error:', e);
      }
    }
  };

  const endCurrentSession = () => {
    if (!window.cast?.framework) return;
    try {
      const castContext = window.cast.framework.CastContext.getInstance();
      castContext.endCurrentSession(true);
      setIsConnected(false);
      setDeviceName('');
    } catch (e) {
      console.warn('Cast end session error:', e);
    }
  };

  const castTrack = async (track: Track, startTime = 0): Promise<boolean> => {
    if (!isConnected || !window.cast?.framework || !window.chrome?.cast) {
      return false;
    }

    try {
      const castContext = window.cast.framework.CastContext.getInstance();
      const session = castContext.getCurrentSession();
      if (!session) return false;

      // Absolute stream URL reachable by Google Cast speaker
      const userId = localStorage.getItem('audiohub_user_id');
      const userQs = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
      const streamUrl = `${window.location.origin}/api/v1/stream/${track.id}${userQs}`;

      const mediaInfo = new window.chrome.cast.media.MediaInfo(streamUrl, 'audio/mp4');
      mediaInfo.metadata = new window.chrome.cast.media.MusicTrackMediaMetadata();
      mediaInfo.metadata.title = track.title;
      mediaInfo.metadata.artist = track.artist;
      if (track.album) mediaInfo.metadata.albumName = track.album;
      if (track.cover_url) {
        mediaInfo.metadata.images = [{ url: track.cover_url }];
      }

      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      request.currentTime = startTime;
      request.autoplay = true;

      await session.loadMedia(request);
      return true;
    } catch (err) {
      console.error('Failed to load media on Google Cast speaker:', err);
      return false;
    }
  };

  const castPlayOrPause = () => {
    if (remotePlayerControllerRef.current) {
      remotePlayerControllerRef.current.playOrPause();
    }
  };

  const castSeek = (seconds: number) => {
    if (remotePlayerRef.current && remotePlayerControllerRef.current) {
      remotePlayerRef.current.currentTime = seconds;
      remotePlayerControllerRef.current.seek();
    }
  };

  const castSetVolume = (vol: number) => {
    if (remotePlayerRef.current && remotePlayerControllerRef.current) {
      remotePlayerRef.current.volumeLevel = Math.max(0, Math.min(1, vol));
      remotePlayerControllerRef.current.setVolumeLevel();
    }
  };

  return (
    <CastContext.Provider
      value={{
        isCastAvailable,
        isConnected,
        castState,
        deviceName,
        castTime,
        castDuration,
        isCastPaused,
        requestSession,
        endCurrentSession,
        castTrack,
        castPlayOrPause,
        castSeek,
        castSetVolume,
      }}
    >
      {children}
    </CastContext.Provider>
  );
};

export const useCast = () => {
  const context = useContext(CastContext);
  if (!context) {
    throw new Error('useCast must be used within a CastProvider');
  }
  return context;
};
