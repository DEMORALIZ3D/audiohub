import {
  Bookmark,
  Check,
  Clock,
  Disc,
  Disc3,
  LayoutGrid,
  Play,
  PlusCircle,
  Share2,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { CoverflowBrowser } from '../components/CoverflowBrowser';
import { AlbumViewSkeleton } from '../components/SkeletonLoaders';
import { TrackRow } from '../components/TrackRow';
import { usePlayer } from '../context/PlayerContext';
import { type AlbumDetail, type Playlist, Track } from '../types';
import { formatTime } from '../utils/formatters';
import { getAlbumShareData, shareContent } from '../utils/shareUtils';
import { useCrateViewPreference } from '../utils/vinylSettings';

interface AlbumViewProps {
  albumId: string;
  onSelectArtist: (artistId: string) => void;
}

export const AlbumView: React.FC<AlbumViewProps> = ({ albumId, onSelectArtist }) => {
  const { playTrack } = usePlayer();
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLibraryLoading, setSaveLibraryLoading] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [crateView, setCrateView] = useCrateViewPreference();

  const handleToggleSaveLibrary = async () => {
    if (!album || saveLibraryLoading) return;
    const nextSaved = !album.is_saved;
    setAlbum((prev) => (prev ? { ...prev, is_saved: nextSaved } : null));
    setSaveLibraryLoading(true);

    try {
      const res = await fetch(`/api/v1/albums/${album.id}/save`, {
        method: nextSaved ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: album.title,
          artist: album.artist,
          cover_url: album.cover_url,
          track_count: album.tracks?.length || 0,
        }),
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('library_changed'));
      } else {
        setAlbum((prev) => (prev ? { ...prev, is_saved: !nextSaved } : null));
      }
    } catch (e) {
      console.error('Failed to toggle save album to library', e);
      setAlbum((prev) => (prev ? { ...prev, is_saved: !nextSaved } : null));
    } finally {
      setSaveLibraryLoading(false);
    }
  };

  const handleShare = async () => {
    if (!album) return;
    const res = await shareContent(
      getAlbumShareData(album.id, album.title, album.artist, album.cover_url),
    );
    if (res === 'copied' || res === 'shared') {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/albums/${albumId}`)
      .then((res) => res.json())
      .then((data) => setAlbum(data))
      .catch((e) => console.error('Failed to load album', e))
      .finally(() => setLoading(false));

    // Fetch user playlists for the save modal
    fetch('/api/v1/playlists')
      .then((res) => res.json())
      .then((data) => setPlaylists(data))
      .catch(console.error);
  }, [albumId]);

  const handleSaveToPlaylist = async (playlistId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/albums/${albumId}/save-to-playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlistId }),
      });
      if (res.ok) {
        setSavedSuccess('Album saved to playlist!');
        setTimeout(() => {
          setShowPlaylistModal(false);
          setSavedSuccess('');
        }, 1500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndSave = async () => {
    if (!album) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: album.title, description: `Album by ${album.artist}` }),
      });
      if (res.ok) {
        const created = await res.json();
        await handleSaveToPlaylist(created.id);
      }
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  if (loading) {
    return <AlbumViewSkeleton />;
  }

  if (!album) {
    return <div className="flex-1 bg-[#121212] p-8 text-spotify-gray">Album not found</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#3a2f2f] via-[#121212] to-[#121212] text-white flex flex-col pb-44">
      {/* Navigation Breadcrumbs */}
      <div className="pt-2 px-1">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', tab: 'home' },
            { label: 'Your Library', tab: 'library' },
            ...(album.artist
              ? [{ label: album.artist, tab: 'artist' as const, id: album.artist_id }]
              : []),
            { label: album.title },
          ]}
          backLabel={album.artist || 'Library'}
          onBack={() => {
            if (album.artist_id) {
              onSelectArtist(album.artist_id);
            } else {
              window.dispatchEvent(
                new CustomEvent('audiohub:navigate', { detail: { tab: 'library', id: null } }),
              );
            }
          }}
        />
      </div>

      {/* Header */}
      <div
        className={`p-4 md:p-8 pt-2 md:pt-4 flex flex-col sm:flex-row items-center sm:items-end gap-4 md:gap-6 text-center sm:text-left transition-all duration-300 ${
          crateView === 'coverflow'
            ? 'py-2 md:py-3 pb-1 md:pb-2 border-b border-white/5'
            : 'pb-4 md:pb-6'
        }`}
      >
        <div
          className={`rounded-xl bg-[#282828] shadow-2xl overflow-hidden flex-shrink-0 border border-white/5 transition-all duration-300 ${
            crateView === 'coverflow' ? 'w-14 h-14 sm:w-16 sm:h-16' : 'w-40 h-40 sm:w-52 sm:h-52'
          }`}
        >
          {album.cover_url ? (
            <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">💿</div>
          )}
        </div>

        <div className="flex flex-col gap-1 md:gap-1.5 min-w-0 flex-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-spotify-gray">
            Album
          </span>
          <h1
            className={`font-extrabold tracking-tight truncate ${
              crateView === 'coverflow'
                ? 'text-xl sm:text-2xl md:text-3xl'
                : 'text-3xl sm:text-5xl md:text-6xl'
            }`}
          >
            {album.title}
          </h1>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs md:text-sm text-white/90 mt-1 font-medium">
            <span
              onClick={() => album.artist_id && onSelectArtist(album.artist_id)}
              className="hover:underline cursor-pointer font-bold text-white"
            >
              {album.artist}
            </span>
            <span>•</span>
            <span>{album.release_date?.substring(0, 4) || 'Album'}</span>
            <span>•</span>
            <span className="text-spotify-gray">{album.tracks.length} songs</span>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="px-4 md:px-8 py-3 md:py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (album.tracks.length > 0) {
                playTrack(album.tracks[0], album.tracks, {
                  type: 'album',
                  id: album.id,
                  name: album.title,
                  cover_url: album.cover_url,
                });
              }
            }}
            disabled={album.tracks.length === 0}
            className="w-14 h-14 rounded-full bg-spotify-green text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl disabled:opacity-50"
            title="Play Album"
          >
            <Play className="w-7 h-7 fill-current ml-1" />
          </button>

          <button
            onClick={handleToggleSaveLibrary}
            disabled={saveLibraryLoading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all border shadow-md ${
              album.is_saved
                ? 'bg-spotify-green text-black border-spotify-green hover:bg-spotify-green/90'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
            }`}
            title={album.is_saved ? 'Saved to Your Library' : 'Save Album to Your Library'}
          >
            <Bookmark
              className={`w-4 h-4 ${album.is_saved ? 'fill-current text-black' : 'text-spotify-green'}`}
            />
            <span>{album.is_saved ? 'In Library' : 'Save to Library'}</span>
          </button>

          <button
            onClick={() => setShowPlaylistModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors border border-white/10"
          >
            <PlusCircle className="w-4 h-4 text-spotify-green" />
            <span>Save to Playlist</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors border border-white/10 shadow-md"
            title={shareCopied ? 'Link Copied!' : 'Share Album (WhatsApp, Messenger, Copy Link)'}
          >
            {shareCopied ? (
              <Check className="w-4 h-4 text-spotify-green animate-pulse" />
            ) : (
              <Share2 className="w-4 h-4 text-spotify-green" />
            )}
            <span>{shareCopied ? 'Link Copied!' : 'Share Album'}</span>
          </button>
        </div>

        {/* Crate Digging View Toggle: [ Grid ] [ Cover Flow ] */}
        <div className="flex items-center bg-black/50 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-lg text-xs">
          <button
            onClick={() => setCrateView('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
              crateView === 'grid'
                ? 'bg-white text-black shadow'
                : 'text-spotify-gray hover:text-white'
            }`}
            title="Standard Tracklist View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid / List</span>
          </button>
          <button
            onClick={() => setCrateView('coverflow')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
              crateView === 'coverflow'
                ? 'bg-spotify-green text-black shadow'
                : 'text-spotify-gray hover:text-white'
            }`}
            title="3D Cover Flow Crate Digging View"
          >
            <Disc3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cover Flow</span>
          </button>
        </div>
      </div>

      {/* Track View: Either 3D Cover Flow or Classic Tracklist */}
      {crateView === 'coverflow' ? (
        <div className="px-2 md:px-8 flex-1 pb-12 animate-fadeIn">
          <CoverflowBrowser
            items={album.tracks.map((track, idx) => ({
              id: track.id,
              title: track.title,
              subtitle: track.artist || album.artist,
              coverUrl: album.cover_url,
              badge: `#${idx + 1}`,
              meta: `Track ${idx + 1} of ${album.tracks.length} • ${formatTime(track.duration_seconds)}`,
              raw: track,
            }))}
            onItemPlay={(item) => {
              if (item.raw) {
                playTrack(item.raw, album.tracks, {
                  type: 'album',
                  id: album.id,
                  name: album.title,
                  cover_url: album.cover_url,
                });
              }
            }}
          />
        </div>
      ) : (
        /* Tracklist Table */
        <div className="px-2 md:px-8 flex-1 pb-12 animate-fadeIn">
          <div className="grid grid-cols-[24px_1fr_1fr_48px] md:grid-cols-[24px_1fr_1fr_1fr_48px] px-4 py-2 border-b border-white/10 text-xs text-spotify-gray font-semibold uppercase tracking-wider mb-2">
            <span>#</span>
            <span>Title</span>
            <span className="hidden md:block">Album</span>
            <span></span>
            <span className="text-right flex justify-end">
              <Clock className="w-4 h-4" />
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {album.tracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                playlistContext={album.tracks}
                playbackContext={{
                  type: 'album',
                  id: album.id,
                  name: album.title,
                  cover_url: album.cover_url,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Save to Playlist Modal */}
      {showPlaylistModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#242424] p-6 rounded-xl max-w-sm w-full flex flex-col gap-4 shadow-2xl border border-white/10">
            <h3 className="text-white text-lg font-bold">Add Album to Playlist</h3>

            {savedSuccess ? (
              <div className="text-center py-6 text-spotify-green font-bold flex items-center justify-center gap-2">
                <Check className="w-6 h-6" />
                <span>{savedSuccess}</span>
              </div>
            ) : (
              <>
                <button
                  onClick={handleCreateAndSave}
                  disabled={saving}
                  className="w-full py-2.5 px-4 rounded-lg bg-spotify-green text-black font-bold text-sm hover:scale-[1.02] transition-transform text-center"
                >
                  + Create New Playlist "{album.title}"
                </button>

                <div className="border-t border-white/10 pt-3">
                  <span className="text-xs font-semibold text-spotify-gray uppercase tracking-wider block mb-2">
                    Or select existing:
                  </span>
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => handleSaveToPlaylist(pl.id)}
                        disabled={saving}
                        className="text-left px-3 py-2 rounded-md hover:bg-white/10 text-sm font-medium text-white truncate"
                      >
                        {pl.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowPlaylistModal(false)}
                    className="px-4 py-1.5 text-xs text-spotify-gray hover:text-white font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
