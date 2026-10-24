import {
  Cast,
  Check,
  ExternalLink,
  Headphones,
  Laptop,
  Layers,
  Loader2,
  PlusCircle,
  Radio,
  RefreshCw,
  Smartphone,
  Speaker,
  Tv,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import React from 'react';
import { useConnect } from '../context/ConnectContext';
import { usePlayer } from '../context/PlayerContext';

interface DevicePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DevicePickerModal: React.FC<DevicePickerModalProps> = ({ isOpen, onClose }) => {
  const {
    currentTrack,
    activeRoom,
    createRoom,
    joinRoom,
    leaveRoom,
    audioOutputDevices,
    activeAudioOutputId,
    isAudioOutputSupported,
    canSelectAudioOutput,
    setAudioOutputDevice,
    requestAudioOutputDevice,
    isCastAvailable,
    isCastConnected,
    castDeviceName,
    requestCastSession,
    endCastSession,
  } = usePlayer();

  const {
    currentDeviceId,
    onlineDevices,
    activeRemoteDevice,
    isRemoteControlActive,
    setIsRemoteControlActive,
    selectRemoteDevice,
    takeOverPlaybackLocally,
    transferPlayback,
    controlRemoteDevice,
    isPartyMode,
    togglePartyMode,
    bluetoothOffsetMs,
    setBluetoothOffsetMs,
    syncDeltaMs,
    refreshDevices,
  } = useConnect();

  const [isScanning, setIsScanning] = React.useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = React.useState<string | null>(null);
  const [roomCodeInput, setRoomCodeInput] = React.useState('');
  const [isJoiningRoom, setIsJoiningRoom] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      refreshDevices();
    }
  }, [isOpen]);

  const handleScanNetwork = async () => {
    setIsScanning(true);
    try {
      await fetch('/api/v1/connect/scan', { method: 'POST' });
      await refreshDevices();
    } catch {
      // ignore
    } finally {
      setIsScanning(false);
    }
  };

  const handlePlayOnDevice = async (device: any) => {
    if (!currentTrack) {
      window.dispatchEvent(
        new CustomEvent('audiohub:toast', {
          detail: { message: 'Pick a track to stream to this device.' },
        }),
      );
      return;
    }

    setConnectingDeviceId(device.id);
    window.dispatchEvent(
      new CustomEvent('audiohub:toast', {
        detail: { message: `Connecting to ${device.name}...` },
      }),
    );

    try {
      await transferPlayback(device.id);
      window.dispatchEvent(
        new CustomEvent('audiohub:toast', {
          detail: { message: `Streaming to ${device.name}!` },
        }),
      );
    } catch {
      window.dispatchEvent(
        new CustomEvent('audiohub:toast', {
          detail: { message: `Failed to stream to ${device.name}.` },
        }),
      );
    } finally {
      setTimeout(() => {
        setConnectingDeviceId(null);
        onClose();
      }, 700);
    }
  };

  const handleLaunchTvPlayer = async (device: any) => {
    window.dispatchEvent(
      new CustomEvent('audiohub:toast', {
        detail: { message: `Opening TV Player on ${device.name}...` },
      }),
    );
    try {
      controlRemoteDevice(device.id, 'launch_tv');
      window.dispatchEvent(
        new CustomEvent('audiohub:toast', {
          detail: { message: `TV Player loaded on ${device.name}!` },
        }),
      );
      setTimeout(onClose, 600);
    } catch {
      window.dispatchEvent(
        new CustomEvent('audiohub:toast', {
          detail: { message: `Could not open TV Player on ${device.name}` },
        }),
      );
    }
  };

  const handleJoinRoomDirect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!roomCodeInput.trim()) return;
    setIsJoiningRoom(true);
    try {
      const code = roomCodeInput.trim().toUpperCase();
      const ok = await joinRoom(code);
      if (ok) {
        setRoomCodeInput('');
        window.dispatchEvent(
          new CustomEvent('audiohub:toast', {
            detail: { message: `Joined Room ${code}!` },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('audiohub:toast', {
            detail: { message: 'Room code not found or session ended.' },
          }),
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent('audiohub:toast', {
          detail: { message: 'Failed to join room.' },
        }),
      );
    } finally {
      setIsJoiningRoom(false);
    }
  };

  if (!isOpen) return null;

  const isHeadphone = (label: string) => {
    const l = label.toLowerCase();
    return (
      l.includes('headphone') ||
      l.includes('airpod') ||
      l.includes('bud') ||
      l.includes('wh-') ||
      l.includes('wf-') ||
      l.includes('bose') ||
      l.includes('bluetooth') ||
      l.includes('sony')
    );
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tv':
        return <Tv className="w-5 h-5" />;
      default:
        return <Laptop className="w-5 h-5" />;
    }
  };

  const remoteDevices = onlineDevices.filter((d) => d.id !== currentDeviceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center">
              <Speaker className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight">Connect to a Device</h3>
              <p className="text-xs text-spotify-gray">
                Real-time multi-device remote control & audio handoff
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-spotify-gray hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Active Remote Playing Device Spotlight */}
          {activeRemoteDevice && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-spotify-green/20 via-spotify-green/10 to-transparent border border-spotify-green/40 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="p-2 rounded-xl bg-spotify-green/20 text-spotify-green shrink-0">
                    {getDeviceIcon(activeRemoteDevice.device_type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-spotify-green animate-pulse" />
                      <p className="text-sm font-bold text-white truncate">
                        {activeRemoteDevice.name}
                      </p>
                    </div>
                    <p className="text-xs text-spotify-green font-medium truncate mt-0.5">
                      {activeRemoteDevice.is_playing ? 'Playing' : 'Paused'} •{' '}
                      {activeRemoteDevice.current_track?.title || 'AudioHub Audio'}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-spotify-green text-black shrink-0">
                  {isRemoteControlActive ? 'Controlling' : 'Playing'}
                </span>
              </div>

              {/* Quick Transfer & Control Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => {
                    takeOverPlaybackLocally();
                    onClose();
                  }}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-spotify-green text-black font-bold text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow text-center"
                >
                  🎧 Play On This Device
                </button>

                {((activeRemoteDevice as any).has_screen ||
                  activeRemoteDevice.device_type === 'tv') && (
                  <button
                    onClick={() => handleLaunchTvPlayer(activeRemoteDevice)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/20 border border-purple-500/40 text-purple-200 hover:bg-purple-600 hover:text-white transition-all flex items-center gap-1.5 shadow"
                    title="Launch full TV visualizer stage with spinning vinyl & live lyrics on this screen"
                  >
                    <Tv className="w-3.5 h-3.5 text-purple-300" />
                    <span>📺 Visualizer</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (!isRemoteControlActive) {
                      selectRemoteDevice(activeRemoteDevice.id);
                    } else {
                      setIsRemoteControlActive(false);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    isRemoteControlActive
                      ? 'bg-white/15 border-white/25 text-white hover:bg-white/20'
                      : 'bg-spotify-green/15 border-spotify-green/40 text-spotify-green hover:bg-spotify-green/25'
                  }`}
                >
                  {isRemoteControlActive ? '✓ Remote Mode' : '📱 Remote Control'}
                </button>
              </div>
            </div>
          )}

          {/* Synchronized Multi-Device Speaker Group (Party Mode) */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isPartyMode
                ? 'bg-gradient-to-br from-purple-950/40 via-[#1e1329] to-[#121212] border-purple-500/40 shadow-xl'
                : 'bg-white/[0.03] border-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl flex items-center justify-center ${
                    isPartyMode
                      ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30'
                      : 'bg-white/5 text-spotify-gray'
                  }`}
                >
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-white font-bold text-sm">Speaker Group (Party Mode)</h4>
                    {isPartyMode && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider animate-pulse">
                        Live Sync
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-spotify-gray">
                    Play music in lockstep sync across multiple phones & speakers
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={togglePartyMode}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isPartyMode ? 'bg-purple-500' : 'bg-white/20'
                }`}
                role="switch"
                aria-checked={isPartyMode}
                title={isPartyMode ? 'Disable Party Mode' : 'Enable Party Mode (Speaker Group)'}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPartyMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Active Party Mode Controls & Calibration */}
            {isPartyMode && (
              <div className="mt-4 pt-3.5 border-t border-purple-500/20 space-y-3.5 animate-fade-in">
                {/* Live Synchronization Status Badge */}
                <div className="flex items-center justify-between bg-black/40 rounded-xl px-3 py-2 border border-purple-500/20">
                  <span className="text-xs text-spotify-gray font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-spotify-green animate-ping" />
                    Acoustic Clock Sync
                  </span>
                  <span className="text-xs font-mono font-bold text-spotify-green">
                    {syncDeltaMs === null
                      ? '🟡 Syncing NTP clock...'
                      : syncDeltaMs === 0
                        ? '🟢 Master Clock Anchor'
                        : Math.abs(syncDeltaMs) <= 15
                          ? `🟢 In Sync (±${Math.abs(syncDeltaMs)}ms)`
                          : `⚡ Correcting (${syncDeltaMs > 0 ? '+' : ''}${syncDeltaMs}ms)`}
                  </span>
                </div>

                {/* Bluetooth Latency Offset Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-spotify-gray font-medium">
                      Hardware / Bluetooth Latency Offset
                    </span>
                    <span className="text-purple-300 font-mono font-bold">
                      {bluetoothOffsetMs > 0
                        ? `+${bluetoothOffsetMs} ms`
                        : `${bluetoothOffsetMs} ms`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-150}
                    max={300}
                    step={10}
                    value={bluetoothOffsetMs}
                    onChange={(e) => setBluetoothOffsetMs(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-400"
                  />
                  <div className="flex items-center justify-between text-[10px] text-spotify-gray/70 mt-1 font-mono">
                    <span>-150ms (Lead)</span>
                    <span>0ms (Wired/Phone)</span>
                    <span>+300ms (Lag)</span>
                  </div>

                  {/* Latency Presets */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      { label: '📱 Phone Speaker', val: 0 },
                      { label: '🎧 AirPods / Buds', val: 100 },
                      { label: '🔊 BT Speaker', val: 180 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setBluetoothOffsetMs(preset.val)}
                        className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition-all ${
                          bluetoothOffsetMs === preset.val
                            ? 'bg-purple-500/30 border-purple-400 text-white'
                            : 'bg-white/5 border-white/10 text-spotify-gray hover:text-white'
                        }`}
                      >
                        {preset.label} ({preset.val > 0 ? `+${preset.val}` : preset.val}ms)
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Collaborative Group Session & Jukebox Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/30 via-[#131b26] to-[#121212] border border-blue-500/30 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-white font-bold text-sm">Group Session & Jukebox</h4>
                    {activeRoom && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                        {activeRoom.code}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-spotify-gray">
                    {activeRoom
                      ? `${activeRoom.participants.length} connected • Queue songs & sync speakers together`
                      : 'Listen in sync with friends or family & collaborate on the queue'}
                  </p>
                </div>
              </div>

              {activeRoom && (
                <button
                  type="button"
                  onClick={() => {
                    leaveRoom();
                    window.dispatchEvent(
                      new CustomEvent('audiohub:toast', {
                        detail: { message: 'Left group session' },
                      }),
                    );
                  }}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors shrink-0"
                >
                  Leave
                </button>
              )}
            </div>

            {activeRoom ? (
              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-spotify-green animate-pulse" />
                  <span className="text-xs text-white truncate font-medium">
                    Host:{' '}
                    <span className="font-bold text-spotify-green">{activeRoom.host_name}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('audiohub:open-group-session'));
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs transition-colors shrink-0"
                >
                  Manage Session
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-white/10 space-y-2.5">
                <form onSubmit={handleJoinRoomDirect} className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="ENTER 6-DIGIT CODE"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white uppercase tracking-widest font-mono focus:outline-none focus:border-blue-400 text-center font-bold"
                  />
                  <button
                    type="submit"
                    disabled={!roomCodeInput.trim() || isJoiningRoom}
                    className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shrink-0"
                  >
                    {isJoiningRoom ? 'Joining...' : 'Join'}
                  </button>
                </form>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-spotify-gray">Or host your own room:</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      window.dispatchEvent(new CustomEvent('audiohub:open-group-session'));
                    }}
                    className="text-xs text-blue-400 hover:underline font-semibold"
                  >
                    Start Session →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Current Device & Audio Outputs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-spotify-gray uppercase tracking-wider">
                Current Device (Audio Output)
              </span>
              {canSelectAudioOutput && (
                <button
                  onClick={requestAudioOutputDevice}
                  className="text-xs text-spotify-green hover:underline flex items-center gap-1 font-medium"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Pair / Select Device
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {audioOutputDevices.length > 0 ? (
                audioOutputDevices.map((device) => {
                  const isSelected =
                    activeAudioOutputId === device.deviceId ||
                    (activeAudioOutputId === 'default' && device.isDefault);
                  const headphone = isHeadphone(device.label);

                  return (
                    <button
                      key={device.deviceId || 'default'}
                      onClick={() => setAudioOutputDevice(device.deviceId)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                        isSelected
                          ? 'bg-spotify-green/10 border-spotify-green/40 text-white shadow-sm'
                          : 'bg-white/5 border-white/5 text-spotify-gray hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div
                          className={`p-2 rounded-lg ${isSelected ? 'text-spotify-green bg-spotify-green/20' : 'text-spotify-gray bg-white/5'}`}
                        >
                          {headphone ? (
                            <Headphones className="w-4 h-4" />
                          ) : (
                            <Speaker className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate text-white">{device.label}</p>
                          <p className="text-[11px] text-spotify-gray">
                            {device.isDefault ? 'Default System Output' : 'Audio Output Sink'}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1.5 text-spotify-green text-xs font-semibold shrink-0">
                          <Check className="w-4 h-4" />
                          <span>Active</span>
                        </div>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Speaker className="w-4 h-4 text-spotify-green" />
                    <div>
                      <p className="text-sm font-medium text-white">This Device Speakers</p>
                      <p className="text-[11px] text-spotify-gray">
                        Playing through current browser output
                      </p>
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-spotify-green" />
                </div>
              )}
            </div>
            {!isAudioOutputSupported && (
              <p className="text-[11px] text-spotify-gray/70 mt-1.5 italic">
                Device sink selection is supported on Chrome, Edge, and Opera.
              </p>
            )}
          </div>

          {/* Google Cast Section */}
          <div>
            <span className="text-xs font-semibold text-spotify-gray uppercase tracking-wider block mb-2">
              Google Cast
            </span>
            <div
              className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                isCastConnected
                  ? 'bg-spotify-green/10 border-spotify-green/40'
                  : 'bg-white/5 border-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div
                  className={`p-2 rounded-lg ${isCastConnected ? 'text-spotify-green bg-spotify-green/20' : 'text-spotify-gray bg-white/5'}`}
                >
                  <Cast className={`w-4 h-4 ${isCastConnected ? 'animate-pulse' : ''}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {isCastConnected
                      ? castDeviceName || 'Google Cast Speaker'
                      : 'Google Cast Device'}
                  </p>
                  <p className="text-[11px] text-spotify-gray">
                    {isCastConnected
                      ? 'Streaming to Nest / Chromecast'
                      : 'Cast to smart speakers & displays'}
                  </p>
                </div>
              </div>
              <button
                onClick={isCastConnected ? endCastSession : requestCastSession}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isCastConnected
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-white text-black hover:bg-spotify-green hover:text-white'
                }`}
              >
                {isCastConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          </div>

          {/* Smart TVs, Speakers & Connect Devices Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-spotify-gray uppercase tracking-wider">
                Smart TVs, Speakers & Devices
              </span>
              <button
                type="button"
                onClick={handleScanNetwork}
                disabled={isScanning}
                className="text-[11px] text-spotify-green hover:underline flex items-center gap-1 font-medium transition-opacity disabled:opacity-50"
                title="Scan home Wi-Fi for Smart TVs and DLNA speakers"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Scanning...' : 'Scan Wi-Fi'}</span>
              </button>
            </div>

            {remoteDevices.length > 0 ? (
              <div className="space-y-1.5">
                {remoteDevices.map((device) => {
                  const isCurrentActiveRemote = activeRemoteDevice?.id === device.id;
                  const isDlna = !!(device as any).is_dlna;
                  const isCast = !!(device as any).is_cast;
                  const hasScreen = !!(device as any).has_screen;
                  return (
                    <div
                      key={device.id}
                      className={`p-3 rounded-xl border transition-colors flex items-center justify-between ${
                        isCurrentActiveRemote
                          ? 'bg-spotify-green/10 border-spotify-green/30'
                          : isCast
                            ? 'bg-amber-950/15 border-amber-500/20 hover:bg-amber-900/20'
                            : isDlna
                              ? 'bg-blue-950/15 border-blue-500/20 hover:bg-blue-900/20'
                              : 'bg-white/5 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div
                          className={`p-2 rounded-lg ${
                            isCast
                              ? 'text-amber-400 bg-amber-500/10'
                              : isDlna
                                ? 'text-blue-400 bg-blue-500/10'
                                : 'text-spotify-gray bg-white/5'
                          }`}
                        >
                          {getDeviceIcon(device.device_type)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-white truncate">{device.name}</p>
                            {isCast && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider shrink-0">
                                {hasScreen ? 'Google Display' : 'Google Nest'}
                              </span>
                            )}
                            {isDlna && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider shrink-0">
                                {device.device_type === 'tv' ? 'Smart TV' : 'DLNA Audio'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-spotify-gray truncate">
                            {device.is_playing ? (
                              <span className="text-spotify-green font-medium">
                                Playing • {device.current_track?.title || 'Audio'}
                              </span>
                            ) : isCast ? (
                              <span className="text-amber-300/80">Cast Ready • Tap Cast Audio</span>
                            ) : isDlna ? (
                              <span className="text-blue-300/80">Cast Ready • Tap Cast Here</span>
                            ) : (
                              'Online'
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isDlna && !isCast && (
                          <button
                            onClick={() => {
                              selectRemoteDevice(device.id);
                              onClose();
                            }}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                              isCurrentActiveRemote && isRemoteControlActive
                                ? 'bg-spotify-green text-black font-bold'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                            title="Control this device remotely"
                          >
                            {isCurrentActiveRemote && isRemoteControlActive
                              ? 'Controlling'
                              : 'Remote'}
                          </button>
                        )}
                        {isCast && hasScreen && (
                          <button
                            onClick={() => handleLaunchTvPlayer(device)}
                            className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/40 hover:bg-purple-600 hover:text-white transition-colors flex items-center gap-1"
                            title="Open full AudioHub TV player with live synced lyrics and vinyl on this screen"
                          >
                            <Tv className="w-3 h-3" />
                            <span>TV Player</span>
                          </button>
                        )}
                        <button
                          onClick={() => handlePlayOnDevice(device)}
                          disabled={connectingDeviceId === device.id}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-60 ${
                            isCast
                              ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500 hover:text-black font-medium'
                              : isDlna
                                ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40 hover:bg-blue-500 hover:text-white'
                                : 'bg-white/10 text-white hover:bg-spotify-green hover:text-black'
                          }`}
                          title="Send playback to this device"
                        >
                          {connectingDeviceId === device.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Connecting...</span>
                            </>
                          ) : isCast ? (
                            'Cast Audio'
                          ) : isDlna ? (
                            'Cast Here'
                          ) : (
                            'Play Here'
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                <Radio className="w-5 h-5 text-spotify-gray mx-auto mb-1.5 opacity-60" />
                <p className="text-xs text-white font-medium">No other AudioHub devices online</p>
                <p className="text-[11px] text-spotify-gray mt-0.5">
                  Sign in to AudioHub on your phone, tablet, or another browser to hand off playback
                  or control remotely.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-black/30 border-t border-white/5 flex items-center justify-between text-xs text-spotify-gray">
          <span>AudioHub Multi-Device Sync</span>
          <button
            onClick={onClose}
            className="text-white hover:text-spotify-green font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
