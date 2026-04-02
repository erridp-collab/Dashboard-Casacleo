"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionChecklistModal } from "@/components/action-checklist-modal";
import { ActionTypeBadge, StatusBadge } from "@/components/action-badges";
import { Card, CardHeader } from "@/components/card";
import { toast } from "@/components/toast";
import { CalendarRange, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { Action } from "@/types/db";

function groupByDate(actions: Action[]) {
  return actions.reduce<Record<string, Action[]>>((acc, action) => {
    if (!acc[action.action_date]) acc[action.action_date] = [];
    acc[action.action_date].push(action);
    return acc;
  }, {});
}

function monthStartKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthRange(startDate: string) {
  const d = new Date(startDate);
  const year = d.getFullYear();
  const month = d.getMonth();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to, label: d.toLocaleDateString("it-IT", { month: "long", year: "numeric" }) };
}

export default function ActionsPage() {
  const [monthCursor, setMonthCursor] = useState(monthStartKey(new Date()));
  const { from, to, label: monthLabel } = useMemo(() => monthRange(monthCursor), [monthCursor]);
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [showAdvancedRange, setShowAdvancedRange] = useState(false);
  const [fromDraft, setFromDraft] = useState(from);
  const [toDraft, setToDraft] = useState(to);
  const [error, setError] = useState("");

  const loadActions = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/actions?from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore");
    setActions(data.actions ?? []);
  }, [from, to]);

  async function toggleStatus(action: Action) {
    const next = action.status === "DA_FARE" ? "FATTO" : "DA_FARE";
    const payload: Record<string, unknown> = { id: action.id, status: next };

    if (next === "FATTO" && action.action_type.toUpperCase().includes("PULIZIA")) {
      const external = confirm("Pulizia esterna? OK = esterna, Annulla = fatta da te");
      if (external) {
        const amountRaw = prompt("Importo pulizia esterna (EUR)", "");
        if (amountRaw === null) return;
        const amount = Number(amountRaw.replace(",", ".").trim());
        if (!Number.isFinite(amount) || amount <= 0) {
          setError("Importo pulizia esterna non valido");
          return;
        }
        payload.completion = { mode: "EXTERNAL", external_amount: amount };
      } else {
        payload.completion = { mode: "SELF" };
      }
    }

    if (next === "FATTO" && action.action_type.toUpperCase() === "SPESA") {
      const amountRaw = prompt("Importo spesa/rifornimento (EUR, opzionale)", "");
      if (amountRaw === null) return;
      const trimmed = amountRaw.trim();
      if (trimmed !== "") {
        const amount = Number(trimmed.replace(",", "."));
        if (!Number.isFinite(amount) || amount <= 0) {
          setError("Importo spesa non valido");
          return;
        }
        payload.completion = { mode: "SPESA", amount };
      } else {
        payload.completion = { mode: "SPESA" };
      }
    }

    const res = await fetch("/api/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore update");
    setActions((prev) => prev.map((x) => (x.id === action.id ? { ...x, status: next } : x)));
    toast(next === "FATTO" ? "Azione completata!" : "Azione segnata da fare", "success");
  }

  async function markDayDone(actionDate: string) {
    const res = await fetch("/api/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: actionDate, status: "FATTO", onlyPending: true }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore mark all");
    setActions((prev) => prev.map((x) => (x.action_date === actionDate ? { ...x, status: "FATTO" } : x)));
    toast("Tutte le azioni del giorno segnate come fatte!");
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadActions();
    }, 0);
    return () => clearTimeout(t);
  }, [loadActions]);

  const visibleActions = useMemo(
    () => (showDone ? actions : actions.filter((a) => a.status !== "FATTO")),
    [actions, showDone],
  );
  const groupedVisible = useMemo(() => groupByDate(visibleActions), [visibleActions]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Actions</h1>
        <p className="text-sm text-zinc-500">Azioni raggruppate per data</p>
      </header>

      <Card>
        <CardHeader title="Mese operativo" subtitle="Vista predefinita sul mese corrente" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="col-span-full flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <button
              className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs transition hover:bg-zinc-100 active:scale-95"
              onClick={() => {
                const d = new Date(monthCursor);
                d.setMonth(d.getMonth() - 1);
                setMonthCursor(monthStartKey(d));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Mese prec.</span>
            </button>
            <span className="text-sm font-medium capitalize text-zinc-800">{monthLabel}</span>
            <button
              className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs transition hover:bg-zinc-100 active:scale-95"
              onClick={() => {
                const d = new Date(monthCursor);
                d.setMonth(d.getMonth() + 1);
                setMonthCursor(monthStartKey(d));
              }}
            >
              <span className="hidden sm:inline">Mese succ.</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 active:scale-95" onClick={() => void loadActions()}>
            <RefreshCw className="h-4 w-4" />
            Aggiorna
          </button>
          <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-600">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Mostra FATTO
          </label>
          <button
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => {
              const next = !showAdvancedRange;
              setShowAdvancedRange(next);
              if (next) {
                setFromDraft(from);
                setToDraft(to);
              }
            }}
          >
            Range avanzato
          </button>
          {showAdvancedRange ? (
            <div className="col-span-full grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-3">
              <label className="text-sm text-zinc-600">
                Da
                <input
                  id="actions-from-date"
                  name="from"
                  type="date"
                  value={fromDraft}
                  onChange={(e) => setFromDraft(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
                />
              </label>
              <label className="text-sm text-zinc-600">
                A
                <input
                  id="actions-to-date"
                  name="to"
                  type="date"
                  value={toDraft}
                  onChange={(e) => setToDraft(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
                />
              </label>
              <button
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
                onClick={() => {
                  if (!fromDraft || !toDraft || fromDraft > toDraft) {
                    setError("Range date non valido");
                    return;
                  }
                  setMonthCursor(fromDraft.slice(0, 8) + "01");
                  void (async () => {
                    setError("");
                    const res = await fetch(`/api/actions?from=${fromDraft}&to=${toDraft}`);
                    const data = await res.json();
                    if (!res.ok) return setError(data.error ?? "Errore");
                    setActions(data.actions ?? []);
                  })();
                }}
              >
                Applica range
              </button>
            </div>
          ) : null}
        </div>
      </Card>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="space-y-4">
        {Object.entries(groupedVisible).map(([date, rows]) => (
          <Card key={date}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-800">
                <CalendarRange className="h-4 w-4 text-blue-600" />
                {date}
              </h2>
              <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50" onClick={() => void markDayDone(date)}>
                <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                Segna tutto FATTO
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((a) => (
                <button
                  key={a.id}
                  className={`w-full rounded-xl border border-zinc-200 p-3 text-left transition hover:border-blue-200 hover:bg-zinc-50 ${
                    a.status === "FATTO" ? "opacity-70 line-through" : ""
                  }`}
                  onClick={() => {
                    if (a.action_type.toUpperCase() === "SPESA") return;
                    setSelectedAction(a);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                      <ActionTypeBadge actionType={a.action_type} />
                        <span className="text-xs text-zinc-500">Booking: {a.booking_id ?? "-"}</span>
                      </div>
                      {a.details ? <p className="truncate text-xs text-zinc-500">{a.details}</p> : null}
                    </div>
                    <button
                      className="rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleStatus(a);
                      }}
                    >
                      <StatusBadge status={a.status} />
                    </button>
                  </div>
                  {a.details ? (
                    <details className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50 p-2">
                      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-zinc-600">
                        <ChevronDown className="h-3.5 w-3.5" />
                        Dettagli
                      </summary>
                      <p className="mt-2 whitespace-pre-line text-xs text-zinc-600">{a.details}</p>
                    </details>
                  ) : null}
                </button>
              ))}
            </div>
          </Card>
        ))}
        {visibleActions.length === 0 && (
          <Card>
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="text-3xl">📅</span>
              <p className="text-sm font-medium text-zinc-700">Nessuna azione</p>
              <p className="text-xs text-zinc-400">Nessuna azione pianificata nel range selezionato</p>
            </div>
          </Card>
        )}
      </div>

      <ActionChecklistModal
        actionId={selectedAction?.id ?? null}
        title={selectedAction ? `Checklist ${selectedAction.action_type}` : "Checklist"}
        onClose={() => setSelectedAction(null)}
        onActionStatusChange={(actionId, nextStatus) => {
          setActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, status: nextStatus } : a)));
        }}
      />
    </section>
  );
}
