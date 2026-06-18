import { getProductId, getProductQuantity, resolveProductSchema } from "@/lib/products-schema";
import { errJson, okJson } from "@/lib/http/apiResponse";
import { requireRouteContext } from "@/lib/routeAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncShoppingAction } from "@/lib/stock";
import { isLinenRole } from "@/lib/linen-roles";

type ProductPatch = {
  id: string;
  quantity?: number;
  threshold?: number;
};

export async function GET() {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);
    const { data, error } = await supabase.from("products").select("*").eq("organization_id", organizationId).order("name", { ascending: true });

    if (error) return errJson(error.message, 400);
    const products = (data ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        id: getProductId(row, schema),
        name: String(row.name ?? ""),
        category: row.category === null || row.category === undefined ? null : String(row.category),
        unit: row.unit === null || row.unit === undefined ? null : String(row.unit),
        quantity: getProductQuantity(row, schema),
        threshold: Number(row.threshold ?? 0) || 0,
        max_qty: row.max_qty === null || row.max_qty === undefined ? null : Number(row.max_qty),
        consumption_per_checkout:
          row.consumption_per_checkout === null || row.consumption_per_checkout === undefined
            ? null
            : Number(row.consumption_per_checkout),
        stock_status: row.stock_status === null || row.stock_status === undefined ? null : row.stock_status,
        linen_role: row.linen_role === null || row.linen_role === undefined ? null : String(row.linen_role),
        updated_at: row.updated_at === null || row.updated_at === undefined ? undefined : String(row.updated_at),
      };
    });
    return okJson({ products });
  } catch (e: unknown) {
    console.error("[GET /api/products]", e);
    return errJson("Errore interno del server", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const body = (await req.json()) as { updates?: ProductPatch[] };
    const updates = body.updates ?? [];

    if (!Array.isArray(updates) || updates.length === 0) {
      return errJson("Missing updates[]", 400);
    }

    const supabase = supabaseAdmin();
    
    const normalized = updates
      .filter((item) => item.quantity !== undefined || item.threshold !== undefined)
      .map((item) => ({
        id: item.id,
        ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
        ...(item.threshold !== undefined ? { threshold: item.threshold } : {}),
      }));

    if (normalized.length > 0) {
      const { error } = await supabase.rpc("bulk_update_products", {
        p_updates: normalized,
        p_organization_id: organizationId,
      });
      if (error) return errJson(error.message, 400);
    }

    await syncShoppingAction(organizationId);

    return okJson({ ok: true });
  } catch (e: unknown) {
    console.error("[PATCH /api/products]", e);
    return errJson("Errore interno del server", 500);
  }
}

type CreateProductBody = {
  name?: unknown;
  category?: unknown;
  unit?: unknown;
  linen_role?: unknown;
  quantity?: unknown;
  threshold?: unknown;
};

function generateSku(name: string): string {
  const slug = String(name)
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${slug}_${Date.now().toString(36)}`;
}

export async function POST(req: Request) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const body = (await req.json()) as CreateProductBody;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return errJson("Il nome del prodotto è obbligatorio", 400);

    const linenRole = body.linen_role ?? null;
    if (linenRole !== null && !isLinenRole(linenRole)) {
      return errJson("Ruolo biancheria non valido", 400);
    }

    const supabase = supabaseAdmin();

    if (linenRole !== null) {
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("linen_role", linenRole)
        .limit(1)
        .maybeSingle();
      if (existing) return errJson("Ruolo già assegnato a un altro prodotto", 409);
    }

    const schema = await resolveProductSchema(supabase);
    const quantity = body.quantity !== undefined && body.quantity !== null
      ? Math.max(0, Number(body.quantity) || 0)
      : 0;
    const threshold = body.threshold !== undefined && body.threshold !== null
      ? Math.max(0, Number(body.threshold) || 0)
      : 0;
    const unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "pz";
    const category = typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : (linenRole ? "Lenzuola e coperte" : "Generale");

    const record: Record<string, unknown> = {
      organization_id: organizationId,
      name,
      category,
      unit,
      threshold,
      linen_role: linenRole,
    };

    record[schema.quantityColumn] = quantity;
    record.max_qty = quantity;

    if (schema.idColumn === "sku") {
      record.sku = generateSku(name);
    }

    const { data: created, error } = await supabase
      .from("products")
      .insert(record)
      .select(`${schema.idColumn}, name, linen_role, category, unit`)
      .single();

    if (error) {
      if (error.code === "23505") return errJson("Prodotto già esistente", 409);
      return errJson(error.message, 400);
    }

    await syncShoppingAction(organizationId);
    return okJson({ product: created }, 201);
  } catch (e: unknown) {
    console.error("[POST /api/products]", e);
    return errJson("Errore interno del server", 500);
  }
}
