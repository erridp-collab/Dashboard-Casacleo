// app/api/products/[id]/route.ts
import { errJson, okJson } from "@/lib/http/apiResponse";
import { isLinenRole } from "@/lib/linen-roles";
import { requireRouteContext } from "@/lib/routeAuth";
import { resolveProductSchema } from "@/lib/products-schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncShoppingAction } from "@/lib/stock";

type PatchProductBody = {
  name?: unknown;
  category?: unknown;
  unit?: unknown;
  linen_role?: unknown;
  threshold?: unknown;
  max_qty?: unknown;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const { id } = await params;
    if (!id) return errJson("Missing product id", 400);

    const body = (await req.json()) as PatchProductBody;
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return errJson("Il nome non può essere vuoto", 400);
      updates.name = name;
    }

    if (body.category !== undefined) {
      updates.category = typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : null;
    }

    if (body.unit !== undefined) {
      updates.unit = typeof body.unit === "string" && body.unit.trim()
        ? body.unit.trim()
        : null;
    }

    if ("linen_role" in body) {
      const role = body.linen_role;
      if (role !== null && role !== undefined && !isLinenRole(role)) {
        return errJson("Ruolo biancheria non valido", 400);
      }
      updates.linen_role = role ?? null;
    }

    if (body.threshold !== undefined) {
      const t = Number(body.threshold);
      if (!Number.isFinite(t) || t < 0) return errJson("Soglia non valida", 400);
      updates.threshold = t;
    }

    if (body.max_qty !== undefined) {
      const m = Number(body.max_qty);
      if (!Number.isFinite(m) || m < 0) return errJson("max_qty non valido", 400);
      updates.max_qty = m;
    }

    if (Object.keys(updates).length === 0) return errJson("Nessun campo da aggiornare", 400);

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);

    if ("linen_role" in updates && updates.linen_role !== null) {
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("linen_role", updates.linen_role as string)
        .neq(schema.idColumn, id)
        .limit(1)
        .maybeSingle();
      if (existing) return errJson("Ruolo già assegnato a un altro prodotto", 409);
    }

    const { error } = await supabase
      .from("products")
      .update(updates)
      .eq("organization_id", organizationId)
      .eq(schema.idColumn, id);

    if (error) return errJson(error.message, 400);

    await syncShoppingAction(organizationId);
    return okJson({ ok: true });
  } catch (e: unknown) {
    console.error("[PATCH /api/products/[id]]", e);
    return errJson("Errore interno del server", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const { id } = await params;
    if (!id) return errJson("Missing product id", 400);

    const supabase = supabaseAdmin();
    const schema = await resolveProductSchema(supabase);

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("organization_id", organizationId)
      .eq(schema.idColumn, id);

    if (error) return errJson(error.message, 400);

    await syncShoppingAction(organizationId);
    return okJson({ ok: true });
  } catch (e: unknown) {
    console.error("[DELETE /api/products/[id]]", e);
    return errJson("Errore interno del server", 500);
  }
}
