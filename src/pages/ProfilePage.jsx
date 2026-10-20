import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getImageUrl } from '../lib/tmdb';
import { backfillRuntimes, formatDuration } from '../lib/watchTime';
import toast from 'react-hot-toast';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = { avatar: 2 * 1024 * 1024, banner: 5 * 1024 * 1024 };
const NICKNAME_MAX = 40;
const BIO_MAX = 200;
const ROW_LIMIT = 200;

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

// ---------- Horizontal poster row ----------
function MediaRow({ title, items, emptyText, tabs }) {
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

// ---------- Watch time card ----------
function WatchTimeCard({ rows, calculating }) {
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

// ---------- Page ----------
export default function ProfilePage() {
  const navigate = useNavigate();
  const mounted = useRef(true);
  const backfillStarted = useRef(false);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Profile (stored in the profiles table)
  const [profile, setProfile] = useState({ nickname: null, bio: null, avatar_url: null, banner_url: null });
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Counts, rows and watch time
  const [stats, setStats] = useState({ queueMovies: 0, queueShows: 0, watchedMovies: 0, completedShows: 0 });
  const [rows, setRows] = useState({ queueMovies: [], queueShows: [], completedMovies: [], completedShows: [], favorites: [] });
  const [moviesTab, setMoviesTab] = useState('queue');
  const [showsTab, setShowsTab] = useState('queue');
  const [watchRows, setWatchRows] = useState([]);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    mounted.current = true;

    const normalize = (r, idKey) => {
      const type = r.media_type || 'movie';
      return {
        key: `${type}-${r[idKey]}`,
        id: r[idKey],
        type,
        title: r.title,
        poster_path: r.poster_path,
        release_year: r.release_year,
        vote_average: r.vote_average,
      };
    };

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const uid = session.user.id;
      setSession(session);

      const [
        profileRes, qMovies, qShows, wMovies, cShows,
        watchlistRes, completedRes, favoritesRes, statsRes, pendingMovies, pendingEpisodes,
      ] = await Promise.all([
        supabase.from('profiles').select('nickname, bio, avatar_url, banner_url').eq('id', uid).maybeSingle(),
        supabase.from('watchlist').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('media_type', 'movie'),
        supabase.from('watchlist').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('media_type', 'tv'),
        supabase.from('watched_movies').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('completed_items').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('media_type', 'tv'),
        supabase.from('watchlist').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(ROW_LIMIT),
        supabase.from('completed_items').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(ROW_LIMIT),
        supabase.from('favorites').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(ROW_LIMIT),
        supabase.rpc('get_watch_stats'),
        supabase.from('watched_movies').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('runtime_minutes', null),
        supabase.from('watched_episodes').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('runtime_minutes', null),
      ]);
      if (!mounted.current) return;

      // Profile row: if it's missing (should not happen), create it from the old account metadata
      let p = profileRes.data;
      if (!p) {
        const meta = session.user.user_metadata || {};
        p = {
          nickname: (meta.nickname || '').slice(0, NICKNAME_MAX) || null,
          bio: (meta.quote || '').slice(0, BIO_MAX) || null,
          avatar_url: meta.avatar_url || null,
          banner_url: meta.banner_url || null,
        };
        await supabase.from('profiles').insert([{ id: uid, ...p }]);
      }
      setProfile(p);

      setStats({
        queueMovies: qMovies.count || 0,
        queueShows: qShows.count || 0,
        watchedMovies: wMovies.count || 0,
        completedShows: cShows.count || 0,
      });

      const watchlist = watchlistRes.data || [];
      const completed = completedRes.data || [];
      setRows({
        queueMovies: watchlist.filter((r) => (r.media_type || 'movie') === 'movie').map((r) => normalize(r, 'movie_id')),
        queueShows: watchlist.filter((r) => r.media_type === 'tv').map((r) => normalize(r, 'movie_id')),
        completedMovies: completed.filter((r) => (r.media_type || 'movie') === 'movie').map((r) => normalize(r, 'media_id')),
        completedShows: completed.filter((r) => r.media_type === 'tv').map((r) => normalize(r, 'media_id')),
        favorites: (favoritesRes.data || []).map((r) => normalize(r, 'media_id')),
      });

      setWatchRows(statsRes.data || []);
      setLoading(false);

      // Older watches have no saved runtime yet: look them up once, then refresh the totals
      const pending = (pendingMovies.count || 0) + (pendingEpisodes.count || 0);
      if (pending > 0 && !backfillStarted.current) {
        backfillStarted.current = true;
        setCalculating(true);
        try {
          await backfillRuntimes();
        } catch (err) {
          console.error('Runtime backfill failed:', err.message);
        }
        const { data } = await supabase.rpc('get_watch_stats');
        if (mounted.current) {
          setWatchRows(data || []);
          setCalculating(false);
        }
      }
    }

    load();
    return () => { mounted.current = false; };
  }, [navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else navigate('/');
  };

  // --- Save nickname / bio ---
  const handleSaveText = async (field, value, setEditing) => {
    const trimmed = value.trim();
    if (field === 'nickname' && !trimmed) return toast.error('Nickname cannot be empty!');

    const toastId = toast.loading('Saving...');
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: trimmed || null, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);

    if (error) {
      toast.error(error.message, { id: toastId });
    } else {
      setProfile((prev) => ({ ...prev, [field]: trimmed || null }));
      toast.success('Profile updated!', { id: toastId });
      setEditing(false);
    }
  };

  // --- Upload avatar / banner (files live in avatars/<user-id>/...) ---
  const uploadImage = async (event, type) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // lets you pick the same file again later
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return toast.error('Please choose a JPG, PNG, WebP or GIF image.');
    }
    if (file.size > MAX_IMAGE_BYTES[type]) {
      return toast.error(`That image is too large. The limit is ${type === 'avatar' ? '2 MB' : '5 MB'}.`);
    }

    const setUploading = type === 'avatar' ? setUploadingAvatar : setUploadingBanner;
    const column = type === 'avatar' ? 'avatar_url' : 'banner_url';
    setUploading(true);
    const toastId = toast.loading(`Uploading ${type}...`);

    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${session.user.id}/${type}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { contentType: file.type, cacheControl: '3600' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', session.user.id);
      if (updateError) {
        await supabase.storage.from('avatars').remove([path]); // don't leave an orphaned file behind
        throw updateError;
      }

      const oldUrl = profile[column];
      setProfile((prev) => ({ ...prev, [column]: publicUrl }));
      if (type === 'avatar') {
        window.dispatchEvent(new CustomEvent('profile-updated', { detail: { avatar_url: publicUrl } }));
      }

      // Best-effort cleanup of the previous image so old pictures don't pile up
      if (oldUrl && oldUrl.includes('/avatars/')) {
        const oldPath = decodeURIComponent(oldUrl.split('/avatars/')[1].split('?')[0]);
        supabase.storage.from('avatars').remove([oldPath]);
      }

      toast.success(`${type === 'avatar' ? 'Avatar' : 'Banner'} updated!`, { id: toastId });
    } catch (error) {
      toast.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] flex justify-center items-center"><p className="text-2xl font-bold text-slate-900 dark:text-white">Loading...</p></div>;

  const moviesRow = moviesTab === 'queue' ? rows.queueMovies : rows.completedMovies;
  const showsRow = showsTab === 'queue' ? rows.queueShows : rows.completedShows;
  const tabOptions = [
    { value: 'queue', label: 'In queue' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] py-24 px-4 sm:px-6 transition-colors duration-500">
      <div className="container mx-auto max-w-5xl">

        {/* Main Profile Container */}
        <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-500">

          {/* --- BANNER UPLOAD SECTION --- */}
          <label className="block h-48 md:h-64 w-full relative group cursor-pointer bg-slate-200 dark:bg-slate-800 overflow-hidden">
            {profile.banner_url ? (
              <img src={profile.banner_url} alt="Profile Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-center">
                <span className="text-slate-500 font-medium tracking-widest uppercase text-sm">Add Banner Image</span>
              </div>
            )}

            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white font-bold bg-black/60 px-4 py-2 rounded-lg backdrop-blur-sm">
                {uploadingBanner ? 'Uploading...' : 'Change Banner'}
              </span>
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => uploadImage(e, 'banner')} disabled={uploadingBanner} className="hidden" />
          </label>

          <div className="px-6 md:px-12 pb-12 relative">

            {/* Top Row: Avatar & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end -mt-16 md:-mt-20 mb-8 gap-6 relative z-10">

              {/* --- AVATAR UPLOAD --- */}
              <label className="relative w-32 h-32 md:w-40 md:h-40 bg-slate-900 dark:bg-[#0b101e] rounded-full border-4 border-white dark:border-[#0b101e] flex items-center justify-center shadow-xl transition-colors duration-500 overflow-hidden cursor-pointer group flex-shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl">👤</span>
                )}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-sm font-bold">{uploadingAvatar ? '...' : 'Upload'}</span>
                </div>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => uploadImage(e, 'avatar')} disabled={uploadingAvatar} className="hidden" />
              </label>

              <button onClick={handleSignOut} className="px-6 py-2.5 rounded-lg font-bold text-red-500 border-2 border-red-500/30 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm w-full md:w-auto">
                Sign Out
              </button>
            </div>

            {/* --- USER INFO (Name & Bio) --- */}
            <div className="border-b border-slate-200 dark:border-white/10 pb-10 transition-colors">

              {/* Nickname */}
              {isEditingName ? (
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <input
                    type="text"
                    value={nicknameDraft}
                    maxLength={NICKNAME_MAX}
                    onChange={(e) => setNicknameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveText('nickname', nicknameDraft, setIsEditingName); }}
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg px-3 py-1.5 text-3xl font-black focus:outline-none w-full max-w-xs"
                    autoFocus
                  />
                  <button onClick={() => handleSaveText('nickname', nicknameDraft, setIsEditingName)} className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm">Save</button>
                  <button onClick={() => setIsEditingName(false)} className="text-slate-500 text-sm font-medium">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">{profile.nickname || 'My Account'}</h1>
                  <button
                    onClick={() => { setNicknameDraft(profile.nickname || ''); setIsEditingName(true); }}
                    className="text-slate-400 hover:text-blue-600 dark:hover:text-[#00f0ff] transition-colors"
                    title="Edit Name"
                  >✎</button>
                </div>
              )}

              <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">{session?.user?.email}</p>

              {/* Bio */}
              {isEditingBio ? (
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <input
                    type="text"
                    value={bioDraft}
                    maxLength={BIO_MAX}
                    onChange={(e) => setBioDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveText('bio', bioDraft, setIsEditingBio); }}
                    placeholder="A country man, a humble ronin..."
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg px-3 py-1.5 text-md italic focus:outline-none w-full max-w-md"
                    autoFocus
                  />
                  <button onClick={() => handleSaveText('bio', bioDraft, setIsEditingBio)} className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-bold text-sm">Save</button>
                  <button onClick={() => setIsEditingBio(false)} className="text-slate-500 text-sm font-medium">Cancel</button>
                </div>
              ) : (
                <div className="flex items-start gap-2 mt-4 text-slate-700 dark:text-slate-300">
                  <span className="text-blue-600 dark:text-[#00f0ff] font-serif text-2xl leading-none">❝</span>
                  <p className="text-md italic font-medium pt-1">
                    {profile.bio || 'Add a quote or bio to your profile...'}
                  </p>
                  <button
                    onClick={() => { setBioDraft(profile.bio || ''); setIsEditingBio(true); }}
                    className="text-slate-400 hover:text-blue-600 dark:hover:text-[#00f0ff] transition-colors ml-2 pt-1"
                    title="Edit Bio"
                  >✎</button>
                </div>
              )}
            </div>

            {/* --- ANALYTICS SECTION --- */}
            <div className="mt-10">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Stats & Analytics</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl p-6 text-center shadow-sm">
                  <p className="text-4xl font-black text-blue-600 dark:text-[#00f0ff] mb-2">{stats.queueMovies}</p>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Movies in Queue</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl p-6 text-center shadow-sm">
                  <p className="text-4xl font-black text-purple-600 dark:text-purple-400 mb-2">{stats.queueShows}</p>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Shows in Queue</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl p-6 text-center shadow-sm">
                  <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mb-2">{stats.watchedMovies}</p>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Movies Watched</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl p-6 text-center shadow-sm">
                  <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mb-2">{stats.completedShows}</p>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Shows Completed</p>
                </div>
              </div>

              <WatchTimeCard rows={watchRows} calculating={calculating} />
            </div>

            {/* --- ROWS: Movies, Shows, Favorites --- */}
            <MediaRow
              title="Movies"
              items={moviesRow}
              emptyText={moviesTab === 'queue' ? 'No movies in your queue.' : 'No completed movies yet.'}
              tabs={{ value: moviesTab, onChange: setMoviesTab, options: tabOptions }}
            />

            <MediaRow
              title="Shows"
              items={showsRow}
              emptyText={showsTab === 'queue' ? 'No shows in your queue.' : 'No completed shows yet.'}
              tabs={{ value: showsTab, onChange: setShowsTab, options: tabOptions }}
            />

            <MediaRow
              title="Favorites"
              items={rows.favorites}
              emptyText="Nothing here yet. Use the ♡ Favorite button on any movie or show page."
            />

          </div>
        </div>

      </div>
    </div>
  );
}
