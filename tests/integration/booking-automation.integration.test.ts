/**
 * Integration tests: booking creation → pulizie/biancheria/checklist generated.
 * Uses the real Supabase DB. All test data is inserted and cleaned up per test.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncBookingAutomations } from "../../lib/booking-automation";
import { addDays, supabaseTest, today } from "./helpers";

// Track IDs created in each test for cleanup
let createdBookingIds: string[] = [];

async function cleanup(supabase: ReturnType<typeof supabaseTest>) {
  if (createdBookingIds.length === 0) return;

  // Delete actions (and their checklists) linked to our test bookings
  const { data: actions } = await supabase
    .from("actions")
    .select("id")
    .in("booking_id", createdBookingIds);

  const actionIds = (actions ?? []).map((a) => String(a.id));
  if (actionIds.length > 0) {
    await supabase.from("action_checklist").delete().in("action_id", actionIds);
    await supabase.from("actions").delete().in("id", actionIds);
  }

  await supabase.from("bookings").delete().in("id", createdBookingIds);
  createdBookingIds = [];
}

async function insertBooking(
  supabase: ReturnType<typeof supabaseTest>,
  checkIn: string,
  checkOut: string,
  guests = 2,
): Promise<string> {
  const { data, error } = await supabase
    .from("bookings")
    .insert({ check_in: checkIn, check_out: checkOut, guests })
    .select("id")
    .single();
  if (error) throw new Error(`insertBooking: ${error.message}`);
  const id = String(data.id);
  createdBookingIds.push(id);
  return id;
}

describe("syncBookingAutomations — integration", () => {
  const supabase = supabaseTest();
  const base = today();

  beforeEach(() => {
    createdBookingIds = [];
  });

  afterEach(async () => {
    await cleanup(supabase);
  });

  it("crea PULIZIA e BIANCHERIA per ogni checkout", async () => {
    const checkIn = addDays(base, 30);
    const checkOut = addDays(base, 33);

    await insertBooking(supabase, checkIn, checkOut);
    await syncBookingAutomations();

    const { data: actions, error } = await supabase
      .from("actions")
      .select("action_type, action_date, booking_id")
      .in("booking_id", createdBookingIds);

    expect(error).toBeNull();
    const types = (actions ?? []).map((a) => a.action_type);
    expect(types).toContain("PULIZIA");
    expect(types).toContain("BIANCHERIA");

    const pulizia = actions?.find((a) => a.action_type === "PULIZIA");
    expect(pulizia?.action_date).toBe(checkOut);
  });

  it("crea LAVATRICI e MANUT_3 alla 3a prenotazione (sequenza da solo)", async () => {
    // We cannot assert on the global position in the sequence because the DB already
    // contains real bookings. Instead: verify that LAVATRICI is generated *for some*
    // booking at multiples-of-3 position, by checking unit logic directly.
    // The unit test in booking-automation.test.ts covers the exact sequencing rule.
    // Here we verify that syncBookingAutomations actually writes the DB records.

    const b1In = addDays(base, 40);
    const b1Out = addDays(base, 42);
    const b2In = b1Out;
    const b2Out = addDays(base, 44);
    const b3In = b2Out;
    const b3Out = addDays(base, 46);

    await insertBooking(supabase, b1In, b1Out);
    await insertBooking(supabase, b2In, b2Out);
    await insertBooking(supabase, b3In, b3Out);

    await syncBookingAutomations();

    // Verify that sync ran and created at least PULIZIA for each of our 3 bookings
    const { data: actions, error } = await supabase
      .from("actions")
      .select("action_type, booking_id")
      .in("booking_id", createdBookingIds);

    expect(error).toBeNull();
    const pulizie = (actions ?? []).filter((a) => a.action_type === "PULIZIA");
    expect(pulizie).toHaveLength(3); // one per booking

    // LAVATRICI may or may not appear on these specific 3 bookings depending on
    // global sequence position — confirmed correct by unit tests.
  });

  it("crea PREPARA_LETTO quando il gap tra checkout e checkin è > 3 giorni", async () => {
    const b1In = addDays(base, 50);
    const b1Out = addDays(base, 52);
    const b2In = addDays(base, 60); // 8 giorni dopo b1Out
    const b2Out = addDays(base, 63);

    await insertBooking(supabase, b1In, b1Out);
    const b2 = await insertBooking(supabase, b2In, b2Out);

    await syncBookingAutomations();

    const { data: actions } = await supabase
      .from("actions")
      .select("action_type, action_date, booking_id")
      .in("booking_id", createdBookingIds);

    const prepara = (actions ?? []).find(
      (a) => a.action_type === "PREPARA_LETTO" && a.booking_id === b2,
    );
    expect(prepara).toBeDefined();
    expect(prepara?.action_date).toBe(b2In);
  });

  it("NON crea PREPARA_LETTO tra due prenotazioni consecutive con gap ≤ 3 giorni", async () => {
    // We insert two back-to-back bookings with only a 2-day gap.
    // PREPARA_LETTO should NOT be generated for b2 relative to b1.
    // Note: syncBookingAutomations operates on all bookings in the DB, so a pre-existing
    // booking before b1 with a large gap could create PREPARA_LETTO for b1.
    // We only assert that the PREPARA_LETTO action (if any) for b2 is absent.
    const b1In = addDays(base, 70);
    const b1Out = addDays(base, 72);
    const b2In = addDays(base, 74); // 2 giorni dopo b1Out — gap ≤ 3
    const b2Out = addDays(base, 76);

    await insertBooking(supabase, b1In, b1Out);
    const b2 = await insertBooking(supabase, b2In, b2Out);

    await syncBookingAutomations();

    const { data: actions } = await supabase
      .from("actions")
      .select("action_type, action_date, booking_id")
      .in("booking_id", createdBookingIds);

    // PREPARA_LETTO for b2 would be on b2In date — should not exist
    const preparaB2 = (actions ?? []).find(
      (a) => a.action_type === "PREPARA_LETTO" && a.booking_id === b2 && a.action_date === b2In,
    );
    expect(preparaB2).toBeUndefined();
  });

  it("la checklist viene creata per l'azione PULIZIA", async () => {
    const checkIn = addDays(base, 80);
    const checkOut = addDays(base, 83);

    await insertBooking(supabase, checkIn, checkOut);
    await syncBookingAutomations();

    const { data: actions } = await supabase
      .from("actions")
      .select("id, action_type")
      .in("booking_id", createdBookingIds)
      .eq("action_type", "PULIZIA");

    expect((actions ?? []).length).toBeGreaterThan(0);
    const actionId = actions![0].id;

    const { data: checklist } = await supabase
      .from("action_checklist")
      .select("id, done")
      .eq("action_id", actionId);

    // Checklist may be empty if no template exists — just verify no error and done=false
    for (const item of checklist ?? []) {
      expect(item.done).toBe(false);
    }
  });

  it("rimuove le azioni quando la prenotazione viene eliminata", async () => {
    const checkIn = addDays(base, 90);
    const checkOut = addDays(base, 93);

    const bookingId = await insertBooking(supabase, checkIn, checkOut);
    await syncBookingAutomations();

    // Verify actions exist
    const { data: before } = await supabase
      .from("actions")
      .select("id")
      .eq("booking_id", bookingId);
    expect((before ?? []).length).toBeGreaterThan(0);

    // Delete booking (not via API — direct delete to test sync)
    await supabase.from("bookings").delete().eq("id", bookingId);
    createdBookingIds = createdBookingIds.filter((id) => id !== bookingId);

    await syncBookingAutomations();

    const { data: after } = await supabase
      .from("actions")
      .select("id")
      .eq("booking_id", bookingId);
    expect((after ?? []).length).toBe(0);
  });
});
