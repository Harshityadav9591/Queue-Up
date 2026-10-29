import { supabase } from './supabase';

// Finds public profiles whose username or nickname matches. Private profiles never come back
// (the database function enforces that), and at least 2 characters are needed.
export async function searchPeople(query, limit = 8, signal) {
  const q = (query || '').replace(/^\s*@/, '').trim();
  if (q.length < 2) return [];

  let request = supabase.rpc('search_public_profiles', { p_query: q, p_limit: limit });
  if (signal) request = request.abortSignal(signal);

  const { data, error } = await request;
  if (error) {
    if (!signal?.aborted) console.error('People search failed:', error.message);
    return [];
  }
  return (data || []).map((p) => ({ ...p, followers_count: Number(p.followers_count) }));
}

export const followersLabel = (n) => `${n} ${n === 1 ? 'follower' : 'followers'}`;
