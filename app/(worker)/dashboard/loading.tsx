export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* PageHeader Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="space-y-2">
          <div className="h-9 w-48 bg-muted animate-pulse rounded-md" />
          <div className="h-5 w-72 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="h-10 w-32 bg-muted animate-pulse rounded-md" />
      </div>

      {/* InvoiceDashboard Skeleton */}
      <div className="space-y-4">
        <div className="rounded-md border bg-white overflow-hidden">
          {/* Table Header Skeleton */}
          <div className="h-12 bg-accent/50 border-b flex items-center px-4">
            <div className="grid grid-cols-5 w-full gap-4">
              <div className="h-4 w-20 bg-muted/50 animate-pulse rounded" />
              <div className="h-4 w-24 bg-muted/50 animate-pulse rounded" />
              <div className="h-4 w-16 bg-muted/50 animate-pulse rounded" />
              <div className="h-4 w-16 bg-muted/50 animate-pulse rounded" />
              <div className="h-4 w-20 bg-muted/50 animate-pulse justify-self-end rounded" />
            </div>
          </div>
          
          {/* Table Rows Skeleton */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b px-4 flex items-center">
              <div className="grid grid-cols-5 w-full gap-4 items-center">
                <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                <div className="h-5 w-20 bg-muted animate-pulse rounded" />
                <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
                <div className="h-5 w-24 bg-muted animate-pulse justify-self-end rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
