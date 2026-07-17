export default function AdminInvoicesLoading() {
  return (
    <div className="flex flex-col gap-8">
      {/* PageHeader Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-muted animate-pulse rounded-md" />
          <div className="h-5 w-96 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="h-10 w-36 bg-muted animate-pulse rounded-md" />
      </div>

      {/* Channel Tabs Skeleton */}
      <div className="h-10 w-96 bg-muted animate-pulse rounded-lg" />

      {/* Filters Skeleton */}
      <div className="flex flex-wrap gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 w-40 bg-muted animate-pulse rounded-md" />
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border bg-white overflow-hidden">
        <div className="h-12 bg-accent/50 border-b" />
        {[...Array(12)].map((_, i) => (
          <div key={i} className="h-14 border-b last:border-0 px-4 flex items-center gap-4">
            <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
            <div className="h-5 w-40 bg-muted animate-pulse rounded" />
            <div className="h-6 w-24 bg-muted animate-pulse rounded-full" />
            <div className="h-5 w-24 bg-muted animate-pulse rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
