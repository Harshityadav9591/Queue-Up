import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getImageUrl, getMediaMeta } from '../lib/tmdb';
import MovieCard from '../components/ui/MovieCard';
import MovieCardSkeleton from '../components/ui/MovieCardSkeleton';

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
const typeOf = (item) => item.media_type || 'movie';

// The four lists, each one a count card that also filters the grid
const VIEWS = [
  { tab: 'queue', type: 'movie', label: 'Movies to watch', empty: 'No movies in your queue yet.' },
  { tab: 'queue', type: 'tv', label: 'Shows to watch', empty: 'No shows in your queue yet.' },
  { tab: 'completed', type: 'movie', label: 'Movies completed', empty: 'No completed movies yet. Mark one as watched on its page.' },
  { tab: 'completed', type: 'tv', label: 'Shows completed', empty: 'No completed shows yet. Tick the last episode of a finished series and it lands here.' },
];

const watchedNote = (n) => (n === 1 ? 'Watched twice' : n > 1 ? `Watched ${n + 1}×` : undefined);

export default function QueuePage() {
  const [lists, setLists] = useState({ queue: [], completed: [] });
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

  // Both lists load together, so every count card is right from the start and switching is instant
  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      const [watchlistRes, completedRes] = await Promise.all([
        supabase.from('watchlist').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('completed_items').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      ]);
      if (!mounted.current) return;

      const queue = !watchlistRes.error && watchlistRes.data ? watchlistRes.data : [];
      setLists({ queue, completed: completedRes.data || [] });
      setWatchlistIds(new Set(queue.map(r => wlKey(typeOf(r), r.movie_id))));
      setLoading(false);
    }

    fetchItems();
  }, [navigate]);

  const items = lists[activeTab];

  // Backfill missing vote_average / release_year from TMDB, one item at a time.
  // A ref guards against two loops running at once, and a "tried" set prevents retry loops.
  useEffect(() => {
    if (loading || backfillRunning.current) return;

    const tab = activeTab;
    const table = tab === 'queue' ? 'watchlist' : 'completed_items';
    const stale = items.filter(
      i => i.vote_average == null && !backfillTried.current.has(`${table}-${i.id}`)
    );
    if (stale.length === 0) return;

    backfillRunning.current = true;

    (async () => {
      for (const item of stale) {
        if (!mounted.current) break;
        backfillTried.current.add(`${table}-${item.id}`);

        const tmdbId = item.media_id || item.movie_id;
        const meta = await getMediaMeta(typeOf(item), tmdbId);
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
          setLists(prev => ({ ...prev, [tab]: prev[tab].map(p => (p.id === item.id ? { ...p, ...patch } : p)) }));
        }
      }

      backfillRunning.current = false;
      if (mounted.current) setBackfillTick(t => t + 1); // re-check in case the tab changed mid-run
    })();
  }, [items, loading, activeTab, backfillTick]);

  // Filter items instantly by the selected card, then sort
  const filteredItems = items.filter(item => typeOf(item) === contentType);
  const sortedItems = sortItems(filteredItems, sortBy);

  // Called by MovieCard when an item is removed from the watchlist (Queue tab only)
  const handleRemove = (removedId, removedType = 'movie') => {
    setLists(prev => ({
      ...prev,
      queue: prev.queue.filter(i => !(String(i.media_id || i.movie_id) === String(removedId) && typeOf(i) === removedType)),
    }));
    setWatchlistIds(prev => {
      const next = new Set(prev);
      next.delete(wlKey(removedType, removedId));
      return next;
    });
  };

  // Called by MovieCard whenever the watchlist state of a card changes.
  // On the Completed cards this keeps the "to watch" counts in step without a reload.
  const handleWatchlistToggle = (toggledId, added, toggledType = 'movie') => {
    setWatchlistIds(prev => {
      const next = new Set(prev);
      if (added) next.add(wlKey(toggledType, toggledId));
      else next.delete(wlKey(toggledType, toggledId));
      return next;
    });
    if (activeTab !== 'completed') return;
    setLists(prev => {
      const isRow = (r) => String(r.movie_id) === String(toggledId) && typeOf(r) === toggledType;
      if (!added) return { ...prev, queue: prev.queue.filter(r => !isRow(r)) };
      if (prev.queue.some(isRow)) return prev;
      const source = prev.completed.find(c => String(c.media_id) === String(toggledId) && typeOf(c) === toggledType);
      if (!source) return prev;
      const row = { ...source, id: `local-${toggledType}-${toggledId}`, movie_id: String(toggledId), created_at: new Date().toISOString() };
      return { ...prev, queue: [row, ...prev.queue] };
    });
  };

  const handleWatchedToggle = (toggledId, watched, toggledType = 'movie') => {
    if (watched && activeTab === 'queue') {
      const queueItem = lists.queue.find(item =>
        String(item.movie_id) === String(toggledId) && typeOf(item) === toggledType
      );
      handleRemove(toggledId, toggledType);
      if (queueItem) {
        const completedItem = {
          id: `local-completed-${toggledType}-${toggledId}`,
          media_id: String(toggledId),
          media_type: toggledType,
          title: queueItem.title,
          poster_path: queueItem.poster_path,
          release_year: queueItem.release_year,
          vote_average: queueItem.vote_average,
          rewatch_count: 0,
          created_at: new Date().toISOString(),
        };
        setLists(prev => ({
          ...prev,
          completed: [
            completedItem,
            ...prev.completed.filter(item =>
              !(String(item.media_id) === String(toggledId) && typeOf(item) === toggledType)
            ),
          ],
        }));
      }
    } else if (!watched && activeTab === 'completed') {
      setLists(prev => ({
        ...prev,
        completed: prev.completed.filter(item => {
          const type = typeOf(item);
          const id = item.media_id || item.movie_id;
          return !(String(id) === String(toggledId) && type === toggledType);
        }),
      }));
    }
  };

  const count = (tab, type) => lists[tab].filter(i => typeOf(i) === type).length;
  const waiting = lists.queue.length;
  const done = lists.completed.length;
  const view = VIEWS.find(v => v.tab === activeTab && v.type === contentType);

  return (
    <div className="wrap pt-6 sm:pt-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.035em] sm:text-[32px]">Your queue</h1>
          <p className="mt-2 text-[15px] text-muted">
            {loading
              ? 'Loading your lists…'
              : `${waiting} ${waiting === 1 ? 'title' : 'titles'} waiting to be watched, ${done} in your Completed Vault.`}
          </p>
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort items"
          className="chip w-fit"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Count cards: each is a list, the selected one filters the grid */}
      <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4" role="group" aria-label="Which list">
        {VIEWS.map(v => {
          const on = v.tab === activeTab && v.type === contentType;
          return (
            <button
              key={v.label}
              type="button"
              aria-pressed={on}
              onClick={() => { setActiveTab(v.tab); setContentType(v.type); }}
              className={`rounded-[16px] px-4 py-3.5 text-left transition-[background-color,transform] duration-300 active:scale-[0.98] ${
                on ? 'bg-lift outline outline-[1.5px] -outline-offset-[1.5px] outline-ink' : 'bg-surface hover:bg-raised'
              }`}
            >
              <span className="block text-[13px] text-muted">{v.label}</span>
              {loading ? (
                <span className="skeleton mt-1.5 block h-7 w-10 rounded-md bg-raised" />
              ) : (
                <span className="num mt-0.5 block text-[26px] font-bold leading-tight tracking-[-0.02em]">{count(v.tab, v.type)}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {[...Array(6)].map((_, index) => <MovieCardSkeleton key={`skeleton-${index}`} />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-start justify-center gap-4 rounded-[20px] bg-surface px-6 py-8 sm:px-10">
            <p className="text-lg font-semibold">{view.empty}</p>
            <Link to={`/discover${contentType === 'tv' ? '?type=tv' : ''}`} className="btn btn-primary btn-sm">
              Find {contentType === 'tv' ? 'a show' : 'a movie'} on Discover
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {sortedItems.map((item, i) => {
              // The watchlist table uses 'movie_id', the completed table uses 'media_id'. This handles both.
              const targetId = item.media_id || item.movie_id;
              const type = typeOf(item);
              const isInWatchlist = activeTab === 'queue' || watchlistIds.has(wlKey(type, targetId));

              return (
                <div key={item.id} className="arrive" style={{ '--i': i % 12 }}>
                  <MovieCard
                    id={targetId}
                    title={item.title}
                    genre={activeTab === 'queue' ? 'In queue' : 'Completed'}
                    releaseYear={item.release_year}
                    rating={item.vote_average}
                    posterUrl={getImageUrl(item.poster_path, 'w342')}
                    posterPath={item.poster_path}
                    mediaType={type}
                    initialInWatchlist={isInWatchlist}
                    initialIsWatched={activeTab === 'completed'}
                    // On the Vault cards, the card button only edits the watchlist, so the card must stay visible
                    onRemoved={activeTab === 'queue' ? handleRemove : undefined}
                    onWatchlistToggle={handleWatchlistToggle}
                    onWatchedToggle={handleWatchedToggle}
                    linkUrl={`/${type}/${targetId}`}
                    note={activeTab === 'completed' ? watchedNote(item.rewatch_count || 0) : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
