import { Link } from 'react-router-dom';
import { getImageUrl, POSTER_FALLBACK } from '../../lib/tmdb';
import Segmented from '../ui/Segmented';
import Icon from '../ui/Icon';

const ROW_LIMIT = 200;

// ---------- Horizontal poster row ----------
export default function MediaRow({ title, items, emptyText, tabs, showCount = true, action }) {
  return (
    <section className="mt-14">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          {title}
          {showCount && (
            <span className="num ml-2 font-normal text-muted">
              {items.length}{items.length >= ROW_LIMIT ? '+' : ''}
            </span>
          )}
        </h2>

        {tabs && (
          <Segmented
            size="sm"
            label={`${title}: which list`}
            options={tabs.options}
            value={tabs.value}
            onChange={tabs.onChange}
          />
        )}
        {action}
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-[120px] items-center rounded-[20px] bg-surface px-6">
          <p className="text-[15px] text-muted">{emptyText}</p>
        </div>
      ) : (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {items.map((item, i) => (
            <Link
              key={item.key}
              to={`/${item.type}/${item.id}`}
              className="group arrive w-[148px] min-w-[148px] flex-shrink-0 snap-start"
              style={{ '--i': Math.min(i, 8) }}
            >
              <div className="poster">
                <img
                  src={getImageUrl(item.poster_path, 'w342')}
                  alt=""
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = POSTER_FALLBACK; }}
                />
              </div>
              <p className="mt-2.5 truncate text-[15px] font-semibold" title={item.title}>{item.title}</p>
              <p className="flex items-center gap-1.5 text-[13px] text-muted">
                {item.release_year || 'Year unknown'}
                {Number(item.vote_average) > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <Icon name="star" filled className="h-3 w-3 text-data" />
                    <span className="text-ink">{Number(item.vote_average).toFixed(1)}</span>
                  </>
                )}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
