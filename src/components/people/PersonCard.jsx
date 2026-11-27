import { Link } from 'react-router-dom';
import { followersLabel } from '../../lib/people';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';

// One search result for a person. Links to their public profile.
export default function PersonCard({ person }) {
  const name = person.nickname || `@${person.username}`;

  return (
    <Link
      to={`/u/${person.username}`}
      className="group flex items-center gap-4 rounded-[20px] bg-surface p-4 transition-colors duration-300 hover:bg-raised"
    >
      <Avatar url={person.avatar_url} name={person.nickname || person.username} size="h-14 w-14 text-xl" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold">{name}</p>
        <p className="truncate text-sm text-muted">
          {person.nickname ? `@${person.username} · ` : ''}<span>{followersLabel(person.followers_count)}</span>
        </p>
        {person.bio && <p className="mt-1 line-clamp-2 text-sm">{person.bio}</p>}
      </div>
      <Icon name="arrowRight" className="h-5 w-5 flex-none text-muted transition-transform duration-300 group-hover:translate-x-1 group-hover:text-ink" />
    </Link>
  );
}
