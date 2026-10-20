import { supabase } from './supabase';
import { getMediaMeta, getShowBasics, getSeasonDetails } from './tmdb';

// Runs fn over items with at most `limit` running at the same time
async function mapPool(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await fn(items[index], index);
    }
  });
  await Promise.all(workers);
}

// 4120 -> "2d 20h", 95 -> "1h 35m". A "month" is counted as 30 days.
export function formatDuration(totalMinutes) {
  const m = Math.max(0, Math.round(totalMinutes || 0));
  if (m === 0) return '0h';

  const days = Math.floor(m / 1440);
  const hours = Math.floor((m % 1440) / 60);
  const mins = m % 60;

  if (days >= 30) return `${Math.floor(days / 30)}mo ${days % 30}d ${hours}h`;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// Rows of { grain: 'all' | 'year' | 'month', period, kind: 'movie' | 'tv', minutes, items }
export async function getWatchStats() {
  const { data, error } = await supabase.rpc('get_watch_stats');
  if (error) {
    console.error('Could not load watch stats:', error.message);
    return [];
  }
  return data || [];
}

// Older watched movies/episodes were saved before runtimes were tracked.
// This looks their runtimes up on TMDB and saves them (a few requests per show, once).
// Returns how many movies + episodes were updated.
export async function backfillRuntimes() {
  let updated = 0;

  // A few passes in case more than one batch is pending; stops as soon as a pass makes no progress
  for (let pass = 0; pass < 5; pass++) {
    const [movieRes, episodeRes] = await Promise.all([
      supabase.from('watched_movies').select('movie_id').is('runtime_minutes', null).limit(500),
      supabase.from('watched_episodes').select('show_id, episode_id').is('runtime_minutes', null).limit(1000),
    ]);

    const pendingMovies = movieRes.data || [];
    const pendingEpisodes = episodeRes.data || [];
    if (pendingMovies.length === 0 && pendingEpisodes.length === 0) break;

    // --- Movies: one lightweight TMDB request each ---
    const movieUpdates = [];
    await mapPool(pendingMovies, 5, async (row) => {
      const meta = await getMediaMeta('movie', row.movie_id);
      // meta is null when the request failed; leave those untouched so they are retried next time
      if (meta) movieUpdates.push({ movie_id: String(row.movie_id), runtime: meta.runtime ?? 0 });
    });

    // --- Episodes: group by show, read each season once, match runtimes by episode id ---
    const byShow = new Map();
    pendingEpisodes.forEach((row) => {
      if (!byShow.has(row.show_id)) byShow.set(row.show_id, new Set());
      byShow.get(row.show_id).add(String(row.episode_id));
    });

    const episodeUpdates = [];
    await mapPool([...byShow.entries()], 3, async ([showId, pendingIds]) => {
      const basics = await getShowBasics(showId);
      if (!basics) return;

      const fallback = basics.episode_run_time?.[0] ?? 0;
      const runtimeByEpisode = new Map();
      const seasons = basics.seasons.filter((s) => s.season_number > 0 && s.episode_count > 0);

      await mapPool(seasons, 3, async (season) => {
        const data = await getSeasonDetails(showId, season.season_number);
        (data?.episodes || []).forEach((ep) => {
          if (ep.runtime) runtimeByEpisode.set(String(ep.id), ep.runtime);
        });
      });

      // Unknown runtimes fall back to the show's typical episode length (or 0), so they are not retried forever
      pendingIds.forEach((id) => {
        episodeUpdates.push({ episode_id: id, runtime: runtimeByEpisode.get(id) ?? fallback });
      });
    });

    if (movieUpdates.length === 0 && episodeUpdates.length === 0) break;

    // --- Save in chunks, using the backfill_runtimes database function ---
    const CHUNK = 400;
    for (let i = 0; i < movieUpdates.length; i += CHUNK) {
      const { error } = await supabase.rpc('backfill_runtimes', { p_movies: movieUpdates.slice(i, i + CHUNK), p_episodes: [] });
      if (error) throw error;
    }
    for (let i = 0; i < episodeUpdates.length; i += CHUNK) {
      const { error } = await supabase.rpc('backfill_runtimes', { p_episodes: episodeUpdates.slice(i, i + CHUNK), p_movies: [] });
      if (error) throw error;
    }

    updated += movieUpdates.length + episodeUpdates.length;
  }

  return updated;
}
