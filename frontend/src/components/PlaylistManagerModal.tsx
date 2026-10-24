import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  CheckSquare,
  Download,
  FileSpreadsheet,
  FileText,
  Heart,
  Loader2,
  Music,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import type { Track } from '../types';
import { formatDuration } from '../utils/formatters';

interface PlaylistManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  tracks: Track[];
  onRefresh: () => void;
  isLikedSongs?: boolean;
  playlistId?: string;
}

export const PlaylistManagerModal: React.FC<PlaylistManagerModalProps> = ({
  isOpen,
  onClose,
  title,
  tracks,
  onRefresh,
  isLikedSongs = false,
  playlistId,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null,
  );

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Filtered tracks
  const filteredTracks = useMemo(() => {
    if (!filterQuery.trim()) return tracks;
    const q = filterQuery.toLowerCase();
    return tracks.filter(
      (t) =>
        t.title?.toLowerCase().includes(q) ||
        t.artist?.toLowerCase().includes(q) ||
        t.album?.toLowerCase().includes(q),
    );
  }, [tracks, filterQuery]);

  if (!isOpen) return null;

  // Toggle single selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Select all / deselect all
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTracks.length && filteredTracks.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTracks.map((t) => t.id)));
    }
  };

  // Batch delete selected tracks
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(`Are you sure you want to remove ${selectedIds.size} selected songs from ${title}?`)
    )
      return;

    setLoading(true);
    const ids = Array.from(selectedIds);

    try {
      const url = isLikedSongs
        ? '/api/v1/tracks/liked/batch-delete'
        : `/api/v1/playlists/${playlistId}/tracks/batch-delete`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_ids: ids }),
      });

      if (res.ok) {
        showFeedback(`Removed ${ids.length} tracks.`);
        setSelectedIds(new Set());
        onRefresh();
      } else {
        showFeedback('Failed to remove selected tracks', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Clear all tracks
  const handleClearAll = async () => {
    if (tracks.length === 0) return;
    if (
      !confirm(
        `DANGER: Are you sure you want to CLEAR ALL ${tracks.length} songs from ${title}? This cannot be undone.`,
      )
    )
      return;

    setLoading(true);
    try {
      const url = isLikedSongs
        ? '/api/v1/tracks/liked/clear'
        : `/api/v1/playlists/${playlistId}/tracks/clear`;

      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        showFeedback(`All tracks cleared from ${title}.`);
        setSelectedIds(new Set());
        onRefresh();
      } else {
        showFeedback('Failed to clear playlist', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reverse Order
  const handleReverseOrder = async () => {
    if (!isLikedSongs) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/tracks/liked/reverse', { method: 'POST' });
      if (res.ok) {
        showFeedback('Reversed order of liked songs.');
        onRefresh();
      }
    } catch (err: any) {
      showFeedback(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Export as CSV
  const handleExportCSV = () => {
    const listToExport =
      selectedIds.size > 0 ? tracks.filter((t) => selectedIds.has(t.id)) : tracks;

    if (listToExport.length === 0) {
      showFeedback('No tracks to export', 'error');
      return;
    }

    const header = ['Track Name', 'Artist Name(s)', 'Album Name', 'Duration (Seconds)'];
    const rows = listToExport.map((t) => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.artist || '').replace(/"/g, '""')}"`,
      `"${(t.album || '').replace(/"/g, '""')}"`,
      t.duration_seconds || 0,
    ]);

    const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showFeedback(`Exported ${listToExport.length} songs to CSV!`);
  };

  // Export as TXT tracklist
  const handleExportTXT = () => {
    const listToExport =
      selectedIds.size > 0 ? tracks.filter((t) => selectedIds.has(t.id)) : tracks;

    if (listToExport.length === 0) {
      showFeedback('No tracks to export', 'error');
      return;
    }

    const lines = listToExport.map((t) => `${t.artist} - ${t.title}`);
    const txtContent = lines.join('\n');
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showFeedback(`Exported ${listToExport.length} songs to TXT!`);
  };

  const isAllSelected = filteredTracks.length > 0 && selectedIds.size === filteredTracks.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center ${isLikedSongs ? 'bg-pink-500/20 text-pink-400' : 'bg-spotify-green/20 text-spotify-green'}`}
            >
              {isLikedSongs ? (
                <Heart className="w-5 h-5 fill-current" />
              ) : (
                <Music className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-white font-bold text-base sm:text-lg leading-tight">
                Manage {title}
              </h3>
              <p className="text-xs text-spotify-gray">
                {tracks.length} tracks total • Batch delete, clear, search & export
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-spotify-gray hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert Toast */}
        {feedback && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b transition-all ${
              feedback.type === 'error'
                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                : 'bg-spotify-green/20 text-spotify-green border-spotify-green/30'
            }`}
          >
            {feedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Toolbar: Search + Action Buttons */}
        <div className="p-4 border-b border-white/5 bg-[#141414] flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search filter */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-spotify-gray absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Filter by title, artist, or album..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full bg-[#242424] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-spotify-green"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-3 top-2.5 text-spotify-gray hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all"
                title="Export as CSV (Exportify compatible)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-spotify-green" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleExportTXT}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all"
                title="Export as plain text tracklist"
              >
                <FileText className="w-3.5 h-3.5 text-spotify-green" />
                <span>Export TXT</span>
              </button>

              {isLikedSongs && (
                <button
                  onClick={handleReverseOrder}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all"
                  title="Reverse order (flip oldest/newest)"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-spotify-green" />
                  <span>Reverse Order</span>
                </button>
              )}
            </div>
          </div>

          {/* Selection Bar & Danger Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] text-white font-semibold transition-colors border border-white/5"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-spotify-green" />
                ) : (
                  <Square className="w-4 h-4 text-spotify-gray" />
                )}
                <span>
                  {isAllSelected ? 'Deselect All' : 'Select All'} ({selectedIds.size}/
                  {filteredTracks.length})
                </span>
              </button>

              {selectedIds.size > 0 && (
                <span className="text-spotify-gray text-[11px]">
                  {selectedIds.size} songs selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBatchDelete}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 font-bold transition-all"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Delete Selected ({selectedIds.size})</span>
                </button>
              )}

              <button
                onClick={handleClearAll}
                disabled={loading || tracks.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-800/40 font-semibold transition-all disabled:opacity-30"
                title="Wipe all songs from this collection"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Songs</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tracks Table */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 divide-y divide-white/5">
          {filteredTracks.length === 0 ? (
            <div className="py-16 text-center text-spotify-gray">
              <p className="text-sm font-semibold">No tracks match your filter</p>
              <p className="text-xs text-spotify-gray/60 mt-1">Try clearing your search term</p>
            </div>
          ) : (
            filteredTracks.map((track, idx) => {
              const isSelected = selectedIds.has(track.id);
              return (
                <div
                  key={track.id}
                  onClick={() => toggleSelect(track.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-spotify-green/10 border border-spotify-green/30'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(track.id);
                    }}
                    className="text-spotify-gray hover:text-white p-1"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-spotify-green" />
                    ) : (
                      <Square className="w-4 h-4 text-spotify-gray" />
                    )}
                  </button>

                  <span className="text-xs text-spotify-gray w-6 text-center font-mono">
                    {idx + 1}
                  </span>

                  <div className="w-9 h-9 rounded-lg bg-[#242424] overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {track.cover_url ? (
                      <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-4 h-4 text-white/30" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-xs font-bold text-white truncate">{track.title}</span>
                    <span className="text-[11px] text-spotify-gray truncate">{track.artist}</span>
                  </div>

                  {track.album && (
                    <span className="text-xs text-spotify-gray truncate hidden md:block max-w-[200px]">
                      {track.album}
                    </span>
                  )}

                  <span className="text-xs text-spotify-gray font-mono">
                    {formatDuration(track.duration_seconds || 0)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 bg-[#141414] flex items-center justify-between text-xs text-spotify-gray">
          <span>
            {filteredTracks.length} of {tracks.length} tracks displayed
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
