import { Compass, Disc3, Music, Play, Sparkles, TrendingUp } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { AzifyLogoMark } from '../components/AzifyLogoMark';
import { PlaylistContextMenu } from '../components/PlaylistContextMenu';
import { HomeSkeleton } from '../components/SkeletonLoaders';
import { TrackContextMenu } from '../components/TrackContextMenu';
import { useBranding } from '../config/branding';
import { usePlayer } from '../context/PlayerContext';
import type { CuratedPlaylistSummary, DailyMix, Track } from '../types';
import { navigateToArtist } from '../utils/navigation';

export const Home: React.FC<{ onNavigateToPlaylist?: (id: string) => void }> = ({
  onNavigateToPlaylist,
}) => {
  const brand = useBranding();
  const { playTrack } = usePlayer();
  const [greeting, setGreeting] = useState('');
  const [quickAccess, setQuickAccess] = useState<Track[]>([]);
  const [dailyMixes, setDailyMixes] = useState<DailyMix[]>([]);
  const [featuredCharts, setFeaturedCharts] = useState<any[]>([]);
  const [genrePlaylists, setGenrePlaylists] = useState<CuratedPlaylistSummary[]>([]);
  const [trending, setTrending] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTrackMenu, setActiveTrackMenu] = useState<{
    track: Track;
    pos: { x: number; y: number };
  } | null>(null);
  const [activePlaylistMenu, setActivePlaylistMenu] = useState<{
    playlist: any;
    pos: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    fetch(`/api/v1/discovery/home?hour=${hour}`)
      .then((res) => res.json())
      .then((data) => {
        setQuickAccess(data.quick_access || []);
        setDailyMixes(data.daily_mixes || []);
        setFeaturedCharts(data.featured_charts || []);
        setGenrePlaylists(data.genre_playlists || []);
        setTrending(data.trending || []);
      })
      .catch((e) => console.error('Failed to load home feed', e))
      .finally(() => setLoading(false));
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'genres' | 'moods' | 'kids' | 'seasons'
  >('all');

  const categories = [
    { id: 'all', label: '✨ All Curated' },
    { id: 'genres', label: '🪩 Genres' },
    { id: 'moods', label: '🌙 Moods & Focus' },
    { id: 'kids', label: '🎈 Kids & Family' },
    { id: 'seasons', label: '🎉 Events & Seasons' },
  ] as const;

  const filteredPlaylists =
    selectedCategory === 'all'
      ? genrePlaylists
      : genrePlaylists.filter((g) => {
          if (g.category === selectedCategory) return true;
          if (selectedCategory === 'genres' && g.id.startsWith('genre_')) return true;
          if (
            selectedCategory === 'moods' &&
            (g.id.startsWith('mood_') || g.id.startsWith('event_'))
          )
            return true;
          if (selectedCategory === 'kids' && g.id.startsWith('kids_')) return true;
          if (selectedCategory === 'seasons' && g.id.startsWith('season_')) return true;
          return false;
        });

  if (loading) {
    return <HomeSkeleton />;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#1e3264]/40 via-[#121212] to-[#121212] p-4 md:p-8 text-white pb-44">
      {/* Mobile Top Brand Bar (Visible on mobile header with status-bar clearance) */}
      <div className="md:hidden flex items-center gap-2.5 mb-4 pt-[max(env(safe-area-inset-top,0px),4.25rem)] min-w-0">
        {brand.logoUrl && brand.logoUrl !== '/icon.svg?v=2' && brand.logoUrl !== '/icon.svg' ? (
          <img
            src={brand.logoUrl}
            alt={brand.appName}
            className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
          />
        ) : (
          <AzifyLogoMark className="w-8 h-8 flex-shrink-0" animated glow />
        )}
        <span className="font-extrabold text-xl tracking-tight text-white truncate">
          {brand.appName}
        </span>
      </div>

      {/* Greeting Header */}
      <h1 className="text-3xl font-extrabold tracking-tight mb-6">{greeting}</h1>

      {/* Quick Access Grid (Spotify 6-card row) */}
      {quickAccess.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {quickAccess.map((item) => (
            <div
              key={item.id}
              onClick={() => playTrack(item)}
              onContextMenu={(e) => {
                e.preventDefault();
                setActiveTrackMenu({ track: item, pos: { x: e.clientX, y: e.clientY } });
              }}
              className="group flex items-center bg-white/10 hover:bg-white/20 transition-all rounded-md overflow-hidden cursor-pointer shadow-md pr-4 select-none"
            >
              <div className="w-16 h-16 bg-[#282828] flex-shrink-0 flex items-center justify-center">
                {item.cover_url ? (
                  <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-6 h-6 text-spotify-gray" />
                )}
              </div>
              <div className="flex-1 px-3 truncate">
                <span className="font-bold text-sm truncate block text-white">{item.title}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToArtist(item.artist, (item as any).artist_id);
                  }}
                  className="text-xs text-spotify-gray truncate block hover:underline hover:text-white cursor-pointer z-10"
                  title={`View ${item.artist}`}
                >
                  {item.artist}
                </span>
              </div>
              <button className="w-10 h-10 rounded-full bg-spotify-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-xl transition-all hover:scale-105 ml-auto flex-shrink-0">
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Made For You / Daily Mixes (Spotify 6-Mix Cluster) */}
      {dailyMixes.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-spotify-green" />
              <h2 className="text-2xl font-extrabold tracking-tight text-white">Made For You</h2>
            </div>
            <span className="text-xs text-spotify-gray font-semibold">Refreshes Daily</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {dailyMixes.map((mix) => (
              <div
                key={mix.id}
                onClick={() => {
                  if (onNavigateToPlaylist) {
                    onNavigateToPlaylist(mix.id);
                  } else if (mix.tracks.length > 0) {
                    playTrack(mix.tracks[0], mix.tracks, {
                      type: 'playlist',
                      id: mix.id,
                      name: mix.title,
                      cover_url: mix.cover_url,
                    });
                  }
                }}
                className="group relative bg-[#181818] hover:bg-[#282828] p-3.5 rounded-2xl transition-all cursor-pointer shadow-xl border border-white/5 hover:border-white/20 flex flex-col justify-between hover:-translate-y-1 select-none"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 bg-[#282828] shadow-md">
                  {mix.cover_url ? (
                    <img
                      src={mix.cover_url}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-700 to-purple-800 flex items-center justify-center">
                      <Music className="w-10 h-10 text-white/50" />
                    </div>
                  )}
                  {/* Spotify-style color stripe */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-spotify-green"></div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mix.tracks.length > 0) {
                        playTrack(mix.tracks[0], mix.tracks, {
                          type: 'playlist',
                          id: mix.id,
                          name: mix.title,
                          cover_url: mix.cover_url,
                        });
                      }
                    }}
                    className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-spotify-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-2xl hover:scale-105"
                    title="Play Mix"
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white group-hover:text-spotify-green transition-colors truncate">
                    {mix.title}
                  </h3>
                  <p className="text-xs text-spotify-gray line-clamp-2 mt-1 leading-relaxed">
                    {mix.description}
                  </p>
                  <div className="mt-2 text-[10px] text-white/50 font-medium">
                    {mix.tracks.length} tracks
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Official Curated Charts */}
      {featuredCharts.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-spotify-green" />
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Official Charts & Playlists
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {featuredCharts.map((chart) => (
              <div
                key={chart.id}
                onClick={() => onNavigateToPlaylist && onNavigateToPlaylist(chart.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActivePlaylistMenu({ playlist: chart, pos: { x: e.clientX, y: e.clientY } });
                }}
                className="group relative bg-gradient-to-b from-[#242424] to-[#161616] hover:from-[#303030] hover:to-[#1e1e1e] p-4 rounded-2xl transition-all cursor-pointer shadow-xl border border-white/5 hover:border-white/20 flex flex-col justify-between select-none"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 shadow-lg">
                  {chart.cover_url ? (
                    <img
                      src={chart.cover_url}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#333] flex items-center justify-center">
                      <Music className="w-10 h-10 text-white/40" />
                    </div>
                  )}
                  <button className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-spotify-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-2xl hover:scale-105">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>
                  {chart.badge && (
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white font-black text-xs border border-white/10">
                      {chart.badge}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white group-hover:text-spotify-green transition-colors">
                    {chart.title}
                  </h3>
                  <p className="text-xs text-spotify-gray mt-1 line-clamp-2 leading-relaxed">
                    {chart.description}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-white/50 font-medium">
                    <span>{chart.curator}</span>
                    <span>{chart.track_count} tracks</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popular Genres, Moods, Events & Curated Libraries */}
      {genrePlaylists.length > 0 && (
        <div className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-spotify-green" />
              <h2 className="text-2xl font-extrabold tracking-tight text-white">
                Curated Collections & Moods
              </h2>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-spotify-green text-black shadow-lg scale-105'
                      : 'bg-white/10 hover:bg-white/15 text-white/80 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {filteredPlaylists.map((genre) => (
              <div
                key={genre.id}
                onClick={() => onNavigateToPlaylist && onNavigateToPlaylist(genre.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActivePlaylistMenu({ playlist: genre, pos: { x: e.clientX, y: e.clientY } });
                }}
                className="group relative bg-[#181818] hover:bg-[#282828] p-3.5 rounded-2xl transition-all cursor-pointer shadow-xl border border-white/5 hover:border-white/20 flex flex-col justify-between hover:-translate-y-1 select-none"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 shadow-lg">
                  {genre.cover_url ? (
                    <img
                      src={genre.cover_url}
                      alt={genre.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-slate-900 flex items-center justify-center">
                      <Disc3 className="w-10 h-10 text-white/50" />
                    </div>
                  )}
                  <button className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-spotify-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-2xl hover:scale-105">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </button>
                  {genre.badge && (
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white font-black text-[11px] border border-white/10 shadow-sm">
                      {genre.badge}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white group-hover:text-spotify-green transition-colors truncate">
                    {genre.title}
                  </h3>
                  <p className="text-[11px] text-spotify-gray mt-1 line-clamp-2 leading-relaxed">
                    {genre.description}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-white/50 font-medium">
                    <span>{genre.curator}</span>
                    <span>{genre.track_count} tracks</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending Hits */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-spotify-green" />
          <h2 className="text-2xl font-bold tracking-tight">Trending & Charts</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {trending.map((t) => (
            <div
              key={t.id}
              onClick={() =>
                playTrack(t, trending, {
                  type: 'playlist',
                  id: 'trending',
                  name: 'Trending & Charts',
                })
              }
              onContextMenu={(e) => {
                e.preventDefault();
                setActiveTrackMenu({ track: t, pos: { x: e.clientX, y: e.clientY } });
              }}
              className="group bg-[#181818] hover:bg-[#282828] p-4 rounded-lg transition-all cursor-pointer flex flex-col shadow-lg select-none"
            >
              <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 bg-[#282828] shadow-md">
                {t.cover_url ? (
                  <img src={t.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-spotify-gray">
                    <Music className="w-8 h-8" />
                  </div>
                )}
                <button className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-spotify-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </button>
              </div>
              <h3 className="font-bold text-sm text-white truncate">{t.title}</h3>
              <p
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToArtist(t.artist, (t as any).artist_id);
                }}
                className="text-xs text-spotify-gray truncate mt-1 hover:underline hover:text-white cursor-pointer z-10"
                title={`View ${t.artist}`}
              >
                {t.artist}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Context Menus */}
      {activeTrackMenu && (
        <TrackContextMenu
          track={activeTrackMenu.track}
          isOpen={true}
          onClose={() => setActiveTrackMenu(null)}
          anchorPosition={activeTrackMenu.pos}
        />
      )}

      {activePlaylistMenu && (
        <PlaylistContextMenu
          playlist={activePlaylistMenu.playlist}
          isOpen={true}
          onClose={() => setActivePlaylistMenu(null)}
          anchorPosition={activePlaylistMenu.pos}
          onNavigate={() => {
            if (onNavigateToPlaylist) {
              onNavigateToPlaylist(activePlaylistMenu.playlist.id);
            }
            setActivePlaylistMenu(null);
          }}
        />
      )}
    </div>
  );
};
