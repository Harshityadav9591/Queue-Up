import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import MediaRow from '../components/profile/MediaRow';
import WatchTimeCard from '../components/profile/WatchTimeCard';
import toast from 'react-hot-toast';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';

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
    <div className="wrap flex min-h-[60vh] flex-col items-start justify-center">
      <h1 className="text-[32px] font-extrabold tracking-[-0.03em]">{title}</h1>
      <p className="mt-2 max-w-md text-muted">{text}</p>
      <Link to="/discover" className="btn btn-primary mt-6">
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
      <div className="wrap pt-4" aria-busy="true" aria-label="Loading profile">
        <div className="skeleton aspect-[5/2] rounded-[24px] sm:aspect-[4/1]" />
        <div className="-mt-12 flex items-end gap-5 px-1 sm:-mt-16 sm:px-6">
          <div className="skeleton h-28 w-28 rounded-full ring-[6px] ring-ground sm:h-36 sm:w-36" />
          <div className="pb-2">
            <div className="skeleton h-8 w-56 rounded-lg" />
            <div className="skeleton mt-3 h-4 w-32 rounded-md" />
          </div>
        </div>
        <div className="skeleton mt-12 h-[320px] rounded-[20px]" />
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
    <div className="wrap pt-2 sm:pt-4">

      {/* Banner */}
      <div className="aspect-[5/2] overflow-hidden rounded-[24px] bg-surface sm:aspect-[4/1]">
        {profile.banner_url && <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />}
      </div>

      {/* Avatar, name, follow */}
      <div className="relative -mt-12 flex flex-col gap-5 px-1 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-end gap-4 sm:gap-6">
          <div className="h-28 w-28 flex-none overflow-hidden rounded-full ring-[6px] ring-ground sm:h-36 sm:w-36">
            <Avatar url={profile.avatar_url} name={profile.nickname || profile.username} size="h-full w-full text-5xl" />
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="truncate text-[28px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[34px]">{displayName}</h1>
            <p className="truncate text-[15px] text-muted">
              @{profile.username}
              <span className="mx-2" aria-hidden="true">·</span>
              <span className="font-semibold text-ink">{counts.followers}</span> {counts.followers === 1 ? 'follower' : 'followers'}
              <span className="mx-2" aria-hidden="true">·</span>
              <span className="font-semibold text-ink">{counts.following}</span> following
            </p>
          </div>
        </div>

        <div className="flex-none pb-1">
          {profile.is_self ? (
            <Link to="/profile" className="btn btn-quiet">
              <Icon name="pencil" />
              Edit profile
            </Link>
          ) : (
            <button
              onClick={handleToggleFollow}
              disabled={togglingFollow}
              aria-pressed={isFollowing}
              className={`btn group/follow min-w-[124px] ${isFollowing ? 'btn-on' : 'btn-primary'}`}
            >
              {togglingFollow ? 'Updating…' : isFollowing ? (
                <>
                  <span className="group-hover/follow:hidden">Following</span>
                  <span className="hidden group-hover/follow:inline">Unfollow</span>
                </>
              ) : (
                <>
                  <Icon name="plus" strokeWidth={2.25} />
                  Follow
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {profile.bio && <p className="mt-6 max-w-2xl px-1 text-[17px] leading-relaxed sm:px-6">{profile.bio}</p>}

      {profile.is_self && !profile.is_public && (
        <p className="mt-6 flex max-w-2xl items-start gap-2 rounded-[16px] bg-surface px-4 py-3 text-[15px]">
          <Icon name="lock" className="mt-0.5 h-[18px] w-[18px] flex-none" />
          Only you can see this page because your profile is private. Turn on “Public profile” in your profile settings to share it.
        </p>
      )}

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
  );
}
