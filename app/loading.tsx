import { Card } from "@/components/card";
import { KpiCardSkeleton, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <section className="space-y-6" aria-busy="true" aria-label="Caricamento pagina">
      <header className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>

      <Card className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </Card>
    </section>
  );
}
