const BASE_URL = 'https://api.themoviedb.org/3';
 
// Fetch genres dynamically based on type ('movie' or 'tv')
export async function getGenres(type = 'movie') {
  try {
    const res = await fetch(`${BASE_URL}/genre/${type}/list?api_key=${import.meta.env.VITE_TMDB_API_KEY}`);
    const data = await res.json();
    return data.genres;
  } catch (error) {
    console.error("Error fetching genres:", error);
    return [];
  }
}
 
// Fetch languages dynamically or return popular languages fallback
export const POPULAR_LANGUAGES = [
  { iso_639_1: 'en', english_name: 'English' },
  { iso_639_1: 'hi', english_name: 'Hindi' },
  { iso_639_1: 'es', english_name: 'Spanish' },
  { iso_639_1: 'fr', english_name: 'French' },
  { iso_639_1: 'ja', english_name: 'Japanese' },
  { iso_639_1: 'ko', english_name: 'Korean' },
  { iso_639_1: 'de', english_name: 'German' },
  { iso_639_1: 'it', english_name: 'Italian' },
  { iso_639_1: 'zh', english_name: 'Chinese' },
  { iso_639_1: 'ta', english_name: 'Tamil' },
  { iso_639_1: 'te', english_name: 'Telugu' },
  { iso_639_1: 'ml', english_name: 'Malayalam' },
  { iso_639_1: 'kn', english_name: 'Kannada' },
  { iso_639_1: 'mr', english_name: 'Marathi' },
  { iso_639_1: 'pa', english_name: 'Punjabi' },
  { iso_639_1: 'bn', english_name: 'Bengali' },
  { iso_639_1: 'pt', english_name: 'Portuguese' },
  { iso_639_1: 'ru', english_name: 'Russian' },
  { iso_639_1: 'ar', english_name: 'Arabic' },
  { iso_639_1: 'tr', english_name: 'Turkish' },
];
 
