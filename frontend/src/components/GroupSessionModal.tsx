import { Cast, Check, Copy, Layers, LogOut, Music, Plus, Radio, Users, X } from 'lucide-react';
import React, { useState } from 'react';
import { useConnect } from '../context/ConnectContext';
import { usePlayer } from '../context/PlayerContext';

interface GroupSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string | null;
}

export const GroupSessionModal: React.FC<GroupSessionModalProps> = ({
  isOpen,
  onClose,
  initialCode,
}) => {
  const { activeRoom, createRoom, joinRoom, leaveRoom, isCastConnected, castDeviceName } =
    usePlayer();

  const { isPartyMode, togglePartyMode, syncDeltaMs, currentDeviceId } = useConnect();

  const [inputCode, setInputCode] = useState(initialCode ? initialCode.toUpperCase() : '');
  const [nickname, setNickname] = useState(() => {
    return localStorage.getItem('audiohub_guest_name') || '';
  });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialCode) {
      setInputCode(initialCode.toUpperCase());
    }
  }, [initialCode]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      await createRoom();
    } catch (e: any) {
      setError(e.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const cleanCode = inputCode.trim().toUpperCase();
      const cleanName = nickname.trim() || undefined;
      if (cleanName) {
        localStorage.setItem('audiohub_guest_name', cleanName);
      }
      const ok = await joinRoom(cleanCode, cleanName);
      if (!ok) {
        setError('Room code not found or session ended.');
      } else {
        setInputCode('');
        window.dispatchEvent(
          new CustomEvent('audiohub:toast', {
            detail: { message: `Joined Group Session ${cleanCode}!` },
          }),
        );
      }
    } catch (e: any) {
      setError(e.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = async () => {
    if (!activeRoom) return;
    const url = `${window.location.origin}/?room=${activeRoom.code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my AudioHub Group Session (${activeRoom.code})`,
          text: `Join my music session on AudioHub! Room Code: ${activeRoom.code}`,
          url,
        });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight">
                Group Session / Jukebox
              </h3>
              <p className="text-[11px] text-spotify-gray">
                Collaborate on playback & speaker queue
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-spotify-gray hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Active Room View */}
          {activeRoom ? (
            <div className="space-y-4">
              {/* Speaker Cast Status Banner */}
              {isCastConnected ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-spotify-green/10 border border-spotify-green/30">
                  <Cast className="w-5 h-5 text-spotify-green flex-shrink-0 animate-pulse" />
                  <div className="text-xs">
                    <p className="font-bold text-white">
                      Active on {castDeviceName || 'Cast Speaker'}
                    </p>
                    <p className="text-spotify-gray text-[11px] mt-0.5">
                      Songs queued by any participant will play directly through this speaker!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <Radio className="w-5 h-5 text-spotify-green flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-white">Host Session Active</p>
                    <p className="text-spotify-gray text-[11px] mt-0.5">
                      Tip: Tap the Cast icon anytime to output this shared room directly to your
                      smart speakers.
                    </p>
                  </div>
                </div>
              )}

              {/* Room Code & Invite Link */}
              <div className="bg-[#121212] border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center">
                <span className="text-[11px] font-semibold text-spotify-gray uppercase tracking-wider">
                  Room Invite Code
                </span>
                <span className="text-3xl font-extrabold tracking-widest text-spotify-green font-mono">
                  {activeRoom.code}
                </span>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-spotify-green" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copied ? 'Link Copied!' : 'Copy Share Link'}</span>
                </button>
              </div>

              {/* Phone Speaker Group Sync (Party Mode) */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  isPartyMode
                    ? 'bg-purple-950/30 border-purple-500/40 shadow-md'
                    : 'bg-white/[0.03] border-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg ${
                        isPartyMode
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-white/5 text-spotify-gray'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">
                        Phone Speaker Group
                      </p>
                      <p className="text-[11px] text-spotify-gray">
                        Play audio in lockstep on this phone
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={togglePartyMode}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      isPartyMode ? 'bg-purple-500' : 'bg-white/20'
                    }`}
                    title={isPartyMode ? 'Disable Phone Speaker Sync' : 'Enable Phone Speaker Sync'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        isPartyMode ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                {isPartyMode && (
                  <div className="mt-2.5 pt-2 border-t border-purple-500/20 flex items-center justify-between text-[11px]">
                    <span className="text-spotify-gray">Sync Status:</span>
                    <span className="font-mono font-bold text-spotify-green">
                      {syncDeltaMs === null
                        ? '🟡 Syncing clock...'
                        : syncDeltaMs === 0
                          ? '🟢 Master Host'
                          : Math.abs(syncDeltaMs) <= 15
                            ? `🟢 In Sync (±${Math.abs(syncDeltaMs)}ms)`
                            : `⚡ Correcting (${syncDeltaMs > 0 ? '+' : ''}${syncDeltaMs}ms)`}
                    </span>
                  </div>
                )}
              </div>

              {/* Participants */}
              <div>
                <span className="text-xs font-bold text-spotify-gray uppercase tracking-wider block mb-2">
                  In This Room ({activeRoom.participants.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeRoom.participants.map((p, idx) => {
                    const isYou =
                      (p as any).device_id === currentDeviceId ||
                      p.id === localStorage.getItem('audiohub_user_id');
                    return (
                      <span
                        key={idx}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 ${
                          isYou
                            ? 'bg-spotify-green/15 border-spotify-green/40 text-white'
                            : 'bg-white/5 border-white/10 text-white'
                        }`}
                      >
                        <span>{p.name}</span>
                        {isYou && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-spotify-green font-bold">
                            You
                          </span>
                        )}
                        {p.is_host && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-spotify-green/20 text-spotify-green font-bold">
                            Host
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Shared Queue */}
              <div>
                <span className="text-xs font-bold text-spotify-gray uppercase tracking-wider block mb-2">
                  Shared Queue ({activeRoom.queue.length})
                </span>
                {activeRoom.queue.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {activeRoom.queue.map((t, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2.5 p-2 rounded-lg bg-[#222] border border-white/5"
                      >
                        <div className="w-8 h-8 rounded bg-[#333] flex items-center justify-center flex-shrink-0 text-white/50 overflow-hidden">
                          {t.cover_url ? (
                            <img src={t.cover_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Music className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 truncate">
                          <p className="text-xs font-bold text-white truncate">{t.title}</p>
                          <p className="text-[10px] text-spotify-gray truncate">
                            {t.artist} •{' '}
                            <span className="text-spotify-green">Added by {t.added_by}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center">
                    <p className="text-xs text-spotify-gray">
                      Queue is currently empty. Anyone in the room can add songs!
                    </p>
                  </div>
                )}
              </div>

              {/* Leave Button */}
              <div className="pt-2 border-t border-white/5 flex justify-end">
                <button
                  type="button"
                  onClick={leaveRoom}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave Room</span>
                </button>
              </div>
            </div>
          ) : (
            /* No Active Room: Create or Join */
            <div className="space-y-6">
              {/* Speaker explanation callout */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-3">
                <Cast className="w-5 h-5 text-spotify-green flex-shrink-0 mt-0.5" />
                <div className="text-xs text-spotify-gray leading-relaxed">
                  <span className="text-white font-bold block mb-0.5">
                    Collaborative Group Jukebox & Speakers
                  </span>
                  Listen together in sync on multiple phones, or invite friends to queue songs
                  together!
                </div>
              </div>

              {/* Start Room Button */}
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="w-full py-3 bg-spotify-green text-black font-bold rounded-full text-xs hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4 fill-current" />
                <span>Start a Group Session</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[11px] text-spotify-gray font-semibold uppercase">
                  Or Join with Code
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Join Room Form */}
              <form onSubmit={handleJoin} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="ENTER 6-DIGIT CODE"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-[#242424] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white uppercase tracking-widest font-mono focus:outline-none focus:border-spotify-green text-center font-bold"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Your Name (e.g. Chez)"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="flex-1 bg-[#242424] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-spotify-green"
                  />
                  <button
                    type="submit"
                    disabled={!inputCode.trim() || loading}
                    className="px-6 py-2.5 bg-spotify-green hover:bg-spotify-green/90 text-black font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                  >
                    Join
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
