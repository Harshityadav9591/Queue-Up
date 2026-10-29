import { Link } from 'react-router-dom';
import { followersLabel } from '../../lib/people';

// One search result for a person. Links to their public profile.
export default function PersonCard({ person }) {
  const name = person.nickname || `@${person.username}`;

  return (
    <Link
      to={`/u/${person.username}`}
      className="flex items-center gap-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 p-4 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
    >
      {person.avatar_url ? (
        <img src={person.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0 bg-slate-200 dark:bg-slate-700" />
      ) : (
        <span className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-900 dark:text-white flex-shrink-0">
          {name.replace('@', '').charAt(0).toUpperCase()}
        </span>
      )}

      <div className="min-w-0">
        <p className="font-bold text-lg text-slate-900 dark:text-white truncate">{name}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
          {person.nickname ? `@${person.username} • ` : ''}{followersLabel(person.followers_count)}
        </p>
        {person.bio && <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{person.bio}</p>}
      </div>
    </Link>
  );
}
