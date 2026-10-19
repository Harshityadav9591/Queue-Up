import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getImageUrl, getMediaMeta } from '../lib/tmdb';
import MovieCard from '../components/ui/MovieCard';
import MovieCardSkeleton from '../components/ui/MovieCardSkeleton';
import { useNavigate } from 'react-router-dom';

const SORT_OPTIONS = [
  { value: 'added_desc', label: 'Recently added' },
  { value: 'added_asc', label: 'Oldest added' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'year_desc', label: 'Year (newest)' },
  { value: 'year_asc', label: 'Year (oldest)' },
  { value: 'rating_desc', label: 'Rating (high–low)' },
  { value: 'rating_asc', label: 'Rating (low–high)' },
];

// Items with a missing year/rating always sink to the bottom, regardless of direction
function sortItems(list, sortBy) {
  const [key, dir] = sortBy.split('_');
  const mult = dir === 'asc' ? 1 : -1;
  const arr = [...list];

  if (key === 'name') {
    return arr.sort(
      (a, b) => mult * (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
    );
  }

  const getVal = (item) => {
    if (key === 'year') return parseInt(item.release_year, 10);
    if (key === 'rating') return item.vote_average == null ? NaN : Number(item.vote_average);
    return new Date(item.created_at).getTime();
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

// Watchlist membership is tracked per type so a movie and a show with the same TMDB id never collide
const wlKey = (type, id) => `${type}-${id}`;

export default function QueuePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [watchlistIds, setWatchlistIds] = useState(new Set());

  // Navigation States
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' or 'completed'
  const [contentType, setContentType] = useState('movie'); // 'movie' or 'tv'
  const [sortBy, setSortBy] = useState('added_desc');

  // Backfill bookkeeping (fills missing rating/year for older rows, one at a time)
  const [backfillTick, setBackfillTick] = useState(0);
  const backfillRunning = useRef(false);
  const backfillTried = useRef(new Set());
  const mounted = useRef(true);

  const navigate = useNavigate();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      if (activeTab === 'queue') {
        // Single query fetch for 'watchlist'
        const { data, error } = await supabase
          .from('watchlist')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setItems(data);
          setWatchlistIds(new Set(data.map(r => wlKey(r.media_type || 'movie', r.movie_id))));
        } else {
          setItems([]);
          setWatchlistIds(new Set());
        }
      } else {
        // Completed Vault tab: fetch completed items and watchlist IDs in parallel
        const [completedRes, watchlistRes] = await Promise.all([
          supabase.from('completed_items').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
          supabase.from('watchlist').select('movie_id, media_type').eq('user_id', session.user.id)
        ]);

        if (completedRes.data) setItems(completedRes.data);
        else setItems([]);

        if (watchlistRes.data) {
          setWatchlistIds(new Set(watchlistRes.data.map(r => wlKey(r.media_type || 'movie', r.movie_id))));
        }
      }

      setLoading(false);
    }

    fetchItems();
  }, [activeTab, navigate]);

  // Backfill missing vote_average / release_year from TMDB, one item at a time.
  // A ref guards against two loops running at once, and a "tried" set prevents retry loops.
  useEffect(() => {
    if (loading || backfillRunning.current) return;

    const table = activeTab === 'queue' ? 'watchlist' : 'completed_items';
    const stale = items.filter(
      i => i.vote_average == null && !backfillTried.current.has(`${table}-${i.id}`)
    );
    if (stale.length === 0) return;

    backfillRunning.current = true;

    (async () => {
      for (const item of stale) {
        if (!mounted.current) break;
        backfillTried.current.add(`${table}-${item.id}`);

        const type = item.media_type || 'movie';
        const tmdbId = item.media_id || item.movie_id;
        const meta = await getMediaMeta(type, tmdbId);
        if (!meta || meta.vote_average == null) continue;

        const patch = { vote_average: meta.vote_average };
        if (!item.release_year && meta.release_year) patch.release_year = meta.release_year;

        const { error } = await supabase.from(table).update(patch).eq('id', item.id);
        if (error) {
          // Most likely a missing UPDATE policy. Stop and don't retry the rest.
          console.error('Backfill failed:', error.message);
          stale.forEach(s => backfillTried.current.add(`${table}-${s.id}`));
          break;
        }

        if (mounted.current) {
          setItems(prev => prev.map(p => (p.id === item.id ? { ...p, ...patch } : p)));
        }
      }

      backfillRunning.current = false;
      if (mounted.current) setBackfillTick(t => t + 1); // re-check in case the tab changed mid-run
    })();
  }, [items, loading, activeTab, backfillTick]);

  // Filter items instantly based on the content type toggle, then sort
  const filteredItems = items.filter(item => {
    const type = item.media_type || 'movie';
    return type === contentType;
  });
  const sortedItems = sortItems(filteredItems, sortBy);

  // Called by MovieCard when an item is removed from the watchlist (Queue tab only)
  const handleRemove = (removedId, removedType = 'movie') => {
    setItems(prev =>
      prev.filter(i => {
        const type = i.media_type || 'movie';
        return !(String(i.media_id || i.movie_id) === String(removedId) && type === removedType);
      })
    );
    setWatchlistIds(prev => {
      const next = new Set(prev);
      next.delete(wlKey(removedType, removedId));
      return next;
    });
  };

  // Called by MovieCard whenever the watchlist state of a card changes
  const handleWatchlistToggle = (toggledId, added, toggledType = 'movie') => {
    setWatchlistIds(prev => {
      const next = new Set(prev);
      if (added) next.add(wlKey(toggledType, toggledId));
      else next.delete(wlKey(toggledType, toggledId));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] p-8 pt-32 transition-colors duration-500">
      <div className="container mx-auto">

        {/* Main Tab Navigation (Queue vs Completed) */}
        <div className="flex gap-8 mb-8 border-b border-slate-200 dark:border-white/10">
          <button
            onClick={() => setActiveTab('queue')}
            className={`pb-4 text-xl font-bold transition-all ${
              activeTab === 'queue'
                ? 'text-blue-600 dark:text-[#00f0ff] border-b-2 border-blue-600 dark:border-[#00f0ff]'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Watching Queue
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`pb-4 text-xl font-bold transition-all ${
              activeTab === 'completed'
                ? 'text-blue-600 dark:text-[#00f0ff] border-b-2 border-blue-600 dark:border-[#00f0ff]'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Completed Vault
          </button>
        </div>

        {/* Content Type Toggle (Movies vs TV) + Sort */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div className="flex bg-slate-200 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-300 dark:border-white/10 w-fit transition-colors">
            <button
              onClick={() => setContentType('movie')}
              className={`px-6 py-2 rounded-md font-bold transition-all ${
                contentType === 'movie'
                  ? 'bg-white dark:bg-[#0b101e] text-blue-600 dark:text-[#00f0ff] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => setContentType('tv')}
              className={`px-6 py-2 rounded-md font-bold transition-all ${
                contentType === 'tv'
                  ? 'bg-white dark:bg-[#0b101e] text-blue-600 dark:text-[#00f0ff] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              TV & Anime
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort items"
            className="bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2 font-medium focus:outline-none focus:border-blue-500 dark:focus:border-[#00f0ff] transition-colors"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
            {[...Array(5)].map((_, index) => <MovieCardSkeleton key={`skeleton-${index}`} />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex justify-center items-center h-64 bg-white dark:bg-slate-900/40 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 transition-colors">
            <p className="text-xl font-medium text-slate-500 dark:text-slate-400">
              No {contentType === 'movie' ? 'movies' : 'TV shows'} found in this section.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
            {sortedItems.map((item) => {
              // The watchlist table uses 'movie_id', the completed table uses 'media_id'. This handles both.
              const targetId = item.media_id || item.movie_id;
              const type = item.media_type || 'movie';
              const isInWatchlist = activeTab === 'queue' || watchlistIds.has(wlKey(type, targetId));

              return (
                <MovieCard
                  key={item.id}
                  id={targetId}
                  title={item.title}
                  genre={activeTab === 'queue' ? 'In Queue' : 'Completed'}
                  releaseYear={item.release_year}
                  rating={item.vote_average}
                  posterUrl={getImageUrl(item.poster_path)}
                  posterPath={item.poster_path}
                  mediaType={type}
                  initialInWatchlist={isInWatchlist}
                  // On the Vault tab, the card button only edits the watchlist, so the card must stay visible
                  onRemoved={activeTab === 'queue' ? handleRemove : undefined}
                  onWatchlistToggle={handleWatchlistToggle}
                  linkUrl={`/${type}/${targetId}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
