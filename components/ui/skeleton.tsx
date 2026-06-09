export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-stone-200 ${className ?? ''}`} />
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-10 w-10 shrink-0" />
          <Skeleton className="h-10 grow" />
          <Skeleton className="h-10 w-20 shrink-0" />
          <Skeleton className="h-10 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}
