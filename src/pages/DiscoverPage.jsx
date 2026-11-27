import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDiscoverContent, getGenres, getLanguages, getImageUrl } from '../lib/tmdb';
import MovieCard from '../components/ui/MovieCard';
import MovieCardSkeleton from '../components/ui/MovieCardSkeleton';
import VirtualizedGrid from '../components/ui/VirtualizedGrid';
import MultiSelect from '../components/ui/MultiSelect';
import { supabase } from '../lib/supabase';
import Segmented from '../components/ui/Segmented';
import Icon from '../components/ui/Icon';

const SORT_OPTIONS = [
  { value: 'popularity', label: 'Most popular' },
  { value: 'rating_desc', label: 'Rating (high–low)' },
  { value: 'rating_asc', label: 'Rating (low–high)' },
  { value: 'year_desc', label: 'Year (newest)' },
  { value: 'year_asc', label: 'Year (oldest)' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
];
const SORT_VALUES = SORT_OPTIONS.map(o => o.value);

export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filter values directly from URL search parameters (multiselect arrays)
  const contentType = searchParams.get('type') || 'movie'; 
  const selectedGenre = searchParams.get('genre') ? searchParams.get('genre').split(',').filter(Boolean) : [];
  const selectedYear = searchParams.get('year') ? searchParams.get('year').split(',').filter(Boolean) : [];
  const selectedLanguage = searchParams.get('lang') ? searchParams.get('lang').split(',').filter(Boolean) : [];
  const watchlistFilter = searchParams.get('watchlist') || 'all';
  const hideWatched = searchParams.get('hideWatched') === 'true';
  const rawSort = searchParams.get('sort');
  const sortBy = SORT_VALUES.includes(rawSort) ? rawSort : 'popularity';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Metadata State
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [genres, setGenres] = useState([]);
  const [languages, setLanguages] = useState([]);

  // Pre-fetched watchlist IDs for the current user and current content type (avoids per-card DB queries)
  const [watchlistIds, setWatchlistIds] = useState(new Set());
  const [watchedIds, setWatchedIds] = useState(new Set());

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
      hideWatched,
      sort: sortBy,
      ...updated,
    };

    const newParams = {};
    if (next.type && next.type !== 'movie') newParams.type = next.type;

    const genreStr = Array.isArray(next.genre) ? next.genre.filter(Boolean).join(',') : (next.genre || '');
    const yearStr = Array.isArray(next.year) ? next.year.filter(Boolean).join(',') : (next.year || '');
    const langStr = Array.isArray(next.lang) ? next.lang.filter(Boolean).join(',') : (next.lang || '');

    if (genreStr) newParams.genre = genreStr;
    if (yearStr) newParams.year = yearStr;
    if (langStr) newParams.lang = langStr;
    if (next.watchlist && next.watchlist !== 'all') newParams.watchlist = next.watchlist;
    if (next.hideWatched) newParams.hideWatched = 'true';
    if (next.sort && next.sort !== 'popularity') newParams.sort = next.sort;

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

  const handleWatchedToggle = (id, watched) => {
    setWatchedIds(prev => {
      const next = new Set(prev);
      if (watched) next.add(id.toString());
      else next.delete(id.toString());
      return next;
    });
  };

  // Filter items based on watchlist and watched selection
  const displayItems = items.filter(item => {
    const itemId = item.id.toString();
    const matchesWatchlist = watchlistFilter !== 'not_in_watchlist' || !watchlistIds.has(itemId);
    const matchesWatched = !hideWatched || !watchedIds.has(itemId);
    return matchesWatchlist && matchesWatched;
  });

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
        const [watchlistRes, completedRes, watchedRes] = await Promise.all([
          supabase
            .from('watchlist')
            .select('movie_id, media_type')
            .eq('user_id', session.user.id),
          supabase
            .from('completed_items')
            .select('media_id')
            .eq('user_id', session.user.id)
            .eq('media_type', contentType),
          contentType === 'movie'
            ? supabase
              .from('watched_movies')
              .select('movie_id')
              .eq('user_id', session.user.id)
            : Promise.resolve({ data: [] }),
        ]);
        if (watchlistRes.data) {
          // Only keep entries of the type being browsed, so a movie and a show with the same TMDB id never collide
          setWatchlistIds(new Set(
            watchlistRes.data
              .filter(r => (r.media_type || 'movie') === contentType)
              .map(r => String(r.movie_id))
          ));
        }
        setWatchedIds(new Set([
          ...(completedRes.data || []).map(r => String(r.media_id)),
          ...(watchedRes.data || []).map(r => String(r.movie_id)),
        ]));
      } else {
        setWatchlistIds(new Set());
        setWatchedIds(new Set());
      }
    }

    fetchGenresData();
    fetchLanguagesData();
    fetchWatchlistData();
  }, [contentType]);

  // 2. Fetch Content whenever page, genre, year, language, sort, or contentType changes
  useEffect(() => {
    let isCancelled = false;

    async function fetchResults() {
      if (page === 1) {
        setLoading(true);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const data = await getDiscoverContent(contentType, page, selectedGenre, selectedYear, selectedLanguage, sortBy);
      
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
  // The filters (genre, year, language, sort) are all read from the URL, so searchParamsString already covers them.
  // Adding the derived arrays here would refetch on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, page, searchParamsString]);

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

  // The scope of the grid in words, built from the same filters the grid uses
  const typeWord = contentType === 'tv' ? 'shows and anime' : 'movies';
  const genreNames = selectedGenre.map(id => genres.find(g => String(g.id) === String(id))?.name).filter(Boolean);
  const langNames = selectedLanguage.map(code => languages.find(l => l.iso_639_1 === code)?.english_name).filter(Boolean);
  const sortedYears = [...selectedYear].map(Number).sort((a, b) => a - b);
  const yearWords = sortedYears.length === 0 ? '' : sortedYears.length === 1 ? ` from ${sortedYears[0]}` : ` from ${sortedYears[0]} to ${sortedYears[sortedYears.length - 1]}`;
  const sortWords = {
    popularity: 'Most popular', rating_desc: 'Highest rated', rating_asc: 'Lowest rated', year_desc: 'Newest',
    year_asc: 'Oldest', name_asc: 'A to Z:', name_desc: 'Z to A:',
  }[sortBy];
  const scope = `${sortWords} ${genreNames.length ? `${genreNames.join(', ')} ` : ''}${typeWord}${yearWords}${langNames.length ? ` in ${langNames.join(', ')}` : ''}`;
  const hasFilters = selectedGenre.length > 0 || selectedYear.length > 0 || selectedLanguage.length > 0 || watchlistFilter !== 'all' || hideWatched;

  return (
    <div className="wrap pt-6 sm:pt-10">

      {/* Title row: the page, its scope, and what it shows */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.035em] sm:text-[32px]">Discover</h1>
          <p className="mt-2 text-[15px] text-muted">{scope}, from TMDB.</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {hasFilters && (
            <button
              type="button"
              className="chip bg-transparent px-3 text-muted hover:text-ink"
              onClick={() => updateFilters({ genre: [], year: [], lang: [], watchlist: 'all', hideWatched: false })}
            >
              Clear filters
            </button>
          )}
          <Segmented
            label="What to browse"
            value={contentType}
            onChange={(type) => updateFilters({ type, genre: [], year: [], lang: [] })}
            options={[
              { value: 'movie', label: 'Movies' },
              { value: 'tv', label: 'TV & anime' },
            ]}
          />
        </div>
      </div>

      {/* Filter row: scrolls sideways on a phone, wraps on wider screens */}
      <div className="relative z-20 mt-6 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        <MultiSelect
          label="Genres"
          fullWidth
          placeholder="All genres"
          options={genres.map(g => ({ value: String(g.id), label: g.name }))}
          selected={selectedGenre}
          onChange={(newGenres) => updateFilters({ genre: newGenres })}
        />

        <MultiSelect
          label="Years"
          fullWidth
          placeholder="Any year"
          options={years.map(year => ({ value: String(year), label: String(year) }))}
          selected={selectedYear}
          onChange={(newYears) => updateFilters({ year: newYears })}
        />

        <MultiSelect
          label="Languages"
          fullWidth
          placeholder="Any language"
          options={languages.map(lang => ({ value: lang.iso_639_1, label: lang.english_name || lang.name }))}
          selected={selectedLanguage}
          onChange={(newLangs) => updateFilters({ lang: newLangs })}
        />

        {/* Hide what is already in your queue */}
        <button
          type="button"
          className="chip w-full justify-center gap-1.5 px-2 sm:w-auto sm:justify-start sm:gap-2 sm:px-4"
          aria-pressed={watchlistFilter === 'not_in_watchlist'}
          data-active={watchlistFilter === 'not_in_watchlist'}
          onClick={() => updateFilters({ watchlist: watchlistFilter === 'not_in_watchlist' ? 'all' : 'not_in_watchlist' })}
        >
          <Icon name={watchlistFilter === 'not_in_watchlist' ? 'check' : 'plus'} className="-ml-1" strokeWidth={2} />
          Hide queued
        </button>

        <button
          type="button"
          className="chip w-full justify-center gap-1.5 px-2 sm:w-auto sm:justify-start sm:gap-2 sm:px-4"
          aria-pressed={hideWatched}
          data-active={hideWatched}
          onClick={() => updateFilters({ hideWatched: !hideWatched })}
        >
          <Icon name={hideWatched ? 'check' : 'eye'} className="-ml-1" strokeWidth={2} />
          Hide Watched
        </button>

        {/* Sort (sorted by TMDB across all results) */}
        <select
          value={sortBy}
          onChange={(e) => updateFilters({ sort: e.target.value })}
          aria-label="Sort results"
          className="chip w-full sm:ml-auto sm:w-auto"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {[...Array(12)].map((_, index) => (
              <MovieCardSkeleton key={`skeleton-${index}`} />
            ))}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-start justify-center gap-4 rounded-[20px] bg-surface px-6 py-8 sm:px-10">
            <p className="text-lg font-semibold">
              {items.length > 0
                ? hideWatched && watchlistFilter === 'not_in_watchlist'
                  ? 'Everything loaded so far is already queued or watched.'
                  : hideWatched
                    ? 'Everything loaded so far is already marked as watched.'
                    : 'Everything loaded so far is already in your queue.'
                : 'Nothing on TMDB matches those filters.'}
            </p>
            {hasFilters && (
              <button className="btn btn-primary btn-sm" onClick={() => updateFilters({ genre: [], year: [], lang: [], watchlist: 'all', hideWatched: false })}>
                Clear filters
              </button>
            )}
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
                    genre={contentType === 'tv' ? 'Show' : 'Movie'}
                    releaseYear={year}
                    rating={item.vote_average}
                    voteCount={item.vote_count}
                    posterUrl={getImageUrl(item.poster_path, 'w342')}
                    posterPath={item.poster_path}
                    mediaType={contentType}
                    initialInWatchlist={watchlistIds.has(item.id.toString())}
                    initialIsWatched={watchedIds.has(item.id.toString())}
                    onWatchlistToggle={handleWatchlistToggle}
                    onWatchedToggle={handleWatchedToggle}
                    linkUrl={`/${contentType}/${item.id}`}
                  />
                );
              }}
            />

            {/* Bottom sentinel for infinite scroll */}
            <div ref={sentinelRef} className="my-10 flex h-16 items-center justify-center">
              {loadingMore && (
                <div className="flex items-center gap-3 text-[15px] font-semibold text-muted">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                  Loading more titles
                </div>
              )}
              {!hasMore && items.length > 0 && (
                <p className="text-[15px] text-muted">That’s the end of this list.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
