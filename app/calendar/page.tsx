import CalendarClient from "./calendar-client";
import { Card } from "@/components/card";
import { CalendarDays } from "lucide-react";

export default function CalendarPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Calendar</h1>
        <p className="text-sm text-zinc-500">Prenotazioni e azioni in una vista unica</p>
      </header>
      <Card className="p-4">
        <p className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-500">
          <CalendarDays className="h-4 w-4 text-blue-600" />
          Blu: prenotazioni, verde/arancione/viola: tipi di azione
        </p>
        <CalendarClient />
      </Card>
    </section>
  );
}
