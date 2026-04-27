/**
 * Read-only DB audit: compares actual state vs expected state.
 * Run with: npx tsx scripts/audit-db.ts
 *
 * Checks:
 * 1. Actions: which actions are missing or extra vs computeDesiredActions()
 * 2. Stock: actual qty vs expected based on booking history
 * 3. Expenses: orphan or missing auto-expenses linked to completed actions
 * 4. Shopping action: is the SPESA action aligned with current low-stock products
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";

// ─── inline copies of pure logic (avoid server-only import in lib/) ──────────

function computeDesiredActions(bookings: Array<{ id: string; check_in: string; check_out: string }>) {
  type DesiredAction = { booking_id: string; action_date: string; action_type: string; status: "DA_FARE"; details: string | null };
  const desired: DesiredAction[] = [];
  let prevCheckOut: string | null = null;

  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    const stayIndex = i + 1;

    desired.push({ booking_id: booking.id, action_date: booking.check_out, action_type: "PULIZIA", status: "DA_FARE", details: null });
    desired.push({ booking_id: booking.id, action_date: booking.check_out, action_type: "BIANCHERIA", status: "DA_FARE", details: "Cambio biancheria consigliato" });

    if (prevCheckOut) {
      const from = new Date(prevCheckOut);
      const to = new Date(booking.check_in);
      const days = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
      if (days > 3) {
        desired.push({ booking_id: booking.id, action_date: booking.check_in, action_type: "PREPARA_LETTO", status: "DA_FARE", details: "Preparare letto dopo periodo senza ospiti" });
      }
    }

    if (stayIndex % 3 === 0) {
      desired.push({ booking_id: booking.id, action_date: booking.check_out, action_type: "LAVATRICI", status: "DA_FARE", details: null });
      desired.push({ booking_id: booking.id, action_date: booking.check_out, action_type: "MANUT_3", status: "DA_FARE", details: null });
    }

    if (stayIndex % 4 === 0) {
      desired.push({ booking_id: booking.id, action_date: booking.check_out, action_type: "MANUT_4", status: "DA_FARE", details: null });
    }

    prevCheckOut = booking.check_out;
  }

  return desired;
}

function getBookingConsumptionMap(checkIn: string, checkOut: string, guests: number): Map<string, number> {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const consumptions = new Map<string, number>();
  if (days <= 0 || guests <= 0) return consumptions;
  const setCount = Math.ceil(guests / 2);
  consumptions.set("asciugamani bidet", setCount * 2);
  consumptions.set("asciugamani doccia", setCount * 2);
  consumptions.set("asciugamani corpo", setCount * 2);
  consumptions.set("set letto estivo", setCount);
  return consumptions;
}

function shouldIncludeInShoppingList(product: { name: string; category?: string | null }): boolean {
  const category = String(product.category ?? "").toUpperCase();
  const name = String(product.name ?? "").toUpperCase();
  if (name === "LENZUOLO SOTTO EXTRA") return false;
  if (["ASCIUGAMANI E BAGNO", "LENZUOLA E COPERTE", "TESSILI E BIANCHERIA"].includes(category)) return false;
  if (name.includes("ASCIUGAMANI") || name.includes("LENZUO") || name.includes("FEDER") ||
      name.includes("COPRIPIUM") || name.includes("TAPPETINI") || name.includes("PIUMINO")) return false;
  return true;
}

function resolveSchemaFromRow(row: Record<string, unknown>) {
  const idColumn = "id" in row ? "id" : "sku" as "id" | "sku";
  const quantityColumn = "quantity" in row ? "quantity" : "qty" as "quantity" | "qty";
  return { idColumn, quantityColumn };
}

function getProductId(row: Record<string, unknown>, schema: { idColumn: string }): string {
  return String(row[schema.idColumn] ?? row.id ?? row.sku ?? "");
}

function getProductQuantity(row: Record<string, unknown>, schema: { quantityColumn: string }): number {
  const value = row[schema.quantityColumn] ?? row.quantity ?? row.qty ?? 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ─── env loading ────────────────────────────────────────────────────────────

function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// ─── helpers ─────────────────────────────────────────────────────────────────

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function ok(msg: string) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function warn(msg: string) { console.log(`  ${YELLOW}⚠${RESET} ${msg}`); }
function err(msg: string) { console.log(`  ${RED}✗${RESET} ${msg}`); }
function info(msg: string) { console.log(`  ${BLUE}ℹ${RESET} ${msg}`); }
function section(title: string) { console.log(`\n${BOLD}${title}${RESET}`); }

function actionKey(a: { booking_id: string | null; action_type: string; action_date: string }): string {
  return `${a.booking_id ?? ""}|${a.action_type}|${a.action_date}`;
}

// ─── 1. BOOKING ACTIONS AUDIT ────────────────────────────────────────────────

async function auditBookingActions(): Promise<void> {
  section("1. AZIONI GENERATE DA PRENOTAZIONI");

  const MANAGED_ACTION_TYPES = ["PULIZIA", "PREPARA_LETTO", "BIANCHERIA", "LAVATRICI", "MANUT_3", "MANUT_4", "MANUTENZIONE"];

  const { data: bookingsData, error: bookingsErr } = await supabase
    .from("bookings")
    .select("id, check_in, check_out")
    .order("check_out", { ascending: true });

  if (bookingsErr) { err(`Errore lettura prenotazioni: ${bookingsErr.message}`); return; }

  const bookings = (bookingsData ?? []).map((b) => ({
    id: String(b.id),
    check_in: String(b.check_in),
    check_out: String(b.check_out),
  }));

  info(`${bookings.length} prenotazioni trovate`);

  const desired = computeDesiredActions(bookings);
  const desiredMap = new Map(desired.map((a) => [actionKey(a), a]));

  const { data: existingData, error: existingErr } = await supabase
    .from("actions")
    .select("id, booking_id, action_type, action_date, status")
    .not("booking_id", "is", null)
    .in("action_type", MANAGED_ACTION_TYPES);

  if (existingErr) { err(`Errore lettura azioni: ${existingErr.message}`); return; }

  const existing = (existingData ?? []).map((a) => ({
    id: String(a.id),
    booking_id: a.booking_id ? String(a.booking_id) : null,
    action_type: String(a.action_type),
    action_date: String(a.action_date),
    status: String(a.status),
  }));
  const existingMap = new Map(existing.map((a) => [actionKey(a), a]));

  const missing = desired.filter((a) => !existingMap.has(actionKey(a)));
  const extra = existing.filter((a) => !desiredMap.has(actionKey(a)));

  if (missing.length === 0) {
    ok(`Tutte le ${desired.length} azioni attese sono presenti`);
  } else {
    err(`${missing.length} azioni MANCANTI:`);
    for (const a of missing) {
      const booking = bookings.find((b) => b.id === a.booking_id);
      console.log(`     - ${a.action_type} il ${a.action_date} (booking ${a.booking_id}, check-in ${booking?.check_in ?? "?"} → check-out ${booking?.check_out ?? "?"})`);
    }
  }

  if (extra.length === 0) {
    ok("Nessuna azione in eccesso (orfane)");
  } else {
    warn(`${extra.length} azioni EXTRA (non previste dalla logica):`);
    for (const a of extra) {
      console.log(`     - ${a.action_type} il ${a.action_date} [${a.status}] (booking ${a.booking_id})`);
    }
  }

  // Checklist check for PULIZIA actions
  section("1b. CHECKLIST PULIZIE");
  const pulizieActions = existing.filter((a) => a.action_type === "PULIZIA");
  info(`${pulizieActions.length} azioni PULIZIA trovate`);
  let missingChecklist = 0;
  for (const action of pulizieActions) {
    const { data: cl } = await supabase
      .from("action_checklist")
      .select("id")
      .eq("action_id", action.id);
    if ((cl ?? []).length === 0) missingChecklist++;
  }
  if (missingChecklist === 0) {
    ok("Tutte le PULIZIE hanno una checklist");
  } else {
    warn(`${missingChecklist} PULIZIE senza checklist`);
  }
}

// ─── 2. STOCK AUDIT ──────────────────────────────────────────────────────────

async function auditStock(): Promise<void> {
  section("2. MAGAZZINO — QUANTITÀ BIANCHERIA");

  const { data: productsData, error: productsErr } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (productsErr) { err(`Errore lettura prodotti: ${productsErr.message}`); return; }

  const LINEN_NAMES = new Set(["asciugamani bidet", "asciugamani doccia", "asciugamani corpo", "set letto estivo"]);

  type ProductRow = {
    id: string;
    name: string;
    qty: number;
    threshold: number;
    maxQty: number | null;
    stock_status: string | null;
    consumption_per_checkout: number;
    category: string | null;
  };

  const schema = productsData && productsData.length > 0
    ? resolveSchemaFromRow(productsData[0] as Record<string, unknown>)
    : { idColumn: "sku", quantityColumn: "qty" };

  const products: ProductRow[] = (productsData ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: getProductId(row, schema),
      name: String(row.name ?? ""),
      qty: getProductQuantity(row, schema),
      threshold: Number(row.threshold ?? 0),
      maxQty: row.max_qty != null ? Number(row.max_qty) : null,
      stock_status: row.stock_status != null ? String(row.stock_status) : null,
      consumption_per_checkout: Number(row.consumption_per_checkout ?? 0),
      category: row.category != null ? String(row.category) : null,
    };
  });

  // Show linen products with qty=0 (stock data never populated)
  const linenProducts = products.filter((p) =>
    LINEN_NAMES.has(p.name.trim().toLowerCase())
  );

  if (linenProducts.length === 0) {
    warn("Nessun prodotto biancheria (asciugamani/set letto) trovato");
  } else {
    info(`Prodotti biancheria (${linenProducts.length}):`);
    for (const p of linenProducts) {
      const status = p.qty === 0
        ? `${RED}qty=0 — magazzino non popolato${RESET}`
        : `qty=${p.qty} (soglia: ${p.threshold}, max: ${p.maxQty ?? "n/d"})`;
      console.log(`     - ${p.name}: ${status}`);
    }
    if (linenProducts.every((p) => p.qty === 0)) {
      warn("Tutti i prodotti biancheria hanno qty=0 → il consumo per checkout non è tracciato in modo significativo");
    }
  }

  // Low stock non-linen products
  section("2b. PRODOTTI SOTTO SOGLIA (candidati SPESA)");

  const lowStock = products.filter((p) => {
    if (!shouldIncludeInShoppingList(p)) return false;
    if (p.stock_status === "A_META" || p.stock_status === "TERMINATO") return true;
    return p.stock_status === null && p.qty <= p.threshold;
  });

  if (lowStock.length === 0) {
    ok("Nessun prodotto sotto soglia");
  } else {
    warn(`${lowStock.length} prodotti sotto soglia:`);
    for (const p of lowStock) {
      const reason = p.stock_status ? `stock_status=${p.stock_status}` : `qty=${p.qty} ≤ threshold=${p.threshold}`;
      console.log(`     - ${p.name}: ${reason}`);
    }
  }

  // Total products with consumption tracking
  const withConsumption = products.filter((p) => p.consumption_per_checkout > 0);
  info(`${withConsumption.length} prodotti con consumption_per_checkout > 0:`);
  for (const p of withConsumption) {
    console.log(`     - ${p.name}: ${p.consumption_per_checkout}/checkout, qty=${p.qty}`);
  }
}

// ─── 3. EXPENSES AUDIT ───────────────────────────────────────────────────────

async function auditExpenses(): Promise<void> {
  section("3. SPESE AUTOMATICHE");

  // Check if source_action_id column exists
  const probe = await supabase.from("expenses").select("source_action_id").limit(1);
  if (probe.error?.message?.includes("source_action_id") || probe.error?.code === "42703" || probe.error?.code === "PGRST204") {
    warn("Colonna source_action_id non presente in expenses → impossibile tracciare spese automatiche");
    return;
  }

  const { data: autoExpenses, error: expErr } = await supabase
    .from("expenses")
    .select("id, amount, category, origin, source_action_id, expense_date")
    .not("origin", "is", null)
    .order("expense_date", { ascending: false });

  if (expErr) { err(`Errore lettura spese: ${expErr.message}`); return; }

  const expenses = autoExpenses ?? [];
  info(`${expenses.length} spese automatiche trovate`);

  // Check for orphan expenses (action no longer exists)
  const actionIdsWithExpenses = [...new Set(
    expenses
      .filter((e) => e.source_action_id != null)
      .map((e) => String(e.source_action_id))
  )];

  if (actionIdsWithExpenses.length > 0) {
    const { data: actionsData } = await supabase
      .from("actions")
      .select("id")
      .in("id", actionIdsWithExpenses);

    const existingActionIds = new Set((actionsData ?? []).map((a) => String(a.id)));
    const orphanExpenses = expenses.filter(
      (e) => e.source_action_id != null && !existingActionIds.has(String(e.source_action_id))
    );

    if (orphanExpenses.length === 0) {
      ok("Nessuna spesa orfana (tutte le spese auto hanno l'azione corrispondente)");
    } else {
      err(`${orphanExpenses.length} spese ORFANE (azione eliminata):`);
      for (const e of orphanExpenses) {
        console.log(`     - id=${e.id}, €${e.amount}, categoria=${e.category}, data=${e.expense_date}`);
      }
    }
  }

  // Check completed PULIZIA EXTERNAL actions without expense
  const { data: doneExternal } = await supabase
    .from("actions")
    .select("id, action_date, details")
    .eq("action_type", "PULIZIA")
    .eq("status", "FATTO");

  const doneExternalActions = (doneExternal ?? []).filter((a) => {
    try {
      const d = JSON.parse(String(a.details ?? "{}"));
      return d?.mode === "EXTERNAL";
    } catch { return false; }
  });

  if (doneExternalActions.length > 0) {
    const expenseActionIds = new Set(
      expenses
        .filter((e) => e.origin === "automatica_da_pulizia")
        .map((e) => String(e.source_action_id))
    );
    const missingExpenses = doneExternalActions.filter((a) => !expenseActionIds.has(String(a.id)));
    if (missingExpenses.length === 0) {
      ok(`Tutte le ${doneExternalActions.length} PULIZIE EXTERNAL FATTO hanno la spesa`);
    } else {
      warn(`${missingExpenses.length} PULIZIE EXTERNAL FATTO senza spesa collegata`);
    }
  } else {
    info("Nessuna PULIZIA EXTERNAL completata trovata");
  }

  // Summary by origin
  const byOrigin = new Map<string, { count: number; total: number }>();
  for (const e of expenses) {
    const origin = String(e.origin ?? "sconosciuta");
    const cur = byOrigin.get(origin) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += Number(e.amount ?? 0);
    byOrigin.set(origin, cur);
  }
  if (byOrigin.size > 0) {
    info("Riepilogo spese automatiche per origine:");
    for (const [origin, stats] of byOrigin.entries()) {
      console.log(`     - ${origin}: ${stats.count} spese, totale €${stats.total.toFixed(2)}`);
    }
  }
}

// ─── 4. SHOPPING ACTION AUDIT ────────────────────────────────────────────────

async function auditShoppingAction(): Promise<void> {
  section("4. AZIONE SPESA (LISTA DELLA SPESA)");

  const { data: spesaActions, error: spesaErr } = await supabase
    .from("actions")
    .select("id, status, action_date, details")
    .eq("action_type", "SPESA")
    .eq("status", "DA_FARE")
    .is("booking_id", null);

  if (spesaErr) { err(`Errore lettura SPESA: ${spesaErr.message}`); return; }

  const spesaList = spesaActions ?? [];

  if (spesaList.length === 0) {
    info("Nessuna azione SPESA DA_FARE presente");
  } else if (spesaList.length === 1) {
    ok("Una sola azione SPESA DA_FARE (corretto)");
    const details = String(spesaList[0].details ?? "");
    if (details) {
      info("Prodotti nella lista:");
      for (const line of details.split("\n")) {
        if (line.startsWith("- ")) console.log(`     ${line}`);
      }
    }
  } else {
    warn(`${spesaList.length} azioni SPESA DA_FARE duplicate — dovrebbe essercene al massimo 1`);
    for (const a of spesaList) {
      console.log(`     - id=${a.id}, data=${a.action_date}`);
    }
  }
}

// ─── 5. BOOKING CONSUMPTION AUDIT ────────────────────────────────────────────

async function auditBookingConsumption(): Promise<void> {
  section("5. CONSUMO TEORICO BIANCHERIA (dalle prenotazioni)");

  const { data: bookingsData, error } = await supabase
    .from("bookings")
    .select("id, check_in, check_out, guests")
    .order("check_out", { ascending: true });

  if (error) { err(`Errore lettura prenotazioni: ${error.message}`); return; }

  const bookings = bookingsData ?? [];
  info(`${bookings.length} prenotazioni totali`);

  let totalSetsEstivo = 0;
  let totalTowelsBidet = 0;
  let totalTowelsDoccia = 0;
  let totalTowelsCorpo = 0;

  for (const b of bookings) {
    const guests = Number(b.guests ?? 2);
    const map = getBookingConsumptionMap(String(b.check_in), String(b.check_out), guests);
    totalSetsEstivo += map.get("set letto estivo") ?? 0;
    totalTowelsBidet += map.get("asciugamani bidet") ?? 0;
    totalTowelsDoccia += map.get("asciugamani doccia") ?? 0;
    totalTowelsCorpo += map.get("asciugamani corpo") ?? 0;
  }

  info("Consumo totale TEORICO da tutte le prenotazioni storiche:");
  console.log(`     set letto estivo:    ${totalSetsEstivo}`);
  console.log(`     asciugamani bidet:   ${totalTowelsBidet}`);
  console.log(`     asciugamani doccia:  ${totalTowelsDoccia}`);
  console.log(`     asciugamani corpo:   ${totalTowelsCorpo}`);

  warn("Nota: questo consumo teorico può non corrispondere al DB se le quantità non sono mai state popolate o se ci sono stati reset manuali");
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${BOLD}=== AUDIT DATABASE AIRBNB MANAGER ===${RESET}`);
  console.log(`Data: ${new Date().toLocaleString("it-IT")}`);
  console.log("Modalità: sola lettura — nessuna modifica al DB\n");

  try {
    await auditBookingActions();
    await auditStock();
    await auditExpenses();
    await auditShoppingAction();
    await auditBookingConsumption();
  } catch (e) {
    console.error(`\n${RED}Errore inatteso:${RESET}`, e);
    process.exit(1);
  }

  console.log(`\n${BOLD}=== AUDIT COMPLETATO ===${RESET}\n`);
}

main();
