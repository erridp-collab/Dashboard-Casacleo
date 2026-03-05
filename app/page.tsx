"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import { KpiCard } from "@/components/kpi-card";
import { CalendarDays, ClipboardList, Euro, House } from "lucide-react";
import type { Action, Booking, MonthlyFinancePoint } from "@/types/db";

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [monthly, setMonthly] = useState<MonthlyFinancePoint[]>([]);
  const [error, setError] = useState("");

  async function loadData() {
    setError("");
    const today = new Date().toISOString().slice(0, 10);
    const [bookingsRes, actionsRes, financeRes] = await Promise.all([
      fetch("/api/bookings"),
      fetch(`/api/actions?from=${today}&to=${today}`),
      fetch("/api/finance?months=1"),
    ]);

    const bookingsData = await bookingsRes.json();
    const actionsData = await actionsRes.json();
    const financeData = await financeRes.json();

    if (!bookingsRes.ok) return setError(bookingsData.error ?? "Errore bookings");
    if (!actionsRes.ok) return setError(actionsData.error ?? "Errore actions");
    if (!financeRes.ok) return setError(financeData.error ?? "Errore finance");

    setBookings(bookingsData.bookings ?? []);
    setActions(actionsData.actions ?? []);
    setMonthly(financeData.monthly ?? []);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const openActions = useMemo(() => actions.filter((a) => a.status === "DA_FARE").length, [actions]);
  const todayActions = actions.length;
  const month = monthly[monthly.length - 1];

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500">Panoramica operativa giornaliera</p>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Prenotazioni Totali" value={String(bookings.length)} />
        <KpiCard title="Azioni Oggi" value={String(todayActions)} subtitle={`${openActions} da fare`} />
        <KpiCard title="Revenue Mese" value={`EUR ${month?.revenue?.toFixed(0) ?? "0"}`} />
        <KpiCard title="Profitto Netto Mese" value={`EUR ${month?.netProfit?.toFixed(0) ?? "0"}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Snapshot" subtitle="Stato rapido del giorno" />
          <div className="space-y-3 text-sm text-zinc-700">
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3">
              <span className="inline-flex items-center gap-2"><House className="h-4 w-4 text-blue-600" /> Bookings</span>
              <span className="font-medium">{bookings.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3">
              <span className="inline-flex items-center gap-2"><ClipboardList className="h-4 w-4 text-blue-600" /> Azioni oggi</span>
              <span className="font-medium">{todayActions}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3">
              <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-600" /> Azioni aperte</span>
              <span className="font-medium">{openActions}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Finance" subtitle="Mese corrente" />
          <div className="space-y-3 text-sm text-zinc-700">
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3">
              <span className="inline-flex items-center gap-2"><Euro className="h-4 w-4 text-emerald-600" /> Revenue</span>
              <span className="font-medium">EUR {month?.revenue?.toFixed(0) ?? "0"}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3">
              <span className="inline-flex items-center gap-2"><Euro className="h-4 w-4 text-emerald-600" /> Profitto netto</span>
              <span className="font-medium">EUR {month?.netProfit?.toFixed(0) ?? "0"}</span>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
