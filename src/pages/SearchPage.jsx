import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchContent, getImageUrl } from '../lib/tmdb';
import MovieCard from '../components/ui/MovieCard';
import MovieCardSkeleton from '../components/ui/MovieCardSkeleton';
import Button from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { searchPeople } from '../lib/people';
import PersonCard from '../components/people/PersonCard';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Best match' },
  { value: 'rating_desc', label: 'Rating (high–low)' },
  { value: 'rating_asc', label: 'Rating (low–high)' },
  { value: 'year_desc', label: 'Year (newest)' },
  { value: 'year_asc', label: 'Year (oldest)' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
];

// Watchlist membership is tracked per type so a movie and a show with the same TMDB id never collide
const wlKey = (type, id) => `${type}-${id}`;

const getTitle = (item) => (item.media_type === 'tv' ? item.name : item.title) || '';

const getYear = (item) => {
  const date = item.media_type === 'tv' ? item.first_air_date : item.release_date;
  return date ? parseInt(date.substring(0, 4), 10) : NaN;
};

// TMDB's multi-search has no sort option, so this sorts the results loaded so far.
// Items with a missing year, or too few votes to have a meaningful rating, always sink to the bottom.
function sortResults(list, sortBy) {
  if (sortBy === 'relevance') return list;

  const [key, dir] = sortBy.split('_');
  const mult = dir === 'asc' ? 1 : -1;
  const arr = [...list];

  if (key === 'name') {
    return arr.sort((a, b) => mult * getTitle(a).localeCompare(getTitle(b), undefined, { sensitivity: 'base' }));
  }

  const getVal = (item) => {
    if (key === 'year') return getYear(item);
    return item.vote_count >= 10 ? Number(item.vote_average) : NaN;
  };

  return arr.sort((a, b) => {
    const av = getVal(a);
    const bv = getVal(b);
    const aMissing = Number.isNaN(av);
    const bMissing = Number.isNaN(bv);
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return mult * (av - bv);
  });
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState(new Set());
  const [sortBy, setSortBy] = useState('relevance');
  const [people, setPeople] = useState([]);

  // Typing "@name" searches people only
  const trimmedQuery = (query || '').trim();
  const peopleOnly = trimmedQuery.startsWith('@');
  const term = peopleOnly ? trimmedQuery.slice(1).trim() : trimmedQuery;

  useEffect(() => {
    async function fetchWatchlist() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: wlData } = await supabase
          .from('watchlist')
          .select('movie_id, media_type')
          .eq('user_id', session.user.id);
        if (wlData) {
          setWatchlistIds(new Set(wlData.map(r => wlKey(r.media_type || 'movie', r.movie_id))));
        }
      }
    }
    fetchWatchlist();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchResults() {
      if (!query) return;
      setLoading(true);
      setPage(1);

      // "@name" searches people only
      const text = query.trim();
      const onlyPeople = text.startsWith('@');
      const searchTerm = onlyPeople ? text.slice(1).trim() : text;

      const [data, found] = await Promise.all([
        onlyPeople ? Promise.resolve([]) : searchContent(searchTerm, 1),
        searchPeople(searchTerm, 8),
      ]);
      if (cancelled) return;

      setResults(data || []);
      setPeople(found);
      setLoading(false);
    }

    fetchResults();
    return () => { cancelled = true; };
  }, [query]);

  const loadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    const data = await searchContent(term, nextPage);
    // Skip anything already shown, so card keys stay unique
    setResults(prev => {
      const seen = new Set(prev.map(r => wlKey(r.media_type, r.id)));
      return [...prev, ...data.filter(r => !seen.has(wlKey(r.media_type, r.id)))];
    });
    setPage(nextPage);
    setLoadingMore(false);
  };

  // Keep the watchlist lookup in sync when a card's quick-add button is used
  const handleWatchlistToggle = (id, added, type = 'movie') => {
    setWatchlistIds(prev => {
      const next = new Set(prev);
      if (added) next.add(wlKey(type, id));
      else next.delete(wlKey(type, id));
      return next;
    });
  };

  const sortedResults = sortResults(results, sortBy);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] p-8 pt-32 transition-colors duration-500">
      <div className="container mx-auto">
        <div className="mb-10 border-b border-slate-200 dark:border-white/10 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white transition-colors">
            Search Results for <span className="text-blue-600 dark:text-[#00f0ff]">"{query}"</span>
          </h1>

          {!loading && results.length > 0 && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort results"
              className="bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:border-blue-500 dark:focus:border-[#00f0ff] transition-colors w-fit"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
        </div>
        
        {/* People whose public username or nickname matches */}
        {!loading && people.length > 0 && (
          <section className="mb-12" aria-labelledby="people-heading">
            <h2 id="people-heading" className="text-2xl font-bold text-slate-900 dark:text-white mb-4">People</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {people.map((person) => (
                <PersonCard key={person.username} person={person} />
              ))}
            </div>
          </section>
        )}

        {loading && !peopleOnly ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
            {[...Array(10)].map((_, index) => (
              <MovieCardSkeleton key={`skeleton-${index}`} />
            ))}
          </div>
        ) : results.length === 0 ? (
          peopleOnly ? (
            loading ? (
              <p className="text-lg text-slate-500 dark:text-slate-400">Searching...</p>
            ) : people.length === 0 ? (
              <div className="flex justify-center items-center h-64 bg-slate-100 dark:bg-slate-900/40 rounded-xl transition-colors">
                <p className="text-xl font-medium text-slate-500 dark:text-slate-400">
                  No public profiles match that username.
                </p>
              </div>
            ) : null
          ) : (
            <div className="flex justify-center items-center h-64 bg-slate-100 dark:bg-slate-900/40 rounded-xl transition-colors">
              <p className="text-xl font-medium text-slate-500 dark:text-slate-400">
                No movies or TV shows found for that search.
              </p>
            </div>
          )
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
              {sortedResults.map((item) => {
                const isTV = item.media_type === 'tv';
                const mediaType = isTV ? 'tv' : 'movie';
                const title = isTV ? item.name : item.title;
                const releaseDate = isTV ? item.first_air_date : item.release_date;
                const year = releaseDate ? releaseDate.substring(0, 4) : 'N/A';
                
                return (
                  <MovieCard 
                    // Stable key (not the array index), so cards keep their state when the sort order changes
                    key={wlKey(mediaType, item.id)}
                    id={item.id} 
                    title={title} 
                    genre={isTV ? 'TV Show' : 'Movie'} 
                    releaseYear={year} 
                    rating={item.vote_average}
                    voteCount={item.vote_count}
                    posterUrl={getImageUrl(item.poster_path)} 
                    posterPath={item.poster_path}
                    mediaType={mediaType}
                    initialInWatchlist={watchlistIds.has(wlKey(mediaType, item.id))}
                    onWatchlistToggle={handleWatchlistToggle}
                    linkUrl={isTV ? `/tv/${item.id}` : `/movie/${item.id}`} 
                  />
                );
              })}
            </div>

            {results.length >= 20 && (
              <div className="flex justify-center mt-12 pb-8">
                <Button 
                  onClick={loadMore} 
                  disabled={loadingMore}
                  className="bg-blue-600 dark:bg-[#00f0ff] text-white dark:text-[#0b101e] hover:bg-blue-700 dark:hover:bg-[#00c0cc] px-10 py-3 font-bold transition-colors"
                >
                  {loadingMore ? 'Loading...' : 'Load More Results'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
