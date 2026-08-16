import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getShowDetails, getSeasonDetails, getImageUrl } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

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
  const [isEpisodeWatched, setIsEpisodeWatched] = useState(false);
  const [isTogglingWatched, setIsTogglingWatched] = useState(false);

  useEffect(() => {
    async function fetchDetailsAndStatus() {
      setLoading(true);
      const data = await getShowDetails(id);
      setShow(data);

      if (data) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // 1. Check Watchlist
          const { data: watchlistItem } = await supabase
            .from('watchlist')
            .select('id')
            .eq('movie_id', data.id)
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (watchlistItem) setIsInWatchlist(true);

          // 2. Check Completed Vault
          const { data: completedItem } = await supabase
            .from('completed_items')
            .select('id')
            .eq('media_id', data.id.toString())
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (completedItem) setIsShowCompleted(true);

          // 3. Fetch Watched Seasons
          const { data: seasonsData } = await supabase
            .from('watched_seasons')
            .select('season_number')
            .eq('show_id', data.id.toString())
            .eq('user_id', session.user.id);
          if (seasonsData) {
            setWatchedSeasons(new Set(seasonsData.map(s => s.season_number)));
          }

          // 4. Fetch Watched Episodes
          const { data: episodesData } = await supabase
            .from('watched_episodes')
            .select('episode_id')
            .eq('show_id', data.id.toString())
            .eq('user_id', session.user.id);
          if (episodesData) {
            setWatchedEpisodes(new Set(episodesData.map(ep => ep.episode_id)));
          }
        }
      }
      setLoading(false);
    }
    fetchDetailsAndStatus();
    window.scrollTo(0, 0);
  }, [id]);

  // --- BUTTON HANDLERS ---

  const handleToggleWatchlist = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error("Please sign in to manage your queue!");

    setIsToggling(true);
    if (isInWatchlist) {
      await supabase.from('watchlist').delete().eq('movie_id', show.id).eq('user_id', session.user.id);
      setIsInWatchlist(false);
      toast.success(`Removed from your queue!`);
    } else {
      const showIdStr = show.id.toString();
      const { data: existing } = await supabase
        .from('watchlist')
        .select('id')
        .eq('movie_id', showIdStr)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existing) {
        setIsInWatchlist(true);
      } else {
        const { error } = await supabase
          .from('watchlist')
          .insert([{ user_id: session.user.id, movie_id: show.id, title: show.name, poster_path: show.poster_path, media_type: 'tv' }]);
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

  const handleToggleShowCompleted = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error("Sign in to track shows!");

    setIsTogglingShowCompleted(true);
    const showIdStr = show.id.toString();

    if (isShowCompleted) {
      await supabase.from('completed_items').delete().eq('media_id', showIdStr).eq('user_id', session.user.id);
      setIsShowCompleted(false);
      toast.success("Removed from completed history");
    } else {
      // Add to Completed Vault
      await supabase.from('completed_items').insert([{
        user_id: session.user.id,
        media_id: showIdStr,
        title: show.name,
        poster_path: show.poster_path,
        media_type: 'tv'
      }]);
      
      // Auto-remove from Watchlist
      await supabase.from('watchlist').delete().eq('movie_id', showIdStr).eq('user_id', session.user.id);
      setIsInWatchlist(false);

      setIsShowCompleted(true);
      toast.success("Show Completed & moved to Vault!");
    }
    setIsTogglingShowCompleted(false);
  };

  const handleSeasonClick = async (seasonNumber) => {
    if (expandedSeason === seasonNumber) {
      setExpandedSeason(null);
      return;
    }
    setExpandedSeason(seasonNumber);
    if (!seasonData[seasonNumber]) {
      setLoadingSeason(true);
      const data = await getSeasonDetails(show.id, seasonNumber);
      if (data) setSeasonData(prev => ({ ...prev, [seasonNumber]: data.episodes }));
      setLoadingSeason(false);
    }
  };

  const handleMarkSeasonWatched = async (e, seasonNumber) => {
    e.stopPropagation(); 
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error("Sign in to track episodes!");

    const isWatched = watchedSeasons.has(seasonNumber);
    setIsTogglingSeason(true);
    const toastId = toast.loading(isWatched ? `Unmarking Season ${seasonNumber}...` : `Marking Season ${seasonNumber} as watched...`);

    try {
      if (isWatched) {
        await supabase.from('watched_seasons').delete().eq('show_id', show.id.toString()).eq('season_number', seasonNumber).eq('user_id', session.user.id);
        setWatchedSeasons(prev => { const next = new Set(prev); next.delete(seasonNumber); return next; });
        toast.success(`Season ${seasonNumber} unmarked!`, { id: toastId });
      } else {
        let episodes = seasonData[seasonNumber];
        if (!episodes) {
          const data = await getSeasonDetails(show.id, seasonNumber);
          episodes = data?.episodes || [];
          setSeasonData(prev => ({ ...prev, [seasonNumber]: episodes }));
        }

        if (episodes.length > 0) {
          const rowsToInsert = episodes.map(ep => ({
            user_id: session.user.id,
            show_id: show.id.toString(),
            episode_id: ep.id.toString()
          }));
          await supabase.from('watched_episodes').upsert(rowsToInsert, { onConflict: 'user_id, episode_id', ignoreDuplicates: true });
        }

        await supabase.from('watched_seasons').upsert({
          user_id: session.user.id,
          show_id: show.id.toString(),
          season_number: seasonNumber
        }, { onConflict: 'user_id, show_id, season_number', ignoreDuplicates: true });

        setWatchedSeasons(prev => new Set(prev).add(seasonNumber));
        setWatchedEpisodes(prev => {
          const next = new Set(prev);
          episodes.forEach(ep => next.add(ep.id.toString()));
          return next;
        });

        toast.success(`Season ${seasonNumber} marked as watched!`, { id: toastId });
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    }
    setIsTogglingSeason(false);
  };

  const handleEpisodeClick = (episode) => {
    setSelectedEpisode(episode);
    setIsEpisodeWatched(watchedEpisodes.has(episode.id.toString()));
  };

  const toggleEpisodeWatched = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error("Sign in to track episodes!");

    setIsTogglingWatched(true);
    const epId = selectedEpisode.id.toString();

    if (isEpisodeWatched) {
      await supabase.from('watched_episodes').delete().eq('episode_id', epId).eq('user_id', session.user.id);
      setIsEpisodeWatched(false);
      setWatchedEpisodes(prev => { const n = new Set(prev); n.delete(epId); return n; });
    } else {
      await supabase.from('watched_episodes').insert([{ user_id: session.user.id, show_id: show.id.toString(), episode_id: epId }]);
      setIsEpisodeWatched(true);
      setWatchedEpisodes(prev => new Set(prev).add(epId));
    }
    setIsTogglingWatched(false);
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
                            {isEpWatched && (
                              <div className="absolute top-4 right-4 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm z-10">
                                ✓ Watched
                              </div>
                            )}

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
                            <div className="flex-grow pr-8">
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 transition-all">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#0b101e] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            <button onClick={() => setSelectedEpisode(null)} className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors font-bold">✕</button>

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
