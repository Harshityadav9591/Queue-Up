import { useEffect, useState } from 'react';
import { getImageUrl } from '../../lib/tmdb';
import MediaRow from '../profile/MediaRow';

const MAX_PHOTOS = 5;
const MAX_REVIEWS = 4;
const MAX_SIMILAR = 14;
const REVIEW_PREVIEW_CHARS = 450;

// Backdrops are TMDB's promotional photos. They avoid episode stills, which is where spoilers live.
// Pictures without text on them are preferred, and the one already used as the page banner is skipped.
function pickPhotos(item) {
  const all = item.images?.backdrops || [];
  const textless = all.filter((b) => !b.iso_639_1);
  const pool = (textless.length >= 3 ? textless : all).filter((b) => b.file_path !== item.backdrop_path);
  return pool.slice(0, MAX_PHOTOS);
}

// "Similar" is TMDB's match on genres and keywords; recommendations top it up.
function pickSimilar(item, mediaType) {
  const seen = new Set([item.id]);
  const out = [];
  [...(item.similar?.results || []), ...(item.recommendations?.results || [])].forEach((r) => {
    if (!r.poster_path || r.adult || seen.has(r.id)) return;
    seen.add(r.id);
    const date = r.release_date || r.first_air_date || '';
    out.push({
      key: `${mediaType}-${r.id}`,
      id: r.id,
      type: mediaType,
      title: r.title || r.name,
      poster_path: r.poster_path,
      release_year: date ? date.slice(0, 4) : null,
      vote_average: r.vote_average,
    });
  });
  return out.slice(0, MAX_SIMILAR);
}

const cleanReview = (text) => (text || '').replace(/\r\n/g, '\n').replace(/\*\*|__/g, '').trim();

const formatDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

// Column counts as full class names so Tailwind can see them
const GRID_BY_COUNT = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
};

