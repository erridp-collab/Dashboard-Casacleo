import { describe, expect, it, vi } from "vitest";
import {
  attachRouteTiming,
  logRequestTiming,
  navigationId,
  requestId,
} from "@/lib/timing/requestTiming";

describe("requestId", () => {
  it("reuses the x-request-id header when present", () => {
    const req = new Request("http://localhost/api/actions", {
      headers: { "x-request-id": "existing-id" },
    });
    expect(requestId(req)).toBe("existing-id");
  });

  it("generates a new id when the header is missing", () => {
    const req = new Request("http://localhost/api/actions");
    expect(requestId(req)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("navigationId", () => {
  it("accepts only UUID navigation ids used for telemetry", () => {
    const req = new Request("http://localhost/api/actions", {
      headers: { "x-alva-navigation-id": "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
    });
    expect(navigationId(req)).toBe("f47ac10b-58cc-4372-a567-0e02b2c3d479");
  });

  it("rejects arbitrary client-provided values", () => {
    const req = new Request("http://localhost/api/actions", {
      headers: { "x-alva-navigation-id": "forged-tenant-value" },
    });
    expect(navigationId(req)).toBeNull();
  });
});

describe("logRequestTiming", () => {
  it("logs a single structured [perf] line with rounded durations and a total", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logRequestTiming("req-1", "route", "/api/actions", [
      { name: "auth", dur: 10.02 },
      { name: "roles", dur: 5.006 },
    ]);

    expect(spy).toHaveBeenCalledTimes(1);
    const [line] = spy.mock.calls[0] as [string];
    expect(line.startsWith("[perf] ")).toBe(true);

    const payload = JSON.parse(line.slice("[perf] ".length));
    expect(payload).toEqual({
      reqId: "req-1",
      layer: "route",
      path: "/api/actions",
      phases: [
        { name: "auth", dur: 10 },
        { name: "roles", dur: 5 },
      ],
      totalMs: 15,
    });

    spy.mockRestore();
  });
});

describe("attachRouteTiming", () => {
  it("sets Server-Timing and x-request-id headers and logs the timing", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const response = new Response(null, { status: 200 });

    const result = attachRouteTiming(response, "req-2", "/api/bookings", [{ name: "db", dur: 4 }]);

    expect(result.headers.get("Server-Timing")).toBe("db;dur=4.0");
    expect(result.headers.get("x-request-id")).toBe("req-2");
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});
