export default function WorkerSectionLoading() {
  return (
    <div className="space-y-8">
      {/* PageHeader Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="space-y-2">
          <div className="h-9 w-56 bg-muted animate-pulse rounded-md" />
          <div className="h-5 w-72 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="h-10 w-32 bg-muted animate-pulse rounded-md" />
      </div>

      {/* Content Card Skeleton */}
      <div className="rounded-md border bg-white p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-5 w-1/4 bg-muted animate-pulse rounded" />
            <div className="h-5 flex-1 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
