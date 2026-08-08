import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getImageUrl } from '../lib/tmdb';
import MovieCard from '../components/ui/MovieCard';
import MovieCardSkeleton from '../components/ui/MovieCardSkeleton';
import { useNavigate } from 'react-router-dom';

export default function QueuePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation States
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' or 'completed'
  const [contentType, setContentType] = useState('movie'); // 'movie' or 'tv'
  
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      // Dynamically select which table to fetch from based on the active tab
      const tableName = activeTab === 'queue' ? 'watchlist' : 'completed_items';

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setItems(data);
      } else {
        setItems([]);
      }
      setLoading(false);
    }

    fetchItems();
  }, [activeTab, navigate]);

  // Filter items instantly based on the content type toggle
  const filteredItems = items.filter(item => {
    const type = item.media_type || 'movie';
    return type === contentType;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] p-8 pt-32 transition-colors duration-500">
      <div className="container mx-auto">
        
        {/* Main Tab Navigation (Queue vs Completed) */}
        <div className="flex gap-8 mb-8 border-b border-slate-200 dark:border-white/10">
          <button
            onClick={() => setActiveTab('queue')}
            className={`pb-4 text-xl font-bold transition-all ${
              activeTab === 'queue' 
                ? 'text-blue-600 dark:text-[#00f0ff] border-b-2 border-blue-600 dark:border-[#00f0ff]' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Watching Queue
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`pb-4 text-xl font-bold transition-all ${
              activeTab === 'completed' 
                ? 'text-blue-600 dark:text-[#00f0ff] border-b-2 border-blue-600 dark:border-[#00f0ff]' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Completed Vault
          </button>
        </div>

        {/* Content Type Toggle (Movies vs TV) */}
        <div className="flex mb-10 bg-slate-200 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-300 dark:border-white/10 w-fit transition-colors">
          <button
            onClick={() => setContentType('movie')}
            className={`px-6 py-2 rounded-md font-bold transition-all ${
              contentType === 'movie' 
                ? 'bg-white dark:bg-[#0b101e] text-blue-600 dark:text-[#00f0ff] shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Movies
          </button>
          <button
            onClick={() => setContentType('tv')}
            className={`px-6 py-2 rounded-md font-bold transition-all ${
              contentType === 'tv' 
                ? 'bg-white dark:bg-[#0b101e] text-blue-600 dark:text-[#00f0ff] shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            TV & Anime
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
            {[...Array(5)].map((_, index) => <MovieCardSkeleton key={`skeleton-${index}`} />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex justify-center items-center h-64 bg-white dark:bg-slate-900/40 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 transition-colors">
            <p className="text-xl font-medium text-slate-500 dark:text-slate-400">
              No {contentType === 'movie' ? 'movies' : 'TV shows'} found in this section.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
            {filteredItems.map((item) => {
              // The watchlist table uses 'movie_id', our new completed table uses 'media_id'. This handles both!
              const targetId = item.media_id || item.movie_id; 
              const type = item.media_type || 'movie';
              
              return (
                <MovieCard 
                  key={item.id}
                  id={targetId} 
                  title={item.title} 
                  genre={activeTab === 'queue' ? 'In Queue' : 'Completed'} 
                  releaseYear="N/A" 
                  posterUrl={getImageUrl(item.poster_path)} 
                  linkUrl={`/${type}/${targetId}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}