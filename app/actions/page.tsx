"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from "lucide-react";
import { ActionChecklistModal } from "@/components/action-checklist-modal";
import { ActionTypeBadge, StatusBadge } from "@/components/action-badges";
import { Card } from "@/components/card";
import { CleaningModal } from "@/components/cleaning-modal";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { Drawer } from "@/components/drawer";
import { formatCurrencyIT, formatDateHeaderIT } from "@/lib/format";
import { getActionTypeLabel } from "@/lib/actionMeta";
import { InlineAlert } from "@/components/inline-alert";
import { ListGroup, ListPanel, ListRow, ListRows, ListSectionHeader } from "@/components/grouped-list";
import { todayLocalIT } from "@/lib/localDate";
import { PageHeader } from "@/components/page-header";
import { toast } from "@/components/toast";
import type { Action, Booking } from "@/types/db";
import { markDataVisible } from "@/lib/perf/navMarks";

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
  towels_corpo: string;
  towels_bidet: string;
  towels_viso: string;
  towels_doccia: string;
  tappetino: string;
  mappine: string;
};

type LaundryDraft = {
  sets_estivo: string;
  sets_invernale: string;
  towels_corpo: string;
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
  { key: "towels_corpo", label: "Asciugamani corpo" },
  { key: "towels_bidet", label: "Asciugamani bidet" },
  { key: "towels_viso", label: "Asciugamani viso" },
  { key: "towels_doccia", label: "Asciugamani doccia" },
  { key: "tappetino", label: "Tappetino doccia" },
  { key: "mappine", label: "Mappine cucina" },
];

