"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KpiCard } from "@/components/kpi-card";
import { monthLabel } from "@/lib/format";
import type { MonthlyFinancePoint } from "@/types/db";

type FinanceResponse = {
  monthly: MonthlyFinancePoint[];
  totals: { revenue: number; expenses: number; netProfit: number };
};

export default function FinancePage() {
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [error, setError] = useState("");

  async function loadFinance() {
    const res = await fetch("/api/finance?months=6");
    const json = await res.json();
    if (!res.ok) return setError(json.error ?? "Errore finance");
    setData(json);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadFinance();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const rows =
    data?.monthly.map((m) => ({
      ...m,
      monthLabel: monthLabel(m.month),
    })) ?? [];

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Finance</h1>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Revenue (6 mesi)" value={`EUR ${data?.totals.revenue.toFixed(0) ?? "0"}`} />
        <KpiCard title="Spese (6 mesi)" value={`EUR ${data?.totals.expenses.toFixed(0) ?? "0"}`} />
        <KpiCard title="Profitto Netto (6 mesi)" value={`EUR ${data?.totals.netProfit.toFixed(0) ?? "0"}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Revenue vs Spese</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthLabel" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#0284c7" />
                <Bar dataKey="expenses" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Occupancy Rate</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthLabel" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="occupancyRate" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

