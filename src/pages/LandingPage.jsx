import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { searchContentLive, getImageUrl, POSTER_FALLBACK } from '../lib/tmdb';
import { REEL, tmdbImage } from '../lib/reel';
import { toggleTheme, useTheme } from '../lib/theme';
import { useScrollReveal } from '../hooks/useScrollReveal';
import Wordmark from '../components/ui/Mark';
import Icon from '../components/ui/Icon';
import { TMDB_NOTICE } from '../components/layout/Footer';

const CUE_EVERY_MS = 3600;
const EXAMPLES = ['past lives', 'frieren', 'the bear'];

const FAQ = [
  ['Is Queue Up free?', 'Yes. There is no premium plan and no limit on how much you track.'],
  ['Where do the titles come from?', 'From TMDB, The Movie Database: posters, cast, ratings, seasons and episode lists for movies, TV and anime. Queue Up does not stream anything; it keeps track of what you watch elsewhere.'],
  ['Can I track anime?', 'Yes. Anime sits with TV, so you tick episodes and seasons the same way. Filter Discover by Japanese to browse it on its own.'],
  ['Who can see my lists?', 'Only you, until you choose a username and switch your profile to public. Then anyone with your link can see your queue, completed list, favorites and watch time, and follow you. Your email is never shown.'],
  ['How is watch time counted?', 'From the runtime of every movie and episode you mark as watched, plus any rewatches you log. It is totalled for all time, this year and this month, and a month counts as 30 days.'],
  ['What if I watch something twice?', 'Once a title is in your Completed Vault, press Watched again on its page. Each rewatch adds to the count and to your watch time.'],
];

// ---------- The reel: which title is cued in the sentence ----------
function useReel() {
  const [type, setType] = useState('movie');
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const list = REEL[type];

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % list.length), CUE_EVERY_MS);
    return () => clearInterval(timer);
  }, [paused, list.length, type]);

  // Backdrops load as they are cued: the current one and the one after it, never all sixteen at once
  const [loaded, setLoaded] = useState(() => new Set(['movie-0', 'movie-1']));
  useEffect(() => {
    setLoaded((prev) => {
      const next = new Set(prev);
      next.add(`${type}-${index}`);
      next.add(`${type}-${(index + 1) % list.length}`);
      return next.size === prev.size ? prev : next;
    });
  }, [type, index, list.length]);

  return {
    type,
    list,
    index,
    isLoaded: (i) => loaded.has(`${type}-${i}`),
    current: list[index],
    setPaused,
    step: (d) => setIndex((i) => (i + d + list.length) % list.length),
    switchType: (t) => { setType(t); setIndex(0); },
  };
}

// The picture that stands in for the title in "Queue up ___ next."
function Slot({ reel }) {
  return (
    <span className="slot" aria-hidden="true">
      {reel.list.map((item, i) => reel.isLoaded(i) && (
        <img
          key={`${reel.type}-${item.id}`}
          src={tmdbImage(item.backdrop, 'w780')}
          alt=""
          className={i === reel.index ? 'is-on' : ''}
        />
      ))}
    </span>
  );
}

