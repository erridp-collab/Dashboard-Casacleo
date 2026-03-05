"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { Action, Booking } from "@/types/db";
import { ACTION_COLORS, getActionCategory } from "@/lib/actionMeta";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  color: string;
};

export default function CalendarClient() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState("");
  const rangeRef = useRef<{ from: string; to: string }>({ from: "", to: "" });

  async function loadData(nextFrom: string, nextTo: string) {
    setError("");
    const [bookingsRes, actionsRes] = await Promise.all([
      fetch("/api/bookings"),
      fetch(`/api/actions?from=${nextFrom}&to=${nextTo}`),
    ]);

    const bookingsData = await bookingsRes.json();
    const actionsData = await actionsRes.json();

    if (!bookingsRes.ok) {
      setError(bookingsData.error ?? "Errore bookings");
      return;
    }
    if (!actionsRes.ok) {
      setError(actionsData.error ?? "Errore actions");
      return;
    }

    const filteredBookings = (bookingsData.bookings ?? []).filter(
      (b: Booking) => b.check_in <= nextTo && b.check_out >= nextFrom,
    );
    setBookings(filteredBookings);
    setActions(actionsData.actions ?? []);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      rangeRef.current = { from: first, to: last };
      void loadData(first, last);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const events = useMemo<CalendarEvent[]>(() => {
    const bookingEvents: CalendarEvent[] = bookings.map((b) => ({
      id: `booking-${b.id}`,
      title: `Booking (${b.guests} ospiti)`,
      start: b.check_in,
      end: b.check_out,
      color: ACTION_COLORS.booking,
    }));

    const actionEvents: CalendarEvent[] = actions.map((a) => {
      const category = getActionCategory(a.action_type);
      const color =
        category === "cleaning"
          ? ACTION_COLORS.cleaning
          : category === "laundry"
            ? ACTION_COLORS.laundry
            : category === "maintenance"
              ? ACTION_COLORS.maintenance
              : ACTION_COLORS.generic;

      return {
        id: `action-${a.id}`,
        title: `${a.action_type} (${a.status})`,
        start: a.action_date,
        color,
      };
    });

    return [...bookingEvents, ...actionEvents];
  }, [actions, bookings]);

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          datesSet={(info) => {
            const nextFrom = info.startStr.slice(0, 10);
            const nextTo = new Date(info.end.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            if (nextFrom !== rangeRef.current.from || nextTo !== rangeRef.current.to) {
              rangeRef.current = { from: nextFrom, to: nextTo };
              void loadData(nextFrom, nextTo);
            }
          }}
          height="auto"
        />
      </div>
    </div>
  );
}
