"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { clientFetchJson } from "@/lib/http/clientFetch";
import type { Action, Booking } from "@/types/db";
import { ACTION_COLORS, getActionCategory } from "@/lib/actionMeta";
import { formatLocalDateIT, todayLocalIT } from "@/lib/localDate";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  color: string;
};

type BookingsResponse = {
  bookings?: Booking[];
};

type ActionsResponse = {
  actions?: Action[];
};

function getActionInitial(actionType: string): string {
  const upper = String(actionType ?? "").toUpperCase();
  if (upper.includes("BIANCHERIA")) return "B";
  if (upper.includes("PULIZIA") || upper.includes("LETTO")) return "P";
  if (upper.includes("LAVATRICI") || upper.includes("LAVAND")) return "L";
  if (upper.includes("MANUT")) return "M";
  return "S";
}

export default function CalendarClient() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState("");
  const rangeRef = useRef<{ from: string; to: string }>({ from: "", to: "" });
  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  async function loadData(nextFrom: string, nextTo: string) {
    setError("");
    const seq = ++requestSeqRef.current;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const [bookingsRes, actionsRes] = await Promise.all([
        clientFetchJson<BookingsResponse>("/api/bookings", { signal: ctrl.signal }),
        clientFetchJson<ActionsResponse>(`/api/actions?from=${nextFrom}&to=${nextTo}`, { signal: ctrl.signal }),
      ]);

      if (seq !== requestSeqRef.current) return;

      if (!bookingsRes.ok) {
        if (bookingsRes.aborted) return;
        setError(bookingsRes.error || "Errore bookings");
        return;
      }
      if (!actionsRes.ok) {
        if (actionsRes.aborted) return;
        setError(actionsRes.error || "Errore actions");
        return;
      }

      const filteredBookings = (bookingsRes.data.bookings ?? []).filter(
        (b: Booking) => b.check_in <= nextTo && b.check_out >= nextFrom,
      );
      setBookings(filteredBookings);
      setActions(actionsRes.data.actions ?? []);
    } catch (e: unknown) {
      console.error("Calendar load failed", e);
      setError("Errore caricamento");
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      const now = new Date();
      const first = formatLocalDateIT(new Date(now.getFullYear(), now.getMonth(), 1));
      const last = formatLocalDateIT(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      rangeRef.current = { from: first, to: last };
      void loadData(first, last);
    }, 0);
    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
    };
  }, []);

  const events = useMemo<CalendarEvent[]>(() => {
    const bookingEvents: CalendarEvent[] = bookings.map((b) => ({
      id: `booking-${b.id}`,
      title: `Prenotazione · ${b.guests} ospiti`,
      start: b.check_in,
      end: b.check_out,
      color: ACTION_COLORS.booking,
    }));

    const actionEvents: CalendarEvent[] = actions.map((a) => {
      const category = getActionCategory(a.action_type);
      const actionLabel = getActionInitial(a.action_type);
      const color =
        category === "cleaning"
          ? ACTION_COLORS.cleaning
          : category === "laundry"
            ? ACTION_COLORS.laundry
            : category === "linen"
              ? ACTION_COLORS.linen
              : category === "maintenance"
                ? ACTION_COLORS.maintenance
                : ACTION_COLORS.shopping;

      return {
        id: `action-${a.id}`,
        title: actionLabel,
        start: a.action_date,
        color,
      };
    });

    return [...bookingEvents, ...actionEvents];
  }, [actions, bookings]);

  return (
    <div className="calendar-modern space-y-4">
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={todayLocalIT()}
        events={events}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,dayGridWeek",
        }}
        buttonText={{ today: "Oggi", month: "Mese", week: "Settimana" }}
        dayMaxEventRows={3}
        fixedWeekCount={false}
        showNonCurrentDates={false}
        eventDisplay="block"
        displayEventTime={false}
        firstDay={1}
        height={520}
        eventClassNames={() => ["calendar-event"]}
        datesSet={(info) => {
          const nextFrom = info.startStr.slice(0, 10);
          const nextTo = formatLocalDateIT(new Date(info.end.getTime() - 24 * 60 * 60 * 1000));
          if (nextFrom !== rangeRef.current.from || nextTo !== rangeRef.current.to) {
            rangeRef.current = { from: nextFrom, to: nextTo };
            void loadData(nextFrom, nextTo);
          }
        }}
      />
    </div>
  );
}
