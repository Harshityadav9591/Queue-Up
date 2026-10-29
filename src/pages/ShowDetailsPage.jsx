import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getShowDetails, getSeasonDetails, getImageUrl } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import DetailsExtras from '../components/details/DetailsExtras';

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

  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] flex justify-center items-center"><p className="text-2xl font-bold text-slate-900 dark:text-white">Loading...</p></div>;
  if (!show) return <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] flex flex-col justify-center items-center gap-4"><p className="text-2xl font-bold text-slate-900 dark:text-white">Show not found.</p></div>;

  const trailer = show.videos?.results?.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');
  const backdropUrl = getImageUrl(show.backdrop_path, 'original');
  const posterUrl = getImageUrl(show.poster_path, 'w500');
  const releaseYear = show.first_air_date ? show.first_air_date.substring(0, 4) : 'Unknown';
  const runtime = show.episode_run_time && show.episode_run_time.length > 0 ? `${show.episode_run_time[0]}m per ep` : 'N/A';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] pb-16 transition-colors duration-500 pt-20">
      
      {/* Hero Banner */}
      <div className="h-[60vh] md:h-[70vh] w-full bg-cover bg-center relative" style={{ backgroundImage: `url(${backdropUrl})` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-[#0b101e] via-slate-50/80 dark:via-[#0b101e]/80 to-transparent transition-colors duration-500"></div>
        <div className="container mx-auto px-6 h-full flex items-end pb-12 relative z-10">
          <div className="flex flex-col md:flex-row gap-8 items-end md:items-start w-full">
            <img src={posterUrl} alt={show.name} className="w-48 md:w-64 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10 hidden md:block" />
            <div className="text-slate-900 dark:text-white max-w-3xl transition-colors duration-500">
              <h1 className="text-4xl md:text-6xl font-extrabold mb-4">{show.name} <span className="text-slate-500 dark:text-slate-400 font-normal">({releaseYear})</span></h1>
              <div className="flex flex-wrap gap-4 text-sm md:text-base font-medium text-slate-600 dark:text-slate-300 mb-6 transition-colors">
                <span>{show.number_of_seasons} Seasons</span><span>•</span><span>{show.number_of_episodes} Episodes</span><span>•</span><span>{runtime}</span>
              </div>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-8 italic">{show.tagline}</p>
              <h3 className="text-xl font-bold mb-2">Overview</h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-8">{show.overview}</p>
              
              {/* Actions Box */}
              <div className="flex flex-wrap gap-4 mt-8">
                
                {/* Watchlist Toggle */}
                <button onClick={handleToggleWatchlist} disabled={isToggling} className={`px-8 py-3 rounded-lg font-bold text-lg shadow-lg transition-all ${isInWatchlist ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-blue-600 dark:bg-[#00f0ff] text-white dark:text-[#0b101e] hover:bg-blue-700 hover:-translate-y-1'}`}>
                  {isToggling ? 'Updating...' : isInWatchlist ? '- Remove from Watchlist' : '+ Add to Watchlist'}
                </button>
                
                {/* Show Completed Toggle */}
                <button onClick={handleToggleShowCompleted} disabled={isTogglingShowCompleted} className={`px-8 py-3 rounded-lg font-bold text-lg shadow-sm transition-all flex items-center gap-2 ${isShowCompleted ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500 hover:bg-emerald-500 hover:text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700'}`}>
                  {isTogglingShowCompleted ? 'Updating...' : isShowCompleted ? '✓ Show Completed' : 'Mark Show as Completed'}
                </button>

                {/* Watched again: appears once this is in your Completed Vault */}
                {isShowCompleted && (
                  <div className="flex items-stretch gap-2">
                    <button
                      onClick={() => handleChangeRewatch(1)}
                      disabled={isChangingRewatch}
                      className="px-6 py-3 rounded-lg font-bold text-lg transition-all flex items-center gap-2 border-2 border-transparent bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-60"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      {rewatchCount === 0 ? 'Watched again' : rewatchCount === 1 ? 'Watched twice' : `Watched ${rewatchCount + 1} times`}
                    </button>
                    {rewatchCount > 0 && (
                      <button
                        onClick={() => handleChangeRewatch(-1)}
                        disabled={isChangingRewatch}
                        aria-label="Remove one watch"
                        title="Remove one watch"
                        className="w-12 rounded-lg font-bold text-xl transition-all bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-red-500 hover:text-white disabled:opacity-60"
                      >
                        −
                      </button>
                    )}
                  </div>
                )}

                {/* Favorite Button */}
                <button
                  onClick={handleToggleFavorite}
                  disabled={isTogglingFavorite}
                  aria-pressed={isFavorite}
                  className={`px-6 py-3 rounded-lg font-bold text-lg shadow-sm transition-all flex items-center gap-2 border-2 ${isFavorite ? 'bg-rose-500/10 text-rose-500 border-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
                >
                  <span>{isFavorite ? '♥' : '♡'}</span>
                  {isTogglingFavorite ? 'Updating...' : isFavorite ? 'Favorited' : 'Favorite'}
                </button>

                {/* Trailer Button */}
                {trailer && (
                  <button onClick={() => setIsTrailerOpen(true)} className="px-8 py-3 rounded-lg font-bold text-lg shadow-sm border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors flex items-center gap-2 bg-white/50 dark:bg-transparent backdrop-blur-md">
                    <span className="text-blue-600 dark:text-[#00f0ff]">▶</span> Watch Trailer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Seasons Section */}
      <div className="container mx-auto px-6 py-12 max-w-5xl">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 transition-colors">Seasons & Episodes</h2>
        
        {show.seasons && show.seasons.length > 0 ? (
          <div className="flex flex-col gap-4">
            {show.seasons.filter(s => s.season_number > 0).map(season => {
              const isSeasonWatched = watchedSeasons.has(season.season_number);
              
              return (
              <div key={season.id} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm transition-colors">
                
                <div onClick={() => handleSeasonClick(season.season_number)} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors gap-4">
                  <div className="flex items-center gap-6">
                    <img src={getImageUrl(season.poster_path, 'w154')} alt={season.name} className="w-16 h-24 object-cover rounded-md bg-slate-200 dark:bg-slate-800" onError={(e) => e.target.src = '/movie-poster.jpg'} />
                    <div>
                      <h4 className="font-extrabold text-xl text-slate-900 dark:text-white">{season.name}</h4>
                      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
                        <span>{season.episode_count} Episodes</span><span>•</span><span>{season.air_date ? season.air_date.substring(0, 4) : 'Upcoming'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-end sm:pr-4">
                    <button
                      onClick={(e) => handleMarkSeasonWatched(e, season.season_number)}
                      disabled={isTogglingSeason}
                      className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                        isSeasonWatched
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500 hover:bg-emerald-500 hover:text-white'
                      }`}
                    >
                      {isSeasonWatched ? '✓ Watched' : 'Mark Season Watched'}
                    </button>
                    <div className="hidden sm:block text-slate-400 text-2xl font-bold">{expandedSeason === season.season_number ? '−' : '+'}</div>
                  </div>
                </div>

                {expandedSeason === season.season_number && (
                  <div className="border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/80 transition-colors">
                    {loadingSeason ? (
                      <div className="p-8 text-center text-slate-500 font-medium">Loading episodes...</div>
                    ) : seasonData[season.season_number] && seasonData[season.season_number].length > 0 ? (
                      <div className="flex flex-col divide-y divide-slate-200 dark:divide-white/5">
                        {seasonData[season.season_number].map(episode => {
                          const isEpWatched = watchedEpisodes.has(episode.id.toString());
                          
                          return (
                          <div 
                            key={episode.id} 
                            onClick={() => handleEpisodeClick(episode)}
                            className="p-6 flex flex-col md:flex-row gap-6 hover:bg-white dark:hover:bg-slate-800/60 cursor-pointer transition-colors relative"
                          >
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleEpisodeFromList(episode, isEpWatched); }}
                              disabled={isTogglingWatched}
                              aria-label={isEpWatched ? 'Mark episode as not watched' : 'Mark episode as watched'}
                              title={isEpWatched ? 'Watched (click to undo)' : 'Mark as watched'}
                              className={`absolute top-4 right-4 md:top-1/2 md:-translate-y-1/2 z-10 w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all disabled:opacity-60 ${
                                isEpWatched
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                                  : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-emerald-500 hover:text-emerald-500'
                              }`}
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </button>

                            <div className="w-full md:w-48 flex-shrink-0 aspect-video rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 relative shadow-sm">
                               {episode.still_path ? (
                                 <img src={getImageUrl(episode.still_path, 'w300')} alt={episode.name} className="w-full h-full object-cover" />
                               ) : (
                                 <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">No Image</div>
                               )}
                               <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-2 py-0.5 rounded font-bold">
                                 {episode.runtime ? `${episode.runtime}m` : ''}
                               </div>
                            </div>
                            <div className="flex-grow pr-16">
                              <h5 className="font-bold text-lg text-slate-900 dark:text-white transition-colors">
                                <span className="text-blue-600 dark:text-slate-400 mr-2">{episode.episode_number}.</span>
                                {episode.name}
                              </h5>
                              <p className="text-slate-600 dark:text-slate-400 text-sm mt-2 leading-relaxed line-clamp-2 transition-colors">
                                {episode.overview || "No overview available."}
                              </p>
                              <p className="text-slate-400 dark:text-slate-500 text-xs mt-3 font-medium transition-colors">Aired: {episode.air_date || 'TBA'}</p>
                            </div>
                          </div>
                        )})}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500 font-medium">No episodes found.</div>
                    )}
                  </div>
                )}
                
              </div>
            )})}
          </div>
        ) : (
          <p className="text-slate-500 italic">Season information not available.</p>
        )}
      </div>

      {/* EPISODE MODAL */}
      {selectedEpisode && (
        <div onClick={() => setSelectedEpisode(null)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 transition-all">
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="relative w-full max-w-2xl bg-white dark:bg-[#0b101e] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            

            <div className="w-full h-48 md:h-64 bg-slate-200 dark:bg-slate-800 relative">
              {selectedEpisode.still_path && <img src={getImageUrl(selectedEpisode.still_path, 'original')} alt={selectedEpisode.name} className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0b101e] via-transparent to-transparent"></div>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto relative z-10 -mt-10">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white drop-shadow-md">
                <span className="text-blue-600 dark:text-[#00f0ff] mr-2">E{selectedEpisode.episode_number}.</span> 
                {selectedEpisode.name}
              </h2>
              
              <div className="flex gap-3 mt-2 mb-6 text-sm font-medium text-slate-500 dark:text-slate-400">
                <span>{selectedEpisode.air_date}</span> • <span>{selectedEpisode.runtime} mins</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-8">{selectedEpisode.overview || "No detailed overview available."}</p>

              <button onClick={toggleEpisodeWatched} disabled={isTogglingWatched} className={`w-full py-4 rounded-xl font-bold text-lg shadow-sm transition-all flex items-center justify-center gap-2 ${isEpisodeWatched ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500 hover:bg-emerald-500 hover:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                {isTogglingWatched ? 'Updating...' : isEpisodeWatched ? '✓ Watched' : 'Mark as Watched'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- CAST SECTION --- */}
      {show.credits?.cast && show.credits.cast.length > 0 && (
        <div className="container mx-auto px-6 py-8 max-w-5xl border-t border-slate-200 dark:border-white/10 mt-8">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 transition-colors">Top Cast</h2>
          
          <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory scrollbar-hide">
            {show.credits.cast.slice(0, 15).map((actor) => (
              <div key={actor.id} className="min-w-[140px] w-[140px] flex-shrink-0 snap-start bg-white dark:bg-slate-800/80 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-white/5 transition-colors">
                {actor.profile_path ? (
                  <img src={getImageUrl(actor.profile_path, 'w185')} alt={actor.name} className="w-full h-[175px] object-cover" />
                ) : (
                  <div className="w-full h-[175px] bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-4xl">👤</div>
                )}
                <div className="p-3">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{actor.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{actor.character}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photos, rating, reviews and similar shows. key resets its open/closed state when you move to another show */}
      <DetailsExtras key={show.id} item={show} mediaType="tv" />

      {/* Main Trailer Modal Overlay */}
      {isTrailerOpen && trailer && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-4 md:p-12">
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10">
            <button onClick={() => setIsTrailerOpen(false)} className="absolute top-4 right-4 z-10 bg-black/60 hover:bg-red-500 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors font-bold text-xl">✕</button>
            <iframe src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`} title={`${show.name} Trailer`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
          </div>
        </div>
      )}
    </div>
  );
}
