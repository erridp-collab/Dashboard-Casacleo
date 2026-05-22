/**
 * Integration tests: verifica che i dati di un tenant non siano visibili a un altro.
 * Usa il database locale Docker. Due organizzazioni separate vengono create e ripulite
 * per ogni test.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addDays, cleanupOrg, createTestOrg, supabaseTest, today } from "./helpers";

describe("tenant isolation — bookings", () => {
  const supabase = supabaseTest();
  let orgA: string;
  let orgB: string;

  beforeEach(async () => {
    orgA = (await createTestOrg(supabase, `iso-a`)).id;
    orgB = (await createTestOrg(supabase, `iso-b`)).id;
  });

  afterEach(async () => {
    await cleanupOrg(supabase, orgA);
    await cleanupOrg(supabase, orgB);
  });

  it("org A non vede le prenotazioni di org B", async () => {
    const base = today();

    const { data: bk, error: bkErr } = await supabase
      .from("bookings")
      .insert({ organization_id: orgB, check_in: base, check_out: addDays(base, 3), guests: 2 })
      .select("id")
      .single();
    if (bkErr) throw new Error(bkErr.message);

    const { data: rows, error } = await supabase
      .from("bookings")
      .select("id")
      .eq("organization_id", orgA);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => String(r.id));
    expect(ids).not.toContain(String(bk.id));
  });

  it("org B non vede le prenotazioni di org A", async () => {
    const base = today();

    const { data: bk, error: bkErr } = await supabase
      .from("bookings")
      .insert({ organization_id: orgA, check_in: base, check_out: addDays(base, 3), guests: 2 })
      .select("id")
      .single();
    if (bkErr) throw new Error(bkErr.message);

    const { data: rows, error } = await supabase
      .from("bookings")
      .select("id")
      .eq("organization_id", orgB);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => String(r.id));
    expect(ids).not.toContain(String(bk.id));
  });
});

describe("tenant isolation — actions", () => {
  const supabase = supabaseTest();
  let orgA: string;
  let orgB: string;

  beforeEach(async () => {
    orgA = (await createTestOrg(supabase, `iso-act-a`)).id;
    orgB = (await createTestOrg(supabase, `iso-act-b`)).id;
  });

  afterEach(async () => {
    await cleanupOrg(supabase, orgA);
    await cleanupOrg(supabase, orgB);
  });

  it("org A non vede le azioni di org B", async () => {
    const base = today();

    // Serve un booking di orgB per l'action trigger
    const { data: bk } = await supabase
      .from("bookings")
      .insert({ organization_id: orgB, check_in: base, check_out: addDays(base, 2), guests: 1 })
      .select("id")
      .single();

    const { data: act, error: actErr } = await supabase
      .from("actions")
      .insert({ organization_id: orgB, booking_id: bk!.id, action_type: "PULIZIA", action_date: addDays(base, 2), status: "DA_FARE" })
      .select("id")
      .single();
    if (actErr) throw new Error(actErr.message);

    const { data: rows, error } = await supabase
      .from("actions")
      .select("id")
      .eq("organization_id", orgA);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => String(r.id));
    expect(ids).not.toContain(String(act.id));
  });
});

describe("tenant isolation — expenses", () => {
  const supabase = supabaseTest();
  let orgA: string;
  let orgB: string;

  beforeEach(async () => {
    orgA = (await createTestOrg(supabase, `iso-exp-a`)).id;
    orgB = (await createTestOrg(supabase, `iso-exp-b`)).id;
  });

  afterEach(async () => {
    await cleanupOrg(supabase, orgA);
    await cleanupOrg(supabase, orgB);
  });

  it("org A non vede le spese di org B", async () => {
    const base = today();

    const { data: exp, error: expErr } = await supabase
      .from("expenses")
      .insert({ organization_id: orgB, amount: 50, description: "Test spesa", expense_date: base, category: "pulizie" })
      .select("id")
      .single();
    if (expErr) throw new Error(expErr.message);

    const { data: rows, error } = await supabase
      .from("expenses")
      .select("id")
      .eq("organization_id", orgA);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => String(r.id));
    expect(ids).not.toContain(String(exp.id));
  });
});

describe("tenant isolation — products", () => {
  const supabase = supabaseTest();
  let orgA: string;
  let orgB: string;

  beforeEach(async () => {
    orgA = (await createTestOrg(supabase, `iso-prod-a`)).id;
    orgB = (await createTestOrg(supabase, `iso-prod-b`)).id;
  });

  afterEach(async () => {
    await cleanupOrg(supabase, orgA);
    await cleanupOrg(supabase, orgB);
  });

  it("org A non vede i prodotti di org B", async () => {
    const { data: prod, error: prodErr } = await supabase
      .from("products")
      .insert({ organization_id: orgB, name: "Prodotto Test B", category: "magazzino", sku: `sku-iso-b-${Date.now()}`, qty: 5, threshold: 1 })
      .select("id")
      .single();
    if (prodErr) throw new Error(prodErr.message);

    const { data: rows, error } = await supabase
      .from("products")
      .select("id")
      .eq("organization_id", orgA);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => String(r.id));
    expect(ids).not.toContain(String(prod.id));
  });
});
