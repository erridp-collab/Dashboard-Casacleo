import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-muted ${className}`} />;
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border-strong/12 bg-surface-raised p-4 md:p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
    </div>
  );
}

export function RowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-border-strong/10">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border-strong/10 p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-48" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonBlock({ children }: { children: ReactNode }) {
  return <div className="animate-pulse">{children}</div>;
}
