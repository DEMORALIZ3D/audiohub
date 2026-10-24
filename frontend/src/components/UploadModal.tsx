import { Check, Globe, Loader2, Lock, Music, Search, Sparkles, UploadCloud, X } from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import type { Track } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (track: Track) => void;
}

interface MetadataMatch {
  title: string;
  artist: string;
  album: string;
  duration_seconds: number;
  cover_url: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const [inspecting, setInspecting] = useState(false);
  const [searchingMatches, setSearchingMatches] = useState(false);
  const [matches, setMatches] = useState<MetadataMatch[]>([]);
  const [showMatchPicker, setShowMatchPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setSelectedFile(null);
    setTitle('');
    setArtist('');
    setAlbum('');
    setCoverUrl('');
    setIsPrivate(false);
    setMatches([]);
    setShowMatchPicker(false);
    setError(null);
    setSaving(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setError(null);
    setInspecting(true);

    // Auto-inspect tags on backend
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/v1/uploads/inspect', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setTitle(data.title || file.name.replace(/\.[^/.]+$/, ''));
        setArtist(data.artist || 'AI / Unknown Artist');
        setAlbum(data.album || 'Uploads');
        if (data.cover_url) {
          setCoverUrl(data.cover_url);
        }
      } else {
        // Fallback to filename
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
        setArtist('AI / Unknown Artist');
        setAlbum('Uploads');
      }
    } catch (e: any) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
      setArtist('AI / Unknown Artist');
      setAlbum('Uploads');
    } finally {
      setInspecting(false);
    }
  };

  const handleSearchMatches = async () => {
    const q = `${title} ${artist}`.trim();
    if (!q) return;

    setSearchingMatches(true);
    setShowMatchPicker(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/uploads/match-metadata?query=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: MetadataMatch[] = await res.json();
        setMatches(data);
      } else {
        setMatches([]);
      }
    } catch (e) {
      setMatches([]);
    } finally {
      setSearchingMatches(false);
    }
  };

  const applyMatch = (match: MetadataMatch) => {
    setTitle(match.title);
    setArtist(match.artist);
    setAlbum(match.album);
    if (match.cover_url) {
      setCoverUrl(match.cover_url);
    }
    setShowMatchPicker(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select an audio file to upload.');
      return;
    }
    if (!title.trim() || !artist.trim()) {
      setError('Title and Artist are required.');
      return;
    }

    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title.trim());
    formData.append('artist', artist.trim());
    formData.append('album', album.trim() || 'Uploads');
    formData.append('cover_url', coverUrl.trim());
    formData.append('is_private', isPrivate ? 'true' : 'false');

    try {
      const res = await fetch('/api/v1/uploads/save', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Upload failed');
      }

      const savedTrack: Track = await res.json();
      if (onSuccess) onSuccess(savedTrack);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save upload');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Upload Music</h2>
              <p className="text-xs text-spotify-gray">
                Upload AI tracks, remixes, or personal audio files
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-spotify-gray hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          {/* File Picker / Dropzone */}
          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-white/15 hover:border-spotify-green/60 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.flac,.ogg,audio/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                }}
              />
              <div className="w-12 h-12 rounded-full bg-[#242424] group-hover:bg-spotify-green/20 text-spotify-gray group-hover:text-spotify-green flex items-center justify-center transition-colors">
                <Music className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">Click or drag & drop audio track</p>
                <p className="text-xs text-spotify-gray mt-1">MP3, WAV, M4A, FLAC, OGG supported</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 bg-[#222] rounded-xl border border-white/10">
              <div className="flex items-center gap-3 truncate">
                <div className="w-10 h-10 rounded-lg bg-spotify-green/20 text-spotify-green flex items-center justify-center flex-shrink-0">
                  <Music className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <p className="text-sm font-semibold text-white truncate">{selectedFile.name}</p>
                  <p className="text-xs text-spotify-gray">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB{' '}
                    {inspecting && '• Inspecting tags...'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-xs text-spotify-gray hover:text-white px-2.5 py-1 rounded bg-[#333] hover:bg-[#444] transition-colors"
              >
                Change
              </button>
            </div>
          )}

          {selectedFile && (
            <>
              {/* Auto-Match Metadata Action */}
              <div className="flex items-center justify-between bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-white">
                    Looking for matching catalog tags?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSearchMatches}
                  disabled={searchingMatches}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow"
                >
                  {searchingMatches ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>Auto-Match</span>
                </button>
              </div>

              {/* Match Picker list */}
              {showMatchPicker && matches.length > 0 && (
                <div className="bg-[#121212] border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-spotify-gray font-semibold px-1">
                    <span>Found Matches (Select to apply)</span>
                    <button
                      type="button"
                      onClick={() => setShowMatchPicker(false)}
                      className="text-white hover:underline text-[11px]"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {matches.map((m, idx) => (
                      <div
                        key={idx}
                        onClick={() => applyMatch(m)}
                        className="flex items-center gap-3 p-2 rounded-lg bg-[#1f1f1f] hover:bg-[#2a2a2a] cursor-pointer transition-colors border border-white/5"
                      >
                        {m.cover_url ? (
                          <img
                            src={m.cover_url}
                            alt=""
                            className="w-9 h-9 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded bg-[#333] flex items-center justify-center flex-shrink-0 text-white/50">
                            <Music className="w-4 h-4" />
                          </div>
                        )}
                        <div className="flex-1 truncate">
                          <p className="text-xs font-bold text-white truncate">{m.title}</p>
                          <p className="text-[11px] text-spotify-gray truncate">
                            {m.artist} • {m.album}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="px-2.5 py-1 bg-spotify-green/20 text-spotify-green hover:bg-spotify-green hover:text-black rounded text-[11px] font-bold transition-colors"
                        >
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-spotify-gray block mb-1.5">
                    Track Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Cyberpunk Horizon"
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-spotify-green"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-spotify-gray block mb-1.5">
                    Artist *
                  </label>
                  <input
                    type="text"
                    required
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="e.g. AI Generator / Creator"
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-spotify-green"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-spotify-gray block mb-1.5">
                    Album (Optional)
                  </label>
                  <input
                    type="text"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    placeholder="e.g. Suno Vol. 1"
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-spotify-green"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-spotify-gray block mb-1.5">
                    Cover Art Image URL
                  </label>
                  <input
                    type="url"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-spotify-green"
                  />
                </div>
              </div>

              {/* Privacy Setting Card */}
              <div>
                <label className="text-xs font-semibold text-spotify-gray block mb-2">
                  Visibility & Privacy
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setIsPrivate(false)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      !isPrivate
                        ? 'border-spotify-green bg-spotify-green/10'
                        : 'border-white/10 bg-[#222] hover:bg-[#282828]'
                    }`}
                  >
                    <div
                      className={`mt-0.5 ${!isPrivate ? 'text-spotify-green' : 'text-spotify-gray'}`}
                    >
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        Family Shared
                        {!isPrivate && <Check className="w-3.5 h-3.5 text-spotify-green" />}
                      </p>
                      <p className="text-[11px] text-spotify-gray mt-0.5 leading-snug">
                        Discoverable by all accounts and playable in family playlists.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setIsPrivate(true)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isPrivate
                        ? 'border-spotify-green bg-spotify-green/10'
                        : 'border-white/10 bg-[#222] hover:bg-[#282828]'
                    }`}
                  >
                    <div
                      className={`mt-0.5 ${isPrivate ? 'text-spotify-green' : 'text-spotify-gray'}`}
                    >
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        Private (Just Me)
                        {isPrivate && <Check className="w-3.5 h-3.5 text-spotify-green" />}
                      </p>
                      <p className="text-[11px] text-spotify-gray mt-0.5 leading-snug">
                        Only you can search, view, or stream this audio track.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-spotify-gray hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || saving}
              className="px-6 py-2.5 bg-spotify-green text-black font-bold rounded-full text-xs hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving & Uploading...</span>
                </>
              ) : (
                <span>Save to Library</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
