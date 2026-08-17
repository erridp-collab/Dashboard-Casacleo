import { serverTimingHeader, totalDuration, type TimingEntry } from "@/lib/timing/serverTiming";

export type RequestTimingLayer = "middleware" | "route";

/**
 * Reuses the x-request-id set by the middleware when present (so a page
 * navigation's middleware phase and its API-route phase can be correlated),
 * otherwise mints a fresh one — e.g. for requests that bypass the middleware
 * in tests, or direct API calls.
 */
export function requestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

/**
 * Single-line structured log, grep-able by reqId to count how many times a
 * phase (e.g. "auth") actually ran for one navigation. No PII: only phase
 * names and durations, never user/org/session identifiers.
 */
export function logRequestTiming(
  reqId: string,
  layer: RequestTimingLayer,
  path: string,
  phases: TimingEntry[],
): void {
  const payload = {
    reqId,
    layer,
    path,
    phases: phases.map((entry) => ({ name: entry.name, dur: Number(entry.dur.toFixed(1)) })),
    totalMs: Number(totalDuration(phases).toFixed(1)),
  };
  console.log(`[perf] ${JSON.stringify(payload)}`);
}

export function attachRouteTiming(
  response: Response,
  reqId: string,
  path: string,
  phases: TimingEntry[],
): Response {
  logRequestTiming(reqId, "route", path, phases);
  response.headers.set("Server-Timing", serverTimingHeader(phases));
  response.headers.set("x-request-id", reqId);
  return response;
}
