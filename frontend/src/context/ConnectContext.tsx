import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ConnectDevice, Track } from '../types';
import { detectDeviceNameFromUa, detectDeviceTypeFromUa } from '../utils/deviceUtils';
import { timeSync } from '../utils/timeSync';
import { usePlayer } from './PlayerContext';

interface ConnectContextType {
  currentDeviceId: string;
  currentDeviceName: string;
  onlineDevices: ConnectDevice[];
  activeRemoteDevice: ConnectDevice | null;
  isRemoteControlActive: boolean;
  setIsRemoteControlActive: (active: boolean) => void;
  selectRemoteDevice: (deviceId: string) => void;
  remoteTogglePlay: () => void;
  remotePlay: () => void;
  remotePause: () => void;
  remoteNext: () => void;
  remotePrev: () => void;
  remoteSeek: (position: number) => void;
  remoteSetVolume: (volume: number) => void;
  remotePlayTrack: (track: Track, queue?: Track[]) => void;
  takeOverPlaybackLocally: () => void;
  transferPlayback: (targetDeviceId: string) => void;
  controlRemoteDevice: (targetDeviceId: string, action: string, data?: any) => void;
  refreshDevices: () => Promise<void>;

  // Synchronized Multi-Device Speaker Group (Party Mode)
  isPartyMode: boolean;
  togglePartyMode: () => void;
  bluetoothOffsetMs: number;
  setBluetoothOffsetMs: (offset: number) => void;
  syncDeltaMs: number | null;
  broadcastPartySync: (
    action: string,
    track?: Track | null,
    position?: number,
    is_playing?: boolean,
  ) => void;
}

const ConnectContext = createContext<ConnectContextType | null>(null);

function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem('audiohub_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem('audiohub_device_id', id);
    }
    return id;
  } catch {
    return 'dev_' + Math.random().toString(36).substring(2, 10);
  }
}

