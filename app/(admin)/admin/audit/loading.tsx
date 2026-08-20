export default function AuditLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <div className="h-9 w-48 bg-muted animate-pulse rounded-md" />
        <div className="h-5 w-80 bg-muted animate-pulse rounded-md" />
      </div>
      <div className="rounded-md border bg-white overflow-hidden">
        <div className="h-12 bg-accent/50 border-b" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-14 border-b last:border-0 px-4 flex items-center gap-4">
            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
            <div className="h-5 w-48 bg-muted animate-pulse rounded" />
            <div className="h-5 w-24 bg-muted animate-pulse rounded" />
            <div className="h-5 w-24 bg-muted animate-pulse rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
