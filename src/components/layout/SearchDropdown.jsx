import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchContentLive, getImageUrl } from '../../lib/tmdb';

export default function SearchDropdown({
  placeholder = 'Search movies, shows...',
  inputClassName = '',
  onNavigate,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  // Debounced, abortable live search (2+ characters, 300ms after typing stops)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const data = await searchContentLive(q, controller.signal);
        setResults(data.slice(0, 7));
        setActiveIndex(-1);
      } catch (err) {
        if (err.name !== 'AbortError') setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close when clicking outside the dropdown
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const reset = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const selectItem = (item) => {
    navigate(`/${item.media_type}/${item.id}`);
    reset();
    if (onNavigate) onNavigate();
  };

  const seeAll = () => {
    const q = query.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    reset();
    if (onNavigate) onNavigate();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeIndex >= 0 && results[activeIndex]) selectItem(results[activeIndex]);
    else seeAll();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % Math.max(results.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={inputClassName}
        />
      </form>

      {showPanel && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 overflow-hidden rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-2xl">
          {loading && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">Searching...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              No results for “{query.trim()}”
            </p>
          ) : (
            <ul>
              {results.map((item, idx) => {
                const title = item.title || item.name;
                const year = (item.release_date || item.first_air_date || '').slice(0, 4);
                return (
                  <li key={`${item.media_type}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => selectItem(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                        idx === activeIndex ? 'bg-slate-100 dark:bg-white/10' : ''
                      }`}
                    >
                      <img
                        src={getImageUrl(item.poster_path, 'w92')}
                        alt=""
                        className="w-9 h-14 rounded object-cover flex-shrink-0 bg-slate-200 dark:bg-slate-700"
                        onError={(e) => { e.target.src = '/movie-poster.jpg'; }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {year || 'N/A'}
                          {item.vote_average > 0 && ` • ★ ${item.vote_average.toFixed(1)}`}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-[#00f0ff]/15 dark:text-[#00f0ff]">
                        {item.media_type === 'tv' ? 'TV' : 'Movie'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={seeAll}
            className="w-full px-4 py-2.5 text-sm font-semibold text-blue-600 dark:text-[#00f0ff] border-t border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            See all results for “{query.trim()}”
          </button>
        </div>
      )}
    </div>
  );
}
