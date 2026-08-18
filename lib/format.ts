import { formatLocalDateIT, parseLocalDateIT } from "@/lib/localDate";

export function isoDate(d: Date): string {
  return formatLocalDateIT(d);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, (m ?? 1) - 1, 1).toLocaleDateString("it-IT", {
    month: "short",
    year: "numeric",
  });
}

// --- Formattazione date italiana condivisa (IMPLEMENTATION_PLAN_UI_UX.md, sezione 4) ---
//
// Le date "solo giorno" (yyyy-MM-dd, senza orario) vengono ancorate a
// mezzanotte UTC tramite parseLocalDateIT e formattate specificando
// timeZone: "UTC": questo evita che Intl le rilegga nel fuso orario locale
// del browser e le faccia slittare al giorno prima/dopo.

function toDisplayDate(input: string | Date): Date | null {
  if (input instanceof Date) {
    // Ancora l'oggetto Date al giorno civile Europe/Rome, poi lo riparsa
    // come mezzanotte UTC, cosi la formattazione con timeZone: "UTC" e
    // coerente con l'input testuale yyyy-MM-dd.
    return parseLocalDateIT(formatLocalDateIT(input));
  }
  return parseLocalDateIT(input);
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Formato UI standard: 14/08/2026 */
export function formatDateIT(input: string | Date): string {
  const date = toDisplayDate(input);
  if (!date) return "";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    date,
  );
}

/** Intervallo: 14/08/2026 – 18/08/2026 */
export function formatDateRangeIT(start: string | Date, end: string | Date): string {
  return `${formatDateIT(start)} – ${formatDateIT(end)}`;
}

/** Titolo esteso per contesti (es. header pagina): Giovedì 14 agosto 2026 */
export function formatDateLongIT(input: string | Date): string {
  const date = toDisplayDate(input);
  if (!date) return "";
  const formatted = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return capitalizeFirst(formatted);
}

/** Titolo mese esteso: Agosto 2026 */
export function formatMonthLongIT(input: string | Date): string {
  const date = toDisplayDate(input);
  if (!date) return "";
  const formatted = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  return capitalizeFirst(formatted);
}

/** Titolo giorno esteso senza giorno della settimana, per header di sezione: 14 agosto 2026 */
export function formatDateHeaderIT(input: string | Date): string {
  const date = toDisplayDate(input);
  if (!date) return "";
  const formatted = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    date,
  );
  return capitalizeFirst(formatted);
}

export function toNumber(input: unknown, fallback = 0): number {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

/** Formato valuta italiano standard: 25,00 € (con spazio non-interrompibile prima del simbolo). */
export function formatCurrencyIT(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

