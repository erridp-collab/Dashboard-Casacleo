import { applyActionStatusEffects } from "@/lib/action-effects";
import { errJson, okJson } from "@/lib/http/apiResponse";
import { requireRouteContext } from "@/lib/routeAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PatchChecklistPayload = {
  id: string;
  done: boolean;
};

export async function PATCH(req: Request) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const body = (await req.json()) as PatchChecklistPayload;
    if (!body.id || typeof body.done !== "boolean") {
      return errJson("Missing id/done", 400);
    }

    const supabase = supabaseAdmin();
    const { data: itemRow, error: findErr } = await supabase
      .from("action_checklist")
      .select("id, action_id")
      .eq("organization_id", organizationId)
      .eq("id", body.id)
      .maybeSingle();
    if (findErr) return errJson(findErr.message, 400);
    if (!itemRow) return errJson("Checklist item not found", 404);

    const { error } = await supabase
      .from("action_checklist")
      .update({ done: body.done })
      .eq("organization_id", organizationId)
      .eq("id", body.id);

    if (error) return errJson(error.message, 400);

    const { data: rows, error: rowsErr } = await supabase
      .from("action_checklist")
      .select("done")
      .eq("organization_id", organizationId)
      .eq("action_id", itemRow.action_id);
    if (rowsErr) return errJson(rowsErr.message, 400);

    const allDone = (rows ?? []).length > 0 && (rows ?? []).every((row) => Boolean(row.done));
    const nextStatus = allDone ? "FATTO" : "DA_FARE";

    const { error: actionErr } = await supabase
      .from("actions")
      .update({ status: nextStatus })
      .eq("organization_id", organizationId)
      .eq("id", itemRow.action_id);
    if (actionErr) return errJson(actionErr.message, 400);

    await applyActionStatusEffects(String(itemRow.action_id), nextStatus, undefined, organizationId);

    return okJson({ ok: true, action_id: String(itemRow.action_id), next_status: nextStatus });
  } catch (e: unknown) {
    console.error("[PATCH /api/actions/checklist]", e);
    return errJson("Errore interno del server", 500);
  }
}
