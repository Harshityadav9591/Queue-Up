import { useState, useEffect, useRef, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchContentLive, getImageUrl, POSTER_FALLBACK } from '../../lib/tmdb';
import { searchPeople, followersLabel } from '../../lib/people';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';

const MAX_TITLES = 5;
const MAX_PEOPLE_MIXED = 3;
const MAX_PEOPLE_ONLY = 6;

export default function SearchDropdown({
  placeholder = 'Search movies, shows, @people',
  inputClassName = '',
  onNavigate,
  autoFocus = false,
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
    `w-full flex items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition-colors ${idx === activeIndex ? 'bg-surface' : ''}`;
  const sectionLabel = 'px-3 pt-3 pb-1.5 text-[13px] font-semibold text-muted';

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSubmit} role="search" className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
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
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={inputClassName || 'h-10 w-full rounded-full bg-surface pl-10 pr-4 text-[15px] text-ink transition-[background-color,box-shadow] duration-200 hover:bg-raised focus:bg-lift focus:shadow-[0_0_0_2px_var(--ink)] focus:outline-none'}
        />
      </form>

      {showPanel && (
        <div className="float absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden p-1.5">
          {loading && options.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">Searching…</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">
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
                              className="h-[54px] w-9 flex-shrink-0 rounded-[4px] bg-surface object-cover"
                              onError={(e) => { e.currentTarget.src = POSTER_FALLBACK; }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-semibold">{opt.item.title || opt.item.name}</p>
                              <p className="text-[13px] text-muted">
                                {(opt.item.release_date || opt.item.first_air_date || '').slice(0, 4) || 'Year unknown'}
                                {' · '}{opt.item.media_type === 'tv' ? 'Show' : 'Movie'}
                                {opt.item.vote_average > 0 && ` · ${opt.item.vote_average.toFixed(1)}`}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <Avatar url={opt.person.avatar_url} name={opt.person.nickname || opt.person.username} size="h-9 w-9 text-sm" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-semibold">{opt.person.nickname || `@${opt.person.username}`}</p>
                              <p className="truncate text-[13px] text-muted">
                                {opt.person.nickname ? `@${opt.person.username} · ` : ''}{followersLabel(opt.person.followers_count)}
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
            className="mt-1 flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-surface"
          >
            {peopleOnly ? `See all people matching “${term}”` : `See all results for “${term}”`}
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
