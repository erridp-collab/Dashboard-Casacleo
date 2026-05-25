"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, CheckCheck, ChevronLeft, ChevronRight, RefreshCw, ClipboardList } from "lucide-react";
import { ActionChecklistModal } from "@/components/action-checklist-modal";
import { ActionTypeBadge, StatusBadge } from "@/components/action-badges";
import { Card, CardHeader } from "@/components/card";
import { CleaningModal } from "@/components/cleaning-modal";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { todayLocalIT } from "@/lib/localDate";
import { toast } from "@/components/toast";
import type { Action, Booking } from "@/types/db";

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
};

type LaundryDraft = {
  sets_estivo: string;
  sets_invernale: string;
  towels_bidet: string;
  towels_viso: string;
  towels_doccia: string;
  tappetino: string;
  mappine: string;
};

type ParsedActionDetails = {
  linen?: Partial<Record<keyof LinenDraft, number | null>>;
  laundry?: Partial<Record<keyof LaundryDraft, number | null>>;
};

type ActionsResponse = {
  actions?: Action[];
};

type BookingResponse = {
  booking?: Booking;
};

type QuantityField<T extends string> = {
  key: T;
  label: string;
};

const LINEN_FIELDS: QuantityField<keyof LinenDraft>[] = [
  { key: "sets_estivo", label: "Set letto estivo" },
  { key: "sets_invernale", label: "Set letto invernale" },
  { key: "towels_bidet", label: "Asciugamani bidet" },
  { key: "towels_viso", label: "Asciugamani viso" },
  { key: "towels_doccia", label: "Asciugamani doccia" },
  { key: "tappetino", label: "Tappetino doccia" },
  { key: "mappine", label: "Mappine cucina" },
];

const LAUNDRY_FIELDS: QuantityField<keyof LaundryDraft>[] = [
  { key: "sets_estivo", label: "Set letto estivo" },
  { key: "sets_invernale", label: "Set letto invernale" },
  { key: "towels_bidet", label: "Asciugamani bidet" },
  { key: "towels_viso", label: "Asciugamani viso" },
  { key: "towels_doccia", label: "Asciugamani doccia" },
  { key: "tappetino", label: "Tappetino doccia" },
  { key: "mappine", label: "Mappine cucina" },
];

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
  };
}

function buildLaundryDraft(): LaundryDraft {
  return {
    sets_estivo: "0",
    sets_invernale: "0",
    towels_bidet: "0",
    towels_viso: "0",
    towels_doccia: "0",
    tappetino: "0",
    mappine: "0",
  };
}

function toNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDraftValue(value: unknown, fallback = "0"): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : fallback;
}

