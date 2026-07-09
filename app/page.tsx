"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import dynamic from "next/dynamic";

const CalendarClient = dynamic(() => import("@/app/calendar/calendar-client"), { ssr: false });
import { Card, CardHeader } from "@/components/card";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { InlineAlert } from "@/components/inline-alert";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { KpiCardSkeleton } from "@/components/skeleton";
import type { Action, Booking } from "@/types/db";
import { todayLocalIT } from "@/lib/localDate";

type BookingsResponse = {
  bookings?: Booking[];
};

type ActionsResponse = {
  actions?: Action[];
};

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isClient, setIsClient] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function loadData(signal?: AbortSignal) {
    setError("");
    setLoading(true);
    try {
      const today = todayLocalIT();
      const [bookingsRes, actionsRes] = await Promise.all([
        clientFetchJson<BookingsResponse>("/api/bookings", { signal }),
        clientFetchJson<ActionsResponse>(`/api/actions?from=${today}&to=${today}`, { signal }),
      ]);

      if (!bookingsRes.ok) {
        if (bookingsRes.aborted) return;
        setError(bookingsRes.error || "Non è stato possibile caricare le prenotazioni");
        return;
      }
      if (!actionsRes.ok) {
        if (actionsRes.aborted) return;
        setError(actionsRes.error || "Non è stato possibile caricare le azioni");
        return;
      }

      setBookings(bookingsRes.data.bookings ?? []);
      setActions(actionsRes.data.actions ?? []);
    } catch (e: unknown) {
      console.error("Dashboard load failed", e);
      setError("Non è stato possibile caricare i dati");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setIsClient(true);
    const t = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      void loadData(ctrl.signal);
    }, 0);
    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
    };
  }, []);

  const openActions = useMemo(() => actions.filter((a) => a.status === "DA_FARE").length, [actions]);
  const todayActions = actions.length;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Riepilogo"
        subtitle="Panoramica operativa giornaliera con focus su attività, prenotazioni e calendario."
        icon={<LayoutDashboard className="h-5 w-5 text-sidebar-bg" />}
        eyebrow="Oggi"
      />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              title="Prenotazioni Totali"
              value={String(bookings.length)}
              status={bookings.length > 0 ? "ok" : "neutral"}
            />
            <KpiCard
              title="Azioni Oggi"
              value={String(todayActions)}
              subtitle={`${openActions} da fare`}
              status={todayActions === 0 ? "neutral" : openActions > 0 ? "warn" : "ok"}
            />
            <KpiCard
              title="Azioni Aperte"
              value={String(openActions)}
              status={openActions === 0 ? "ok" : openActions >= 3 ? "critical" : "warn"}
            />
            <KpiCard
              title="Giorno"
              value={isClient ? new Date().toLocaleDateString("it-IT") : ""}
              status="neutral"
            />
          </>
        )}
      </div>

      <Card className="p-4">
        <CardHeader title="Calendario" subtitle="Prenotazioni e azioni" />
        <CalendarClient bookings={bookings} />
        <div className="calendar-legend mt-4">
          <span className="calendar-legend-label">Legenda</span>
          <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] bg-[#3b82f6]" />
          <span className="calendar-legend-text">Prenotazioni</span>
          <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] bg-[#16a34a]" />
          <span className="calendar-legend-text">Pulizia</span>
          <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] bg-[#facc15]" />
          <span className="calendar-legend-text">Biancheria</span>
          <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] bg-[#ea580c]" />
          <span className="calendar-legend-text">Lavatrici</span>
          <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] bg-[#7e22ce]" />
          <span className="calendar-legend-text">Manutenzione</span>
          <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] bg-[#64748b]" />
          <span className="calendar-legend-text">Spesa</span>
        </div>
      </Card>
    </section>
  );
}
