import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  const [watchedIds, setWatchedIds] = useState(new Set());
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
        const [watchlistRes, completedRes, watchedRes] = await Promise.all([
          supabase.from('watchlist').select('movie_id, media_type').eq('user_id', session.user.id),
          supabase.from('completed_items').select('media_id, media_type').eq('user_id', session.user.id),
          supabase.from('watched_movies').select('movie_id').eq('user_id', session.user.id),
        ]);
        if (watchlistRes.data) {
          setWatchlistIds(new Set(watchlistRes.data.map(r => wlKey(r.media_type || 'movie', r.movie_id))));
        }
        setWatchedIds(new Set([
          ...(completedRes.data || []).map(r => wlKey(r.media_type || 'movie', r.media_id)),
          ...(watchedRes.data || []).map(r => wlKey('movie', r.movie_id)),
        ]));
      } else {
        setWatchlistIds(new Set());
        setWatchedIds(new Set());
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

  const handleWatchedToggle = (id, watched, type = 'movie') => {
    setWatchedIds(prev => {
      const next = new Set(prev);
      if (watched) next.add(wlKey(type, id));
      else next.delete(wlKey(type, id));
      return next;
    });
  };

  const sortedResults = sortResults(results, sortBy);
  const countWords = [
    !peopleOnly && results.length > 0 ? `${results.length}${results.length >= 20 ? '+' : ''} ${results.length === 1 ? 'title' : 'titles'}` : null,
    people.length > 0 ? `${people.length} ${people.length === 1 ? 'person' : 'people'}` : null,
  ].filter(Boolean).join(' and ');

  return (
    <div className="wrap pt-6 sm:pt-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[32px]">
            <span className="text-muted">Results for </span>“{query}”
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            {loading ? 'Searching TMDB and public profiles…' : countWords ? `${countWords} found.` : 'Nothing found yet.'}
            {!peopleOnly && ' Start with @ to search people only.'}
          </p>
        </div>

        {!loading && results.length > 0 && (
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort results"
            className="chip w-fit"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* People whose public username or nickname matches */}
      {!loading && people.length > 0 && (
        <section className="mt-10" aria-labelledby="people-heading">
          <h2 id="people-heading" className="mb-4 text-xl font-bold">People</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {people.map((person, i) => (
              <div key={person.username} className="arrive" style={{ '--i': i }}>
                <PersonCard person={person} />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10">
        {!peopleOnly && !loading && results.length > 0 && people.length > 0 && (
          <h2 className="mb-4 text-xl font-bold">Movies and shows</h2>
        )}

        {loading && !peopleOnly ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {[...Array(12)].map((_, index) => (
              <MovieCardSkeleton key={`skeleton-${index}`} />
            ))}
          </div>
        ) : results.length === 0 ? (
          peopleOnly ? (
            loading ? (
              <p className="text-lg text-muted">Searching…</p>
            ) : people.length === 0 ? (
              <EmptyResult text="No public profiles match that username." />
            ) : null
          ) : (
            <EmptyResult text="No movies or shows on TMDB match that search." />
          )
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {sortedResults.map((item, i) => {
                const isTV = item.media_type === 'tv';
                const mediaType = isTV ? 'tv' : 'movie';
                const title = isTV ? item.name : item.title;
                const releaseDate = isTV ? item.first_air_date : item.release_date;
                const year = releaseDate ? releaseDate.substring(0, 4) : 'N/A';

                return (
                  // Stable key (not the array index), so cards keep their state when the sort order changes
                  <div key={wlKey(mediaType, item.id)} className="arrive" style={{ '--i': i % 12 }}>
                    <MovieCard
                      id={item.id}
                      title={title}
                      genre={isTV ? 'Show' : 'Movie'}
                      releaseYear={year}
                      rating={item.vote_average}
                      voteCount={item.vote_count}
                      posterUrl={getImageUrl(item.poster_path, 'w342')}
                      posterPath={item.poster_path}
                      mediaType={mediaType}
                      initialInWatchlist={watchlistIds.has(wlKey(mediaType, item.id))}
                      initialIsWatched={watchedIds.has(wlKey(mediaType, item.id))}
                      onWatchlistToggle={handleWatchlistToggle}
                      onWatchedToggle={handleWatchedToggle}
                      linkUrl={isTV ? `/tv/${item.id}` : `/movie/${item.id}`}
                      note={isTV ? 'Show' : undefined}
                    />
                  </div>
                );
              })}
            </div>

            {results.length >= 20 && (
              <div className="mt-12 flex justify-center">
                <Button onClick={loadMore} disabled={loadingMore} variant="quiet" size="lg">
                  {loadingMore ? 'Loading…' : 'Load more results'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyResult({ text }) {
  return (
    <div className="flex min-h-[200px] flex-col items-start justify-center gap-4 rounded-[20px] bg-surface px-6 py-8 sm:px-10">
      <p className="text-lg font-semibold">{text}</p>
      <Link to="/discover" className="btn btn-primary btn-sm">Browse Discover instead</Link>
    </div>
  );
}
