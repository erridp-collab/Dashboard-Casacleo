import { afterEach, describe, expect, it, vi } from "vitest";
import { activeNavigationId, markDataVisible, markNavClick } from "@/lib/perf/navMarks";

describe("markNavClick + markDataVisible", () => {
  afterEach(() => {
    performance.clearMarks();
    performance.clearMeasures();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("logs a click-to-painted duration after the next paint opportunity", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });

    markNavClick("actions");
    const navigationId = activeNavigationId();
    markDataVisible("actions");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatch(
      /^\[perf\] nav:actions click-to-painted \d+(\.\d+)?ms navId=[0-9a-f-]{36}$/,
    );
    expect(navigationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(activeNavigationId()).toBeNull();
  });

  it("does nothing when there is no matching click mark", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    markDataVisible("bookings");

    expect(spy).not.toHaveBeenCalled();
  });

  it("clears the marks after measuring so a later navigation starts clean", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    markNavClick("finance");
    markDataVisible("finance");

    expect(performance.getEntriesByName("nav:finance:click", "mark")).toHaveLength(0);
  });
});
