// Same size and spacing as MovieCard, so nothing shifts when the posters arrive
export default function MovieCardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton aspect-[2/3] w-full" />
      <div className="skeleton mt-3 h-4 w-4/5 rounded-md" />
      <div className="skeleton mt-2 h-3.5 w-2/5 rounded-md" />
    </div>
  );
}
