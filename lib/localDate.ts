const IT_TIMEZONE = "Europe/Rome";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildUtcDateFromYmd(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function formatLocalDateIT(date: Date): string {
  // Produce a stable YYYY-MM-DD for the calendar day in Europe/Rome,
  // avoiding UTC-based off-by-one issues around midnight/DST.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";

  if (!year || !month || !day) {
    // Extremely defensive fallback: local date components.
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  return `${year}-${month}-${day}`;
}

export function todayLocalIT(): string {
  return formatLocalDateIT(new Date());
}

export function parseLocalDateIT(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = buildUtcDateFromYmd(y, m, d);
  if (!Number.isFinite(date.getTime())) return null;
  if (formatUtcDate(date) !== ymd) return null;
  return date;
}

export function addDaysLocalIT(ymd: string, days: number): string {
  const base = parseLocalDateIT(ymd) ?? buildUtcDateFromYmd(1970, 1, 1);
  base.setUTCDate(base.getUTCDate() + days);
  return formatUtcDate(base);
}
