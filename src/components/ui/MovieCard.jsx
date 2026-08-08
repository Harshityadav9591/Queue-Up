import { Link } from 'react-router-dom';

// Notice I added 'linkUrl' to the props here
export default function MovieCard({ id, title, genre, releaseYear, posterUrl, linkUrl }) {
  
  // If linkUrl is provided (like from the Discover page), use it. Otherwise, default to movie.
  const destination = linkUrl ? linkUrl : `/movie/${id}`;

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