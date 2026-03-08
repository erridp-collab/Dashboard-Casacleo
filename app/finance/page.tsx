"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/card";
import { KpiCard } from "@/components/kpi-card";
import { monthLabel } from "@/lib/format";
import { ChartColumn, LineChartIcon } from "lucide-react";
import type { MonthlyFinancePoint } from "@/types/db";

type FinanceEntry = {
  id: string;
  date: string;
  type: "ENTRATA" | "USCITA";
  category: string;
  description: string;
  amount: number;
  origin: string;
};

type FinanceResponse = {
  selectedMonth: string;
  monthly: MonthlyFinancePoint[];
  entries: FinanceEntry[];
  totals: { revenue: number; expenses: number; netProfit: number };
};

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function FinancePage() {
  const [months, setMonths] = useState(6);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [error, setError] = useState("");

  async function loadFinance() {
    setError("");
    const res = await fetch(`/api/finance?months=${months}&month=${selectedMonth}`);
    const json = await res.json();
    if (!res.ok) return setError(json.error ?? "Errore finance");
    setData(json);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadFinance();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, selectedMonth]);

  const rows =
    data?.monthly.map((m) => ({
      ...m,
      monthLabel: monthLabel(m.month),
    })) ?? [];

  const monthEntries = useMemo(() => data?.entries ?? [], [data]);
  const monthTotals = useMemo(
    () =>
      monthEntries.reduce(
        (acc, row) => {
          if (row.type === "ENTRATA") acc.income += row.amount;
          else acc.outcome += row.amount;
          return acc;
        },
        { income: 0, outcome: 0 },
      ),
    [monthEntries],
  );

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Finance / Spese</h1>
        <p className="text-sm text-zinc-500">Mese corrente con lista movimenti e analisi trend</p>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <Card>
        <CardHeader title="Periodo" subtitle="Controlla mese e orizzonte analisi" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-zinc-600">
            Mese
            <input
              type="month"
              className="mt-1 block h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-blue-600"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </label>
          <label className="text-sm text-zinc-600">
            Analisi trend
            <select
              className="mt-1 block h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-blue-600"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              <option value={3}>Ultimi 3 mesi</option>
              <option value={6}>Ultimi 6 mesi</option>
              <option value={12}>Ultimi 12 mesi</option>
            </select>
          </label>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <KpiCard title={`Entrate (${monthLabel(selectedMonth)})`} value={`EUR ${monthTotals.income.toFixed(0)}`} />
        <KpiCard title={`Uscite (${monthLabel(selectedMonth)})`} value={`EUR ${monthTotals.outcome.toFixed(0)}`} />
        <KpiCard title={`Netto (${monthLabel(selectedMonth)})`} value={`EUR ${(monthTotals.income - monthTotals.outcome).toFixed(0)}`} />
      </div>

      <Card>
        <CardHeader title="Entrate e uscite" subtitle={`Movimenti del mese ${monthLabel(selectedMonth)}`} />
        {monthEntries.length === 0 ? (
          <p className="text-sm text-zinc-500">Nessun movimento nel mese selezionato.</p>
        ) : (
          <div className="space-y-2">
            {monthEntries.map((row) => (
              <div key={`${row.type}-${row.id}`} className="rounded-xl border border-zinc-200 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{row.description}</p>
                    <p className="text-xs text-zinc-500">
                      {row.date} | {row.category} | {row.origin}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${row.type === "ENTRATA" ? "text-emerald-700" : "text-rose-700"}`}>
                    {row.type === "ENTRATA" ? "+" : "-"} EUR {row.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Revenue vs Spese" subtitle="Trend" action={<ChartColumn className="h-4 w-4 text-blue-600" />} />
          <div className="h-44 md:h-56">
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
          <CardHeader title="Occupancy Rate" subtitle="Trend" action={<LineChartIcon className="h-4 w-4 text-emerald-600" />} />
          <div className="h-44 md:h-56">
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
