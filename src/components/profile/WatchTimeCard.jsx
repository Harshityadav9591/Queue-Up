import { useMemo, useState } from 'react';
import { formatDuration } from '../../lib/watchTime';
import Segmented from '../ui/Segmented';

const ZERO_ENTRY = { movie: { minutes: 0, items: 0 }, tv: { minutes: 0, items: 0 } };

// Turns the rows returned by get_watch_stats() into lookup[grain][period][kind]
function buildStatsLookup(rows) {
  const lookup = { all: {}, year: {}, month: {} };
  (rows || []).forEach((r) => {
    const bucket = lookup[r.grain];
    if (!bucket) return;
    if (!bucket[r.period]) bucket[r.period] = { movie: { minutes: 0, items: 0 }, tv: { minutes: 0, items: 0 } };
    bucket[r.period][r.kind] = { minutes: Number(r.minutes), items: Number(r.items) };
  });
  return lookup;
}

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Round hour steps so the top tick sits just above the busiest month (3 to 5 ticks)
function hourScale(maxMinutes) {
  const maxHours = maxMinutes / 60;
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
  const step = steps.find((s) => Math.ceil(maxHours / s) <= 4) || 1000;
  const top = Math.max(step, Math.ceil(maxHours / step) * step);
  const ticks = [];
  for (let h = 0; h <= top; h += step) ticks.push(h);
  return { topMinutes: top * 60, ticks };
}

const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

// ---------- Watch time card ----------
export default function WatchTimeCard({ rows, calculating }) {
  const [period, setPeriod] = useState('all');
  const lookup = useMemo(() => buildStatsLookup(rows), [rows]);

  const now = new Date();
  const grain = period === 'all' ? 'all' : period;
  const periodKey = period === 'all' ? 'all' : period === 'year' ? String(now.getFullYear()) : monthKey(now);
  const entry = lookup[grain][periodKey] || ZERO_ENTRY;

  // Time from before watch dates were tracked is only included in "All time"
  const allEntry = lookup.all.all || ZERO_ENTRY;
  const datedTotal = Object.values(lookup.year).reduce((sum, e) => sum + e.movie.minutes + e.tv.minutes, 0);
  const undatedMinutes = Math.max(0, allEntry.movie.minutes + allEntry.tv.minutes - datedTotal);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const e = lookup.month[monthKey(d)] || ZERO_ENTRY;
    return {
      key: monthKey(d),
      label: d.toLocaleString(undefined, { month: 'short' }),
      title: d.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
      movie: e.movie.minutes,
      tv: e.tv.minutes,
    };
  });
  const { topMinutes, ticks } = hourScale(Math.max(60, ...months.map((m) => m.movie + m.tv)));

  const periods = [
    { value: 'all', label: 'All time' },
    { value: 'year', label: 'This year' },
    { value: 'month', label: 'This month' },
  ];
  const periodWords = { all: 'in total', year: `in ${now.getFullYear()}`, month: `in ${now.toLocaleString(undefined, { month: 'long' })}` };
  const total = entry.movie.minutes + entry.tv.minutes;

  return (
    <section className="rounded-[20px] bg-surface p-5 sm:p-7" aria-labelledby="watch-time-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="watch-time-heading" className="text-xl font-bold">Watch time</h2>
        <Segmented size="sm" label="Watch time period" options={periods} value={period} onChange={setPeriod} />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-end">
        {/* The answer first: how long, then what it is made of */}
        <div>
          <p className="num text-[40px] font-bold leading-none tracking-[-0.03em]">{formatDuration(total)}</p>
          <p className="mt-2 text-[15px] text-muted">watched {periodWords[period]}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <dt className="flex items-center gap-2 text-[13px] text-muted">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-data" aria-hidden="true" />Movies
              </dt>
              <dd className="num mt-1 text-xl font-semibold">{formatDuration(entry.movie.minutes)}</dd>
              <dd className="text-[13px] text-muted">{plural(entry.movie.items, 'watch', 'watches')}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-[13px] text-muted">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-data opacity-45" aria-hidden="true" />Shows
              </dt>
              <dd className="num mt-1 text-xl font-semibold">{formatDuration(entry.tv.minutes)}</dd>
              <dd className="text-[13px] text-muted">{plural(entry.tv.items, 'episode', 'episodes')}</dd>
            </div>
          </dl>

          {period === 'all' && undatedMinutes > 0 && (
            <p className="mt-4 text-[13px] text-muted">
              Includes {formatDuration(undatedMinutes)} watched before dates were tracked, so it sits outside the months.
            </p>
          )}
          {calculating && (
            <p className="mt-4 text-[13px] font-semibold">
              Looking up runtimes for older watches. These numbers update when it finishes.
            </p>
          )}
          <p className="mt-4 text-[13px] text-muted">A month counts as 30 days.</p>
        </div>

        {/* Last 12 months, movies and shows stacked, on a scale of round hours */}
        <figure className="min-w-0">
          <figcaption className="mb-3 text-[13px] text-muted">Last 12 months, in hours</figcaption>
          <div className="relative h-44 pl-9">
            {ticks.map((h) => (
              <div
                key={h}
                className="absolute left-9 right-0 flex items-center"
                style={{ bottom: `${(h * 60 / topMinutes) * 100}%` }}
                aria-hidden="true"
              >
                <span className="num absolute -left-9 w-7 -translate-y-px text-right text-xs text-muted">{h}</span>
                <span className={`h-px w-full ${h === 0 ? 'bg-muted/50' : 'bg-line'}`} />
              </div>
            ))}
            <div className="relative flex h-full items-end gap-1.5 sm:gap-2.5">
              {months.map((m, i) => (
                <div
                  key={m.key}
                  className="group/bar flex h-full flex-1 flex-col justify-end"
                  title={`${m.title}: ${formatDuration(m.movie)} of movies, ${formatDuration(m.tv)} of shows`}
                >
                  <div
                    className="flex flex-col justify-end gap-[2px] transition-opacity duration-200 group-hover/bar:opacity-80"
                    style={{ height: `${((m.movie + m.tv) / topMinutes) * 100}%`, transformOrigin: 'bottom', animation: `grow-y .9s var(--ease-out) ${i * 40}ms both` }}
                  >
                    {m.tv > 0 && <div className="rounded-t-[3px] bg-data opacity-45" style={{ flexGrow: m.tv }} />}
                    {m.movie > 0 && <div className={`bg-data ${m.tv > 0 ? '' : 'rounded-t-[3px]'}`} style={{ flexGrow: m.movie }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex gap-1.5 pl-9 sm:gap-2.5" aria-hidden="true">
            {months.map((m, i) => (
              <span key={m.key} className={`flex-1 text-center text-xs text-muted ${(11 - i) % 2 === 1 ? 'max-sm:invisible' : ''}`}>{m.label}</span>
            ))}
          </div>
        </figure>
      </div>
    </section>
  );
}