const LAUNDRY_FIELDS: QuantityField<keyof LaundryDraft>[] = [
  { key: "sets_estivo", label: "Set letto estivo" },
  { key: "sets_invernale", label: "Set letto invernale" },
  { key: "towels_corpo", label: "Asciugamani corpo" },
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
    towels_corpo: String(safeGuests),
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
    towels_corpo: "0",
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
    towels_corpo: toDraftValue(values.towels_corpo, base.towels_corpo),
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
  if (!action.details) return "";
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
        <label key={key} className="text-sm text-text-secondary">
          {label}
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            className="input-base mt-1"
            value={draft[key]}
            onChange={(e) => onChange(key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

function ActionModalShell({
  open,
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
  open: boolean;
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
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-primary w-full disabled:opacity-50" onClick={onSave} disabled={isBusy}>
            {isBusy ? "Salvataggio..." : saveLabel}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={onClose}>
            Annulla
          </button>
        </div>
      }
    >
      {loadingLabel && isBusy ? <p className="text-sm text-text-secondary">{loadingLabel}</p> : null}
      {error ? <p className="mb-3 text-sm text-semantic-error">{error}</p> : null}
      {children}
    </Drawer>
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
        if (!result.aborted) setError(result.error ?? "Non è stato possibile caricare le azioni");
        return;
      }
      setActions(result.data.actions ?? []);
      markDataVisible("actions");
    } catch (e: unknown) {
      console.error("Actions load failed", e);
      setError("Non è stato possibile caricare le azioni");
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
        setLinenError(result.error ?? "Non è stato possibile caricare la prenotazione");
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

  async function confirmLinenUsage() {
    if (!linenAction) return;
    setLinenError("");
    setLinenLoading(true);
    const values = {
      sets_estivo: toNumber(linenDraft.sets_estivo),
      sets_invernale: toNumber(linenDraft.sets_invernale),
      towels_corpo: toNumber(linenDraft.towels_corpo),
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
      towels_corpo: toNumber(laundryDraft.towels_corpo),
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

    if (next === "FATTO" && (isLaundryAction(action.action_type) || action.action_type.toUpperCase().startsWith("MANUT"))) {
      setSelectedAction(action);
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
    if (!result.ok) return setError(result.error ?? "Non è stato possibile salvare le modifiche");
    setActions((prev) => prev.map((x) => (x.id === action.id ? { ...x, status: next } : x)));
    toast(next === "FATTO" ? "Azione completata!" : "Azione segnata da fare", "success");
  }

  function openActionDetail(a: Action) {
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
  }

  async function markDayDone(actionDate: string) {
    const result = await clientFetchJson<{ ok?: boolean }>("/api/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: actionDate, status: "FATTO", onlyPending: true }),
    });
    if (!result.ok) return setError(result.error ?? "Non è stato possibile completare le azioni della giornata");
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
      <PageHeader
        title="Azioni"
        subtitle={`${visibleActions.length} azion${visibleActions.length === 1 ? "e" : "i"} · ${monthLabel}`}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border-strong/20 bg-surface-muted px-1 py-1">
            <button
              type="button"
              aria-label="Mese precedente"
              className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-text-primary"
              onClick={() => {
                const d = new Date(monthCursor);
                d.setMonth(d.getMonth() - 1);
                setMonthCursor(monthStartKey(d));
              }}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-[9ch] px-1 text-center text-sm font-semibold capitalize text-text-primary">{monthLabel}</span>
            <button
              type="button"
              aria-label="Mese successivo"
              className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-text-primary"
              onClick={() => {
                const d = new Date(monthCursor);
                d.setMonth(d.getMonth() + 1);
                setMonthCursor(monthStartKey(d));
              }}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1.5" onClick={() => void loadActions()}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Aggiorna
          </button>

          <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong/20 px-3 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
              className="h-4 w-4 accent-brand-primary"
            />
            Mostra completate
          </label>

          <button
            type="button"
            className="btn-ghost btn-sm ml-auto"
            onClick={() => {
              const next = !showAdvancedRange;
              setShowAdvancedRange(next);
              if (next) {
                setFromDraft(from);
                setToDraft(to);
              }
            }}
          >
            Periodo personalizzato
          </button>
        </div>

        {showAdvancedRange ? (
          <div className="mt-3 grid gap-3 rounded-xl border border-border-strong/12 bg-surface-muted p-3 sm:grid-cols-3">
            <label className="text-sm text-text-secondary">
              Da
              <input
                id="actions-from-date"
                name="from"
                type="date"
                value={fromDraft}
                onChange={(e) => setFromDraft(e.target.value)}
                className="input-base mt-1"
              />
            </label>
            <label className="text-sm text-text-secondary">
              A
              <input
                id="actions-to-date"
                name="to"
                type="date"
                value={toDraft}
                onChange={(e) => setToDraft(e.target.value)}
                className="input-base mt-1"
              />
            </label>
            <button
              type="button"
              className="btn-secondary self-end"
              onClick={() => {
                if (!fromDraft || !toDraft || fromDraft > toDraft) {
                  setError("Periodo non valido");
                  return;
                }
                setMonthCursor(fromDraft.slice(0, 8) + "01");
                void (async () => {
                  setError("");
                  const result = await clientFetchJson<ActionsResponse>(`/api/actions?from=${fromDraft}&to=${toDraft}`);
                  if (!result.ok) return setError(result.error ?? "Non è stato possibile caricare le azioni");
                  setActions(result.data.actions ?? []);
                })();
              }}
            >
              Applica periodo
            </button>
          </div>
        ) : null}
      </Card>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      {visibleActions.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
              <ClipboardList className="h-8 w-8" aria-hidden="true" />
            </div>
            <p className="text-base font-medium text-text-primary">Nessuna azione trovata</p>
            <p className="max-w-[280px] text-sm text-text-secondary">
              Nessuna azione pianificata nel periodo selezionato. Le azioni vengono generate automaticamente in base alle prenotazioni.
            </p>
          </div>
        </Card>
      ) : (
        <ListPanel>
          {Object.entries(groupedVisible)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, rows], idx) => {
              const label = date === todayLocalIT() ? `Oggi · ${formatDateHeaderIT(date)}` : formatDateHeaderIT(date);
              return (
                <ListGroup key={date} isFirst={idx === 0}>
                  <ListSectionHeader
                    title={label.toUpperCase()}
                    action={
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary transition-colors duration-150 hover:text-text-primary"
                        onClick={() => void markDayDone(date)}
                      >
                        <CheckCheck className="h-3.5 w-3.5 text-semantic-success" aria-hidden="true" />
                        Segna tutto come completato
                      </button>
                    }
                  />
                  <ListRows>
                    {rows.map((a) => (
                      <ListRow key={a.id}>
                        {/* Apertura riga (checklist/dettaglio) e toggle stato sono due
                            controlli indipendenti e non annidati (IMPLEMENTATION_PLAN_UI_UX.md,
                            sezione 7). */}
                        <button
                          type="button"
                          className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left ${
                            a.status === "FATTO" ? "opacity-60" : ""
                          }`}
                          onClick={() => openActionDetail(a)}
                        >
                          <ActionTypeBadge actionType={a.action_type} />
                          <span className={`truncate text-xs text-text-secondary ${a.status === "FATTO" ? "line-through" : ""}`}>
                            {getActionLabel(a)}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded-full"
                          aria-label={a.status === "FATTO" ? "Segna come da fare" : "Segna come completata"}
                          onClick={() => void toggleStatus(a)}
                        >
                          <StatusBadge status={a.status} />
                        </button>
                      </ListRow>
                    ))}
                  </ListRows>
                </ListGroup>
              );
            })}
        </ListPanel>
      )}

      <ActionChecklistModal
        actionId={selectedAction?.id ?? null}
        title={selectedAction ? `Checklist ${getActionTypeLabel(selectedAction.action_type)}` : "Checklist"}
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

      <ActionModalShell
        open={Boolean(linenAction)}
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

      <ActionModalShell
        open={Boolean(spesaAction)}
        title="Registra spesa"
        subtitle={spesaAction?.status === "FATTO" ? "Già segnata come fatta" : "Inserisci l'importo speso per registrare la spesa"}
        error={spesaError}
        isBusy={spesaSaving}
        saveLabel="Segna come fatto"
        onSave={() => void confirmSpesa()}
        onClose={() => setSpesaAction(null)}
      >
        {spesaAction?.details ? (
          <div className="mb-4 rounded-xl border border-border-strong/12 bg-surface-muted px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Lista prodotti</p>
            <pre className="whitespace-pre-wrap text-xs text-text-primary">{spesaAction.details}</pre>
          </div>
        ) : null}
        <label className="block text-sm text-text-secondary">
          Importo speso (€, opzionale)
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="es. 34.50"
            value={spesaAmount}
            onChange={(e) => setSpesaAmount(e.target.value)}
            className="input-base mt-1"
          />
        </label>
        {spesaAmount.trim() && Number(spesaAmount.replace(",", ".")) > 0 ? (
          <p className="mt-1 text-xs text-text-muted">Verrà registrata una spesa di {formatCurrencyIT(Number(spesaAmount.replace(",", ".")))}</p>
        ) : null}
      </ActionModalShell>

      <ActionModalShell
        open={Boolean(laundryAction)}
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
        <label className="mt-4 block text-sm text-text-secondary">
          Costo lavanderia (€, opzionale)
          <input
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            placeholder="es. 15"
            value={laundryCost}
            onChange={(e) => setLaundryCost(e.target.value)}
            className="input-base mt-1"
          />
        </label>
        {laundryCost.trim() && Number(laundryCost.replace(",", ".")) > 0 ? (
          <p className="mt-1 text-xs text-text-muted">Verrà registrata una spesa di {formatCurrencyIT(Number(laundryCost.replace(",", ".")))}</p>
        ) : null}
      </ActionModalShell>
    </section>
  );
}
