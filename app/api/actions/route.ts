import { applyActionStatusEffects, type CleaningCompletion } from "@/lib/action-effects";
import { errJson, okJson } from "@/lib/http/apiResponse";
import { requireRouteContext } from "@/lib/routeAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ActionStatus } from "@/types/db";

type PatchActionPayload =
  | { id: string; status: ActionStatus; completion?: CleaningCompletion }
  | { date: string; status?: ActionStatus; onlyPending?: boolean };

type PostActionPayload = {
  action_type: string;
  action_date: string;
  details?: string;
  status?: ActionStatus;
  booking_id?: string | null;
};

export async function POST(req: Request) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const body = (await req.json()) as PostActionPayload;
    if (!body.action_type || !body.action_date) {
      return errJson("Missing action_type or action_date", 400);
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("actions")
      .insert({
        organization_id: organizationId,
        action_type: body.action_type,
        action_date: body.action_date,
        details: body.details ?? null,
        status: body.status ?? "DA_FARE",
        booking_id: body.booking_id ?? null,
      })
      .select("id")
      .single();

    if (error) return errJson(error.message, 400);
    return okJson({ ok: true, id: data?.id }, 201);
  } catch (e: unknown) {
    console.error("[POST /api/actions]", e);
    return errJson("Errore interno del server", 500);
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const bookingId = searchParams.get("bookingId");

    const supabase = supabaseAdmin();
    let q = supabase
      .from("actions")
      .select("id, booking_id, action_date, action_type, status, details, amount")
      .eq("organization_id", organizationId)
      .order("action_date", { ascending: true });

    if (from) q = q.gte("action_date", from);
    if (to) q = q.lte("action_date", to);
    if (bookingId) q = q.eq("booking_id", bookingId);

    let { data, error } = await q;

    if (error && String(error.code) === "42703") {
      let retryQ = supabase
        .from("actions")
        .select("id, booking_id, action_date, action_type, status, details")
        .eq("organization_id", organizationId)
        .order("action_date", { ascending: true });
      if (from) retryQ = retryQ.gte("action_date", from);
      if (to) retryQ = retryQ.lte("action_date", to);
      if (bookingId) retryQ = retryQ.eq("booking_id", bookingId);
      const retry = await retryQ;
      data = (retry.data ?? []).map((row: Record<string, unknown>) => ({ ...row, amount: null })) as typeof data;
      error = retry.error;
    }

    if (error) return errJson(error.message, 400);
    return okJson({ actions: data ?? [] });
  } catch (e: unknown) {
    console.error("[GET /api/actions]", e);
    return errJson("Errore interno del server", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const body = (await req.json()) as PatchActionPayload;
    const supabase = supabaseAdmin();

    if ("id" in body) {
      if (!body.id || !body.status) {
        return errJson("Missing id/status", 400);
      }

      const patch: Record<string, unknown> = { status: body.status };
      const completedAmount = Number(body.completion?.amount ?? NaN);
      if (Number.isFinite(completedAmount) && completedAmount > 0) {
        patch.amount = completedAmount;
      }

      if (body.completion?.linen || body.completion?.laundry) {
        const { data: actionRow, error: actionErr } = await supabase
          .from("actions")
          .select("id, action_type")
          .eq("organization_id", organizationId)
          .eq("id", body.id)
          .maybeSingle();
        if (actionErr) return errJson(actionErr.message, 400);

        const actionType = String(actionRow?.action_type ?? "").toUpperCase();
        if (actionRow && actionType.includes("BIANCHERIA") && body.completion?.linen) {
          patch.details = JSON.stringify({ linen: body.completion.linen });
        }
        if (actionRow && actionType.includes("LAVATRICI") && body.completion?.laundry) {
          patch.details = JSON.stringify({ laundry: body.completion.laundry });
        }
      }

      // Side effects PRIMA dell'update DB: se falliscono, l'action non viene modificata.
      try {
        await applyActionStatusEffects(body.id, body.status, body.completion, organizationId);
      } catch (sideEffectErr: unknown) {
        console.error("applyActionStatusEffects failed", sideEffectErr);
        return errJson("Effetti collaterali falliti (inventario/spese). Stato azione non modificato.", 500);
      }

      const { error } = await supabase.from("actions").update(patch).eq("organization_id", organizationId).eq("id", body.id);
      if (error) return errJson(error.message, 400);

      return okJson({ ok: true });
    }

    if (!body.date) {
      return errJson("Missing date", 400);
    }

    let updateQuery = supabase
      .from("actions")
      .update({ status: body.status ?? "FATTO" })
      .eq("organization_id", organizationId)
      .eq("action_date", body.date);

    if (body.onlyPending !== false) {
      updateQuery = updateQuery.eq("status", "DA_FARE");
    }

    const { error } = await updateQuery;
    if (error) return errJson(error.message, 400);

    return okJson({ ok: true });
  } catch (e: unknown) {
    console.error("[PATCH /api/actions]", e);
    return errJson("Errore interno del server", 500);
  }
}
