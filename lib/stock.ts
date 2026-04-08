import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getProductId, getProductQuantity, resolveProductSchema } from "@/lib/products-schema";

type StockProduct = {
  id: string;
  name: string;
  category?: string | null;
  quantity: number;
  threshold: number;
  consumption_per_checkout?: number;
  unit: string | null;
};

function normalizeProductName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function toFixedNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function bookingDays(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 0;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function getBookingConsumptionMap(checkIn: string, checkOut: string, guests: number): Map<string, number> {
  const days = bookingDays(checkIn, checkOut);
  const parsedGuests = Number.isFinite(guests) ? guests : 0;
  const consumptions = new Map<string, number>();

  if (days <= 0 || parsedGuests <= 0) return consumptions;

  consumptions.set("caffe cialde", parsedGuests * days);
  consumptions.set("carta igienica", Math.ceil(parsedGuests / 2) * days);
  consumptions.set("spugnette morbide", 1);
  consumptions.set("spugnette lavapiatti", 1);

  // Linen rule per checkout: every 2 guests consume 1 set.
  // 1 set = 2 towels per type + 1 full bed set.
  const setCount = Math.ceil(parsedGuests / 2);
  consumptions.set("asciugamani bidet", setCount * 2);
  consumptions.set("asciugamani doccia", setCount * 2);
  consumptions.set("asciugamani corpo", setCount * 2);
  consumptions.set("set letto estivo", setCount);

  return consumptions;
}

function shoppingDetails(products: StockProduct[]): string {
  const rows = products.map((p) => {
    const unit = p.unit ? ` ${p.unit}` : "";
    return `- ${p.name}: ${p.quantity}${unit} (soglia ${p.threshold})`;
  });
  return `Prodotti da reintegrare:\n${rows.join("\n")}`;
}

export function shouldIncludeInShoppingList(product: Pick<StockProduct, "name" | "unit"> & { category?: string | null }): boolean {
  const category = String(product.category ?? "").toUpperCase();
  const name = String(product.name ?? "").toUpperCase();

  if (name === "LENZUOLO SOTTO EXTRA") {
    return false;
  }

  // Biancheria/tessili are managed by LAVATRICI flow, not SPESA.
  if (
    category === "ASCIUGAMANI E BAGNO" ||
    category === "LENZUOLA E COPERTE" ||
    category === "TESSILI E BIANCHERIA"
  ) {
    return false;
  }
  if (
    name.includes("ASCIUGAMANI") ||
    name.includes("LENZUO") ||
    name.includes("FEDER") ||
    name.includes("COPRIPIUM") ||
    name.includes("TAPPETINI") ||
    name.includes("PIUMINO")
  ) {
    return false;
  }

  return true;
}

async function upsertShoppingAction(
  existingIds: string[],
  today: string,
  details: string,
): Promise<void> {
  const supabase = supabaseAdmin();

  if (existingIds.length === 0) {
    const payloadVariants: Record<string, unknown>[] = [
      {
        booking_id: null,
        action_date: today,
        action_type: "SPESA",
        status: "DA_FARE",
        details,
        amount: 0,
      },
      {
        booking_id: null,
        action_date: today,
        action_type: "SPESA",
        status: "DA_FARE",
        details,
      },
      {
        action_date: today,
        action_type: "SPESA",
        status: "DA_FARE",
        details,
      },
      {
        action_date: today,
        action_type: "SPESA",
        status: "DA_FARE",
      },
    ];

    let lastError = "";
    for (const payload of payloadVariants) {
      const insertErr = await supabase.from("actions").insert(payload);
      if (!insertErr.error) return;
      lastError = insertErr.error.message;
    }
    throw new Error(lastError || "Unable to create SPESA action");
  }

  const primaryId = String(existingIds[0]);
  const updateVariants: Record<string, unknown>[] = [
    { action_date: today, details },
    { action_date: today },
    { details },
  ];

  let updated = false;
  for (const payload of updateVariants) {
    const updateErr = await supabase
      .from("actions")
      .update(payload)
      .eq("id", primaryId);
    if (!updateErr.error) {
      updated = true;
      break;
    }
  }
  if (!updated) throw new Error("Unable to update existing SPESA action");

  if (existingIds.length > 1) {
    const extraIds = existingIds.slice(1);
    const { error: cleanupErr } = await supabase.from("actions").delete().in("id", extraIds);
    if (cleanupErr) throw new Error(cleanupErr.message);
  }
}

export async function syncShoppingAction(): Promise<void> {
  const supabase = supabaseAdmin();
  const schema = await resolveProductSchema(supabase);

  const { data, error } = await supabase
    .from("products")
    .select(`${schema.idColumn}, name, category, ${schema.quantityColumn}, threshold, unit`)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const products: StockProduct[] = (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: getProductId(row, schema),
      name: String(row.name ?? ""),
      quantity: getProductQuantity(row, schema),
      threshold: toFixedNumber(row.threshold, 0),
      unit: row.unit === null || row.unit === undefined ? null : String(row.unit),
      category: row.category === null || row.category === undefined ? null : String(row.category),
    };
  });

  const lowStock = products.filter((p) => p.quantity <= p.threshold && shouldIncludeInShoppingList(p));
  let { data: existing, error: existingErr } = await supabase
    .from("actions")
    .select("id")
    .eq("action_type", "SPESA")
    .eq("status", "DA_FARE")
    .is("booking_id", null)
    .order("created_at", { ascending: true });

  // Backward-compatible fallback when actions.created_at is not present.
  if (existingErr?.code === "42703" && String(existingErr.message ?? "").includes("created_at")) {
    const retry = await supabase
      .from("actions")
      .select("id")
      .eq("action_type", "SPESA")
      .eq("status", "DA_FARE")
      .is("booking_id", null);
    existing = retry.data;
    existingErr = retry.error;
  }

  if (existingErr) throw new Error(existingErr.message);

  const existingIds = (existing ?? []).map((a) => a.id).filter(Boolean);

  if (lowStock.length === 0) {
    if (existingIds.length > 0) {
      const { error: deleteErr } = await supabase.from("actions").delete().in("id", existingIds);
      if (deleteErr) throw new Error(deleteErr.message);
    }
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const details = shoppingDetails(lowStock);
  await upsertShoppingAction(existingIds, today, details);
}

