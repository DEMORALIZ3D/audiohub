import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Check,
  CheckSquare,
  ExternalLink,
  FileText,
  FolderPlus,
  Heart,
  Info,
  Link2,
  Loader2,
  Music,
  PlusCircle,
  Search,
  Sparkles,
  Square,
  Upload,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Playlist } from '../types';

interface ImportedTrackItem {
  title: string;
  artist: string;
  album?: string;
  duration_seconds?: number;
}

interface MusicImporterProps {
  isModal?: boolean;
  onClose?: () => void;
  onSuccess?: (result: { target: string; id?: string; count?: number; name?: string }) => void;
  defaultTarget?: 'liked_songs' | 'new_playlist' | 'existing_playlist';
}

export const MusicImporter: React.FC<MusicImporterProps> = ({
  isModal = false,
  onClose,
  onSuccess,
  defaultTarget = 'liked_songs',
}) => {
  // Step 1: 'source' | Step 2: 'review' | Step 3: 'success'
  const [currentStep, setCurrentStep] = useState<'source' | 'review' | 'success'>('source');

  const [sourceTab, setSourceTab] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [textData, setTextData] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [reverseOrder, setReverseOrder] = useState(false);

  // Parsed tracks for Step 2
  const [parsedTracks, setParsedTracks] = useState<ImportedTrackItem[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [filterQuery, setFilterQuery] = useState('');

  // Destination state
  const [target, setTarget] = useState<'liked_songs' | 'new_playlist' | 'existing_playlist'>(
    defaultTarget,
  );
  const [playlistName, setPlaylistName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [existingPlaylists, setExistingPlaylists] = useState<Playlist[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    target: string;
    id?: string;
    count: number;
    name: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user playlists for the "existing_playlist" dropdown
  useEffect(() => {
    fetch('/api/v1/playlists')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setExistingPlaylists(data);
          if (data.length > 0 && !selectedPlaylistId) {
            setSelectedPlaylistId(data[0].id);
          }
        }
      })
      .catch((err) => console.error('Failed to load playlists for importer', err));
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const cleanName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[_.-]+/g, ' ')
      .trim();
    if (!playlistName) {
      setPlaylistName(cleanName);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setTextData(content);
      setError(null);
    };
    reader.onerror = () => {
      setError('Could not read the selected file. Please try pasting the text directly instead.');
    };
    reader.readAsText(file);
  };

  // Step 1 -> Step 2: Fetch Preview
  const handleProceedToReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceTab === 'url' && !url.trim()) {
      setError('Please enter a public Spotify or Apple Music playlist link.');
      return;
    }
    if (sourceTab === 'file' && !textData.trim()) {
      setError('Please select a CSV file or paste your tracklist text.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/playlists/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceTab === 'url' ? url.trim() : undefined,
          text_data: sourceTab === 'file' ? textData.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.detail || 'Could not parse playlist. Please verify the URL or CSV format.',
        );
      }

      const previewData = await res.json();
      const tracks: ImportedTrackItem[] = previewData.tracks || [];

      if (tracks.length === 0) {
        throw new Error('No songs could be found in the file or URL provided.');
      }

      setParsedTracks(tracks);
      // Select all by default
      setSelectedIndices(new Set(tracks.map((_, i) => i)));

      if (!playlistName && previewData.playlist_name) {
        setPlaylistName(previewData.playlist_name);
      }

      setCurrentStep('review');
    } catch (err: any) {
      setError(err.message || 'Failed to inspect playlist');
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection
  const toggleSelectTrack = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  };

  const toggleSelectAll = () => {
    if (
      selectedIndices.size === filteredTracksWithOriginalIndex.length &&
      filteredTracksWithOriginalIndex.length > 0
    ) {
      // Unselect filtered
      const next = new Set(selectedIndices);
      filteredTracksWithOriginalIndex.forEach(({ origIndex }) => {
        next.delete(origIndex);
      });
      setSelectedIndices(next);
    } else {
      // Select all filtered
      const next = new Set(selectedIndices);
      filteredTracksWithOriginalIndex.forEach(({ origIndex }) => {
        next.add(origIndex);
      });
      setSelectedIndices(next);
    }
  };

  // Filtered tracks with their original indices
  const filteredTracksWithOriginalIndex = useMemo(() => {
    return parsedTracks
      .map((t, origIndex) => ({ track: t, origIndex }))
      .filter(({ track }) => {
        if (!filterQuery.trim()) return true;
        const q = filterQuery.toLowerCase();
        return (
          track.title.toLowerCase().includes(q) ||
          track.artist.toLowerCase().includes(q) ||
          (track.album && track.album.toLowerCase().includes(q))
        );
      });
  }, [parsedTracks, filterQuery]);

  // Step 2 -> Step 3: Commit Import
  const handleCommitImport = async () => {
    const selectedTracks = parsedTracks.filter((_, idx) => selectedIndices.has(idx));
    if (selectedTracks.length === 0) {
      setError('Please select at least one song to import.');
      return;
    }
    if (target === 'existing_playlist' && !selectedPlaylistId) {
      setError('Please select an existing playlist to add the songs to.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      target,
      tracks: selectedTracks,
      playlist_name:
        target === 'new_playlist' && playlistName.trim() ? playlistName.trim() : undefined,
      playlist_id: target === 'existing_playlist' ? selectedPlaylistId : undefined,
      reverse_order: reverseOrder,
    };

    try {
      const res = await fetch('/api/v1/playlists/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to import tracks');
      }

      const resData = await res.json();
      const count = resData.imported_count || selectedTracks.length;
      const finalName =
        resData.name ||
        (target === 'liked_songs' ? 'Liked Songs' : playlistName.trim() || 'New Playlist');

      const result = {
        target: resData.target,
        id: resData.id,
        count,
        name: finalName,
      };

      setSuccessResult(result);
      setCurrentStep('success');
      window.dispatchEvent(new CustomEvent('playlists_changed'));
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreatedPlaylist = () => {
    if (onSuccess && successResult) {
      onSuccess(successResult);
    }
    if (onClose) {
      onClose();
    }
  };

  const handleResetForAnother = () => {
    setUrl('');
    setTextData('');
    setFileName(null);
    setPlaylistName('');
    setParsedTracks([]);
    setSelectedIndices(new Set());
    setError(null);
    setSuccessResult(null);
    setCurrentStep('source');
  };

  return (
    <div
      className={`flex flex-col ${isModal ? 'p-6' : 'bg-[#181818] rounded-2xl p-6 border border-white/5 shadow-2xl'}`}
    >
      {!isModal && (
        <div className="mb-6 pb-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-spotify-green" />
              <span>Music & Playlist Importer</span>
            </h2>
            <p className="text-xs text-spotify-gray mt-1">
              Import Spotify, Apple Music, Exportify CSV, or text tracklists into Liked Songs or
              Playlists.
            </p>
          </div>
        </div>
      )}

      {/* Progress Header / Step Indicator */}
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
              currentStep === 'source'
                ? 'bg-spotify-green text-black font-bold'
                : 'bg-white/10 text-white'
            }`}
          >
            1
          </span>
          <span className={currentStep === 'source' ? 'text-white' : 'text-spotify-gray'}>
            Source
          </span>
          <span className="text-white/20">/</span>

          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
              currentStep === 'review'
                ? 'bg-spotify-green text-black font-bold'
                : 'bg-white/10 text-white'
            }`}
          >
            2
          </span>
          <span className={currentStep === 'review' ? 'text-white' : 'text-spotify-gray'}>
            Review Tracks
          </span>
          <span className="text-white/20">/</span>

          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
              currentStep === 'success'
                ? 'bg-spotify-green text-black font-bold'
                : 'bg-white/10 text-white'
            }`}
          >
            3
          </span>
          <span className={currentStep === 'success' ? 'text-white' : 'text-spotify-gray'}>
            Done
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STAGE 1: SOURCE SELECTION
         ───────────────────────────────────────────────────────────── */}
      {currentStep === 'source' && (
        <form onSubmit={handleProceedToReview} className="space-y-5">
          <div>
            <label className="text-xs font-bold text-white uppercase tracking-wider block mb-2">
              Select Import Source
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                type="button"
                onClick={() => setSourceTab('url')}
                className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                  sourceTab === 'url'
                    ? 'bg-spotify-green/10 border-spotify-green text-white'
                    : 'bg-[#242424] border-white/5 text-spotify-gray hover:text-white'
                }`}
              >
                <Link2 className="w-4 h-4 text-spotify-green" />
                <span>Spotify / Apple / YouTube URL</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceTab('file')}
                className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                  sourceTab === 'file'
                    ? 'bg-spotify-green/10 border-spotify-green text-white'
                    : 'bg-[#242424] border-white/5 text-spotify-gray hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4 text-spotify-green" />
                <span>CSV / Exportify File / Text</span>
              </button>
            </div>

            {sourceTab === 'url' ? (
              <div className="space-y-3">
                <input
                  type="url"
                  placeholder="https://open.spotify.com/playlist/... or youtube.com/playlist?list=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-[#242424] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-spotify-green"
                />

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-[11px] text-blue-200/90 leading-relaxed flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Supported URL formats:</span>
                    <p className="mt-0.5 text-white/80">
                      Paste public playlist links from <b>Spotify</b>, <b>Apple Music</b>, or{' '}
                      <b>YouTube Playlists</b> (e.g. <code>youtube.com/playlist?list=...</code>).
                      All tracks will be previewed on the next step!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv,text/plain,application/csv,text/comma-separated-values,application/vnd.ms-excel,.txt,*/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/10 hover:border-spotify-green/50 rounded-xl p-5 text-center cursor-pointer transition-colors bg-[#242424]/40 hover:bg-[#242424]"
                >
                  <Upload className="w-6 h-6 text-spotify-green mx-auto mb-2" />
                  <p className="text-xs font-semibold text-white">
                    {fileName
                      ? `Selected: ${fileName}`
                      : 'Tap to select Liked_Songs.csv or tracklist .txt file'}
                  </p>
                  <p className="text-[10px] text-spotify-gray mt-1">
                    Supports exportify.net Spotify exports or standard Artist - Title CSV/text
                  </p>
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder="Or paste tracklist directly (e.g. Artist - Song Title, or Exportify CSV data)..."
                    value={textData}
                    onChange={(e) => setTextData(e.target.value)}
                    className="w-full bg-[#242424] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-spotify-green resize-none font-mono"
                  />
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-[11px] text-emerald-200/90 leading-relaxed flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">
                      How to export from Spotify using Exportify:
                    </span>
                    <ol className="list-decimal ml-4 mt-1 space-y-0.5 text-white/80">
                      <li>
                        Go to <b>exportify.net</b> and log in with Spotify.
                      </li>
                      <li>
                        Find your playlist or <b>Liked Songs</b> in the list and click <b>Export</b>
                        .
                      </li>
                      <li>Drop the downloaded CSV file here to preview and import every track!</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (sourceTab === 'url' ? !url.trim() : !textData.trim())}
            className="w-full py-3.5 rounded-xl bg-spotify-green hover:bg-[#1ed760] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 shadow-xl"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Inspecting Tracks...</span>
              </>
            ) : (
              <>
                <span>Preview & Review Songs</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STAGE 2: INTERACTIVE REVIEW & SELECTION
         ───────────────────────────────────────────────────────────── */}
      {currentStep === 'review' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Top Bar: Back & Summary */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <button
              onClick={() => setCurrentStep('source')}
              className="flex items-center gap-1.5 text-xs text-spotify-gray hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change Source</span>
            </button>
            <span className="text-xs font-bold text-white">Found {parsedTracks.length} tracks</span>
          </div>

          {/* Destination & Playlist Name Configuration */}
          <div className="bg-[#202020] border border-white/5 rounded-xl p-3.5 space-y-3">
            <label className="text-[11px] font-bold text-white uppercase tracking-wider block">
              Destination Library
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTarget('new_playlist')}
                className={`p-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  target === 'new_playlist'
                    ? 'bg-spotify-green/10 border-spotify-green text-white'
                    : 'bg-[#181818] border-white/5 text-spotify-gray hover:text-white'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 text-spotify-green" />
                <span>New Playlist</span>
              </button>

              <button
                type="button"
                onClick={() => setTarget('liked_songs')}
                className={`p-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  target === 'liked_songs'
                    ? 'bg-spotify-green/10 border-spotify-green text-white'
                    : 'bg-[#181818] border-white/5 text-spotify-gray hover:text-white'
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-spotify-green" />
                <span>Liked Songs</span>
              </button>

              <button
                type="button"
                onClick={() => setTarget('existing_playlist')}
                className={`p-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  target === 'existing_playlist'
                    ? 'bg-spotify-green/10 border-spotify-green text-white'
                    : 'bg-[#181818] border-white/5 text-spotify-gray hover:text-white'
                }`}
              >
                <FolderPlus className="w-3.5 h-3.5 text-spotify-green" />
                <span>Existing</span>
              </button>
            </div>

            {target === 'new_playlist' && (
              <div>
                <label className="block text-[10px] uppercase font-bold text-spotify-gray mb-1">
                  Playlist Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Imported Playlist"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="w-full bg-[#181818] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-spotify-green"
                />
              </div>
            )}

            {target === 'existing_playlist' && (
              <div>
                <label className="block text-[10px] uppercase font-bold text-spotify-gray mb-1">
                  Select Existing Playlist
                </label>
                <select
                  value={selectedPlaylistId}
                  onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  className="w-full bg-[#181818] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-spotify-green"
                >
                  {existingPlaylists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} ({pl.track_count || 0} songs)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Informational Note about Niche Artists & Streaming */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-[11px] text-blue-200/90 leading-relaxed flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Streaming & Cover Artwork:</span>
              <p className="mt-0.5 text-white/80">
                All imported tracks stream high-fidelity audio dynamically from YouTube. If an indie
                or niche artist lacks instant cover art, it will display a placeholder note until
                the track is played.
              </p>
            </div>
          </div>

          {/* Filter Bar & Selection Counter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors border border-white/5"
              >
                {selectedIndices.size === filteredTracksWithOriginalIndex.length &&
                filteredTracksWithOriginalIndex.length > 0 ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-spotify-green" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-spotify-gray" />
                    <span>Select All</span>
                  </>
                )}
              </button>

              <span className="text-xs text-spotify-gray font-medium">
                <span className="text-spotify-green font-bold">{selectedIndices.size}</span> of{' '}
                {parsedTracks.length} selected
              </span>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-spotify-gray absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search tracks or artists..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full bg-[#242424] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-spotify-green"
              />
            </div>
          </div>

          {/* Scrollable Review Track Table */}
          <div className="border border-white/10 rounded-xl overflow-hidden bg-[#181818] max-h-64 overflow-y-auto divide-y divide-white/5">
            {filteredTracksWithOriginalIndex.map(({ track, origIndex }) => {
              const isChecked = selectedIndices.has(origIndex);
              return (
                <div
                  key={origIndex}
                  onClick={() => toggleSelectTrack(origIndex)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer text-xs transition-colors select-none ${
                    isChecked
                      ? 'bg-white/[0.03] hover:bg-white/[0.06]'
                      : 'opacity-40 hover:opacity-70 bg-black/20'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSelectTrack(origIndex)}
                    className="w-4 h-4 rounded text-spotify-green focus:ring-0 accent-[#1db954] cursor-pointer"
                  />
                  <div className="w-5 text-center text-spotify-gray font-mono text-[10px]">
                    {origIndex + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-semibold truncate ${isChecked ? 'text-white' : 'text-white/60'}`}
                    >
                      {track.title}
                    </p>
                    <p className="text-[11px] text-spotify-gray truncate">
                      {track.artist} {track.album ? `• ${track.album}` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-spotify-gray border border-white/5 flex-shrink-0">
                    Streamable
                  </span>
                </div>
              );
            })}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep('source')}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-spotify-gray hover:text-white hover:bg-white/5 transition-colors"
            >
              Back
            </button>

            <button
              type="button"
              onClick={handleCommitImport}
              disabled={loading || selectedIndices.size === 0}
              className="flex-1 py-3 rounded-xl bg-spotify-green hover:bg-[#1ed760] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 shadow-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing {selectedIndices.size} Songs...</span>
                </>
              ) : (
                <>
                  <span>Import {selectedIndices.size} Selected Songs</span>
                  <Check className="w-4 h-4 stroke-[3]" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STAGE 3: SUCCESS & NAVIGATION
         ───────────────────────────────────────────────────────────── */}
      {currentStep === 'success' && successResult && (
        <div className="py-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center mx-auto shadow-2xl">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>

          <div>
            <h3 className="text-xl font-black text-white">Import Complete!</h3>
            <p className="text-xs text-spotify-gray mt-1.5 max-w-sm mx-auto leading-relaxed">
              Successfully imported{' '}
              <span className="text-spotify-green font-bold">{successResult.count} songs</span> into{' '}
              <span className="text-white font-semibold">"{successResult.name}"</span>.
            </p>
          </div>

          <div className="bg-[#242424] border border-white/5 rounded-xl p-3.5 max-w-sm mx-auto text-left text-[11px] text-spotify-gray space-y-1">
            <div className="flex items-center justify-between text-white font-semibold">
              <span>Destination:</span>
              <span className="text-spotify-green uppercase tracking-wider text-[10px]">
                {successResult.target.replace('_', ' ')}
              </span>
            </div>
            <p className="text-white/70">
              Tracks are ready in your library and will stream on-demand immediately.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-sm mx-auto">
            <button
              onClick={handleOpenCreatedPlaylist}
              className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-spotify-green hover:bg-[#1ed760] text-black font-bold text-xs uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-xl flex items-center justify-center gap-1.5"
            >
              <Music className="w-4 h-4" />
              <span>Open Playlist</span>
            </button>

            <button
              onClick={handleResetForAnother}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors"
            >
              Import Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