export async function getLanguages() {
  try {
    const res = await fetch(`${BASE_URL}/configuration/languages?api_key=${import.meta.env.VITE_TMDB_API_KEY}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data
        .filter(l => l.iso_639_1 && l.english_name)
        .sort((a, b) => a.english_name.localeCompare(b.english_name));
    }
    return POPULAR_LANGUAGES;
  } catch (error) {
    console.error("Error fetching languages:", error);
    return POPULAR_LANGUAGES;
  }
}
 
// Fetch content dynamically (Movies or TV Shows/Anime)
export async function getDiscoverContent(type = 'movie', page = 1, genre = '', year = '', language = '', sortBy = 'popularity') {
  try {
    const yearParam = type === 'movie' ? 'primary_release_year' : 'first_air_date_year';
    
    let url = `${BASE_URL}/discover/${type}?api_key=${import.meta.env.VITE_TMDB_API_KEY}&page=${page}`;
 
    // Support multiselect for genres using TMDB pipe '|' for OR filtering
    if (genre) {
      const genreVal = Array.isArray(genre) ? genre.join('|') : String(genre).replace(/,/g, '|');
      if (genreVal) url += `&with_genres=${encodeURIComponent(genreVal)}`;
    }
    
    // Support multiselect for release years
    if (year) {
      const yearArr = (Array.isArray(year) ? year : String(year).split(',')).filter(Boolean);
      if (yearArr.length === 1) {
        url += `&${yearParam}=${encodeURIComponent(yearArr[0])}`;
      } else if (yearArr.length > 1) {
        const yearsNum = yearArr.map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
        if (yearsNum.length > 0) {
          const minYear = yearsNum[0];
          const maxYear = yearsNum[yearsNum.length - 1];
          if (type === 'movie') {
            url += `&primary_release_date.gte=${minYear}-01-01&primary_release_date.lte=${maxYear}-12-31`;
          } else {
            url += `&first_air_date.gte=${minYear}-01-01&first_air_date.lte=${maxYear}-12-31`;
          }
        }
      }
    }
    
    // Support multiselect for original languages using TMDB pipe '|' for OR filtering
    if (language) {
      const langVal = Array.isArray(language) ? language.join('|') : String(language).replace(/,/g, '|');
      if (langVal) url += `&with_original_language=${encodeURIComponent(langVal)}`;
    }
 
    // Server-side sorting (applies across ALL results, not just the loaded page).
    // 'popularity' is TMDB's default, so no sort_by param is sent for it.
    const isMovie = type === 'movie';
    const dateField = isMovie ? 'primary_release_date' : 'first_air_date';
    const sortMap = {
      rating_desc: 'vote_average.desc',
      rating_asc: 'vote_average.asc',
      year_desc: `${dateField}.desc`,
      year_asc: `${dateField}.asc`,
      name_asc: isMovie ? 'title.asc' : 'name.asc',
      name_desc: isMovie ? 'title.desc' : 'name.desc',
    };
 
    if (sortMap[sortBy]) {
      url += `&sort_by=${sortMap[sortBy]}`;
 
      // Without a minimum vote count, TMDB ranks obscure titles with a handful of votes first
      const minVotes = sortBy.startsWith('rating') ? (isMovie ? 300 : 150) : 20;
      url += `&vote_count.gte=${minVotes}`;
 
      // "Newest" should not start with unreleased titles (only when no explicit year filter is set)
      if (sortBy === 'year_desc' && !year) {
        const today = new Date().toISOString().slice(0, 10);
        url += `&${dateField}.lte=${today}`;
      }
    }
 
    const res = await fetch(url);
    const data = await res.json();
    return data.results || [];
  } catch (error) {
    console.error("Error fetching content:", error);
    return [];
  }
}
 
export async function searchMovies(query) {
  if (!import.meta.env.VITE_TMDB_API_KEY || !query) return [];
 
  try {
    const response = await fetch(`${BASE_URL}/search/movie?api_key=${import.meta.env.VITE_TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (!response.ok) {
      console.error("TMDB API Error:", data.status_message);
      return [];
    }
    
    return data.results || [];
  } catch (error) {
    console.error("TMDB Search Error:", error);
    return [];
  }
}
 
export function getImageUrl(path, size = 'w500') {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : '/movie-poster.jpg';
}
 
export async function getMovieDetails(id) {
  if (!import.meta.env.VITE_TMDB_API_KEY || !id) return null;
 
  try {
    // append_to_response fetches the cast (credits) and trailers (videos) in the same request
    const response = await fetch(`${BASE_URL}/movie/${id}?api_key=${import.meta.env.VITE_TMDB_API_KEY}&append_to_response=credits,videos`);
    
    if (!response.ok) {
      console.error("TMDB Details API Error:", response.statusText);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("TMDB Fetch Details Error:", error);
    return null;
  }
}
 
// Fetch TV Show / Anime Details
export async function getShowDetails(id) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${id}?api_key=${import.meta.env.VITE_TMDB_API_KEY}&append_to_response=credits,videos`);
    return await res.json();
  } catch (error) {
    console.error("Error fetching show details:", error);
    return null;
  }
}
 
// Fetch individual Season Details (including all episodes)
export async function getSeasonDetails(showId, seasonNumber) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${showId}/season/${seasonNumber}?api_key=${import.meta.env.VITE_TMDB_API_KEY}`);
    return await res.json();
  } catch (error) {
    console.error("Error fetching season details:", error);
    return null;
  }
}
 
// Universal Search (Movies & TV Shows)
export async function searchContent(query, page = 1) {
  try {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${import.meta.env.VITE_TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`);
    const data = await res.json();
    
    // Filter out 'person' results so we only get playable media
    return data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
  } catch (error) {
    console.error("Error searching content:", error);
    return [];
  }
}
 
// Live search for the navbar dropdown (abortable, no page param)
export async function searchContentLive(query, signal) {
  const res = await fetch(
    `${BASE_URL}/search/multi?api_key=${import.meta.env.VITE_TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`,
    { signal }
  );
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
  const data = await res.json();
  return (data.results || []).filter(i => i.media_type === 'movie' || i.media_type === 'tv');
}
 
// Lightweight metadata (no credits/videos), used to backfill release_year and vote_average
export async function getMediaMeta(type, id) {
  try {
    const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${import.meta.env.VITE_TMDB_API_KEY}`);
    if (!res.ok) return null;
    const d = await res.json();
    const date = d.release_date || d.first_air_date || '';
    return {
      release_year: date ? date.slice(0, 4) : null,
      vote_average: typeof d.vote_average === 'number' ? d.vote_average : null,
    };
  } catch {
    return null;
  }
}