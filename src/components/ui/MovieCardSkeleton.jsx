export default function MovieCardSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      {/* Poster Placeholder */}
      <div className="w-full aspect-[2/3] bg-neutral-3/40"></div>
      
      {/* Text Placeholders */}
      <div className="p-4 flex flex-col gap-3">
        {/* Title */}
        <div className="h-5 bg-neutral-3/40 rounded-md w-3/4"></div>
        
        {/* Genre & Year */}
        <div className="flex justify-between items-center mt-1">
          <div className="h-4 bg-neutral-3/40 rounded-md w-1/3"></div>
          <div className="h-4 bg-neutral-3/40 rounded-md w-1/4"></div>
        </div>
      </div>
    </div>
  );
}