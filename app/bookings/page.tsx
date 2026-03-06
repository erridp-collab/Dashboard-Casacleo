"use client";

import { Fragment, useEffect, useState } from "react";
import { ActionTypeBadge, StatusBadge } from "@/components/action-badges";
import { Card, CardHeader } from "@/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/table";
import { CalendarDays, PenLine, Plus, Save, Trash2 } from "lucide-react";
import type { Action, Booking } from "@/types/db";

type BookingForm = {
  check_in: string;
  check_out: string;
  guests: number;
  channel: string;
  notes: string;
  total_amount: string;
};

const INITIAL_FORM: BookingForm = {
  check_in: "2026-03-10",
  check_out: "2026-03-12",
  guests: 2,
  channel: "airbnb",
  notes: "",
  total_amount: "",
};

function parseAmountInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export default function BookingsPage() {
  const [form, setForm] = useState<BookingForm>(INITIAL_FORM);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [bookingActions, setBookingActions] = useState<Record<string, Action[]>>({});
  const [amountDraftById, setAmountDraftById] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadBookings() {
    const res = await fetch("/api/bookings");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Errore caricamento prenotazioni");
      return;
    }
    const rows = data.bookings ?? [];
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
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        total_amount: parsedAmount,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Errore creazione");
    setForm(INITIAL_FORM);
    await loadBookings();
  }

  async function updateBooking(id: string) {
    const row = bookings.find((b) => b.id === id);
    if (!row) return;
    const parsedAmount = parseAmountInput(amountDraftById[id] ?? "");
    if (Number.isNaN(parsedAmount)) {
      setError("Importo non valido");
      return;
    }
    const res = await fetch(`/api/bookings/${id}`, {
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
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore update");
    setEditId(null);
    await loadBookings();
  }

  async function deleteBooking(id: string) {
    if (!confirm("Eliminare prenotazione e azioni collegate?")) return;
    const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore delete");
    setExpandedBookingId(null);
    await loadBookings();
  }

  async function toggleActionsForBooking(id: string) {
    const next = expandedBookingId === id ? null : id;
    setExpandedBookingId(next);
    if (!next || bookingActions[id]) return;

    const res = await fetch(`/api/actions?bookingId=${id}`);
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Errore azioni collegate");
    setBookingActions((prev) => ({ ...prev, [id]: data.actions ?? [] }));
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadBookings();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Bookings</h1>
        <p className="text-sm text-zinc-500">Gestione prenotazioni e azioni collegate</p>
      </header>

      <Card>
        <CardHeader title="Nuova prenotazione" subtitle="Inserisci i dati principali" />
        <div className="grid gap-3 md:grid-cols-3">
          <input id="booking-check-in" name="check_in" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" type="date" value={form.check_in} onChange={(e) => setForm((p) => ({ ...p, check_in: e.target.value }))} />
          <input id="booking-check-out" name="check_out" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" type="date" value={form.check_out} onChange={(e) => setForm((p) => ({ ...p, check_out: e.target.value }))} />
          <input id="booking-guests" name="guests" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" type="number" min={1} value={form.guests} onChange={(e) => setForm((p) => ({ ...p, guests: Number(e.target.value) }))} />
          <input id="booking-channel" name="channel" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))} placeholder="Canale" />
          <input id="booking-total-amount" name="total_amount" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" type="text" inputMode="decimal" value={form.total_amount} onChange={(e) => setForm((p) => ({ ...p, total_amount: e.target.value }))} placeholder="Importo" />
          <input id="booking-notes" name="notes" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none md:col-span-3" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Note" />
        </div>
        <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => void createBooking()} disabled={loading}>
          <Plus className="h-4 w-4" />
          {loading ? "Creazione..." : "Crea prenotazione"}
        </button>
      </Card>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <Card>
        <CardHeader title="Lista prenotazioni" subtitle="Modifica rapida inline" />

        {bookings.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Nessuna prenotazione disponibile.</p>
        ) : (
          <>
          <div className="space-y-3 md:hidden">
            {bookings.map((b) => {
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

                  <div className="mt-3 grid gap-2">
                    <input name={`check_in_m_${b.id}`} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm disabled:border-transparent disabled:bg-zinc-50" type="date" value={b.check_in} disabled={!isEditing} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, check_in: e.target.value } : x)))} />
                    <input name={`check_out_m_${b.id}`} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm disabled:border-transparent disabled:bg-zinc-50" type="date" value={b.check_out} disabled={!isEditing} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, check_out: e.target.value } : x)))} />
                    <input name={`guests_m_${b.id}`} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm disabled:border-transparent disabled:bg-zinc-50" type="number" value={b.guests} disabled={!isEditing} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, guests: Number(e.target.value) } : x)))} />
                    <input name={`channel_m_${b.id}`} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm disabled:border-transparent disabled:bg-zinc-50" value={b.channel ?? ""} disabled={!isEditing} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, channel: e.target.value } : x)))} />
                    <input name={`total_amount_m_${b.id}`} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm disabled:border-transparent disabled:bg-zinc-50" type="text" inputMode="decimal" value={amountDraftById[b.id] ?? ""} disabled={!isEditing} onChange={(e) => setAmountDraftById((prev) => ({ ...prev, [b.id]: e.target.value }))} />
                    <input name={`notes_m_${b.id}`} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm disabled:border-transparent disabled:bg-zinc-50" value={b.notes ?? ""} disabled={!isEditing} onChange={(e) => setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, notes: e.target.value } : x)))} />
                  </div>

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
              {bookings.map((b) => {
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

