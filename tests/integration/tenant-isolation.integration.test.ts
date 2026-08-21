/**
 * Integration tests: verifica che i dati di un tenant non siano visibili a un altro.
 * Usa il database locale Docker. Due organizzazioni separate vengono create e ripulite
 * per ogni test.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BOOKING_WITH_ACTIONS_SELECT } from "@/lib/data/bookings";
import { EXPENSE_WITH_SOURCE_ACTION_SELECT, expenseRestockDetail } from "@/lib/data/finance";
import { findPrimaryOrganizationForUser } from "@/lib/organizationContext";
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

  it("la query embedded restituisce in un round-trip solo booking e azioni di org A", async () => {
    const base = today();
    const { data: bookingA, error: bookingAError } = await supabase
      .from("bookings")
      .insert({ organization_id: orgA, check_in: base, check_out: addDays(base, 2), guests: 2 })
      .select("id")
      .single();
    if (bookingAError) throw new Error(bookingAError.message);

    const { data: bookingB, error: bookingBError } = await supabase
      .from("bookings")
      .insert({ organization_id: orgB, check_in: base, check_out: addDays(base, 3), guests: 3 })
      .select("id")
      .single();
    if (bookingBError) throw new Error(bookingBError.message);

    const { error: actionError } = await supabase.from("actions").insert([
      {
        organization_id: orgA,
        booking_id: bookingA.id,
        action_type: "PULIZIA TEST A",
        action_date: addDays(base, 2),
        status: "DA_FARE",
      },
      {
        organization_id: orgB,
        booking_id: bookingB.id,
        action_type: "PULIZIA TEST B",
        action_date: addDays(base, 3),
        status: "FATTO",
      },
    ]);
    if (actionError) throw new Error(actionError.message);

    const { data: rows, error } = await supabase
      .from("bookings")
      .select(BOOKING_WITH_ACTIONS_SELECT)
      .eq("organization_id", orgA)
      .eq("actions.organization_id", orgA);
    if (error) throw new Error(error.message);

    expect((rows ?? []).map((row) => String(row.id))).toEqual([String(bookingA.id)]);
    const nestedActions = (rows?.[0]?.actions ?? []) as Array<Record<string, unknown>>;
    expect(nestedActions.length).toBeGreaterThan(0);
    expect(nestedActions.every((action) => String(action.organization_id) === orgA)).toBe(true);
    expect(nestedActions).toContainEqual(expect.objectContaining({ action_type: "PULIZIA TEST A", status: "DA_FARE" }));
    expect(nestedActions).not.toContainEqual(expect.objectContaining({ action_type: "PULIZIA TEST B" }));
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

  it("la query embedded restituisce dettagli rifornimento solo per org A", async () => {
    const base = today();
    const { data: actions, error: actionsError } = await supabase
      .from("actions")
      .insert([
        {
          organization_id: orgA,
          action_type: "RIFORNIMENTO TEST A",
          action_date: base,
          status: "FATTO",
          details: "Sapone A: 2",
        },
        {
          organization_id: orgB,
          action_type: "RIFORNIMENTO TEST B",
          action_date: base,
          status: "FATTO",
          details: "Segreto B",
        },
      ])
      .select("id, organization_id");
    if (actionsError) throw new Error(actionsError.message);

    const actionA = actions?.find((row) => String(row.organization_id) === orgA);
    const actionB = actions?.find((row) => String(row.organization_id) === orgB);
    if (!actionA || !actionB) throw new Error("Missing refill test actions");

    const { error: crossTenantLinkError } = await supabase.from("expenses").insert({
      organization_id: orgA,
      amount: 99,
      description: "Cross-tenant link must fail",
      expense_date: base,
      category: "rifornimento",
      origin: "automatica_da_rifornimento",
      source_action_id: actionB.id,
    });
    expect(crossTenantLinkError, "the DB must reject an org A expense linked to an org B action").not.toBeNull();

    const { error: expensesError } = await supabase.from("expenses").insert([
      {
        organization_id: orgA,
        amount: 10,
        description: "Rifornimento A",
        expense_date: base,
        category: "rifornimento",
        origin: "automatica_da_rifornimento",
        source_action_id: actionA.id,
      },
      {
        organization_id: orgB,
        amount: 20,
        description: "Rifornimento B",
        expense_date: base,
        category: "rifornimento",
        origin: "automatica_da_rifornimento",
        source_action_id: actionB.id,
      },
    ]);
    if (expensesError) throw new Error(expensesError.message);

    const { data: rows, error } = await supabase
      .from("expenses")
      .select(EXPENSE_WITH_SOURCE_ACTION_SELECT)
      .eq("organization_id", orgA)
      .eq("source_action.organization_id", orgA);
    if (error) throw new Error(error.message);

    expect(rows).toHaveLength(1);
    const expense = rows?.[0] as unknown as Record<string, unknown>;
    expect(expenseRestockDetail(expense, orgA)).toBe("Sapone A: 2");
    expect(JSON.stringify(expense)).not.toContain("Segreto B");
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

describe("tenant isolation — organization membership relation", () => {
  const supabase = supabaseTest();
  let orgA: string;
  let orgB: string;
  let userId: string;

  beforeEach(async () => {
    orgA = (await createTestOrg(supabase, "iso-membership-a")).id;
    orgB = (await createTestOrg(supabase, "iso-membership-b")).id;
    const { data, error } = await supabase.auth.admin.createUser({
      email: `iso-membership-${Date.now()}@example.com`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(error?.message ?? "Missing test user");
    userId = data.user.id;
  });

  afterEach(async () => {
    if (userId) await supabase.auth.admin.deleteUser(userId);
    await cleanupOrg(supabase, orgA);
    await cleanupOrg(supabase, orgB);
  });

  it("loads the preferred organization in one FK query scoped by authoritative user id", async () => {
    const { error: rolesError } = await supabase.from("user_roles").insert([
      { organization_id: orgA, user_id: userId, role: "owner" },
      { organization_id: orgB, user_id: userId, role: "staff" },
    ]);
    if (rolesError) throw new Error(rolesError.message);

    await expect(findPrimaryOrganizationForUser(userId, orgB)).resolves.toMatchObject({
      id: orgB,
      settings: expect.any(Object),
    });
  });
});
