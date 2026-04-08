"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionChecklistModal } from "@/components/action-checklist-modal";
import { CleaningModal } from "@/components/cleaning-modal";
import { ActionTypeBadge, StatusBadge } from "@/components/action-badges";
import { Card, CardHeader } from "@/components/card";
import { toast } from "@/components/toast";
import { CalendarRange, CheckCheck, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
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

type LinenDraft = {
  sets_estivo: string;
  sets_invernale: string;
  towels_bidet: string;
  towels_viso: string;
  towels_doccia: string;
  tappetino: string;
  mappine: string;
  spugne_piatti: string;
  spugne_asciuga: string;
};

function buildLinenSuggestion(guests: number): LinenDraft {
  const safeGuests = Number.isFinite(guests) && guests > 0 ? guests : 1;
  const sets = Math.ceil(safeGuests / 2);
  return {
    sets_estivo: String(sets),
    sets_invernale: "0",
    towels_bidet: String(safeGuests),
    towels_viso: String(safeGuests),
    towels_doccia: String(safeGuests),
    tappetino: "1",
    mappine: "1",
    spugne_piatti: "1",
    spugne_asciuga: "1",
  };
}

function toNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isLinenAction(actionType: string): boolean {
  return String(actionType ?? "").toUpperCase().includes("BIANCHERIA");
}

export default function ActionsPage() {
  const [monthCursor, setMonthCursor] = useState(monthStartKey(new Date()));
  const { from, to, label: monthLabel } = useMemo(() => monthRange(monthCursor), [monthCursor]);
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [linenAction, setLinenAction] = useState<Action | null>(null);
  const [cleaningAction, setCleaningAction] = useState<Action | null>(null);
  const [linenDraft, setLinenDraft] = useState<LinenDraft>(() => buildLinenSuggestion(2));
  const [linenLoading, setLinenLoading] = useState(false);
  const [linenError, setLinenError] = useState("");
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

  async function openLinenModal(action: Action) {
    setLinenAction(action);
    setLinenError("");
    if (!action.booking_id) {
      setLinenDraft(buildLinenSuggestion(2));
      return;
    }

    setLinenLoading(true);
    try {
      const res = await fetch(`/api/bookings/${action.booking_id}`);
      const data = await res.json();
      if (!res.ok) {
        setLinenError(data.error ?? "Errore caricamento booking");
        setLinenDraft(buildLinenSuggestion(2));
        return;
      }
      const guests = Number(data.booking?.guests ?? 2);
      setLinenDraft(buildLinenSuggestion(guests));
    } catch (e: unknown) {
      setLinenError(String((e as Error)?.message ?? e));
      setLinenDraft(buildLinenSuggestion(2));
    } finally {
      setLinenLoading(false);
    }
  }

  async function confirmLinenUsage() {
    if (!linenAction) return;
    setLinenError("");
    const values = {
      sets_estivo: toNumber(linenDraft.sets_estivo),
      sets_invernale: toNumber(linenDraft.sets_invernale),
      towels_bidet: toNumber(linenDraft.towels_bidet),
      towels_viso: toNumber(linenDraft.towels_viso),
      towels_doccia: toNumber(linenDraft.towels_doccia),
      tappetino: toNumber(linenDraft.tappetino),
      mappine: toNumber(linenDraft.mappine),
      spugne_piatti: toNumber(linenDraft.spugne_piatti),
      spugne_asciuga: toNumber(linenDraft.spugne_asciuga),
    };

    if (Object.values(values).some((v) => v === null)) {
      setLinenError("Valori non validi");
      return;
    }

    const res = await fetch("/api/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: linenAction.id,
        status: "FATTO",
        completion: {
          mode: "BIANCHERIA",
          linen: values,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLinenError(data.error ?? "Errore aggiornamento biancheria");
      return;
    }

    setActions((prev) => prev.map((x) => (x.id === linenAction.id ? { ...x, status: "FATTO" } : x)));
    toast("Cambio biancheria registrato", "success");
    setLinenAction(null);
  }

  async function toggleStatus(action: Action) {
    const next = action.status === "DA_FARE" ? "FATTO" : "DA_FARE";
    const payload: Record<string, unknown> = { id: action.id, status: next };

    if (next === "FATTO" && isLinenAction(action.action_type)) {
      await openLinenModal(action);
      return;
    }

    if (next === "FATTO" && action.action_type.toUpperCase().includes("PULIZIA")) {
      setCleaningAction(action);
      return;
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
                  className={`w-full rounded-xl border border-zinc-200 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-zinc-50 ${
                    a.status === "FATTO" ? "opacity-70 line-through" : ""
                  }`}
                  onClick={() => {
                    if (a.action_type.toUpperCase() === "SPESA") return;
                    if (isLinenAction(a.action_type)) {
                      void openLinenModal(a);
                      return;
                    }
                    if (a.action_type.toUpperCase().includes("PULIZIA")) {
                      setCleaningAction(a);
                      return;
                    }
                    setSelectedAction(a);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <ActionTypeBadge actionType={a.action_type} />
                      <span className="truncate text-xs text-zinc-500">
                        {a.details ? a.details : a.action_type}
                      </span>
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

      <CleaningModal
        actionId={cleaningAction?.id ?? null}
        actionDate={cleaningAction?.action_date ?? ""}
        onClose={() => setCleaningAction(null)}
        onSaved={() => {
          setCleaningAction(null);
          toast("Check pulizie salvato!", "success");
          void loadActions();
        }}
      />

      {linenAction && (
        <div className="fixed inset-0 z-40 bg-zinc-900/30 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">Cambio biancheria</h3>
              <button
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
                onClick={() => setLinenAction(null)}
              >
                Chiudi
              </button>
            </div>

            {linenLoading && <p className="text-sm text-zinc-500">Caricamento suggerimenti...</p>}
            {linenError && <p className="mb-3 text-sm text-rose-600">{linenError}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-zinc-600">
                Set estivo
                <input
                  className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-blue-600"
                  value={linenDraft.sets_estivo}
                  onChange={(e) => setLinenDraft((prev) => ({ ...prev, sets_estivo: e.target.value }))}
                />
              </label>
              <label className="text-sm text-zinc-600">
                Set invernale
                <input
                  className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-blue-600"
                  value={linenDraft.sets_invernale}
                  onChange={(e) => setLinenDraft((prev) => ({ ...prev, sets_invernale: e.target.value }))}
                />
              </label>
              <label className="text-sm text-zinc-600">
                Asciugamani bidet
                <input
                  className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-blue-600"
                  value={linenDraft.towels_bidet}
                  onChange={(e) => setLinenDraft((prev) => ({ ...prev, towels_bidet: e.target.value }))}
                />
              </label>
              <label className="text-sm text-zinc-600">
                Asciugamani viso
                <input
                  className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-blue-600"
                  value={linenDraft.towels_viso}
                  onChange={(e) => setLinenDraft((prev) => ({ ...prev, towels_viso: e.target.value }))}
                />
              </label>
              <label className="text-sm text-zinc-600">
                Asciugamani doccia
                <input
                  className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-blue-600"
                  value={linenDraft.towels_doccia}
                  onChange={(e) => setLinenDraft((prev) => ({ ...prev, towels_doccia: e.target.value }))}
                />
              </label>
              <label className="text-sm text-zinc-600">
                Tappetino doccia
                <input
                  className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-blue-600"
                  value={linenDraft.tappetino}
                  onChange={(e) => setLinenDraft((prev) => ({ ...prev, tappetino: e.target.value }))}
                />
              </label>
              <label className="text-sm text-zinc-600">
                Mappine cucina
                <input
                  className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-blue-600"
                  value={linenDraft.mappine}
                  onChange={(e) => setLinenDraft((prev) => ({ ...prev, mappine: e.target.value }))}
                />
              </label>
              <label className="text-sm text-zinc-600">
                Spugne piatti
                <input
                  className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-blue-600"
                  value={linenDraft.spugne_piatti}
                  onChange={(e) => setLinenDraft((prev) => ({ ...prev, spugne_piatti: e.target.value }))}
                />
              </label>
              <label className="text-sm text-zinc-600">
                Spugne asciugatutto
                <input
                  className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-blue-600"
                  value={linenDraft.spugne_asciuga}
                  onChange={(e) => setLinenDraft((prev) => ({ ...prev, spugne_asciuga: e.target.value }))}
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
                onClick={() => void confirmLinenUsage()}
                disabled={linenLoading}
              >
                {linenLoading ? "Salvataggio..." : "Salva"}
              </button>
              <button
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-zinc-200 text-sm text-zinc-500 hover:bg-zinc-50"
                onClick={() => setLinenAction(null)}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
