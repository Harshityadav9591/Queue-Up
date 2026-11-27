import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl, POSTER_FALLBACK } from '../../lib/tmdb';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';

// ---------- The object header: backdrop, poster, name, meta and actions ----------
export function TitleHeader({ item, title, meta, actions, children }) {
  const [backdropLoaded, setBackdropLoaded] = useState(false);
  const hasBackdrop = !!item.backdrop_path;

  return (
    <div className="wrap pt-2 sm:pt-4">
      {hasBackdrop && (
        <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] bg-surface sm:aspect-[21/9]">
          <img
            src={getImageUrl(item.backdrop_path, 'original')}
            alt=""
            onLoad={() => setBackdropLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-700 ${backdropLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ animation: 'drift 24s var(--ease-in-out) infinite alternate' }}
          />
        </div>
      )}

      <div className={`relative grid gap-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10 ${hasBackdrop ? '-mt-16 sm:-mt-24' : 'mt-6'}`}>
        <div className="poster z-10 w-[120px] rounded-[12px] ring-[6px] ring-ground sm:w-[160px] md:w-full">
          <img src={getImageUrl(item.poster_path, 'w500')} alt={`${title} poster`} onError={(e) => { e.currentTarget.src = POSTER_FALLBACK; }} />
        </div>

        <div className={`min-w-0 ${hasBackdrop ? 'md:pt-32' : 'md:pt-6'}`} style={{ animation: 'fade-up .7s var(--ease-out) .1s both' }}>
          <h1 className="text-[26px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[32px]">{title}</h1>
          <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[15px] text-muted">
            {meta.filter(Boolean).map((m, i) => (
              <span key={m} className="whitespace-nowrap">
                {i > 0 && <span aria-hidden="true" className="mr-2">·</span>}
                {m}
              </span>
            ))}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">{actions}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------- Overview beside the facts, led by the rating ----------
// The cast sits under the overview, so the column beside the facts panel is never left empty
export function OverviewAndFacts({ item, facts, children }) {
  const rating = Number(item.vote_average) || 0;
  const votes = Number(item.vote_count) || 0;
  const isRated = rating > 0 && votes > 0;

  return (
    <section className="wrap mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-14">
      <div className="min-w-0">
        <h2 className="sr-only">Overview</h2>
        {item.tagline && <p className="mb-4 text-xl italic text-muted">{item.tagline}</p>}
        <p className="max-w-[62ch] text-[18px] leading-[1.6]">{item.overview || 'TMDB has no overview for this title yet.'}</p>
        {children}
      </div>

      <aside className="rounded-[20px] bg-surface p-6" aria-label="Facts">
        {isRated ? (
          <>
            <p className="leading-none">
              <span className="text-[40px] font-bold tracking-[-0.03em]">{rating.toFixed(1)}</span>
              <span className="ml-1 text-lg text-muted">/ 10</span>
            </p>
            <div className="meter mt-4" role="img" aria-label={`Rated ${rating.toFixed(1)} out of 10`}>
              <span style={{ width: `${Math.min(100, rating * 10)}%` }} />
            </div>
            <p className="mt-3 text-[13px] text-muted">Average of {votes.toLocaleString()} {votes === 1 ? 'vote' : 'votes'} on TMDB</p>
          </>
        ) : (
          <p className="text-[15px] text-muted">Not enough votes on TMDB to show a rating yet.</p>
        )}

        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-[15px]">
          {facts.filter(([, v]) => v).map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </section>
  );
}

// ---------- Top cast ----------
export function CastRow({ cast, inline = false }) {
  if (!cast?.length) return null;
  return (
    <section className={inline ? 'mt-10' : 'wrap mt-16'} aria-labelledby="cast-heading">
      <h2 id="cast-heading" className="mb-5 text-xl font-bold">Top cast</h2>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {cast.slice(0, 15).map((actor, i) => (
          <div key={actor.id} className="arrive w-[132px] min-w-[132px] flex-shrink-0 snap-start" style={{ '--i': Math.min(i, 8) }}>
            <div className="aspect-[4/5] overflow-hidden rounded-[12px] bg-surface">
              {actor.profile_path ? (
                <img src={getImageUrl(actor.profile_path, 'w185')} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <Avatar name={actor.name} size="h-full w-full text-4xl" className="rounded-none" />
              )}
            </div>
            <p className="mt-2.5 line-clamp-1 text-[15px] font-semibold">{actor.name}</p>
            <p className="line-clamp-2 text-[13px] text-muted">{actor.character}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Trailer ----------
export function TrailerDialog({ trailer, title, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4 md:p-12" role="dialog" aria-modal="true" aria-label={`${title} trailer`}>
      <div className="dialog-backdrop" onClick={onClose} />
      <div className="dialog-panel relative aspect-video w-full max-w-5xl overflow-hidden rounded-[20px] bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`}
          title={`${title} trailer`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <button onClick={onClose} className="icon-btn absolute right-4 top-4 bg-ground" aria-label="Close trailer">
        <Icon name="x" />
      </button>
    </div>
  );
}

// ---------- Loading and missing states ----------
export function DetailsSkeleton() {
  return (
    <div className="wrap pt-4" aria-busy="true" aria-label="Loading">
      <div className="skeleton aspect-[16/10] rounded-[24px] sm:aspect-[21/9]" />
      <div className="-mt-16 grid gap-5 sm:-mt-24 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
        <div className="skeleton relative aspect-[2/3] w-[120px] rounded-[12px] ring-[6px] ring-ground sm:w-[160px] md:w-full" />
        <div className="md:pt-32">
          <div className="skeleton h-10 w-2/3 rounded-lg" />
          <div className="skeleton mt-4 h-4 w-1/3 rounded-md" />
          <div className="mt-7 flex gap-2">
            <div className="skeleton h-10 w-36 rounded-full" />
            <div className="skeleton h-10 w-32 rounded-full" />
            <div className="skeleton h-10 w-28 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotFound({ kind }) {
  return (
    <div className="wrap flex min-h-[60vh] flex-col items-start justify-center">
      <h1 className="text-[32px] font-extrabold tracking-[-0.03em]">That {kind} isn’t on TMDB.</h1>
      <p className="mt-2 text-muted">The link may be old, or the title was removed.</p>
      <Link to="/discover" className="btn btn-primary mt-6">Back to Discover</Link>
    </div>
  );
}

export const formatLongDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const languageName = (code) => {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(undefined, { type: 'language' }).of(code);
  } catch {
    return code.toUpperCase();
  }
};
