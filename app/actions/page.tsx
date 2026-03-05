"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionChecklistModal } from "@/components/action-checklist-modal";
import { ActionTypeBadge, StatusBadge } from "@/components/action-badges";
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
    const res = await fetch("/api/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: action.id, status: next }),
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

  const grouped = useMemo(() => groupByDate(actions), [actions]);

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Actions</h1>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">
            Da
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600">
            A
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700" onClick={() => void loadActions()}>
            Aggiorna
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="space-y-4">
        {Object.entries(grouped).map(([date, rows]) => (
          <div key={date} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">{date}</h2>
              <button className="rounded-md border border-slate-300 px-3 py-1 text-xs" onClick={() => void markDayDone(date)}>
                Segna tutto FATTO
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((a) => (
                <button
                  key={a.id}
                  className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-sky-300"
                  onClick={() => setSelectedAction(a)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ActionTypeBadge actionType={a.action_type} />
                      <span className="text-xs text-slate-500">{a.details ?? ""}</span>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleStatus(a);
                      }}
                    >
                      Toggle stato
                    </button>
                    <span className="text-xs text-slate-500">Booking: {a.booking_id ?? "-"}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
        {actions.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Nessuna azione nel range.</div>
        )}
      </div>

      <ActionChecklistModal
        actionId={selectedAction?.id ?? null}
        title={selectedAction ? `Checklist ${selectedAction.action_type}` : "Checklist"}
        onClose={() => setSelectedAction(null)}
      />
    </section>
  );
}
