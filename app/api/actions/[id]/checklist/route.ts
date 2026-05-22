import { getChecklistTemplate } from "@/lib/checklist-templates";
import { errJson, okJson } from "@/lib/http/apiResponse";
import { requireRouteContext } from "@/lib/routeAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function fetchChecklist(supabase: ReturnType<typeof supabaseAdmin>, actionId: string, organizationId: string) {
  return await supabase
    .from("action_checklist")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("action_id", actionId)
    .order("created_at", { ascending: true });
}

async function seedChecklistFromTemplate(
  supabase: ReturnType<typeof supabaseAdmin>,
  actionId: string,
  actionType: string,
  organizationId: string,
) {
  const template = await getChecklistTemplate(supabase, actionType);
  if (!template || template.length === 0) return;

  const rows = template.map((label) => ({
    organization_id: organizationId,
    action_id: actionId,
    done: false,
    item: label,
  }));

  const { error } = await supabase.from("action_checklist").insert(rows);
  if (error) throw new Error(error.message || "Unable to seed checklist template");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    const { organizationId } = auth.context;

    const { id } = await params;
    if (!id) return errJson("Missing action id", 400);

    const supabase = supabaseAdmin();
    let { data, error } = await fetchChecklist(supabase, id, organizationId);

    if (!error && (data ?? []).length === 0) {
      const { data: actionRow, error: actionErr } = await supabase
        .from("actions")
        .select("action_type")
        .eq("organization_id", organizationId)
        .eq("id", id)
        .maybeSingle();
      if (actionErr) return errJson(actionErr.message, 400);
      if (actionRow?.action_type) {
        try {
          await seedChecklistFromTemplate(supabase, id, String(actionRow.action_type), organizationId);
        } catch (seedErr: unknown) {
          return errJson("CHECKLIST_TEMPLATE_SEED_FAILED", 400, {
            details: String((seedErr as Error)?.message ?? seedErr),
          });
        }
        const retry = await fetchChecklist(supabase, id, organizationId);
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) return errJson(error.message, 400);
    const checklist = (data ?? []).map((row) => ({
      id: row.id,
      action_id: row.action_id,
      label: row.item ?? "Checklist item",
      done: Boolean(row.done),
      sort_order: null,
      created_at: row.created_at ?? null,
    }));
    return okJson({ checklist });
  } catch (e: unknown) {
    console.error("[GET /api/actions/[id]/checklist]", e);
    return errJson("Errore interno del server", 500);
  }
}
