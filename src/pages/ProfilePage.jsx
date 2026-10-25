import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { backfillRuntimes } from '../lib/watchTime';
import MediaRow from '../components/profile/MediaRow';
import WatchTimeCard from '../components/profile/WatchTimeCard';
import toast from 'react-hot-toast';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = { avatar: 2 * 1024 * 1024, banner: 5 * 1024 * 1024 };
const NICKNAME_MAX = 40;
const BIO_MAX = 200;
const ROW_LIMIT = 200;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

// ---------- Page ----------
export default function ProfilePage() {
  const navigate = useNavigate();
  const mounted = useRef(true);
  const backfillStarted = useRef(false);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Profile (stored in the profiles table)
  const [profile, setProfile] = useState({ nickname: null, bio: null, avatar_url: null, banner_url: null, username: null, is_public: false });
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Public profile settings
  const [usernameDraft, setUsernameDraft] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });

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
        supabase.from('profiles').select('nickname, bio, avatar_url, banner_url, username, is_public').eq('id', uid).maybeSingle(),
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
          username: null,
          is_public: false,
        };
        await supabase.from('profiles').insert([{ id: uid, ...p }]);
      }
      setProfile(p);
      setUsernameDraft(p.username || '');

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

      if (p.username) {
        const { data: me } = await supabase.rpc('get_public_profile', { p_username: p.username });
        if (mounted.current && me?.[0]) {
          setFollowCounts({ followers: Number(me[0].followers_count), following: Number(me[0].following_count) });
        }
      }

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

  // --- Username & public/private switch ---
  const handleSaveUsername = async () => {
    const value = usernameDraft.trim().toLowerCase().replace(/^@/, '');
    if (!USERNAME_RE.test(value)) {
      return toast.error('Username must be 3-20 characters: lowercase letters, numbers or underscores.');
    }
    if (value === profile.username) return;

    setSavingUsername(true);
    const { error } = await supabase
      .from('profiles')
      .update({ username: value, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);

    if (error) {
      if (error.code === '23505') toast.error('That username is already taken.');
      else if (error.code === '23514') toast.error('That username is not allowed. Try another one.');
      else toast.error(error.message);
    } else {
      setProfile((prev) => ({ ...prev, username: value }));
      setUsernameDraft(value);
      toast.success('Username saved!');
    }
    setSavingUsername(false);
  };

  const handleTogglePublic = async () => {
    if (!profile.username) return toast.error('Choose a username first, then you can make your profile public.');

    const next = !profile.is_public;
    setTogglingPublic(true);
    const { error } = await supabase
      .from('profiles')
      .update({ is_public: next, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);

    if (error) {
      toast.error(error.message);
    } else {
      setProfile((prev) => ({ ...prev, is_public: next }));
      toast.success(next ? 'Your profile is now public.' : 'Your profile is now private.');
    }
    setTogglingPublic(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${profile.username}`);
      toast.success('Link copied!');
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.');
    }
  };

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

            {/* --- PUBLIC PROFILE SETTINGS --- */}
            <section className="mt-10 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-1">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">Public profile</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    When public, anyone with your link can see your queue, completed list, favorites and watch time, and can follow you.
                    Your email is never shown. When private, only you can see your profile.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={profile.is_public}
                  aria-label="Make my profile public"
                  onClick={handleTogglePublic}
                  disabled={togglingPublic}
                  className="flex items-center gap-3 flex-shrink-0 disabled:opacity-60"
                >
                  <span className={`relative inline-block w-14 h-8 rounded-full transition-colors ${profile.is_public ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${profile.is_public ? 'translate-x-6' : ''}`}></span>
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white w-16 text-left">
                    {profile.is_public ? 'Public' : 'Private'}
                  </span>
                </button>
              </div>

              <div className="mt-6">
                <label htmlFor="username-input" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Username</label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden focus-within:border-blue-500 dark:focus-within:border-[#00f0ff] transition-colors">
                    <span className="pl-3 text-slate-400 font-bold">@</span>
                    <input
                      id="username-input"
                      type="text"
                      value={usernameDraft}
                      maxLength={20}
                      onChange={(e) => setUsernameDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveUsername(); }}
                      placeholder="yourname"
                      className="bg-transparent text-slate-900 dark:text-white px-2 py-2 focus:outline-none w-44"
                    />
                  </div>
                  <button
                    onClick={handleSaveUsername}
                    disabled={savingUsername || usernameDraft === (profile.username || '')}
                    className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                  >
                    {savingUsername ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">3-20 characters: lowercase letters, numbers and underscores. Changing it changes your profile link.</p>
              </div>

              {profile.username && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <code className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-sm px-3 py-2 rounded-lg break-all">
                    {window.location.origin}/u/{profile.username}
                  </code>
                  <button onClick={handleCopyLink} className="text-sm font-bold text-blue-600 dark:text-[#00f0ff] hover:underline">Copy link</button>
                  <Link to={`/u/${profile.username}`} className="text-sm font-bold text-blue-600 dark:text-[#00f0ff] hover:underline">
                    {profile.is_public ? 'View public page' : 'Preview'}
                  </Link>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {followCounts.followers} followers • {followCounts.following} following
                  </span>
                </div>
              )}
            </section>

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