export async function applyBookingConsumptions(checkIn: string, checkOut: string, guests: number): Promise<void> {
  await applyBookingConsumptionDelta(checkIn, checkOut, guests, 1);
}

export async function applyBookingConsumptionDelta(
  checkIn: string,
  checkOut: string,
  guests: number,
  direction: 1 | -1,
): Promise<void> {
  const consumptionByName = getBookingConsumptionMap(checkIn, checkOut, guests);

  const supabase = supabaseAdmin();
  const schema = await resolveProductSchema(supabase);
  const { data, error } = await supabase
    .from("products")
    .select(`${schema.idColumn}, name, ${schema.quantityColumn}, consumption_per_checkout`);
  if (error) throw new Error(error.message);

  // Build all updates first, then fire them in parallel.
  const updates: Array<{ id: string; nextQty: number }> = [];
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const rawName = String(row.name ?? "");
    const normalized = normalizeProductName(rawName);
    const fixedConsume = consumptionByName.get(normalized) ?? 0;
    const perCheckoutConsume = toFixedNumber(row.consumption_per_checkout, 0);
    const consume = fixedConsume + Math.max(0, perCheckoutConsume);
    if (consume <= 0) continue;

    const productId = getProductId(row, schema);
    if (!productId) continue;

    const currentQty = getProductQuantity(row, schema);
    const nextQty = Number((currentQty - consume * direction).toFixed(2));
    updates.push({ id: productId, nextQty });
  }

  await Promise.all(
    updates.map(({ id, nextQty }) =>
      supabase
        .from("products")
        .update({ [schema.quantityColumn]: nextQty })
        .eq(schema.idColumn, id)
        .then(({ error: updateErr }) => {
          if (updateErr) throw new Error(updateErr.message);
        }),
    ),
  );

  await syncShoppingAction();
}
