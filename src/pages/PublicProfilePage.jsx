import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import MediaRow from '../components/profile/MediaRow';
import WatchTimeCard from '../components/profile/WatchTimeCard';
import toast from 'react-hot-toast';

const TAB_OPTIONS = [
  { value: 'queue', label: 'In queue' },
  { value: 'completed', label: 'Completed' },
];

// Turns a row from get_public_lists() into the shape MediaRow expects
const normalize = (r) => {
  const type = r.media_type || 'movie';
  return {
    key: `${type}-${r.id}`,
    id: r.id,
    type,
    title: r.title,
    poster_path: r.poster_path,
    release_year: r.release_year,
    vote_average: r.vote_average,
  };
};

function MessageScreen({ title, text }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] flex flex-col justify-center items-center gap-4 px-6 text-center transition-colors duration-500">
      <p className="text-3xl font-black text-slate-900 dark:text-white">{title}</p>
      <p className="text-slate-500 dark:text-slate-400 max-w-md">{text}</p>
      <Link to="/discover" className="mt-2 px-6 py-2.5 rounded-lg font-bold bg-blue-600 dark:bg-[#00f0ff] text-white dark:text-[#0b101e] hover:opacity-90 transition-opacity">
        Back to Discover
      </Link>
    </div>
  );
}

