import { afterEach, describe, expect, it, vi } from "vitest";
import { markDataVisible, markNavClick } from "@/lib/perf/navMarks";

describe("markNavClick + markDataVisible", () => {
  afterEach(() => {
    performance.clearMarks();
    performance.clearMeasures();
    vi.restoreAllMocks();
  });

  it("logs a click-to-visible duration when a click mark exists", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    markNavClick("actions");
    markDataVisible("actions");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatch(/^\[perf\] nav:actions click-to-visible \d+(\.\d+)?ms$/);
  });

  it("does nothing when there is no matching click mark", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    markDataVisible("bookings");

    expect(spy).not.toHaveBeenCalled();
  });

  it("clears the marks after measuring so a later navigation starts clean", () => {
    markNavClick("finance");
    markDataVisible("finance");

    expect(performance.getEntriesByName("nav:finance:click", "mark")).toHaveLength(0);
  });
});
