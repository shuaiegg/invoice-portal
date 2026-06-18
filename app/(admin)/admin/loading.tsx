export default function AdminLoading() {
  return (
    <div className="space-y-10">
      {/* PageHeader Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-muted animate-pulse rounded-md" />
          <div className="h-5 w-48 bg-muted animate-pulse rounded-md" />
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border rounded-lg p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-8 w-16 bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-40 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>

      {/* Activity Feed Skeleton */}
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
        <div className="bg-white border rounded-lg overflow-hidden">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="p-4 border-b last:border-0 flex items-center gap-4">
              <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-3 w-1/4 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
