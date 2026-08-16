"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ActionTypeBadge, StatusBadge } from "@/components/action-badges";
import { Card } from "@/components/card";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Drawer } from "@/components/drawer";
import { InlineAlert } from "@/components/inline-alert";
import { PageHeader } from "@/components/page-header";
import { RowSkeleton } from "@/components/skeleton";
import { toast } from "@/components/toast";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";
import { CalendarDays, CalendarOff, PenLine, Plus, Save, Trash2 } from "lucide-react";
import type { Action, Booking } from "@/types/db";
import { addDaysLocalIT, parseLocalDateIT, todayLocalIT } from "@/lib/localDate";
import { formatCurrencyIT, formatDateIT, formatMonthLongIT } from "@/lib/format";

type BookingForm = {
  check_in: string;
  check_out: string;
  guests: number;
  channel: string;
  notes: string;
  total_amount: string;
};

type BookingsResponse = {
  bookings?: Booking[];
};

type ActionsResponse = {
  actions?: Action[];
};

function buildInitialForm(): BookingForm {
  const today = todayLocalIT();
  return {
    check_in: today,
    check_out: addDaysLocalIT(today, 1),
    guests: 2,
    channel: "airbnb",
    notes: "",
    total_amount: "",
  };
}

function parseAmountInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const start = parseLocalDateIT(checkIn);
  const end = parseLocalDateIT(checkOut);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function channelChipClass(channel: string | null): string {
  const ch = (channel ?? "").toLowerCase();
  if (ch.includes("airbnb")) return "bg-brand-primary/10 text-brand-primary";
  if (ch.includes("booking")) return "bg-semantic-info/10 text-semantic-info";
  return "bg-surface-muted text-text-secondary";
}

function cleaningStatusChipClass(done: boolean): string {
  return done ? "bg-semantic-success/10 text-semantic-success" : "bg-semantic-warning/10 text-semantic-warning";
}

