import {
  Compass,
  Disc,
  Disc3,
  Flame,
  ListMusic,
  Music,
  Play,
  Search as SearchIcon,
  TrendingUp,
  Users,
  X,
  Youtube,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { AlbumContextMenu } from '../components/AlbumContextMenu';
import { PlaylistContextMenu } from '../components/PlaylistContextMenu';
import { SearchSkeleton, SkeletonBox } from '../components/SkeletonLoaders';
import { TrackRow } from '../components/TrackRow';
import { usePlayer } from '../context/PlayerContext';
import { useSearch } from '../context/SearchContext';
import { AlbumSummary, type ArtistSummary, type CuratedPlaylistSummary, Track } from '../types';

interface SearchProps {
  onSelectArtist?: (artistId: string) => void;
  onSelectAlbum?: (albumId: string) => void;
  onSelectPlaylist?: (playlistId: string) => void;
  initialQuery?: string;
}

export const Search: React.FC<SearchProps> = ({
  onSelectArtist,
  onSelectAlbum,
  onSelectPlaylist,
  initialQuery = '',
}) => {
  const { playTrack } = usePlayer();
  const {
    query,
    setQuery,
    activeFilter,
    setActiveFilter,
    includeYouTube,
    setIncludeYouTube,
    results,
    loading,
    scrollPosition,
    setScrollPosition,
    clearSearch,
    hasResults,
  } = useSearch();

  const { tracks, artists, albums, playlists, top_result: topResult } = results;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [featuredCharts, setFeaturedCharts] = useState<CuratedPlaylistSummary[]>([]);
  const [genrePlaylists, setGenrePlaylists] = useState<CuratedPlaylistSummary[]>([]);
  const [activePlaylistMenu, setActivePlaylistMenu] = useState<{
    playlist: any;
    pos: { x: number; y: number };
  } | null>(null);
  const [activeAlbumMenu, setActiveAlbumMenu] = useState<{
    album: any;
    pos: { x: number; y: number };
  } | null>(null);

  // Restore scroll position on mount
  useEffect(() => {
    if (containerRef.current && scrollPosition > 0) {
      containerRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollTop);
  };

  // Sync initial query if passed as prop
  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Load featured charts and genre playlists for instant discovery
  useEffect(() => {
    fetch('/api/v1/discovery/charts')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setFeaturedCharts(data);
      })
      .catch((e) => console.error('Failed to load featured charts', e));

    fetch('/api/v1/discovery/genres')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setGenrePlaylists(data);
      })
      .catch((e) => console.error('Failed to load genre playlists', e));
  }, []);

  // Compute prominent Top Result artist
  const normQ = query.trim().toLowerCase();
  const highlightedArtist: ArtistSummary | null =
    topResult?.type === 'artist'
      ? topResult.item
      : artists.length > 0 &&
          (artists[0].name.toLowerCase() === normQ ||
            artists[0].name.toLowerCase().startsWith(normQ) ||
            normQ.includes(artists[0].name.toLowerCase()))
        ? artists[0]
        : null;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto bg-[#121212] p-4 md:p-8 text-white flex flex-col pb-44"
    >
      {/* Search Bar Row: Input Box + YouTube Search Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 max-w-4xl pt-[max(env(safe-area-inset-top,0px),3rem)] md:pt-0">
        <div className="max-w-md w-full relative">
          <SearchIcon className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-spotify-gray" />
          <input
            type="text"
            placeholder="What do you want to play? (Artist, Song, Album...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[#242424] text-white text-sm pl-11 pr-20 py-3 rounded-full outline-none focus:ring-2 focus:ring-white transition-all placeholder:text-spotify-gray"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="p-1 text-spotify-gray hover:text-white transition"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* YouTube Toggle Button (Always visible) */}
        <button
          onClick={() => setIncludeYouTube((prev) => !prev)}
          className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 border self-start sm:self-center shadow-sm ${
            includeYouTube
              ? 'bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30'
              : 'bg-[#1e1e1e] text-spotify-gray border-white/10 hover:text-white hover:border-white/20'
          }`}
          title="Search YouTube for community playlists & channel artists (Off by default)"
        >
          <Youtube className={`w-4 h-4 ${includeYouTube ? 'text-red-400' : 'text-spotify-gray'}`} />
          <span>Search YouTube: {includeYouTube ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Filter Chips (Visible when results exist) */}
      {hasResults && (
        <div className="shrink-0 flex items-center gap-2 mb-6 overflow-x-auto py-2.5 min-h-[48px] no-scrollbar">
          {(['all', 'songs', 'playlists', 'artists', 'albums'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold capitalize transition-colors whitespace-nowrap min-h-[36px] flex items-center justify-center ${
                activeFilter === filter
                  ? 'bg-white text-black shadow-md'
                  : 'bg-[#242424] text-white hover:bg-[#2e2e2e]'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      )}

      {/* Results Content */}
      {loading && !hasResults ? (
        <SearchSkeleton />
      ) : hasResults ? (
        <div
          className={`flex flex-col gap-8 transition-opacity duration-200 ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {loading && (
            <div className="w-full h-1 overflow-hidden rounded-full bg-white/10 -mb-6">
              <SkeletonBox className="w-full h-full" />
            </div>
          )}

          {/* Spotify-style Top Result Card + Top Songs Header */}
          {activeFilter === 'all' && (highlightedArtist || topResult?.type === 'track') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-2">
              {/* Top Result Card */}
              <div className="lg:col-span-5 flex flex-col">
                <h2 className="text-xl font-bold mb-3">Top result</h2>
                {highlightedArtist ? (
                  <div
                    onClick={() => onSelectArtist && onSelectArtist(highlightedArtist.id)}
                    className="group relative flex-1 bg-[#181818] hover:bg-[#282828] p-6 rounded-2xl transition-all cursor-pointer flex flex-col justify-between shadow-xl border border-white/5 hover:border-white/10"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden mb-4 shadow-lg bg-[#242424] group-hover:scale-105 transition-transform">
                      {highlightedArtist.picture_url ? (
                        <img
                          src={highlightedArtist.picture_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">
                          🎤
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate group-hover:text-spotify-green transition-colors">
                        {highlightedArtist.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white font-bold text-xs uppercase tracking-wider">
                          Artist
                        </span>
                        {highlightedArtist.fan_count > 0 && (
                          <span className="text-xs text-spotify-gray">
                            {highlightedArtist.fan_count.toLocaleString()} fans
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : topResult?.item ? (
                  <div
                    onClick={() => playTrack(topResult.item, tracks)}
                    className="group relative flex-1 bg-[#181818] hover:bg-[#282828] p-6 rounded-2xl transition-all cursor-pointer flex flex-col justify-between shadow-xl border border-white/5 hover:border-white/10"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden mb-4 shadow-lg bg-[#242424] group-hover:scale-105 transition-transform">
                      {topResult.item.cover_url ? (
                        <img
                          src={topResult.item.cover_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">
                          🎵
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate group-hover:text-spotify-green transition-colors">
                        {topResult.item.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white font-bold text-xs uppercase tracking-wider">
                          Song
                        </span>
                        <span className="text-xs text-spotify-gray truncate">
                          {topResult.item.artist}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Top 4 Songs */}
              {tracks.length > 0 && (
                <div className="lg:col-span-7 flex flex-col">
                  <h2 className="text-xl font-bold mb-3">Songs</h2>
                  <div className="flex flex-col gap-1 bg-[#181818]/60 p-2 sm:p-3 rounded-2xl border border-white/5">
                    {tracks.slice(0, 4).map((t, idx) => (
                      <TrackRow key={t.id} track={t} index={idx} playlistContext={tracks} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Curated Playlists & Charts Section */}
          {(activeFilter === 'all' || activeFilter === 'playlists') && playlists.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                <ListMusic className="w-5 h-5 text-spotify-green" />
                <span>Playlists & Charts</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {playlists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => onSelectPlaylist && onSelectPlaylist(pl.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActivePlaylistMenu({ playlist: pl, pos: { x: e.clientX, y: e.clientY } });
                    }}
                    className="group bg-[#181818] hover:bg-[#282828] p-3.5 rounded-xl transition-all cursor-pointer flex flex-col shadow-lg border border-white/5 hover:border-white/10 select-none"
                  >
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-3 bg-[#242424] shadow-md">
                      {pl.cover_url ? (
                        <img src={pl.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-spotify-gray bg-gradient-to-br from-indigo-900/40 to-black">
                          <ListMusic className="w-10 h-10 text-white/40" />
                        </div>
                      )}
                      {pl.source_type === 'youtube' ? (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-red-600/90 text-white font-extrabold text-[10px] tracking-wider uppercase backdrop-blur-sm shadow flex items-center gap-1">
                          <Youtube className="w-3 h-3 fill-current" />
                          <span>YouTube</span>
                        </div>
                      ) : pl.is_chart ? (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-black font-extrabold text-[10px] tracking-wider uppercase backdrop-blur-sm">
                          Chart
                        </div>
                      ) : null}
                      <button className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-spotify-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </button>
                    </div>
                    <h3 className="font-bold text-sm text-white truncate">{pl.title}</h3>
                    <span className="text-xs text-spotify-gray mt-0.5 truncate">
                      {pl.curator || 'Curated'} {pl.track_count ? `• ${pl.track_count} tracks` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artists Section */}
          {(activeFilter === 'all' || activeFilter === 'artists') && artists.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-spotify-green" />
                <span>
                  {activeFilter === 'all' && highlightedArtist ? 'Related Artists' : 'Artists'}
                </span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {(activeFilter === 'all' && highlightedArtist && artists.length > 1
                  ? artists.slice(1)
                  : artists
                ).map((art) => (
                  <div
                    key={art.id}
                    onClick={() => onSelectArtist && onSelectArtist(art.id)}
                    className="group bg-[#181818] hover:bg-[#282828] p-4 rounded-xl transition-all cursor-pointer flex flex-col items-center text-center shadow-lg border border-white/5 hover:border-white/10"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden mb-3 bg-[#242424] shadow-md group-hover:scale-105 transition-transform">
                      {art.picture_url ? (
                        <img src={art.picture_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          🎤
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-white truncate w-full group-hover:text-spotify-green transition-colors">
                      {art.name}
                    </h3>
                    <div className="text-xs text-spotify-gray mt-1 flex items-center justify-center gap-1">
                      {art.source_type === 'youtube' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 font-bold border border-red-500/30 flex items-center gap-1">
                          <Youtube className="w-2.5 h-2.5" />
                          <span>YouTube</span>
                        </span>
                      ) : (
                        <span>Artist</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Albums Section */}
          {(activeFilter === 'all' || activeFilter === 'albums') && albums.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Disc className="w-5 h-5 text-spotify-green" />
                <span>Albums</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {albums.map((alb) => (
                  <div
                    key={alb.id}
                    onClick={() => onSelectAlbum && onSelectAlbum(alb.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveAlbumMenu({
                        album: {
                          id: alb.id,
                          title: alb.title,
                          artist: alb.artist,
                          cover_url: alb.cover_url,
                        },
                        pos: { x: e.clientX, y: e.clientY },
                      });
                    }}
                    className="group bg-[#181818] hover:bg-[#282828] p-3.5 rounded-xl transition-all cursor-pointer flex flex-col shadow-lg border border-white/5 hover:border-white/10 select-none"
                  >
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-3 bg-[#242424] shadow-md">
                      {alb.cover_url ? (
                        <img src={alb.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-spotify-gray">
                          <Disc className="w-8 h-8" />
                        </div>
                      )}
                      <button className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-spotify-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </button>
                    </div>
                    <h3 className="font-bold text-sm text-white truncate">{alb.title}</h3>
                    <span className="text-xs text-spotify-gray mt-0.5 truncate">{alb.artist}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Songs Section (when filter is 'songs', or when filter is 'all' and no Top Result header was rendered) */}
          {(activeFilter === 'songs' ||
            (activeFilter === 'all' && !highlightedArtist && !topResult?.type)) &&
            tracks.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-3">Songs</h2>
                <div className="flex flex-col gap-1">
                  {tracks.map((track, idx) => (
                    <TrackRow key={track.id} track={track} index={idx} playlistContext={tracks} />
                  ))}
                </div>
              </div>
            )}
        </div>
      ) : query.trim() ? (
        <div className="text-spotify-gray text-center m-auto py-12">
          <p className="text-lg">No results found for "{query}"</p>
          <p className="text-sm mt-1 text-white/40">
            Try checking spelling or searching for charts like "UK Top 40" or "Billboard 100".
          </p>
        </div>
      ) : (
        /* Default Empty Search State: Featured Charts Hub */
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-spotify-green" />
              <h2 className="text-xl font-extrabold tracking-tight text-white">
                Featured Official Charts
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {featuredCharts.map((chart) => (
                <div
                  key={chart.id}
                  onClick={() => onSelectPlaylist && onSelectPlaylist(chart.id)}
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
                        <Flame className="w-10 h-10 text-amber-400" />
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

          {/* Browse Genres & Moods */}
          {genrePlaylists.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-4">
                <Compass className="w-5 h-5 text-spotify-green" />
                <h2 className="text-xl font-extrabold tracking-tight text-white">
                  Browse Genres & Moods
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                {genrePlaylists.map((genre) => (
                  <div
                    key={genre.id}
                    onClick={() => onSelectPlaylist && onSelectPlaylist(genre.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActivePlaylistMenu({
                        playlist: genre,
                        pos: { x: e.clientX, y: e.clientY },
                      });
                    }}
                    className="group relative bg-[#181818] hover:bg-[#282828] p-3 rounded-xl transition-all cursor-pointer shadow-lg border border-white/5 hover:border-white/20 flex flex-col justify-between hover:-translate-y-1 select-none"
                  >
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2.5 shadow-md">
                      {genre.cover_url ? (
                        <img
                          src={genre.cover_url}
                          alt={genre.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-slate-900 flex items-center justify-center">
                          <Disc3 className="w-8 h-8 text-white/50" />
                        </div>
                      )}
                      <button className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-spotify-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </button>
                      {genre.badge && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-white font-black text-[10px] border border-white/10">
                          {genre.badge}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-white group-hover:text-spotify-green transition-colors truncate">
                        {genre.title}
                      </h3>
                      <p className="text-[10px] text-spotify-gray mt-0.5 line-clamp-1">
                        {genre.curator} • {genre.track_count} tracks
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Search Chips */}
          <div className="mt-4">
            <h3 className="text-xs uppercase tracking-wider text-spotify-gray font-bold mb-3">
              Popular Searches & Genres
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                'Country Hits',
                'Reggae Hits',
                'Global Dance Hits',
                'Hot Urban',
                'Rock Hits',
                'R&B Hits',
                'Afrobeats Hits',
                'Fuego Latino',
                'UK Top 40',
                'Billboard Hot 100',
                'Global Top 50',
                'Viral TikTok Hits',
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setQuery(chip)}
                  className="px-3.5 py-2 rounded-full bg-[#1e1e1e] hover:bg-[#2a2a2a] text-xs font-semibold text-white/80 hover:text-white border border-white/5 transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Playlist Context Menu */}
      {activePlaylistMenu && (
        <PlaylistContextMenu
          playlist={activePlaylistMenu.playlist}
          isOpen={true}
          onClose={() => setActivePlaylistMenu(null)}
          anchorPosition={activePlaylistMenu.pos}
          onNavigate={() => {
            if (onSelectPlaylist) onSelectPlaylist(activePlaylistMenu.playlist.id);
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
            if (onSelectAlbum) onSelectAlbum(activeAlbumMenu.album.id);
            setActiveAlbumMenu(null);
          }}
          onNavigateArtist={(artistId) => {
            if (onSelectArtist) onSelectArtist(artistId);
            setActiveAlbumMenu(null);
          }}
        />
      )}
    </div>
  );
};
