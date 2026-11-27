import { useEffect, useState } from 'react';
import { getImageUrl } from '../../lib/tmdb';
import MediaRow from '../profile/MediaRow';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';

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

export default function DetailsExtras({ item, mediaType }) {
  const [openPhoto, setOpenPhoto] = useState(null);
  const [expanded, setExpanded] = useState({});

  const title = item.title || item.name;
  const photos = pickPhotos(item);
  const reviews = (item.reviews?.results || []).slice(0, MAX_REVIEWS);
  const similar = pickSimilar(item, mediaType);
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
        <section className="wrap mt-16" aria-labelledby="photos-heading">
          <h2 id="photos-heading" className="mb-5 text-xl font-bold">Photos</h2>

          <div className={`grid gap-2 sm:gap-3 ${mosaic ? 'grid-cols-2 md:grid-cols-4' : GRID_BY_COUNT[photos.length] || 'grid-cols-2 md:grid-cols-4'}`}>
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
                  className={`group overflow-hidden rounded-[12px] bg-surface ${
                    isLead ? 'col-span-2 aspect-video md:row-span-2 md:aspect-auto' : `aspect-video ${fillsRow}`
                  }`}
                >
                  <img
                    src={getImageUrl(photo.file_path, isLead ? 'w1280' : 'w780')}
                    alt={`Photo from ${title}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.04]"
                  />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- Reviews ---------- */}
      <section className="wrap mt-16" aria-labelledby="reviews-heading">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="reviews-heading" className="text-xl font-bold">Reviews</h2>
          <p className="text-[13px] text-muted">Written by TMDB members, so they may contain spoilers.</p>
        </div>

        {reviews.length === 0 ? (
          <div className="flex min-h-[96px] items-center rounded-[20px] bg-surface px-6">
            <p className="text-[15px] text-muted">No reviews on TMDB yet.</p>
          </div>
        ) : (
          <div className="grid items-start gap-3 md:grid-cols-2">
            {reviews.map((review) => {
              const body = cleanReview(review.content);
              const isLong = body.length > REVIEW_PREVIEW_CHARS;
              const isOpen = !!expanded[review.id];
              const shown = isLong && !isOpen ? `${body.slice(0, REVIEW_PREVIEW_CHARS).trimEnd()}…` : body;
              const author = review.author || 'Anonymous';
              const given = review.author_details?.rating;

              return (
                <article key={review.id} className="rounded-[20px] bg-surface p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <Avatar name={author} size="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{author}</p>
                      <p className="text-[13px] text-muted">{formatDate(review.created_at)}</p>
                    </div>
                    {given ? (
                      <span className="flex-none rounded-full bg-ground px-2.5 py-1 text-[13px] font-semibold">
                        {given}<span className="text-muted">/10</span>
                      </span>
                    ) : null}
                  </div>

                  <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{shown}</p>

                  {isLong && (
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [review.id]: !isOpen }))}
                      className="link mt-3 text-[15px]"
                    >
                      {isOpen ? 'Show less' : 'Read the whole review'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- More like this ---------- */}
      {similar.length > 0 && (
        <div className="wrap mt-2">
          <MediaRow title="More like this" items={similar} emptyText="" showCount={false} />
        </div>
      )}

      {/* ---------- Photo viewer ---------- */}
      {openPhoto !== null && photos[openPhoto] && (
        <div role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[80] grid place-items-center p-4 md:p-14">
          <div className="dialog-backdrop" onClick={() => setOpenPhoto(null)} />
          <img
            key={photos[openPhoto].file_path}
            src={getImageUrl(photos[openPhoto].file_path, 'original')}
            alt={`Photo ${openPhoto + 1} from ${title}`}
            className="dialog-panel relative max-h-[82vh] max-w-full rounded-[16px] object-contain"
          />

          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-ground px-3.5 py-1.5 text-sm font-semibold">
            {openPhoto + 1} / {photos.length}
          </p>
          <button type="button" onClick={() => setOpenPhoto(null)} className="icon-btn absolute right-4 top-4 bg-ground" aria-label="Close photo viewer">
            <Icon name="x" />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => step(e, -1)}
                aria-label="Previous photo"
                className="icon-btn absolute left-3 top-1/2 h-12 w-12 -translate-y-1/2 bg-ground md:left-6"
              >
                <Icon name="chevronLeft" />
              </button>
              <button
                type="button"
                onClick={(e) => step(e, 1)}
                aria-label="Next photo"
                className="icon-btn absolute right-3 top-1/2 h-12 w-12 -translate-y-1/2 bg-ground md:right-6"
              >
                <Icon name="chevronRight" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
