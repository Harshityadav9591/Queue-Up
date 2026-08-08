export default function Skeleton() {
  return (
    <div className="bg-neutral-2 animate-pulse rounded-lg overflow-hidden w-full max-w-sm">
      <div className="h-64 bg-neutral-3/30 w-full"></div>
      <div className="p-4">
        <div className="h-6 bg-neutral-3/30 rounded w-3/4 mb-3"></div>
        <div className="h-4 bg-neutral-3/30 rounded w-1/2"></div>
      </div>
    </div>
  );
}