function parseActionDetails(details: string | null): ParsedActionDetails {
  if (!details) return {};
  try {
    const parsed = JSON.parse(details) as ParsedActionDetails;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function fillLinenDraft(base: LinenDraft, values?: Partial<Record<keyof LinenDraft, number | null>>): LinenDraft {
  if (!values) return base;
  return {
    sets_estivo: toDraftValue(values.sets_estivo, base.sets_estivo),
    sets_invernale: toDraftValue(values.sets_invernale, base.sets_invernale),
    towels_bidet: toDraftValue(values.towels_bidet, base.towels_bidet),
    towels_viso: toDraftValue(values.towels_viso, base.towels_viso),
    towels_doccia: toDraftValue(values.towels_doccia, base.towels_doccia),
    tappetino: toDraftValue(values.tappetino, base.tappetino),
    mappine: toDraftValue(values.mappine, base.mappine),
  };
}

function fillLaundryDraft(base: LaundryDraft, values?: Partial<Record<keyof LaundryDraft, number | null>>): LaundryDraft {
  if (!values) return base;
  return {
    sets_estivo: toDraftValue(values.sets_estivo, base.sets_estivo),
    sets_invernale: toDraftValue(values.sets_invernale, base.sets_invernale),
    towels_bidet: toDraftValue(values.towels_bidet, base.towels_bidet),
    towels_viso: toDraftValue(values.towels_viso, base.towels_viso),
    towels_doccia: toDraftValue(values.towels_doccia, base.towels_doccia),
    tappetino: toDraftValue(values.tappetino, base.tappetino),
    mappine: toDraftValue(values.mappine, base.mappine),
  };
}

function isLinenAction(actionType: string): boolean {
  return String(actionType ?? "").toUpperCase().includes("BIANCHERIA");
}

function isLaundryAction(actionType: string): boolean {
  return String(actionType ?? "").toUpperCase().includes("LAVATRICI");
}

function summarizeSelection<T extends string>(
  draft: Partial<Record<T, unknown>> | undefined,
  fields: QuantityField<T>[],
  prefix: string,
): string | null {
  if (!draft) return null;
  const parts = fields
    .map(({ key, label }) => {
      const qty = Number(draft[key] ?? 0);
      return Number.isFinite(qty) && qty > 0 ? `${label}: ${qty}` : null;
    })
    .filter((value): value is string => Boolean(value));

  if (parts.length === 0) return null;
  return `${prefix}: ${parts.join(", ")}`;
}

function getActionLabel(action: Action): string {
  if (!action.details) return action.action_type;
  const parsed = parseActionDetails(action.details);
  return (
    summarizeSelection(parsed.linen, LINEN_FIELDS, "Biancheria")
    ?? summarizeSelection(parsed.laundry, LAUNDRY_FIELDS, "Lavato")
    ?? action.details
  );
}

function QuantityInputs<T extends string>({
  draft,
  fields,
  onChange,
}: {
  draft: Record<T, string>;
  fields: QuantityField<T>[];
  onChange: (key: T, value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map(({ key, label }) => (
        <label key={key} className="text-sm text-zinc-600">
          {label}
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-primary"
            value={draft[key]}
            onChange={(e) => onChange(key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

function ActionModalShell({
  title,
  subtitle,
  error,
  loadingLabel,
  isBusy,
  saveLabel,
  onSave,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  error?: string;
  loadingLabel?: string;
  isBusy?: boolean;
  saveLabel: string;
  onSave: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-900/30 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col overflow-hidden rounded-none bg-white shadow-xl sm:my-6 sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
          </div>
          <button className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" onClick={onClose}>
            Chiudi
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadingLabel && isBusy ? <p className="text-sm text-zinc-500">{loadingLabel}</p> : null}
          {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
          {children}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 px-5 py-4">
          <button
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white shadow-sm hover:opacity-90 active:opacity-80 disabled:opacity-50"
            onClick={onSave}
            disabled={isBusy}
          >
            {isBusy ? "Salvataggio..." : saveLabel}
          </button>
          <button
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-zinc-200 text-sm text-zinc-500 hover:bg-zinc-50"
            onClick={onClose}
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActionsPage() {
  const [monthCursor, setMonthCursor] = useState(() => `${todayLocalIT().slice(0, 7)}-01`);
  const { from, to, label: monthLabel } = useMemo(() => monthRange(monthCursor), [monthCursor]);
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [linenAction, setLinenAction] = useState<Action | null>(null);
  const [laundryAction, setLaundryAction] = useState<Action | null>(null);
  const [cleaningAction, setCleaningAction] = useState<Action | null>(null);
  const [spesaAction, setSpesaAction] = useState<Action | null>(null);
  const [spesaAmount, setSpesaAmount] = useState("");
  const [spesaSaving, setSpesaSaving] = useState(false);
  const [spesaError, setSpesaError] = useState("");
  const [linenDraft, setLinenDraft] = useState<LinenDraft>(() => buildLinenSuggestion(2));
  const [laundryDraft, setLaundryDraft] = useState<LaundryDraft>(() => buildLaundryDraft());
  const [laundryCost, setLaundryCost] = useState("");
  const [linenLoading, setLinenLoading] = useState(false);
  const [laundryLoading, setLaundryLoading] = useState(false);
  const [linenError, setLinenError] = useState("");
  const [laundryError, setLaundryError] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [showAdvancedRange, setShowAdvancedRange] = useState(false);
  const [fromDraft, setFromDraft] = useState(from);
  const [toDraft, setToDraft] = useState(to);
  const [error, setError] = useState("");
  const actionsAbortRef = useRef<AbortController | null>(null);

  const loadActions = useCallback(async () => {
    setError("");
    actionsAbortRef.current?.abort();
    const ctrl = new AbortController();
    actionsAbortRef.current = ctrl;

    try {
      const result = await clientFetchJson<ActionsResponse>(`/api/actions?from=${from}&to=${to}`, { signal: ctrl.signal });
      if (!result.ok) {
        if (!result.aborted) setError(result.error ?? "Errore");
        return;
      }
      setActions(result.data.actions ?? []);
    } catch (e: unknown) {
      console.error("Actions load failed", e);
      setError("Errore caricamento");
    }
  }, [from, to]);

  async function openLinenModal(action: Action) {
    setLinenAction(action);
    setLinenError("");
    const existing = parseActionDetails(action.details).linen;
    if (!action.booking_id) {
      setLinenDraft(fillLinenDraft(buildLinenSuggestion(2), existing));
      return;
    }

    setLinenLoading(true);
    try {
      const result = await clientFetchJson<BookingResponse>(`/api/bookings/${action.booking_id}`);
      if (!result.ok) {
        setLinenError(result.error ?? "Errore caricamento booking");
        setLinenDraft(fillLinenDraft(buildLinenSuggestion(2), existing));
        return;
      }
      const guests = Number(result.data.booking?.guests ?? 2);
      setLinenDraft(fillLinenDraft(buildLinenSuggestion(guests), existing));
    } catch (e: unknown) {
      setLinenError(String((e as Error)?.message ?? e));
      setLinenDraft(fillLinenDraft(buildLinenSuggestion(2), existing));
    } finally {
      setLinenLoading(false);
    }
  }

  function openLaundryModal(action: Action) {
    setLaundryAction(action);
    setLaundryError("");
    setLaundryCost("");
    setLaundryDraft(fillLaundryDraft(buildLaundryDraft(), parseActionDetails(action.details).laundry));
  }

  async function confirmLinenUsage() {
    if (!linenAction) return;
    setLinenError("");
    setLinenLoading(true);
    const values = {
      sets_estivo: toNumber(linenDraft.sets_estivo),
      sets_invernale: toNumber(linenDraft.sets_invernale),
      towels_bidet: toNumber(linenDraft.towels_bidet),
      towels_viso: toNumber(linenDraft.towels_viso),
      towels_doccia: toNumber(linenDraft.towels_doccia),
      tappetino: toNumber(linenDraft.tappetino),
      mappine: toNumber(linenDraft.mappine),
    };

    if (Object.values(values).some((v) => v === null)) {
      setLinenError("Valori non validi");
      setLinenLoading(false);
      return;
    }

    const result = await clientFetchJson<{ ok?: boolean }>("/api/actions", {
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
    setLinenLoading(false);
    if (!result.ok) {
      setLinenError(result.error ?? "Errore aggiornamento biancheria");
      return;
    }

    setActions((prev) => prev.map((x) => (x.id === linenAction.id ? { ...x, status: "FATTO" } : x)));
    toast("Cambio biancheria registrato", "success");
    setLinenAction(null);
  }

  async function confirmLaundryUsage() {
    if (!laundryAction) return;
    setLaundryError("");
    setLaundryLoading(true);
    const values = {
      sets_estivo: toNumber(laundryDraft.sets_estivo),
      sets_invernale: toNumber(laundryDraft.sets_invernale),
      towels_bidet: toNumber(laundryDraft.towels_bidet),
      towels_viso: toNumber(laundryDraft.towels_viso),
      towels_doccia: toNumber(laundryDraft.towels_doccia),
      tappetino: toNumber(laundryDraft.tappetino),
      mappine: toNumber(laundryDraft.mappine),
    };

    if (Object.values(values).some((v) => v === null)) {
      setLaundryError("Valori non validi");
      setLaundryLoading(false);
      return;
    }

    const costRaw = laundryCost.trim().replace(",", ".");
    const costAmount = costRaw ? Number(costRaw) : null;
    if (costRaw && (!Number.isFinite(costAmount) || (costAmount ?? 0) <= 0)) {
      setLaundryError("Costo non valido");
      setLaundryLoading(false);
      return;
    }

    const result = await clientFetchJson<{ ok?: boolean }>("/api/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: laundryAction.id,
        status: "FATTO",
        completion: {
          mode: "LAVATRICI",
          laundry: values,
          ...(costAmount != null ? { amount: costAmount } : {}),
        },
      }),
    });
    setLaundryLoading(false);
    if (!result.ok) {
      setLaundryError(result.error ?? "Errore aggiornamento lavatrici");
      return;
    }

    setActions((prev) => prev.map((x) => (x.id === laundryAction.id ? { ...x, status: "FATTO" } : x)));
    toast("Lavatrici registrate", "success");
    setLaundryAction(null);
  }

  async function confirmSpesa() {
    if (!spesaAction) return;
    const trimmed = spesaAmount.trim().replace(",", ".");
    const amount = trimmed ? Number(trimmed) : null;
    if (trimmed && (!Number.isFinite(amount) || (amount ?? 0) <= 0)) {
      setSpesaError("Importo non valido");
      return;
    }
    setSpesaSaving(true);
    setSpesaError("");
    const completion: Record<string, unknown> = { mode: "SPESA" };
    if (amount != null) completion.amount = amount;
    const result = await clientFetchJson<{ ok?: boolean }>("/api/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: spesaAction.id, status: "FATTO", completion }),
    });
    setSpesaSaving(false);
    if (!result.ok) {
      setSpesaError(result.error ?? "Errore salvataggio spesa");
      return;
    }
    setActions((prev) => prev.map((x) => (x.id === spesaAction.id ? { ...x, status: "FATTO" } : x)));
    toast("Spesa registrata!", "success");
    setSpesaAction(null);
  }

  async function toggleStatus(action: Action) {
    const next = action.status === "DA_FARE" ? "FATTO" : "DA_FARE";
    const payload: Record<string, unknown> = { id: action.id, status: next };

    if (next === "FATTO" && isLinenAction(action.action_type)) {
      await openLinenModal(action);
      return;
    }

    if (next === "FATTO" && isLaundryAction(action.action_type)) {
      openLaundryModal(action);
      return;
    }

    if (next === "FATTO" && action.action_type.toUpperCase().includes("PULIZIA")) {
      setCleaningAction(action);
      return;
    }

    if (next === "FATTO" && action.action_type.toUpperCase() === "SPESA") {
      setSpesaAction(action);
      setSpesaAmount("");
      setSpesaError("");
      return;
    }

    const result = await clientFetchJson<{ ok?: boolean }>("/api/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!result.ok) return setError(result.error ?? "Errore update");
    setActions((prev) => prev.map((x) => (x.id === action.id ? { ...x, status: next } : x)));
    toast(next === "FATTO" ? "Azione completata!" : "Azione segnata da fare", "success");
  }

  async function markDayDone(actionDate: string) {
    const result = await clientFetchJson<{ ok?: boolean }>("/api/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: actionDate, status: "FATTO", onlyPending: true }),
    });
    if (!result.ok) return setError(result.error ?? "Errore mark all");
    setActions((prev) => prev.map((x) => (x.action_date === actionDate ? { ...x, status: "FATTO" } : x)));
    toast("Tutte le azioni del giorno segnate come fatte!");
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadActions();
    }, 0);
    return () => {
      clearTimeout(t);
      actionsAbortRef.current?.abort();
    };
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
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-95"
            onClick={() => void loadActions()}
          >
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
                  className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-primary"
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
                  className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-primary"
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
                    const result = await clientFetchJson<ActionsResponse>(`/api/actions?from=${fromDraft}&to=${toDraft}`);
                    if (!result.ok) return setError(result.error ?? "Errore");
                    setActions(result.data.actions ?? []);
                  })();
                }}
              >
                Applica range
              </button>
            </div>
          ) : null}
        </div>
      </Card>

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="space-y-4">
        {Object.entries(groupedVisible).map(([date, rows]) => (
          <Card key={date}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-800">
                <CalendarRange className="h-4 w-4 text-primary" />
                {date}
              </h2>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                onClick={() => void markDayDone(date)}
              >
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
                    if (a.action_type.toUpperCase() === "SPESA") {
                      setSpesaAction(a);
                      setSpesaAmount("");
                      setSpesaError("");
                      return;
                    }
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
                      <span className="truncate text-xs text-zinc-500">{getActionLabel(a)}</span>
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
        {visibleActions.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                <ClipboardList className="h-8 w-8" />
              </div>
              <p className="text-base font-medium text-zinc-800">Nessuna azione trovata</p>
              <p className="max-w-[280px] text-sm text-zinc-500">
                Nessuna azione pianificata nel range selezionato. Le azioni vengono generate automaticamente in base alle prenotazioni.
              </p>
            </div>
          </Card>
        ) : null}
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

      {linenAction ? (
        <ActionModalShell
          title="Cambio biancheria"
          error={linenError}
          loadingLabel="Caricamento suggerimenti..."
          isBusy={linenLoading}
          saveLabel="Salva"
          onSave={() => void confirmLinenUsage()}
          onClose={() => setLinenAction(null)}
        >
          <QuantityInputs
            draft={linenDraft}
            fields={LINEN_FIELDS}
            onChange={(key, value) => setLinenDraft((prev) => ({ ...prev, [key]: value }))}
          />
        </ActionModalShell>
      ) : null}

      {spesaAction ? (
        <ActionModalShell
          title="Registra spesa"
          subtitle={spesaAction.status === "FATTO" ? "Già segnata come fatta" : "Inserisci l'importo speso per registrare la spesa"}
          error={spesaError}
          isBusy={spesaSaving}
          saveLabel="Segna come fatto"
          onSave={() => void confirmSpesa()}
          onClose={() => setSpesaAction(null)}
        >
          {spesaAction.details ? (
            <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Lista prodotti</p>
              <pre className="whitespace-pre-wrap text-xs text-zinc-700">{spesaAction.details}</pre>
            </div>
          ) : null}
          <label className="block text-sm text-zinc-600">
            Importo speso (€, opzionale)
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="es. 34.50"
              value={spesaAmount}
              onChange={(e) => setSpesaAmount(e.target.value)}
              className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          {spesaAmount.trim() && Number(spesaAmount.replace(",", ".")) > 0 ? (
            <p className="mt-1 text-xs text-zinc-400">Verrà registrata una spesa di €{Number(spesaAmount.replace(",", ".")).toFixed(2)}</p>
          ) : null}
        </ActionModalShell>
      ) : null}

      {laundryAction ? (
        <ActionModalShell
          title="Lavatrici"
          subtitle="Indica solo cosa hai lavato: il magazzino si ricarica su quei pezzi fino al massimo."
          error={laundryError}
          isBusy={laundryLoading}
          saveLabel="Registra lavaggio"
          onSave={() => void confirmLaundryUsage()}
          onClose={() => setLaundryAction(null)}
        >
          <QuantityInputs
            draft={laundryDraft}
            fields={LAUNDRY_FIELDS}
            onChange={(key, value) => setLaundryDraft((prev) => ({ ...prev, [key]: value }))}
          />
          <label className="mt-4 block text-sm text-zinc-600">
            Costo lavanderia (€, opzionale)
            <input
              type="number"
              min="0"
              step="0.5"
              inputMode="decimal"
              placeholder="es. 15"
              value={laundryCost}
              onChange={(e) => setLaundryCost(e.target.value)}
              className="mt-1 block h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          {laundryCost.trim() && Number(laundryCost.replace(",", ".")) > 0 ? (
            <p className="mt-1 text-xs text-zinc-400">Verrà registrata una spesa di €{Number(laundryCost.replace(",", ".")).toFixed(2)}</p>
          ) : null}
        </ActionModalShell>
      ) : null}
    </section>
  );
}