export const ConnectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentDeviceId] = useState<string>(getOrCreateDeviceId);
  const [currentDeviceName] = useState<string>(() =>
    typeof navigator !== 'undefined' ? detectDeviceNameFromUa(navigator.userAgent) : 'Web Player',
  );
  const [onlineDevices, setOnlineDevices] = useState<ConnectDevice[]>([]);
  const [selectedRemoteDeviceId, setSelectedRemoteDeviceId] = useState<string | null>(null);
  const [isRemoteControlActive, setIsRemoteControlActive] = useState<boolean>(false);

  // Synchronized Multi-Device Speaker Group (Party Mode)
  const [isPartyMode, setIsPartyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('audiohub_party_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [bluetoothOffsetMs, setBluetoothOffsetMsState] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('audiohub_bt_offset') || 0);
    } catch {
      return 0;
    }
  });

  const [syncDeltaMs, setSyncDeltaMs] = useState<number | null>(null);
  const isPartyModeRef = useRef(isPartyMode);
  isPartyModeRef.current = isPartyMode;
  const isPartyMasterRef = useRef<boolean>(false);

  const partyMasterStateRef = useRef<{
    masterStartPosition: number;
    scheduledStartTime: number;
    track: Track | null;
  } | null>(null);

  const setBluetoothOffsetMs = (offset: number) => {
    setBluetoothOffsetMsState(offset);
    try {
      localStorage.setItem('audiohub_bt_offset', String(offset));
    } catch {}
  };

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    queue,
    playTrack,
    togglePlay,
    seek,
    setVolume,
    nextTrack,
    prevTrack,
    registerPlayInterceptor,
    setPlaybackRate,
    activeRoom,
  } = usePlayer();

  const activeRoomRef = useRef(activeRoom);
  activeRoomRef.current = activeRoom;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const broadcastPartySync = (
    action: string,
    track?: Track | null,
    position?: number,
    is_playing: boolean = true,
  ) => {
    isPartyMasterRef.current = true;
    const now = timeSync.getNow();
    const scheduledStart = now + 0.6; // 600ms network & audio buffer lead time
    const pos = typeof position === 'number' ? position : currentTime;
    const t = track !== undefined ? track : currentTrack;

    partyMasterStateRef.current = {
      masterStartPosition: pos,
      scheduledStartTime: scheduledStart,
      track: t,
    };

    const roomCode = activeRoomRef.current?.code;
    const payload = {
      type: 'party_broadcast',
      action,
      scheduled_start: scheduledStart,
      track: t,
      position: pos,
      is_playing,
      room_code: roomCode,
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }

    fetch('/api/v1/connect/party_broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: localStorage.getItem('audiohub_user_id') || undefined,
        room_code: roomCode,
        from_device_id: currentDeviceId,
        action,
        scheduled_start: scheduledStart,
        track: t,
        position: pos,
        is_playing,
      }),
    }).catch(() => {});
  };

  const togglePartyMode = () => {
    setIsPartyMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('audiohub_party_mode', String(next));
      } catch {}
      if (next && isPlayingRef.current && currentTrack) {
        broadcastPartySync('play', currentTrack, currentTime, true);
      } else if (!next) {
        setPlaybackRate(1.0);
        setSyncDeltaMs(null);
      }
      return next;
    });
  };

  // Phase-Locked Loop (PLL) micro-adjustments for Speaker Group synchronization
  useEffect(() => {
    if (!isPartyMode || !isPlaying) {
      setSyncDeltaMs(null);
      setPlaybackRate(1.0);
      return;
    }

    const pllInterval = setInterval(() => {
      if (isPartyMasterRef.current) {
        setSyncDeltaMs(0);
        setPlaybackRate(1.0);
        return;
      }

      if (!partyMasterStateRef.current) {
        return;
      }

      const driftSeconds = timeSync.calculateDrift(
        currentTime,
        partyMasterStateRef.current.masterStartPosition,
        partyMasterStateRef.current.scheduledStartTime,
        bluetoothOffsetMs,
      );
      const driftMs = Math.round(driftSeconds * 1000);
      setSyncDeltaMs(driftMs);

      // Micro-pitch-preserving playback rate adjustments
      if (Math.abs(driftMs) <= 12) {
        setPlaybackRate(1.0);
      } else if (Math.abs(driftMs) > 160) {
        const targetPos = currentTime - driftSeconds;
        seek(Math.max(0, targetPos));
        setPlaybackRate(1.0);
      } else if (driftMs > 12) {
        // Local audio is ahead of master -> slow down smoothly
        setPlaybackRate(0.992);
      } else if (driftMs < -12) {
        // Local audio is behind master -> speed up smoothly
        setPlaybackRate(1.008);
      }
    }, 1200);

    return () => {
      clearInterval(pllInterval);
      setPlaybackRate(1.0);
    };
  }, [isPartyMode, isPlaying, currentTime, bluetoothOffsetMs]);

  // Find active remote device (either user selected or actively playing)
  const activeRemoteDevice = useMemo(() => {
    if (selectedRemoteDeviceId) {
      const found = onlineDevices.find(
        (d) => d.id === selectedRemoteDeviceId && !d.is_current_device,
      );
      if (found) return found;
    }
    return (
      onlineDevices.find(
        (d) => !d.is_current_device && (d.is_playing || (d.is_active && d.current_track)),
      ) || null
    );
  }, [onlineDevices, selectedRemoteDeviceId]);

  const selectRemoteDevice = (deviceId: string) => {
    setSelectedRemoteDeviceId(deviceId);
    setIsRemoteControlActive(true);
  };

  // If this device is idle and another device is playing, auto-enable remote control
  useEffect(() => {
    if (!isPlayingRef.current && activeRemoteDevice && activeRemoteDevice.is_playing) {
      setIsRemoteControlActive(true);
    }
  }, [activeRemoteDevice?.id, activeRemoteDevice?.is_playing]);

  // If local device starts playing sound, disengage remote control
  useEffect(() => {
    if (isPlaying) {
      setIsRemoteControlActive(false);
    }
  }, [isPlaying]);

  // Watchdog timer: If remote device position reaches duration, or finishes playing
  const lastAdvanceTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!isRemoteControlActive || !activeRemoteDevice || !activeRemoteDevice.current_track) return;
    const dur = activeRemoteDevice.current_track.duration_seconds || duration;
    const pos = activeRemoteDevice.position_seconds || 0;
    const now = Date.now();

    // If within 1.5 seconds of the end and was playing
    if (dur > 10 && pos >= dur - 1.5 && now - lastAdvanceTimeRef.current > 5000) {
      lastAdvanceTimeRef.current = now;
      console.log('Connect watchdog: remote device reached end of track, triggering nextTrack()');
      nextTrack();
    }
  }, [activeRemoteDevice?.position_seconds, activeRemoteDevice?.is_playing, duration]);

  // Intercept local play clicks across the entire app when controlling remotely
  useEffect(() => {
    if (isRemoteControlActive && activeRemoteDevice) {
      registerPlayInterceptor((track: Track, newQueue?: Track[]) => {
        controlRemoteDevice(activeRemoteDevice.id, 'play_track', { track, queue: newQueue });
        return true; // handled remotely
      });
    } else {
      registerPlayInterceptor(null);
    }
    return () => {
      registerPlayInterceptor(null);
    };
  }, [isRemoteControlActive, activeRemoteDevice?.id]);

  // Send state update via WebSocket and REST
  const sendState = () => {
    const payload = {
      device_id: currentDeviceId,
      name: currentDeviceName,
      device_type:
        typeof navigator !== 'undefined' ? detectDeviceTypeFromUa(navigator.userAgent) : 'desktop',
      state: {
        current_track: currentTrack,
        is_playing: isPlaying,
        position_seconds: currentTime,
        duration: duration,
        volume: volume,
      },
      user_id: localStorage.getItem('audiohub_user_id') || undefined,
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'state',
          state: payload.state,
        }),
      );
    }

    // Backup state via REST
    fetch('/api/v1/connect/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  };

  // Keep state synced on playback changes
  useEffect(() => {
    sendState();
  }, [isPlaying, currentTrack?.id, Math.floor(currentTime / 5), volume]);

  // Fetch online devices list
  const refreshDevices = async () => {
    try {
      const userId = localStorage.getItem('audiohub_user_id') || '';
      const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
      const res = await fetch(`/api/v1/connect/devices${qs}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.devices)) {
          setOnlineDevices(
            data.devices.map((d: any) => ({
              ...d,
              is_current_device: d.id === currentDeviceId,
            })),
          );
        }
      }
    } catch (e) {
      console.warn('Failed to refresh connect devices:', e);
    }
  };

  // WebSocket Connection Lifecycle
  useEffect(() => {
    let isCancelled = false;

    const connectWs = () => {
      if (isCancelled) return;

      const userId = localStorage.getItem('audiohub_user_id') || '';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/connect/ws?user_id=${encodeURIComponent(userId)}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'register',
              device_id: currentDeviceId,
              name: currentDeviceName,
              device_type:
                typeof navigator !== 'undefined'
                  ? detectDeviceTypeFromUa(navigator.userAgent)
                  : 'desktop',
              state: {
                current_track: currentTrack,
                is_playing: isPlaying,
                position_seconds: currentTime,
                volume: volume,
              },
            }),
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'device_list' && Array.isArray(msg.devices)) {
              setOnlineDevices(
                msg.devices.map((d: any) => ({
                  ...d,
                  is_current_device: d.id === currentDeviceId,
                })),
              );
            } else if (msg.type === 'command') {
              const { action, data } = msg;
              if (action === 'play' && !isPlayingRef.current) togglePlay();
              else if (action === 'pause' && isPlayingRef.current) togglePlay();
              else if (action === 'toggle_play') togglePlay();
              else if (action === 'seek' && typeof data?.position === 'number') seek(data.position);
              else if (action === 'set_volume' && typeof data?.volume === 'number')
                setVolume(data.volume);
              else if (action === 'next') nextTrack();
              else if (action === 'prev') prevTrack();
              else if (action === 'play_track' && data?.track) {
                playTrack(data.track, data.queue || undefined);
              }
            } else if (msg.type === 'remote_track_ended') {
              const targetId = msg.target_id;
              console.log('Connect: Received remote_track_ended for device', targetId);
              // If controlling this device or playing through it, automatically play next track
              if (
                isRemoteControlActive ||
                selectedRemoteDeviceId === targetId ||
                activeRemoteDevice?.id === targetId
              ) {
                nextTrack();
              }
            } else if (msg.type === 'time_pong') {
              if (typeof msg.client_t0 === 'number' && typeof msg.server_time === 'number') {
                timeSync.handleWsPong(msg.client_t0, msg.server_time);
              }
            } else if (msg.type === 'party_sync') {
              if (isPartyModeRef.current) {
                isPartyMasterRef.current = false;
                const {
                  action,
                  track: incomingTrack,
                  position: incomingPos,
                  scheduled_start,
                } = msg;
                if (action === 'pause') {
                  if (isPlayingRef.current) togglePlay();
                  partyMasterStateRef.current = null;
                  setSyncDeltaMs(0);
                  setPlaybackRate(1.0);
                } else {
                  const targetPos = typeof incomingPos === 'number' ? incomingPos : 0;
                  const scheduledStart =
                    typeof scheduled_start === 'number' ? scheduled_start : timeSync.getNow();

                  partyMasterStateRef.current = {
                    masterStartPosition: targetPos,
                    scheduledStartTime: scheduledStart,
                    track: incomingTrack || null,
                  };

                  if (incomingTrack && currentTrack?.id !== incomingTrack.id) {
                    playTrack(incomingTrack);
                  }

                  const now = timeSync.getNow();
                  const delayMs = (scheduledStart - now) * 1000;

                  if (delayMs > 0) {
                    seek(targetPos);
                    setTimeout(() => {
                      if (isPartyModeRef.current && !isPlayingRef.current) {
                        togglePlay();
                      }
                    }, delayMs);
                  } else {
                    const catchup = targetPos + Math.abs(delayMs / 1000);
                    seek(catchup);
                    if (!isPlayingRef.current) {
                      togglePlay();
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Error parsing Connect WebSocket message:', e);
          }
        };

        ws.onclose = () => {
          if (!isCancelled) {
            reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (e) {
        console.warn('WebSocket connect error, retrying:', e);
        reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
      }
    };

    connectWs();
    refreshDevices();

    // Polling backup every 5s for ultra-reliable device tracking
    const pollInterval = setInterval(refreshDevices, 5000);

    // Heartbeat ping & NTP time sync every 20s
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
        wsRef.current.send(
          JSON.stringify({
            type: 'time_ping',
            client_t0: performance.now(),
          }),
        );
      }
    }, 20000);

    return () => {
      isCancelled = true;
      clearInterval(pingInterval);
      clearInterval(pollInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [currentDeviceId, currentDeviceName]);

  const controlRemoteDevice = (targetDeviceId: string, action: string, data?: any) => {
    // 1. Send via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'command',
          target_id: targetDeviceId,
          action,
          data,
        }),
      );
    }

    // 2. Dual-transport backup via REST
    fetch('/api/v1/connect/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_id: targetDeviceId,
        action,
        data,
        user_id: localStorage.getItem('audiohub_user_id') || undefined,
      }),
    }).catch(() => {});

    // Optimistically update remote device state in local memory for zero lag
    setOnlineDevices((prev) =>
      prev.map((d) => {
        if (d.id === targetDeviceId) {
          const next = { ...d };
          if (action === 'toggle_play') next.is_playing = !next.is_playing;
          if (action === 'play') next.is_playing = true;
          if (action === 'pause') next.is_playing = false;
          if (action === 'seek' && typeof data?.position === 'number')
            next.position_seconds = data.position;
          if (action === 'set_volume' && typeof data?.volume === 'number')
            next.volume = data.volume;
          return next;
        }
        return d;
      }),
    );
  };

  // Remote Control action helpers
  const remoteTogglePlay = () => {
    if (!activeRemoteDevice) return;
    controlRemoteDevice(activeRemoteDevice.id, 'toggle_play');
  };

  const remotePlay = () => {
    if (!activeRemoteDevice) return;
    controlRemoteDevice(activeRemoteDevice.id, 'play');
  };

  const remotePause = () => {
    if (!activeRemoteDevice) return;
    controlRemoteDevice(activeRemoteDevice.id, 'pause');
  };

  const remoteNext = () => {
    if (!activeRemoteDevice) return;
    controlRemoteDevice(activeRemoteDevice.id, 'next');
  };

  const remotePrev = () => {
    if (!activeRemoteDevice) return;
    controlRemoteDevice(activeRemoteDevice.id, 'prev');
  };

  const remoteSeek = (position: number) => {
    if (!activeRemoteDevice) return;
    controlRemoteDevice(activeRemoteDevice.id, 'seek', { position });
  };

  const remoteSetVolume = (vol: number) => {
    if (!activeRemoteDevice) return;
    controlRemoteDevice(activeRemoteDevice.id, 'set_volume', { volume: vol });
  };

  const remotePlayTrack = (track: Track, newQueue?: Track[]) => {
    if (activeRemoteDevice) {
      controlRemoteDevice(activeRemoteDevice.id, 'play_track', { track, queue: newQueue });
    } else {
      playTrack(track, newQueue);
    }
  };

  const takeOverPlaybackLocally = () => {
    if (!activeRemoteDevice || !activeRemoteDevice.current_track) return;
    const targetTrack = activeRemoteDevice.current_track;
    const targetTime = activeRemoteDevice.position_seconds || 0;

    // Pause remote laptop
    controlRemoteDevice(activeRemoteDevice.id, 'pause');

    // Start playing locally on this phone
    setIsRemoteControlActive(false);
    playTrack(targetTrack);
    if (targetTime > 0) {
      setTimeout(() => seek(targetTime), 250);
    }
  };

  // Automatically subscribe to WebSocket room events when activeRoom changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeRoom?.code) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room_subscribe',
          room_code: activeRoom.code,
          device_id: currentDeviceId,
        }),
      );
    }
  }, [activeRoom?.code, currentDeviceId]);

  const transferPlayback = (targetDeviceId: string) => {
    if (!currentTrack) {
      window.dispatchEvent(
        new CustomEvent('audiohub:toast', {
          detail: { message: 'Pick a track to stream to this device.' },
        }),
      );
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'transfer',
          target_id: targetDeviceId,
          playback: {
            track: currentTrack,
            position_seconds: currentTime,
            is_playing: true,
            queue: queue,
          },
        }),
      );
    }

    // Trigger via REST command for DLNA and network devices
    controlRemoteDevice(targetDeviceId, 'play_track', {
      track: currentTrack,
      position: currentTime,
      queue: queue,
    });

    // Select remote device so phone controls it
    selectRemoteDevice(targetDeviceId);

    // Pause locally once transferred
    if (isPlaying) {
      togglePlay();
    }
  };

  return (
    <ConnectContext.Provider
      value={{
        currentDeviceId,
        currentDeviceName,
        onlineDevices,
        activeRemoteDevice,
        isRemoteControlActive,
        setIsRemoteControlActive,
        selectRemoteDevice,
        remoteTogglePlay,
        remotePlay,
        remotePause,
        remoteNext,
        remotePrev,
        remoteSeek,
        remoteSetVolume,
        remotePlayTrack,
        takeOverPlaybackLocally,
        transferPlayback,
        controlRemoteDevice,
        refreshDevices,
        isPartyMode,
        togglePartyMode,
        bluetoothOffsetMs,
        setBluetoothOffsetMs,
        syncDeltaMs,
        broadcastPartySync,
      }}
    >
      {children}
    </ConnectContext.Provider>
  );
};

export const useConnect = () => {
  const context = useContext(ConnectContext);
  if (!context) {
    throw new Error('useConnect must be used within ConnectProvider');
  }
  return context;
};
