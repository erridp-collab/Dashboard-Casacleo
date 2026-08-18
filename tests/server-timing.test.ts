import { describe, expect, it } from "vitest";
import { serverTimingHeader, timed, totalDuration } from "@/lib/timing/serverTiming";

describe("timed", () => {
  it("records duration and returns the resolved value", async () => {
    const entries: { name: string; dur: number }[] = [];
    const result = await timed(entries, "op", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "value";
    });

    expect(result).toBe("value");
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("op");
    expect(entries[0].dur).toBeGreaterThanOrEqual(0);
  });

  it("records the duration even when the operation throws", async () => {
    const entries: { name: string; dur: number }[] = [];

    await expect(
      timed(entries, "failing-op", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("failing-op");
  });

  it("accepts a PromiseLike (e.g. a Supabase query builder) as well as a Promise", async () => {
    const entries: { name: string; dur: number }[] = [];
    const thenable: PromiseLike<number> = {
      then(onfulfilled) {
        return Promise.resolve(42).then(onfulfilled);
      },
    };

    const result = await timed(entries, "thenable-op", () => thenable);

    expect(result).toBe(42);
    expect(entries).toHaveLength(1);
  });
});

describe("serverTimingHeader", () => {
  it("formats entries per the Server-Timing header spec", () => {
    const header = serverTimingHeader([
      { name: "auth", dur: 12.345 },
      { name: "db", dur: 3.2, desc: "select actions" },
    ]);

    expect(header).toBe('auth;dur=12.3, db;dur=3.2;desc="select actions"');
  });

  it("returns an empty string when there are no entries", () => {
    expect(serverTimingHeader([])).toBe("");
  });
});

describe("totalDuration", () => {
  it("sums the duration of every entry", () => {
    expect(
      totalDuration([
        { name: "a", dur: 1.5 },
        { name: "b", dur: 2.5 },
      ]),
    ).toBe(4);
  });

  it("returns 0 for an empty list", () => {
    expect(totalDuration([])).toBe(0);
  });
});
