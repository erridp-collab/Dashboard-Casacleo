"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import itLocale from "@fullcalendar/core/locales/it";
import { clientFetchJson } from "@/lib/http/clientFetch";
import type { Action, Booking } from "@/types/db";
import { ACTION_ABBR, getActionCategory, getActionTypeLabel } from "@/lib/actionMeta";
import { formatLocalDateIT, todayLocalIT } from "@/lib/localDate";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  category: "booking" | "cleaning" | "laundry" | "linen" | "maintenance" | "shopping";
};

type ActionsResponse = {
  actions?: Action[];
};

export default function CalendarClient({ bookings }: { bookings: Booking[] }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [range, setRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
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
      const actionsRes = await clientFetchJson<ActionsResponse>(`/api/actions?from=${nextFrom}&to=${nextTo}`, { signal: ctrl.signal });

      if (seq !== requestSeqRef.current) return;

      if (!actionsRes.ok) {
        if (actionsRes.aborted) return;
        setError(actionsRes.error || "Non è stato possibile caricare le azioni");
        return;
      }

      setActions(actionsRes.data.actions ?? []);
      setRange({ from: nextFrom, to: nextTo });
    } catch (e: unknown) {
      console.error("Calendar load failed", e);
      setError("Non è stato possibile caricare il calendario");
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

  const visibleBookings = useMemo(
    () => bookings.filter((b) => b.check_in <= range.to && b.check_out >= range.from),
    [bookings, range],
  );

  const events = useMemo<CalendarEvent[]>(() => {
    const bookingEvents: CalendarEvent[] = visibleBookings.map((b) => ({
      id: `booking-${b.id}`,
      title: `Prenotazione · ${b.guests} ospiti`,
      start: b.check_in,
      end: b.check_out,
      category: "booking",
    }));

    const actionEvents: CalendarEvent[] = actions.map((a) => {
      const category = getActionCategory(a.action_type);
      return {
        id: `action-${a.id}`,
        title: getActionTypeLabel(a.action_type),
        start: a.action_date,
        category,
      };
    });

    return [...bookingEvents, ...actionEvents];
  }, [actions, visibleBookings]);

  return (
    <div className="calendar-modern space-y-4">
      {error ? (
        <p className="rounded-xl border border-semantic-error/30 bg-semantic-error/8 p-3 text-sm text-text-primary">
          {error}
        </p>
      ) : null}
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={todayLocalIT()}
        locale={itLocale}
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
        eventClassNames={(info) => ["calendar-event", `calendar-event--${info.event.extendedProps.category}`]}
        eventContent={(info) => {
          const category = info.event.extendedProps.category as CalendarEvent["category"];
          return (
            <div className="calendar-event-content">
              <span className="calendar-event-full">{info.event.title}</span>
              <span className="calendar-event-abbr" aria-hidden="true">
                {ACTION_ABBR[category]}
              </span>
            </div>
          );
        }}
        eventDidMount={(info) => {
          info.el.title = info.event.title;
          info.el.setAttribute("aria-label", info.event.title);
        }}
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
