import { Check, FolderPlus, Loader2, Music, Plus, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Track } from '../types';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
}

interface PlaylistItem {
  id: string;
  name: string;
  cover_url?: string;
  track_count: number;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  track,
}) => {
  const { currentUser } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isOpen || !track) {
      setAddingId(null);
      setAddedId(null);
      setNewPlaylistName('');
      return;
    }

    setLoading(true);
    const headers: Record<string, string> = {};
    if (currentUser?.id) headers['X-User-Id'] = currentUser.id;

    fetch('/api/v1/playlists', { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPlaylists(data))
      .catch((err) => console.warn('Failed to fetch playlists', err))
      .finally(() => setLoading(false));
  }, [isOpen, track?.id, currentUser?.id]);

  const handleAddToPlaylist = async (playlist: PlaylistItem) => {
    if (!track) return;
    setAddingId(playlist.id);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentUser?.id) headers['X-User-Id'] = currentUser.id;

      // Ensure track exists on backend first
      await fetch('/api/v1/tracks/ensure', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album || '',
          duration_seconds: track.duration_seconds || 0,
          cover_url: track.cover_url || '',
          source_type: track.source_type || 'youtube',
          source_id: track.source_id || '',
        }),
      }).catch(() => {});

      const res = await fetch(`/api/v1/playlists/${playlist.id}/tracks/${track.id}`, {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        setAddedId(playlist.id);
        try {
          window.dispatchEvent(
            new CustomEvent('audiohub:toast', {
              detail: { message: `Added "${track.title}" to ${playlist.name}` },
            }),
          );
        } catch {}
        setTimeout(() => {
          onClose();
        }, 600);
      }
    } catch (e) {
      console.warn('Failed to add track to playlist', e);
    } finally {
      setAddingId(null);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || !track) return;
    setIsCreating(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentUser?.id) headers['X-User-Id'] = currentUser.id;

      const res = await fetch('/api/v1/playlists', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newPlaylistName.trim() }),
      });

      if (res.ok) {
        const created: PlaylistItem = await res.json();
        setNewPlaylistName('');
        await handleAddToPlaylist(created);
      }
    } catch (e) {
      console.warn('Failed to create playlist', e);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-sm p-5 sm:p-6 flex flex-col gap-4 shadow-2xl overflow-hidden relative max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-spotify-gray hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center flex-shrink-0">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div className="min-w-0 pr-6">
            <h3 className="text-white font-bold text-base leading-tight">Add to Playlist</h3>
            <p className="text-xs text-spotify-gray truncate">{track.title}</p>
          </div>
        </div>

        {/* Create New Playlist Form */}
        <form onSubmit={handleCreateAndAdd} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="New playlist name..."
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            className="flex-1 px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-spotify-gray focus:outline-none focus:border-spotify-green transition-colors"
          />
          <button
            type="submit"
            disabled={!newPlaylistName.trim() || isCreating}
            className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-spotify-green text-black font-bold text-xs hover:bg-[#1fdf64] transition-all disabled:opacity-40"
          >
            {isCreating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Create</span>
          </button>
        </form>

        {/* Playlists List */}
        <div className="flex flex-col gap-1.5 overflow-y-auto max-h-60 pr-1">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-spotify-gray">
              <Loader2 className="w-5 h-5 animate-spin text-spotify-green" />
              <span className="text-xs">Loading playlists...</span>
            </div>
          ) : playlists.length === 0 ? (
            <div className="py-6 text-center text-spotify-gray text-xs">
              No playlists found. Create one above!
            </div>
          ) : (
            playlists.map((pl) => {
              const isAdding = addingId === pl.id;
              const isAdded = addedId === pl.id;

              return (
                <div
                  key={pl.id}
                  onClick={() => !isAdding && !isAdded && handleAddToPlaylist(pl)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                    isAdded
                      ? 'bg-spotify-green/20 border border-spotify-green/40'
                      : 'hover:bg-white/10 bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-9 h-9 rounded-lg bg-[#282828] overflow-hidden flex-shrink-0 flex items-center justify-center shadow">
                      {pl.cover_url ? (
                        <img src={pl.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-4 h-4 text-white/40" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-white font-semibold text-xs truncate">{pl.name}</span>
                      <span className="text-spotify-gray text-[10px]">
                        {pl.track_count} {pl.track_count === 1 ? 'song' : 'songs'}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {isAdding ? (
                      <Loader2 className="w-4 h-4 animate-spin text-spotify-green" />
                    ) : isAdded ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-spotify-green">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </span>
                    ) : (
                      <Plus className="w-4 h-4 text-spotify-gray hover:text-white" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
