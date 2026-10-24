import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BRAND_CONFIG } from '../config/branding';
import { getDownloadedBlob } from '../services/offlineStorage';
import type {
  AudioOutputDevice,
  EQBands,
  EQPreset,
  PlaybackContext,
  RoomState,
  StorageStats,
  Track,
} from '../types';
import { resolveApiUrl } from '../utils/apiConfig';
import {
  type ColorPalette,
  DEFAULT_PALETTE,
  extractPaletteFromImageUrl,
} from '../utils/colorExtractor';
import { formatTime } from '../utils/formatters';
import { getNetworkInfo, type NetworkInfo } from '../utils/networkUtils';
import { playbackLogger } from '../utils/playbackLogger';
import { createShuffledQueue } from '../utils/shuffleUtils';
import { buildStreamUrl } from '../utils/streamUtils';
import { computePlaybackTelemetry } from '../utils/telemetry';
import { getTrackYoutubeId } from '../utils/youtubeUtils';
import { useCast } from './CastContext';

export type VisualizerTheme =
  | 'quantum'
  | 'synthwave'
  | 'liquid'
  | 'wormhole'
  | 'bars'
  | 'starfield'
  | 'vinyl_only'
  | 'turntable';

const PRESET_BANDS: Record<EQPreset, EQBands> = {
  flat: { bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0 },
  bass_boost: { bass: 7, lowMid: 4, mid: 0, highMid: 0, treble: -1 },
  vocal: { bass: -2, lowMid: 1, mid: 5, highMid: 3, treble: 0 },
  electronic: { bass: 5, lowMid: 3, mid: 0, highMid: 2, treble: 4 },
  rock: { bass: 4, lowMid: 2, mid: -1, highMid: 2, treble: 5 },
  acoustic: { bass: 3, lowMid: 1, mid: 2, highMid: 3, treble: 3 },
  night: { bass: -3, lowMid: -1, mid: 0, highMid: -2, treble: -4 },
};

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  queue: Track[];
  queueIndex: number;
  storageStats: StorageStats | null;
  showLyrics: boolean;
  showQueue: boolean;
  isCastAvailable: boolean;
  isCastConnected: boolean;
  castDeviceName: string;
  requestCastSession: () => Promise<void>;
  endCastSession: () => void;

  // Audio Output Sinks & Device Picker
  audioOutputDevices: AudioOutputDevice[];
  activeAudioOutputId: string;
  isAudioOutputSupported: boolean;
  canSelectAudioOutput: boolean;
  setAudioOutputDevice: (deviceId: string) => Promise<boolean>;
  requestAudioOutputDevice: () => Promise<void>;
  showDeviceModal: boolean;
  setShowDeviceModal: (show: boolean) => void;
  playbackContext: PlaybackContext | null;
  setPlaybackContext: (context: PlaybackContext | null) => void;
  playTrack: (track: Track, newQueue?: Track[], context?: PlaybackContext) => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  playShuffle: (tracks: Track[], context?: PlaybackContext) => void;
  toggleRepeat: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  playNext: (track: Track) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  toggleLike: (track: Track) => Promise<boolean>;
  setStorageMode: (mode: 'stream_only' | 'stream_and_cache') => Promise<void>;
  toggleLyrics: () => void;
  toggleQueue: () => void;
  refreshStorageStats: () => Promise<void>;

  // Sleep Timer
  sleepTimerRemaining: number | null; // seconds
  sleepTimerMode: number | 'end_of_track' | null;
  setSleepTimer: (option: number | 'end_of_track' | null) => void;

  // Autoplay
  isAutoplayEnabled: boolean;
  setIsAutoplayEnabled: (enabled: boolean) => void;

  // Equalizer & Normalization
  isEQEnabled: boolean;
  setIsEQEnabled: (val: boolean) => void;
  eqPreset: EQPreset;
  setEQPreset: (preset: EQPreset) => void;
  eqBands: EQBands;
  setEQBand: (band: keyof EQBands, gain: number) => void;
  isNormalizationEnabled: boolean;
  setIsNormalizationEnabled: (val: boolean) => void;

  // Collaborative Group Session / Room
  activeRoom: RoomState | null;
  createRoom: (name?: string) => Promise<string>;
  joinRoom: (code: string, participantName?: string) => Promise<boolean>;
  leaveRoom: () => void;
  addTrackToRoomQueue: (track: Track) => Promise<void>;

  // Buffering, Error State & Queue Management
  isBuffering: boolean;
  audioError: string | null;
  clearAudioError: () => void;
  retryCurrentTrack: () => void;
  // Crossfade & Gapless Transitions
  crossfadeDuration: number;
  setCrossfadeDuration: (seconds: number) => void;

  setFullQueue: (newQueue: Track[]) => void;

  // Visualizer & Ambient Aesthetics
  showVisualizer: boolean;
  setShowVisualizer: (show: boolean) => void;
  visualizerTheme: VisualizerTheme;
  setVisualizerTheme: (theme: VisualizerTheme) => void;
  currentPalette: ColorPalette;
  getAudioMetrics: () => {
    bass: number;
    mid: number;
    treble: number;
    energy: number;
    frequencyData: Uint8Array;
  };

  // Music Video & Wi-Fi Mode
  videoDisplayMode: VideoDisplayMode;
  setVideoDisplayMode: (mode: VideoDisplayMode) => void;
  isVideoMode: boolean;
  setIsVideoMode: (mode: boolean) => void;
  toggleVideoMode: () => void;
  canPlayVideo: boolean;
  youtubeVideoId: string | null;
  networkInfo: NetworkInfo;
  autoVideoOnWifi: boolean;
  setAutoVideoOnWifi: (enabled: boolean) => void;

  // Liked Songs Cache & Dynamic Verification
  isTrackLiked: (track: Track | null | undefined) => boolean;
  likedVersion: number;
  refreshLikedCache: () => Promise<void>;

  // Remote Playback Interceptor
  registerPlayInterceptor: (
    fn: ((track: Track, newQueue?: Track[], context?: PlaybackContext) => boolean) | null,
  ) => void;

  // Synchronized Speaker Group Playback Rate
  setPlaybackRate: (rate: number) => void;
}

type VideoDisplayMode = 'off' | 'backdrop' | 'cover';

interface PlaybackSessionSnapshot {
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
  playbackContext: PlaybackContext | null;
  queue: Track[];
  queueIndex: number;
  updatedAt: number;
}

