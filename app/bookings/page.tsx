"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ActionTypeBadge, StatusBadge } from "@/components/action-badges";
import { Card, CardHeader } from "@/components/card";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { RowSkeleton } from "@/components/skeleton";
import { toast } from "@/components/toast";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";
import { CalendarDays, ChevronDown, PenLine, Plus, Save, Trash2 } from "lucide-react";
import type { Action, Booking } from "@/types/db";
import { addDaysLocalIT, todayLocalIT } from "@/lib/localDate";

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

export default function BookingsPage() {
  const [form, setForm] = useState<BookingForm>(() => buildInitialForm());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [bookingActions, setBookingActions] = useState<Record<string, Action[]>>({});
  const [amountDraftById, setAmountDraftById] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
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
      const msg = result.error ?? "Errore update";
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
    if (!confirm("Eliminare prenotazione e azioni collegate?")) return;
    const result = await clientFetchJson<{ ok?: boolean }>(`/api/bookings/${id}`, { method: "DELETE" });
    if (!result.ok) {
      const msg = result.error ?? "Errore delete";
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

  const visibleBookings = useMemo(
    () => (showCompleted ? bookings : bookings.filter((booking) => booking.cleaning_status !== "FATTO")),
    [bookings, showCompleted],
  );

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Bookings</h1>
        <p className="text-sm text-zinc-500">Gestione prenotazioni e azioni collegate</p>
      </header>

      <Card>
        {/* Header con toggle su mobile, statico su desktop */}
        <button
          className="flex w-full items-center justify-between md:cursor-default"
          onClick={() => setShowForm((v) => !v)}
        >
          <div className="text-left">
            <p className="text-base font-semibold text-zinc-900">Nuova prenotazione</p>
            <p className="mt-0.5 text-sm text-zinc-500">Inserisci i dati principali</p>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-zinc-400 transition-transform md:hidden ${showForm ? "rotate-180" : ""}`}
          />
        </button>

        <div className={`${showForm ? "block" : "hidden"} md:block`}>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="booking-check-in" className="text-xs font-medium text-zinc-600">Check-in</label>
              <input id="booking-check-in" name="check_in" className="h-11 rounded-xl border border-zinc-300 px-3 text-sm focus:border-blue-600 focus:outline-none" type="date" value={form.check_in} onChange={(e) => setForm((p) => ({ ...p, check_in: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="booking-check-out" className="text-xs font-medium text-zinc-600">Check-out</label>
              <input id="booking-check-out" name="check_out" className="h-11 rounded-xl border border-zinc-300 px-3 text-sm focus:border-blue-600 focus:outline-none" type="date" value={form.check_out} onChange={(e) => setForm((p) => ({ ...p, check_out: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="booking-guests" className="text-xs font-medium text-zinc-600">Ospiti</label>
              <input id="booking-guests" name="guests" className="h-11 rounded-xl border border-zinc-300 px-3 text-sm focus:border-blue-600 focus:outline-none" type="number" inputMode="numeric" min={1} value={form.guests} onChange={(e) => setForm((p) => ({ ...p, guests: Number(e.target.value) }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="booking-channel" className="text-xs font-medium text-zinc-600">Canale</label>
              <input id="booking-channel" name="channel" className="h-11 rounded-xl border border-zinc-300 px-3 text-sm focus:border-blue-600 focus:outline-none" value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))} placeholder="es. airbnb" autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="booking-total-amount" className="text-xs font-medium text-zinc-600">Importo (€)</label>
              <input id="booking-total-amount" name="total_amount" className="h-11 rounded-xl border border-zinc-300 px-3 text-sm focus:border-blue-600 focus:outline-none" type="text" inputMode="decimal" value={form.total_amount} onChange={(e) => setForm((p) => ({ ...p, total_amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2 md:col-span-3">
              <label htmlFor="booking-notes" className="text-xs font-medium text-zinc-600">Note</label>
              <input id="booking-notes" name="notes" className="h-11 rounded-xl border border-zinc-300 px-3 text-sm focus:border-blue-600 focus:outline-none" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Note aggiuntive..." />
            </div>
          </div>
          <button className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-medium text-white transition hover:bg-blue-700 active:scale-95 disabled:opacity-50" onClick={() => void createBooking()} disabled={loading}>
            <Plus className="h-4 w-4" />
            {loading ? "Creazione..." : "Crea prenotazione"}
          </button>
        </div>
      </Card>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <Card>
        <CardHeader
          title="Lista prenotazioni"
          subtitle={showCompleted ? "Tutte le prenotazioni" : "Solo prenotazioni ancora da pulire"}
        />

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">Visibili: {visibleBookings.length} su {bookings.length}</p>
          <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-600">
            <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />
            Mostra completate
          </label>
        </div>

        {loadingBookings ? (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHead><tr><TableHeaderCell>Check-in</TableHeaderCell><TableHeaderCell>Check-out</TableHeaderCell><TableHeaderCell>Ospiti</TableHeaderCell><TableHeaderCell>Canale</TableHeaderCell><TableHeaderCell>Importo</TableHeaderCell><TableHeaderCell>Note</TableHeaderCell><TableHeaderCell>Azioni</TableHeaderCell></tr></TableHead>
                <TableBody>{[1,2,3].map((i) => <RowSkeleton key={i} cols={7} />)}</TableBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {[1,2,3].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-zinc-100 p-4">
                  <div className="h-4 w-40 rounded bg-zinc-200" />
                  <div className="mt-2 h-3 w-28 rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          </>
        ) : visibleBookings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-3xl">🏠</span>
            <p className="text-sm font-medium text-zinc-700">Nessuna prenotazione visibile</p>
            <p className="text-xs text-zinc-400">
              {bookings.length === 0
                ? "Aggiungi la prima prenotazione qui sopra"
                : "Le prenotazioni con pulizia FATTO sono nascoste"}
            </p>
          </div>
        ) : (
          <>
          <div className="space-y-3 md:hidden">
            {visibleBookings.map((b) => {
              const isEditing = editId === b.id;
              const linked = bookingActions[b.id] ?? [];

              return (
                <article key={b.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900">{b.check_in} {"->"} {b.check_out}</h3>
                      <p className="text-xs text-zinc-500">Ospiti: {b.guests} | Canale: {b.channel ?? "-"}</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                      EUR {amountDraftById[b.id] || b.total_amount || "-"}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="mt-3 grid gap-2">
                      <input name={`check_in_m_${b.id}`} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm" type="date" value={b.check_in} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, check_in: e.target.value } : x)))} />
                      <input name={`check_out_m_${b.id}`} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm" type="date" value={b.check_out} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, check_out: e.target.value } : x)))} />
                      <input name={`guests_m_${b.id}`} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm" type="number" value={b.guests} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, guests: Number(e.target.value) } : x)))} />
                      <input name={`channel_m_${b.id}`} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm" value={b.channel ?? ""} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, channel: e.target.value } : x)))} />
                      <input name={`total_amount_m_${b.id}`} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm" type="text" inputMode="decimal" value={amountDraftById[b.id] ?? ""} onChange={(e) => setAmountDraftById((prev) => ({ ...prev, [b.id]: e.target.value }))} />
                      <input name={`notes_m_${b.id}`} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm" value={b.notes ?? ""} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, notes: e.target.value } : x)))} />
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-zinc-500">
                      <p>Note: {b.notes ? b.notes : "-"}</p>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-zinc-300 px-2 text-xs hover:bg-zinc-100" onClick={() => void toggleActionsForBooking(b.id)}>
                      <CalendarDays className="h-3.5 w-3.5" />
                      Azioni
                    </button>
                    {isEditing ? (
                      <button className="inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700" onClick={() => void updateBooking(b.id)}>
                        <Save className="h-3.5 w-3.5" />
                        Salva
                      </button>
                    ) : (
                      <button className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-zinc-300 px-2 text-xs hover:bg-zinc-100" onClick={() => {
                        setAmountDraftById((prev) => ({
                          ...prev,
                          [b.id]: b.total_amount === null || b.total_amount === undefined ? "" : String(b.total_amount),
                        }));
                        setEditId(b.id);
                      }}>
                        <PenLine className="h-3.5 w-3.5" />
                        Modifica
                      </button>
                    )}
                  </div>
                  <button className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1 rounded-lg border border-rose-200 px-2 text-xs text-rose-700 hover:bg-rose-50" onClick={() => void deleteBooking(b.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Elimina
                  </button>

                  {expandedBookingId === b.id && (
                    <div className="mt-3 space-y-2 rounded-xl bg-zinc-50 p-2">
                      {linked.length === 0 ? (
                        <p className="text-xs text-zinc-500">Nessuna azione collegata</p>
                      ) : (
                        linked.map((a) => (
                          <div key={a.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              <ActionTypeBadge actionType={a.action_type} />
                              <span className="text-xs text-zinc-500">{a.action_date}</span>
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
          <div className="hidden md:block">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Check-in</TableHeaderCell>
                <TableHeaderCell>Check-out</TableHeaderCell>
                <TableHeaderCell>Ospiti</TableHeaderCell>
                <TableHeaderCell>Canale</TableHeaderCell>
                <TableHeaderCell>Importo</TableHeaderCell>
                <TableHeaderCell>Note</TableHeaderCell>
                <TableHeaderCell className="text-right">Azioni</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {visibleBookings.map((b) => {
                const isEditing = editId === b.id;

                return (
                  <Fragment key={b.id}>
                    <TableRow>
                      <TableCell>
                        <input name={`check_in_${b.id}`} id={`check_in_${b.id}`} className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:border-transparent disabled:bg-zinc-50" type="date" value={b.check_in} disabled={!isEditing} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, check_in: e.target.value } : x)))} />
                      </TableCell>
                      <TableCell>
                        <input name={`check_out_${b.id}`} id={`check_out_${b.id}`} className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:border-transparent disabled:bg-zinc-50" type="date" value={b.check_out} disabled={!isEditing} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, check_out: e.target.value } : x)))} />
                      </TableCell>
                      <TableCell>
                        <input name={`guests_${b.id}`} id={`guests_${b.id}`} className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:border-transparent disabled:bg-zinc-50" type="number" value={b.guests} disabled={!isEditing} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, guests: Number(e.target.value) } : x)))} />
                      </TableCell>
                      <TableCell>
                        <input name={`channel_${b.id}`} id={`channel_${b.id}`} className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:border-transparent disabled:bg-zinc-50" value={b.channel ?? ""} disabled={!isEditing} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, channel: e.target.value } : x)))} />
                      </TableCell>
                      <TableCell>
                        <input
                          className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:border-transparent disabled:bg-zinc-50"
                          name={`total_amount_${b.id}`}
                          id={`total_amount_${b.id}`}
                          type="text"
                          inputMode="decimal"
                          value={amountDraftById[b.id] ?? ""}
                          disabled={!isEditing}
                          onChange={(e) => setAmountDraftById((prev) => ({ ...prev, [b.id]: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell>
                        <input name={`notes_${b.id}`} id={`notes_${b.id}`} className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs disabled:border-transparent disabled:bg-zinc-50" value={b.notes ?? ""} disabled={!isEditing} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, notes: e.target.value } : x)))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <button className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => void toggleActionsForBooking(b.id)}>
                            <CalendarDays className="h-3.5 w-3.5" />
                            Azioni
                          </button>

                          {isEditing ? (
                            <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700" onClick={() => void updateBooking(b.id)}>
                              <Save className="h-3.5 w-3.5" />
                              Salva
                            </button>
                          ) : (
                            <button className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => {
                              setAmountDraftById((prev) => ({
                                ...prev,
                                [b.id]: b.total_amount === null || b.total_amount === undefined ? "" : String(b.total_amount),
                              }));
                              setEditId(b.id);
                            }}>
                              <PenLine className="h-3.5 w-3.5" />
                              Modifica
                            </button>
                          )}

                          <button className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50" onClick={() => void deleteBooking(b.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Elimina
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {expandedBookingId === b.id && (
                      <TableRow key={`${b.id}-actions`} className="bg-zinc-50">
                        <TableCell className="py-4" colSpan={7}>
                          <div className="space-y-2">
                            {(bookingActions[b.id] ?? []).length === 0 ? (
                              <p className="text-xs text-zinc-500">Nessuna azione collegata</p>
                            ) : (
                              (bookingActions[b.id] ?? []).map((a) => (
                                <div key={a.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <ActionTypeBadge actionType={a.action_type} />
                                    <span className="text-xs text-zinc-500">{a.action_date}</span>
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
    </section>
  );
}
