// A small in-browser stand-in for the Supabase client, used only when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// are not set. It keeps every table in localStorage and implements just the calls this app makes.
// Any email and password signs in to one sample account that already has a watch history.

const DB_KEY = 'queueup-sample-db-v1';
const SESSION_KEY = 'queueup-sample-session';
const ME = 'sample-user';
const OTHER = 'sample-reelnotes';

const UNIQUE = {
  profiles: [['id'], ['username']],
  watchlist: [['user_id', 'movie_id', 'media_type']],
  favorites: [['user_id', 'media_id', 'media_type']],
  completed_items: [['user_id', 'media_id', 'media_type']],
  watched_movies: [['user_id', 'movie_id']],
  watched_episodes: [['user_id', 'episode_id']],
  watched_seasons: [['user_id', 'show_id', 'season_number']],
  follows: [['follower_id', 'followee_id']],
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const same = (a, b) => String(a ?? '') === String(b ?? '');

// ---------- Seed: one account partway through a year of watching ----------
function monthsAgo(n, day = 12) {
  const d = new Date();
  d.setMonth(d.getMonth() - n, day);
  d.setHours(21, 0, 0, 0);
  return d.toISOString();
}

const M = {
  dune2: [693134, 'Dune: Part Two', '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', '2024', 8.2, 166],
  opp: [872585, 'Oppenheimer', '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', '2023', 8.1, 181],
  verse: [569094, 'Spider-Man: Across the Spider-Verse', '/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg', '2023', 8.3, 140],
  inter: [157336, 'Interstellar', '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', '2014', 8.4, 169],
  parasite: [496243, 'Parasite', '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', '2019', 8.5, 133],
  spirited: [129, 'Spirited Away', '/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', '2001', 8.5, 125],
  eeaao: [545611, 'Everything Everywhere All at Once', '/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg', '2022', 7.8, 140],
  tdk: [155, 'The Dark Knight', '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', '2008', 8.5, 152],
  inception: [27205, 'Inception', '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', '2010', 8.4, 148],
  lalaland: [313369, 'La La Land', '/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', '2016', 7.9, 128],
  pastlives: [666277, 'Past Lives', '/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg', '2023', 7.7, 106],
  poor: [792307, 'Poor Things', '/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg', '2023', 7.7, 141],
  whiplash: [244786, 'Whiplash', '/7fn624j5lj3xTme2SgiLCeuedmO.jpg', '2014', 8.4, 107],
  br2049: [335984, 'Blade Runner 2049', '/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg', '2017', 7.6, 164],
  getout: [419430, 'Get Out', '/tFXcEccSQMf3lfhfXKSU9iRBpa3.jpg', '2017', 7.6, 104],
  madmax: [76341, 'Mad Max: Fury Road', '/hA2ple9q4qnwxp3hKVNhroipsir.jpg', '2015', 7.6, 121],
  godfather: [238, 'The Godfather', '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', '1972', 8.7, 175],
};
const S = {
  bb: [1396, 'Breaking Bad', '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', '2008', 8.9, 47],
  sev: [95396, 'Severance', '/lFf6LLrQjYldcZItzOkGmMMigP7.jpg', '2022', 8.4, 50],
  arcane: [94605, 'Arcane', '/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg', '2021', 8.8, 40],
  dark: [70523, 'Dark', '/apbrbWs8M9lyOpJYU5WXrpFbk1Z.jpg', '2017', 8.4, 55],
  cher: [87108, 'Chernobyl', '/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg', '2019', 8.7, 65],
  flea: [67070, 'Fleabag', '/27vEYsRKa3eAniwmoccOoluEXQ1.jpg', '2016', 8.1, 27],
  frieren: [209867, 'Frieren: Beyond Journey’s End', '/dqZENchTd7lp5zht7BdlqM7RBhD.jpg', '2023', 8.8, 24],
};

const card = ([id, title, poster_path, release_year, vote_average], type) => ({
  title, poster_path, release_year, vote_average, media_type: type, _id: String(id),
});

function seed() {
  const db = Object.fromEntries(Object.keys(UNIQUE).map((t) => [t, []]));
  const add = (table, row, when) => db[table].push({ id: uid(), created_at: when || new Date().toISOString(), ...row });

  db.profiles.push(
    { id: ME, nickname: null, bio: null, avatar_url: null, banner_url: null, username: null, is_public: false },
    { id: OTHER, nickname: 'Reel Notes', bio: 'Slow cinema on weeknights, anime at the weekend.', avatar_url: null, banner_url: null, username: 'reelnotes', is_public: true },
  );

  const queue = (user, entry, type, n) => {
    const { _id, ...c } = card(entry, type);
    add('watchlist', { user_id: user, movie_id: _id, ...c }, monthsAgo(n));
  };
  const complete = (user, entry, type, n, rewatch = 0) => {
    const { _id, ...c } = card(entry, type);
    add('completed_items', { user_id: user, media_id: _id, rewatch_count: rewatch, runtime_minutes: type === 'movie' ? entry[5] : null, ...c }, monthsAgo(n));
    if (type === 'movie') add('watched_movies', { user_id: user, movie_id: _id, runtime_minutes: entry[5] }, monthsAgo(n));
  };
  const episodes = (user, entry, season, count, n) => {
    for (let e = 1; e <= count; e++) {
      add('watched_episodes', { user_id: user, show_id: String(entry[0]), episode_id: String(entry[0] * 10000 + season * 100 + e), runtime_minutes: entry[5] }, monthsAgo(n, Math.min(27, 2 + e)));
    }
  };
  const fav = (user, entry, type, n) => {
    const { _id, ...c } = card(entry, type);
    add('favorites', { user_id: user, media_id: _id, ...c }, monthsAgo(n));
  };

  // The sample account
  [M.pastlives, M.poor, M.whiplash, M.br2049, M.getout, M.madmax].forEach((m, i) => queue(ME, m, 'movie', i));
  [S.bb, S.sev, S.arcane, S.dark].forEach((s, i) => queue(ME, s, 'tv', i));
  complete(ME, M.lalaland, 'movie', 11);
  complete(ME, M.inception, 'movie', 10);
  complete(ME, M.tdk, 'movie', 9, 1);
  complete(ME, M.spirited, 'movie', 8);
  complete(ME, M.parasite, 'movie', 6);
  complete(ME, M.inter, 'movie', 5, 2);
  complete(ME, M.eeaao, 'movie', 4);
  complete(ME, M.verse, 'movie', 2);
  complete(ME, M.opp, 'movie', 1);
  complete(ME, M.dune2, 'movie', 0, 1);
  complete(ME, S.cher, 'tv', 7);
  complete(ME, S.flea, 'tv', 5);
  episodes(ME, S.cher, 1, 5, 7);
  episodes(ME, S.flea, 1, 6, 5);
  episodes(ME, S.flea, 2, 6, 5);
  episodes(ME, S.bb, 1, 7, 3);
  episodes(ME, S.bb, 2, 13, 2);
  episodes(ME, S.bb, 3, 5, 0);
  [[87108, 1], [67070, 1], [67070, 2], [1396, 1], [1396, 2]].forEach(([show, season]) =>
    add('watched_seasons', { user_id: ME, show_id: String(show), season_number: season }));
  [[M.inter, 'movie'], [M.spirited, 'movie'], [M.parasite, 'movie'], [S.cher, 'tv']].forEach(([e, t], i) => fav(ME, e, t, i));

  // A second, public profile so people search, following and public pages have someone to show
  [M.godfather, M.pastlives].forEach((m, i) => queue(OTHER, m, 'movie', i));
  queue(OTHER, S.frieren, 'tv', 0);
  complete(OTHER, M.spirited, 'movie', 3);
  complete(OTHER, M.parasite, 'movie', 2);
  complete(OTHER, M.whiplash, 'movie', 1);
  episodes(OTHER, S.frieren, 1, 12, 1);
  fav(OTHER, M.spirited, 'movie', 0);

  return db;
}

// ---------- Storage ----------
let db;
function load() {
  if (db) return db;
  try {
    db = JSON.parse(localStorage.getItem(DB_KEY)) || null;
  } catch {
    db = null;
  }
  if (!db) {
    db = seed();
    save();
  }
  return db;
}
function save() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

let session = null;
try {
  session = JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
} catch {
  session = null;
}
const listeners = new Set();
function setSession(next) {
  session = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((cb) => cb(next ? 'SIGNED_IN' : 'SIGNED_OUT', next));
}
const me = () => session?.user?.id || null;

const conflictError = () => ({ code: '23505', message: 'duplicate key value violates unique constraint' });

function conflicts(table, row, except) {
  return (UNIQUE[table] || []).some((cols) =>
    load()[table].some((r) => r !== except && cols.every((c) => row[c] != null && same(r[c], row[c]))));
}

// ---------- Query builder ----------
class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.action = 'select';
  }
  select(_cols, opts = {}) {
    if (this.action === 'select') this.opts = opts;
    return this;
  }
  eq(col, val) { this.filters.push((r) => same(r[col], val)); return this; }
  is(col, val) { this.filters.push((r) => (r[col] ?? null) === val); return this; }
  in(col, vals) { const set = new Set(vals.map(String)); this.filters.push((r) => set.has(String(r[col]))); return this; }
  order(col, { ascending = true } = {}) { this.sort = { col, ascending }; return this; }
  limit(n) { this.max = n; return this; }
  maybeSingle() { this.single = true; return this; }
  abortSignal() { return this; }
  insert(rows) { this.action = 'insert'; this.rows = [].concat(rows); return this; }
  upsert(rows, { ignoreDuplicates } = {}) { this.action = 'upsert'; this.rows = [].concat(rows); this.ignore = ignoreDuplicates; return this; }
  update(patch) { this.action = 'update'; this.patch = patch; return this; }
  delete() { this.action = 'delete'; return this; }
  then(resolve, reject) { return new Promise((r) => setTimeout(r, 120)).then(() => this.run()).then(resolve, reject); }

  run() {
    const all = load()[this.table] || (load()[this.table] = []);
    const matches = all.filter((r) => this.filters.every((f) => f(r)));

    if (this.action === 'insert' || this.action === 'upsert') {
      for (const row of this.rows) {
        const full = { id: uid(), created_at: new Date().toISOString(), ...row };
        if (conflicts(this.table, full)) {
          if (this.action === 'upsert') continue;
          return { data: null, error: conflictError() };
        }
        all.push(full);
      }
      save();
      return { data: null, error: null };
    }

    if (this.action === 'update') {
      for (const r of matches) {
        const next = { ...r, ...this.patch };
        if (conflicts(this.table, next, r)) return { data: null, error: conflictError() };
      }
      matches.forEach((r) => Object.assign(r, this.patch));
      save();
      return { data: null, error: null };
    }

    if (this.action === 'delete') {
      load()[this.table] = all.filter((r) => !matches.includes(r));
      save();
      return { data: null, error: null };
    }

    let rows = [...matches];
    if (this.sort) {
      const { col, ascending } = this.sort;
      rows.sort((a, b) => (ascending ? 1 : -1) * String(a[col]).localeCompare(String(b[col])));
    }
    if (this.max) rows = rows.slice(0, this.max);
    if (this.opts?.head) return { data: null, count: matches.length, error: null };
    if (this.single) return { data: rows[0] ? { ...rows[0] } : null, error: null };
    return { data: rows.map((r) => ({ ...r })), count: matches.length, error: null };
  }
}