const getStoredPlaybackSession = (): Partial<PlaybackSessionSnapshot> => {
  try {
    const raw =
      localStorage.getItem('azify_playback_session') ||
      localStorage.getItem('audiohub_playback_session');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
};

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const unshuffledQueueRef = useRef<Track[] | null>(null);
  const initialSession = getStoredPlaybackSession();

  const [currentTrack, setCurrentTrack] = useState<Track | null>(
    initialSession.currentTrack || null,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(initialSession.currentTime || 0);
  const [duration, setDuration] = useState(
    initialSession.duration || initialSession.currentTrack?.duration_seconds || 0,
  );
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [queue, setQueue] = useState<Track[]>(initialSession.queue || []);
  const [queueIndex, setQueueIndex] = useState(
    initialSession.queueIndex !== undefined ? initialSession.queueIndex : -1,
  );
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  // Playback Context (playlist, album, artist, etc.)
  const [playbackContext, setPlaybackContext] = useState<PlaybackContext | null>(() => {
    if (initialSession.playbackContext) return initialSession.playbackContext;
    try {
      const stored = localStorage.getItem('audiohub_playback_context');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const playbackContextRef = useRef<PlaybackContext | null>(null);
  playbackContextRef.current = playbackContext;

  const currentTimeRef = useRef<number>(initialSession.currentTime || 0);
  currentTimeRef.current = currentTime;

  const durationRef = useRef<number>(initialSession.duration || 0);
  durationRef.current = duration;

  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;

  const sessionUpdatedAtRef = useRef<number>(initialSession.updatedAt || 0);
  const lastServerSyncTimeRef = useRef<number>(0);
  const lastLocalSaveTimeRef = useRef<number>(0);
  const pendingSeekTimeRef = useRef<number>(initialSession.currentTime || 0);

  const isAutoplayFetchingRef = useRef<boolean>(false);

  // Crossfade & Gapless Dual Deck State
  const [crossfadeDuration, setCrossfadeDurationState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('audiohub_crossfade');
      return saved !== null ? parseInt(saved, 10) : 4;
    } catch {
      return 4;
    }
  });
  const crossfadeDurationRef = useRef<number>(crossfadeDuration);
  crossfadeDurationRef.current = crossfadeDuration;
  const setCrossfadeDuration = (secs: number) => {
    const clamped = Math.max(0, Math.min(12, Math.round(secs)));
    setCrossfadeDurationState(clamped);
    crossfadeDurationRef.current = clamped;
    try {
      localStorage.setItem('audiohub_crossfade', String(clamped));
    } catch {}
  };

  const deckARef = useRef<HTMLAudioElement | null>(null);
  const deckBRef = useRef<HTMLAudioElement | null>(null);
  const activeDeckRef = useRef<'A' | 'B'>('A');
  const isCrossfadingRef = useRef<boolean>(false);
  const crossfadeTimerRef = useRef<any>(null);
  const retryCountRef = useRef<number>(0);
  const prebufferedTrackIdRef = useRef<string | null>(null);
  const volumeRef = useRef<number>(0.8);
  volumeRef.current = volume;

  const getActiveDeck = useCallback(
    () => (activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current),
    [],
  );
  const getStandbyDeck = useCallback(
    () => (activeDeckRef.current === 'A' ? deckBRef.current : deckARef.current),
    [],
  );

  const prefetchAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<Track | null>(null);
  currentTrackRef.current = currentTrack;

  const queueRef = useRef<Track[]>([]);
  queueRef.current = queue;

  const queueIndexRef = useRef<number>(-1);
  queueIndexRef.current = queueIndex;

  const isShuffleRef = useRef<boolean>(false);
  isShuffleRef.current = isShuffle;

  const repeatModeRef = useRef<'off' | 'all' | 'one'>('off');
  repeatModeRef.current = repeatMode;

  const clearAudioError = () => setAudioError(null);

  const setFullQueue = (newQueue: Track[]) => {
    setQueue(newQueue);
    if (currentTrack) {
      const idx = newQueue.findIndex((t) => t.id === currentTrack.id);
      if (idx !== -1) setQueueIndex(idx);
    }
  };

  // Sleep Timer states
  const [sleepTimerMode, setSleepTimerMode] = useState<number | 'end_of_track' | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);

  // Autoplay
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState<boolean>(() => {
    return localStorage.getItem('audiohub_autoplay') !== 'false';
  });

  const isAutoplayEnabledRef = useRef<boolean>(true);
  isAutoplayEnabledRef.current = isAutoplayEnabled;

  const sleepTimerModeRef = useRef<number | 'end_of_track' | null>(null);
  sleepTimerModeRef.current = sleepTimerMode;

  const handleTrackEndedRef = useRef<() => void>(() => {});
  const playInterceptorRef = useRef<
    ((track: Track, newQueue?: Track[], context?: PlaybackContext) => boolean) | null
  >(null);
  const registerPlayInterceptor = useCallback(
    (fn: ((track: Track, newQueue?: Track[], context?: PlaybackContext) => boolean) | null) => {
      playInterceptorRef.current = fn;
    },
    [],
  );

  const setPlaybackRate = useCallback((rate: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, rate));
    if (deckARef.current) deckARef.current.playbackRate = clamped;
    if (deckBRef.current) deckBRef.current.playbackRate = clamped;
  }, []);

  // Equalizer & Normalization states
  const [isEQEnabled, setIsEQEnabled] = useState(false);
  const [eqPreset, setEQPresetState] = useState<EQPreset>('flat');
  const [eqBands, setEQBands] = useState<EQBands>(PRESET_BANDS.flat);
  const [isNormalizationEnabled, setIsNormalizationEnabled] = useState(true);

  // Room / Jukebox session
  const [activeRoom, setActiveRoom] = useState<RoomState | null>(null);

  // Liked Songs Cache & Dynamic Cross-Match
  const likedTrackIdsRef = useRef<Set<string>>(new Set());
  const likedSignaturesRef = useRef<Set<string>>(new Set());
  const [likedVersion, setLikedVersion] = useState(0);

  const normalizeSignature = (title?: string, artist?: string): string => {
    if (!title || !artist) return '';
    const cleanT = title
      .toLowerCase()
      .replace(/\s*[([{][^)\]}]*[)\]}]\s*/g, ' ')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
    const cleanA = artist
      .toLowerCase()
      .split(/[,&/]/)[0]
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
    return `${cleanT}:::${cleanA}`;
  };

  const checkTrackLiked = (
    track: Track | null | undefined,
    ids = likedTrackIdsRef.current,
    sigs = likedSignaturesRef.current,
  ): boolean => {
    if (!track) return false;
    if (track.id) {
      if (ids.has(track.id)) return true;
      const cleanId = track.id.replace(/^(yt_|dz_)/, '');
      if (cleanId && ids.has(cleanId)) return true;
    }
    if (track.source_id) {
      if (ids.has(track.source_id)) return true;
      const cleanSource = track.source_id.replace(/^(yt_|dz_)/, '');
      if (cleanSource && ids.has(cleanSource)) return true;
    }
    if (track.title && track.artist) {
      const rawKey = `${track.title.trim().toLowerCase()}:::${track.artist.trim().toLowerCase()}`;
      if (sigs.has(rawKey)) return true;
      const normKey = normalizeSignature(track.title, track.artist);
      if (normKey && sigs.has(normKey)) return true;
    }
    return Boolean(track.is_liked);
  };

  const isTrackLiked = (track: Track | null | undefined): boolean => {
    return checkTrackLiked(track);
  };

  const refreshLikedCache = async () => {
    try {
      const res = await fetch('/api/v1/tracks/liked');
      if (res.ok) {
        const data = await res.json();
        const newIds = new Set<string>();
        const newSigs = new Set<string>();
        data.forEach((t: any) => {
          if (t.id) {
            newIds.add(t.id);
            newIds.add(t.id.replace(/^(yt_|dz_)/, ''));
          }
          if (t.source_id) {
            newIds.add(t.source_id);
            newIds.add(t.source_id.replace(/^(yt_|dz_)/, ''));
          }
          if (t.title && t.artist) {
            newSigs.add(`${t.title.trim().toLowerCase()}:::${t.artist.trim().toLowerCase()}`);
            const norm = normalizeSignature(t.title, t.artist);
            if (norm) newSigs.add(norm);
          }
        });
        likedTrackIdsRef.current = newIds;
        likedSignaturesRef.current = newSigs;
        setLikedVersion((v) => v + 1);

        if (currentTrackRef.current) {
          const isCurLiked = checkTrackLiked(currentTrackRef.current, newIds, newSigs);
          if (currentTrackRef.current.is_liked !== isCurLiked) {
            setCurrentTrack((prev) => (prev ? { ...prev, is_liked: isCurLiked } : null));
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load liked songs cache', err);
    }
  };

  useEffect(() => {
    refreshLikedCache();
  }, []);

  // Music Video & Wi-Fi Network states
  // videoDisplayMode: 'off' | 'backdrop' (video behind album art) | 'cover' (video instead of album art)
  const [videoDisplayMode, setVideoDisplayModeState] = useState<VideoDisplayMode>('off');
  const [autoVideoOnWifi, setAutoVideoOnWifiState] = useState<boolean>(() => {
    return localStorage.getItem('audiohub_auto_video_wifi') === 'true';
  });

  const setAutoVideoOnWifi = (enabled: boolean) => {
    setAutoVideoOnWifiState(enabled);
    localStorage.setItem('audiohub_auto_video_wifi', String(enabled));
  };

  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>(getNetworkInfo());

  useEffect(() => {
    const handleConnChange = () => setNetworkInfo(getNetworkInfo());
    const conn = (navigator as any)?.connection;
    if (conn) {
      conn.addEventListener('change', handleConnChange);
      return () => conn.removeEventListener('change', handleConnChange);
    }
  }, []);

  const youtubeVideoId = getTrackYoutubeId(currentTrack);
  const canPlayVideo = Boolean(youtubeVideoId);

  const setVideoDisplayMode = (mode: VideoDisplayMode) => {
    if (mode !== 'off' && !canPlayVideo) return;
    setVideoDisplayModeState(mode);
  };

  const isVideoMode = videoDisplayMode !== 'off';

  const setIsVideoMode = (mode: boolean) => {
    if (mode) {
      setVideoDisplayMode('cover');
    } else {
      setVideoDisplayMode('off');
    }
  };

  const toggleVideoMode = () => {
    if (videoDisplayMode === 'off') {
      setVideoDisplayMode('backdrop');
    } else if (videoDisplayMode === 'backdrop') {
      setVideoDisplayMode('cover');
    } else {
      setVideoDisplayMode('off');
    }
  };

  // Turn off video if next track has no video, or auto-switch to backdrop if enabled on Wi-Fi
  useEffect(() => {
    if (!canPlayVideo && videoDisplayMode !== 'off') {
      setVideoDisplayModeState('off');
    } else if (
      canPlayVideo &&
      autoVideoOnWifi &&
      networkInfo.isWifiOrFast &&
      videoDisplayMode === 'off'
    ) {
      setVideoDisplayModeState('backdrop');
    }
  }, [currentTrack?.id]);

  // Visualizer & Ambient Palette states
  const [showVisualizer, setShowVisualizer] = useState(false);

  useEffect(() => {
    const handleOpenVisualizer = () => setShowVisualizer(true);
    const handleCloseVisualizer = () => setShowVisualizer(false);
    window.addEventListener('audiohub:open-visualizer', handleOpenVisualizer);
    window.addEventListener('audiohub:close-visualizer', handleCloseVisualizer);
    return () => {
      window.removeEventListener('audiohub:open-visualizer', handleOpenVisualizer);
      window.removeEventListener('audiohub:close-visualizer', handleCloseVisualizer);
    };
  }, []);

  const [visualizerTheme, setVisualizerThemeState] = useState<VisualizerTheme>(() => {
    try {
      const saved = localStorage.getItem('audiohub_visualizer_theme');
      if (
        saved &&
        [
          'quantum',
          'synthwave',
          'liquid',
          'wormhole',
          'bars',
          'starfield',
          'vinyl_only',
          'turntable',
        ].includes(saved)
      ) {
        return saved as VisualizerTheme;
      }
    } catch (e) {}
    return 'turntable';
  });

  const setVisualizerTheme = (theme: VisualizerTheme) => {
    setVisualizerThemeState(theme);
    try {
      localStorage.setItem('audiohub_visualizer_theme', theme);
    } catch (e) {}
  };
  const [currentPalette, setCurrentPalette] = useState<ColorPalette>(DEFAULT_PALETTE);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  // Extract color palette dynamically when current track changes
  useEffect(() => {
    if (!currentTrack?.cover_url) {
      setCurrentPalette(DEFAULT_PALETTE);
      return;
    }
    extractPaletteFromImageUrl(currentTrack.cover_url).then((palette) => {
      setCurrentPalette(palette);
      document.documentElement.style.setProperty('--theme-primary', palette.primary);
      document.documentElement.style.setProperty('--theme-secondary', palette.secondary);
      document.documentElement.style.setProperty('--theme-accent', palette.accent);
    });
  }, [currentTrack?.cover_url]);

  const getAudioMetrics = () => {
    const emptyArray = new Uint8Array(256);
    if (!analyserNodeRef.current) {
      return { bass: 0, mid: 0, treble: 0, energy: 0, frequencyData: emptyArray };
    }
    const analyser = analyserNodeRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // Bins with fftSize 512 (bufferLength 256): each bin is ~86Hz at 44.1kHz
    // Sub-bass & Kick drum: bins 0 to 3 (0 - 344Hz)
    let bassSum = 0;
    const bassBins = Math.min(4, bufferLength);
    for (let i = 0; i < bassBins; i++) bassSum += dataArray[i];
    const rawBass = bassSum / (bassBins * 255);
    // Non-linear punch scaling: makes kicks thump visibly
    const bass = Math.min(1.6, rawBass ** 1.3 * 1.85);

    // Mids (Vocals, guitars, synth leads): bins 4 to 36 (~344Hz - 3100Hz)
    let midSum = 0;
    const midStart = bassBins;
    const midEnd = Math.min(36, bufferLength);
    const midCount = Math.max(1, midEnd - midStart);
    for (let i = midStart; i < midEnd; i++) midSum += dataArray[i];
    const rawMid = midSum / (midCount * 255);
    const mid = Math.min(1.6, rawMid ** 1.2 * 1.55);

    // Treble (Hi-hats, cymbals, air): bins 37 to 160 (~3100Hz - 13.8kHz)
    let trebleSum = 0;
    const trebleStart = midEnd;
    const trebleEnd = Math.min(160, bufferLength);
    const trebleCount = Math.max(1, trebleEnd - trebleStart);
    for (let i = trebleStart; i < trebleEnd; i++) trebleSum += dataArray[i];
    const rawTreble = trebleSum / (trebleCount * 255);
    const treble = Math.min(1.6, rawTreble ** 1.1 * 1.45);

    const energy = Math.min(1.6, bass * 0.55 + mid * 0.3 + treble * 0.15);
    return { bass, mid, treble, energy, frequencyData: dataArray };
  };

  const {
    isCastAvailable,
    isConnected: isCastConnected,
    deviceName: castDeviceName,
    castTime,
    castDuration,
    isCastPaused,
    requestSession: requestCastSession,
    endCurrentSession: endCastSession,
    castTrack,
    castPlayOrPause,
    castSeek,
    castSetVolume,
  } = useCast();

  // Audio Device Selection & Connect Modal
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [audioOutputDevices, setAudioOutputDevices] = useState<AudioOutputDevice[]>([]);
  const [activeAudioOutputId, setActiveAudioOutputId] = useState<string>(() => {
    try {
      return localStorage.getItem('audiohub_audio_output_id') || 'default';
    } catch {
      return 'default';
    }
  });

  const isAudioOutputSupported =
    typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  const canSelectAudioOutput =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    'selectAudioOutput' in navigator.mediaDevices;

  const refreshAudioDevices = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs: AudioOutputDevice[] = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d, index) => {
          let label = d.label;
          if (!label) {
            label = d.deviceId === 'default' ? 'Default Audio Output' : `Audio Device ${index + 1}`;
          }
          return {
            deviceId: d.deviceId,
            label,
            isDefault: d.deviceId === 'default',
          };
        });
      setAudioOutputDevices(outputs);
    } catch (err) {
      console.warn('Failed to enumerate audio devices:', err);
    }
  };

  useEffect(() => {
    refreshAudioDevices();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshAudioDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshAudioDevices);
      };
    }
  }, []);

  const setAudioOutputDevice = async (deviceId: string): Promise<boolean> => {
    try {
      if (deckARef.current && 'setSinkId' in deckARef.current) {
        await (deckARef.current as any).setSinkId(deviceId);
      }
      if (deckBRef.current && 'setSinkId' in deckBRef.current) {
        await (deckBRef.current as any).setSinkId(deviceId);
      }
      setActiveAudioOutputId(deviceId);
      try {
        localStorage.setItem('audiohub_audio_output_id', deviceId);
      } catch {}
      return true;
    } catch (err) {
      console.error('Failed to set audio sink ID:', err);
    }
    return false;
  };

  const requestAudioOutputDevice = async () => {
    try {
      if (typeof navigator !== 'undefined' && (navigator.mediaDevices as any)?.selectAudioOutput) {
        const device = await (navigator.mediaDevices as any).selectAudioOutput();
        if (device && device.deviceId) {
          await setAudioOutputDevice(device.deviceId);
          await refreshAudioDevices();
        }
      }
    } catch (err) {
      console.warn('selectAudioOutput cancelled or failed:', err);
    }
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrobbleTimerRef = useRef<number | null>(null);
  const trackStartTimeRef = useRef<number>(Date.now());
  const originalVolumeRef = useRef<number>(0.8);

  // Web Audio Context & Nodes refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const eqFiltersRef = useRef<{
    bass?: BiquadFilterNode;
    lowMid?: BiquadFilterNode;
    mid?: BiquadFilterNode;
    highMid?: BiquadFilterNode;
    treble?: BiquadFilterNode;
  }>({});

  // Initialize Web Audio graph
  const initWebAudio = () => {
    if (audioCtxRef.current || (!deckARef.current && !audioRef.current)) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      // 5-band Equalizer
      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 60;

      const lowMid = ctx.createBiquadFilter();
      lowMid.type = 'peaking';
      lowMid.frequency.value = 250;
      lowMid.Q.value = 1.0;

      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 1000;
      mid.Q.value = 1.0;

      const highMid = ctx.createBiquadFilter();
      highMid.type = 'peaking';
      highMid.frequency.value = 4000;
      highMid.Q.value = 1.0;

      const treble = ctx.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 12000;

      eqFiltersRef.current = { bass, lowMid, mid, highMid, treble };

      // Normalization Compressor
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, ctx.currentTime);
      compressor.knee.setValueAtTime(30, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);
      compressorNodeRef.current = compressor;

      // Analyser Node: 512 FFT with low smoothing for crisp, snappy beat reactivity
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.45;
      analyser.minDecibels = -85;
      analyser.maxDecibels = -25;
      analyserNodeRef.current = analyser;

      // Audio Graph Wiring:
      // Decks -> Bass -> LowMid -> Mid -> HighMid -> Treble
      if (deckARef.current && deckBRef.current) {
        const sourceA = ctx.createMediaElementSource(deckARef.current);
        const sourceB = ctx.createMediaElementSource(deckBRef.current);
        sourceNodeRef.current = sourceA;
        sourceA.connect(bass);
        sourceB.connect(bass);
      } else if (audioRef.current) {
        const source = ctx.createMediaElementSource(audioRef.current);
        sourceNodeRef.current = source;
        source.connect(bass);
      }

      bass.connect(lowMid);
      lowMid.connect(mid);
      mid.connect(highMid);
      highMid.connect(treble);

      // Tap uncompressed post-EQ audio directly into Analyser in parallel!
      // This preserves punchy kick transients before the compressor squashes dynamic range.
      treble.connect(analyser);

      // Route audio output through compressor to prevent clipping
      treble.connect(compressor);
      compressor.connect(ctx.destination);
    } catch (e) {
      console.warn('Web Audio initialization skipped:', e);
    }
  };

  // Sync EQ Filter gains
  useEffect(() => {
    const filters = eqFiltersRef.current;
    if (!filters.bass || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    const gainBass = isEQEnabled ? eqBands.bass : 0;
    const gainLowMid = isEQEnabled ? eqBands.lowMid : 0;
    const gainMid = isEQEnabled ? eqBands.mid : 0;
    const gainHighMid = isEQEnabled ? eqBands.highMid : 0;
    const gainTreble = isEQEnabled ? eqBands.treble : 0;

    filters.bass.gain.setValueAtTime(gainBass, now);
    filters.lowMid?.gain.setValueAtTime(gainLowMid, now);
    filters.mid?.gain.setValueAtTime(gainMid, now);
    filters.highMid?.gain.setValueAtTime(gainHighMid, now);
    filters.treble?.gain.setValueAtTime(gainTreble, now);
  }, [eqBands, isEQEnabled]);

  const setEQPreset = (preset: EQPreset) => {
    setEQPresetState(preset);
    setEQBands(PRESET_BANDS[preset]);
  };

  const setEQBand = (band: keyof EQBands, gain: number) => {
    setEQBands((prev) => ({ ...prev, [band]: gain }));
    setEQPresetState('flat');
  };

  // Sleep Timer Interval
  useEffect(() => {
    if (typeof sleepTimerMode !== 'number' || sleepTimerRemaining === null) return;
    if (sleepTimerRemaining <= 0) {
      // Time is up: Stop playback and reset volume
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.volume = originalVolumeRef.current;
      }
      setIsPlaying(false);
      setSleepTimerMode(null);
      setSleepTimerRemaining(null);
      return;
    }

    const timer = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev === null || prev <= 1) return 0;
        // Smooth fade out in the last 5 seconds
        if (prev <= 5 && audioRef.current) {
          audioRef.current.volume = Math.max(0, originalVolumeRef.current * ((prev - 1) / 5));
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sleepTimerMode, sleepTimerRemaining]);

  const setSleepTimer = (option: number | 'end_of_track' | null) => {
    if (option === null) {
      if (audioRef.current) audioRef.current.volume = originalVolumeRef.current;
      setSleepTimerMode(null);
      setSleepTimerRemaining(null);
    } else if (option === 'end_of_track') {
      setSleepTimerMode('end_of_track');
      setSleepTimerRemaining(null);
    } else {
      if (audioRef.current) originalVolumeRef.current = audioRef.current.volume;
      setSleepTimerMode(option);
      setSleepTimerRemaining(option * 60);
    }
  };

  // Room Polling & Heartbeat (Host synchronizes state; Guests sync queue)
  useEffect(() => {
    if (!activeRoom) return;
    const currentUserId = localStorage.getItem('audiohub_user_id') || '';
    const devId = localStorage.getItem('audiohub_device_id') || '';
    const isHost = Boolean(
      (currentUserId && currentUserId === activeRoom.host_id) ||
        (devId && devId === (activeRoom as any).host_device_id),
    );

    const interval = setInterval(async () => {
      try {
        if (isHost) {
          // Host pushes current state and receives queue
          const res = await fetch(`/api/v1/rooms/${activeRoom.code}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              current_track: currentTrack,
              is_playing: isPlaying,
              position_seconds: currentTime,
              device_id: devId,
            }),
          });
          if (res.ok) {
            const data: RoomState = await res.json();
            setActiveRoom(data);
          }
        } else {
          // Guest polls room state
          const res = await fetch(`/api/v1/rooms/${activeRoom.code}`);
          if (res.ok) {
            const data: RoomState = await res.json();
            setActiveRoom(data);
          }
        }
      } catch (e) {
        console.warn('Room sync failed', e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeRoom?.code, currentTrack?.id, isPlaying, currentTime]);

  const createRoom = async (name?: string): Promise<string> => {
    const devId = localStorage.getItem('audiohub_device_id') || '';
    const userProfileName =
      localStorage.getItem('audiohub_room_nickname') ||
      localStorage.getItem('audiohub_user_name') ||
      undefined;
    const res = await fetch('/api/v1/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, device_id: devId, user_name: userProfileName }),
    });
    if (!res.ok) throw new Error('Failed to create room');
    const data: RoomState = await res.json();
    setActiveRoom(data);
    return data.code;
  };

  const joinRoom = async (code: string, participantName?: string): Promise<boolean> => {
    const devId = localStorage.getItem('audiohub_device_id') || '';
    const name =
      participantName ||
      localStorage.getItem('audiohub_room_nickname') ||
      localStorage.getItem('audiohub_user_name') ||
      undefined;
    const res = await fetch(`/api/v1/rooms/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, device_id: devId }),
    });
    if (!res.ok) return false;
    const data: RoomState = await res.json();
    setActiveRoom(data);
    return true;
  };

  const leaveRoom = () => {
    if (activeRoom) {
      const devId = localStorage.getItem('audiohub_device_id') || '';
      fetch(`/api/v1/rooms/${activeRoom.code}?device_id=${encodeURIComponent(devId)}`, {
        method: 'DELETE',
      }).catch(() => {});
      setActiveRoom(null);
    }
  };

  const addTrackToRoomQueue = async (track: Track) => {
    if (!activeRoom) return;
    await fetch(`/api/v1/rooms/${activeRoom.code}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track }),
    });
  };

  // Handle Cast connection changes
  useEffect(() => {
    if (isCastConnected && currentTrack) {
      if (audioRef.current) audioRef.current.pause();
      castTrack(currentTrack, currentTime);
    } else if (!isCastConnected && isPlaying && audioRef.current) {
      audioRef.current.currentTime = currentTime;
      audioRef.current.play().catch(console.warn);
    }
  }, [isCastConnected]);

  // Synchronize playback state while casting
  useEffect(() => {
    if (isCastConnected) {
      setCurrentTime(castTime);
      if (castDuration > 0) setDuration(castDuration);
      setIsPlaying(!isCastPaused);
    }
  }, [isCastConnected, castTime, castDuration, isCastPaused]);

  const savePlaybackSessionLocal = () => {
    const track = currentTrackRef.current;
    if (!track) return;
    const time = audioRef.current?.currentTime ?? currentTimeRef.current;
    const dur = audioRef.current?.duration || durationRef.current;
    const nowSec = Math.floor(Date.now() / 1000);

    const sessionData = {
      currentTrack: track,
      currentTime: Math.floor(time),
      duration: Math.floor(dur),
      playbackContext: playbackContextRef.current,
      queue: queueRef.current.slice(0, 100),
      queueIndex: queueIndexRef.current,
      updatedAt: nowSec,
    };

    try {
      const serialized = JSON.stringify(sessionData);
      localStorage.setItem('azify_playback_session', serialized);
      localStorage.setItem('audiohub_playback_session', serialized);
    } catch {}
  };

  const savePlaybackSession = (forceServer = false) => {
    savePlaybackSessionLocal();
    const track = currentTrackRef.current;
    if (!track) return;
    const time = audioRef.current?.currentTime ?? currentTimeRef.current;
    const dur = audioRef.current?.duration || durationRef.current;

    const nowMs = Date.now();
    if (forceServer || nowMs - lastServerSyncTimeRef.current > 7000) {
      lastServerSyncTimeRef.current = nowMs;
      fetch('/api/v1/auth/playback-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_track: track,
          current_time: Math.floor(time),
          duration: Math.floor(dur),
          playback_context: playbackContextRef.current,
          queue: queueRef.current.slice(0, 100),
          queue_index: queueIndexRef.current,
          is_playing: isPlayingRef.current,
        }),
        keepalive: true,
      }).catch(() => {});
    }
  };

  // Helper to build canonical stream URL including user identification
  const getStreamUrl = (track: Track, extraParams?: Record<string, string | number>): string => {
    return buildStreamUrl(track, extraParams);
  };

  // Natural Crossfade transition when approaching the end of current track
  const triggerNaturalCrossfade = () => {
    const q = queueRef.current;
    const curIdx = queueIndexRef.current;
    if (curIdx + 1 >= q.length) return;

    const nextTrack = q[curIdx + 1];
    const currentDeck = getActiveDeck();
    const standbyDeck = getStandbyDeck();
    if (!currentDeck || !standbyDeck) return;

    isCrossfadingRef.current = true;
    const cf = crossfadeDurationRef.current;
    const userVol = isMuted ? 0 : volumeRef.current;

    const nextSrc = getStreamUrl(nextTrack);

    if (standbyDeck.src !== nextSrc) {
      standbyDeck.src = nextSrc;
      standbyDeck.load();
    }

    standbyDeck.volume = 0;
    standbyDeck.currentTime = 0;
    standbyDeck.play().catch(console.warn);

    const intervalMs = 50;
    const totalSteps = Math.max(1, Math.floor((cf * 1000) / intervalMs));
    let step = 0;

    if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
    crossfadeTimerRef.current = setInterval(() => {
      step++;
      const progress = Math.min(1.0, step / totalSteps);
      const outVol = Math.max(0, userVol * (1 - progress));
      const inVol = Math.min(userVol, userVol * progress);

      currentDeck.volume = outVol;
      standbyDeck.volume = inVol;

      if (progress >= 1.0) {
        if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
        crossfadeTimerRef.current = null;
        currentDeck.pause();
        currentDeck.currentTime = 0;
        currentDeck.src = '';
        currentDeck.volume = userVol;
        standbyDeck.volume = userVol;

        activeDeckRef.current = activeDeckRef.current === 'A' ? 'B' : 'A';
        audioRef.current = standbyDeck;
        isCrossfadingRef.current = false;

        const targetIdx = curIdx + 1;
        setQueueIndex(targetIdx);
        queueIndexRef.current = targetIdx;
        setCurrentTrack({ ...nextTrack, is_liked: checkTrackLiked(nextTrack) });
        currentTrackRef.current = nextTrack;
        setCurrentTime(0);
        setDuration(nextTrack.duration_seconds || 0);

        savePlaybackSession(true);
      }
    }, intervalMs);
  };

  // Telemetry event dispatcher for implicit feedback & algorithm tuning
  const sendPlaybackTelemetry = (track: Track | null, forcedReason?: 'completed' | 'skipped') => {
    if (!track || !track.id) return;
    try {
      const activeDeck = getActiveDeck();
      const deckTime = activeDeck?.currentTime || currentTimeRef.current || 0;
      const dur = track.duration_seconds || activeDeck?.duration || durationRef.current || 0;
      const elapsedRealSec = Math.max(0, (Date.now() - trackStartTimeRef.current) / 1000);
      const listenedSec = Math.max(
        deckTime,
        Math.min(elapsedRealSec, dur > 0 ? dur : elapsedRealSec),
      );

      const payload = computePlaybackTelemetry(
        listenedSec,
        dur,
        forcedReason,
        playbackContextRef.current?.type || 'direct',
        (playbackContextRef.current as any)?.id || undefined,
      );

      fetch(`/api/v1/tracks/${track.id}/playback-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };

  // Direct advance with instant pre-buffered swap (gapless mode)
  const advanceDirectToTrack = (nextTrack: Track, targetIdx: number) => {
    if (playInterceptorRef.current) {
      setQueueIndex(targetIdx);
      queueIndexRef.current = targetIdx;
      playTrack(nextTrack, queueRef.current, playbackContextRef.current || undefined);
      return;
    }

    if (currentTrackRef.current && currentTrackRef.current.id !== nextTrack.id) {
      sendPlaybackTelemetry(currentTrackRef.current);
    }
    trackStartTimeRef.current = Date.now();

    if (crossfadeTimerRef.current) {
      clearInterval(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
    isCrossfadingRef.current = false;

    const currentDeck = getActiveDeck();
    const standbyDeck = getStandbyDeck();
    const userVol = isMuted ? 0 : volumeRef.current;

    if (
      standbyDeck &&
      prebufferedTrackIdRef.current === nextTrack.id &&
      standbyDeck.readyState >= 2
    ) {
      // Instant swap - 0ms delay!
      currentDeck?.pause();
      if (currentDeck) currentDeck.src = '';
      standbyDeck.volume = userVol;
      standbyDeck.currentTime = 0;
      standbyDeck.play().catch(console.warn);

      activeDeckRef.current = activeDeckRef.current === 'A' ? 'B' : 'A';
      audioRef.current = standbyDeck;
      prebufferedTrackIdRef.current = null;
    } else if (currentDeck) {
      currentDeck.src = getStreamUrl(nextTrack);
      currentDeck.volume = userVol;
      currentDeck.currentTime = 0;
      currentDeck.play().catch(console.warn);
    }

    setQueueIndex(targetIdx);
    queueIndexRef.current = targetIdx;
    setCurrentTrack({ ...nextTrack, is_liked: checkTrackLiked(nextTrack) });
    currentTrackRef.current = nextTrack;
    setCurrentTime(0);
    setDuration(nextTrack.duration_seconds || 0);
    setIsBuffering(false);
    setAudioError(null);
    savePlaybackSession(true);
  };

  // Fast manual crossfade when user clicks Next
  const triggerManualFadeToNext = (nextTrack: Track, targetIdx: number) => {
    if (playInterceptorRef.current) {
      setQueueIndex(targetIdx);
      queueIndexRef.current = targetIdx;
      playTrack(nextTrack, queueRef.current, playbackContextRef.current || undefined);
      return;
    }

    const currentDeck = getActiveDeck();
    const standbyDeck = getStandbyDeck();
    if (!currentDeck || !standbyDeck) {
      advanceDirectToTrack(nextTrack, targetIdx);
      return;
    }

    isCrossfadingRef.current = true;
    const userVol = isMuted ? 0 : volumeRef.current;
    const fadeDuration = 0.8;

    // Immediately update displayed track and queue index so album art, title, and queue list sync with zero lag
    setQueueIndex(targetIdx);
    queueIndexRef.current = targetIdx;
    setCurrentTrack({ ...nextTrack, is_liked: checkTrackLiked(nextTrack) });
    currentTrackRef.current = nextTrack;
    setCurrentTime(0);
    setDuration(nextTrack.duration_seconds || 0);

    const nextSrc = getStreamUrl(nextTrack);

    if (standbyDeck.src !== nextSrc) {
      standbyDeck.src = nextSrc;
      standbyDeck.load();
    }

    standbyDeck.volume = 0;
    standbyDeck.currentTime = 0;
    standbyDeck.play().catch(console.warn);

    const intervalMs = 40;
    const totalSteps = Math.max(1, Math.floor((fadeDuration * 1000) / intervalMs));
    let step = 0;

    if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
    crossfadeTimerRef.current = setInterval(() => {
      step++;
      const progress = Math.min(1.0, step / totalSteps);
      currentDeck.volume = Math.max(0, userVol * (1 - progress));
      standbyDeck.volume = Math.min(userVol, userVol * progress);

      if (progress >= 1.0) {
        if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
        crossfadeTimerRef.current = null;
        currentDeck.pause();
        currentDeck.src = '';
        currentDeck.volume = userVol;
        standbyDeck.volume = userVol;

        activeDeckRef.current = activeDeckRef.current === 'A' ? 'B' : 'A';
        audioRef.current = standbyDeck;
        isCrossfadingRef.current = false;

        setQueueIndex(targetIdx);
        queueIndexRef.current = targetIdx;
        setCurrentTrack({ ...nextTrack, is_liked: checkTrackLiked(nextTrack) });
        currentTrackRef.current = nextTrack;
        setCurrentTime(0);
        setDuration(nextTrack.duration_seconds || 0);

        savePlaybackSession(true);
      }
    }, intervalMs);
  };

  // Initialize Dual-Deck Audio System
  useEffect(() => {
    const deckA = new Audio();
    const deckB = new Audio();
    deckA.crossOrigin = 'anonymous';
    deckB.crossOrigin = 'anonymous';
    deckARef.current = deckA;
    deckBRef.current = deckB;
    audioRef.current = deckA;

    try {
      const savedSinkId = localStorage.getItem('audiohub_audio_output_id');
      if (savedSinkId && savedSinkId !== 'default') {
        if ('setSinkId' in deckA) (deckA as any).setSinkId(savedSinkId).catch(console.warn);
        if ('setSinkId' in deckB) (deckB as any).setSinkId(savedSinkId).catch(console.warn);
      }
    } catch {}

    const setupDeck = (deck: HTMLAudioElement, deckId: 'A' | 'B') => {
      deck.addEventListener('timeupdate', () => {
        if (activeDeckRef.current === deckId) {
          setCurrentTime(deck.currentTime);
          currentTimeRef.current = deck.currentTime;

          // Continually persist exact playback session to localStorage (throttled every 1.5s)
          const now = Date.now();
          if (now - lastLocalSaveTimeRef.current > 1500) {
            lastLocalSaveTimeRef.current = now;
            savePlaybackSessionLocal();
          }

          if (isPlayingRef.current && now - lastServerSyncTimeRef.current > 7000) {
            savePlaybackSession(false);
          }

          // Natural crossfade check
          const dur = deck.duration;
          const cur = deck.currentTime;
          const cf = crossfadeDurationRef.current;
          if (
            cf > 0 &&
            dur > 10 &&
            cur > 0 &&
            dur - cur <= cf &&
            dur - cur > 0.3 &&
            !isCrossfadingRef.current &&
            isPlayingRef.current
          ) {
            triggerNaturalCrossfade();
          }
        }
      });

      deck.addEventListener('loadedmetadata', () => {
        if (activeDeckRef.current === deckId) {
          const d = deck.duration || currentTrackRef.current?.duration_seconds || 0;
          setDuration(d);
          durationRef.current = d;
          if (pendingSeekTimeRef.current > 0) {
            deck.currentTime = pendingSeekTimeRef.current;
          }
        }
      });

      deck.addEventListener('loadstart', () => {
        if (activeDeckRef.current === deckId) setIsBuffering(true);
      });
      deck.addEventListener('waiting', () => {
        if (activeDeckRef.current === deckId) setIsBuffering(true);
      });
      deck.addEventListener('canplay', () => {
        if (activeDeckRef.current === deckId) setIsBuffering(false);
      });
      deck.addEventListener('playing', () => {
        if (activeDeckRef.current === deckId) {
          setIsBuffering(false);
          setAudioError(null);
          retryCountRef.current = 0;
          window.dispatchEvent(new CustomEvent('audiohub:playback-healthy'));
        }
      });
      deck.addEventListener('timeupdate', () => {
        if (activeDeckRef.current === deckId && deck.currentTime > 0) {
          window.dispatchEvent(new CustomEvent('audiohub:playback-healthy'));
        }
      });

      deck.addEventListener('ended', () => {
        if (activeDeckRef.current === deckId && !isCrossfadingRef.current) {
          handleTrackEndedRef.current();
        }
      });

      deck.addEventListener('error', (e) => {
        if (activeDeckRef.current === deckId) {
          setIsBuffering(false);
          const mediaError = deck.error;
          // Ignore MEDIA_ERR_ABORTED (code 1) - browser stopped loading previous track or user skipped
          if (mediaError && mediaError.code === 1) {
            return;
          }

          const savedPosition =
            deck.currentTime || currentTimeRef.current || pendingSeekTimeRef.current || 0;
          const track = currentTrackRef.current;
          if (!track) return;

          playbackLogger.log(
            'warn',
            'stream',
            `Stream interrupted at ${formatTime(savedPosition)} for "${track.title}"`,
            e,
          );

          // If device is offline (airplane mode, tunnel, loss of cell service), pause and retain position
          if (!navigator.onLine) {
            pendingSeekTimeRef.current = savedPosition;
            setIsPlaying(false);
            isPlayingRef.current = false;
            window.dispatchEvent(
              new CustomEvent('audiohub:stream-hiccup', {
                detail: {
                  message: `Network connection lost • Paused at ${formatTime(savedPosition)}`,
                  time: savedPosition,
                },
              }),
            );
            return;
          }

          if (retryCountRef.current < 2) {
            retryCountRef.current += 1;
            pendingSeekTimeRef.current = savedPosition;
            window.dispatchEvent(
              new CustomEvent('audiohub:stream-hiccup', {
                detail: {
                  message: `Re-syncing audio stream (attempt ${retryCountRef.current}) at ${formatTime(savedPosition)}...`,
                  time: savedPosition,
                },
              }),
            );

            setTimeout(() => {
              if (activeDeckRef.current === deckId) {
                deck.src = getStreamUrl(track, {
                  retry: retryCountRef.current,
                  t: Date.now(),
                });
                deck.load();
                deck
                  .play()
                  .then(() => {
                    if (pendingSeekTimeRef.current > 0) {
                      deck.currentTime = pendingSeekTimeRef.current;
                    }
                  })
                  .catch((err) => {
                    playbackLogger.log(
                      'warn',
                      'playback',
                      `Play retry failed: ${err?.message || err}`,
                    );
                  });
              }
            }, 800);
            return;
          }

          const title = track.title || 'Song';
          const artist = track.artist || 'Unknown';
          playbackLogger.log(
            'error',
            'stream',
            `Stream failed after retries: "${title}" by ${artist}`,
          );
          setAudioError(
            `Audio stream error: "${title}" by ${artist} could not be played. Advancing...`,
          );
          setTimeout(() => {
            handleTrackEndedRef.current();
          }, 2000);
        }
      });

      deck.addEventListener('play', () => {
        if (activeDeckRef.current === deckId) {
          setIsPlaying(true);
          isPlayingRef.current = true;
          if (pendingSeekTimeRef.current > 0) {
            deck.currentTime = pendingSeekTimeRef.current;
            pendingSeekTimeRef.current = 0;
          }
        }
      });

      deck.addEventListener('pause', () => {
        if (activeDeckRef.current === deckId && !isCrossfadingRef.current) {
          setIsPlaying(false);
          isPlayingRef.current = false;
          savePlaybackSession(true);
        }
      });
    };

    setupDeck(deckA, 'A');
    setupDeck(deckB, 'B');

    // If a saved track was restored from session, prime Deck A
    if (currentTrackRef.current) {
      deckA.src = getStreamUrl(currentTrackRef.current);
    }

    const handleBeforeUnload = () => savePlaybackSession(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        savePlaybackSession(true);
      }
    };
    const handleOnline = () => {
      playbackLogger.log('info', 'network', 'Network restored. Re-syncing audio stream...');
      const track = currentTrackRef.current;
      if (track && pendingSeekTimeRef.current > 0) {
        retryCurrentTrack();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    refreshStorageStats();

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
      deckA.pause();
      deckA.src = '';
      deckB.pause();
      deckB.src = '';
    };
  }, []);

  // Synchronize playback state across devices (PC to Phone, etc.) from server
  useEffect(() => {
    const syncServerPlaybackState = async () => {
      try {
        const res = await fetch('/api/v1/auth/playback-state');
        if (res.ok) {
          const data = await res.json();
          const serverState = data.state;
          if (serverState && serverState.current_track) {
            const serverUpdated = serverState.updated_at || 0;
            // Restore if server has newer state or if current track is not set
            if (serverUpdated > sessionUpdatedAtRef.current || !currentTrackRef.current) {
              sessionUpdatedAtRef.current = serverUpdated;
              setCurrentTrack(serverState.current_track);
              currentTrackRef.current = serverState.current_track;
              if (serverState.queue && serverState.queue.length > 0) {
                setQueue(serverState.queue);
                queueRef.current = serverState.queue;
              }
              if (serverState.queue_index !== undefined && serverState.queue_index >= 0) {
                setQueueIndex(serverState.queue_index);
                queueIndexRef.current = serverState.queue_index;
              }
              if (serverState.playback_context) {
                setPlaybackContext(serverState.playback_context);
                playbackContextRef.current = serverState.playback_context;
              }
              const seekTime = serverState.current_time || 0;
              setCurrentTime(seekTime);
              currentTimeRef.current = seekTime;
              const dur = serverState.duration || serverState.current_track.duration_seconds || 0;
              setDuration(dur);
              durationRef.current = dur;
              pendingSeekTimeRef.current = seekTime;

              if (audioRef.current && !isPlayingRef.current) {
                const t = serverState.current_track;
                audioRef.current.src = getStreamUrl(t);
              }

              try {
                localStorage.setItem(
                  'azify_playback_session',
                  JSON.stringify({
                    currentTrack: serverState.current_track,
                    currentTime: seekTime,
                    duration: dur,
                    playbackContext: serverState.playback_context,
                    queue: serverState.queue || [],
                    queueIndex: serverState.queue_index || 0,
                    updatedAt: serverUpdated,
                  }),
                );
              } catch {}
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch server playback state:', e);
      }
    };

    syncServerPlaybackState();
  }, []);

  // Preemptive background prefetching & browser pre-buffering for upcoming queue tracks
  useEffect(() => {
    if (queue.length === 0 || queueIndex < 0) return;
    const upcoming = queue.slice(queueIndex + 1, queueIndex + 5).map((t) => t.id);
    if (upcoming.length > 0) {
      // 1. Tell backend to resolve YouTube video IDs & warm up CDN connection pool
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const uid = localStorage.getItem('azify_user_id') || localStorage.getItem('audiohub_user_id');
      if (uid) {
        headers['X-User-Id'] = uid;
        headers['Authorization'] = `Bearer ${uid}`;
      }
      fetch(resolveApiUrl('/api/v1/stream/prefetch'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ track_ids: upcoming }),
      }).catch(() => {});

      // 2. Pre-buffer immediate next track directly into the standby deck for 0ms transition!
      const nextTrack = queue[queueIndex + 1];
      if (nextTrack) {
        const standby = getStandbyDeck();
        if (standby && !isCrossfadingRef.current) {
          const targetSrc = getStreamUrl(nextTrack);
          if (standby.src !== targetSrc) {
            standby.src = targetSrc;
            const isMobileDevice =
              /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
            if (isMobileDevice) {
              standby.preload = 'none';
            } else {
              standby.preload = 'auto';
              standby.volume = 0;
              standby.load();
            }
            prebufferedTrackIdRef.current = nextTrack.id;
          }
        }
      }
    }
  }, [queue, queueIndex]);

  const refreshStorageStats = async () => {
    try {
      const res = await fetch('/api/v1/settings/storage');
      if (res.ok) {
        const data = await res.json();
        setStorageStats(data);
      }
    } catch (e) {
      console.error('Failed to load storage stats', e);
    }
  };

  const handleTrackEnded = async () => {
    if (currentTrackRef.current) {
      sendPlaybackTelemetry(currentTrackRef.current, 'completed');
    }
    trackStartTimeRef.current = Date.now();

    if (sleepTimerModeRef.current === 'end_of_track') {
      setSleepTimerMode(null);
      setSleepTimerRemaining(null);
      setIsPlaying(false);
      return;
    }

    if (repeatModeRef.current === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.warn);
      return;
    }

    // Check if room queue has upcoming tracks
    if (activeRoom && activeRoom.queue.length > 0) {
      try {
        const res = await fetch(`/api/v1/rooms/${activeRoom.code}/next`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.current_track) {
            playTrack(data.current_track);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to advance room queue:', e);
      }
    }

    nextTrack();
  };
  handleTrackEndedRef.current = handleTrackEnded;

  // MediaSession Action Handler Refs (Prevents Stale Closures & Headphone/Lockscreen Dropouts)
  const handlePlayRef = useRef<() => void>(() => {});
  const handlePauseRef = useRef<() => void>(() => {});
  const handleNextRef = useRef<() => void>(() => {});
  const handlePrevRef = useRef<() => void>(() => {});
  const handleSeekRef = useRef<(sec: number) => void>(() => {});

  // Register MediaSession action handlers ONCE on mount
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => handlePlayRef.current());
      navigator.mediaSession.setActionHandler('pause', () => handlePauseRef.current());
      navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevRef.current());
      navigator.mediaSession.setActionHandler('nexttrack', () => handleNextRef.current());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) handleSeekRef.current(details.seekTime);
      });
      navigator.mediaSession.setActionHandler('stop', () => handlePauseRef.current());
    } catch (e) {
      console.warn('Failed to register MediaSession action handlers', e);
    }
  }, []);

  // Update MediaSession metadata when track changes
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album || BRAND_CONFIG.appName,
      artwork: currentTrack.cover_url
        ? [
            { src: currentTrack.cover_url, sizes: '96x96', type: 'image/jpeg' },
            { src: currentTrack.cover_url, sizes: '192x192', type: 'image/jpeg' },
            { src: currentTrack.cover_url, sizes: '256x256', type: 'image/jpeg' },
            { src: currentTrack.cover_url, sizes: '512x512', type: 'image/jpeg' },
          ]
        : [],
    });
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist]);

  // Keep MediaSession playbackState in sync with isPlaying
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Keep MediaSession position state in sync with playback for notification seek bar
  useEffect(() => {
    if (
      !('mediaSession' in navigator) ||
      !('setPositionState' in navigator.mediaSession) ||
      duration <= 0
    )
      return;
    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0, duration),
        playbackRate: getActiveDeck()?.playbackRate || 1.0,
        position: Math.max(0, Math.min(duration, currentTime)),
      });
    } catch (e) {}
  }, [currentTime, duration]);

  const playTrack = async (track: Track, newQueue?: Track[], context?: PlaybackContext) => {
    let targetIdx = 0;
    if (newQueue && newQueue.length > 0) {
      if (isShuffleRef.current) {
        unshuffledQueueRef.current = [...newQueue];
        const shuffled = createShuffledQueue(track, newQueue);
        setQueue(shuffled);
        queueRef.current = shuffled;
        targetIdx = 0;
        setQueueIndex(0);
        queueIndexRef.current = 0;
      } else {
        unshuffledQueueRef.current = null;
        setQueue(newQueue);
        queueRef.current = newQueue;
        const idx = newQueue.findIndex((t) => t.id === track.id);
        targetIdx = idx >= 0 ? idx : 0;
        setQueueIndex(targetIdx);
        queueIndexRef.current = targetIdx;
      }
    } else {
      const q = queueRef.current;
      const idx = q.findIndex((t) => t.id === track.id);
      if (idx >= 0) {
        targetIdx = idx;
        setQueueIndex(idx);
        queueIndexRef.current = idx;
      } else {
        const nextQ = [...q, track];
        setQueue(nextQ);
        queueRef.current = nextQ;
        targetIdx = nextQ.length - 1;
        setQueueIndex(targetIdx);
        queueIndexRef.current = targetIdx;
      }
    }

    if (context) {
      setPlaybackContext(context);
      playbackContextRef.current = context;
      try {
        localStorage.setItem('audiohub_playback_context', JSON.stringify(context));
      } catch {}
    }

    const isLiked = checkTrackLiked(track);
    const playingTrack = { ...track, is_liked: isLiked };
    setCurrentTrack(playingTrack);
    currentTrackRef.current = playingTrack;
    setCurrentTime(0);
    setDuration(track.duration_seconds || 0);

    if (playInterceptorRef.current) {
      setIsPlaying(true);
      isPlayingRef.current = true;
      savePlaybackSession(true);
      const handled = playInterceptorRef.current(track, newQueue || queueRef.current, context);
      if (handled) return;
    }

    if (currentTrackRef.current && currentTrackRef.current.id !== track.id) {
      sendPlaybackTelemetry(currentTrackRef.current);
    }
    trackStartTimeRef.current = Date.now();

    const currentDeck = getActiveDeck();
    if (!currentDeck) return;
    initWebAudio();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    setIsBuffering(true);
    setAudioError(null);

    // Route to Cast or Local
    if (isCastConnected) {
      currentDeck.pause();
      castTrack(track, 0);
    } else {
      const standbyDeck = getStandbyDeck();
      // If standby deck already has this track buffered, instant 0ms swap!
      if (standbyDeck && prebufferedTrackIdRef.current === track.id) {
        advanceDirectToTrack(track, targetIdx);
        return;
      }

      // Synchronous audio assignment & playback (immune to autoplay policy drops on mobile)
      currentDeck.src = getStreamUrl(track);
      currentDeck.volume = isMuted ? 0 : volumeRef.current;
      currentDeck.currentTime = 0;
      currentDeck.play().catch((err) => {
        console.warn('Playback error:', err);
      });

      // Background offline blob check without blocking synchronous .play()
      getDownloadedBlob(track.id)
        .then((offlineBlob) => {
          if (
            offlineBlob &&
            currentTrackRef.current?.id === track.id &&
            currentDeck.src.includes('/stream/')
          ) {
            const cur = currentDeck.currentTime;
            currentDeck.src = URL.createObjectURL(offlineBlob);
            currentDeck.currentTime = cur;
            currentDeck.play().catch(() => {});
          }
        })
        .catch(() => {});
    }

    // Ensure metadata on backend
    fetch('/api/v1/tracks/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration_seconds: track.duration_seconds,
        cover_url: track.cover_url,
        source_type: track.source_type,
        source_id: track.source_id,
      }),
    }).catch(() => {});

    // Save playback session snapshot
    pendingSeekTimeRef.current = 0;
    currentTimeRef.current = 0;
    setTimeout(() => savePlaybackSession(true), 300);

    // Scrobble after 30s
    if (scrobbleTimerRef.current) clearTimeout(scrobbleTimerRef.current);
    scrobbleTimerRef.current = window.setTimeout(() => {
      fetch(`/api/v1/tracks/${track.id}/scrobble`, { method: 'POST' }).catch(() => {});
    }, 30000);
  };

  const pausePlayback = () => {
    if (isCastConnected) {
      castPlayOrPause();
    } else {
      const activeDeck = getActiveDeck();
      if (activeDeck) activeDeck.pause();
    }
  };

  const resumePlayback = () => {
    if (isCastConnected) {
      castPlayOrPause();
    } else {
      const activeDeck = getActiveDeck();
      if (!activeDeck || !currentTrackRef.current) return;
      initWebAudio();
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      if (!activeDeck.src || activeDeck.src === '' || activeDeck.src.endsWith('/')) {
        activeDeck.src = getStreamUrl(currentTrackRef.current);
      }
      activeDeck.play().catch(console.warn);
    }
  };

  const retryCurrentTrack = () => {
    const activeDeck = getActiveDeck();
    const track = currentTrackRef.current;
    if (!activeDeck || !track) return;

    const savedPosition =
      activeDeck.currentTime || currentTimeRef.current || pendingSeekTimeRef.current || 0;
    pendingSeekTimeRef.current = savedPosition;
    retryCountRef.current = 1;

    playbackLogger.log(
      'info',
      'playback',
      `Re-syncing stream for "${track.title}" at ${formatTime(savedPosition)}`,
    );

    activeDeck.src = getStreamUrl(track, { retry: 1, t: Date.now() });
    activeDeck.load();
    activeDeck
      .play()
      .then(() => {
        if (pendingSeekTimeRef.current > 0) {
          activeDeck.currentTime = pendingSeekTimeRef.current;
        }
      })
      .catch(console.warn);
  };

  const togglePlay = () => {
    if (isCastConnected) {
      castPlayOrPause();
    } else {
      if (isPlayingRef.current) {
        pausePlayback();
      } else {
        resumePlayback();
      }
    }
  };

  const seek = (seconds: number) => {
    if (isCastConnected) {
      castSeek(seconds);
      setCurrentTime(seconds);
      currentTimeRef.current = seconds;
    } else {
      const activeDeck = getActiveDeck();
      if (!activeDeck) return;
      activeDeck.currentTime = seconds;
      setCurrentTime(seconds);
      currentTimeRef.current = seconds;
      savePlaybackSession(false);
    }
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    if (isCastConnected) castSetVolume(clamped);
    volumeRef.current = clamped;
    originalVolumeRef.current = clamped;
    const activeDeck = getActiveDeck();
    if (activeDeck && !isCrossfadingRef.current) {
      activeDeck.volume = clamped;
    }
    setVolumeState(clamped);
    setIsMuted(clamped === 0);
  };

  const toggleMute = () => {
    const activeDeck = getActiveDeck();
    if (!activeDeck) return;
    if (isMuted) {
      const vol = volume || 0.5;
      activeDeck.volume = vol;
      volumeRef.current = vol;
      setIsMuted(false);
    } else {
      activeDeck.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => {
      const nextShuffle = !prev;
      const curQueue = [...queueRef.current];
      const curIdx = queueIndexRef.current;
      const curTrack =
        currentTrackRef.current ||
        (curIdx >= 0 && curIdx < curQueue.length ? curQueue[curIdx] : null);

      if (nextShuffle) {
        if (!unshuffledQueueRef.current || unshuffledQueueRef.current.length === 0) {
          unshuffledQueueRef.current = curQueue;
        }
        if (curQueue.length > 1 && curTrack) {
          const shuffled = createShuffledQueue(curTrack, curQueue);
          setQueue(shuffled);
          queueRef.current = shuffled;
          setQueueIndex(0);
          queueIndexRef.current = 0;
        }
      } else {
        if (unshuffledQueueRef.current && unshuffledQueueRef.current.length > 0) {
          const restored = [...unshuffledQueueRef.current];
          unshuffledQueueRef.current = null;
          let newIdx = 0;
          if (curTrack) {
            const foundIdx = restored.findIndex((t) => t.id === curTrack.id);
            newIdx = foundIdx >= 0 ? foundIdx : 0;
          }
          setQueue(restored);
          queueRef.current = restored;
          setQueueIndex(newIdx);
          queueIndexRef.current = newIdx;
        }
      }
      return nextShuffle;
    });
  };

  const playShuffle = (tracks: Track[], context?: PlaybackContext) => {
    if (!tracks || tracks.length === 0) return;
    unshuffledQueueRef.current = [...tracks];
    const randomStartIdx = Math.floor(Math.random() * tracks.length);
    const startTrack = tracks[randomStartIdx];
    const shuffled = createShuffledQueue(startTrack, tracks);
    setIsShuffle(true);
    isShuffleRef.current = true;
    playTrack(startTrack, shuffled, context);
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  };

  // Autoplay Continuous Radio: fetch related songs when queue reaches end or nears end
  const fetchAutoplayRecommendations = async (baseTrack: Track): Promise<Track[]> => {
    if (isAutoplayFetchingRef.current) return [];
    isAutoplayFetchingRef.current = true;
    try {
      let candidateTracks: Track[] = [];

      // 1. Try track radio endpoint seeded with title, artist, and track source
      const safeTitle = encodeURIComponent(baseTrack.title || '');
      const safeArtist = encodeURIComponent(baseTrack.artist || '');
      const safeId = encodeURIComponent(baseTrack.id || 'seed');
      const safeSourceType = encodeURIComponent(baseTrack.source_type || '');
      const safeSourceId = encodeURIComponent(baseTrack.source_id || '');
      try {
        const radioRes = await fetch(
          `/api/v1/discovery/radio/${safeId}?title=${safeTitle}&artist=${safeArtist}&source_type=${safeSourceType}&source_id=${safeSourceId}`,
        );
        if (radioRes.ok) {
          const rData = await radioRes.json();
          candidateTracks = rData.tracks || [];
        }
      } catch (err) {
        console.warn('Radio endpoint error:', err);
      }

      // 2. Fallback to search if radio returned few tracks
      if (candidateTracks.length < 5 && baseTrack.artist) {
        try {
          const searchRes = await fetch(`/api/v1/search?q=${safeArtist}&limit=15`);
          if (searchRes.ok) {
            const sData = await searchRes.json();
            candidateTracks = [...candidateTracks, ...(sData.tracks || [])];
          }
        } catch {}
      }

      // 3. Fallback to discovery home trending / quick_access
      if (candidateTracks.length === 0) {
        try {
          const homeRes = await fetch('/api/v1/discovery/home');
          if (homeRes.ok) {
            const hData = await homeRes.json();
            candidateTracks = hData.trending || hData.quick_access || [];
          }
        } catch {}
      }

      const existingIds = new Set(queueRef.current.map((t) => t.id));
      existingIds.add(baseTrack.id);

      const filtered = candidateTracks.filter((t) => t.id && !existingIds.has(t.id));
      return filtered.slice(0, 10);
    } catch (e) {
      console.warn('Autoplay recommendations failed', e);
      return [];
    } finally {
      isAutoplayFetchingRef.current = false;
    }
  };

  const nextTrack = async () => {
    const q = queueRef.current;
    const curIdx = queueIndexRef.current;
    if (q.length === 0) return;

    let nextIdx = curIdx + 1;
    if (nextIdx >= q.length) {
      if (repeatModeRef.current === 'all') {
        nextIdx = 0;
      } else if (isAutoplayEnabledRef.current && currentTrackRef.current) {
        // Continuous Smart Radio! Auto fill playlist with related songs
        const autoTracks = await fetchAutoplayRecommendations(currentTrackRef.current);
        if (autoTracks && autoTracks.length > 0) {
          const updatedQ = [...queueRef.current, ...autoTracks];
          setQueue(updatedQ);
          queueRef.current = updatedQ;
          setQueueIndex(nextIdx);
          queueIndexRef.current = nextIdx;
          const radioContext: PlaybackContext = {
            type: 'radio',
            name: `Radio • ${currentTrackRef.current.artist || currentTrackRef.current.title}`,
          };
          setPlaybackContext(radioContext);
          playbackContextRef.current = radioContext;
          playTrack(autoTracks[0], updatedQ, radioContext);
          return;
        }
        return;
      } else {
        return;
      }
    }

    const nextSong = q[nextIdx];
    if (!nextSong) return;

    if (playInterceptorRef.current || isCastConnected) {
      setQueueIndex(nextIdx);
      queueIndexRef.current = nextIdx;
      playTrack(nextSong, q, playbackContextRef.current || undefined);
    } else if (crossfadeDurationRef.current > 0) {
      triggerManualFadeToNext(nextSong, nextIdx);
    } else {
      advanceDirectToTrack(nextSong, nextIdx);
    }
  };

  // Proactively auto-fill queue when approaching the end of a playlist (last 2 songs)
  useEffect(() => {
    if (isAutoplayEnabled && queue.length > 0 && queueIndex >= queue.length - 2 && currentTrack) {
      fetchAutoplayRecommendations(currentTrack).then((autoTracks) => {
        if (autoTracks && autoTracks.length > 0) {
          setQueue((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newToAdd = autoTracks.filter((t) => !existingIds.has(t.id));
            if (newToAdd.length === 0) return prev;
            const updated = [...prev, ...newToAdd];
            queueRef.current = updated;
            return updated;
          });
        }
      });
    }
  }, [queueIndex, queue.length, isAutoplayEnabled, currentTrack?.id]);

  const prevTrack = () => {
    const activeDeck = getActiveDeck();
    if (activeDeck && activeDeck.currentTime > 3) {
      seek(0);
      return;
    }
    const q = queueRef.current;
    const curIdx = queueIndexRef.current;
    if (q.length === 0) return;

    let prevIdx = curIdx - 1;
    if (prevIdx < 0) {
      prevIdx = repeatModeRef.current === 'all' ? q.length - 1 : 0;
    }

    const prevSong = q[prevIdx];
    if (!prevSong) return;

    if (playInterceptorRef.current || isCastConnected) {
      setQueueIndex(prevIdx);
      queueIndexRef.current = prevIdx;
      playTrack(prevSong, q, playbackContextRef.current || undefined);
    } else {
      advanceDirectToTrack(prevSong, prevIdx);
    }
  };

  // Update MediaSession Action Handler Refs with latest function references
  handlePlayRef.current = resumePlayback;
  handlePauseRef.current = pausePlayback;
  handleNextRef.current = nextTrack;
  handlePrevRef.current = prevTrack;
  handleSeekRef.current = seek;

  const playNext = (track: Track) => {
    const q = queueRef.current;
    const curIdx = queueIndexRef.current;
    if (q.length === 0 || !currentTrackRef.current) {
      playTrack(track);
      return;
    }
    const insertIdx = curIdx + 1;
    const nextQ = [...q.slice(0, insertIdx), track, ...q.slice(insertIdx)];
    setQueue(nextQ);
    queueRef.current = nextQ;
    try {
      window.dispatchEvent(
        new CustomEvent('audiohub:toast', {
          detail: { message: `Playing next: "${track.title}"` },
        }),
      );
    } catch {}
  };

  const addToQueue = (track: Track) => {
    const nextQ = [...queueRef.current, track];
    setQueue(nextQ);
    queueRef.current = nextQ;
    try {
      window.dispatchEvent(
        new CustomEvent('audiohub:toast', {
          detail: { message: `Added to end of queue: "${track.title}"` },
        }),
      );
    } catch {}
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
    if (index < queueIndex) {
      setQueueIndex((prev) => prev - 1);
    }
  };

  const reorderQueue = (fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      queueRef.current = next;

      // Adjust queueIndex if active song was moved or affected
      if (queueIndex === fromIndex) {
        setQueueIndex(toIndex);
      } else if (fromIndex < queueIndex && toIndex >= queueIndex) {
        setQueueIndex((prevIdx) => prevIdx - 1);
      } else if (fromIndex > queueIndex && toIndex <= queueIndex) {
        setQueueIndex((prevIdx) => prevIdx + 1);
      }

      return next;
    });
  };

  const toggleLike = async (track: Track): Promise<boolean> => {
    const currentlyLiked = isTrackLiked(track);
    const nextLiked = !currentlyLiked;

    // Optimistic cache update
    const ids = likedTrackIdsRef.current;
    const sigs = likedSignaturesRef.current;
    const rawKey =
      track.title && track.artist
        ? `${track.title.trim().toLowerCase()}:::${track.artist.trim().toLowerCase()}`
        : '';
    const normKey =
      track.title && track.artist ? normalizeSignature(track.title, track.artist) : '';
    const cleanId = track.id ? track.id.replace(/^(yt_|dz_)/, '') : '';
    const cleanSource = track.source_id ? track.source_id.replace(/^(yt_|dz_)/, '') : '';

    if (nextLiked) {
      if (track.id) ids.add(track.id);
      if (cleanId) ids.add(cleanId);
      if (track.source_id) ids.add(track.source_id);
      if (cleanSource) ids.add(cleanSource);
      if (rawKey) sigs.add(rawKey);
      if (normKey) sigs.add(normKey);
    } else {
      if (track.id) ids.delete(track.id);
      if (cleanId) ids.delete(cleanId);
      if (track.source_id) ids.delete(track.source_id);
      if (cleanSource) ids.delete(cleanSource);
      if (rawKey) sigs.delete(rawKey);
      if (normKey) sigs.delete(normKey);
    }

    setLikedVersion((v) => v + 1);

    // Optimistically broadcast event to all views (e.g. LikedSongs)
    try {
      window.dispatchEvent(
        new CustomEvent('track_like_toggled', { detail: { track, isLiked: nextLiked } }),
      );
    } catch {}

    // Optimistically update currentTrack if it's the same song
    if (
      currentTrackRef.current &&
      (currentTrackRef.current.id === track.id ||
        (cleanId && currentTrackRef.current.id.includes(cleanId)) ||
        (rawKey &&
          currentTrackRef.current.title &&
          currentTrackRef.current.artist &&
          `${currentTrackRef.current.title.trim().toLowerCase()}:::${currentTrackRef.current.artist.trim().toLowerCase()}` ===
            rawKey))
    ) {
      setCurrentTrack((prev) => (prev ? { ...prev, is_liked: nextLiked } : null));
    }

    try {
      const res = await fetch(`/api/v1/tracks/${track.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration_seconds: track.duration_seconds,
          cover_url: track.cover_url,
          source_type: track.source_type,
          source_id: track.source_id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const serverLiked = Boolean(data.is_liked);
        if (serverLiked !== nextLiked) {
          if (serverLiked) {
            if (track.id) ids.add(track.id);
            if (rawKey) sigs.add(rawKey);
          } else {
            if (track.id) ids.delete(track.id);
            if (rawKey) sigs.delete(rawKey);
          }
          setLikedVersion((v) => v + 1);
          try {
            window.dispatchEvent(
              new CustomEvent('track_like_toggled', { detail: { track, isLiked: serverLiked } }),
            );
          } catch {}
          if (currentTrackRef.current && currentTrackRef.current.id === track.id) {
            setCurrentTrack((prev) => (prev ? { ...prev, is_liked: serverLiked } : null));
          }
        }
        return serverLiked;
      }
    } catch (e) {
      console.error('Failed to toggle like', e);
    }
    return nextLiked;
  };

  const setStorageMode = async (mode: 'stream_only' | 'stream_and_cache') => {
    try {
      let userId = '';
      try {
        const stored = localStorage.getItem('audiohub_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          userId = parsed.id || '';
        }
      } catch (e) {}

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userId) {
        headers['X-User-Id'] = userId;
      }

      const res = await fetch('/api/v1/settings/storage/mode', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        await refreshStorageStats();
      } else {
        const err = await res.json().catch(() => ({}));
        console.warn('Storage mode change rejected:', err);
      }
    } catch (e) {
      console.error('Failed to update storage mode', e);
    }
  };

  const updateAutoplay = (enabled: boolean) => {
    setIsAutoplayEnabled(enabled);
    localStorage.setItem('audiohub_autoplay', String(enabled));
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isShuffle,
        repeatMode,
        queue,
        queueIndex,
        storageStats,
        showLyrics,
        showQueue,
        isCastAvailable,
        isCastConnected,
        castDeviceName,
        requestCastSession,
        endCastSession,

        // Audio Output Sinks & Device Picker
        audioOutputDevices,
        activeAudioOutputId,
        isAudioOutputSupported,
        canSelectAudioOutput,
        setAudioOutputDevice,
        requestAudioOutputDevice,
        showDeviceModal,
        setShowDeviceModal,
        playbackContext,
        setPlaybackContext,
        playTrack,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        playShuffle,
        toggleRepeat,
        nextTrack,
        prevTrack,
        playNext,
        addToQueue,
        removeFromQueue,
        reorderQueue,
        toggleLike,
        setStorageMode,
        toggleLyrics: () => setShowLyrics((p) => !p),
        toggleQueue: () => setShowQueue((p) => !p),
        refreshStorageStats,

        sleepTimerRemaining,
        sleepTimerMode,
        setSleepTimer,

        isAutoplayEnabled,
        setIsAutoplayEnabled: updateAutoplay,

        isEQEnabled,
        setIsEQEnabled,
        eqPreset,
        setEQPreset,
        eqBands,
        setEQBand,
        isNormalizationEnabled,
        setIsNormalizationEnabled,

        activeRoom,
        createRoom,
        joinRoom,
        leaveRoom,
        addTrackToRoomQueue,

        isBuffering,
        audioError,
        clearAudioError,
        retryCurrentTrack,
        crossfadeDuration,
        setCrossfadeDuration,
        setFullQueue,

        showVisualizer,
        setShowVisualizer,
        visualizerTheme,
        setVisualizerTheme,
        currentPalette,
        getAudioMetrics,

        // Video & Wi-Fi Mode
        videoDisplayMode,
        setVideoDisplayMode,
        isVideoMode,
        setIsVideoMode,
        toggleVideoMode,
        canPlayVideo,
        youtubeVideoId,
        networkInfo,
        autoVideoOnWifi,
        setAutoVideoOnWifi,

        // Liked Songs Cache
        isTrackLiked,
        likedVersion,
        refreshLikedCache,

        // Remote Interceptor
        registerPlayInterceptor,

        // Synchronized Speaker Group Playback Rate
        setPlaybackRate,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  return (context || {}) as PlayerContextType;
};
