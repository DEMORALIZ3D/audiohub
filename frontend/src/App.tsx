import type React from 'react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { AmbientGlow } from './components/AmbientGlow';
import { InAppBrowserBanner } from './components/InAppBrowserBanner';
import { IosInstallModal } from './components/IosInstallModal';
import { MagicAuthModal } from './components/MagicAuthModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileMiniPlayer } from './components/MobileMiniPlayer';
import { MobileNowPlayingModal } from './components/MobileNowPlayingModal';
import { NetworkStatusChip } from './components/NetworkStatusChip';
import { PlayerBar } from './components/PlayerBar';
import { PopoutPlayer } from './components/PopoutPlayer';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { QueueDrawer } from './components/QueueDrawer';
import { ServerConnectModal } from './components/ServerConnectModal';
import { Sidebar } from './components/Sidebar';
import { fetchServerBranding } from './config/branding';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CastProvider } from './context/CastContext';
import { ConnectProvider } from './context/ConnectContext';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { PwaInstallProvider } from './context/PwaInstallContext';
import { SearchProvider } from './context/SearchContext';
import { AlbumView } from './pages/AlbumView';
import { ArtistView } from './pages/ArtistView';
import { DownloadedView } from './pages/DownloadedView';
import { Home } from './pages/Home';
import { LikedSongs } from './pages/LikedSongs';
import { LoginView } from './pages/LoginView';
import { MobileLibrary } from './pages/MobileLibrary';
import { PairTvView } from './pages/PairTvView';
import { PlaylistView } from './pages/PlaylistView';
import { Search } from './pages/Search';
import { SetupWizardView } from './pages/SetupWizardView';
import { getServerBaseUrl, isStandaloneApp, isTvPlatform, resolveApiUrl } from './utils/apiConfig';
import type { ShareOptions } from './utils/shareUtils';

// Code-split heavy views & modals to optimize initial bundle size
const SettingsView = lazy(() =>
  import('./pages/SettingsView').then((m) => ({ default: m.SettingsView })),
);
const HelpGuidesView = lazy(() =>
  import('./pages/HelpGuidesView').then((m) => ({ default: m.HelpGuidesView })),
);
const UploadsView = lazy(() =>
  import('./pages/UploadsView').then((m) => ({ default: m.UploadsView })),
);
const VisualizerModal = lazy(() =>
  import('./components/VisualizerModal').then((m) => ({ default: m.VisualizerModal })),
);
const LyricsModal = lazy(() =>
  import('./components/LyricsModal').then((m) => ({ default: m.LyricsModal })),
);
const DevicePickerModal = lazy(() =>
  import('./components/DevicePickerModal').then((m) => ({ default: m.DevicePickerModal })),
);
const GroupSessionModal = lazy(() =>
  import('./components/GroupSessionModal').then((m) => ({ default: m.GroupSessionModal })),
);
const ListeningStatsModal = lazy(() =>
  import('./components/ListeningStatsModal').then((m) => ({ default: m.ListeningStatsModal })),
);
const ShareModal = lazy(() =>
  import('./components/ShareModal').then((m) => ({ default: m.ShareModal })),
);
const AddToPlaylistModal = lazy(() =>
  import('./components/AddToPlaylistModal').then((m) => ({ default: m.AddToPlaylistModal })),
);
const TvLeanbackView = lazy(() =>
  import('./pages/TvLeanbackView').then((m) => ({ default: m.TvLeanbackView })),
);

import type { TabType, Track } from './types';

const VALID_TABS: readonly TabType[] = [
  'home',
  'search',
  'library',
  'liked',
  'playlist',
  'artist',
  'album',
  'settings',
  'uploads',
  'downloaded',
  'guides',
  'tv',
  'pair',
  'setup',
] as const;

interface RouteState {
  tab: TabType;
  id?: string | null;
}

