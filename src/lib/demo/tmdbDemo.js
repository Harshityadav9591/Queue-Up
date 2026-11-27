// Offline stand-ins for the TMDB calls in lib/tmdb.js. Same return shapes, served from catalogue.js.
import { MOVIES, SHOWS, MOVIE_GENRES, TV_GENRES } from './catalogue';

const PAGE_SIZE = 20;
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

const genreName = (type, id) => (type === 'tv' ? TV_GENRES : MOVIE_GENRES).find((g) => g.id === id)?.name;

function listItem(type, item) {
  const { cast, seasons, ...rest } = item;
  return { ...rest, media_type: type };
}

const pool = (type) => (type === 'tv' ? SHOWS : MOVIES);
const dateOf = (item) => item.release_date || item.first_air_date || '';
const titleOf = (item) => item.title || item.name || '';

export async function getGenres(type = 'movie') {
  await delay(60);
  return type === 'tv' ? TV_GENRES : MOVIE_GENRES;
}

export async function getDiscoverContent(type = 'movie', page = 1, genre = '', year = '', language = '', sortBy = 'popularity') {
  await delay();
  const genres = (Array.isArray(genre) ? genre : String(genre).split(',')).filter(Boolean).map(Number);
  const years = (Array.isArray(year) ? year : String(year).split(',')).filter(Boolean).map(Number);
  const langs = (Array.isArray(language) ? language : String(language).split(',')).filter(Boolean);

  let list = pool(type).filter((item) => {
    const y = Number(dateOf(item).slice(0, 4));
    if (genres.length && !genres.some((g) => item.genre_ids.includes(g))) return false;
    if (years.length && (y < Math.min(...years) || y > Math.max(...years))) return false;
    if (langs.length && !langs.includes(item.original_language)) return false;
    return true;
  });

  const sorters = {
    rating_desc: (a, b) => b.vote_average - a.vote_average,
    rating_asc: (a, b) => a.vote_average - b.vote_average,
    year_desc: (a, b) => dateOf(b).localeCompare(dateOf(a)),
    year_asc: (a, b) => dateOf(a).localeCompare(dateOf(b)),
    name_asc: (a, b) => titleOf(a).localeCompare(titleOf(b)),
    name_desc: (a, b) => titleOf(b).localeCompare(titleOf(a)),
  };
  if (sorters[sortBy]) list = [...list].sort(sorters[sortBy]);

  return list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => {
    const { media_type, ...rest } = listItem(type, item);
    return rest;
  });
}

function search(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const match = (item) => titleOf(item).toLowerCase().includes(q);
  return [
    ...MOVIES.filter(match).map((m) => listItem('movie', m)),
    ...SHOWS.filter(match).map((s) => listItem('tv', s)),
  ].sort((a, b) => b.vote_count - a.vote_count);
}

export async function searchContent(query, page = 1) {
  await delay();
  return search(query).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

export async function searchContentLive(query) {
  await delay(140);
  return search(query);
}

export async function searchMovies(query) {
  await delay();
  return search(query).filter((r) => r.media_type === 'movie');
}

function similarTo(type, item) {
  return pool(type)
    .filter((other) => other.id !== item.id && other.genre_ids.some((g) => item.genre_ids.includes(g)))
    .slice(0, 12)
    .map((other) => listItem(type, other));
}

function extras(type, item) {
  return {
    genres: item.genre_ids.map((id) => ({ id, name: genreName(type, id) })).filter((g) => g.name),
    tagline: '',
    credits: { cast: item.cast || [] },
    videos: { results: [] },
    images: { backdrops: item.backdrop_path ? [{ file_path: item.backdrop_path, iso_639_1: null }] : [] },
    reviews: { results: [] },
    similar: { results: similarTo(type, item) },
    recommendations: { results: [] },
  };
}

export async function getMovieDetails(id) {
  await delay(260);
  const movie = MOVIES.find((m) => String(m.id) === String(id));
  if (!movie) return null;
  const { cast, ...rest } = movie;
  return { ...rest, status: 'Released', ...extras('movie', movie) };
}

function seasonList(show) {
  return show.seasons.map(([count, year], i) => ({
    id: show.id * 100 + i + 1,
    season_number: i + 1,
    name: `Season ${i + 1}`,
    episode_count: count,
    air_date: `${year}-01-10`,
    poster_path: show.poster_path,
  }));
}

export async function getShowDetails(id) {
  await delay(260);
  const show = SHOWS.find((s) => String(s.id) === String(id));
  if (!show) return null;
  const { cast, seasons, ...rest } = show;
  const list = seasonList(show);
  return {
    ...rest,
    seasons: list,
    number_of_seasons: list.length,
    number_of_episodes: list.reduce((sum, s) => sum + s.episode_count, 0),
    ...extras('tv', show),
  };
}

export async function getSeasonDetails(showId, seasonNumber) {
  await delay(200);
  const show = SHOWS.find((s) => String(s.id) === String(showId));
  const season = show?.seasons[seasonNumber - 1];
  if (!season) return { episodes: [] };
  const [count, year] = season;
  const start = new Date(Date.UTC(year, 0, 10));
  return {
    episodes: Array.from({ length: count }, (_, i) => {
      const aired = new Date(start.getTime() + i * 7 * 86400000);
      return {
        id: show.id * 10000 + seasonNumber * 100 + i + 1,
        season_number: seasonNumber,
        episode_number: i + 1,
        name: `Episode ${i + 1}`,
        overview: '',
        air_date: aired.toISOString().slice(0, 10),
        runtime: show.episode_run_time[0],
        still_path: null,
      };
    }),
  };
}

export async function getMediaMeta(type, id) {
  const item = pool(type).find((x) => String(x.id) === String(id));
  if (!item) return null;
  const date = dateOf(item);
  return {
    release_year: date ? date.slice(0, 4) : null,
    vote_average: item.vote_average,
    runtime: item.runtime ?? item.episode_run_time?.[0] ?? null,
  };
}

export async function getShowBasics(id) {
  const show = SHOWS.find((s) => String(s.id) === String(id));
  if (!show) return null;
  return { seasons: seasonList(show), episode_run_time: show.episode_run_time };
}

// Titles for the landing page reel, in the order they are cued
export const REEL = {
  movie: [693134, 496243, 129, 157336, 545611, 872585, 792307, 569094],
  tv: [209867, 95396, 1396, 94605, 70523, 87108, 100088, 1429],
};

export function reelItems(type) {
  return REEL[type]
    .map((id) => pool(type).find((x) => x.id === id))
    .filter(Boolean)
    .map((item) => listItem(type, item));
}
