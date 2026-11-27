import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { backfillRuntimes } from '../lib/watchTime';
import MediaRow from '../components/profile/MediaRow';
import WatchTimeCard from '../components/profile/WatchTimeCard';
import toast from 'react-hot-toast';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';

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

  if (loading) return <ProfileSkeleton />;

  const moviesRow = moviesTab === 'queue' ? rows.queueMovies : rows.completedMovies;
  const showsRow = showsTab === 'queue' ? rows.queueShows : rows.completedShows;
  const tabOptions = [
    { value: 'queue', label: 'In queue' },
    { value: 'completed', label: 'Completed' },
  ];
  const displayName = profile.nickname || 'My Account';
  const profileLink = profile.username ? `${window.location.origin}/u/${profile.username}` : '';

  return (
    <div className="wrap pt-2 sm:pt-4">

      {/* --- BANNER UPLOAD --- */}
      <label className="group relative block aspect-[5/2] cursor-pointer overflow-hidden rounded-[24px] bg-surface sm:aspect-[4/1]">
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="Profile banner" className="h-full w-full object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.02]" />
        ) : (
          <span className="flex h-full items-start p-5 text-[15px] font-semibold text-muted sm:p-7">
            <span className="inline-flex items-center gap-2"><Icon name="image" className="h-5 w-5" /> Add a banner image</span>
          </span>
        )}
        <span className="btn btn-sm absolute bottom-4 right-4 bg-ground text-ink opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <Icon name="image" />
          {uploadingBanner ? 'Uploading…' : profile.banner_url ? 'Change banner' : 'Upload'}
        </span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => uploadImage(e, 'banner')} disabled={uploadingBanner} className="sr-only" />
      </label>

      {/* --- IDENTITY: avatar, name, email, actions --- */}
      <div className="relative -mt-12 flex flex-col gap-5 px-1 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-end gap-4 sm:gap-6">
          <label className="group relative h-28 w-28 flex-none cursor-pointer overflow-hidden rounded-full ring-[6px] ring-ground sm:h-36 sm:w-36" title="Change your picture">
            <Avatar url={profile.avatar_url} name={session?.user?.email || displayName} size="h-full w-full text-5xl" />
            <span className="absolute inset-0 grid place-items-center bg-[var(--scrim)] text-sm font-semibold text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
              {uploadingAvatar ? 'Uploading…' : 'Change'}
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => uploadImage(e, 'avatar')} disabled={uploadingAvatar} className="sr-only" />
          </label>

          <div className="min-w-0 pb-1">
            {isEditingName ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={nicknameDraft}
                  maxLength={NICKNAME_MAX}
                  aria-label="Nickname"
                  onChange={(e) => setNicknameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveText('nickname', nicknameDraft, setIsEditingName); }}
                  className="field h-11 max-w-xs text-xl font-bold"
                  autoFocus
                />
                <button onClick={() => handleSaveText('nickname', nicknameDraft, setIsEditingName)} className="btn btn-primary btn-sm">Save</button>
                <button onClick={() => setIsEditingName(false)} className="btn btn-ghost btn-sm">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <h1 className="truncate text-[28px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[34px]">{displayName}</h1>
                <button
                  onClick={() => { setNicknameDraft(profile.nickname || ''); setIsEditingName(true); }}
                  className="icon-btn h-9 w-9 text-muted hover:text-ink"
                  aria-label="Edit nickname"
                  title="Edit nickname"
                >
                  <Icon name="pencil" className="h-[18px] w-[18px]" />
                </button>
              </div>
            )}
            <p className="truncate text-[15px] text-muted">
              {profile.username ? `@${profile.username} · ` : ''}{session?.user?.email}
            </p>
          </div>
        </div>

        <div className="flex flex-none gap-2 pb-1">
          {profile.username && (
            <Link to={`/u/${profile.username}`} className="btn btn-quiet btn-sm">
              <Icon name={profile.is_public ? 'globe' : 'lock'} />
              {profile.is_public ? 'View public page' : 'Preview public page'}
            </Link>
          )}
          <button onClick={handleSignOut} className="btn btn-ghost btn-sm">
            <Icon name="logout" />
            Sign out
          </button>
        </div>
      </div>

      {/* --- BIO --- */}
      <div className="mt-6 max-w-2xl px-1 sm:px-6">
        {isEditingBio ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={bioDraft}
              maxLength={BIO_MAX}
              aria-label="Bio"
              onChange={(e) => setBioDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveText('bio', bioDraft, setIsEditingBio); }}
              placeholder="A line about what you like to watch"
              className="field max-w-md flex-1"
              autoFocus
            />
            <button onClick={() => handleSaveText('bio', bioDraft, setIsEditingBio)} className="btn btn-primary btn-sm">Save</button>
            <button onClick={() => setIsEditingBio(false)} className="btn btn-ghost btn-sm">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => { setBioDraft(profile.bio || ''); setIsEditingBio(true); }}
            className="group flex items-start gap-2 text-left"
            title="Edit bio"
          >
            <p className={`text-[17px] leading-relaxed ${profile.bio ? '' : 'text-muted'}`}>
              {profile.bio || 'Add a line about what you like to watch.'}
            </p>
            <Icon name="pencil" className="mt-1 h-4 w-4 flex-none text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        )}
      </div>

      {/* --- COUNTS: one strip, split by hairlines --- */}
      <section className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] bg-line lg:grid-cols-4" aria-label="Your lists in numbers">
        {[
          ['Movies in queue', stats.queueMovies],
          ['Shows in queue', stats.queueShows],
          ['Movies watched', stats.watchedMovies],
          ['Shows completed', stats.completedShows],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface p-5 sm:px-7">
            <p className="text-[13px] text-muted">{label}</p>
            <p className="num mt-1 text-[28px] font-bold leading-none tracking-[-0.02em]">{value}</p>
          </div>
        ))}
      </section>

      <div className="mt-3">
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
        emptyText="Nothing here yet. Use Add to favorites on any movie or show page."
      />

      {/* --- PUBLIC PROFILE SETTINGS --- */}
      <section className="mt-16 grid gap-6 border-t border-line pt-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-14" aria-labelledby="public-heading">
        <div>
          <h2 id="public-heading" className="text-xl font-bold">Public profile</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            When public, anyone with your link can see your queue, completed list, favorites and watch time, and can follow you.
            Your email is never shown. When private, only you can see your profile.
          </p>
          {profile.username && (
            <p className="mt-4 text-[15px]">
              <span className="font-semibold">{followCounts.followers}</span> <span className="text-muted">{followCounts.followers === 1 ? 'follower' : 'followers'}</span>
              <span className="mx-2 text-muted" aria-hidden="true">·</span>
              <span className="font-semibold">{followCounts.following}</span> <span className="text-muted">following</span>
            </p>
          )}
        </div>

        <div className="rounded-[20px] bg-surface p-5 sm:p-6">
          {/* Switch row */}
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="flex items-center gap-2 text-[15px] font-semibold">
                Show my profile to anyone with the link
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-ground px-2.5 text-xs font-semibold" style={profile.is_public ? { background: 'var(--data-soft)' } : undefined}>
                  <Icon name={profile.is_public ? 'globe' : 'lock'} className="h-3.5 w-3.5" />
                  {profile.is_public ? 'Public' : 'Private'}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted">{profile.username ? 'You can switch back to private at any time.' : 'Choose a username first.'}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={profile.is_public}
              aria-label="Make my profile public"
              onClick={handleTogglePublic}
              disabled={togglingPublic}
              className={`relative mt-0.5 h-7 w-12 flex-none rounded-full transition-colors duration-300 disabled:opacity-60 ${profile.is_public ? 'bg-ink' : 'bg-raised'}`}
            >
              <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-ground transition-transform duration-300 ease-out-soft ${profile.is_public ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Username */}
          <div className="mt-7">
            <label htmlFor="username-input" className="label">Username</label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-11 items-center rounded-[12px] bg-lift pl-4 transition-shadow focus-within:shadow-[0_0_0_2px_var(--ink)]">
                <span className="font-semibold text-muted">@</span>
                <input
                  id="username-input"
                  type="text"
                  value={usernameDraft}
                  maxLength={20}
                  onChange={(e) => setUsernameDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveUsername(); }}
                  placeholder="yourname"
                  className="h-full w-48 bg-transparent pl-1 pr-4 text-[16px] focus:outline-none"
                />
              </div>
              <button
                onClick={handleSaveUsername}
                disabled={savingUsername || usernameDraft === (profile.username || '')}
                className="btn btn-primary"
              >
                {savingUsername ? 'Saving…' : 'Save'}
              </button>
            </div>
            <p className="mt-2 text-[13px] text-muted">3 to 20 characters: lowercase letters, numbers and underscores. Changing it changes your profile link.</p>
          </div>

          {/* Share link: the address and its Copy button share one edge */}
          {profile.username && (
            <div className="mt-6">
              <p className="label">Your link</p>
              <div className="flex max-w-xl items-stretch">
                <span className="flex min-w-0 flex-1 items-center truncate rounded-l-[12px] bg-lift px-4 py-2.5 text-[15px]">{profileLink}</span>
                <button onClick={handleCopyLink} className="btn h-auto rounded-l-none rounded-r-[12px] bg-ink text-ground hover:opacity-90">
                  <Icon name="copy" />
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="wrap pt-4" aria-busy="true" aria-label="Loading your profile">
      <div className="skeleton aspect-[5/2] rounded-[24px] sm:aspect-[4/1]" />
      <div className="-mt-12 flex items-end gap-5 px-1 sm:-mt-16 sm:px-6">
        <div className="skeleton h-28 w-28 rounded-full ring-[6px] ring-ground sm:h-36 sm:w-36" />
        <div className="pb-2">
          <div className="skeleton h-8 w-56 rounded-lg" />
          <div className="skeleton mt-3 h-4 w-40 rounded-md" />
        </div>
      </div>
      <div className="skeleton mt-12 h-[104px] rounded-[20px]" />
      <div className="skeleton mt-3 h-[320px] rounded-[20px]" />
    </div>
  );
}
