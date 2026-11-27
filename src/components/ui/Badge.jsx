export default function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full bg-surface px-2.5 text-xs font-semibold text-ink whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}
