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

// Fetch content dynamically (Movies or TV Shows/Anime)
export async function getDiscoverContent(type = 'movie', page = 1, genre = '', year = '') {
  try {
    const yearParam = type === 'movie' ? 'primary_release_year' : 'first_air_date_year';
    
    let url = `${BASE_URL}/discover/${type}?api_key=${import.meta.env.VITE_TMDB_API_KEY}&page=${page}`;

    if (genre) url += `&with_genres=${genre}`;
    if (year) url += `&${yearParam}=${year}`;

    const res = await fetch(url);
    const data = await res.json();
    return data.results;
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
