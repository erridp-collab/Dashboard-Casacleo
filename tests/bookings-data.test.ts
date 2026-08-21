import { describe, expect, it } from "vitest";
import { bookingWithCleaningStatus } from "@/lib/data/bookings";

describe("bookingWithCleaningStatus", () => {
  const baseBooking = {
    id: "booking-a",
    check_in: "2026-08-21",
    check_out: "2026-08-24",
    guests: 2,
    channel: "direct",
    notes: null,
    total_amount: 300,
  };

  it("derives the cleaning status only from actions of the authorized tenant", () => {
    const result = bookingWithCleaningStatus(
      {
        ...baseBooking,
        actions: [
          { organization_id: "org-b", action_type: "PULIZIA", status: "FATTO" },
          { organization_id: "org-a", action_type: "PULIZIA CHECKOUT", status: "DA_FARE" },
        ],
      },
      "org-a",
    );

    expect(result.cleaning_status).toBe("DA_FARE");
  });

  it("does not expose the embedded action projection in the API model", () => {
    const result = bookingWithCleaningStatus(
      { ...baseBooking, actions: [{ organization_id: "org-a", action_type: "PULIZIA", status: "FATTO" }] },
      "org-a",
    );

    expect(result.cleaning_status).toBe("FATTO");
    expect(result).not.toHaveProperty("actions");
    expect(result).not.toHaveProperty("organization_id");
  });

  it("returns null when no authorized cleaning action exists", () => {
    const result = bookingWithCleaningStatus(
      { ...baseBooking, actions: [{ organization_id: "org-a", action_type: "MANUTENZIONE", status: "FATTO" }] },
      "org-a",
    );

    expect(result.cleaning_status).toBeNull();
  });
});
