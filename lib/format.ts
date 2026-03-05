export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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

export function toNumber(input: unknown, fallback = 0): number {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

