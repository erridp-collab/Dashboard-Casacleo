"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionChecklistModal } from "@/components/action-checklist-modal";
import { ActionTypeBadge, StatusBadge } from "@/components/action-badges";
import { Card, CardHeader } from "@/components/card";
import { CalendarRange, CheckCheck, RefreshCw } from "lucide-react";
import type { Action } from "@/types/db";

function groupByDate(actions: Action[]) {
  return actions.reduce<Record<string, Action[]>>((acc, action) => {
    if (!acc[action.action_date]) acc[action.action_date] = [];
    acc[action.action_date].push(action);
    return acc;
  }, {});
}

export default function ActionsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState("");

  async function loadActions() {
    setError("");
    const res = await fetch(`/api/actions?from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore");
    setActions(data.actions ?? []);
  }

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
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadActions();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <CardHeader title="Filtri" subtitle="Seleziona il range da visualizzare" />
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-zinc-600">
            Da
            <input
              id="actions-from-date"
              name="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
            />
          </label>
          <label className="text-sm text-zinc-600">
            A
            <input
              id="actions-to-date"
              name="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
            />
          </label>
          <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => void loadActions()}>
            <RefreshCw className="h-4 w-4" />
            Aggiorna
          </button>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Mostra FATTO
          </label>
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
              <button className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50" onClick={() => void markDayDone(date)}>
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ActionTypeBadge actionType={a.action_type} />
                      <span className="text-xs text-zinc-500">{a.details ?? ""}</span>
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
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-zinc-500">Booking: {a.booking_id ?? "-"}</span>
                    {a.action_type.toUpperCase() === "SPESA" ? (
                      <span className="text-xs text-zinc-500">Lista spesa in dettaglio (non checklist)</span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        ))}
        {visibleActions.length === 0 && (
          <Card>
            <p className="py-4 text-center text-sm text-zinc-500">Nessuna azione nel range selezionato.</p>
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