// ---------- Database functions ----------
const runtimeOf = (userId, type, mediaId) => {
  if (type !== 'movie') return 0;
  return load().watched_movies.find((r) => same(r.user_id, userId) && same(r.movie_id, mediaId))?.runtime_minutes || 0;
};

function watchStats(userId) {
  const buckets = new Map();
  const bump = (grain, period, kind, minutes, items) => {
    const key = `${grain}|${period}|${kind}`;
    const b = buckets.get(key) || { grain, period, kind, minutes: 0, items: 0 };
    b.minutes += minutes;
    b.items += items;
    buckets.set(key, b);
  };
  const record = (when, kind, minutes, items) => {
    const d = new Date(when);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    bump('all', 'all', kind, minutes, items);
    bump('year', String(d.getFullYear()), kind, minutes, items);
    bump('month', month, kind, minutes, items);
  };
  const data = load();
  data.watched_movies.filter((r) => same(r.user_id, userId)).forEach((r) => {
    const rewatches = data.completed_items.find((c) => same(c.user_id, userId) && c.media_type === 'movie' && same(c.media_id, r.movie_id))?.rewatch_count || 0;
    record(r.created_at, 'movie', (r.runtime_minutes || 0) * (1 + rewatches), 1 + rewatches);
  });
  data.watched_episodes.filter((r) => same(r.user_id, userId)).forEach((r) => record(r.created_at, 'tv', r.runtime_minutes || 0, 1));
  return [...buckets.values()];
}

