"use client";

import { useEffect, useState } from "react";
import { ActionTypeBadge, StatusBadge } from "@/components/action-badges";
import type { Action, Booking } from "@/types/db";

type BookingForm = {
  check_in: string;
  check_out: string;
  guests: number;
  channel: string;
  notes: string;
  total_amount: number;
};

const INITIAL_FORM: BookingForm = {
  check_in: "2026-03-10",
  check_out: "2026-03-12",
  guests: 2,
  channel: "airbnb",
  notes: "",
  total_amount: 0,
};

export default function BookingsPage() {
  const [form, setForm] = useState<BookingForm>(INITIAL_FORM);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [bookingActions, setBookingActions] = useState<Record<string, Action[]>>({});
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
    setBookings(data.bookings ?? []);
  }

  async function createBooking() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        check_in: row.check_in,
        check_out: row.check_out,
        guests: row.guests,
        channel: row.channel,
        notes: row.notes,
        total_amount: row.total_amount ?? 0,
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
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Bookings</h1>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Nuova prenotazione</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            type="date"
            value={form.check_in}
            onChange={(e) => setForm((p) => ({ ...p, check_in: e.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            type="date"
            value={form.check_out}
            onChange={(e) => setForm((p) => ({ ...p, check_out: e.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            type="number"
            min={1}
            value={form.guests}
            onChange={(e) => setForm((p) => ({ ...p, guests: Number(e.target.value) }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.channel}
            onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))}
            placeholder="Canale"
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            type="number"
            min={0}
            value={form.total_amount}
            onChange={(e) => setForm((p) => ({ ...p, total_amount: Number(e.target.value) }))}
            placeholder="Importo"
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Note"
          />
        </div>
        <button
          className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          onClick={() => void createBooking()}
          disabled={loading}
        >
          {loading ? "Creazione..." : "Crea prenotazione"}
        </button>
      </div>

      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Lista prenotazioni</h2>
        <div className="space-y-3">
          {bookings.map((b) => {
            const isEditing = editId === b.id;
            return (
              <div key={b.id} className="rounded-xl border border-slate-200 p-3">
                <div className="grid gap-2 md:grid-cols-6">
                  <input
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50"
                    type="date"
                    value={b.check_in}
                    disabled={!isEditing}
                    onChange={(e) =>
                      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, check_in: e.target.value } : x)))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50"
                    type="date"
                    value={b.check_out}
                    disabled={!isEditing}
                    onChange={(e) =>
                      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, check_out: e.target.value } : x)))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50"
                    type="number"
                    value={b.guests}
                    disabled={!isEditing}
                    onChange={(e) =>
                      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, guests: Number(e.target.value) } : x)))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50"
                    value={b.channel ?? ""}
                    disabled={!isEditing}
                    onChange={(e) =>
                      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, channel: e.target.value } : x)))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50"
                    type="number"
                    min={0}
                    value={b.total_amount ?? 0}
                    disabled={!isEditing}
                    onChange={(e) =>
                      setBookings((prev) =>
                        prev.map((x) => (x.id === b.id ? { ...x, total_amount: Number(e.target.value) } : x)),
                      )
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50"
                    value={b.notes ?? ""}
                    disabled={!isEditing}
                    onChange={(e) =>
                      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, notes: e.target.value } : x)))
                    }
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="rounded-md border border-slate-300 px-3 py-1 text-xs"
                    onClick={() => void toggleActionsForBooking(b.id)}
                  >
                    Azioni collegate
                  </button>
                  {isEditing ? (
                    <>
                      <button
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white"
                        onClick={() => void updateBooking(b.id)}
                      >
                        Salva
                      </button>
                      <button className="rounded-md border border-slate-300 px-3 py-1 text-xs" onClick={() => setEditId(null)}>
                        Annulla
                      </button>
                    </>
                  ) : (
                    <button className="rounded-md border border-slate-300 px-3 py-1 text-xs" onClick={() => setEditId(b.id)}>
                      Modifica
                    </button>
                  )}
                  <button className="rounded-md border border-rose-300 px-3 py-1 text-xs text-rose-700" onClick={() => void deleteBooking(b.id)}>
                    Elimina
                  </button>
                </div>

                {expandedBookingId === b.id && (
                  <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                    {(bookingActions[b.id] ?? []).length === 0 && (
                      <p className="text-xs text-slate-500">Nessuna azione collegata</p>
                    )}
                    {(bookingActions[b.id] ?? []).map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                        <div className="space-x-2">
                          <ActionTypeBadge actionType={a.action_type} />
                          <span className="text-xs text-slate-500">{a.action_date}</span>
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {bookings.length === 0 && <p className="text-sm text-slate-500">Nessuna prenotazione.</p>}
        </div>
      </div>
    </section>
  );
}
