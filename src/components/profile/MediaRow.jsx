import { Link } from 'react-router-dom';
import { getImageUrl } from '../../lib/tmdb';

const ROW_LIMIT = 200;

// ---------- Horizontal poster row ----------
export default function MediaRow({ title, items, emptyText, tabs }) {
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">
          {title}{' '}
          <span className="text-base font-bold text-slate-400 dark:text-slate-500">
            ({items.length}{items.length >= ROW_LIMIT ? '+' : ''})
          </span>
        </h2>

        {tabs && (
          <div className="flex bg-slate-200 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-300 dark:border-white/10 transition-colors">
            {tabs.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => tabs.onChange(opt.value)}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                  tabs.value === opt.value
                    ? 'bg-white dark:bg-[#0b101e] text-blue-600 dark:text-[#00f0ff] shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex justify-center items-center h-32 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-white/5">
          <p className="font-medium text-slate-500 dark:text-slate-400">{emptyText}</p>
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scrollbar-hide">
          {items.map((item) => (
            <Link
              key={item.key}
              to={`/${item.type}/${item.id}`}
              className="group w-[140px] min-w-[140px] flex-shrink-0 snap-start"
            >
              <div className="aspect-[2/3] overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-slate-200 dark:bg-slate-800 shadow-sm group-hover:shadow-lg transition-all">
                <img
                  src={getImageUrl(item.poster_path, 'w342')}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => { e.target.src = '/movie-poster.jpg'; }}
                />
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white truncate" title={item.title}>{item.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {item.release_year || 'N/A'}
                {Number(item.vote_average) > 0 && ` • ★ ${Number(item.vote_average).toFixed(1)}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
