"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Drawer } from "@/components/drawer";
import { InlineAlert } from "@/components/inline-alert";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { KpiCardSkeleton, Skeleton } from "@/components/skeleton";
import { formatCurrencyIT, formatDateIT, formatMonthLongIT, monthLabel } from "@/lib/format";
import { todayLocalIT } from "@/lib/localDate";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { MonthlyFinancePoint } from "@/types/db";
import { markDataVisible } from "@/lib/perf/navMarks";

// Recharts is a heavy dependency (~390 KB) used only by these two charts —
// load it on the client only, after the rest of the page is interactive.
const FinanceCharts = dynamic(() => import("./finance-charts"), {
  ssr: false,
  loading: () => (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader title="Entrate vs Spese" subtitle="Andamento" />
        <Skeleton className="h-52 md:h-60" />
      </Card>
      <Card>
        <CardHeader title="Tasso occupazione" subtitle="Andamento" />
        <Skeleton className="h-52 md:h-60" />
      </Card>
    </div>
  ),
});

type FinanceEntry = {
  id: string;
  date: string;
  type: "ENTRATA" | "USCITA";
  category: string;
  description: string;
  amount: number;
  origin: string;
  detail?: string | null;
};

type FinanceResponse = {
  selectedMonth: string;
  monthly: MonthlyFinancePoint[];
  entries: FinanceEntry[];
  totals: { revenue: number; expenses: number; netProfit: number };
};

type MovementFilter = "tutti" | "entrate" | "spese";

const EXPENSE_CATEGORIES = ["Pulizie", "Rifornimento", "Manutenzione", "Utenze", "Affitto", "Commissioni", "Altro"];

function currentMonthKey() {
  return todayLocalIT().slice(0, 7);
}

export default function FinancePage() {
  const [months, setMonths] = useState(6);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("tutti");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; origin: string } | null>(null);
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

  async function loadFinance(signal?: AbortSignal, silent = false) {
    const seq = ++requestSeqRef.current;
    setError("");
    if (!silent) setLoading(true);
    const result = await clientFetchJson<FinanceResponse>(`/api/finance?months=${months}&month=${selectedMonth}`, { signal });
    if (seq !== requestSeqRef.current) return;
    setLoading(false);
    if (!result.ok) {
      if (!result.aborted) setError(result.error ?? "Non è stato possibile caricare i dati economici");
      return;
    }
    setData(result.data);
    markDataVisible("finance");
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
    void loadFinance(undefined, true);
  }

  async function deleteExpense(id: string) {
    const result = await clientFetchJson<{ ok: boolean }>(`/api/finance?id=${id}`, { method: "DELETE" });
    if (result.ok) {
      void loadFinance(undefined, true);
      return;
    }
    setError(result.error ?? "Errore eliminazione");
  }

  const rows = useMemo(() => data?.monthly.map((m) => ({ ...m, monthLabel: monthLabel(m.month) })) ?? [], [data]);

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

  const netto = monthTotals.income - monthTotals.outcome;

  const visibleEntries = useMemo(() => {
    const sorted = [...monthEntries].sort((a, b) => b.date.localeCompare(a.date));
    if (movementFilter === "entrate") return sorted.filter((r) => r.type === "ENTRATA");
    if (movementFilter === "spese") return sorted.filter((r) => r.type === "USCITA");
    return sorted;
  }, [monthEntries, movementFilter]);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Spese"
        subtitle={formatMonthLongIT(`${selectedMonth}-01`)}
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Aggiungi spesa
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          aria-label="Mese"
          className="input-base h-10 w-auto"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
        <select
          aria-label="Confronto nel tempo"
          className="input-base h-10 w-auto"
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
        >
          <option value={3}>Ultimi 3 mesi</option>
          <option value={6}>Ultimi 6 mesi</option>
          <option value={12}>Ultimi 12 mesi</option>
        </select>
      </div>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {loading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard title="Entrate" value={formatCurrencyIT(monthTotals.income)} status={monthTotals.income > 0 ? "ok" : "neutral"} />
            <KpiCard title="Spese" value={formatCurrencyIT(monthTotals.outcome)} status="neutral" />
            <KpiCard
              title="Netto"
              value={formatCurrencyIT(netto)}
              status={netto > 0 ? "ok" : netto < 0 ? "warn" : "neutral"}
            />
          </>
        )}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <CardHeader title="Movimenti" subtitle={formatMonthLongIT(`${selectedMonth}-01`)} />
        </div>
        <div className="mb-4 -mt-2 inline-flex rounded-lg border border-border-strong/20 bg-surface-muted p-1">
          {(
            [
              ["tutti", "Tutti"],
              ["entrate", "Entrate"],
              ["spese", "Spese"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMovementFilter(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                movementFilter === value ? "bg-surface-raised text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-border-strong/12 p-3">
                <div className="h-4 w-48 rounded bg-surface-muted" />
                <div className="mt-1.5 h-3 w-32 rounded bg-surface-muted" />
              </div>
            ))}
          </div>
        ) : visibleEntries.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-secondary">Nessun movimento per {monthLabel(selectedMonth)}</p>
        ) : (
          <div className="divide-y divide-border-strong/10">
            {visibleEntries.map((row) => {
              const isIncome = row.type === "ENTRATA";
              return (
                <div key={row.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{row.description}</p>
                      <p className="text-xs text-text-secondary">
                        {formatDateIT(row.date)} · {row.category}
                        {row.origin !== "manuale" && (
                          <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
                            {row.origin}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className={`text-sm font-semibold ${isIncome ? "text-semantic-success" : "text-semantic-error"}`}>
                        {isIncome ? "+" : "-"} {formatCurrencyIT(row.amount)}
                      </span>
                      {row.detail && (
                        <button
                          type="button"
                          onClick={() => setExpandedExpenseId((v) => (v === row.id ? null : row.id))}
                          aria-label="Dettagli"
                          aria-expanded={expandedExpenseId === row.id}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-surface-muted hover:text-text-primary"
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${expandedExpenseId === row.id ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </button>
                      )}
                      {!isIncome && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: row.id, origin: row.origin })}
                          aria-label="Elimina"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-semantic-error/10 hover:text-semantic-error"
                        >
                          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  {row.detail && expandedExpenseId === row.id && (
                    <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-muted p-2 text-xs text-text-secondary">{row.detail}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <FinanceCharts rows={rows} months={months} />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="Aggiungi spesa">
        <form onSubmit={(e) => void submitExpense(e)} className="grid gap-3">
          {formError && <p className="text-sm text-semantic-error">{formError}</p>}
          <label className="text-xs text-text-secondary">
            Data
            <input
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="input-base mt-1"
            />
          </label>
          <label className="text-xs text-text-secondary">
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
          <label className="text-xs text-text-secondary">
            Categoria
            <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="input-base mt-1">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-text-secondary">
            Descrizione
            <input
              type="text"
              placeholder="Opzionale"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="input-base mt-1"
            />
          </label>
          <button type="submit" disabled={formSaving} className="btn-primary mt-2 w-full disabled:opacity-50">
            {formSaving ? "Salvataggio..." : "Salva spesa"}
          </button>
        </form>
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminare la spesa?"
        description={
          deleteTarget?.origin && deleteTarget.origin !== "manuale"
            ? "Questa spesa è stata generata automaticamente da un'azione. Eliminandola ora, verrà ricreata se l'azione collegata torna completata."
            : undefined
        }
        confirmLabel="Elimina"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) void deleteExpense(target.id);
        }}
      />
    </section>
  );
}
