import { supabaseAdmin } from "@/lib/supabaseAdmin";

type StockProduct = {
  id: string;
  name: string;
  quantity: number;
  threshold: number;
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

function shoppingDetails(products: StockProduct[]): string {
  const rows = products.map((p) => {
    const unit = p.unit ? ` ${p.unit}` : "";
    return `- ${p.name}: ${p.quantity}${unit} (soglia ${p.threshold})`;
  });
  return `Prodotti da reintegrare:\n${rows.join("\n")}`;
}

export async function syncShoppingAction(): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, quantity, threshold, unit")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const products: StockProduct[] = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    quantity: toFixedNumber(row.quantity, 0),
    threshold: toFixedNumber(row.threshold, 0),
    unit: row.unit === null || row.unit === undefined ? null : String(row.unit),
  }));

  const lowStock = products.filter((p) => p.quantity <= p.threshold);
  const { data: existing, error: existingErr } = await supabase
    .from("actions")
    .select("id")
    .eq("action_type", "SPESA")
    .eq("status", "DA_FARE")
    .is("booking_id", null)
    .order("created_at", { ascending: true });

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

  if (existingIds.length === 0) {
    const { error: insertErr } = await supabase.from("actions").insert({
      booking_id: null,
      action_date: today,
      action_type: "SPESA",
      status: "DA_FARE",
      details,
      amount: null,
    });
    if (insertErr) throw new Error(insertErr.message);
    return;
  }

  const primaryId = String(existingIds[0]);
  const { error: updateErr } = await supabase
    .from("actions")
    .update({
      action_date: today,
      details,
    })
    .eq("id", primaryId);
  if (updateErr) throw new Error(updateErr.message);

  if (existingIds.length > 1) {
    const extraIds = existingIds.slice(1);
    const { error: cleanupErr } = await supabase.from("actions").delete().in("id", extraIds);
    if (cleanupErr) throw new Error(cleanupErr.message);
  }
}

export async function applyBookingConsumptions(checkIn: string, checkOut: string, guests: number): Promise<void> {
  const days = bookingDays(checkIn, checkOut);
  if (days <= 0) return;

  const parsedGuests = Number.isFinite(guests) ? guests : 0;
  if (parsedGuests <= 0) return;

  const consumptionByName = new Map<string, number>([
    ["caffe cialde", parsedGuests * days],
    ["carta igienica", Math.ceil(parsedGuests / 2) * days],
    ["spugnette morbide", 1],
    ["spugnette lavapiatti", 1],
  ]);

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("products").select("id, name, quantity");
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const rawName = String(row.name ?? "");
    const normalized = normalizeProductName(rawName);
    const consume = consumptionByName.get(normalized);
    if (!consume || consume <= 0) continue;

    const currentQty = toFixedNumber(row.quantity, 0);
    const nextQty = Number((currentQty - consume).toFixed(2));

    const { error: updateErr } = await supabase
      .from("products")
      .update({ quantity: nextQty })
      .eq("id", row.id);
    if (updateErr) throw new Error(updateErr.message);
  }

  await syncShoppingAction();
}
