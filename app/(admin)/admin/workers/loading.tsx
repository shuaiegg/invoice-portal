export default function AdminWorkersLoading() {
  return (
    <div className="flex flex-col gap-8">
      {/* PageHeader Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-56 bg-muted animate-pulse rounded-md" />
          <div className="h-5 w-80 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="h-10 w-40 bg-muted animate-pulse rounded-md" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border rounded-lg p-6 space-y-3">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-8 w-16 bg-muted animate-pulse rounded-md" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border bg-white overflow-hidden">
        <div className="h-12 bg-accent/50 border-b" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-14 border-b last:border-0 px-4 flex items-center gap-4">
            <div className="h-5 w-40 bg-muted animate-pulse rounded" />
            <div className="h-5 w-56 bg-muted animate-pulse rounded" />
            <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
            <div className="h-5 w-24 bg-muted animate-pulse rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
