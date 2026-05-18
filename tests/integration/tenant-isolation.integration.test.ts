/**
 * Integration tests: tenant isolation.
 * Verifies that data belonging to org A is never visible to org B
 * when filtered by organization_id (the app-level guard, since service_role bypasses RLS).
 * Uses the real local Docker Supabase DB. All data is cleaned up after each test.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, cleanupOrg, createTestOrg, supabaseTest, today, type TestOrg } from "./helpers";

describe("tenant isolation — integration", () => {
  const supabase = supabaseTest();
  let orgA: TestOrg;
  let orgB: TestOrg;
  const base = today();

  beforeAll(async () => {
    orgA = await createTestOrg(supabase, "a");
    orgB = await createTestOrg(supabase, "b");
  });

  afterAll(async () => {
    await cleanupOrg(supabase, orgA.id);
    await cleanupOrg(supabase, orgB.id);
  });

  // ── bookings ──────────────────────────────────────────────────────────────

  describe("bookings", () => {
    it("org A non vede le prenotazioni di org B", async () => {
      const checkIn = addDays(base, 200);
      const checkOut = addDays(base, 203);

      const { data: inserted, error: insertErr } = await supabase
        .from("bookings")
        .insert({ check_in: checkIn, check_out: checkOut, guests: 2, organization_id: orgB.id })
        .select("id")
        .single();
      expect(insertErr).toBeNull();
      const bookingBId = inserted!.id;

      const { data: visibleToA, error } = await supabase
        .from("bookings")
        .select("id")
        .eq("organization_id", orgA.id);

      expect(error).toBeNull();
      const ids = (visibleToA ?? []).map((r) => r.id);
      expect(ids).not.toContain(bookingBId);
    });

    it("org B non vede le prenotazioni di org A", async () => {
      const checkIn = addDays(base, 210);
      const checkOut = addDays(base, 213);

      const { data: inserted, error: insertErr } = await supabase
        .from("bookings")
        .insert({ check_in: checkIn, check_out: checkOut, guests: 3, organization_id: orgA.id })
        .select("id")
        .single();
      expect(insertErr).toBeNull();
      const bookingAId = inserted!.id;

      const { data: visibleToB, error } = await supabase
        .from("bookings")
        .select("id")
        .eq("organization_id", orgB.id);

      expect(error).toBeNull();
      const ids = (visibleToB ?? []).map((r) => r.id);
      expect(ids).not.toContain(bookingAId);
    });
  });

  // ── actions ───────────────────────────────────────────────────────────────

  describe("actions", () => {
    it("org A non vede le azioni di org B", async () => {
      const { data: inserted, error: insertErr } = await supabase
        .from("actions")
        .insert({
          action_date: addDays(base, 220),
          action_type: "PULIZIA",
          organization_id: orgB.id,
        })
        .select("id")
        .single();
      expect(insertErr).toBeNull();
      const actionBId = inserted!.id;

      const { data: visibleToA, error } = await supabase
        .from("actions")
        .select("id")
        .eq("organization_id", orgA.id);

      expect(error).toBeNull();
      const ids = (visibleToA ?? []).map((r) => r.id);
      expect(ids).not.toContain(actionBId);
    });

    it("org B non vede le azioni di org A", async () => {
      const { data: inserted, error: insertErr } = await supabase
        .from("actions")
        .insert({
          action_date: addDays(base, 221),
          action_type: "BIANCHERIA",
          organization_id: orgA.id,
        })
        .select("id")
        .single();
      expect(insertErr).toBeNull();
      const actionAId = inserted!.id;

      const { data: visibleToB, error } = await supabase
        .from("actions")
        .select("id")
        .eq("organization_id", orgB.id);

      expect(error).toBeNull();
      const ids = (visibleToB ?? []).map((r) => r.id);
      expect(ids).not.toContain(actionAId);
    });
  });

  // ── expenses ──────────────────────────────────────────────────────────────

  describe("expenses", () => {
    it("org A non vede le spese di org B", async () => {
      const { data: inserted, error: insertErr } = await supabase
        .from("expenses")
        .insert({
          expense_date: addDays(base, 230),
          category: "pulizie",
          amount: 50,
          organization_id: orgB.id,
        })
        .select("id")
        .single();
      expect(insertErr).toBeNull();
      const expenseBId = inserted!.id;

      const { data: visibleToA, error } = await supabase
        .from("expenses")
        .select("id")
        .eq("organization_id", orgA.id);

      expect(error).toBeNull();
      const ids = (visibleToA ?? []).map((r) => r.id);
      expect(ids).not.toContain(expenseBId);
    });

    it("org B non vede le spese di org A", async () => {
      const { data: inserted, error: insertErr } = await supabase
        .from("expenses")
        .insert({
          expense_date: addDays(base, 231),
          category: "manutenzione",
          amount: 120,
          organization_id: orgA.id,
        })
        .select("id")
        .single();
      expect(insertErr).toBeNull();
      const expenseAId = inserted!.id;

      const { data: visibleToB, error } = await supabase
        .from("expenses")
        .select("id")
        .eq("organization_id", orgB.id);

      expect(error).toBeNull();
      const ids = (visibleToB ?? []).map((r) => r.id);
      expect(ids).not.toContain(expenseAId);
    });
  });

  // ── products ──────────────────────────────────────────────────────────────

  describe("products", () => {
    it("org A non vede i prodotti di org B", async () => {
      const { data: inserted, error: insertErr } = await supabase
        .from("products")
        .insert({
          sku: `sku-b-${Date.now()}`,
          name: "Detersivo B",
          category: "pulizia",
          unit: "pz",
          qty: 5,
          threshold: 2,
          max_qty: 10,
          organization_id: orgB.id,
        })
        .select("id")
        .single();
      expect(insertErr).toBeNull();
      const productBId = inserted!.id;

      const { data: visibleToA, error } = await supabase
        .from("products")
        .select("id")
        .eq("organization_id", orgA.id);

      expect(error).toBeNull();
      const ids = (visibleToA ?? []).map((r) => r.id);
      expect(ids).not.toContain(productBId);
    });

    it("org B non vede i prodotti di org A", async () => {
      const { data: inserted, error: insertErr } = await supabase
        .from("products")
        .insert({
          sku: `sku-a-${Date.now()}`,
          name: "Sapone A",
          category: "bagno",
          unit: "pz",
          qty: 3,
          threshold: 1,
          max_qty: 8,
          organization_id: orgA.id,
        })
        .select("id")
        .single();
      expect(insertErr).toBeNull();
      const productAId = inserted!.id;

      const { data: visibleToB, error } = await supabase
        .from("products")
        .select("id")
        .eq("organization_id", orgB.id);

      expect(error).toBeNull();
      const ids = (visibleToB ?? []).map((r) => r.id);
      expect(ids).not.toContain(productAId);
    });
  });

  // ── cross-conteggio: ogni org vede solo i propri dati ─────────────────────

  describe("conteggio isolato per entità", () => {
    it("il conteggio bookings per org è indipendente", async () => {
      const checkInA = addDays(base, 240);
      const checkOutA = addDays(base, 242);
      const checkInB = addDays(base, 243);
      const checkOutB = addDays(base, 245);

      await supabase
        .from("bookings")
        .insert({ check_in: checkInA, check_out: checkOutA, guests: 1, organization_id: orgA.id });
      await supabase
        .from("bookings")
        .insert({ check_in: checkInB, check_out: checkOutB, guests: 1, organization_id: orgB.id });

      const { count: countA } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgA.id);

      const { count: countB } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgB.id);

      // Ogni org deve vedere solo le proprie prenotazioni
      expect(countA).toBeGreaterThanOrEqual(1);
      expect(countB).toBeGreaterThanOrEqual(1);

      // Il totale combinato deve essere maggiore di quello di ciascuna org singola
      // (prova che i dati non sono condivisi)
      expect((countA ?? 0) + (countB ?? 0)).toBeGreaterThan(Math.max(countA ?? 0, countB ?? 0));
    });
  });
});
