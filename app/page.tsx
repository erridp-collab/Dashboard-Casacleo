"use client";

import { useEffect, useMemo, useState } from "react";
import CalendarClient from "@/app/calendar/calendar-client";
import { Card, CardHeader } from "@/components/card";
import { KpiCard } from "@/components/kpi-card";
import { KpiCardSkeleton } from "@/components/skeleton";
import type { Action, Booking } from "@/types/db";

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isClient, setIsClient] = useState(false);

  async function loadData() {
    setError("");
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [bookingsRes, actionsRes] = await Promise.all([
      fetch("/api/bookings"),
      fetch(`/api/actions?from=${today}&to=${today}`),
    ]);

    const bookingsData = await bookingsRes.json();
    const actionsData = await actionsRes.json();

    setLoading(false);
    if (!bookingsRes.ok) return setError(bookingsData.error ?? "Errore bookings");
    if (!actionsRes.ok) return setError(actionsData.error ?? "Errore actions");

    setBookings(bookingsData.bookings ?? []);
    setActions(actionsData.actions ?? []);
  }

  useEffect(() => {
    setIsClient(true);
    const t = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const openActions = useMemo(() => actions.filter((a) => a.status === "DA_FARE").length, [actions]);
  const todayActions = actions.length;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500">Panoramica operativa giornaliera</p>
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
