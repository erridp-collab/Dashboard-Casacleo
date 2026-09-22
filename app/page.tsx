"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const CalendarClient = dynamic(() => import("@/app/calendar/calendar-client"), { ssr: false });
import { Card, CardHeader } from "@/components/card";
import { clientFetchJson } from "@/lib/http/clientFetch";
import { InlineAlert } from "@/components/inline-alert";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { KpiCardSkeleton } from "@/components/skeleton";
import type { Action, Booking } from "@/types/db";
import { addDaysLocalIT, todayLocalIT } from "@/lib/localDate";
import { formatDateLongIT } from "@/lib/format";
import { ACTION_COLORS } from "@/lib/actionMeta";
import { markDataVisible } from "@/lib/perf/navMarks";
import { computeDashboardActionMetrics } from "@/lib/dashboardMetrics";

type BookingsResponse = {
  bookings?: Booking[];
};

type ActionsResponse = {
  actions?: Action[];
};

const CALENDAR_LEGEND: { label: string; color: string }[] = [
  { label: "Prenotazioni", color: ACTION_COLORS.booking },
  { label: "Pulizia", color: ACTION_COLORS.cleaning },
  { label: "Biancheria", color: ACTION_COLORS.linen },
  { label: "Lavatrici", color: ACTION_COLORS.laundry },
  { label: "Manutenzione", color: ACTION_COLORS.maintenance },
  { label: "Spesa", color: ACTION_COLORS.shopping },
];

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  async function loadData(signal?: AbortSignal) {
    setError("");
    setLoading(true);
    try {
      const today = todayLocalIT();
      const [bookingsRes, actionsRes] = await Promise.all([
        clientFetchJson<BookingsResponse>(`/api/bookings?from=${today}&includeCleaningStatus=false`, { signal }),
        clientFetchJson<ActionsResponse>(`/api/actions?to=${today}`, { signal }),
      ]);

      if (!bookingsRes.ok) {
        if (bookingsRes.aborted) return;
        setError(bookingsRes.error || "Non è stato possibile caricare le prenotazioni");
        return;
      }
      if (!actionsRes.ok) {
        if (actionsRes.aborted) return;
        setError(actionsRes.error || "Non è stato possibile caricare le azioni");
        return;
      }

      setBookings(bookingsRes.data.bookings ?? []);
      setActions(actionsRes.data.actions ?? []);
      markDataVisible("dashboard");
    } catch (e: unknown) {
      console.error("Dashboard load failed", e);
      setError("Non è stato possibile caricare i dati");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      void loadData(ctrl.signal);
    }, 0);
    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
    };
  }, []);

  const today = todayLocalIT();
  const { todayActions, openToday, overdueOpen } = useMemo(
    () => computeDashboardActionMetrics(actions, today),
    [actions, today],
  );
  const activeOrUpcomingBookings = useMemo(
    () => bookings.filter((b) => b.check_out >= today).length,
    [bookings, today],
  );

  return (
    <section className="space-y-6">
      <PageHeader title="Riepilogo" subtitle={formatDateLongIT(today)} />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {loading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              title="Azioni oggi"
              value={String(todayActions.length)}
              subtitle={`${openToday} da fare`}
              status={todayActions.length === 0 ? "neutral" : openToday > 0 ? "warn" : "ok"}
              onClick={() => router.push(`/actions?from=${today}&to=${today}`)}
            />
            <KpiCard
              title="Arretrate"
              value={String(overdueOpen.length)}
              subtitle="da fare, da prima di oggi"
              status={overdueOpen.length > 0 ? "critical" : "ok"}
              onClick={() => router.push(`/actions?from=2000-01-01&to=${addDaysLocalIT(today, -1)}`)}
            />
            <KpiCard
              title="Prenotazioni attive/prossime"
              value={String(activeOrUpcomingBookings)}
              status={activeOrUpcomingBookings > 0 ? "ok" : "neutral"}
              onClick={() => router.push("/bookings")}
            />
          </>
        )}
      </div>

      <Card className="p-4">
        <CardHeader title="Calendario" subtitle="Prenotazioni e azioni" />
        <CalendarClient bookings={bookings} />
        <div className="calendar-legend mt-4 hidden sm:flex">
          <span className="calendar-legend-label">Legenda</span>
          {CALENDAR_LEGEND.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px]"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="calendar-legend-text">{item.label}</span>
            </span>
          ))}
        </div>
      </Card>
    </section>
  );
}
