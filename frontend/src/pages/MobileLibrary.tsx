import {
  ArrowDownCircle,
  ArrowDownToLine,
  Bookmark,
  Disc3,
  Heart,
  LayoutGrid,
  Library,
  Mic2,
  Music,
  PlusCircle,
  Sparkles,
  UploadCloud,
  User,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { CoverflowBrowser, type CoverflowItem } from '../components/CoverflowBrowser';
import { ImportPlaylistModal } from '../components/ImportPlaylistModal';
import { PlaylistItemSkeleton } from '../components/SkeletonLoaders';
import { UploadModal } from '../components/UploadModal';
import type { UserProfile } from '../context/AuthContext';
import type { FollowedArtist, Playlist, SavedAlbum } from '../types';
import { useCrateViewPreference } from '../utils/vinylSettings';

interface MobileLibraryProps {
  onSelectLiked: () => void;
  onSelectUploads: () => void;
  onSelectDownloaded: () => void;
  onSelectPlaylist: (id: string) => void;
  onSelectAlbum?: (id: string) => void;
  onSelectArtist?: (id: string) => void;
  onOpenSettings: () => void;
}

export const MobileLibrary: React.FC<MobileLibraryProps> = ({
  onSelectLiked,
  onSelectUploads,
  onSelectDownloaded,
  onSelectPlaylist,
  onSelectAlbum,
  onSelectArtist,
  onOpenSettings,
}) => {
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'playlists' | 'artists' | 'albums'>(
    'all',
  );
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [savedAlbums, setSavedAlbums] = useState<SavedAlbum[]>([]);
  const [followedArtists, setFollowedArtists] = useState<FollowedArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [crateView, setCrateView] = useCrateViewPreference();

  const fetchLibrary = () => {
    Promise.all([
      fetch('/api/v1/playlists').then((res) => (res.ok ? res.json() : [])),
      fetch('/api/v1/albums/library/saved').then((res) => (res.ok ? res.json() : [])),
      fetch('/api/v1/artists/library/followed').then((res) => (res.ok ? res.json() : [])),
      fetch('/api/v1/auth/me').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([plData, albData, artData, profileData]) => {
        setPlaylists(plData);
        setSavedAlbums(albData);
        setFollowedArtists(artData);
        setUserProfile(profileData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLibrary();

    const handleLibraryChanged = () => fetchLibrary();
    window.addEventListener('playlists_changed', handleLibraryChanged);
    window.addEventListener('library_changed', handleLibraryChanged);
    return () => {
      window.removeEventListener('playlists_changed', handleLibraryChanged);
      window.removeEventListener('library_changed', handleLibraryChanged);
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;
    setNewPlaylistName('');
    setShowCreateModal(false);

    try {
      const res = await fetch('/api/v1/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const created = await res.json();
        setPlaylists((prev) => [created, ...prev]);
        window.dispatchEvent(new CustomEvent('playlists_changed'));
        onSelectPlaylist(created.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Build Cover Flow Crate Items based on active library filter
  const allCrateItems: CoverflowItem[] = [];

  if (libraryFilter === 'all' || libraryFilter === 'playlists') {
    allCrateItems.push(
      {
        id: 'liked',
        title: 'Liked Songs',
        subtitle: 'Auto Master Playlist',
        badge: 'Favorites',
        meta: 'Master Liked Tracks',
        coverUrl:
          'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=600&q=80',
        raw: { type: 'liked' },
      },
      {
        id: 'uploads',
        title: 'My Uploads',
        subtitle: 'AI & Personal Library',
        badge: 'Cloud',
        meta: 'Personal & AI Music',
        coverUrl:
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
        raw: { type: 'uploads' },
      },
      {
        id: 'downloaded',
        title: 'Downloaded Songs',
        subtitle: 'Offline Storage',
        badge: 'Offline',
        meta: 'Saved to Device',
        coverUrl:
          'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
        raw: { type: 'downloaded' },
      },
      ...playlists.map((pl) => ({
        id: pl.id,
        title: pl.name,
        subtitle: `Playlist • ${pl.track_count || 0} songs`,
        badge: 'Playlist',
        meta: `${pl.track_count || 0} tracks in crate`,
        coverUrl: pl.cover_url || undefined,
        raw: { type: 'playlist', id: pl.id },
      })),
    );
  }

  if (libraryFilter === 'all' || libraryFilter === 'albums') {
    allCrateItems.push(
      ...savedAlbums.map((alb) => ({
        id: alb.id,
        title: alb.title,
        subtitle: `Album • ${alb.artist}`,
        badge: 'Album',
        meta: `${alb.track_count || 0} tracks`,
        coverUrl: alb.cover_url || undefined,
        raw: { type: 'album', id: alb.album_id },
      })),
    );
  }

  if (libraryFilter === 'all' || libraryFilter === 'artists') {
    allCrateItems.push(
      ...followedArtists.map((art) => ({
        id: art.id,
        title: art.name,
        subtitle: `Artist • ${art.fan_count ? `${art.fan_count.toLocaleString()} fans` : 'Followed'}`,
        badge: 'Artist',
        meta: 'Followed Artist',
        coverUrl: art.picture_url || undefined,
        raw: { type: 'artist', id: art.artist_id },
      })),
    );
  }

  const handleCrateItemSelect = (item: CoverflowItem) => {
    if (item.raw?.type === 'liked') onSelectLiked();
    else if (item.raw?.type === 'uploads') onSelectUploads();
    else if (item.raw?.type === 'downloaded') onSelectDownloaded();
    else if (item.raw?.type === 'playlist') onSelectPlaylist(item.raw.id);
    else if (item.raw?.type === 'album' && onSelectAlbum) onSelectAlbum(item.raw.id);
    else if (item.raw?.type === 'artist' && onSelectArtist) onSelectArtist(item.raw.id);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#121212] p-4 text-white flex flex-col pb-44">
      {/* Navigation Breadcrumbs */}
      <div className="pt-[max(env(safe-area-inset-top,0px),1rem)] md:pt-1 -mx-2 mb-2">
        <Breadcrumbs
          items={[{ label: 'Dashboard', tab: 'home' }, { label: 'Your Library' }]}
          backLabel="Dashboard"
          onBack={() => {
            window.dispatchEvent(
              new CustomEvent('audiohub:navigate', { detail: { tab: 'home', id: null } }),
            );
          }}
        />
      </div>

      {/* Header with Profile Pill */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Library className="w-6 h-6 text-spotify-green" />
          <h1 className="text-2xl font-extrabold tracking-tight">Your Library</h1>
        </div>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#242424] hover:bg-[#282828] text-xs font-semibold text-white border border-white/5"
        >
          <User className="w-3.5 h-3.5 text-spotify-green" />
          <span>{userProfile?.display_name || 'Family Profile'}</span>
        </button>
      </div>

      {/* Category Filter Chips: [ All ] [ Playlists ] [ Artists ] [ Albums ] */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-3">
        {(['all', 'playlists', 'artists', 'albums'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setLibraryFilter(filter)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all whitespace-nowrap ${
              libraryFilter === filter
                ? 'bg-spotify-green text-black shadow-md'
                : 'bg-[#242424] text-white/80 hover:bg-[#2e2e2e]'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Action Chips & View Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#242424] hover:bg-[#282828] text-xs font-semibold text-white border border-white/10"
          >
            <PlusCircle className="w-4 h-4 text-spotify-green" />
            <span>New Playlist</span>
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#242424] hover:bg-[#282828] text-xs font-semibold text-white border border-white/10"
          >
            <UploadCloud className="w-4 h-4 text-spotify-green" />
            <span>Upload</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#242424] hover:bg-[#282828] text-xs font-semibold text-white border border-white/10"
          >
            <ArrowDownToLine className="w-4 h-4 text-spotify-green" />
            <span>Import</span>
          </button>
        </div>

        {/* View Mode Toggle: [ Grid ] [ Cover Flow ] */}
        <div className="flex items-center bg-black/50 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-lg text-xs">
          <button
            onClick={() => setCrateView('grid')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-bold transition-all ${
              crateView === 'grid'
                ? 'bg-white text-black shadow'
                : 'text-spotify-gray hover:text-white'
            }`}
            title="Standard Library Grid / List"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="text-xs">Grid</span>
          </button>
          <button
            onClick={() => setCrateView('coverflow')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-bold transition-all ${
              crateView === 'coverflow'
                ? 'bg-spotify-green text-black shadow'
                : 'text-spotify-gray hover:text-white'
            }`}
            title="3D Cover Flow Crate Digging"
          >
            <Disc3 className="w-3.5 h-3.5" />
            <span className="text-xs">Cover Flow</span>
          </button>
        </div>
      </div>

      {/* Main Content: Either 3D Cover Flow Browser or Standard List */}
      {crateView === 'coverflow' ? (
        <div className="flex-1 animate-fadeIn">
          <CoverflowBrowser
            items={allCrateItems}
            onItemSelect={handleCrateItemSelect}
            onItemPlay={handleCrateItemSelect}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Special Auto-Playlists (shown on All & Playlists) */}
          {(libraryFilter === 'all' || libraryFilter === 'playlists') && (
            <>
              {/* Liked Songs Entry */}
              <div
                onClick={onSelectLiked}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-[#181818] active:bg-[#282828] transition-colors cursor-pointer"
              >
                <div className="w-14 h-14 rounded bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Heart className="w-7 h-7 fill-white text-white" />
                </div>
                <div className="flex flex-col truncate">
                  <span className="font-bold text-sm text-white truncate">Liked Songs</span>
                  <span className="text-xs text-spotify-gray mt-0.5">Auto Master Playlist</span>
                </div>
              </div>

              {/* My Uploads Entry */}
              <div
                onClick={onSelectUploads}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-[#181818] active:bg-[#282828] transition-colors cursor-pointer"
              >
                <div className="w-14 h-14 rounded bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-md">
                  <UploadCloud className="w-7 h-7 fill-white text-white" />
                </div>
                <div className="flex flex-col truncate">
                  <span className="font-bold text-sm text-white truncate">My Uploads</span>
                  <span className="text-xs text-spotify-gray mt-0.5">AI & Personal Songs</span>
                </div>
              </div>

              {/* Downloaded Offline Entry */}
              <div
                onClick={onSelectDownloaded}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-[#181818] active:bg-[#282828] transition-colors cursor-pointer"
              >
                <div className="w-14 h-14 rounded bg-gradient-to-br from-emerald-600 via-teal-600 to-green-700 flex items-center justify-center flex-shrink-0 shadow-md">
                  <ArrowDownCircle className="w-7 h-7 fill-white text-white" />
                </div>
                <div className="flex flex-col truncate">
                  <span className="font-bold text-sm text-white truncate">Downloaded</span>
                  <span className="text-xs text-spotify-gray mt-0.5">Offline Storage</span>
                </div>
              </div>

              {/* Listening Stats / Wrapped Entry */}
              <div
                onClick={() => window.dispatchEvent(new CustomEvent('open_listening_stats'))}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-[#181818] active:bg-[#282828] transition-colors cursor-pointer"
              >
                <div className="w-14 h-14 rounded bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Sparkles className="w-7 h-7 fill-white text-white" />
                </div>
                <div className="flex flex-col truncate">
                  <span className="font-bold text-sm text-white truncate">Listening Stats</span>
                  <span className="text-xs text-amber-400 mt-0.5">Year in Review</span>
                </div>
              </div>
            </>
          )}

          {/* Followed Artists (shown on All & Artists) */}
          {(libraryFilter === 'all' || libraryFilter === 'artists') &&
            followedArtists.length > 0 && (
              <div className="mt-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-spotify-gray px-1 mb-2">
                  Followed Artists ({followedArtists.length})
                </h2>
                <div className="flex flex-col gap-1">
                  {followedArtists.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => onSelectArtist && onSelectArtist(art.artist_id)}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#181818] active:bg-[#242424] transition-colors cursor-pointer"
                    >
                      <div className="w-14 h-14 rounded-full bg-[#242424] flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10">
                        {art.picture_url ? (
                          <img
                            src={art.picture_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Mic2 className="w-6 h-6 text-spotify-gray" />
                        )}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="font-bold text-sm text-white truncate">{art.name}</span>
                        <span className="text-xs text-spotify-gray mt-0.5">
                          Artist {art.fan_count ? `• ${art.fan_count.toLocaleString()} fans` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Saved Albums (shown on All & Albums) */}
          {(libraryFilter === 'all' || libraryFilter === 'albums') && savedAlbums.length > 0 && (
            <div className="mt-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-spotify-gray px-1 mb-2">
                Saved Albums ({savedAlbums.length})
              </h2>
              <div className="flex flex-col gap-1">
                {savedAlbums.map((alb) => (
                  <div
                    key={alb.id}
                    onClick={() => onSelectAlbum && onSelectAlbum(alb.album_id)}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#181818] active:bg-[#242424] transition-colors cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-lg bg-[#242424] flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10">
                      {alb.cover_url ? (
                        <img src={alb.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Disc3 className="w-6 h-6 text-spotify-gray" />
                      )}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="font-bold text-sm text-white truncate">{alb.title}</span>
                      <span className="text-xs text-spotify-gray mt-0.5">Album • {alb.artist}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playlists List */}
          {(libraryFilter === 'all' || libraryFilter === 'playlists') && (
            <div className="mt-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-spotify-gray px-1 mb-2">
                Playlists ({playlists.length})
              </h2>
              <div className="flex flex-col gap-1">
                {loading ? (
                  <PlaylistItemSkeleton count={5} />
                ) : playlists.length === 0 ? (
                  <div className="p-4 text-center text-xs text-spotify-gray">No playlists yet</div>
                ) : (
                  playlists.map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => onSelectPlaylist(pl.id)}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#181818] active:bg-[#242424] transition-colors cursor-pointer"
                    >
                      <div className="w-14 h-14 rounded bg-[#242424] flex items-center justify-center flex-shrink-0 text-spotify-gray overflow-hidden">
                        {pl.cover_url ? (
                          <img src={pl.cover_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-6 h-6 text-white/30" />
                        )}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="font-bold text-sm text-white truncate">{pl.name}</span>
                        <span className="text-xs text-spotify-gray mt-0.5">
                          Playlist • {pl.track_count || 0} songs
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-[#242424] p-6 rounded-xl max-w-sm w-full flex flex-col gap-4 shadow-2xl border border-white/10"
          >
            <h3 className="text-white text-lg font-bold">Name Your Playlist</h3>
            <input
              type="text"
              placeholder="e.g. Road Trip, Gym Vibes"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="bg-[#333333] text-white px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-spotify-green text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2 text-sm mt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-spotify-gray font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-spotify-green text-black rounded-full font-bold"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          onSelectUploads();
        }}
      />

      {/* Import Playlist Modal */}
      <ImportPlaylistModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={(id) => {
          fetchLibrary();
          onSelectPlaylist(id);
        }}
      />
    </div>
  );
};
