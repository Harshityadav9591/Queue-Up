import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchContent, getImageUrl } from '../lib/tmdb';
import MovieCard from '../components/ui/MovieCard';
import MovieCardSkeleton from '../components/ui/MovieCardSkeleton';
import Button from '../components/ui/Button';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    async function fetchResults() {
      if (!query) return;
      setLoading(true);
      setPage(1);
      
      const data = await searchContent(query, 1);
      setResults(data || []);
      setLoading(false);
    }
    
    fetchResults();
  }, [query]);

  const loadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    const data = await searchContent(query, nextPage);
    setResults(prev => [...prev, ...data]);
    setPage(nextPage);
    setLoadingMore(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] p-8 pt-32 transition-colors duration-500">
      <div className="container mx-auto">
        <div className="mb-10 border-b border-slate-200 dark:border-white/10 pb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white transition-colors">
            Search Results for <span className="text-blue-600 dark:text-[#00f0ff]">"{query}"</span>
          </h1>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
            {[...Array(10)].map((_, index) => (
              <MovieCardSkeleton key={`skeleton-${index}`} />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="flex justify-center items-center h-64 bg-white dark:bg-slate-900/40 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 transition-colors">
            <p className="text-xl font-medium text-slate-500 dark:text-slate-400">
              No movies or TV shows found for that search.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
              {results.map((item, index) => {
                const isTV = item.media_type === 'tv';
                const title = isTV ? item.name : item.title;
                const releaseDate = isTV ? item.first_air_date : item.release_date;
                const year = releaseDate ? releaseDate.substring(0, 4) : 'N/A';
                
                return (
                  <MovieCard 
                    key={`${item.id}-${index}`}
                    id={item.id} 
                    title={title} 
                    genre={isTV ? 'TV Show' : 'Movie'} 
                    releaseYear={year} 
                    posterUrl={getImageUrl(item.poster_path)} 
                    linkUrl={isTV ? `/tv/${item.id}` : `/movie/${item.id}`} 
                  />
                );
              })}
            </div>

            {results.length >= 20 && (
              <div className="flex justify-center mt-12 pb-8">
                <Button 
                  onClick={loadMore} 
                  disabled={loadingMore}
                  className="bg-blue-600 dark:bg-[#00f0ff] text-white dark:text-[#0b101e] hover:bg-blue-700 hover:dark:shadow-[0_0_20px_0_rgba(0,240,255,0.6)] px-10 py-3 font-bold shadow-md transition-all"
                >
                  {loadingMore ? 'Loading...' : 'Load More Results'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}