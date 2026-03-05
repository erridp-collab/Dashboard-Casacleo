"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/card";
import { KpiCard } from "@/components/kpi-card";
import { monthLabel } from "@/lib/format";
import { ChartColumn, LineChartIcon } from "lucide-react";
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
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Finance</h1>
        <p className="text-sm text-zinc-500">Trend degli ultimi 6 mesi</p>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Revenue (6 mesi)" value={`EUR ${data?.totals.revenue.toFixed(0) ?? "0"}`} />
        <KpiCard title="Spese (6 mesi)" value={`EUR ${data?.totals.expenses.toFixed(0) ?? "0"}`} />
        <KpiCard title="Profitto Netto (6 mesi)" value={`EUR ${data?.totals.netProfit.toFixed(0) ?? "0"}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Revenue vs Spese" subtitle="Confronto mensile" action={<ChartColumn className="h-4 w-4 text-blue-600" />} />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Occupancy Rate" subtitle="Tasso di occupazione" action={<LineChartIcon className="h-4 w-4 text-emerald-600" />} />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="occupancyRate" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </section>
  );
}