export default function BookingsPage() {
  const [form, setForm] = useState<BookingForm>(() => buildInitialForm());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [bookingActions, setBookingActions] = useState<Record<string, Action[]>>({});
  const [amountDraftById, setAmountDraftById] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(true);
  // Il drawer nuova prenotazione parte sempre chiuso (server e primo render
  // client identici, niente lettura di window durante il render) e si apre
  // via effect quando arriva ?new=1 dal CTA globale nella TopBar.
  const [showForm, setShowForm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const bookingsAbortRef = useRef<AbortController | null>(null);
  const bookingsRequestSeqRef = useRef(0);

  async function loadBookings(signal?: AbortSignal) {
    const seq = ++bookingsRequestSeqRef.current;
    setError("");
    setLoadingBookings(true);
    const result = await clientFetchJson<BookingsResponse>("/api/bookings", { signal });
    if (seq !== bookingsRequestSeqRef.current) return;
    setLoadingBookings(false);
    if (!result.ok) {
      if (!result.aborted) setError(result.error ?? "Errore caricamento prenotazioni");
      return;
    }
    const rows = result.data.bookings ?? [];
    setBookings(rows);
    setAmountDraftById(
      Object.fromEntries(
        rows.map((b: Booking) => [b.id, b.total_amount === null || b.total_amount === undefined ? "" : String(b.total_amount)]),
      ),
    );
  }

  async function createBooking() {
    setError("");
    const parsedAmount = parseAmountInput(form.total_amount);
    if (Number.isNaN(parsedAmount)) {
      setError("Importo non valido");
      return;
    }
    setLoading(true);
    const result = await clientFetchJson<{ booking_id?: string }>("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        total_amount: parsedAmount,
      }),
    });
    setLoading(false);
    if (!result.ok) {
      const msg = result.error ?? "Errore creazione";
      setError(msg);
      toast(msg, "error");
      return;
    }
    toast("Prenotazione creata con successo", "success");
    setForm(buildInitialForm());
    setShowForm(false);
    // Optimistic: add a placeholder and refresh in background.
    void loadBookings();
  }

  async function updateBooking(id: string) {
    const row = bookings.find((b) => b.id === id);
    if (!row) return;
    const parsedAmount = parseAmountInput(amountDraftById[id] ?? "");
    if (Number.isNaN(parsedAmount)) {
      setError("Importo non valido");
      return;
    }
    const result = await clientFetchJson<{ booking?: Booking }>(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        check_in: row.check_in,
        check_out: row.check_out,
        guests: row.guests,
        channel: row.channel,
        notes: row.notes,
        total_amount: parsedAmount,
      }),
    });
    if (!result.ok) {
      const msg = result.error ?? "Non è stato possibile salvare le modifiche";
      setError(msg);
      toast(msg, "error");
      return;
    }
    toast("Prenotazione aggiornata", "success");
    // Optimistic: update local state immediately, refresh in background.
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, check_in: row.check_in, check_out: row.check_out, guests: row.guests, channel: row.channel, notes: row.notes, total_amount: parsedAmount }
          : b,
      ),
    );
    setEditId(null);
    void loadBookings();
  }

  async function deleteBooking(id: string) {
    const result = await clientFetchJson<{ ok?: boolean }>(`/api/bookings/${id}`, { method: "DELETE" });
    if (!result.ok) {
      const msg = result.error ?? "Non è stato possibile eliminare la prenotazione";
      setError(msg);
      toast(msg, "error");
      return;
    }
    toast("Prenotazione eliminata", "success");
    // Optimistic: remove immediately from local state, refresh in background.
    setBookings((prev) => prev.filter((b) => b.id !== id));
    setExpandedBookingId(null);
    void loadBookings();
  }

  async function toggleActionsForBooking(id: string) {
    const next = expandedBookingId === id ? null : id;
    setExpandedBookingId(next);
    if (!next || bookingActions[id]) return;

    const result = await clientFetchJson<ActionsResponse>(`/api/actions?bookingId=${id}`);
    if (!result.ok) {
      setError(result.error ?? "Errore azioni collegate");
      return;
    }
    setBookingActions((prev) => ({ ...prev, [id]: result.data.actions ?? [] }));
  }

  useEffect(() => {
    const t = setTimeout(() => {
      bookingsAbortRef.current?.abort();
      const ctrl = new AbortController();
      bookingsAbortRef.current = ctrl;
      void loadBookings(ctrl.signal);
    }, 0);
    return () => {
      clearTimeout(t);
      bookingsAbortRef.current?.abort();
    };
  }, []);

  // Apre il drawer quando si arriva dal CTA globale "+ Nuova prenotazione"
  // (?new=1) e ripulisce l'URL. Solo dopo il mount (niente lettura di window
  // durante il primo render, ne' server ne' client, per evitare mismatch di
  // idratazione). Plain History API di proposito: useSearchParams costringerebbe
  // l'intera pagina dentro un <Suspense> solo per questo controllo one-off.
  useEffect(() => {
    const t = setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("new") !== "1") return;
      setShowForm(true);
      window.history.replaceState(null, "", "/bookings");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const visibleBookings = useMemo(
    () => (showCompleted ? bookings : bookings.filter((booking) => booking.cleaning_status !== "FATTO")),
    [bookings, showCompleted],
  );

  const headerSubtitle = `${bookings.length} prenotazion${bookings.length === 1 ? "e" : "i"} · ${formatMonthLongIT(todayLocalIT())}`;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Prenotazioni"
        subtitle={headerSubtitle}
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuova prenotazione
          </button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-secondary">
          Visibili: {visibleBookings.length} su {bookings.length}
        </p>
        <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong/20 px-3 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="h-4 w-4 accent-brand-primary"
          />
          Mostra completate
        </label>
      </div>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <Card>
        {loadingBookings ? (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Soggiorno</TableHeaderCell>
                    <TableHeaderCell>Ospiti</TableHeaderCell>
                    <TableHeaderCell>Canale</TableHeaderCell>
                    <TableHeaderCell>Importo</TableHeaderCell>
                    <TableHeaderCell>Stato</TableHeaderCell>
                    <TableHeaderCell>Note</TableHeaderCell>
                    <TableHeaderCell className="text-right">Azioni</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {[1, 2, 3].map((i) => (
                    <RowSkeleton key={i} cols={7} />
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-border-strong/12 p-4">
                  <div className="h-4 w-40 rounded bg-surface-muted" />
                  <div className="mt-2 h-3 w-28 rounded bg-surface-muted" />
                </div>
              ))}
            </div>
          </>
        ) : visibleBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
              <CalendarOff className="h-8 w-8" aria-hidden="true" />
            </div>
            <p className="text-base font-medium text-text-primary">Nessuna prenotazione visibile</p>
            <p className="max-w-[280px] text-sm text-text-secondary">
              {bookings.length === 0
                ? "Aggiungi la prima prenotazione con il pulsante 'Nuova prenotazione' qui sopra."
                : "Tutte le prenotazioni sono già state pulite (le prenotazioni completate sono nascoste)."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: card text-first */}
            <div className="space-y-3 md:hidden">
              {visibleBookings.map((b) => {
                const isEditing = editId === b.id;
                const linked = bookingActions[b.id] ?? [];
                const menuOpen = expandedMenuId === b.id;
                const cleaningDone = b.cleaning_status === "FATTO";
                const displayAmount = amountDraftById[b.id] !== "" ? amountDraftById[b.id] : b.total_amount;
                const nights = nightsBetween(b.check_in, b.check_out);

                return (
                  <article key={b.id} className="rounded-xl border border-border-strong/12 bg-surface-raised p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cleaningStatusChipClass(cleaningDone)}`}
                      >
                        {cleaningDone ? "Pulito" : "Da pulire"}
                      </span>
                      <span className="text-base font-extrabold text-text-primary">
                        {displayAmount != null && displayAmount !== "" ? formatCurrencyIT(Number(String(displayAmount).replace(",", "."))) : "—"}
                      </span>
                    </div>

                    <p className="mt-1.5 text-sm font-bold text-text-primary">
                      {formatDateIT(b.check_in)} → {formatDateIT(b.check_out)}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {nights} {nights === 1 ? "notte" : "notti"}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${channelChipClass(b.channel)}`}>
                        {b.channel ?? "—"}
                      </span>
                      <span className="text-xs text-text-secondary">{b.guests} ospiti</span>
                      {b.notes && <span className="text-xs text-text-secondary">· {b.notes}</span>}
                    </div>

                    {isEditing && (
                      <div className="mt-3 grid gap-2">
                        <input name={`check_in_m_${b.id}`} className="input-base" type="date" value={b.check_in} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, check_in: e.target.value } : x)))} />
                        <input name={`check_out_m_${b.id}`} className="input-base" type="date" value={b.check_out} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, check_out: e.target.value } : x)))} />
                        <input name={`guests_m_${b.id}`} className="input-base" type="number" value={b.guests} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, guests: Number(e.target.value) } : x)))} />
                        <input name={`channel_m_${b.id}`} className="input-base" value={b.channel ?? ""} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, channel: e.target.value } : x)))} />
                        <input name={`total_amount_m_${b.id}`} className="input-base" type="text" inputMode="decimal" value={amountDraftById[b.id] ?? ""} onChange={(e) => setAmountDraftById((prev) => ({ ...prev, [b.id]: e.target.value }))} />
                        <input name={`notes_m_${b.id}`} className="input-base" value={b.notes ?? ""} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, notes: e.target.value } : x)))} />
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-end gap-2">
                      {isEditing ? (
                        <button type="button" className="btn-primary btn-sm inline-flex items-center gap-1" onClick={() => void updateBooking(b.id)}>
                          <Save className="h-3.5 w-3.5" aria-hidden="true" />
                          Salva
                        </button>
                      ) : (
                        <button type="button" className="btn-primary btn-sm inline-flex items-center gap-1" onClick={() => void toggleActionsForBooking(b.id)}>
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                          Azioni
                        </button>
                      )}
                      {!isEditing && (
                        <button
                          type="button"
                          aria-label={menuOpen ? "Chiudi menu" : "Apri menu prenotazione"}
                          aria-expanded={menuOpen}
                          className="btn-secondary btn-sm inline-flex items-center justify-center px-2.5 font-bold tracking-widest"
                          onClick={() => setExpandedMenuId(menuOpen ? null : b.id)}
                        >
                          ···
                        </button>
                      )}
                    </div>

                    {menuOpen && !isEditing && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary btn-sm inline-flex flex-1 items-center justify-center gap-1"
                          onClick={() => {
                            setAmountDraftById((prev) => ({
                              ...prev,
                              [b.id]: b.total_amount === null || b.total_amount === undefined ? "" : String(b.total_amount),
                            }));
                            setEditId(b.id);
                            setExpandedMenuId(null);
                          }}
                        >
                          <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                          Modifica
                        </button>
                        <button
                          type="button"
                          className="btn-danger btn-sm inline-flex flex-1 items-center justify-center gap-1"
                          onClick={() => {
                            setExpandedMenuId(null);
                            setDeleteTargetId(b.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Elimina
                        </button>
                      </div>
                    )}

                    {expandedBookingId === b.id && (
                      <div className="mt-3 space-y-2 rounded-xl bg-surface-muted p-2">
                        {linked.length === 0 ? (
                          <p className="text-xs text-text-secondary">Nessuna azione collegata</p>
                        ) : (
                          linked.map((a) => (
                            <div key={a.id} className="flex items-center justify-between rounded-lg border border-border-strong/12 bg-surface-raised px-2 py-1.5">
                              <div className="flex items-center gap-2">
                                <ActionTypeBadge actionType={a.action_type} />
                                <span className="text-xs text-text-secondary">{formatDateIT(a.action_date)}</span>
                              </div>
                              <StatusBadge status={a.status} />
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Desktop: tabella text-first, input solo in modifica */}
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Soggiorno</TableHeaderCell>
                    <TableHeaderCell>Ospiti</TableHeaderCell>
                    <TableHeaderCell>Canale</TableHeaderCell>
                    <TableHeaderCell>Importo</TableHeaderCell>
                    <TableHeaderCell>Stato</TableHeaderCell>
                    <TableHeaderCell>Note</TableHeaderCell>
                    <TableHeaderCell className="text-right">Azioni</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {visibleBookings.map((b) => {
                    const isEditing = editId === b.id;
                    const cleaningDone = b.cleaning_status === "FATTO";
                    const nights = nightsBetween(b.check_in, b.check_out);

                    return (
                      <Fragment key={b.id}>
                        <TableRow>
                          <TableCell>
                            {isEditing ? (
                              <div className="flex flex-col gap-1.5">
                                <input
                                  aria-label="Check-in"
                                  name={`check_in_${b.id}`}
                                  className="input-base h-9 text-xs"
                                  type="date"
                                  value={b.check_in}
                                  onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, check_in: e.target.value } : x)))}
                                />
                                <input
                                  aria-label="Check-out"
                                  name={`check_out_${b.id}`}
                                  className="input-base h-9 text-xs"
                                  type="date"
                                  value={b.check_out}
                                  onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, check_out: e.target.value } : x)))}
                                />
                              </div>
                            ) : (
                              <div>
                                <p className="font-semibold text-text-primary">
                                  {formatDateIT(b.check_in)} → {formatDateIT(b.check_out)}
                                </p>
                                <p className="text-xs text-text-secondary">
                                  {nights} {nights === 1 ? "notte" : "notti"}
                                </p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <input
                                aria-label="Ospiti"
                                name={`guests_${b.id}`}
                                className="input-base h-9 w-20 text-xs"
                                type="number"
                                min={1}
                                value={b.guests}
                                onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, guests: Number(e.target.value) } : x)))}
                              />
                            ) : (
                              <span className="text-text-primary">{b.guests}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <input
                                aria-label="Canale"
                                name={`channel_${b.id}`}
                                className="input-base h-9 text-xs"
                                value={b.channel ?? ""}
                                onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, channel: e.target.value } : x)))}
                              />
                            ) : (
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${channelChipClass(b.channel)}`}>
                                {b.channel ?? "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <input
                                aria-label="Importo"
                                name={`total_amount_${b.id}`}
                                className="input-base h-9 w-24 text-xs"
                                type="text"
                                inputMode="decimal"
                                value={amountDraftById[b.id] ?? ""}
                                onChange={(e) => setAmountDraftById((prev) => ({ ...prev, [b.id]: e.target.value }))}
                              />
                            ) : (
                              <span className="font-semibold text-text-primary">
                                {amountDraftById[b.id] ? formatCurrencyIT(Number(amountDraftById[b.id].replace(",", "."))) : "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${cleaningStatusChipClass(cleaningDone)}`}>
                              {cleaningDone ? "Pulito" : "Da pulire"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <input
                                aria-label="Note"
                                name={`notes_${b.id}`}
                                className="input-base h-9 text-xs"
                                value={b.notes ?? ""}
                                onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, notes: e.target.value } : x)))}
                              />
                            ) : (
                              <span className="text-text-secondary">{b.notes || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1" onClick={() => void toggleActionsForBooking(b.id)}>
                                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                                Azioni
                              </button>

                              {isEditing ? (
                                <button type="button" className="btn-primary btn-sm inline-flex items-center gap-1" onClick={() => void updateBooking(b.id)}>
                                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                                  Salva
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm inline-flex items-center gap-1"
                                  onClick={() => {
                                    setAmountDraftById((prev) => ({
                                      ...prev,
                                      [b.id]: b.total_amount === null || b.total_amount === undefined ? "" : String(b.total_amount),
                                    }));
                                    setEditId(b.id);
                                  }}
                                >
                                  <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                                  Modifica
                                </button>
                              )}

                              <button type="button" className="btn-danger btn-sm inline-flex items-center gap-1" onClick={() => setDeleteTargetId(b.id)}>
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Elimina
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {expandedBookingId === b.id && (
                          <TableRow key={`${b.id}-actions`} className="bg-surface-muted">
                            <TableCell className="py-4" colSpan={7}>
                              <div className="space-y-2">
                                {(bookingActions[b.id] ?? []).length === 0 ? (
                                  <p className="text-xs text-text-secondary">Nessuna azione collegata</p>
                                ) : (
                                  (bookingActions[b.id] ?? []).map((a) => (
                                    <div key={a.id} className="flex items-center justify-between rounded-xl border border-border-strong/12 bg-surface-raised px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <ActionTypeBadge actionType={a.action_type} />
                                        <span className="text-xs text-text-secondary">{formatDateIT(a.action_date)}</span>
                                      </div>
                                      <StatusBadge status={a.status} />
                                    </div>
                                  ))
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {/* FAB mobile — apre il drawer nuova prenotazione */}
      <button
        type="button"
        className="btn-primary fixed bottom-[72px] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-2xl p-0 md:hidden"
        onClick={() => setShowForm(true)}
        aria-label="Nuova prenotazione"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="Nuova prenotazione">
        <div className="grid gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="booking-check-in" className="label-base">Check-in</label>
            <input id="booking-check-in" name="check_in" className="input-base" type="date" value={form.check_in} onChange={(e) => setForm((p) => ({ ...p, check_in: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="booking-check-out" className="label-base">Check-out</label>
            <input id="booking-check-out" name="check_out" className="input-base" type="date" value={form.check_out} onChange={(e) => setForm((p) => ({ ...p, check_out: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="booking-guests" className="label-base">Ospiti</label>
            <input id="booking-guests" name="guests" className="input-base" type="number" inputMode="numeric" min={1} value={form.guests} onChange={(e) => setForm((p) => ({ ...p, guests: Number(e.target.value) }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="booking-channel" className="label-base">Canale</label>
            <input id="booking-channel" name="channel" className="input-base" value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))} placeholder="es. airbnb" autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="booking-total-amount" className="label-base">Importo (€)</label>
            <input id="booking-total-amount" name="total_amount" className="input-base" type="text" inputMode="decimal" value={form.total_amount} onChange={(e) => setForm((p) => ({ ...p, total_amount: e.target.value }))} placeholder="0.00" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="booking-notes" className="label-base">Note</label>
            <input id="booking-notes" name="notes" className="input-base" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Note aggiuntive..." />
          </div>
        </div>
        <button type="button" className="btn-primary mt-4 w-full disabled:opacity-50" onClick={() => void createBooking()} disabled={loading}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {loading ? "Creazione..." : "Crea prenotazione"}
        </button>
      </Drawer>

      <ConfirmDialog
        open={deleteTargetId !== null}
        title="Eliminare la prenotazione?"
        description="Verranno eliminate anche le azioni collegate. L'operazione non è reversibile."
        confirmLabel="Elimina"
        danger
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => {
          const id = deleteTargetId;
          setDeleteTargetId(null);
          if (id) void deleteBooking(id);
        }}
      />
    </section>
  );
}