function ChevronIcon({ direction }) {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

export default function DetailsExtras({ item, mediaType }) {
  const [openPhoto, setOpenPhoto] = useState(null);
  const [expanded, setExpanded] = useState({});

  const title = item.title || item.name;
  const photos = pickPhotos(item);
  const reviews = (item.reviews?.results || []).slice(0, MAX_REVIEWS);
  const similar = pickSimilar(item, mediaType);

  const rating = Number(item.vote_average) || 0;
  const votes = Number(item.vote_count) || 0;
  const isRated = rating > 0 && votes > 0;
  const mosaic = photos.length >= MAX_PHOTOS;

  // Photo viewer: Escape closes it, arrow keys move between photos
  useEffect(() => {
    if (openPhoto === null) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpenPhoto(null);
      if (e.key === 'ArrowRight') setOpenPhoto((i) => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft') setOpenPhoto((i) => (i - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openPhoto, photos.length]);

  const step = (e, direction) => {
    e.stopPropagation();
    setOpenPhoto((i) => (i + direction + photos.length) % photos.length);
  };

  return (
    <>
      {/* ---------- Photos ---------- */}
      {photos.length > 0 && (
        <section className="container mx-auto px-6 max-w-5xl mt-16 md:mt-24">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 transition-colors">Photos</h2>

          <div className={`grid gap-3 ${mosaic ? 'grid-cols-2 md:grid-cols-4' : GRID_BY_COUNT[photos.length] || 'grid-cols-2 md:grid-cols-4'}`}>
            {photos.map((photo, i) => {
              const isLead = mosaic && i === 0;
              // With exactly 3 photos on a phone, let the last one span both columns so no cell is left empty
              const fillsRow = photos.length === 3 && i === 2 ? 'col-span-2 md:col-span-1' : '';
              return (
                <button
                  key={photo.file_path}
                  type="button"
                  onClick={() => setOpenPhoto(i)}
                  aria-label={`Open photo ${i + 1} of ${photos.length} from ${title}`}
                  className={`group overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800 ${
                    isLead ? 'col-span-2 md:row-span-2 aspect-video md:aspect-auto' : `aspect-video ${fillsRow}`
                  }`}
                >
                  <img
                    src={getImageUrl(photo.file_path, isLead ? 'w1280' : 'w780')}
                    alt={`Photo from ${title}`}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- Rating and reviews ---------- */}
      <section className="container mx-auto px-6 max-w-5xl mt-16 md:mt-24">
        <div className="grid gap-12 md:grid-cols-[minmax(0,300px)_1fr]">

          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 transition-colors">Rating</h2>
            {isRated ? (
              <>
                <p className="text-slate-900 dark:text-white font-black leading-none">
                  <span className="text-8xl tracking-tight">{rating.toFixed(1)}</span>
                  <span className="text-2xl font-bold text-slate-500 dark:text-slate-400"> / 10</span>
                </p>
                <div
                  className="mt-6 h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                  role="img"
                  aria-label={`Rated ${rating.toFixed(1)} out of 10`}
                >
                  <div className="h-full rounded-full bg-blue-600 dark:bg-[#00f0ff]" style={{ width: `${Math.min(100, Math.round(rating * 10))}%` }}></div>
                </div>
                <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
                  Average of {votes.toLocaleString()} {votes === 1 ? 'vote' : 'votes'} on TMDB.
                </p>
              </>
            ) : (
              <p className="text-lg text-slate-600 dark:text-slate-300">Not enough votes on TMDB to show a rating yet.</p>
            )}
          </div>

          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 transition-colors">Reviews</h2>
            <p className="text-base text-slate-600 dark:text-slate-300 mb-8">
              Written by TMDB members, so they may contain spoilers.
            </p>

            {reviews.length === 0 ? (
              <p className="text-lg text-slate-600 dark:text-slate-300">No reviews on TMDB yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {reviews.map((review) => {
                  const body = cleanReview(review.content);
                  const isLong = body.length > REVIEW_PREVIEW_CHARS;
                  const isOpen = !!expanded[review.id];
                  const shown = isLong && !isOpen ? `${body.slice(0, REVIEW_PREVIEW_CHARS).trimEnd()}…` : body;
                  const author = review.author || 'Anonymous';
                  const given = review.author_details?.rating;

                  return (
                    <article key={review.id} className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-6 transition-colors">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-900 dark:text-white flex-shrink-0">
                          {author.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{author}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {formatDate(review.created_at)}
                            {given ? ` • rated it ${given}/10` : ''}
                          </p>
                        </div>
                      </div>

                      <p className="text-base leading-relaxed text-slate-900 dark:text-slate-100 whitespace-pre-line break-words">{shown}</p>

                      {isLong && (
                        <button
                          type="button"
                          onClick={() => setExpanded((prev) => ({ ...prev, [review.id]: !isOpen }))}
                          className="mt-4 font-bold text-blue-600 dark:text-[#00f0ff] hover:underline"
                        >
                          {isOpen ? 'Show less' : 'Read more'}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------- More like this ---------- */}
      {similar.length > 0 && (
        <div className="container mx-auto px-6 max-w-5xl mt-4 md:mt-12">
          <MediaRow title="More like this" items={similar} emptyText="" showCount={false} />
        </div>
      )}

      {/* ---------- Photo viewer ---------- */}
      {openPhoto !== null && photos[openPhoto] && (
        <div
          onClick={() => setOpenPhoto(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 md:p-12"
        >
          <img
            src={getImageUrl(photos[openPhoto].file_path, 'original')}
            alt={`Photo ${openPhoto + 1} from ${title}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
          />

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => step(e, -1)}
                aria-label="Previous photo"
                className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-white hover:text-black text-white flex items-center justify-center transition-colors"
              >
                <ChevronIcon direction="left" />
              </button>
              <button
                type="button"
                onClick={(e) => step(e, 1)}
                aria-label="Next photo"
                className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-white hover:text-black text-white flex items-center justify-center transition-colors"
              >
                <ChevronIcon direction="right" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