const parsePath = (path: string): RouteState | null => {
  const [routePart] = path
    .replace(/^#?\/?/, '')
    .trim()
    .split('?');
  if (!routePart) return null;
  const parts = routePart.split('/');
  const main = parts[0].toLowerCase();
  const id = parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : null;
  if (main === 'radio' && id) {
    return { tab: 'playlist', id: id.startsWith('radio_') ? id : `radio_${id}` };
  }
  if (VALID_TABS.includes(main as TabType)) {
    return { tab: main as TabType, id };
  }
  return null;
};

const parseRoute = (): RouteState => {
  // 1. Check query parameters (e.g. ?tab=liked, ?playlist=123, ?artist=456)
  const params = new URLSearchParams(window.location.search);
  const qTab = (params.get('tab') || params.get('page')) as TabType | null;
  const qPlaylist = params.get('playlist') || (qTab === 'playlist' ? params.get('id') : null);
  const qArtist = params.get('artist') || (qTab === 'artist' ? params.get('id') : null);
  const qAlbum = params.get('album') || (qTab === 'album' ? params.get('id') : null);

  if (qPlaylist) return { tab: 'playlist', id: qPlaylist };
  if (qArtist) return { tab: 'artist', id: qArtist };
  if (qAlbum) return { tab: 'album', id: qAlbum };
  if (qTab && VALID_TABS.includes(qTab)) {
    return { tab: qTab };
  }

  // 2. Check hash route (e.g. #/liked, #/playlist/123, #/settings)
  const hashRoute = parsePath(window.location.hash);
  if (hashRoute) return hashRoute;

  // 3. Check pathname (e.g. /liked, /settings, /playlist/123)
  const pathRoute = parsePath(window.location.pathname);
  if (pathRoute) return pathRoute;

  // 4. Check localStorage for persistent return
  try {
    const saved = localStorage.getItem('audiohub_last_route');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.tab && VALID_TABS.includes(parsed.tab)) {
        return { tab: parsed.tab, id: parsed.id };
      }
    }
  } catch (e) {}

  if (isTvPlatform()) {
    return { tab: 'tv' };
  }

  return { tab: 'home' };
};

