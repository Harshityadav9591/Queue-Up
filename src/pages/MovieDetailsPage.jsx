import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMovieDetails, getImageUrl } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

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
  
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);

  useEffect(() => {
    async function fetchDetailsAndStatus() {
      setLoading(true);
      const data = await getMovieDetails(id);
      
      // DEBUG LOG: Check your browser console! If 'credits' is missing here, you need to hard-refresh (Ctrl+F5)
      console.log("TMDB Movie Data:", data); 
      
      setMovie(data);

      if (data) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Check Watchlist
          const { data: watchlistItem } = await supabase
            .from('watchlist')
            .select('id')
            .eq('movie_id', data.id.toString())
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (watchlistItem) setIsInWatchlist(true);

          // Check Watched History
          const { data: watchedItem } = await supabase
            .from('watched_movies')
            .select('id')
            .eq('movie_id', data.id.toString())
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (watchedItem) setIsWatched(true);
        }
      }
      setLoading(false);
    }
    
    fetchDetailsAndStatus();
    window.scrollTo(0, 0);
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
        .eq('user_id', session.user.id);

      if (!error) {
        setIsInWatchlist(false);
        toast.success("Removed from your queue!");
      }
    } else {
      const { error } = await supabase
        .from('watchlist')
        .insert([{ user_id: session.user.id, movie_id: movie.id.toString(), title: movie.title, poster_path: movie.poster_path, media_type: 'movie' }]);

      if (!error) {
        setIsInWatchlist(true);
        toast.success("Added to your queue!");
      }
    }
    setIsToggling(false);
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
      // Remove from Watched AND Completed vault
      await supabase.from('watched_movies').delete().eq('movie_id', movieIdStr).eq('user_id', session.user.id);
      await supabase.from('completed_items').delete().eq('media_id', movieIdStr).eq('user_id', session.user.id);
      setIsWatched(false);
      toast.success("Removed from watched history");
    } else {
      // 1. Add to old watched table
      await supabase.from('watched_movies').insert([{ user_id: session.user.id, movie_id: movieIdStr }]);
      
      // 2. Add to New Completed Vault
      await supabase.from('completed_items').insert([{
        user_id: session.user.id,
        media_id: movieIdStr,
        title: movie.title,
        poster_path: movie.poster_path,
        media_type: 'movie'
      }]);

      // 3. AUTO-REMOVE FROM QUEUE
      await supabase.from('watchlist').delete().eq('movie_id', movieIdStr).eq('user_id', session.user.id);
      setIsInWatchlist(false);

      setIsWatched(true);
      toast.success("Marked as watched & moved to Completed Vault!");
    }
    setIsTogglingWatched(false);
  };

  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] flex justify-center items-center"><p className="text-2xl font-bold text-slate-900 dark:text-white">Loading...</p></div>;
  if (!movie) return <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] flex flex-col justify-center items-center gap-4"><p className="text-2xl font-bold text-slate-900 dark:text-white">Movie not found.</p></div>;

  const trailer = movie.videos?.results?.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');
  const backdropUrl = getImageUrl(movie.backdrop_path, 'original');
  const posterUrl = getImageUrl(movie.poster_path, 'w500');
  const releaseYear = movie.release_date ? movie.release_date.substring(0, 4) : 'Unknown';
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'N/A';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] pb-16 transition-colors duration-500 pt-20">
      
      {/* Hero Banner */}
      <div className="h-[60vh] md:h-[70vh] w-full bg-cover bg-center relative" style={{ backgroundImage: `url(${backdropUrl})` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-[#0b101e] via-slate-50/80 dark:via-[#0b101e]/80 to-transparent transition-colors duration-500"></div>
        <div className="container mx-auto px-6 h-full flex items-end pb-12 relative z-10">
          <div className="flex flex-col md:flex-row gap-8 items-end md:items-start w-full">
            <img src={posterUrl} alt={movie.title} className="w-48 md:w-64 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10 hidden md:block" />
            
            <div className="text-slate-900 dark:text-white max-w-3xl transition-colors duration-500">
              <h1 className="text-4xl md:text-6xl font-extrabold mb-4">{movie.title} <span className="text-slate-500 dark:text-slate-400 font-normal">({releaseYear})</span></h1>
              
              <div className="flex flex-wrap gap-4 text-sm md:text-base font-medium text-slate-600 dark:text-slate-300 mb-6 transition-colors">
                <span>{movie.release_date}</span><span>•</span><span>{runtime}</span><span>•</span>
                <span className="flex gap-2">
                  {movie.genres?.map(g => <span key={g.id} className="bg-slate-200 dark:bg-white/10 px-2 py-1 rounded-md">{g.name}</span>)}
                </span>
              </div>
              
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-8 italic transition-colors">{movie.tagline}</p>
              <h3 className="text-xl font-bold mb-2">Overview</h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-8 transition-colors">{movie.overview}</p>
              
              <div className="flex flex-wrap gap-4 mt-8">
                {/* Watchlist Button */}
                <button onClick={handleToggleWatchlist} disabled={isToggling} className={`px-8 py-3 rounded-lg font-bold text-lg shadow-lg transition-all ${isInWatchlist ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-blue-600 dark:bg-[#00f0ff] text-white dark:text-[#0b101e] hover:bg-blue-700 hover:-translate-y-1'}`}>
                  {isToggling ? 'Updating...' : isInWatchlist ? '- Remove from Watchlist' : '+ Add to Watchlist'}
                </button>

                {/* Mark as Watched Button */}
                <button onClick={handleToggleWatched} disabled={isTogglingWatched} className={`px-8 py-3 rounded-lg font-bold text-lg shadow-sm transition-all flex items-center gap-2 ${isWatched ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500 hover:bg-emerald-500 hover:text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700'}`}>
                  {isTogglingWatched ? 'Updating...' : isWatched ? '✓ Watched' : 'Mark as Watched'}
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

      {/* --- CAST SECTION --- */}
      {movie.credits?.cast && movie.credits.cast.length > 0 && (
        <div className="container mx-auto px-6 py-8 max-w-5xl border-t border-slate-200 dark:border-white/10 mt-8">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 transition-colors">Top Cast</h2>
          
          <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory scrollbar-hide">
            {movie.credits.cast.slice(0, 15).map((actor) => (
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

      {/* Trailer Modal */}
      {isTrailerOpen && trailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 md:p-12">
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10">
            <button onClick={() => setIsTrailerOpen(false)} className="absolute top-4 right-4 z-10 bg-black/60 hover:bg-red-500 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors font-bold text-xl">✕</button>
            <iframe src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`} title={`${movie.title} Trailer`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
          </div>
        </div>
      )}
    </div>
  );
}
