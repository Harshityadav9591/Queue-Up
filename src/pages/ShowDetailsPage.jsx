import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getShowDetails, getSeasonDetails, getImageUrl, POSTER_FALLBACK } from '../lib/tmdb';
import { formatDuration } from '../lib/watchTime';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import DetailsExtras from '../components/details/DetailsExtras';
import { TitleHeader, OverviewAndFacts, CastRow, TrailerDialog, DetailsSkeleton, NotFound, formatLongDate, languageName } from '../components/details/TitleParts';
import Icon from '../components/ui/Icon';

// Postgres unique-violation: the row is already there, which is fine for our purposes
const isOk = (error) => !error || error.code === '23505';

export default function ShowDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Watchlist & Vault State
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isShowCompleted, setIsShowCompleted] = useState(false);
  const [isTogglingShowCompleted, setIsTogglingShowCompleted] = useState(false);

  // Favorite State
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // Extra watches (rewatches) of a show already in the Completed Vault
  const [rewatchCount, setRewatchCount] = useState(0);
  const [isChangingRewatch, setIsChangingRewatch] = useState(false);
  
  // UI State
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);

  // Seasons & Episodes Data
  const [expandedSeason, setExpandedSeason] = useState(null);
  const [seasonData, setSeasonData] = useState({});
  const [loadingSeason, setLoadingSeason] = useState(false);

  // Global Watched State for ultra-fast UI
  const [watchedSeasons, setWatchedSeasons] = useState(new Set());
  const [watchedEpisodes, setWatchedEpisodes] = useState(new Set());
  const [isTogglingSeason, setIsTogglingSeason] = useState(false);

  // Episode Modal State
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const isEpisodeWatched = selectedEpisode ? watchedEpisodes.has(selectedEpisode.id.toString()) : false;
  const [isTogglingWatched, setIsTogglingWatched] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchDetailsAndStatus() {
      setLoading(true);

      // Reset per-show state so navigating from one show to another (e.g. via search) never shows stale status
      setIsInWatchlist(false);
      setIsShowCompleted(false);
      setIsFavorite(false);
      setRewatchCount(0);
      setWatchedSeasons(new Set());
      setWatchedEpisodes(new Set());
      setExpandedSeason(null);
      setSeasonData({});
      setSelectedEpisode(null);
      setIsTrailerOpen(false);

      const data = await getShowDetails(id);
      if (cancelled) return;
      setShow(data);

      if (data) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const showIdStr = data.id.toString();
          const [watchlistRes, completedRes, seasonsRes, episodesRes, favoriteRes] = await Promise.all([
            // 1. Check Watchlist
            supabase
              .from('watchlist')
              .select('id')
              .eq('movie_id', data.id)
              .eq('media_type', 'tv')
              .eq('user_id', session.user.id)
              .maybeSingle(),
            // 2. Check Completed Vault (and how many extra times it has been watched)
            supabase
              .from('completed_items')
              .select('id, rewatch_count')
              .eq('media_id', showIdStr)
              .eq('media_type', 'tv')
              .eq('user_id', session.user.id)
              .maybeSingle(),
            // 3. Fetch Watched Seasons
            supabase
              .from('watched_seasons')
              .select('season_number')
              .eq('show_id', showIdStr)
              .eq('user_id', session.user.id),
            // 4. Fetch Watched Episodes
            supabase
              .from('watched_episodes')
              .select('episode_id')
              .eq('show_id', showIdStr)
              .eq('user_id', session.user.id),
            // 5. Check Favorites
            supabase
              .from('favorites')
              .select('id')
              .eq('media_id', showIdStr)
              .eq('media_type', 'tv')
              .eq('user_id', session.user.id)
              .maybeSingle(),
          ]);
          if (cancelled) return;

          setIsInWatchlist(!!watchlistRes.data);
          setIsShowCompleted(!!completedRes.data);
          setRewatchCount(completedRes.data?.rewatch_count ?? 0);
          setIsFavorite(!!favoriteRes.data);
          if (seasonsRes.data) setWatchedSeasons(new Set(seasonsRes.data.map(s => s.season_number)));
          if (episodesRes.data) setWatchedEpisodes(new Set(episodesRes.data.map(ep => ep.episode_id)));
        }
      }
      setLoading(false);
    }
    fetchDetailsAndStatus();
    window.scrollTo(0, 0);

    return () => { cancelled = true; };
  }, [id]);

  // Escape closes the episode window
  useEffect(() => {
    if (!selectedEpisode) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setSelectedEpisode(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedEpisode]);

  // --- HELPERS ---

  // Returns the episodes for a season, fetching and caching them if we don't have them yet
  const ensureSeasonEpisodes = async (seasonNumber) => {
    if (seasonData[seasonNumber]) return seasonData[seasonNumber];
    const data = await getSeasonDetails(show.id, seasonNumber);
    const episodes = data?.episodes || [];
    if (data?.episodes) setSeasonData(prev => ({ ...prev, [seasonNumber]: episodes }));
    return episodes;
  };

  // --- BUTTON HANDLERS ---

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
        .eq('movie_id', show.id)
        .eq('media_type', 'tv')
        .eq('user_id', session.user.id);

      if (!error) {
        setIsInWatchlist(false);
        toast.success(`Removed from your queue!`);
      } else {
        toast.error('Failed to remove from queue.');
      }
    } else {
      const showIdStr = show.id.toString();
      const { data: existing } = await supabase
        .from('watchlist')
        .select('id')
        .eq('movie_id', showIdStr)
        .eq('media_type', 'tv')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existing) {
        setIsInWatchlist(true);
      } else {
        const { error } = await supabase
          .from('watchlist')
          .insert([{
            user_id: session.user.id,
            movie_id: show.id,
            title: show.name,
            poster_path: show.poster_path,
            media_type: 'tv',
            release_year: show.first_air_date ? show.first_air_date.substring(0, 4) : null,
            vote_average: show.vote_average ?? null,
          }]);
        if (!error) {
          setIsInWatchlist(true);
          toast.success(`Added to your queue!`);
        } else {
          toast.error('Failed to add to queue.');
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
    const { data, error } = await supabase.rpc('change_rewatch_count', {
      p_media_id: show.id.toString(),
      p_media_type: 'tv',
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
    const showIdStr = show.id.toString();

    if (isFavorite) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('media_id', showIdStr)
        .eq('media_type', 'tv')
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
          media_id: showIdStr,
          media_type: 'tv',
          title: show.name,
          poster_path: show.poster_path ?? null,
          release_year: show.first_air_date ? show.first_air_date.substring(0, 4) : null,
          vote_average: show.vote_average ?? null,
        }]);

      if (!isOk(error)) {
        toast.error("Failed to add to favorites.");
      } else {
        setIsFavorite(true);
        toast.success("Added to favorites!");
      }
    }
    setIsTogglingFavorite(false);
  };

  const handleToggleShowCompleted = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sign in to track shows!");
      navigate('/auth');
      return;
    }

    setIsTogglingShowCompleted(true);
    const showIdStr = show.id.toString();

    if (isShowCompleted) {
      const { error } = await supabase.rpc('uncomplete_item', {
        p_media_id: showIdStr,
        p_media_type: 'tv',
      });

      if (error) {
        toast.error("Failed to remove from completed history.");
      } else {
        setIsShowCompleted(false);
        setRewatchCount(0);
        toast.success("Removed from completed history");
      }
    } else {
      // One atomic database call: saves to the Completed Vault AND removes from the Watchlist
      const { error } = await supabase.rpc('complete_item', {
        p_media_id: showIdStr,
        p_media_type: 'tv',
        p_title: show.name,
        p_poster_path: show.poster_path ?? null,
        p_release_year: show.first_air_date ? show.first_air_date.substring(0, 4) : null,
        p_vote_average: show.vote_average ?? null,
      });

      if (error) {
        toast.error("Failed to save to Completed Vault. Please try again.");
      } else {
        setIsShowCompleted(true);
        setIsInWatchlist(false);
        toast.success("Show Completed & moved to Vault!");
      }
    }
    setIsTogglingShowCompleted(false);
  };

  // --- WATCH TRACKING HELPERS ---

  const showEnded = show?.status === 'Ended' || show?.status === 'Canceled';

  // An episode counts as "aired" when its air date is today or earlier. Episodes with no date are treated
  // as aired only for ended shows (for ongoing shows they are usually "to be announced" placeholders).
  const episodeAired = (ep) => (ep.air_date ? ep.air_date <= new Date().toISOString().slice(0, 10) : showEnded);

  const getEpisodeRuntime = (ep) => ep.runtime ?? show.episode_run_time?.[0] ?? null;

  // Adds the show to the Watching queue the first time any episode is marked (never if it is already in the Vault)
  const ensureInWatchlist = async (session) => {
    if (isInWatchlist || isShowCompleted) return;
    const { error } = await supabase
      .from('watchlist')
      .insert([{
        user_id: session.user.id,
        movie_id: show.id,
        title: show.name,
        poster_path: show.poster_path,
        media_type: 'tv',
        release_year: show.first_air_date ? show.first_air_date.substring(0, 4) : null,
        vote_average: show.vote_average ?? null,
      }]);

    if (isOk(error)) {
      setIsInWatchlist(true);
      if (!error) toast.success('Added to your queue!');
    }
  };

  // Moves an ENDED show to the Completed Vault once every regular season is fully watched.
  // Ongoing shows stay in Watching. Returns true if the show was moved.
  const maybeAutoComplete = async (watchedSeasonSet) => {
    if (isShowCompleted || !showEnded) return false;

    const requiredSeasons = (show.seasons || []).filter(s => s.season_number > 0 && s.episode_count > 0);
    if (requiredSeasons.length === 0 || !requiredSeasons.every(s => watchedSeasonSet.has(s.season_number))) return false;

    const { error } = await supabase.rpc('complete_item', {
      p_media_id: show.id.toString(),
      p_media_type: 'tv',
      p_title: show.name,
      p_poster_path: show.poster_path ?? null,
      p_release_year: show.first_air_date ? show.first_air_date.substring(0, 4) : null,
      p_vote_average: show.vote_average ?? null,
    });

    if (error) {
      toast.error('You watched everything, but the show could not be moved to the Vault.');
      return false;
    }

    setIsShowCompleted(true);
    setIsInWatchlist(false);
    toast.success('Series finished! Moved to your Completed Vault.');
    return true;
  };

  // Keeps a season's "Watched" flag in step with its episodes. Returns the updated set of watched seasons.
  const syncSeasonFlag = async (session, seasonNumber, episodes, watchedEpisodeSet) => {
    const next = new Set(watchedSeasons);
    if (episodes.length === 0) return next;

    const airedIds = episodes.filter(episodeAired).map(ep => ep.id.toString());
    const allWatched = airedIds.length > 0 && airedIds.every(id => watchedEpisodeSet.has(id));
    const flagged = next.has(seasonNumber);
    const showIdStr = show.id.toString();

    if (allWatched && !flagged) {
      const { error } = await supabase
        .from('watched_seasons')
        .upsert({
          user_id: session.user.id,
          show_id: showIdStr,
          season_number: seasonNumber
        }, { onConflict: 'user_id,show_id,season_number', ignoreDuplicates: true });
      if (error) throw error;
      next.add(seasonNumber);
    } else if (!allWatched && flagged) {
      const { error } = await supabase
        .from('watched_seasons')
        .delete()
        .eq('show_id', showIdStr)
        .eq('season_number', seasonNumber)
        .eq('user_id', session.user.id);
      if (error) throw error;
      next.delete(seasonNumber);
    }

    setWatchedSeasons(next);
    return next;
  };

  // When a season is opened, drop a stale "Watched" flag (e.g. a new episode aired since it was marked)
  const reconcileSeasonFlag = async (seasonNumber, episodes) => {
    if (!watchedSeasons.has(seasonNumber) || episodes.length === 0) return;
    const airedIds = episodes.filter(episodeAired).map(ep => ep.id.toString());
    if (airedIds.every(id => watchedEpisodes.has(id))) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase
      .from('watched_seasons')
      .delete()
      .eq('show_id', show.id.toString())
      .eq('season_number', seasonNumber)
      .eq('user_id', session.user.id);
    if (!error) {
      setWatchedSeasons(prev => { const n = new Set(prev); n.delete(seasonNumber); return n; });
    }
  };

  // --- SEASON & EPISODE HANDLERS ---

  const handleSeasonClick = async (seasonNumber) => {
    if (expandedSeason === seasonNumber) {
      setExpandedSeason(null);
      return;
    }
    setExpandedSeason(seasonNumber);
    if (!seasonData[seasonNumber]) {
      setLoadingSeason(true);
      const episodes = await ensureSeasonEpisodes(seasonNumber);
      setLoadingSeason(false);
      await reconcileSeasonFlag(seasonNumber, episodes);
    }
  };

  const handleMarkSeasonWatched = async (e, seasonNumber) => {
    e.stopPropagation(); 
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sign in to track episodes!");
      navigate('/auth');
      return;
    }

    const isWatched = watchedSeasons.has(seasonNumber);
    const showIdStr = show.id.toString();
    setIsTogglingSeason(true);
    const toastId = toast.loading(isWatched ? `Unmarking Season ${seasonNumber}...` : `Marking Season ${seasonNumber} as watched...`);

    try {
      const episodes = await ensureSeasonEpisodes(seasonNumber);
      const episodeIds = episodes.map(ep => ep.id.toString());

      if (isWatched) {
        // Unmark the season AND all of its episodes so the two never disagree
        const { error: seasonErr } = await supabase
          .from('watched_seasons')
          .delete()
          .eq('show_id', showIdStr)
          .eq('season_number', seasonNumber)
          .eq('user_id', session.user.id);
        if (seasonErr) throw seasonErr;

        if (episodeIds.length > 0) {
          const { error: epErr } = await supabase
            .from('watched_episodes')
            .delete()
            .eq('user_id', session.user.id)
            .in('episode_id', episodeIds);
          if (epErr) throw epErr;
        }

        setWatchedSeasons(prev => { const next = new Set(prev); next.delete(seasonNumber); return next; });
        setWatchedEpisodes(prev => {
          const next = new Set(prev);
          episodeIds.forEach(epId => next.delete(epId));
          return next;
        });
        toast.success(`Season ${seasonNumber} unmarked!`, { id: toastId });
      } else {
        // Only episodes that have already aired are marked (unaired ones can't have been watched)
        const airedEpisodes = episodes.filter(episodeAired);
        if (airedEpisodes.length === 0) {
          toast('No aired episodes in this season yet.', { id: toastId });
          return;
        }

        // Bulk upsert: one request for the whole season instead of one insert per episode.
        // Relies on UNIQUE (user_id, episode_id). ignoreDuplicates = ON CONFLICT DO NOTHING,
        // so episodes you already marked keep their original date.
        const rowsToInsert = airedEpisodes.map(ep => ({
          user_id: session.user.id,
          show_id: showIdStr,
          episode_id: ep.id.toString(),
          runtime_minutes: getEpisodeRuntime(ep),
        }));
        const { error: epErr } = await supabase
          .from('watched_episodes')
          .upsert(rowsToInsert, { onConflict: 'user_id,episode_id', ignoreDuplicates: true });
        if (epErr) throw epErr;

        // Only update the UI after the database confirmed the write
        const nextEpisodes = new Set(watchedEpisodes);
        airedEpisodes.forEach(ep => nextEpisodes.add(ep.id.toString()));
        setWatchedEpisodes(nextEpisodes);

        // Flags the season as watched (all aired episodes are now marked)
        const nextSeasons = await syncSeasonFlag(session, seasonNumber, episodes, nextEpisodes);
        toast.success(`Season ${seasonNumber} marked as watched!`, { id: toastId });

        const completed = await maybeAutoComplete(nextSeasons);
        if (!completed) await ensureInWatchlist(session);
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    } finally {
      setIsTogglingSeason(false);
    }
  };

  const handleEpisodeClick = (episode) => {
    setSelectedEpisode(episode);
  };

  // Marks or unmarks one episode, then keeps the season flag, the queue and the Vault in step
  const setEpisodeWatched = async (episode, markWatched) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sign in to track episodes!");
      navigate('/auth');
      return;
    }

    const epId = episode.id.toString();
    const showIdStr = show.id.toString();

    if (markWatched) {
      const { error } = await supabase
        .from('watched_episodes')
        .insert([{
          user_id: session.user.id,
          show_id: showIdStr,
          episode_id: epId,
          runtime_minutes: getEpisodeRuntime(episode),
        }]);
      if (!isOk(error)) {
        toast.error("Failed to mark episode as watched.");
        return;
      }
    } else {
      const { error } = await supabase
        .from('watched_episodes')
        .delete()
        .eq('episode_id', epId)
        .eq('user_id', session.user.id);
      if (error) {
        toast.error("Failed to unmark episode.");
        return;
      }
    }

    const nextEpisodes = new Set(watchedEpisodes);
    if (markWatched) nextEpisodes.add(epId);
    else nextEpisodes.delete(epId);
    setWatchedEpisodes(nextEpisodes);

    const seasonEpisodes = seasonData[episode.season_number] || [];
    const nextSeasons = await syncSeasonFlag(session, episode.season_number, seasonEpisodes, nextEpisodes);

    if (markWatched) {
      const completed = await maybeAutoComplete(nextSeasons);
      if (!completed) await ensureInWatchlist(session);
    }
  };

  // Used by both the tick button on each episode row and the button inside the episode window
  const toggleEpisodeFromList = async (episode, currentlyWatched) => {
    if (isTogglingWatched) return;
    setIsTogglingWatched(true);
    try {
      await setEpisodeWatched(episode, !currentlyWatched);
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsTogglingWatched(false);
    }
  };

  const toggleEpisodeWatched = () => {
    if (selectedEpisode) toggleEpisodeFromList(selectedEpisode, isEpisodeWatched);
  };

  // --- RENDERING ---

  if (loading) return <DetailsSkeleton />;
  if (!show) return <NotFound kind="show" />;

  const trailer = show.videos?.results?.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');
  const releaseYear = show.first_air_date ? show.first_air_date.substring(0, 4) : null;
  const episodeLength = show.episode_run_time?.[0] ?? null;
  const regularSeasons = (show.seasons || []).filter(s => s.season_number > 0);
  const genres = show.genres?.map(g => g.name).join(', ');

  // Where you are in the show: watched episodes against every episode TMDB lists
  const totalEpisodes = Number(show.number_of_episodes) || 0;
  const watchedCount = Math.min(watchedEpisodes.size, totalEpisodes || watchedEpisodes.size);
  const left = Math.max(0, totalEpisodes - watchedCount);
  const showProgress = totalEpisodes > 0 && (watchedCount > 0 || isInWatchlist || isShowCompleted);

  const actions = (
    <>
      <button onClick={handleToggleWatchlist} disabled={isToggling} aria-pressed={isInWatchlist} className={`btn ${isInWatchlist ? 'btn-on' : 'btn-primary'}`}>
        <Icon name={isInWatchlist ? 'check' : 'plus'} strokeWidth={2.25} />
        {isToggling ? 'Updating…' : isInWatchlist ? 'In your queue' : 'Add to queue'}
      </button>

      <button onClick={handleToggleShowCompleted} disabled={isTogglingShowCompleted} aria-pressed={isShowCompleted} className={`btn ${isShowCompleted ? 'btn-on' : 'btn-quiet'}`}>
        <Icon name={isShowCompleted ? 'check' : 'tv'} strokeWidth={isShowCompleted ? 2.25 : 1.75} />
        {isTogglingShowCompleted ? 'Updating…' : isShowCompleted ? 'Completed' : 'Mark show completed'}
      </button>

      {/* Watched again: appears once this is in your Completed Vault */}
      {isShowCompleted && (
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

      <button onClick={handleToggleFavorite} disabled={isTogglingFavorite} aria-pressed={isFavorite} className={`btn ${isFavorite ? 'btn-on' : 'btn-quiet'}`}>
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
      <TitleHeader
        item={show}
        title={show.name}
        meta={[
          releaseYear,
          `${show.number_of_seasons} ${show.number_of_seasons === 1 ? 'season' : 'seasons'}`,
          episodeLength ? `${episodeLength}m episodes` : null,
          genres,
        ]}
        actions={actions}
      >
        {showProgress && (
          <div className="mt-7 max-w-md" aria-label="Your progress">
            <div className="flex items-baseline justify-between gap-4 text-[15px]">
              <p><span className="font-semibold">{watchedCount}</span> <span className="text-muted">of {totalEpisodes} episodes watched</span></p>
              <p className="text-muted">
                {left === 0 ? 'All caught up' : episodeLength ? `About ${formatDuration(left * episodeLength)} left` : `${left} to go`}
              </p>
            </div>
            <div className="meter mt-2.5" role="img" aria-label={`${watchedCount} of ${totalEpisodes} episodes watched`}>
              <span style={{ width: `${(watchedCount / totalEpisodes) * 100}%` }} />
            </div>
          </div>
        )}
      </TitleHeader>

      <OverviewAndFacts
        item={show}
        facts={[
          ['First aired', formatLongDate(show.first_air_date)],
          ['Seasons', String(show.number_of_seasons ?? '')],
          ['Episodes', totalEpisodes ? String(totalEpisodes) : null],
          ['Episode length', episodeLength ? `${episodeLength}m` : null],
          ['Language', languageName(show.original_language)],
          ['Status', show.status],
        ]}
      >
        <CastRow cast={show.credits?.cast} inline />
      </OverviewAndFacts>

      {/* ---------- Seasons and episodes ---------- */}
      <section className="wrap mt-16" aria-labelledby="seasons-heading">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="seasons-heading" className="text-xl font-bold">Seasons and episodes</h2>
          <p className="text-[13px] text-muted">
            {regularSeasons.length} {regularSeasons.length === 1 ? 'season' : 'seasons'} · tick episodes as you watch them
          </p>
        </div>

        {regularSeasons.length > 0 ? (
          <div className="overflow-hidden rounded-[20px] bg-surface">
            {regularSeasons.map((season, si) => {
              const isSeasonWatched = watchedSeasons.has(season.season_number);
              const isOpen = expandedSeason === season.season_number;
              const episodes = seasonData[season.season_number];
              const seasonWatchedCount = episodes ? episodes.filter(ep => watchedEpisodes.has(ep.id.toString())).length : null;

              return (
                <div key={season.id} className={si > 0 ? 'border-t border-line' : ''}>
                  <div className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-5">
                    <button
                      type="button"
                      onClick={() => handleSeasonClick(season.season_number)}
                      aria-expanded={isOpen}
                      className="group flex min-w-0 flex-1 items-center gap-4 rounded-[12px] text-left"
                    >
                      <img
                        src={getImageUrl(season.poster_path, 'w154')}
                        alt=""
                        className="h-[66px] w-11 flex-none rounded-[4px] bg-raised object-cover"
                        onError={(e) => { e.currentTarget.src = POSTER_FALLBACK; }}
                      />
                      <div className="min-w-0">
                        <h3 className="text-[17px] font-semibold">{season.name}</h3>
                        <p className="text-[13px] text-muted">
                          {seasonWatchedCount !== null ? `${seasonWatchedCount} of ${season.episode_count} watched` : `${season.episode_count} episodes`}
                          {' · '}{season.air_date ? season.air_date.substring(0, 4) : 'Upcoming'}
                        </p>
                      </div>
                      <Icon name="chevronDown" className={`ml-auto h-5 w-5 flex-none text-muted transition-transform duration-500 ease-out-soft group-hover:text-ink ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleMarkSeasonWatched(e, season.season_number)}
                      disabled={isTogglingSeason}
                      aria-pressed={isSeasonWatched}
                      className={`btn btn-sm flex-none ${isSeasonWatched ? 'btn-on' : 'btn-ghost hover:bg-raised'}`}
                    >
                      <Icon name="check" strokeWidth={2.25} className={isSeasonWatched ? '' : 'opacity-60'} />
                      <span className="hidden sm:inline">{isSeasonWatched ? 'Season watched' : 'Mark season watched'}</span>
                      <span className="sm:hidden">{isSeasonWatched ? 'Watched' : 'Season'}</span>
                    </button>
                  </div>

                  {isOpen && (
                    <div className="px-2 pb-3 sm:px-3">
                      {loadingSeason && !episodes ? (
                        <div className="space-y-2 p-2" aria-busy="true">
                          {[0, 1, 2].map(i => <div key={i} className="skeleton h-[76px] rounded-[14px] bg-raised" />)}
                        </div>
                      ) : episodes && episodes.length > 0 ? (
                        <ol className="flex flex-col gap-1">
                          {episodes.map((episode, i) => {
                            const isEpWatched = watchedEpisodes.has(episode.id.toString());
                            return (
                              <li
                                key={episode.id}
                                className="arrive group flex cursor-pointer items-start gap-3 rounded-[14px] p-2 transition-colors duration-200 hover:bg-raised sm:gap-4 sm:p-3"
                                style={{ '--i': Math.min(i, 10) }}
                                onClick={() => handleEpisodeClick(episode)}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleEpisodeFromList(episode, isEpWatched); }}
                                  disabled={isTogglingWatched}
                                  aria-pressed={isEpWatched}
                                  aria-label={isEpWatched ? `Mark episode ${episode.episode_number} as not watched` : `Mark episode ${episode.episode_number} as watched`}
                                  title={isEpWatched ? 'Watched (click to undo)' : 'Mark as watched'}
                                  className="tick mt-0.5"
                                >
                                  <Icon name="check" strokeWidth={2.5} />
                                </button>

                                <div className="relative hidden aspect-video w-36 flex-none overflow-hidden rounded-[8px] bg-raised sm:block">
                                  {episode.still_path ? (
                                    <img src={getImageUrl(episode.still_path, 'w300')} alt="" loading="lazy" className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="grid h-full place-items-center text-[13px] text-muted">E{episode.episode_number}</span>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <h4 className="text-[15px] font-semibold">
                                    <span className="num mr-2 text-muted">{episode.episode_number}</span>
                                    {episode.name}
                                  </h4>
                                  {episode.overview && <p className="mt-1 line-clamp-2 text-sm text-muted">{episode.overview}</p>}
                                  <p className="mt-1 text-[13px] text-muted">
                                    {episode.air_date ? `Aired ${formatLongDate(episode.air_date)}` : 'Air date not announced'}
                                    {episode.runtime ? ` · ${episode.runtime}m` : ''}
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      ) : (
                        <p className="px-3 py-4 text-[15px] text-muted">TMDB has no episodes listed for this season yet.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[96px] items-center rounded-[20px] bg-surface px-6">
            <p className="text-[15px] text-muted">TMDB has no season information for this show yet.</p>
          </div>
        )}
      </section>

      {/* Photos, reviews and similar shows. key resets its open/closed state when you move to another show */}
      <DetailsExtras key={show.id} item={show} mediaType="tv" />

      {/* ---------- Episode window ---------- */}
      {selectedEpisode && (
        <div className="fixed inset-0 z-[60] grid place-items-end p-0 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label={selectedEpisode.name}>
          <div className="dialog-backdrop" onClick={() => setSelectedEpisode(null)} />
          <div className="dialog-panel relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[24px] bg-float sm:rounded-[24px]">
            {selectedEpisode.still_path && (
              <img src={getImageUrl(selectedEpisode.still_path, 'w780')} alt="" className="aspect-video w-full flex-none object-cover" />
            )}
            <div className="overflow-y-auto p-6 sm:p-8">
              <p className="text-[13px] font-semibold text-muted">
                Season {selectedEpisode.season_number}, episode {selectedEpisode.episode_number}
              </p>
              <h2 className="mt-1 text-2xl font-bold">{selectedEpisode.name}</h2>
              <p className="mt-1 text-[15px] text-muted">
                {selectedEpisode.air_date ? formatLongDate(selectedEpisode.air_date) : 'Air date not announced'}
                {selectedEpisode.runtime ? ` · ${selectedEpisode.runtime}m` : ''}
              </p>
              <p className="mt-5 leading-relaxed">{selectedEpisode.overview || 'TMDB has no overview for this episode yet.'}</p>

              <div className="mt-7 flex gap-2">
                <button
                  onClick={toggleEpisodeWatched}
                  disabled={isTogglingWatched}
                  aria-pressed={isEpisodeWatched}
                  className={`btn btn-lg flex-1 ${isEpisodeWatched ? 'btn-on' : 'btn-primary'}`}
                >
                  <Icon name="check" strokeWidth={2.25} />
                  {isTogglingWatched ? 'Updating…' : isEpisodeWatched ? 'Watched' : 'Mark as watched'}
                </button>
                <button onClick={() => setSelectedEpisode(null)} className="btn btn-lg btn-quiet">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTrailerOpen && trailer && <TrailerDialog trailer={trailer} title={show.name} onClose={() => setIsTrailerOpen(false)} />}
    </div>
  );
}