export default function PublicProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | notfound | private | error | ok
  const [profile, setProfile] = useState(null);
  const [lists, setLists] = useState({ queue: [], completed: [], favorites: [] });
  const [watchRows, setWatchRows] = useState([]);
  const [moviesTab, setMoviesTab] = useState('queue');
  const [showsTab, setShowsTab] = useState('queue');

  const [isFollowing, setIsFollowing] = useState(false);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [togglingFollow, setTogglingFollow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      setMoviesTab('queue');
      setShowsTab('queue');

      const { data, error } = await supabase.rpc('get_public_profile', { p_username: username });
      if (cancelled) return;
      if (error) {
        setStatus('error');
        return;
      }

      const row = data?.[0];
      if (!row) {
        setStatus('notfound');
        return;
      }
      if (!row.is_public && !row.is_self) {
        setProfile({ username: row.username });
        setStatus('private');
        return;
      }

      setProfile(row);
      setIsFollowing(!!row.is_following);
      setCounts({ followers: Number(row.followers_count), following: Number(row.following_count) });

      const [listsRes, statsRes] = await Promise.all([
        supabase.rpc('get_public_lists', { p_username: username }),
        supabase.rpc('get_public_watch_stats', { p_username: username }),
      ]);
      if (cancelled) return;

      const l = listsRes.data || {};
      setLists({
        queue: (l.queue || []).map(normalize),
        completed: (l.completed || []).map(normalize),
        favorites: (l.favorites || []).map(normalize),
      });
      setWatchRows(statsRes.data || []);
      setStatus('ok');
    }

    load();
    window.scrollTo(0, 0);
    return () => { cancelled = true; };
  }, [username]);

  const handleToggleFollow = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Sign in to follow people!');
      navigate('/auth');
      return;
    }

    const nextFollowing = !isFollowing;
    setTogglingFollow(true);
    const { error } = await supabase.rpc(nextFollowing ? 'follow_user' : 'unfollow_user', {
      p_username: profile.username,
    });

    if (error) {
      toast.error(nextFollowing ? 'Could not follow this profile.' : 'Could not unfollow.');
    } else {
      setIsFollowing(nextFollowing);
      setCounts((c) => ({ ...c, followers: Math.max(0, c.followers + (nextFollowing ? 1 : -1)) }));
    }
    setTogglingFollow(false);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] flex justify-center items-center">
        <p className="text-2xl font-bold text-slate-900 dark:text-white">Loading...</p>
      </div>
    );
  }
  if (status === 'notfound') {
    return <MessageScreen title="Profile not found" text={`There is no one with the username @${username}.`} />;
  }
  if (status === 'private') {
    return <MessageScreen title="This profile is private" text={`@${profile.username} has not made their profile public.`} />;
  }
  if (status === 'error') {
    return <MessageScreen title="Something went wrong" text="We couldn't load this profile. Please try again in a moment." />;
  }

  const moviesRow = (moviesTab === 'queue' ? lists.queue : lists.completed).filter((i) => i.type === 'movie');
  const showsRow = (showsTab === 'queue' ? lists.queue : lists.completed).filter((i) => i.type === 'tv');
  const displayName = profile.nickname || `@${profile.username}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101e] py-24 px-4 sm:px-6 transition-colors duration-500">
      <div className="container mx-auto max-w-5xl">

        <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-500">

          {/* Banner */}
          <div className="h-48 md:h-64 w-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            {profile.banner_url ? (
              <img src={profile.banner_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-slate-800 to-slate-900"></div>
            )}
          </div>

          <div className="px-6 md:px-12 pb-12 relative">

            {/* Avatar & actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end -mt-16 md:-mt-20 mb-8 gap-6 relative z-10">
              <div className="w-32 h-32 md:w-40 md:h-40 bg-slate-900 dark:bg-[#0b101e] rounded-full border-4 border-white dark:border-[#0b101e] flex items-center justify-center shadow-xl overflow-hidden flex-shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl">👤</span>
                )}
              </div>

              {profile.is_self ? (
                <Link to="/profile" className="px-6 py-2.5 rounded-lg font-bold text-slate-900 dark:text-white border-2 border-slate-300 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/10 transition-all w-full md:w-auto text-center">
                  Edit profile
                </Link>
              ) : (
                <button
                  onClick={handleToggleFollow}
                  disabled={togglingFollow}
                  className={`px-8 py-2.5 rounded-lg font-bold transition-all shadow-sm w-full md:w-auto disabled:opacity-60 ${
                    isFollowing
                      ? 'bg-transparent text-slate-900 dark:text-white border-2 border-slate-300 dark:border-white/20 hover:border-red-500 hover:text-red-500'
                      : 'bg-blue-600 dark:bg-[#00f0ff] text-white dark:text-[#0b101e] hover:opacity-90'
                  }`}
                >
                  {togglingFollow ? 'Updating...' : isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* Name, bio, counts */}
            <div className="border-b border-slate-200 dark:border-white/10 pb-10 transition-colors">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">{displayName}</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">@{profile.username}</p>

              {profile.bio && (
                <div className="flex items-start gap-2 mt-5 text-slate-700 dark:text-slate-300">
                  <span className="text-blue-600 dark:text-[#00f0ff] font-serif text-2xl leading-none">❝</span>
                  <p className="text-md italic font-medium pt-1">{profile.bio}</p>
                </div>
              )}

              <p className="mt-5 text-sm font-bold text-slate-700 dark:text-slate-300">
                {counts.followers} <span className="font-medium text-slate-500 dark:text-slate-400">followers</span>
                <span className="mx-2 text-slate-400">•</span>
                {counts.following} <span className="font-medium text-slate-500 dark:text-slate-400">following</span>
              </p>

              {profile.is_self && !profile.is_public && (
                <p className="mt-5 text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                  Only you can see this page because your profile is private. Turn on "Public profile" in your profile settings to share it.
                </p>
              )}
            </div>

            {/* Watch time */}
            <div className="mt-10">
              <WatchTimeCard rows={watchRows} calculating={false} />
            </div>

            {/* Rows */}
            <MediaRow
              title="Movies"
              items={moviesRow}
              emptyText={moviesTab === 'queue' ? 'No movies in the queue.' : 'No completed movies yet.'}
              tabs={{ value: moviesTab, onChange: setMoviesTab, options: TAB_OPTIONS }}
            />

            <MediaRow
              title="Shows"
              items={showsRow}
              emptyText={showsTab === 'queue' ? 'No shows in the queue.' : 'No completed shows yet.'}
              tabs={{ value: showsTab, onChange: setShowsTab, options: TAB_OPTIONS }}
            />

            <MediaRow
              title="Favorites"
              items={lists.favorites}
              emptyText="No favorites yet."
            />

          </div>
        </div>

      </div>
    </div>
  );
}
