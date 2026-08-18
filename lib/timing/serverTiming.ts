export type TimingEntry = {
  name: string;
  dur: number;
  desc?: string;
};

/**
 * Times an async operation and pushes the result into `entries`, regardless
 * of whether the operation resolves or throws. Accepts PromiseLike (not just
 * Promise) so Supabase query builders — which are thenable but not Promise
 * instances — can be passed directly: `timed(phases, "db", () => query)`.
 */
export async function timed<T>(
  entries: TimingEntry[],
  name: string,
  fn: () => PromiseLike<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    entries.push({ name, dur: performance.now() - start });
  }
}

export function serverTimingHeader(entries: TimingEntry[]): string {
  return entries
    .map((entry) => {
      const desc = entry.desc ? `;desc="${entry.desc.replace(/"/g, "'")}"` : "";
      return `${entry.name};dur=${entry.dur.toFixed(1)}${desc}`;
    })
    .join(", ");
}

export function totalDuration(entries: TimingEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.dur, 0);
}
