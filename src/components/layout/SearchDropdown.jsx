import { useState, useEffect, useRef, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchContentLive, getImageUrl } from '../../lib/tmdb';
import { searchPeople, followersLabel } from '../../lib/people';

const MAX_TITLES = 5;
const MAX_PEOPLE_MIXED = 3;
const MAX_PEOPLE_ONLY = 6;

export default function SearchDropdown({
  placeholder = 'Search movies, shows, people...',
  inputClassName = '',
  onNavigate,
}) {
  const [query, setQuery] = useState('');
  const [titles, setTitles] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const listId = useId();

  // Typing "@name" searches people only
  const trimmed = query.trim();
  const peopleOnly = trimmed.startsWith('@');
  const term = peopleOnly ? trimmed.slice(1).trim() : trimmed;

  // Debounced, abortable search: movies/shows and people at the same time
  useEffect(() => {
    if (term.length < 2) return;

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      const [titleRes, peopleRes] = await Promise.allSettled([
        peopleOnly ? Promise.resolve([]) : searchContentLive(term, controller.signal),
        searchPeople(term, peopleOnly ? MAX_PEOPLE_ONLY : MAX_PEOPLE_MIXED, controller.signal),
      ]);
      if (controller.signal.aborted) return;

      // If one of the two fails, the other still shows
      setTitles(titleRes.status === 'fulfilled' ? titleRes.value.slice(0, MAX_TITLES) : []);
      setPeople(peopleRes.status === 'fulfilled' ? peopleRes.value : []);
      setActiveIndex(-1);
      setLoading(false);
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, peopleOnly]);

  // Close when clicking outside the dropdown
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // One flat list, so the arrow keys move through titles and people together
  const options = [
    ...titles.map((item) => ({ kind: 'title', key: `${item.media_type}-${item.id}`, item })),
    ...people.map((person) => ({ kind: 'person', key: `person-${person.username}`, person })),
  ];

  const reset = () => {
    setQuery('');
    setTitles([]);
    setPeople([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const selectOption = (opt) => {
    if (opt.kind === 'title') navigate(`/${opt.item.media_type}/${opt.item.id}`);
    else navigate(`/u/${opt.person.username}`);
    reset();
    if (onNavigate) onNavigate();
  };

  const seeAll = () => {
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    reset();
    if (onNavigate) onNavigate();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeIndex >= 0 && options[activeIndex]) selectOption(options[activeIndex]);
    else seeAll();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % Math.max(options.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showPanel = open && term.length >= 2;
  const rowClass = (idx) =>
    `w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${idx === activeIndex ? 'bg-slate-100 dark:bg-white/10' : ''}`;
  const sectionLabel = 'px-4 pt-3 pb-1 text-sm font-semibold text-slate-500 dark:text-slate-400';

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          role="combobox"
          aria-label="Search movies, shows and people"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
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
        <div className="absolute top-full left-0 right-0 mt-2 z-50 overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-xl dark:shadow-none dark:ring-1 dark:ring-white/10">
          {loading && options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">Searching...</p>
          ) : options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              {peopleOnly ? `No public profiles match “${term}”` : `No results for “${term}”`}
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Search results">
              {titles.length > 0 && <li role="presentation" className={sectionLabel}>Movies and shows</li>}

              {options.map((opt, idx) => {
                // Heading for the people group, placed right before the first person
                const startsPeople = opt.kind === 'person' && idx === titles.length;

                return (
                  <li key={opt.key} role="presentation">
                    {startsPeople && <p className={sectionLabel}>People</p>}
                    <div role="option" id={`${listId}-opt-${idx}`} aria-selected={idx === activeIndex}>
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => selectOption(opt)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={rowClass(idx)}
                      >
                        {opt.kind === 'title' ? (
                          <>
                            <img
                              src={getImageUrl(opt.item.poster_path, 'w92')}
                              alt=""
                              className="w-9 h-14 rounded object-cover flex-shrink-0 bg-slate-200 dark:bg-slate-700"
                              onError={(e) => { e.target.src = '/movie-poster.jpg'; }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{opt.item.title || opt.item.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {(opt.item.release_date || opt.item.first_air_date || '').slice(0, 4) || 'N/A'}
                                {opt.item.vote_average > 0 && ` • rated ${opt.item.vote_average.toFixed(1)}`}
                              </p>
                            </div>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-[#00f0ff]/15 dark:text-[#00f0ff]">
                              {opt.item.media_type === 'tv' ? 'TV' : 'Movie'}
                            </span>
                          </>
                        ) : (
                          <>
                            {opt.person.avatar_url ? (
                              <img src={opt.person.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-slate-200 dark:bg-slate-700" />
                            ) : (
                              <span className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-900 dark:text-white flex-shrink-0">
                                {(opt.person.nickname || opt.person.username).charAt(0).toUpperCase()}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{opt.person.nickname || `@${opt.person.username}`}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {opt.person.nickname ? `@${opt.person.username} • ` : ''}{followersLabel(opt.person.followers_count)}
                              </p>
                            </div>
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={seeAll}
            className="w-full px-4 py-2.5 text-sm font-semibold text-blue-600 dark:text-[#00f0ff] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            {peopleOnly ? `See all people matching “${term}”` : `See all results for “${term}”`}
          </button>
        </div>
      )}
    </div>
  );
}
