export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 items-center">
          <div className="skeleton h-4 flex-1" style={{ opacity: 1 - i * 0.2 }} />
          <div className="skeleton h-4 w-16" style={{ opacity: 1 - i * 0.2 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="skeleton h-3 w-12" />
      <div className="skeleton h-3 flex-1" />
      <div className="skeleton h-5 w-16 rounded-full" />
    </div>
  );
}