// ---------- Three working controls laid on the sentence ----------
function CueChip({ reel, className = '' }) {
  const { current } = reel;
  return (
    <div data-ui className={`hero-chip flex items-center gap-3 py-2.5 pl-2.5 pr-2 ${className}`}>
      <img src={tmdbImage(current.poster, 'w92')} alt="" className="h-[54px] w-9 flex-none rounded-[4px] object-cover" />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="text-[13px] text-muted">Now cued</p>
        <p className="truncate text-[15px] font-semibold leading-snug">{current.title}</p>
        <p className="text-[13px] text-muted">{current.year} · {current.length}</p>
      </div>
      <div className="flex flex-none">
        <button type="button" onClick={() => reel.step(-1)} className="icon-btn h-9 w-9" aria-label="Cue the previous title">
          <Icon name="chevronLeft" className="h-[18px] w-[18px]" />
        </button>
        <button type="button" onClick={() => reel.step(1)} className="icon-btn h-9 w-9" aria-label="Cue the next title">
          <Icon name="chevronRight" className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}

function TypeChip({ reel, className = '' }) {
  return (
    <div data-ui className={`hero-chip flex items-center gap-3 p-2 ${className}`}>
      <div role="group" aria-label="What to cue" className="flex rounded-full bg-ground p-1">
        {[['movie', 'Movies'], ['tv', 'TV & anime']].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={reel.type === value}
            onClick={() => reel.switchType(value)}
            className={`h-8 rounded-full px-3.5 text-sm font-semibold transition-colors duration-300 ${reel.type === value ? 'bg-ink text-ground' : 'text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="num pr-2 text-[13px] text-muted">{reel.list.length} cued</p>
    </div>
  );
}

function LightsChip({ className = '' }) {
  const dark = useTheme() === 'dark';
  return (
    <div data-ui className={`hero-chip flex items-center gap-4 py-2.5 pl-4 pr-2.5 ${className}`}>
      <div>
        <p className="text-[15px] font-semibold leading-snug">House lights</p>
        <p className="text-[13px] text-muted">{dark ? 'Down, for the film' : 'Up, for reading'}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="House lights down (dark theme)"
        onClick={toggleTheme}
        className={`relative h-8 w-14 flex-none rounded-full transition-colors duration-500 ${dark ? 'bg-ink' : 'bg-raised'}`}
      >
        <span className={`absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ground transition-transform duration-500 ease-out-soft ${dark ? 'translate-x-6' : ''}`}>
          <Icon name={dark ? 'moon' : 'sun'} className="h-3.5 w-3.5" />
        </span>
      </button>
    </div>
  );
}

// ---------- The headline you can type ----------
function TypedSearch() {
  const [query, setQuery] = useState('dune');
  const [results, setResults] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setState('short');
      return undefined;
    }
    const controller = new AbortController();
    setState('loading');
    const timer = setTimeout(async () => {
      try {
        const found = await searchContentLive(term, controller.signal);
        if (controller.signal.aborted) return;
        setResults(found.slice(0, 3));
        setState('done');
      } catch {
        if (!controller.signal.aborted) setState('error');
      }
    }, 260);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  return (
    <section className="px-[var(--gutter)] pb-[clamp(96px,14vw,200px)] pt-[clamp(96px,14vw,200px)]" aria-labelledby="search-heading">
      <h2 id="search-heading" className="sr-only">Search the whole catalogue</h2>
      <div data-ui data-reveal>
        <label htmlFor="landing-search" className="sr-only">Search movies and shows</label>
        <input
          id="landing-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          className="typed-input w-full bg-transparent font-extrabold focus:outline-none"
        />
      </div>

      <div className="mt-8 sm:mt-12 lg:max-w-[560px]" data-ui aria-live="polite">
        {state === 'loading' && results.length === 0 ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[76px] rounded-[16px]" />)}</div>
        ) : state === 'short' ? (
          <p className="rounded-[16px] bg-surface px-5 py-6 text-[15px] text-muted">Type a title, two letters or more.</p>
        ) : state === 'error' ? (
          <p className="rounded-[16px] bg-surface px-5 py-6 text-[15px] text-muted">TMDB did not answer. Try again in a moment.</p>
        ) : results.length === 0 ? (
          <p className="rounded-[16px] bg-surface px-5 py-6 text-[15px] text-muted">Nothing on TMDB matches “{query.trim()}”.</p>
        ) : (
          <ul className={`space-y-1.5 transition-opacity duration-300 ${state === 'loading' ? 'opacity-60' : ''}`}>
            {results.map((r, i) => (
              <li key={`${r.media_type}-${r.id}`} className="arrive" style={{ '--i': i }}>
                <Link
                  to={`/${r.media_type}/${r.id}`}
                  className="group flex items-center gap-4 rounded-[16px] bg-surface p-2.5 pr-4 transition-colors duration-300 hover:bg-raised"
                >
                  <img
                    src={getImageUrl(r.poster_path, 'w92')}
                    alt=""
                    onError={(e) => { e.currentTarget.src = POSTER_FALLBACK; }}
                    className="h-[60px] w-10 flex-none rounded-[6px] bg-raised object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[18px] font-semibold">{r.title || r.name}</p>
                    <p className="text-[13px] text-muted">
                      {(r.release_date || r.first_air_date || '').slice(0, 4) || 'Year unknown'} · {r.media_type === 'tv' ? 'Show' : 'Movie'}
                      {r.vote_average > 0 && ` · ${r.vote_average.toFixed(1)}`}
                    </p>
                  </div>
                  <Icon name="arrowRight" className="h-5 w-5 flex-none text-muted transition-transform duration-300 group-hover:translate-x-1 group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-2 text-[18px] sm:mt-14">
        <span className="mr-2 text-muted">Or try</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setQuery(ex)}
            className="h-11 rounded-full bg-surface px-4 font-semibold transition-colors duration-300 hover:bg-raised sm:h-auto sm:bg-transparent sm:px-1 sm:underline sm:decoration-[1.5px] sm:underline-offset-4 sm:hover:bg-transparent"
          >
            {ex}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------- The name that closes the page, sized to span the full width at any screen size ----------
function FitName() {
  const boxRef = useRef(null);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    const fit = () => {
      const box = boxRef.current;
      const text = textRef.current;
      if (!box || !text) return;
      const room = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) - parseFloat(getComputedStyle(box).paddingRight);
      text.style.fontSize = '100px';
      text.style.fontSize = `${Math.floor((100 * room) / text.getBoundingClientRect().width * 100) / 100}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(boxRef.current);
    document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="close-name" aria-hidden="true">
      <span ref={textRef}>Queue Up</span>
    </div>
  );
}

// ---------- Page ----------
export default function LandingPage() {
  const navigate = useNavigate();
  const reel = useReel();
  const [ticked, setTicked] = useState(false);
  useScrollReveal();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/discover', { replace: true });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate('/discover', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const { current } = reel;
  const stages = [
    { words: 'One tap', grow: 12, tone: 'stage-1', clause: 'First, add the show from its page or straight from search.' },
    { words: '62 episodes, about 2 days', grow: 76, tone: 'stage-2', clause: 'Then tick episodes as you watch them, or a whole season at once.' },
    { words: 'By itself', grow: 12, tone: 'stage-3', clause: 'Last, when an ended series is fully ticked, it moves to your Completed Vault.' },
  ];

  return (
    <div className="overflow-x-clip">
      {/* =========================================
          1. HERO: the sentence, with the product's controls laid on it
      ========================================= */}
      <section
        className="relative flex min-h-[100svh] flex-col"
        onMouseEnter={() => reel.setPaused(true)}
        onMouseLeave={() => reel.setPaused(false)}
        onFocus={() => reel.setPaused(true)}
        onBlur={() => reel.setPaused(false)}
      >
        <header className="flex h-[76px] items-center justify-between px-[var(--gutter)]">
          <Wordmark to="/" />
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <Link to="/discover" className="btn btn-ghost hidden sm:inline-flex">Browse titles</Link>
            <Link to="/auth" className="btn btn-primary">Start your queue</Link>
          </nav>
        </header>

        <div className="relative flex flex-1 flex-col items-center justify-center px-[var(--gutter)] pb-[10vh] pt-4">
          {/* Desktop: the three controls sit around the letters, tilted, never over them */}
          <CueChip reel={reel} className="absolute left-[7%] top-[9%] hidden w-[300px] -rotate-3 xl:flex" />
          <TypeChip reel={reel} className="absolute left-[3%] top-[56%] hidden rotate-2 xl:flex" />
          <LightsChip className="absolute bottom-[16%] right-[6%] hidden -rotate-2 xl:flex" />

          {/* Phone and tablet: one control above the sentence */}
          <CueChip reel={reel} className="after-hero mb-8 w-full max-w-[340px] xl:hidden" />

          <h1 className="display hero-type text-center">
            <span className="mask-line" style={{ '--line': 0 }}><span>Queue up</span></span>
            <span className="mask-line" style={{ '--line': 1 }}>
              <span>
                <Slot reel={reel} />
                <span className="sr-only">{current.title}</span> next.
              </span>
            </span>
          </h1>

          <p className="after-hero mt-10 max-w-[42ch] text-center text-[18px] leading-relaxed sm:mt-[72px]">
            Queue Up is a free tracker for movies, TV and anime: keep a queue, tick off every episode
            and see how many hours it all adds up to.
          </p>

          {/* Phone and tablet: the other two controls below it */}
          <div className="after-hero mt-8 flex w-full max-w-[560px] flex-col items-center gap-2 sm:flex-row sm:justify-center xl:hidden">
            <TypeChip reel={reel} />
            <LightsChip />
          </div>
        </div>
      </section>

      {/* =========================================
          2. The slot, opened up: the cued title at full width
      ========================================= */}
      <section className="px-[var(--gutter)]" aria-label={`${current.title}, the title now cued`}>
        <div className="window relative aspect-[4/5] overflow-hidden rounded-[28px] bg-surface sm:aspect-[21/9]">
          {reel.list.map((item, i) => reel.isLoaded(i) && (
            <img
              key={`${reel.type}-${item.id}`}
              src={tmdbImage(item.backdrop, 'w1280')}
              alt={i === reel.index ? `Still from ${item.title}` : ''}
              loading="lazy"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${i === reel.index ? 'opacity-100' : 'opacity-0'}`}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-[15px]">
          <h2 className="text-[15px]"><span className="font-semibold">{current.title}</span><span className="font-normal text-muted"> · {current.year} · {current.length}</span></h2>
          <Link to={`/${reel.type}/${current.id}`} className="link">Open its page</Link>
        </div>
      </section>

      {/* =========================================
          3. FEATURES: one paragraph with pictures where the nouns are
      ========================================= */}
      <section className="px-[var(--gutter)] pt-[clamp(120px,16vw,220px)]" aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">What Queue Up does</h2>
        <p className="statement max-w-[1180px] font-semibold" data-reveal>
          Queue every film{' '}
          <span className="pword" aria-hidden="true"><img src={tmdbImage('/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', 'w342')} alt="" /></span>{' '}
          you mean to see, tick each episode{' '}
          <button
            type="button"
            data-ui
            aria-pressed={ticked}
            onClick={() => setTicked((t) => !t)}
            className="pword pword-tick"
            aria-label={ticked ? 'Episode 5 ticked. Untick it' : 'Tick episode 5'}
            title="Try it"
          >
            <span className="tick" aria-pressed={ticked}><Icon name="check" strokeWidth={2.5} /></span>
            <span className="num">E5</span>
          </button>{' '}
          as the credits roll, and watch the hours{' '}
          <span className="pword pword-bars" aria-hidden="true">
            {[3, 5, 4, 7, 6, 9, 8].map((h, i) => <span key={i} style={{ height: `${h * 10}%`, animationDelay: `${i * 70}ms` }} />)}
          </span>{' '}
          add up.
        </p>

        <div className="mt-[72px] grid md:grid-cols-12" data-reveal style={{ '--i': 2 }}>
          <div className="md:col-span-6 md:col-start-7">
            <p className="text-[18px] leading-relaxed">
              Finished a series that has ended? Tick its last episode and it moves to your Completed Vault on its own.
              Watched something twice? Log the rewatch and it counts toward your hours.
            </p>
            <Link to="/auth" className="btn btn-primary btn-lg mt-8">
              Start your queue
              <Icon name="arrowRight" />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================
          4. SHOWCASE: a headline you can type, answered by the real catalogue
      ========================================= */}
      <TypedSearch />

      {/* =========================================
          5. HOW IT WORKS: one series, start to finish, as a bar of true proportions
      ========================================= */}
      <section className="px-[var(--gutter)] pb-[clamp(120px,16vw,220px)] pt-6" aria-labelledby="stages-heading">
        <h2 id="stages-heading" className="display section-head" data-reveal="rise">From queue to vault</h2>

        <div data-ui className="stages mt-16" data-reveal style={{ '--i': 1 }}>
          {stages.map((s, i) => (
            <div key={s.tone} className="stage" style={{ flexGrow: s.grow, '--g': s.grow, '--d': `${i * 120}ms` }}>
              <div className={`stage-bar ${s.tone}`}>
                <p className="stage-words">{s.words}</p>
              </div>
              <p className="stage-clause">{s.clause}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[15px] text-muted" data-reveal style={{ '--i': 2 }}>
          Widths are to scale for Breaking Bad: 62 episodes of about 47 minutes each.
        </p>
      </section>

      {/* =========================================
          6. FAQ: a wide heading, the questions indented under it
      ========================================= */}
      <section className="px-[var(--gutter)] pb-[clamp(120px,16vw,220px)] pt-6" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="display section-head max-w-[14ch]" data-reveal="rise">Before you press play</h2>
        <div className="mt-20 grid md:grid-cols-12">
          <div className="faq md:col-span-8 md:col-start-5">
            {FAQ.map(([q, a], i) => (
              <details key={q} data-reveal style={{ '--i': i }}>
                <summary>
                  <span>{q}</span>
                  <Icon name="chevronDown" className="faq-chevron" strokeWidth={2} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================
          7. CLOSE: the idea again, inverted, over the cropped name
      ========================================= */}
      <footer className="close relative overflow-hidden bg-ink text-ground">
        <div className="grid gap-12 px-[var(--gutter)] pt-[clamp(96px,12vw,160px)] md:grid-cols-12">
          <div className="md:col-span-7" data-reveal="rise">
            <h2 className="display section-head">Queue up the next one.</h2>
            <Link to="/auth" className="btn btn-lg mt-10 bg-ground text-ink hover:opacity-90">
              Start your queue
              <Icon name="arrowRight" />
            </Link>
          </div>
          <nav aria-label="Footer" className="flex flex-col gap-3 text-[15px] font-semibold md:col-span-3 md:col-start-10" data-reveal style={{ '--i': 1 }}>
            <Link to="/discover" className="w-fit underline-offset-4 hover:underline">Browse titles</Link>
            <Link to="/search?q=frieren" className="w-fit underline-offset-4 hover:underline">Search the catalogue</Link>
            <Link to="/auth" className="w-fit underline-offset-4 hover:underline">Sign in</Link>
            <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="w-fit underline-offset-4 hover:underline">TMDB</a>
          </nav>
        </div>

        <div className="mt-24 flex flex-col gap-2 px-[var(--gutter)] text-[13px] opacity-80 sm:flex-row sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Queue Up. Titles, posters and stills from TMDB.</p>
          <p>{TMDB_NOTICE}</p>
        </div>
        <FitName />
      </footer>
    </div>
  );
}
