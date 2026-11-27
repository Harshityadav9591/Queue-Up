import { Link } from 'react-router-dom';

// Two posters in a queue: the next one in front, with a play mark
export function MarkGlyph({ className = 'w-7 h-7' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="12" y="2" width="16" height="23" rx="3.5" fill="currentColor" opacity="0.42" />
      <rect x="4" y="7" width="16" height="23" rx="3.5" fill="currentColor" />
      <path d="M10 14.2v8.6l7-4.3z" fill="var(--ground)" />
    </svg>
  );
}

export default function Wordmark({ to = '/', className = '' }) {
  return (
    <Link to={to} aria-label="Queue Up home" className={`group inline-flex items-center gap-2.5 text-ink ${className}`}>
      <MarkGlyph className="w-7 h-7 transition-transform duration-500 ease-out-soft group-hover:-rotate-6 group-active:scale-90" />
      <span className="text-[18px] font-extrabold tracking-[-0.04em]">Queue Up</span>
    </Link>
  );
}
