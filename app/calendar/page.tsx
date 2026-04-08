import CalendarClient from "./calendar-client";
import { Card } from "@/components/card";
import { CalendarDays } from "lucide-react";

export default function CalendarPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Calendario</h1>
        <p className="text-sm text-zinc-500">Prenotazioni e azioni in una vista compatta</p>
      </header>
      <Card className="calendar-shell p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          <CalendarDays className="h-4 w-4 text-blue-600" />
          <span className="calendar-chip">Prenotazioni</span>
          <span className="calendar-chip calendar-chip-cleaning">Pulizie</span>
          <span className="calendar-chip calendar-chip-laundry">Lavatrici</span>
          <span className="calendar-chip calendar-chip-maintenance">Manutenzioni</span>
        </div>
        <CalendarClient />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="calendar-legend-label">Legenda azioni</span>
          <span className="calendar-legend-pill">P = Pulizia</span>
          <span className="calendar-legend-pill">L = Lavatrici</span>
          <span className="calendar-legend-pill">M = Manutenzione</span>
          <span className="calendar-legend-pill">A = Altro</span>
        </div>
      </Card>
    </section>
  );
}
