import { useMemo, useState } from 'react';
import { formatDuration } from '../../lib/watchTime';

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
  const maxMonth = Math.max(1, ...months.map((m) => m.movie + m.tv));

  const periods = [
    { value: 'all', label: 'All time' },
    { value: 'year', label: 'This year' },
    { value: 'month', label: 'This month' },
  ];

  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-[#0b101e] dark:to-slate-900 border border-slate-700 dark:border-white/10 rounded-xl p-6 md:p-8 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-white font-bold text-lg mb-1">Total Watch Time</h3>
          <p className="text-slate-400 text-sm">Built from the movies and episodes you have marked as watched.</p>
        </div>
        <div className="flex bg-black/30 p-1 rounded-lg border border-white/10 w-fit">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                period === p.value ? 'bg-[#00f0ff] text-[#0b101e]' : 'text-slate-300 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Movies</p>
          <p className="text-2xl font-black text-[#00f0ff]">{formatDuration(entry.movie.minutes)}</p>
          <p className="text-slate-500 text-xs mt-1">{entry.movie.items} watched</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">TV Shows</p>
          <p className="text-2xl font-black text-purple-400">{formatDuration(entry.tv.minutes)}</p>
          <p className="text-slate-500 text-xs mt-1">{entry.tv.items} episodes</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total</p>
          <p className="text-2xl font-black text-white">
            <span className="mr-1">⏱</span>{formatDuration(entry.movie.minutes + entry.tv.minutes)}
          </p>
          <p className="text-slate-500 text-xs mt-1">1 month = 30 days</p>
        </div>
      </div>

      {period === 'all' && undatedMinutes > 0 && (
        <p className="text-slate-500 text-xs italic mt-2">
          Includes {formatDuration(undatedMinutes)} watched before dates were tracked (it can't be placed in a month or year).
        </p>
      )}
      {calculating && (
        <p className="text-amber-400 text-xs font-medium mt-2">
          Calculating runtimes for your watch history… these numbers will update when it finishes.
        </p>
      )}

      {/* Last 12 months */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-slate-300 text-sm font-bold">Last 12 months</p>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#00f0ff]"></span>Movies</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-400"></span>Shows</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 sm:gap-2">
          {months.map((m) => (
            <div
              key={m.key}
              className="flex-1 flex flex-col items-center gap-1.5"
              title={`${m.title}: ${formatDuration(m.movie)} movies, ${formatDuration(m.tv)} shows`}
            >
              <div className="w-full h-28 flex flex-col justify-end rounded-md bg-white/5 overflow-hidden">
                <div className="w-full bg-purple-400" style={{ height: `${(m.tv / maxMonth) * 100}%`, minHeight: m.tv > 0 ? 2 : 0 }}></div>
                <div className="w-full bg-[#00f0ff]" style={{ height: `${(m.movie / maxMonth) * 100}%`, minHeight: m.movie > 0 ? 2 : 0 }}></div>
              </div>
              <span className="text-[10px] sm:text-xs text-slate-400">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
