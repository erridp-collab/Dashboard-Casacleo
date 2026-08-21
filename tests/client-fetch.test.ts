import { afterEach, describe, expect, it, vi } from "vitest";
import { clientFetchJson } from "@/lib/http/clientFetch";
import {
  activeNavigationId,
  markDataVisible,
  markNavClick,
  NAVIGATION_ID_HEADER,
} from "@/lib/perf/navMarks";

describe("clientFetchJson navigation telemetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    performance.clearMarks();
    performance.clearMeasures();
  });

  it("propagates the active navigation id without replacing application headers", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    markNavClick("actions");
    const navigationId = activeNavigationId();

    await clientFetchJson("/api/actions", {
      headers: { "x-application-header": "preserved" },
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get(NAVIGATION_ID_HEADER)).toBe(navigationId);
    expect(headers.get("x-application-header")).toBe("preserved");

    markDataVisible("actions");
  });
});
