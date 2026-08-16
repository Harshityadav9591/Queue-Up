import { useEffect, useState } from 'react';
import { getDiscoverContent, getGenres, getImageUrl } from '../lib/tmdb'; // Note the updated import
import MovieCard from '../components/ui/MovieCard';
import MovieCardSkeleton from '../components/ui/MovieCardSkeleton';
import Button from '../components/ui/Button';
import { supabase } from '../lib/supabase';

export default function DiscoverPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // New State for Content Type ('movie' or 'tv')
  const [contentType, setContentType] = useState('movie'); 

  // Pagination & Filter State
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  // Pre-fetched watchlist IDs for the current user (avoids per-card DB queries)
  const [watchlistIds, setWatchlistIds] = useState(new Set());

  // 1. Fetch Genres + user's watchlist IDs whenever contentType changes
  useEffect(() => {
    async function fetchGenresData() {
      const genreData = await getGenres(contentType);
      setGenres(genreData);
      // Reset filters when switching types
      setSelectedGenre('');
      setSelectedYear('');
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
    fetchWatchlistData();
  }, [contentType]);

  // 2. Fetch Content whenever page, genre, year, or contentType changes
  useEffect(() => {
    async function fetchResults() {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      const data = await getDiscoverContent(contentType, page, selectedGenre, selectedYear);
      
      if (page === 1) {
        setItems(data || []);
      } else {
        setItems(prevItems => [...prevItems, ...(data || [])]);
      }
      
      setLoading(false);
      setLoadingMore(false);
    }
    
    fetchResults();
  }, [contentType, page, selectedGenre, selectedYear]);

  // Handlers
  const loadMore = () => setPage(p => p + 1);

  const handleGenreChange = (e) => {
    setSelectedGenre(e.target.value);
    setPage(1);
  };

  const handleYearChange = (e) => {
    setSelectedYear(e.target.value);
    setPage(1);
  };

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
              onClick={() => { setContentType('movie'); setPage(1); }}
              className={`px-6 py-2 rounded-md font-bold transition-all ${
                contentType === 'movie' 
                  ? 'bg-white dark:bg-[#0b101e] text-blue-600 dark:text-[#00f0ff] shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => { setContentType('tv'); setPage(1); }}
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
            onChange={handleGenreChange}
            className="bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 dark:focus:border-[#00f0ff] shadow-sm transition-colors"
          >
            <option value="">All Genres</option>
            {genres.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          <select 
            value={selectedYear} 
            onChange={handleYearChange}
            className="bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 dark:focus:border-[#00f0ff] shadow-sm transition-colors"
          >
            <option value="">All Years</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
            {[...Array(10)].map((_, index) => (
              <MovieCardSkeleton key={`skeleton-${index}`} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex justify-center items-center h-64 bg-white dark:bg-slate-900/40 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 transition-colors">
            <p className="text-xl font-medium text-slate-500 dark:text-slate-400">
              No content found matching those filters.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
              {items.map((item, index) => {
                // TV Shows use 'name' and 'first_air_date', Movies use 'title' and 'release_date'
                const title = item.title || item.name;
                const releaseDate = item.release_date || item.first_air_date;
                const year = releaseDate ? releaseDate.substring(0, 4) : 'N/A';
                
                return (
                  <MovieCard 
                    key={`${item.id}-${index}`}
                    id={item.id} 
                    title={title} 
                    genre={contentType === 'tv' ? 'TV Show' : 'Movie'} 
                    releaseYear={year} 
                    posterUrl={getImageUrl(item.poster_path)}
                    posterPath={item.poster_path}
                    mediaType={contentType}
                    initialInWatchlist={watchlistIds.has(item.id.toString())}
                    // Important: Passing the type so your details page knows what to fetch later
                    linkUrl={`/${contentType}/${item.id}`} 
                  />
                );
              })}
            </div>

            <div className="flex justify-center mt-12 pb-8">
              <Button 
                onClick={loadMore} 
                disabled={loadingMore}
                className="bg-blue-600 dark:bg-[#00f0ff] text-white dark:text-[#0b101e] hover:bg-blue-700 dark:hover:bg-[#00c0cc] px-10 py-3 font-bold shadow-md transition-all"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}