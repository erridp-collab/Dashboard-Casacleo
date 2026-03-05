import CalendarClient from "./calendar-client";

export default function CalendarPage() {
  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Calendar</h1>
        <p className="text-sm text-slate-500">Blu prenotazioni, verde pulizie, arancione lavatrici, viola manutenzioni.</p>
      </header>
      <CalendarClient />
    </section>
  );
}

