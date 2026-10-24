import {
  Award,
  Calendar,
  Clock,
  Disc,
  Film,
  Music,
  Play,
  Radio,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { type ListeningStats, Track } from '../types';
import { formatTime } from '../utils/formatters';
import { WrappedStoryModal } from './WrappedStoryModal';

interface ListeningStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ListeningStatsModal: React.FC<ListeningStatsModalProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<ListeningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'top_tracks' | 'top_artists' | 'recent'>(
    'overview',
  );
  const [showStoryModal, setShowStoryModal] = useState(false);
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    fetch('/api/v1/stats/me')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load stats');
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Failed to load listening stats:', err);
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const formatPlayedAt = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-900/30 via-spotify-green/20 to-emerald-900/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center shadow-lg border border-spotify-green/30">
              <Sparkles className="w-5 h-5 fill-current animate-pulse" />
            </div>
            <div>
              <h3 className="text-white font-black text-lg tracking-tight">Year in Review</h3>
              <p className="text-xs text-spotify-gray">
                Your personal listening habits and analytics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats && stats.total_plays > 0 && (
              <button
                onClick={() => setShowStoryModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-spotify-green hover:bg-spotify-green/90 text-black text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all"
              >
                <Film className="w-3.5 h-3.5 fill-black" />
                <span>Watch Story</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-spotify-gray hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-[#181818] overflow-x-auto custom-scrollbar">
          {(['overview', 'top_tracks', 'top_artists', 'recent'] as const).map((tab) => {
            const labels = {
              overview: 'Overview',
              top_tracks: 'Top Tracks',
              top_artists: 'Top Artists',
              recent: 'Recent History',
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'bg-spotify-green text-black'
                    : 'bg-white/5 text-spotify-gray hover:text-white hover:bg-white/10'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-spotify-gray">
              <div className="w-8 h-8 rounded-full border-2 border-spotify-green border-t-transparent animate-spin" />
              <p className="text-sm">Calculating your listening data...</p>
            </div>
          ) : !stats || stats.total_plays === 0 ? (
            <div className="py-16 text-center text-spotify-gray space-y-2">
              <Music className="w-12 h-12 mx-auto text-spotify-gray/50 mb-2" />
              <p className="text-white font-bold text-base">No listening data yet</p>
              <p className="text-xs max-w-sm mx-auto">
                Start playing songs in AudioHub and your personal listening stats, top artists, and
                listening hours will appear here!
              </p>
            </div>
          ) : (
            <>
              {/* Tab: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Story / Shorts Banner */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/60 via-pink-900/40 to-emerald-900/60 border border-purple-500/30 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                    <div className="space-y-1 text-center sm:text-left z-10">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
                        <Sparkles className="w-3 h-3" />
                        Interactive Shorts
                      </div>
                      <h4 className="text-white font-black text-base sm:text-lg">
                        Experience Your Wrapped Story
                      </h4>
                      <p className="text-xs text-white/70 max-w-md">
                        Watch your animated full-screen reel with live music snippets and spinning
                        vinyl, or queue an HD 9:16 video short export.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowStoryModal(true)}
                      className="z-10 shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full bg-spotify-green hover:bg-emerald-400 text-black text-sm font-black shadow-lg hover:scale-105 active:scale-95 transition-all"
                    >
                      <Film className="w-4 h-4 fill-black" />
                      <span>Watch Story</span>
                    </button>
                    <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
                  </div>

                  {/* Highlights Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 text-center">
                      <Music className="w-5 h-5 text-spotify-green mx-auto mb-2" />
                      <p className="text-2xl font-black text-white">{stats.total_plays}</p>
                      <p className="text-[11px] text-spotify-gray uppercase tracking-wider font-semibold mt-0.5">
                        Plays
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 text-center">
                      <Clock className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                      <p className="text-2xl font-black text-white">
                        {stats.total_duration_hours}h
                      </p>
                      <p className="text-[11px] text-spotify-gray uppercase tracking-wider font-semibold mt-0.5">
                        Listened
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 text-center">
                      <Disc className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                      <p className="text-2xl font-black text-white">{stats.unique_tracks}</p>
                      <p className="text-[11px] text-spotify-gray uppercase tracking-wider font-semibold mt-0.5">
                        Unique Songs
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 text-center">
                      <TrendingUp className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                      <p className="text-2xl font-black text-white">{stats.unique_artists}</p>
                      <p className="text-[11px] text-spotify-gray uppercase tracking-wider font-semibold mt-0.5">
                        Artists
                      </p>
                    </div>
                  </div>

                  {/* Top 3 Artists Preview */}
                  {stats.top_artists.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-bold text-sm flex items-center gap-2">
                          <Award className="w-4 h-4 text-spotify-green" />
                          Top Artists
                        </h4>
                        <button
                          onClick={() => setActiveTab('top_artists')}
                          className="text-xs text-spotify-green hover:underline font-medium"
                        >
                          View all
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {stats.top_artists.slice(0, 3).map((item, idx) => (
                          <div
                            key={item.artist}
                            className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3"
                          >
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">
                              #{idx + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">{item.artist}</p>
                              <p className="text-[11px] text-spotify-gray">
                                {item.play_count} plays
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top 5 Tracks Preview */}
                  {stats.top_tracks.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-bold text-sm flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-spotify-green" />
                          Most Played Tracks
                        </h4>
                        <button
                          onClick={() => setActiveTab('top_tracks')}
                          className="text-xs text-spotify-green hover:underline font-medium"
                        >
                          View all
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {stats.top_tracks.slice(0, 5).map((item, idx) => {
                          const isCur = currentTrack?.id === item.track.id && isPlaying;
                          return (
                            <div
                              key={item.track.id}
                              onClick={() => playTrack(item.track)}
                              className="group flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5"
                            >
                              <div className="flex items-center gap-3 min-w-0 pr-3">
                                <span className="w-5 text-center text-xs font-bold text-spotify-gray group-hover:text-spotify-green">
                                  {idx + 1}
                                </span>
                                {item.track.cover_url ? (
                                  <img
                                    src={item.track.cover_url}
                                    alt={item.track.title}
                                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-spotify-gray shrink-0">
                                    <Music className="w-5 h-5" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p
                                    className={`text-sm font-medium truncate ${isCur ? 'text-spotify-green font-bold' : 'text-white'}`}
                                  >
                                    {item.track.title}
                                  </p>
                                  <p className="text-xs text-spotify-gray truncate">
                                    {item.track.artist}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs font-semibold text-spotify-gray bg-white/5 px-2 py-0.5 rounded-full">
                                  {item.play_count} plays
                                </span>
                                <button className="p-1.5 rounded-full bg-spotify-green text-black opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Top Tracks */}
              {activeTab === 'top_tracks' && (
                <div className="space-y-2">
                  {stats.top_tracks.map((item, idx) => {
                    const isCur = currentTrack?.id === item.track.id && isPlaying;
                    return (
                      <div
                        key={item.track.id}
                        onClick={() => playTrack(item.track)}
                        className="group flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 pr-3">
                          <span
                            className={`w-6 text-center text-sm font-extrabold ${idx < 3 ? 'text-spotify-green' : 'text-spotify-gray'}`}
                          >
                            #{idx + 1}
                          </span>
                          {item.track.cover_url ? (
                            <img
                              src={item.track.cover_url}
                              alt={item.track.title}
                              className="w-11 h-11 rounded-lg object-cover shrink-0 shadow-md"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-white/10 flex items-center justify-center text-spotify-gray shrink-0">
                              <Music className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-semibold truncate ${isCur ? 'text-spotify-green' : 'text-white'}`}
                            >
                              {item.track.title}
                            </p>
                            <p className="text-xs text-spotify-gray truncate">
                              {item.track.artist} {item.track.album ? `• ${item.track.album}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-bold text-white bg-white/10 px-2.5 py-1 rounded-full">
                            {item.play_count} plays
                          </span>
                          <button className="p-2 rounded-full bg-spotify-green text-black opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab: Top Artists */}
              {activeTab === 'top_artists' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stats.top_artists.map((item, idx) => (
                    <div
                      key={item.artist}
                      className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                            idx === 0
                              ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
                              : idx === 1
                                ? 'bg-slate-300 text-black'
                                : idx === 2
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-white/10 text-spotify-gray'
                          }`}
                        >
                          #{idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{item.artist}</p>
                          <p className="text-xs text-spotify-gray">Top played artist</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-spotify-green bg-spotify-green/10 border border-spotify-green/20 px-2.5 py-1 rounded-full shrink-0">
                        {item.play_count} plays
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: Recent History */}
              {activeTab === 'recent' && (
                <div className="space-y-2">
                  {stats.recent_history.map((item, idx) => (
                    <div
                      key={`${item.track.id}-${idx}`}
                      onClick={() => playTrack(item.track)}
                      className="group flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-3">
                        {item.track.cover_url ? (
                          <img
                            src={item.track.cover_url}
                            alt={item.track.title}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-spotify-gray shrink-0">
                            <Music className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate group-hover:text-spotify-green transition-colors">
                            {item.track.title}
                          </p>
                          <p className="text-xs text-spotify-gray truncate">{item.track.artist}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-spotify-gray flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatPlayedAt(item.played_at)}
                        </span>
                        <button className="p-1.5 rounded-full bg-spotify-green text-black opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#181818] border-t border-white/5 flex items-center justify-between text-xs text-spotify-gray">
          <span>AudioHub Listening Insights</span>
          <button
            onClick={onClose}
            className="text-white hover:text-spotify-green font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <WrappedStoryModal
        isOpen={showStoryModal}
        onClose={() => setShowStoryModal(false)}
        stats={stats}
      />
    </div>
  );
};
