import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDiscoverContent, getGenres, getLanguages, getImageUrl } from '../lib/tmdb';
import MovieCard from '../components/ui/MovieCard';
import MovieCardSkeleton from '../components/ui/MovieCardSkeleton';
import VirtualizedGrid from '../components/ui/VirtualizedGrid';
import { supabase } from '../lib/supabase';

export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filter values directly from URL search parameters (with sensible defaults)
  const contentType = searchParams.get('type') || 'movie'; 
  const selectedGenre = searchParams.get('genre') || '';
  const selectedYear = searchParams.get('year') || '';
  const selectedLanguage = searchParams.get('lang') || '';
  const watchlistFilter = searchParams.get('watchlist') || 'all';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Metadata State
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [genres, setGenres] = useState([]);
  const [languages, setLanguages] = useState([]);

  // Pre-fetched watchlist IDs for the current user (avoids per-card DB queries)
  const [watchlistIds, setWatchlistIds] = useState(new Set());

  // Infinite Scroll Sentinel Ref
  const sentinelRef = useRef(null);

  // Helper to update URL search parameters
  const updateFilters = (updated) => {
    const next = {
      type: contentType,
      genre: selectedGenre,
      year: selectedYear,
      lang: selectedLanguage,
      watchlist: watchlistFilter,
      ...updated,
    };

    const newParams = {};
    if (next.type && next.type !== 'movie') newParams.type = next.type;
    if (next.genre) newParams.genre = next.genre;
    if (next.year) newParams.year = next.year;
    if (next.lang) newParams.lang = next.lang;
    if (next.watchlist && next.watchlist !== 'all') newParams.watchlist = next.watchlist;

    setSearchParams(newParams, { replace: true });
  };

  // Reset pagination page to 1 whenever URL search params change
  const searchParamsString = searchParams.toString();
  const prevParamsRef = useRef(searchParamsString);
  useEffect(() => {
    if (prevParamsRef.current !== searchParamsString) {
      prevParamsRef.current = searchParamsString;
      setPage(1);
    }
  }, [searchParamsString]);

  // Always scroll to top when Discover page mounts or filters change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [searchParamsString]);

  // Callback to sync watchlist state dynamically when user adds/removes items
  const handleWatchlistToggle = (id, added) => {
    setWatchlistIds(prev => {
      const next = new Set(prev);
      if (added) {
        next.add(id.toString());
      } else {
        next.delete(id.toString());
      }
      return next;
    });
  };

  // Filter items based on watchlist selection
  const displayItems = watchlistFilter === 'not_in_watchlist'
    ? items.filter(item => !watchlistIds.has(item.id.toString()))
    : items;

  // 1. Fetch Genres + Languages + user's watchlist IDs whenever contentType changes
  useEffect(() => {
    async function fetchGenresData() {
      const genreData = await getGenres(contentType);
      setGenres(genreData);
    }

    async function fetchLanguagesData() {
      const langData = await getLanguages();
      setLanguages(langData);
    }

    async function fetchWatchlistData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: wlData } = await supabase
          .from('watchlist')
          .select('movie_id')
          .eq('user_id', session.user.id);
        if (wlData) {
          setWatchlistIds(new Set(wlData.map(r => String(r.movie_id))));
        }
      }
    }

    fetchGenresData();
    fetchLanguagesData();
    fetchWatchlistData();
  }, [contentType]);

  // 2. Fetch Content whenever page, genre, year, language, or contentType changes
  useEffect(() => {
    let isCancelled = false;

    async function fetchResults() {
      if (page === 1) {
        setLoading(true);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const data = await getDiscoverContent(contentType, page, selectedGenre, selectedYear, selectedLanguage);
      
      if (isCancelled) return;

      const newResults = data || [];
      
      if (newResults.length < 20) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      if (page === 1) {
        setItems(newResults);
      } else {
        setItems(prevItems => [...prevItems, ...newResults]);
      }
      
      setLoading(false);
      setLoadingMore(false);
    }
    
    fetchResults();

    return () => {
      isCancelled = true;
    };
  }, [contentType, page, selectedGenre, selectedYear, selectedLanguage]);

  // 3. Infinite Scroll Observer
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage(prevPage => prevPage + 1);
        }
      },
      { rootMargin: '400px' }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [loading, loadingMore, hasMore]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] p-8 pt-32 transition-colors duration-500">
      <div className="container mx-auto">
        
        {/* Header & Type Toggle */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white transition-colors">
            Discover <span className="text-blue-600 dark:text-[#00f0ff]">Entertainment</span>
          </h1>
          
          {/* Movies vs TV Shows Toggle Switch */}
          <div className="flex bg-slate-200 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-300 dark:border-white/10 transition-colors">
            <button
              onClick={() => updateFilters({ type: 'movie', genre: '', year: '', lang: '' })}
              className={`px-6 py-2 rounded-md font-bold transition-all ${
                contentType === 'movie' 
                  ? 'bg-white dark:bg-[#0b101e] text-blue-600 dark:text-[#00f0ff] shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => updateFilters({ type: 'tv', genre: '', year: '', lang: '' })}
              className={`px-6 py-2 rounded-md font-bold transition-all ${
                contentType === 'tv' 
                  ? 'bg-white dark:bg-[#0b101e] text-blue-600 dark:text-[#00f0ff] shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              TV & Anime
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <select 
            value={selectedGenre} 
            onChange={(e) => updateFilters({ genre: e.target.value })}
            className="bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 dark:focus:border-[#00f0ff] shadow-sm transition-colors"
          >
            <option value="">All Genres</option>
            {genres.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          <select 
            value={selectedYear} 
            onChange={(e) => updateFilters({ year: e.target.value })}
            className="bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 dark:focus:border-[#00f0ff] shadow-sm transition-colors"
          >
            <option value="">All Years</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <select 
            value={selectedLanguage} 
            onChange={(e) => updateFilters({ lang: e.target.value })}
            className="bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 dark:focus:border-[#00f0ff] shadow-sm transition-colors"
          >
            <option value="">All Languages</option>
            {languages.map(lang => (
              <option key={lang.iso_639_1} value={lang.iso_639_1}>
                {lang.english_name || lang.name}
              </option>
            ))}
          </select>

          {/* Watchlist Filter Dropdown */}
          <select 
            value={watchlistFilter} 
            onChange={(e) => updateFilters({ watchlist: e.target.value })}
            className="bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 dark:focus:border-[#00f0ff] shadow-sm transition-colors"
          >
            <option value="all">All Content</option>
            <option value="not_in_watchlist">Not in My Queue</option>
          </select>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
            {[...Array(10)].map((_, index) => (
              <MovieCardSkeleton key={`skeleton-${index}`} />
            ))}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="flex justify-center items-center h-64 bg-white dark:bg-slate-900/40 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 transition-colors">
            <p className="text-xl font-medium text-slate-500 dark:text-slate-400">
              {items.length > 0 
                ? "All loaded items are already in your queue." 
                : "No content found matching those filters."}
            </p>
          </div>
        ) : (
          <>
            <VirtualizedGrid
              items={displayItems}
              itemKey={(item, index) => `${item.id}-${index}`}
              renderItem={(item) => {
                const title = item.title || item.name;
                const releaseDate = item.release_date || item.first_air_date;
                const year = releaseDate ? releaseDate.substring(0, 4) : 'N/A';

                return (
                  <MovieCard 
                    id={item.id} 
                    title={title} 
                    genre={contentType === 'tv' ? 'TV Show' : 'Movie'} 
                    releaseYear={year} 
                    posterUrl={getImageUrl(item.poster_path)}
                    posterPath={item.poster_path}
                    mediaType={contentType}
                    initialInWatchlist={watchlistIds.has(item.id.toString())}
                    onWatchlistToggle={handleWatchlistToggle}
                    linkUrl={`/${contentType}/${item.id}`} 
                  />
                );
              }}
            />

            {/* Bottom Sentinel for Infinite Scroll */}
            <div ref={sentinelRef} className="h-16 my-8 flex justify-center items-center">
              {loadingMore && (
                <div className="flex items-center gap-3 text-blue-600 dark:text-[#00f0ff] font-bold">
                  <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Loading more content...</span>
                </div>
              )}
              {!hasMore && items.length > 0 && (
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  🎉 You've reached the end of the list!
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}