import {
  ArrowDownCircle,
  ArrowDownToLine,
  BookOpen,
  Disc3,
  Download,
  Heart,
  Home,
  Library,
  Mic2,
  PlusCircle,
  Search,
  Sparkles,
  UploadCloud,
  Users,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useBranding } from '../config/branding';
import { useAuth } from '../context/AuthContext';
import { usePwaInstall } from '../context/PwaInstallContext';
import type { FollowedArtist, Playlist, SavedAlbum } from '../types';
import { AlbumContextMenu } from './AlbumContextMenu';
import { AzifyLogoMark } from './AzifyLogoMark';
import { ImportPlaylistModal } from './ImportPlaylistModal';
import { PlaylistContextMenu } from './PlaylistContextMenu';
import { PlaylistItemSkeleton } from './SkeletonLoaders';
import { UploadModal } from './UploadModal';

const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 640;

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedPlaylistId: string | null;
  setSelectedPlaylistId: (id: string | null) => void;
  onNavigate?: (tab: any, id?: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  selectedPlaylistId,
  setSelectedPlaylistId,
  onNavigate,
}) => {
  const { currentUser } = useAuth();
  const { isInstalled, isInstallable, promptInstall } = usePwaInstall();
  const brand = useBranding();
  const [libraryFilter, setLibraryFilter] = useState<'playlists' | 'artists' | 'albums'>(
    'playlists',
  );
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [savedAlbums, setSavedAlbums] = useState<SavedAlbum[]>([]);
  const [followedArtists, setFollowedArtists] = useState<FollowedArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [activePlaylistMenu, setActivePlaylistMenu] = useState<{
    playlist: Playlist;
    pos: { x: number; y: number };
  } | null>(null);
  const [activeAlbumMenu, setActiveAlbumMenu] = useState<{
    album: any;
    pos: { x: number; y: number };
  } | null>(null);

  // Resizable column width state
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('audiohub_sidebar_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= MIN_SIDEBAR_WIDTH && val <= MAX_SIDEBAR_WIDTH) {
          return val;
        }
      }
    } catch {}
    return DEFAULT_SIDEBAR_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  useEffect(() => {
    try {
      localStorage.setItem('audiohub_sidebar_width', sidebarWidth.toString());
    } catch {}
  }, [sidebarWidth]);

  const fetchLibraryData = async () => {
    try {
      const [plRes, albRes, artRes] = await Promise.all([
        fetch('/api/v1/playlists'),
        fetch('/api/v1/albums/library/saved'),
        fetch('/api/v1/artists/library/followed'),
      ]);
      if (plRes.ok) setPlaylists(await plRes.json());
      if (albRes.ok) setSavedAlbums(await albRes.json());
      if (artRes.ok) setFollowedArtists(await artRes.json());
    } catch (e) {
      console.error('Failed to load library data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibraryData();

    const handleLibraryChanged = () => {
      fetchLibraryData();
    };
    window.addEventListener('playlists_changed', handleLibraryChanged);
    window.addEventListener('library_changed', handleLibraryChanged);
    return () => {
      window.removeEventListener('playlists_changed', handleLibraryChanged);
      window.removeEventListener('library_changed', handleLibraryChanged);
    };
  }, [selectedPlaylistId]);

  const handleNav = (tab: any, id: string | null = null) => {
    if (onNavigate) {
      onNavigate(tab, id);
    } else {
      if (id) {
        setSelectedPlaylistId(id);
      } else {
        setSelectedPlaylistId(null);
      }
      setActiveTab(tab);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
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
        handleNav('playlist', created.id);
      }
    } catch (e) {
      console.error('Failed to create playlist', e);
    }
  };

  return (
    <div
      style={{ width: `${sidebarWidth}px` }}
      className="hidden md:flex relative bg-black flex-col h-full select-none p-2 gap-2 text-sm font-semibold flex-shrink-0 group/sidebar"
    >
      {/* Top Nav Block */}
      <div className="bg-[#121212] rounded-lg p-4 flex flex-col gap-4">
        <div
          onClick={() => handleNav('home')}
          className="flex items-center gap-2.5 px-2 text-white font-bold text-xl tracking-tight cursor-pointer group select-none min-w-0"
        >
          {brand.logoUrl && brand.logoUrl !== '/icon.svg?v=2' && brand.logoUrl !== '/icon.svg' ? (
            <img
              src={brand.logoUrl}
              alt={brand.appName}
              className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
            />
          ) : (
            <AzifyLogoMark className="w-8 h-8 flex-shrink-0" animated glow />
          )}
          <span className="group-hover:text-emerald-400 transition-colors truncate">
            {brand.appName}
          </span>
        </div>

        <nav className="flex flex-col gap-1 mt-2">
          <button
            onClick={() => handleNav('home')}
            className={`flex items-center gap-4 px-2 py-2 rounded-md transition-colors ${
              activeTab === 'home' && !selectedPlaylistId
                ? 'text-white bg-[#282828]'
                : 'text-spotify-gray hover:text-white'
            }`}
          >
            <Home className="w-6 h-6" />
            <span>Home</span>
          </button>

          <button
            onClick={() => handleNav('search')}
            className={`flex items-center gap-4 px-2 py-2 rounded-md transition-colors ${
              activeTab === 'search' && !selectedPlaylistId
                ? 'text-white bg-[#282828]'
                : 'text-spotify-gray hover:text-white'
            }`}
          >
            <Search className="w-6 h-6" />
            <span>Search</span>
          </button>

          <button
            onClick={() => handleNav('guides')}
            className={`flex items-center gap-4 px-2 py-2 rounded-md transition-colors ${
              activeTab === 'guides' && !selectedPlaylistId
                ? 'text-white bg-[#282828]'
                : 'text-spotify-gray hover:text-white'
            }`}
          >
            <BookOpen className="w-6 h-6 text-spotify-green" />
            <span>Help & Guides</span>
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('audiohub:open-group-session'))}
            className="flex items-center gap-4 px-2 py-2 rounded-md transition-colors text-spotify-gray hover:text-white"
            title="Start or join a collaborative listening room"
          >
            <Users className="w-6 h-6 text-purple-400" />
            <span>Group Session</span>
          </button>
        </nav>
      </div>

      {/* Library & Playlists Block */}
      <div className="bg-[#121212] rounded-lg p-3 flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-2 py-2 text-spotify-gray">
          <div className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer">
            <Library className="w-5 h-5 text-spotify-green" />
            <span className="text-white font-bold text-sm tracking-tight">Your Library</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setShowUploadModal(true)}
              className="hover:text-white hover:bg-[#282828] p-1.5 rounded-full transition-colors text-white/60 hover:text-white"
              title="Upload audio"
            >
              <UploadCloud className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="hover:text-white hover:bg-[#282828] p-1.5 rounded-full transition-colors text-white/60 hover:text-white"
              title="Import Playlist (Spotify / Apple Music)"
            >
              <ArrowDownToLine className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="hover:text-white hover:bg-[#282828] p-1.5 rounded-full transition-colors text-spotify-green hover:text-white"
              title="Create playlist"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Library Filter Pills */}
        <div className="flex items-center gap-1.5 px-1 py-1.5 text-xs mb-1">
          <button
            onClick={() => setLibraryFilter('playlists')}
            className={`px-3 py-1 rounded-full font-medium transition-all ${
              libraryFilter === 'playlists'
                ? 'bg-white text-black font-bold shadow'
                : 'bg-[#242424] text-spotify-gray hover:text-white hover:bg-[#2e2e2e]'
            }`}
          >
            Playlists
          </button>
          <button
            onClick={() => setLibraryFilter('artists')}
            className={`px-3 py-1 rounded-full font-medium transition-all ${
              libraryFilter === 'artists'
                ? 'bg-white text-black font-bold shadow'
                : 'bg-[#242424] text-spotify-gray hover:text-white hover:bg-[#2e2e2e]'
            }`}
          >
            Artists
          </button>
          <button
            onClick={() => setLibraryFilter('albums')}
            className={`px-3 py-1 rounded-full font-medium transition-all ${
              libraryFilter === 'albums'
                ? 'bg-white text-black font-bold shadow'
                : 'bg-[#242424] text-spotify-gray hover:text-white hover:bg-[#2e2e2e]'
            }`}
          >
            Albums
          </button>
        </div>

        {/* Playlists Filter View */}
        {libraryFilter === 'playlists' && (
          <>
            {/* Liked Songs Special Item */}
            <button
              type="button"
              onClick={() => handleNav('liked')}
              className={`w-full text-left flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                activeTab === 'liked' ? 'bg-[#282828] text-white' : 'hover:bg-[#1a1a1a] text-white'
              }`}
            >
              <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0 shadow">
                <Heart className="w-4 h-4 fill-white text-white" />
              </div>
              <div className="flex flex-col truncate min-w-0">
                <span className="truncate font-semibold text-xs text-white">Liked Songs</span>
                <span className="text-[10px] text-spotify-gray font-normal">Auto Playlist</span>
              </div>
            </button>

            {/* Quick Access Badges: My Uploads, Offline Downloads, Listening Stats */}
            <div className="grid grid-cols-3 gap-1 px-0.5 py-1 text-xs">
              <button
                type="button"
                onClick={() => handleNav('uploads')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg transition-colors border ${
                  activeTab === 'uploads'
                    ? 'bg-[#282828] text-white border-white/20'
                    : 'bg-[#181818] text-spotify-gray hover:text-white border-white/5 hover:bg-[#222]'
                }`}
                title="My Uploads (AI & Personal Songs)"
              >
                <UploadCloud className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <span className="text-[11px] font-medium truncate">Uploads</span>
              </button>
              <button
                type="button"
                onClick={() => handleNav('downloaded')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg transition-colors border ${
                  activeTab === 'downloaded'
                    ? 'bg-[#282828] text-white border-white/20'
                    : 'bg-[#181818] text-spotify-gray hover:text-white border-white/5 hover:bg-[#222]'
                }`}
                title="Downloaded Songs (Offline Storage)"
              >
                <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-[11px] font-medium truncate">Offline</span>
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open_listening_stats'))}
                className="flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg transition-colors border bg-[#181818] text-spotify-gray hover:text-white border-white/5 hover:bg-[#222]"
                title="AudioHub Year in Review & Listening Stats"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="text-[11px] font-medium truncate">Stats</span>
              </button>
            </div>

            {/* User Playlists List */}
            <div className="flex-1 overflow-y-auto mt-2 flex flex-col gap-1 pr-1">
              {loading ? (
                <PlaylistItemSkeleton count={4} />
              ) : playlists.length === 0 ? (
                <div className="p-4 text-center text-xs text-spotify-gray">No playlists yet</div>
              ) : (
                playlists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => handleNav('playlist', pl.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActivePlaylistMenu({ playlist: pl, pos: { x: e.clientX, y: e.clientY } });
                    }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                      selectedPlaylistId === pl.id
                        ? 'bg-[#282828] text-white'
                        : 'hover:bg-[#181818] text-spotify-gray hover:text-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded bg-[#282828] flex items-center justify-center flex-shrink-0 text-spotify-gray overflow-hidden">
                      {pl.cover_url ? (
                        <img src={pl.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Library className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex flex-col truncate min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{pl.name}</span>
                        {pl.auto_update && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex-shrink-0">
                            {pl.source_type === 'youtube' ? '⚡ Dynamic' : '⚡ Weekly'}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-spotify-gray font-normal truncate">
                        {pl.source_type === 'chart' ? 'Official Chart' : 'Playlist'} •{' '}
                        {pl.track_count || 0} songs
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Followed Artists Filter View */}
        {libraryFilter === 'artists' && (
          <div className="flex-1 overflow-y-auto mt-1 flex flex-col gap-1 pr-1">
            {loading ? (
              <PlaylistItemSkeleton count={4} />
            ) : followedArtists.length === 0 ? (
              <div className="p-4 text-center text-xs text-spotify-gray">
                No artists followed yet.
                <br />
                Open an artist page and click "Follow".
              </div>
            ) : (
              followedArtists.map((art) => (
                <div
                  key={art.id}
                  onClick={() => handleNav('artist', art.artist_id)}
                  className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-[#181818] text-spotify-gray hover:text-white group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#282828] flex items-center justify-center flex-shrink-0 text-spotify-gray overflow-hidden border border-white/5">
                    {art.picture_url ? (
                      <img src={art.picture_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Mic2 className="w-4 h-4 text-spotify-gray" />
                    )}
                  </div>
                  <div className="flex flex-col truncate min-w-0">
                    <span className="truncate font-semibold text-white group-hover:text-spotify-green transition-colors">
                      {art.name}
                    </span>
                    <span className="text-xs text-spotify-gray font-normal truncate">
                      Artist {art.fan_count ? `• ${art.fan_count.toLocaleString()} fans` : ''}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Saved Albums Filter View */}
        {libraryFilter === 'albums' && (
          <div className="flex-1 overflow-y-auto mt-1 flex flex-col gap-1 pr-1">
            {loading ? (
              <PlaylistItemSkeleton count={4} />
            ) : savedAlbums.length === 0 ? (
              <div className="p-4 text-center text-xs text-spotify-gray">
                No albums saved yet.
                <br />
                Open an album and click "Save to Library".
              </div>
            ) : (
              savedAlbums.map((alb) => (
                <div
                  key={alb.id}
                  onClick={() => handleNav('album', alb.album_id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setActiveAlbumMenu({
                      album: {
                        id: alb.album_id,
                        title: alb.title,
                        artist: alb.artist,
                        cover_url: alb.cover_url,
                      },
                      pos: { x: e.clientX, y: e.clientY },
                    });
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-[#181818] text-spotify-gray hover:text-white group"
                >
                  <div className="w-10 h-10 rounded-md bg-[#282828] flex items-center justify-center flex-shrink-0 text-spotify-gray overflow-hidden border border-white/5">
                    {alb.cover_url ? (
                      <img src={alb.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Disc3 className="w-5 h-5 text-spotify-gray" />
                    )}
                  </div>
                  <div className="flex flex-col truncate min-w-0">
                    <span className="truncate font-semibold text-white group-hover:text-spotify-green transition-colors">
                      {alb.title}
                    </span>
                    <span className="text-xs text-spotify-gray font-normal truncate">
                      Album • {alb.artist}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* PWA Install App Button */}
        {!isInstalled && isInstallable && (
          <div className="pt-2 px-1">
            <button
              onClick={promptInstall}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-spotify-green/20 via-emerald-500/10 to-transparent hover:from-spotify-green/30 hover:to-emerald-500/20 border border-spotify-green/30 text-white font-bold text-xs flex items-center justify-between transition-all group shadow-md"
              title="Install AudioHub App for desktop or mobile"
            >
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-spotify-green group-hover:scale-110 transition-transform" />
                <span className="truncate">Install AudioHub App</span>
              </div>
              <span className="text-[10px] bg-spotify-green text-black font-extrabold px-1.5 py-0.5 rounded shadow">
                GET
              </span>
            </button>
          </div>
        )}

        {/* End of Library Block */}
      </div>

      {/* Right Column Resizer Handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
        title="Drag to resize library • Double-click to reset width"
        className={`absolute top-0 -right-1 w-2.5 h-full cursor-col-resize z-40 flex items-center justify-center transition-all ${
          isResizing ? 'opacity-100' : 'opacity-0 hover:opacity-100'
        }`}
      >
        <div
          className={`w-1 rounded-full transition-all ${
            isResizing
              ? 'bg-spotify-green shadow-lg shadow-spotify-green/50 h-24'
              : 'bg-white/20 hover:bg-white/60 h-12'
          }`}
        />
      </div>

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePlaylist}
            className="bg-[#282828] p-6 rounded-xl max-w-sm w-full flex flex-col gap-4 shadow-2xl border border-white/10"
          >
            <h3 className="text-white text-lg font-bold">New Playlist</h3>
            <input
              type="text"
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="bg-[#3e3e3e] text-white px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-spotify-green text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2 text-sm mt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-spotify-gray hover:text-white font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-spotify-green text-black rounded-full font-bold hover:scale-105 transition-transform"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Music Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          handleNav('uploads');
        }}
      />

      {/* Import Playlist Modal */}
      <ImportPlaylistModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={(importedId) => {
          fetchLibraryData();
          handleNav('playlist', importedId);
        }}
      />

      {/* Playlist Context Menu */}
      {activePlaylistMenu && (
        <PlaylistContextMenu
          playlist={activePlaylistMenu.playlist}
          isOpen={true}
          onClose={() => setActivePlaylistMenu(null)}
          anchorPosition={activePlaylistMenu.pos}
          onNavigate={() => {
            handleNav('playlist', activePlaylistMenu.playlist.id);
            setActivePlaylistMenu(null);
          }}
          onDeleted={() => {
            fetchLibraryData();
            setActivePlaylistMenu(null);
          }}
        />
      )}

      {/* Album Context Menu */}
      {activeAlbumMenu && (
        <AlbumContextMenu
          album={activeAlbumMenu.album}
          isOpen={true}
          onClose={() => setActiveAlbumMenu(null)}
          anchorPosition={activeAlbumMenu.pos}
          onNavigateAlbum={() => {
            handleNav('album', activeAlbumMenu.album.id);
            setActiveAlbumMenu(null);
          }}
          onNavigateArtist={(artistId) => {
            handleNav('artist', artistId);
            setActiveAlbumMenu(null);
          }}
        />
      )}
    </div>
  );
};