function profileRow(username) {
  return load().profiles.find((p) => p.username && p.username === String(username).toLowerCase());
}

function followCounts(id) {
  const f = load().follows;
  return {
    followers_count: f.filter((r) => r.followee_id === id).length,
    following_count: f.filter((r) => r.follower_id === id).length,
  };
}

const RPC = {
  complete_item(p) {
    const data = load();
    const user = me();
    const exists = data.completed_items.find((r) => same(r.user_id, user) && same(r.media_id, p.p_media_id) && r.media_type === p.p_media_type);
    if (!exists) {
      data.completed_items.push({
        id: uid(), created_at: new Date().toISOString(), user_id: user, media_id: String(p.p_media_id), media_type: p.p_media_type,
        title: p.p_title, poster_path: p.p_poster_path, release_year: p.p_release_year, vote_average: p.p_vote_average,
        runtime_minutes: p.p_runtime_minutes ?? null, rewatch_count: 0,
      });
    }
    if (p.p_media_type === 'movie' && !data.watched_movies.some((r) => same(r.user_id, user) && same(r.movie_id, p.p_media_id))) {
      data.watched_movies.push({ id: uid(), created_at: new Date().toISOString(), user_id: user, movie_id: String(p.p_media_id), runtime_minutes: p.p_runtime_minutes ?? null });
    }
    data.watchlist = data.watchlist.filter((r) => !(same(r.user_id, user) && same(r.movie_id, p.p_media_id) && r.media_type === p.p_media_type));
    save();
    return null;
  },
  uncomplete_item(p) {
    const data = load();
    const user = me();
    data.completed_items = data.completed_items.filter((r) => !(same(r.user_id, user) && same(r.media_id, p.p_media_id) && r.media_type === p.p_media_type));
    if (p.p_media_type === 'movie') data.watched_movies = data.watched_movies.filter((r) => !(same(r.user_id, user) && same(r.movie_id, p.p_media_id)));
    save();
    return null;
  },
  change_rewatch_count(p) {
    const row = load().completed_items.find((r) => same(r.user_id, me()) && same(r.media_id, p.p_media_id) && r.media_type === p.p_media_type);
    if (!row) return 0;
    row.rewatch_count = Math.max(0, Math.min(99, (row.rewatch_count || 0) + p.p_delta));
    save();
    return row.rewatch_count;
  },
  get_watch_stats: () => watchStats(me()),
  get_public_watch_stats: (p) => {
    const row = profileRow(p.p_username);
    return row && (row.is_public || row.id === me()) ? watchStats(row.id) : [];
  },
  get_public_profile(p) {
    const row = profileRow(p.p_username);
    if (!row) return [];
    const isFollowing = load().follows.some((f) => f.follower_id === me() && f.followee_id === row.id);
    return [{ ...row, is_self: row.id === me(), is_following: isFollowing, ...followCounts(row.id) }];
  },
  get_public_lists(p) {
    const row = profileRow(p.p_username);
    if (!row || !(row.is_public || row.id === me())) return {};
    const data = load();
    const mine = (table, idKey) => data[table]
      .filter((r) => r.user_id === row.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => ({ id: r[idKey], media_type: r.media_type, title: r.title, poster_path: r.poster_path, release_year: r.release_year, vote_average: r.vote_average }));
    return { queue: mine('watchlist', 'movie_id'), completed: mine('completed_items', 'media_id'), favorites: mine('favorites', 'media_id') };
  },
  search_public_profiles(p) {
    const q = String(p.p_query || '').toLowerCase();
    return load().profiles
      .filter((r) => r.is_public && r.username && (r.username.includes(q) || (r.nickname || '').toLowerCase().includes(q)))
      .slice(0, p.p_limit || 8)
      .map((r) => ({ username: r.username, nickname: r.nickname, avatar_url: r.avatar_url, bio: r.bio, followers_count: followCounts(r.id).followers_count }));
  },
  follow_user(p) {
    const row = profileRow(p.p_username);
    if (row && !load().follows.some((f) => f.follower_id === me() && f.followee_id === row.id)) {
      load().follows.push({ follower_id: me(), followee_id: row.id });
      save();
    }
    return null;
  },
  unfollow_user(p) {
    const row = profileRow(p.p_username);
    if (row) {
      load().follows = load().follows.filter((f) => !(f.follower_id === me() && f.followee_id === row.id));
      save();
    }
    return null;
  },
  backfill_runtimes: () => null,
};

function rpc(name, params = {}) {
  const promise = new Promise((r) => setTimeout(r, 140)).then(() => {
    if (!RPC[name]) return { data: null, error: { message: `Unknown function ${name}` } };
    return { data: RPC[name](params), error: null };
  });
  promise.abortSignal = () => promise;
  return promise;
}

// ---------- Auth and storage ----------
const auth = {
  async getSession() { return { data: { session } }; },
  onAuthStateChange(cb) {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },
  async signInWithPassword({ email }) {
    load();
    setSession({ user: { id: ME, email, user_metadata: {} } });
    return { data: { session }, error: null };
  },
  async signUp({ email }) {
    load();
    setSession({ user: { id: ME, email, user_metadata: {} } });
    return { data: { session }, error: null };
  },
  async signOut() {
    setSession(null);
    return { error: null };
  },
};

const files = new Map();
const storage = {
  from() {
    return {
      async upload(path, file) { files.set(path, URL.createObjectURL(file)); return { error: null }; },
      getPublicUrl(path) { return { data: { publicUrl: files.get(path) || '' } }; },
      async remove() { return { error: null }; },
    };
  },
};

export function createSampleClient() {
  return { from: (table) => new Query(table), rpc, auth, storage };
}
