import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

// Notice I added 'linkUrl' to the props here
export default function MovieCard({ id, title, genre, releaseYear, posterUrl, linkUrl, mediaType = 'movie', posterPath, initialInWatchlist = false, onRemoved }) {
  
  // If linkUrl is provided (like from the Discover page), use it. Otherwise, default to movie.
  const destination = linkUrl ? linkUrl : `/movie/${id}`;
  const navigate = useNavigate();

  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    setInWatchlist(initialInWatchlist);
  }, [initialInWatchlist]);

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
      // Remove from watchlist
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('movie_id', id.toString())
        .eq('user_id', session.user.id);

      if (error) {
        toast.error('Failed to remove from queue.');
      } else {
        setInWatchlist(false);
        toast.success(`"${title}" removed from your queue!`);
        if (onRemoved) onRemoved(id);
      }
    } else {
      // Check first to prevent duplicates without needing a DB unique constraint
      const { data: existing } = await supabase
        .from('watchlist')
        .select('id')
        .eq('movie_id', id.toString())
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existing) {
        // Already exists — just sync local state silently
        setInWatchlist(true);
      } else {
        const { error } = await supabase
          .from('watchlist')
          .insert([{
            user_id: session.user.id,
            movie_id: id.toString(),
            title: title,
            poster_path: posterPath || null,
            media_type: mediaType,
          }]);

        if (error) {
          toast.error('Failed to add to queue.');
        } else {
          setInWatchlist(true);
          toast.success(`"${title}" added to your queue!`);
        }
      }
    }

    setIsAdding(false);
  };

  return (
    <Link to={destination} className="group relative block w-full h-full">
      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm hover:shadow-xl dark:hover:shadow-[0_0_20px_rgba(0,240,255,0.15)] transform hover:-translate-y-2 transition-all duration-300 h-full flex flex-col">
        
        {/* Poster Image */}
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
          {posterUrl ? (
            <img 
              src={posterUrl} 
              alt={title} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              No Image
            </div>
          )}
          {/* Overlay gradient on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

          {/* Quick Add / Remove Watchlist Button */}
          <button
            onClick={handleQuickAdd}
            disabled={isAdding}
            title={inWatchlist ? 'Remove from Queue' : 'Add to Queue'}
            className={[
              'absolute top-2 right-2 z-10 group/btn',
              'w-9 h-9 rounded-full flex items-center justify-center',
              'text-white font-bold text-lg leading-none',
              'shadow-lg backdrop-blur-sm',
              'opacity-0 group-hover:opacity-100',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-cyan-400',
              inWatchlist
                ? 'bg-emerald-500 hover:bg-red-500 scale-100'
                : 'bg-black/50 hover:bg-[#00f0ff] hover:text-[#0b101e] scale-90 group-hover:scale-100',
              isAdding ? 'cursor-wait' : 'cursor-pointer',
            ].join(' ')}
          >
            {isAdding ? (
              /* Spinner */
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : inWatchlist ? (
              /* Checkmark at rest → X (remove) on hover, crossfade */
              <span className="relative w-4 h-4 flex items-center justify-center">
                {/* Checkmark — visible at rest, fades out on button hover */}
                <svg
                  className="absolute inset-0 w-4 h-4 transition-all duration-150 group-hover/btn:opacity-0 group-hover/btn:scale-50"
                  fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {/* X (remove) — hidden at rest, appears on button hover */}
                <svg
                  className="absolute inset-0 w-4 h-4 opacity-0 scale-50 transition-all duration-150 group-hover/btn:opacity-100 group-hover/btn:scale-100"
                  fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            ) : (
              /* Plus icon */
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        </div>
        
        {/* Card Content */}
        <div className="p-4 flex-grow flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate transition-colors" title={title}>
              {title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 transition-colors">
              {genre}
            </p>
          </div>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-3 transition-colors">
            {releaseYear}
          </p>
        </div>

      </div>
    </Link>
  );
}