"use client";

import { useEffect, useMemo, useState } from "react";
import { KpiCard } from "@/components/kpi-card";
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
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Vista rapida operativa</p>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Prenotazioni Totali" value={String(bookings.length)} />
        <KpiCard title="Azioni Oggi" value={String(todayActions)} subtitle={`${openActions} da fare`} />
        <KpiCard title="Revenue Mese" value={`EUR ${month?.revenue?.toFixed(0) ?? "0"}`} />
        <KpiCard title="Profitto Netto Mese" value={`EUR ${month?.netProfit?.toFixed(0) ?? "0"}`} />
      </div>
    </section>
  );
}

