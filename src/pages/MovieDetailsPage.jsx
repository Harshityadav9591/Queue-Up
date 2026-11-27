import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMovieDetails } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import DetailsExtras from '../components/details/DetailsExtras';
import { TitleHeader, OverviewAndFacts, CastRow, TrailerDialog, DetailsSkeleton, NotFound, formatLongDate, languageName } from '../components/details/TitleParts';
import Icon from '../components/ui/Icon';

export default function MovieDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  // Watchlist State
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  // Watched State
  const [isWatched, setIsWatched] = useState(false);
  const [isTogglingWatched, setIsTogglingWatched] = useState(false);

  // Favorite State
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // Extra watches (rewatches) of something already in the Completed Vault
  const [rewatchCount, setRewatchCount] = useState(0);
  const [isInVault, setIsInVault] = useState(false);
  const [isChangingRewatch, setIsChangingRewatch] = useState(false);

  const [isTrailerOpen, setIsTrailerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchDetailsAndStatus() {
      setLoading(true);
      // Reset per-movie state so navigating from one movie to another (e.g. via search) never shows stale status
      setIsInWatchlist(false);
      setIsWatched(false);
      setIsFavorite(false);
      setRewatchCount(0);
      setIsInVault(false);

      const data = await getMovieDetails(id);
      if (cancelled) return;

      setMovie(data);

      if (data) {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          const [watchlistRes, watchedRes, favoriteRes, rewatchRes] = await Promise.all([
            // Check Watchlist
            supabase
              .from('watchlist')
              .select('id')
              .eq('movie_id', data.id.toString())
              .eq('media_type', 'movie')
              .eq('user_id', session.user.id)
              .maybeSingle(),
            // Check Watched History
            supabase
              .from('watched_movies')
              .select('id')
              .eq('movie_id', data.id.toString())
              .eq('user_id', session.user.id)
              .maybeSingle(),
            // Check Favorites
            supabase
              .from('favorites')
              .select('id')
              .eq('media_id', data.id.toString())
              .eq('media_type', 'movie')
              .eq('user_id', session.user.id)
              .maybeSingle(),
            // Extra watches
            supabase
              .from('completed_items')
              .select('rewatch_count')
              .eq('media_id', data.id.toString())
              .eq('media_type', 'movie')
              .eq('user_id', session.user.id)
              .maybeSingle(),
          ]);
          if (cancelled) return;

          setIsInWatchlist(!!watchlistRes.data);
          setIsWatched(!!watchedRes.data);
          setIsFavorite(!!favoriteRes.data);
          setRewatchCount(rewatchRes.data?.rewatch_count ?? 0);
          setIsInVault(!!rewatchRes.data);
        }
      }
      setLoading(false);
    }

    fetchDetailsAndStatus();
    window.scrollTo(0, 0);

    return () => { cancelled = true; };
  }, [id]);

  const handleToggleWatchlist = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in to manage your queue!");
      navigate('/auth');
      return;
    }

    setIsToggling(true);
    if (isInWatchlist) {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('movie_id', movie.id.toString())
        .eq('media_type', 'movie')
        .eq('user_id', session.user.id);

      if (!error) {
        setIsInWatchlist(false);
        toast.success("Removed from your queue!");
      } else {
        toast.error("Failed to remove from queue.");
      }
    } else {
      const movieIdStr = movie.id.toString();
      const { data: existing } = await supabase
        .from('watchlist')
        .select('id')
        .eq('movie_id', movieIdStr)
        .eq('media_type', 'movie')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existing) {
        setIsInWatchlist(true);
      } else {
        const { error } = await supabase
          .from('watchlist')
          .insert([{
            user_id: session.user.id,
            movie_id: movieIdStr,
            title: movie.title,
            poster_path: movie.poster_path,
            media_type: 'movie',
            release_year: movie.release_date ? movie.release_date.substring(0, 4) : null,
            vote_average: movie.vote_average ?? null,
          }]);

        if (!error) {
          setIsInWatchlist(true);
          toast.success("Added to your queue!");
        } else {
          toast.error("Failed to add to queue.");
        }
      }
    }
    setIsToggling(false);
  };

  // Adds (+1) or removes (-1) one extra watch. The database clamps it between 0 and 99.
  const handleChangeRewatch = async (delta) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in to track watches!");
      navigate('/auth');
      return;
    }

    setIsChangingRewatch(true);

    // Movies marked as watched in the older system may have no Completed Vault row yet.
    // complete_item is safe to repeat, so create the row first.
    if (!isInVault) {
      const { error: vaultError } = await supabase.rpc('complete_item', {
        p_media_id: movie.id.toString(),
        p_media_type: 'movie',
        p_title: movie.title,
        p_poster_path: movie.poster_path ?? null,
        p_release_year: movie.release_date ? movie.release_date.substring(0, 4) : null,
        p_vote_average: movie.vote_average ?? null,
        p_runtime_minutes: movie.runtime ?? null,
      });
      if (vaultError) {
        toast.error("Couldn't update your watch count. Please try again.");
        setIsChangingRewatch(false);
        return;
      }
      setIsInVault(true);
      setIsInWatchlist(false);
    }

    const { data, error } = await supabase.rpc('change_rewatch_count', {
      p_media_id: movie.id.toString(),
      p_media_type: 'movie',
      p_delta: delta,
    });

    if (error) {
      toast.error("Couldn't update your watch count. Please try again.");
    } else {
      setRewatchCount(data);
      toast.success(delta > 0 ? 'Logged another watch!' : 'Removed one watch.');
    }
    setIsChangingRewatch(false);
  };

  const handleToggleFavorite = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in to save favorites!");
      navigate('/auth');
      return;
    }

    setIsTogglingFavorite(true);
    const movieIdStr = movie.id.toString();

    if (isFavorite) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('media_id', movieIdStr)
        .eq('media_type', 'movie')
        .eq('user_id', session.user.id);

      if (error) {
        toast.error("Failed to remove from favorites.");
      } else {
        setIsFavorite(false);
        toast.success("Removed from favorites");
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert([{
          user_id: session.user.id,
          media_id: movieIdStr,
          media_type: 'movie',
          title: movie.title,
          poster_path: movie.poster_path ?? null,
          release_year: movie.release_date ? movie.release_date.substring(0, 4) : null,
          vote_average: movie.vote_average ?? null,
        }]);

      // 23505 = already a favorite, which is fine
      if (error && error.code !== '23505') {
        toast.error("Failed to add to favorites.");
      } else {
        setIsFavorite(true);
        toast.success("Added to favorites!");
      }
    }
    setIsTogglingFavorite(false);
  };

  const handleToggleWatched = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in to track movies!");
      navigate('/auth');
      return;
    }

    setIsTogglingWatched(true);
    const movieIdStr = movie.id.toString();

    if (isWatched) {
      // One atomic database call: removes from watched_movies AND the Completed Vault together
      const { error } = await supabase.rpc('uncomplete_item', {
        p_media_id: movieIdStr,
        p_media_type: 'movie',
      });

      if (error) {
        toast.error("Couldn't remove from watched history. Please try again.");
      } else {
        setIsWatched(false);
        setRewatchCount(0);
        setIsInVault(false);
        toast.success("Removed from watched history");
      }
    } else {
      // One atomic database call: saves to watched_movies, saves to the Completed Vault,
      // and removes from the Watchlist. Either all three happen or none do.
      const { error } = await supabase.rpc('complete_item', {
        p_media_id: movieIdStr,
        p_media_type: 'movie',
        p_title: movie.title,
        p_poster_path: movie.poster_path ?? null,
        p_release_year: movie.release_date ? movie.release_date.substring(0, 4) : null,
        p_vote_average: movie.vote_average ?? null,
        p_runtime_minutes: movie.runtime ?? null,
      });

      if (error) {
        toast.error("Failed to mark as watched. Please try again.");
      } else {
        setIsWatched(true);
        setIsInVault(true);
        setIsInWatchlist(false);
        toast.success("Marked as watched & moved to Completed Vault!");
      }
    }
    setIsTogglingWatched(false);
  };

  if (loading) return <DetailsSkeleton />;
  if (!movie) return <NotFound kind="movie" />;

  const trailer = movie.videos?.results?.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');
  const releaseYear = movie.release_date ? movie.release_date.substring(0, 4) : null;
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null;
  const genres = movie.genres?.map(g => g.name).join(', ');

  const actions = (
    <>
      {/* Queue: the one filled action on the page */}
      <button onClick={handleToggleWatchlist} disabled={isToggling} aria-pressed={isInWatchlist} className={`btn ${isInWatchlist ? 'btn-on' : 'btn-primary'}`}>
        <Icon name={isInWatchlist ? 'check' : 'plus'} strokeWidth={2.25} />
        {isToggling ? 'Updating…' : isInWatchlist ? 'In your queue' : 'Add to queue'}
      </button>

      <button onClick={handleToggleWatched} disabled={isTogglingWatched} aria-pressed={isWatched} className={`btn ${isWatched ? 'btn-on' : 'btn-quiet'}`}>
        <Icon name={isWatched ? 'check' : 'film'} strokeWidth={isWatched ? 2.25 : 1.75} />
        {isTogglingWatched ? 'Updating…' : isWatched ? 'Watched' : 'Mark as watched'}
      </button>

      {/* Watched again: appears once this is in your Completed Vault */}
      {isWatched && (
        <div className="inline-flex items-center rounded-full bg-surface" style={{ animation: 'pop-in .3s var(--ease-out) both' }}>
          <button onClick={() => handleChangeRewatch(1)} disabled={isChangingRewatch} className="btn bg-transparent hover:bg-raised">
            <Icon name="rewatch" />
            {rewatchCount === 0 ? 'Watched again' : rewatchCount === 1 ? 'Watched twice' : `Watched ${rewatchCount + 1} times`}
          </button>
          {rewatchCount > 0 && (
            <button
              onClick={() => handleChangeRewatch(-1)}
              disabled={isChangingRewatch}
              aria-label="Remove one watch"
              title="Remove one watch"
              className="icon-btn mr-0.5 h-9 w-9 hover:bg-raised"
            >
              <Icon name="minus" />
            </button>
          )}
        </div>
      )}

      <button
        onClick={handleToggleFavorite}
        disabled={isTogglingFavorite}
        aria-pressed={isFavorite}
        className={`btn ${isFavorite ? 'btn-on' : 'btn-quiet'}`}
      >
        <Icon name="heart" filled={isFavorite} className={`transition-transform duration-300 ${isFavorite ? 'scale-110 text-data' : ''}`} />
        {isTogglingFavorite ? 'Updating…' : isFavorite ? 'Favorite' : 'Add to favorites'}
      </button>

      {trailer && (
        <button onClick={() => setIsTrailerOpen(true)} className="btn btn-ghost">
          <Icon name="play" filled />
          Trailer
        </button>
      )}
    </>
  );

  return (
    <div>
      <TitleHeader item={movie} title={movie.title} meta={[releaseYear, runtime, genres]} actions={actions} />

      <OverviewAndFacts
        item={movie}
        facts={[
          ['Released', formatLongDate(movie.release_date)],
          ['Runtime', runtime],
          ['Language', languageName(movie.original_language)],
          ['Status', movie.status],
        ]}
      >
        <CastRow cast={movie.credits?.cast} inline />
      </OverviewAndFacts>

      {/* Photos, reviews and similar titles. key resets its open/closed state when you move to another movie */}
      <DetailsExtras key={movie.id} item={movie} mediaType="movie" />

      {isTrailerOpen && trailer && <TrailerDialog trailer={trailer} title={movie.title} onClose={() => setIsTrailerOpen(false)} />}
    </div>
  );
}
