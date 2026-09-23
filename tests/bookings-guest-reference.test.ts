import { describe, expect, it } from "vitest";
import { bookingWithCleaningStatus } from "../lib/data/bookings";

describe("bookingWithCleaningStatus — guest_reference", () => {
  it("passa attraverso il riferimento quando presente", () => {
    const row = {
      id: "b1",
      check_in: "2026-10-01",
      check_out: "2026-10-03",
      guests: 2,
      channel: "airbnb",
      notes: null,
      total_amount: 100,
      guest_reference: "Marco",
      actions: [],
    };
    expect(bookingWithCleaningStatus(row, "org1").guest_reference).toBe("Marco");
  });

  it("normalizza a null quando assente", () => {
    const row = {
      id: "b2",
      check_in: "2026-10-01",
      check_out: "2026-10-03",
      guests: 2,
      channel: "airbnb",
      notes: null,
      total_amount: 100,
      guest_reference: null,
      actions: [],
    };
    expect(bookingWithCleaningStatus(row, "org1").guest_reference).toBeNull();
  });
});
