import "server-only";

import type { Booking } from "@/types/db";

export const BOOKING_SELECT = "id, check_in, check_out, guests, channel, notes, total_amount";

export const BOOKING_WITH_ACTIONS_SELECT = `
  id,
  check_in,
  check_out,
  guests,
  channel,
  notes,
  total_amount,
  actions!actions_booking_id_fkey (
    organization_id,
    booking_id,
    action_type,
    status
  )
`;

type BookingActionProjection = {
  organization_id?: unknown;
  booking_id?: unknown;
  action_type?: unknown;
  status?: unknown;
};

export function bookingWithCleaningStatus(row: Record<string, unknown>, organizationId: string): Booking {
  const nestedActions = Array.isArray(row.actions)
    ? row.actions.filter((action): action is BookingActionProjection => Boolean(action) && typeof action === "object")
    : [];

  let cleaningStatus: "DA_FARE" | "FATTO" | null = null;
  for (const action of nestedActions) {
    // Defense in depth: PostgREST already filters the embedded relation by tenant,
    // but projection code never trusts nested rows from another organization.
    if (String(action.organization_id ?? "") !== organizationId) continue;
    if (!String(action.action_type ?? "").toUpperCase().includes("PULIZIA")) continue;
    cleaningStatus = action.status === "FATTO" ? "FATTO" : action.status === "DA_FARE" ? "DA_FARE" : null;
  }

  const amount = row.total_amount == null ? null : Number(row.total_amount);
  return {
    id: String(row.id ?? ""),
    check_in: String(row.check_in ?? ""),
    check_out: String(row.check_out ?? ""),
    guests: Number(row.guests ?? 0),
    channel: row.channel == null ? null : String(row.channel),
    notes: row.notes == null ? null : String(row.notes),
    total_amount: amount != null && Number.isFinite(amount) ? amount : null,
    cleaning_status: cleaningStatus,
  } satisfies Booking;
}
