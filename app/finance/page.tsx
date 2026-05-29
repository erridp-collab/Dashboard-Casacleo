"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/card";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { KpiCard } from "@/components/kpi-card";
import { KpiCardSkeleton } from "@/components/skeleton";
import { monthLabel } from "@/lib/format";
import { todayLocalIT } from "@/lib/localDate";
import { ChartColumn, LineChartIcon, Plus, TrendingUp, Trash2 } from "lucide-react";
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

const EXPENSE_CATEGORIES = [
  "Pulizie",
  "Rifornimento",
  "Manutenzione",
  "Utenze",
  "Affitto",
  "Commissioni",
  "Altro",
];

function currentMonthKey() {
  return todayLocalIT().slice(0, 7);
}

export default function FinancePage() {
  const [months, setMonths] = useState(6);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  // New expense form state
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(() => todayLocalIT());
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [formDescription, setFormDescription] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadFinance(signal?: AbortSignal) {
    const seq = ++requestSeqRef.current;
    setError("");
    setLoading(true);
    const result = await clientFetchJson<FinanceResponse>(`/api/finance?months=${months}&month=${selectedMonth}`, { signal });
    if (seq !== requestSeqRef.current) return;
    setLoading(false);
    if (!result.ok) {
      if (!result.aborted) setError(result.error ?? "Errore finance");
      return;
    }
    setData(result.data);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      void loadFinance(ctrl.signal);
    }, 0);
    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, selectedMonth]);

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const amount = Number(formAmount.replace(",", ".").trim());
    if (!formDate || !Number.isFinite(amount) || amount <= 0) {
      setFormError("Data e importo obbligatori");
      return;
    }
    setFormSaving(true);
    const result = await clientFetchJson<{ ok: boolean }>("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expense_date: formDate,
        amount,
        category: formCategory,
        description: formDescription.trim() || formCategory,
      }),
    });
    setFormSaving(false);
    if (!result.ok) {
      setFormError(result.error ?? "Errore salvataggio");
      return;
    }
    setFormAmount("");
    setFormDescription("");
    setShowForm(false);
    void loadFinance();
  }

  async function deleteExpense(id: string) {
    if (!confirm("Eliminare questa spesa?")) return;
    const result = await clientFetchJson<{ ok: boolean }>(`/api/finance?id=${id}`, { method: "DELETE" });
    if (result.ok) {
      void loadFinance();
      return;
    }
    setError(result.error ?? "Errore eliminazione");
  }

  const rows =
    data?.monthly.map((m) => ({
      ...m,
      monthLabel: monthLabel(m.month),
    })) ?? [];

  const monthEntries = useMemo(() => data?.entries ?? [], [data]);

  const incomeEntries = useMemo(() => monthEntries.filter((r) => r.type === "ENTRATA"), [monthEntries]);
  const expenseEntries = useMemo(() => monthEntries.filter((r) => r.type === "USCITA"), [monthEntries]);

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

  const netto = monthTotals.income - monthTotals.outcome;

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sidebar-bg">
          <TrendingUp className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold leading-none tracking-tight text-text-primary">Finance</h1>
          <p className="mt-1 text-xs text-text-secondary">Mese corrente con lista movimenti e analisi trend</p>
        </div>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <Card>
        <CardHeader title="Periodo" subtitle="Controlla mese e orizzonte analisi" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-zinc-600">
            Mese
            <input
              type="month"
              className="input-base mt-1"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </label>
          <label className="text-sm text-zinc-600">
            Analisi trend
            <select
              className="input-base mt-1"
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
        {loading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              title={`Entrate (${monthLabel(selectedMonth)})`}
              value={`EUR ${monthTotals.income.toFixed(0)}`}
              status={monthTotals.income > 0 ? "ok" : "neutral"}
            />
            <KpiCard
              title={`Uscite (${monthLabel(selectedMonth)})`}
              value={`EUR ${monthTotals.outcome.toFixed(0)}`}
              status={monthTotals.outcome > 0 ? "warn" : "neutral"}
            />
            <KpiCard
              title={`Netto (${monthLabel(selectedMonth)})`}
              value={`EUR ${netto.toFixed(0)}`}
              status={netto > 0 ? "ok" : netto < 0 ? "critical" : "neutral"}
            />
          </>
        )}
      </div>

      {/* Entrate */}
      <Card>
        <CardHeader title={`Entrate (${monthLabel(selectedMonth)})`} subtitle="Prenotazioni del mese" />
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-zinc-100 p-3">
                <div className="h-4 w-48 rounded bg-zinc-200" />
                <div className="mt-1.5 h-3 w-32 rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : incomeEntries.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">Nessuna entrata per {monthLabel(selectedMonth)}</p>
        ) : (
          <div className="space-y-2">
            {incomeEntries.map((row) => (
              <div key={`income-${row.id}`} className="rounded-xl border border-zinc-200 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{row.description}</p>
                    <p className="text-xs text-zinc-500">{row.date} | {row.category}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-emerald-700">
                    + EUR {row.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Spese */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-base font-semibold text-zinc-900">Spese ({monthLabel(selectedMonth)})</p>
            <p className="text-xs text-zinc-500">Pulizie, manutenzioni, rifornimenti e spese manuali</p>
          </div>
          <button
            className="btn-danger min-h-[44px]"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            Aggiungi
          </button>
        </div>

        {showForm && (
          <form onSubmit={(e) => void submitExpense(e)} className="mb-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-medium text-zinc-700">Nuova spesa</p>
            {formError && <p className="text-sm text-rose-600">{formError}</p>}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <label className="text-xs text-zinc-600">
                Data
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="input-base mt-1"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Importo (EUR)
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="es. 45,00"
                  required
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="input-base mt-1"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Categoria
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="input-base mt-1"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-600">
                Descrizione
                <input
                  type="text"
                  placeholder="Opzionale"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="input-base mt-1"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={formSaving}
                className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-medium text-white disabled:opacity-60 hover:bg-rose-700"
              >
                {formSaving ? "Salvataggio..." : "Salva spesa"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(""); }}
                className="inline-flex h-10 items-center rounded-xl border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Annulla
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-zinc-100 p-3">
                <div className="h-4 w-48 rounded bg-zinc-200" />
                <div className="mt-1.5 h-3 w-32 rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : expenseEntries.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">Nessuna spesa per {monthLabel(selectedMonth)}</p>
        ) : (
          <div className="space-y-2">
            {expenseEntries.map((row) => (
              <div key={`expense-${row.id}`} className="rounded-xl border border-zinc-200 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{row.description}</p>
                    <p className="text-xs text-zinc-500">
                      {row.date} | {row.category}
                      {row.origin !== "manuale" && (
                        <span className="ml-1.5 rounded bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-500">{row.origin}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-sm font-semibold text-rose-700">
                      - EUR {row.amount.toFixed(2)}
                    </span>
                    {row.origin === "manuale" && (
                      <button
                        onClick={() => void deleteExpense(row.id)}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-rose-600"
                        title="Elimina"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Revenue vs Spese" subtitle="Trend" action={<ChartColumn className="h-4 w-4 text-primary" />} />
          <div className="h-52 md:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ bottom: months >= 6 ? 20 : 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  angle={months >= 6 ? -35 : 0}
                  textAnchor={months >= 6 ? "end" : "middle"}
                  height={months >= 6 ? 48 : 24}
                />
                <YAxis tick={{ fontSize: 11 }} width={45} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Occupancy Rate" subtitle="Trend" action={<LineChartIcon className="h-4 w-4 text-emerald-600" />} />
          <div className="h-52 md:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ bottom: months >= 6 ? 20 : 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  angle={months >= 6 ? -35 : 0}
                  textAnchor={months >= 6 ? "end" : "middle"}
                  height={months >= 6 ? 48 : 24}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={35} />
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