const AppContent: React.FC = () => {
  const { currentUser, loading, refreshUser } = useAuth();
  const initialRoute = parseRoute();

  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(initialRoute.tab);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    initialRoute.tab === 'playlist' ? initialRoute.id || null : null,
  );
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(
    initialRoute.tab === 'artist' ? initialRoute.id || null : null,
  );
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(
    initialRoute.tab === 'album' ? initialRoute.id || null : null,
  );
  const [isMobileNowPlayingOpen, setIsMobileNowPlayingOpen] = useState(false);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareData, setShareData] = useState<ShareOptions | null>(null);
  const [magicAuthSession, setMagicAuthSession] = useState<{ id: string; pin?: string } | null>(
    null,
  );
  const [showGroupSessionModal, setShowGroupSessionModal] = useState(false);
  const [initialRoomCode, setInitialRoomCode] = useState<string | null>(null);
  const [showServerConnectModal, setShowServerConnectModal] = useState(() => {
    return isStandaloneApp() && !getServerBaseUrl();
  });
  const [sharedTrackForPlaylist, setSharedTrackForPlaylist] = useState<Track | null>(null);
  const { showVisualizer, setShowVisualizer, showDeviceModal, setShowDeviceModal, playTrack } =
    usePlayer();

  // Check if server requires initial first-run setup
  useEffect(() => {
    let mounted = true;
    async function checkSetup() {
      try {
        const res = await fetch(resolveApiUrl('/api/v1/setup/status'));
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            const isReq = Boolean(data.setup_required);
            setSetupRequired(isReq);
            if (isReq && activeTab !== 'setup') {
              setActiveTab('setup');
            }
          }
        }
      } catch (err) {
        console.debug('Failed to query setup status:', err);
      }
    }
    checkSetup();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSetupComplete = async (user?: any) => {
    setSetupRequired(false);
    if (user?.id) {
      localStorage.setItem('audiohub_user_id', user.id);
    }
    await fetchServerBranding();
    await refreshUser();
    navigate('home', null, true);
    window.location.hash = '#/home';
  };

  // Listen for audiohub:open-group-session global event
  useEffect(() => {
    const handleOpenGroupSession = (e: any) => {
      if (e?.detail?.code) {
        setInitialRoomCode(e.detail.code);
      }
      setShowGroupSessionModal(true);
    };
    window.addEventListener('audiohub:open-group-session', handleOpenGroupSession);
    return () => window.removeEventListener('audiohub:open-group-session', handleOpenGroupSession);
  }, []);

  // Detect incoming ?room=... invite code from URL and open group session modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setInitialRoomCode(room.toUpperCase().trim());
      setShowGroupSessionModal(true);
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, []);

  // Listen for audiohub:open-server-connect global event
  useEffect(() => {
    const handleOpenServerConnect = () => setShowServerConnectModal(true);
    window.addEventListener('audiohub:open-server-connect', handleOpenServerConnect);
    return () =>
      window.removeEventListener('audiohub:open-server-connect', handleOpenServerConnect);
  }, []);

  // Detect incoming Magic QR login authorization request (?magic_auth=...&pin=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicAuth = params.get('magic_auth');
    const pin = params.get('pin') || '';
    if (magicAuth && currentUser) {
      setMagicAuthSession({ id: magicAuth, pin });
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, [currentUser]);

  // Listen for open_listening_stats global event
  useEffect(() => {
    const handleOpenStats = () => setShowStatsModal(true);
    window.addEventListener('open_listening_stats', handleOpenStats);
    return () => window.removeEventListener('open_listening_stats', handleOpenStats);
  }, []);

  // Listen for audiohub:open-share global event
  useEffect(() => {
    const handleOpenShare = (e: any) => {
      if (e.detail) {
        setShareData(e.detail);
        setShowShareModal(true);
      }
    };
    window.addEventListener('audiohub:open-share', handleOpenShare);
    return () => window.removeEventListener('audiohub:open-share', handleOpenShare);
  }, []);

  // Listen for audiohub:open-tv global event
  useEffect(() => {
    const handleOpenTv = () => navigate('tv');
    window.addEventListener('audiohub:open-tv', handleOpenTv);
    return () => window.removeEventListener('audiohub:open-tv', handleOpenTv);
  }, []);

  // Listen for audiohub:navigate global event
  useEffect(() => {
    const handleCustomNavigate = (e: any) => {
      if (e?.detail?.tab) {
        navigate(e.detail.tab, e.detail.id || null);
      }
    };
    window.addEventListener('audiohub:navigate', handleCustomNavigate);
    return () => window.removeEventListener('audiohub:navigate', handleCustomNavigate);
  }, []);

  // Listen for audiohub:toast global notification event
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  useEffect(() => {
    let timer: any = null;
    const handleToast = (e: any) => {
      const msg = e?.detail?.message;
      if (msg) {
        setToastMessage(msg);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          setToastMessage(null);
        }, 3000);
      }
    };
    window.addEventListener('audiohub:toast', handleToast);
    return () => {
      window.removeEventListener('audiohub:toast', handleToast);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const getParentRoute = (tab: TabType, id: string | null): { tab: TabType; id: string | null } => {
    switch (tab) {
      case 'playlist':
      case 'album':
      case 'artist':
      case 'liked':
      case 'uploads':
      case 'downloaded':
        return { tab: 'library', id: null };
      case 'library':
      case 'search':
      case 'settings':
      case 'guides':
      case 'tv':
      case 'pair':
      case 'setup':
        return { tab: 'home', id: null };
      default:
        return { tab: 'home', id: null };
    }
  };

  // Unified navigate function with URL and localStorage sync
  const navigate = (tab: TabType, id: string | null = null, replace = false) => {
    setIsMobileNowPlayingOpen(false);
    setActiveTab(tab);
    if (tab === 'playlist') setSelectedPlaylistId(id);
    else setSelectedPlaylistId(null);
    if (tab === 'artist') setSelectedArtistId(id);
    else setSelectedArtistId(null);
    if (tab === 'album') setSelectedAlbumId(id);
    else setSelectedAlbumId(null);

    let routeHash = '#/' + (tab === 'home' ? '' : tab);
    if (id && (tab === 'playlist' || tab === 'artist' || tab === 'album')) {
      routeHash = `#/${tab}/${encodeURIComponent(id)}`;
    }

    try {
      localStorage.setItem('audiohub_last_route', JSON.stringify({ tab, id }));
      if (window.location.hash !== routeHash) {
        if (replace) {
          window.history.replaceState({ tab, id }, '', routeHash);
        } else {
          window.history.pushState({ tab, id }, '', routeHash);
        }
      }
    } catch (e) {}
  };

  // Sync hash on initial load with root history seeding to prevent app from closing on Back
  useEffect(() => {
    let routeHash = '#/' + (activeTab === 'home' ? '' : activeTab);
    const id = selectedPlaylistId || selectedArtistId || selectedAlbumId;
    if (id && (activeTab === 'playlist' || activeTab === 'artist' || activeTab === 'album')) {
      routeHash = `#/${activeTab}/${encodeURIComponent(id)}`;
    }

    if (activeTab !== 'home') {
      // Seed Dashboard as root history entry so pressing Back unwinds to Dashboard instead of closing app
      window.history.replaceState({ tab: 'home', id: null }, '', '#/');
      window.history.pushState({ tab: activeTab, id }, '', routeHash);
    } else {
      if (!window.location.hash || window.location.hash === '#/') {
        window.history.replaceState({ tab: 'home', id: null }, '', '#/');
      }
    }
  }, []);

  // Listen for audiohub:back global back action
  useEffect(() => {
    const handleCustomBack = () => {
      if (activeTab === 'home') return;
      const parent = getParentRoute(
        activeTab,
        selectedPlaylistId || selectedArtistId || selectedAlbumId,
      );
      navigate(parent.tab, parent.id);
    };
    window.addEventListener('audiohub:back', handleCustomBack);
    return () => window.removeEventListener('audiohub:back', handleCustomBack);
  }, [activeTab, selectedPlaylistId, selectedArtistId, selectedAlbumId]);

  // Listen for browser Back/Forward navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const r = parseRoute();
      setActiveTab(r.tab);
      if (r.tab === 'playlist') setSelectedPlaylistId(r.id || null);
      else setSelectedPlaylistId(null);
      if (r.tab === 'artist') setSelectedArtistId(r.id || null);
      else setSelectedArtistId(null);
      if (r.tab === 'album') setSelectedAlbumId(r.id || null);
      else setSelectedAlbumId(null);
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Handle Web Share Target & Shared Track Deep Links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedTrack = params.get('track');
    if (sharedTrack) {
      fetch(`/api/v1/stream/${sharedTrack}/info`)
        .then((res) => (res.ok ? res.json() : null))
        .then((trackData) => {
          if (trackData && trackData.id) {
            playTrack(trackData, [trackData]);
            if (window.innerWidth < 768) {
              setIsMobileNowPlayingOpen(true);
            }
          }
        })
        .catch((e) => console.warn('Failed to load shared track:', e));
    }

    const shared = params.get('url') || params.get('text') || params.get('title');
    if (shared) {
      const isUrl =
        shared.includes('http://') ||
        shared.includes('https://') ||
        shared.includes('youtu.be') ||
        shared.includes('youtube.com') ||
        shared.includes('spotify.com') ||
        shared.includes('deezer.com');

      if (isUrl) {
        setToastMessage('Resolving shared song...');
        fetch(`/api/v1/tracks/resolve-share?query=${encodeURIComponent(shared)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((trackData) => {
            if (trackData && trackData.id) {
              setSharedTrackForPlaylist(trackData);
              setToastMessage(`Select a playlist for "${trackData.title}"`);
            } else {
              setInitialSearchQuery(shared);
              navigate('search');
            }
          })
          .catch((e) => {
            console.warn('Failed to resolve shared track:', e);
            setInitialSearchQuery(shared);
            navigate('search');
          })
          .finally(() => {
            window.history.replaceState({}, '', window.location.pathname + window.location.hash);
          });
      } else {
        setInitialSearchQuery(shared);
        navigate('search');
        window.history.replaceState({}, '', '/#/search');
      }
    }
  }, []);

  if (loading || (setupRequired === null && !localStorage.getItem('audiohub_user_id'))) {
    return (
      <div className="min-h-screen w-screen bg-[#090909] flex items-center justify-center text-spotify-green">
        <div className="w-8 h-8 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (initialRoute.tab === 'pair' || activeTab === 'pair') {
    return <PairTvView />;
  }

  if (setupRequired === true || activeTab === 'setup' || initialRoute.tab === 'setup') {
    return <SetupWizardView onComplete={handleSetupComplete} />;
  }

  if (!currentUser) {
    const isTvMode =
      isTvPlatform() ||
      initialRoute.tab === 'tv' ||
      activeTab === 'tv' ||
      window.location.hash.includes('tv') ||
      window.location.pathname.includes('/tv');
    if (isTvMode) {
      return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-black select-none relative">
          <Suspense
            fallback={
              <div className="h-screen w-screen bg-[#070709] flex items-center justify-center text-spotify-gray">
                <div className="w-8 h-8 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <TvLeanbackView onExit={() => navigate('home')} />
          </Suspense>
        </div>
      );
    }
    return <LoginView isTvMode={isTvMode} />;
  }

  const navigateToArtist = (artistId: string) => {
    navigate('artist', artistId);
  };

  const navigateToAlbum = (albumId: string) => {
    navigate('album', albumId);
  };

  const renderContent = () => {
    if (activeTab === 'artist' && selectedArtistId) {
      return (
        <ArtistView
          artistId={selectedArtistId}
          onSelectAlbum={navigateToAlbum}
          onSelectArtist={navigateToArtist}
        />
      );
    }

    if (activeTab === 'album' && selectedAlbumId) {
      return <AlbumView albumId={selectedAlbumId} onSelectArtist={navigateToArtist} />;
    }

    if (activeTab === 'playlist' && selectedPlaylistId) {
      return (
        <PlaylistView
          playlistId={selectedPlaylistId}
          onDeleted={() => {
            navigate('home', null, true);
          }}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <Home
            onNavigateToPlaylist={(id) => {
              navigate('playlist', id);
            }}
          />
        );
      case 'search':
        return (
          <Search
            onSelectArtist={navigateToArtist}
            onSelectAlbum={navigateToAlbum}
            onSelectPlaylist={(id) => navigate('playlist', id)}
            initialQuery={initialSearchQuery}
          />
        );
      case 'library':
        return (
          <MobileLibrary
            onSelectLiked={() => navigate('liked')}
            onSelectUploads={() => navigate('uploads')}
            onSelectDownloaded={() => navigate('downloaded')}
            onSelectPlaylist={(id) => {
              navigate('playlist', id);
            }}
            onSelectAlbum={(id) => navigate('album', id)}
            onSelectArtist={(id) => navigate('artist', id)}
            onOpenSettings={() => navigate('settings')}
          />
        );
      case 'liked':
        return <LikedSongs />;
      case 'uploads':
        return <UploadsView />;
      case 'downloaded':
        return <DownloadedView />;
      case 'settings':
        return <SettingsView />;
      case 'guides':
        return (
          <HelpGuidesView
            onOpenImporter={() => {
              // Trigger import modal
              const btn = document.querySelector('[title*="Import Playlist"]') as HTMLButtonElement;
              if (btn) btn.click();
            }}
            onNavigateTab={(tab) => navigate(tab as TabType)}
          />
        );
      default:
        return <Home />;
    }
  };

  if (activeTab === 'tv') {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-black select-none relative">
        <Suspense
          fallback={
            <div className="h-screen w-screen bg-[#070709] flex items-center justify-center text-spotify-gray">
              <div className="w-8 h-8 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <TvLeanbackView onExit={() => navigate('home')} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black select-none relative">
      {/* In-App Browser (Messenger / Instagram) Breakout Notification */}
      <InAppBrowserBanner />

      {/* Ambient Sound-Reactive Glow Aura */}
      <AmbientGlow />

      {/* Upper Area: Sidebar (Desktop) + Main Viewport */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab: any) => {
            navigate(tab);
          }}
          selectedPlaylistId={selectedPlaylistId}
          setSelectedPlaylistId={(id: string | null) => {
            if (id) navigate('playlist', id);
            else setSelectedPlaylistId(null);
          }}
          onNavigate={(tab: any, id: string | null = null) => {
            navigate(tab, id);
          }}
        />

        {/* Main Scrollable View */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#121212] md:m-2 md:ml-0 md:rounded-lg relative pt-[env(safe-area-inset-top,0px)]">
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center text-spotify-gray">
                <div className="w-6 h-6 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            {renderContent()}
          </Suspense>
        </main>
      </div>

      {/* Network Status & Stream Recovery Chip */}
      <NetworkStatusChip />

      {/* Desktop Player Bar (Hidden on mobile) */}
      <PlayerBar />

      {/* Mobile Mini Player (Floating above mobile bottom nav) */}
      <MobileMiniPlayer onExpand={() => setIsMobileNowPlayingOpen(true)} />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={(tab: any) => {
          navigate(tab);
        }}
        onOpenLibrary={() => {
          navigate('library');
        }}
      />

      {/* Mobile Full-Screen Now Playing Modal */}
      <MobileNowPlayingModal
        isOpen={isMobileNowPlayingOpen}
        onClose={() => setIsMobileNowPlayingOpen(false)}
      />

      {/* Modals & Overlays */}
      <Suspense fallback={null}>
        <LyricsModal />
        <VisualizerModal isOpen={showVisualizer} onClose={() => setShowVisualizer(false)} />
        <DevicePickerModal isOpen={showDeviceModal} onClose={() => setShowDeviceModal(false)} />
        <GroupSessionModal
          isOpen={showGroupSessionModal}
          onClose={() => {
            setShowGroupSessionModal(false);
            setInitialRoomCode(null);
          }}
          initialCode={initialRoomCode}
        />
        <ListeningStatsModal isOpen={showStatsModal} onClose={() => setShowStatsModal(false)} />
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          data={shareData}
        />
        <AddToPlaylistModal
          isOpen={!!sharedTrackForPlaylist}
          onClose={() => setSharedTrackForPlaylist(null)}
          track={sharedTrackForPlaylist}
        />
      </Suspense>
      <QueueDrawer />
      <PopoutPlayer />

      {/* Magic QR Sign-In Approval Modal */}
      <MagicAuthModal
        isOpen={!!magicAuthSession}
        onClose={() => setMagicAuthSession(null)}
        sessionId={magicAuthSession?.id || ''}
        initialPin={magicAuthSession?.pin || ''}
      />

      {/* Standalone / Native App Server Connection Modal */}
      <ServerConnectModal
        isOpen={showServerConnectModal && isStandaloneApp()}
        onClose={() => setShowServerConnectModal(false)}
        canClose={Boolean(getServerBaseUrl())}
      />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none animate-slide-down">
          <div className="bg-[#1f1f23]/95 backdrop-blur-md text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-full shadow-2xl border border-white/10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-spotify-green animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* PWA Install & Update UI */}
      <PwaInstallBanner />
      <PwaUpdateBanner />
      <IosInstallModal />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <CastProvider>
        <PwaInstallProvider>
          <PlayerProvider>
            <ConnectProvider>
              <SearchProvider>
                <AppContent />
              </SearchProvider>
            </ConnectProvider>
          </PlayerProvider>
        </PwaInstallProvider>
      </CastProvider>
    </AuthProvider>
  );
};

export default App;
