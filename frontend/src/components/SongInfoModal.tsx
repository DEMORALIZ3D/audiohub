import {
  AlertCircle,
  Check,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Music,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import type { Track } from '../types';

interface SongInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
}

interface AudioSourceInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover_url: string;
  duration_seconds: number;
  source_type: string;
  source_id: string;
  is_cached: boolean;
  is_uploaded: boolean;
  youtube_id: string | null;
  youtube_url: string | null;
}

interface AlternativeMatch {
  video_id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string | null;
  youtube_url: string;
  is_current: boolean;
}

export const SongInfoModal: React.FC<SongInfoModalProps> = ({ isOpen, onClose, track }) => {
  const { playTrack, currentTrack } = usePlayer();
  const [info, setInfo] = useState<AudioSourceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState<AlternativeMatch[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [savingSourceId, setSavingSourceId] = useState<string | null>(null);
  const [customSearchQuery, setCustomSearchQuery] = useState('');

  const fetchTrackInfo = () => {
    if (!track) return;
    setLoading(true);
    fetch(`/api/v1/stream/${track.id}/info`)
      .then((res) => res.json())
      .then((data) => setInfo(data))
      .catch((err) => console.warn('Could not fetch audio info', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen || !track) {
      setInfo(null);
      setShowAlternatives(false);
      setCustomSearchQuery('');
      return;
    }
    fetchTrackInfo();
  }, [isOpen, track?.id]);

  const handleRematch = async () => {
    if (!track) return;
    setRematching(true);
    try {
      const res = await fetch(`/api/v1/tracks/${track.id}/rematch`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const updatedTrack = { ...track, source_id: data.new_source_id, source_type: 'youtube' };
        if (currentTrack?.id === track.id) {
          playTrack(updatedTrack);
        }
        fetchTrackInfo();
      }
    } catch (e) {
      console.warn('Rematch failed', e);
    } finally {
      setRematching(false);
    }
  };

  const handleLoadAlternatives = (overrideQ?: string) => {
    if (!track) return;
    setShowAlternatives(true);
    setLoadingAlts(true);
    const qStr = overrideQ !== undefined ? overrideQ : customSearchQuery;
    const url = qStr.trim()
      ? `/api/v1/tracks/${track.id}/alternatives?q=${encodeURIComponent(qStr.trim())}`
      : `/api/v1/tracks/${track.id}/alternatives`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setAlternatives(data.alternatives || []);
      })
      .catch((err) => console.warn('Failed to load alternatives', err))
      .finally(() => setLoadingAlts(false));
  };

  const handleSelectAlternative = async (alt: AlternativeMatch) => {
    if (!track) return;
    setSavingSourceId(alt.video_id);
    try {
      const res = await fetch(`/api/v1/tracks/${track.id}/set-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: alt.video_id, source_type: 'youtube' }),
      });
      if (res.ok) {
        const updatedTrack = { ...track, source_id: alt.video_id, source_type: 'youtube' };
        if (currentTrack?.id === track.id) {
          playTrack(updatedTrack);
        }
        fetchTrackInfo();
        setShowAlternatives(false);
      }
    } catch (e) {
      console.error('Failed to set alternative source', e);
    } finally {
      setSavingSourceId(null);
    }
  };

  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-lg p-5 sm:p-6 flex flex-col gap-4 shadow-2xl overflow-hidden relative max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-spotify-gray hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center flex-shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base leading-tight">Audio Source Inspector</h3>
            <p className="text-xs text-spotify-gray">
              Real-time track matching & stream diagnostics
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-spotify-gray">
            <Loader2 className="w-6 h-6 animate-spin text-spotify-green" />
            <span className="text-xs">Inspecting audio stream source...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-xs overflow-y-auto pr-1">
            {/* Track Info Card */}
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="w-12 h-12 rounded-lg bg-[#282828] overflow-hidden flex-shrink-0 flex items-center justify-center">
                {track.cover_url ? (
                  <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-6 h-6 text-white/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold truncate text-sm">{track.title}</p>
                <p className="text-spotify-gray truncate">{track.artist}</p>
                {track.album && (
                  <p className="text-spotify-gray/60 text-[11px] truncate">Album: {track.album}</p>
                )}
              </div>
            </div>

            {/* Source Details */}
            <div className="flex flex-col gap-2 p-3 bg-[#161616] rounded-xl border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-spotify-gray">Playback Mode:</span>
                <span className="font-semibold text-white">
                  {track.is_uploaded
                    ? 'Uploaded File (Local Storage)'
                    : track.is_cached
                      ? 'Cached to Server Disk'
                      : 'Live Stream (YouTube Music)'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-spotify-gray">Stream Match:</span>
                <span className="font-semibold text-spotify-green flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {track.source_type === 'youtube'
                    ? 'YouTube Music (Exact Match)'
                    : 'AudioHub Catalog'}
                </span>
              </div>

              {info?.youtube_id && (
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-spotify-gray">Matched Video ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white/80">{info.youtube_id}</span>
                    <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
                      Cached
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {info?.youtube_url ? (
                <a
                  href={info.youtube_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 font-semibold transition-all hover:scale-[1.02] active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Verify Video</span>
                </a>
              ) : (
                <div className="py-2.5 text-center text-spotify-gray">Resolving...</div>
              )}

              <button
                onClick={handleRematch}
                disabled={rematching}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-spotify-green/20 hover:bg-spotify-green/30 text-spotify-green border border-spotify-green/30 font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                title="Clears old cached match and runs fresh scoring algorithm"
              >
                <Sparkles className={`w-3.5 h-3.5 ${rematching ? 'animate-spin' : ''}`} />
                <span>{rematching ? 'Matching...' : 'Auto Re-Match'}</span>
              </button>

              <button
                onClick={() => handleLoadAlternatives()}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all hover:scale-[1.02] active:scale-95 border border-white/10"
              >
                <RefreshCw className="w-3.5 h-3.5 text-spotify-green" />
                <span>Pick Alternative</span>
              </button>
            </div>

            {/* Alternatives Drawer / List */}
            {showAlternatives && (
              <div className="flex flex-col gap-2.5 p-3.5 bg-[#141414] rounded-xl border border-white/10 mt-1">
                <div className="flex items-center justify-between pb-1 border-b border-white/10">
                  <span className="font-bold text-white text-xs">
                    Choose or Search Alternative Version
                  </span>
                  <button
                    onClick={() => setShowAlternatives(false)}
                    className="text-spotify-gray hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Search Bar: Query or Paste YouTube URL */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLoadAlternatives();
                  }}
                  className="flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-spotify-gray" />
                    <input
                      type="text"
                      placeholder="Search title, mix name, or paste YouTube link..."
                      value={customSearchQuery}
                      onChange={(e) => setCustomSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-spotify-gray focus:outline-none focus:border-spotify-green transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loadingAlts}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Search
                  </button>
                </form>

                {loadingAlts ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2 text-spotify-gray">
                    <Loader2 className="w-5 h-5 animate-spin text-spotify-green" />
                    <span className="text-[11px]">Searching YouTube candidates...</span>
                  </div>
                ) : alternatives.length === 0 ? (
                  <div className="py-4 text-center text-spotify-gray text-xs">
                    No alternative matches found on YouTube Music.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                    {alternatives.map((alt) => {
                      const isCurrent = alt.video_id === info?.youtube_id;
                      const isSaving = savingSourceId === alt.video_id;

                      return (
                        <div
                          key={alt.video_id}
                          onClick={() => handleSelectAlternative(alt)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isCurrent
                              ? 'bg-spotify-green/15 border border-spotify-green/40'
                              : 'hover:bg-white/10 bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                            {alt.thumbnail && (
                              <img
                                src={alt.thumbnail}
                                alt=""
                                className="w-8 h-8 rounded object-cover flex-shrink-0"
                              />
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="text-white font-semibold text-[11px] truncate">
                                {alt.title}
                              </span>
                              <span className="text-spotify-gray text-[10px] truncate">
                                {alt.artist} {alt.duration ? `• ${alt.duration}` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin text-spotify-green" />
                            ) : isCurrent ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-spotify-green text-black flex items-center gap-1">
                                <Check className="w-3 h-3" /> Locked Match
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-spotify-green/20 hover:bg-spotify-green text-spotify-green hover:text-black transition-all"
                              >
                                Lock & Play
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};
