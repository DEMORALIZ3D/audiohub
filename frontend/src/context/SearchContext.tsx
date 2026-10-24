import type React from 'react';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import type { AlbumSummary, ArtistSummary, CuratedPlaylistSummary, Track } from '../types';

interface SearchResults {
  tracks: Track[];
  artists: ArtistSummary[];
  albums: AlbumSummary[];
  playlists: CuratedPlaylistSummary[];
  top_result?: {
    type: 'artist' | 'track' | 'album' | 'playlist';
    item: any;
  } | null;
}

type SearchFilter = 'all' | 'songs' | 'playlists' | 'artists' | 'albums';

interface SearchContextType {
  query: string;
  setQuery: (q: string) => void;
  activeFilter: SearchFilter;
  setActiveFilter: (filter: SearchFilter) => void;
  includeYouTube: boolean;
  setIncludeYouTube: (val: boolean | ((prev: boolean) => boolean)) => void;
  results: SearchResults;
  loading: boolean;
  scrollPosition: number;
  setScrollPosition: (pos: number) => void;
  clearSearch: () => void;
  hasResults: boolean;
}

const EMPTY_RESULTS: SearchResults = {
  tracks: [],
  artists: [],
  albums: [],
  playlists: [],
  top_result: null,
};

const SearchContext = createContext<SearchContextType | null>(null);

export const SearchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [query, setQueryState] = useState<string>(() => {
    try {
      return sessionStorage.getItem('audiohub_search_query') || '';
    } catch {
      return '';
    }
  });

  const [activeFilter, setActiveFilterState] = useState<SearchFilter>(() => {
    try {
      const saved = sessionStorage.getItem('audiohub_search_filter');
      if (saved && ['all', 'songs', 'playlists', 'artists', 'albums'].includes(saved)) {
        return saved as SearchFilter;
      }
    } catch {}
    return 'all';
  });

  const [includeYouTube, setIncludeYouTubeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('audiohub_include_yt_search') === 'true';
    } catch {
      return false;
    }
  });

  const [results, setResults] = useState<SearchResults>(() => {
    try {
      const saved = sessionStorage.getItem('audiohub_search_results');
      if (saved) return JSON.parse(saved);
    } catch {}
    return EMPTY_RESULTS;
  });

  const [scrollPosition, setScrollPosition] = useState<number>(() => {
    try {
      return Number(sessionStorage.getItem('audiohub_search_scroll') || 0);
    } catch {
      return 0;
    }
  });

  const [loading, setLoading] = useState<boolean>(false);
  const debounceTimerRef = useRef<number | null>(null);

  const setQuery = (newQuery: string) => {
    setQueryState(newQuery);
    try {
      sessionStorage.setItem('audiohub_search_query', newQuery);
    } catch {}
  };

  const setActiveFilter = (filter: SearchFilter) => {
    setActiveFilterState(filter);
    try {
      sessionStorage.setItem('audiohub_search_filter', filter);
    } catch {}
  };

  const setIncludeYouTube = (val: boolean | ((prev: boolean) => boolean)) => {
    setIncludeYouTubeState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('audiohub_include_yt_search', String(next));
      } catch {}
      return next;
    });
  };

  const clearSearch = () => {
    setQuery('');
    setResults(EMPTY_RESULTS);
    setScrollPosition(0);
    try {
      sessionStorage.removeItem('audiohub_search_query');
      sessionStorage.removeItem('audiohub_search_results');
      sessionStorage.removeItem('audiohub_search_scroll');
    } catch {}
  };

  // Perform search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults(EMPTY_RESULTS);
      try {
        sessionStorage.removeItem('audiohub_search_results');
      } catch {}
      return;
    }

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=30&include_yt=${includeYouTube}`)
        .then((res) => res.json())
        .then((data) => {
          const formatted: SearchResults = {
            tracks: data.tracks || [],
            artists: data.artists || [],
            albums: data.albums || [],
            playlists: data.playlists || [],
            top_result: data.top_result || null,
          };
          setResults(formatted);
          try {
            sessionStorage.setItem('audiohub_search_results', JSON.stringify(formatted));
          } catch {}
        })
        .catch((e) => console.error('Search query failed:', e))
        .finally(() => setLoading(false));
    }, 280);

    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [query, includeYouTube]);

  const hasResults =
    results.tracks.length > 0 ||
    results.artists.length > 0 ||
    results.albums.length > 0 ||
    results.playlists.length > 0 ||
    !!results.top_result;

  return (
    <SearchContext.Provider
      value={{
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
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = (): SearchContextType => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
