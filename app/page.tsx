"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import CalendarClient from "@/app/calendar/calendar-client";
import { Card, CardHeader } from "@/components/card";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { KpiCard } from "@/components/kpi-card";
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
        setError(bookingsRes.error || "Errore bookings");
        return;
      }
      if (!actionsRes.ok) {
        if (actionsRes.aborted) return;
        setError(actionsRes.error || "Errore actions");
        return;
      }

      setBookings(bookingsRes.data.bookings ?? []);
      setActions(actionsRes.data.actions ?? []);
    } catch (e: unknown) {
      console.error("Dashboard load failed", e);
      setError("Errore caricamento");
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
      <header className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sidebar-bg">
          <LayoutDashboard className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold leading-none tracking-tight text-text-primary">Dashboard</h1>
          <p className="mt-1 text-xs text-text-secondary">Panoramica operativa giornaliera</p>
        </div>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <Card className="p-4">
        <CardHeader title="Calendario" subtitle="Prenotazioni e azioni" />
        <CalendarClient />
        <div className="calendar-legend mt-4">
          <span className="calendar-legend-label">Legenda</span>
          <span className="calendar-legend-token calendar-legend-token--booking">PR</span>
          <span className="calendar-legend-text">Prenotazioni</span>
          <span className="calendar-legend-token calendar-legend-token--cleaning">P</span>
          <span className="calendar-legend-text">Pulizia</span>
          <span className="calendar-legend-token calendar-legend-token--linen">B</span>
          <span className="calendar-legend-text">Biancheria</span>
          <span className="calendar-legend-token calendar-legend-token--laundry">L</span>
          <span className="calendar-legend-text">Lavatrici</span>
          <span className="calendar-legend-token calendar-legend-token--maintenance">M</span>
          <span className="calendar-legend-text">Manutenzione</span>
          <span className="calendar-legend-token calendar-legend-token--shopping">S</span>
          <span className="calendar-legend-text">Spesa</span>
        </div>
      </Card>

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
    </section>
  );
}
