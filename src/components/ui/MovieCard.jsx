import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { POSTER_FALLBACK } from '../../lib/tmdb';
import Icon from './Icon';

// 6900 -> "6.9k"
const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

export default function MovieCard({
  id,
  title,
  genre,
  releaseYear,
  rating,
  voteCount,
  posterUrl,
  linkUrl,
  mediaType = 'movie',
  posterPath,
  initialInWatchlist = false,
  initialIsWatched = false,
  onRemoved,
  onWatchlistToggle,
  onWatchedToggle,
  note,
}) {

  // If linkUrl is provided (like from the Discover page), use it. Otherwise, default to movie.
  const destination = linkUrl ? linkUrl : `/movie/${id}`;
  const navigate = useNavigate();

  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist);
  const [isAdding, setIsAdding] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isWatched, setIsWatched] = useState(initialIsWatched);
  const [isMarkingWatched, setIsMarkingWatched] = useState(false);

  useEffect(() => {
    setInWatchlist(initialInWatchlist);
  }, [initialInWatchlist]);

  useEffect(() => {
    setIsWatched(initialIsWatched);
  }, [initialIsWatched]);

  const handleQuickAdd = async (e) => {
    // Prevent the Link from navigating
    e.preventDefault();
    e.stopPropagation();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please sign in to manage your queue!');
      navigate('/auth');
      return;
    }

    if (isAdding) return;
    setIsAdding(true);

    if (inWatchlist) {
      // Remove from watchlist (scoped by media_type so a movie and a show with the same id never collide)
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('movie_id', id.toString())
        .eq('media_type', mediaType)
        .eq('user_id', session.user.id);

      if (error) {
        toast.error('Failed to remove from queue.');
      } else {
        setInWatchlist(false);
        toast.success(`"${title}" removed from your queue!`);
        if (onRemoved) onRemoved(id, mediaType);
        if (onWatchlistToggle) onWatchlistToggle(id, false, mediaType);
      }
    } else {
      // Check first so we can sync state silently if the item is already there
      const { data: existing } = await supabase
        .from('watchlist')
        .select('id')
        .eq('movie_id', id.toString())
        .eq('media_type', mediaType)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existing) {
        // Already exists: just sync local state silently
        setInWatchlist(true);
        if (onWatchlistToggle) onWatchlistToggle(id, true, mediaType);
      } else {
        const yearStr = String(releaseYear ?? '');
        const { error } = await supabase
          .from('watchlist')
          .insert([{
            user_id: session.user.id,
            movie_id: id.toString(),
            title: title,
            poster_path: posterPath || null,
            media_type: mediaType,
            release_year: /^\d{4}$/.test(yearStr) ? yearStr : null,
            vote_average: Number(rating) > 0 ? Number(rating) : null,
          }]);

        if (error) {
          toast.error('Failed to add to queue.');
        } else {
          setInWatchlist(true);
          toast.success(`"${title}" added to your queue!`);
          if (onWatchlistToggle) onWatchlistToggle(id, true, mediaType);
        }
      }
    }

    setIsAdding(false);
  };

  const handleToggleWatched = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isMarkingWatched) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please sign in to track watches!');
      navigate('/auth');
      return;
    }

    setIsMarkingWatched(true);
    const yearStr = String(releaseYear ?? '');
    const { error } = isWatched
      ? await supabase.rpc('uncomplete_item', {
        p_media_id: id.toString(),
        p_media_type: mediaType,
      })
      : await supabase.rpc('complete_item', {
        p_media_id: id.toString(),
        p_media_type: mediaType,
        p_title: title,
        p_poster_path: posterPath || null,
        p_release_year: /^\d{4}$/.test(yearStr) ? yearStr : null,
        p_vote_average: Number(rating) > 0 ? Number(rating) : null,
      });

    if (error) {
      toast.error(isWatched
        ? 'Failed to remove watched status. Please try again.'
        : 'Failed to mark as watched. Please try again.');
    } else {
      const nextIsWatched = !isWatched;
      setIsWatched(nextIsWatched);
      if (nextIsWatched) {
        setInWatchlist(false);
        if (onWatchlistToggle) onWatchlistToggle(id, false, mediaType);
      }
      toast.success(nextIsWatched
        ? `"${title}" marked as watched!`
        : `"${title}" removed from watched history.`);
      if (onWatchedToggle) onWatchedToggle(id, nextIsWatched, mediaType);
    }
    setIsMarkingWatched(false);
  };

  const typeLabel = genre || (mediaType === 'tv' ? 'Show' : 'Movie');
  const hasRating = rating !== undefined && rating !== null && Number(rating) > 0;
  const year = releaseYear && releaseYear !== 'N/A' ? releaseYear : null;

  return (
    <div className="group relative">
      <Link to={destination} className="block rounded-[10px] focus-visible:outline-offset-4">
        <div className="poster">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt=""
              loading="lazy"
              data-loaded={loaded}
              onLoad={() => setLoaded(true)}
              onError={(e) => { e.currentTarget.src = POSTER_FALLBACK; setLoaded(true); }}
            />
          ) : (
            <img src={POSTER_FALLBACK} alt="" />
          )}
        </div>

        <h3 className="mt-3 truncate text-[15px] font-semibold leading-snug" title={title}>{title}</h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
          <span>{year || typeLabel}</span>
          {hasRating && (
            <>
              <span aria-hidden="true">·</span>
              <Icon name="star" filled className="h-3 w-3 text-data" />
              <span className="text-ink">{Number(rating).toFixed(1)}</span>
              {voteCount ? <span>({compact(voteCount)})</span> : null}
            </>
          )}
          {note && <><span aria-hidden="true">·</span><span>{note}</span></>}
        </p>
      </Link>

      <button
        type="button"
        onClick={handleToggleWatched}
        disabled={isMarkingWatched}
        aria-pressed={isWatched}
        aria-label={isWatched ? `Remove watched status from ${title}` : `Mark ${title} as watched`}
        title={isWatched ? 'Remove watched status' : 'Mark Watched'}
        className={`quick group/watched absolute left-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full ${
          isWatched ? 'bg-data text-ground hover:bg-negative' : 'bg-ground text-ink hover:bg-data hover:text-ground'
        } ${isMarkingWatched ? 'cursor-wait' : ''}`}
      >
        {isMarkingWatched ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        ) : (
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.5-7 9.75-7 9.75 7 9.75 7-3.5 7-9.75 7-9.75-7-9.75-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
        <span className="pointer-events-none invisible absolute left-0 top-full z-30 mt-2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-semibold text-ground opacity-0 shadow-lg transition-opacity group-hover/watched:visible group-hover/watched:opacity-100 group-focus-visible/watched:visible group-focus-visible/watched:opacity-100">
          {isWatched ? 'Remove watched status' : 'Mark Watched'}
        </span>
      </button>

      {/* Quick add / remove: stays visible while the title is in the queue */}
      <button
        type="button"
        onClick={handleQuickAdd}
        disabled={isAdding}
        aria-pressed={inWatchlist}
        aria-label={inWatchlist ? `Remove ${title} from your queue` : `Add ${title} to your queue`}
        title={inWatchlist ? 'In your queue (click to remove)' : 'Add to queue'}
        className={`quick group/btn absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full ${
          inWatchlist ? 'bg-ink text-ground hover:bg-negative' : 'bg-ground text-ink hover:bg-ink hover:text-ground'
        } ${isAdding ? 'cursor-wait' : ''}`}
      >
        {isAdding ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        ) : inWatchlist ? (
          <span className="relative h-[18px] w-[18px]">
            <Icon name="check" strokeWidth={2.25} className="absolute inset-0 h-[18px] w-[18px] transition duration-200 group-hover/btn:scale-50 group-hover/btn:opacity-0" />
            <Icon name="x" strokeWidth={2.25} className="absolute inset-0 h-[18px] w-[18px] scale-50 opacity-0 transition duration-200 group-hover/btn:scale-100 group-hover/btn:opacity-100" />
          </span>
        ) : (
          <Icon name="plus" strokeWidth={2.25} className="h-[18px] w-[18px] transition-transform duration-300 group-hover/btn:rotate-90" />
        )}
      </button>
    </div>
  );
}
