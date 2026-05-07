import { getChecklistTemplate } from "@/lib/checklist-templates";
import { errJson, okJson } from "@/lib/http/apiResponse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function fetchChecklist(supabase: ReturnType<typeof supabaseAdmin>, actionId: string) {
  let { data, error } = await supabase
    .from("action_checklist")
    .select("*")
    .eq("action_id", actionId)
    .order("sort_order", { ascending: true });

  if (error?.code === "42703" && error.message.includes("sort_order")) {
    const retry = await supabase
      .from("action_checklist")
      .select("*")
      .eq("action_id", actionId);
    data = retry.data;
    error = retry.error;
  }

  return { data, error };
}

async function seedChecklistFromTemplate(
  supabase: ReturnType<typeof supabaseAdmin>,
  actionId: string,
  actionType: string,
) {
  const template = await getChecklistTemplate(supabase, actionType);
  if (!template || template.length === 0) return;

  const variants: Record<string, unknown>[][] = [
    template.map((label, index) => ({ action_id: actionId, done: false, sort_order: index + 1, label })),
    template.map((label) => ({ action_id: actionId, done: false, label })),
    template.map((label, index) => ({ action_id: actionId, done: false, sort_order: index + 1, item_text: label })),
    template.map((label) => ({ action_id: actionId, done: false, item_text: label })),
    template.map((label, index) => ({ action_id: actionId, done: false, sort_order: index + 1, item: label })),
    template.map((label) => ({ action_id: actionId, done: false, item: label })),
  ];

  let lastError = "";
  for (const rows of variants) {
    const insert = await supabase.from("action_checklist").insert(rows);
    if (!insert.error) return;
    lastError = insert.error.message;
  }

  throw new Error(lastError || "Unable to seed checklist template");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return errJson("Missing action id", 400);

    const supabase = supabaseAdmin();
    let { data, error } = await fetchChecklist(supabase, id);

    if (!error && (data ?? []).length === 0) {
      const { data: actionRow, error: actionErr } = await supabase
        .from("actions")
        .select("action_type")
        .eq("id", id)
        .maybeSingle();
      if (actionErr) return errJson(actionErr.message, 400);
      if (actionRow?.action_type) {
        try {
          await seedChecklistFromTemplate(supabase, id, String(actionRow.action_type));
        } catch (seedErr: unknown) {
          return errJson("CHECKLIST_TEMPLATE_SEED_FAILED", 400, {
            details: String((seedErr as Error)?.message ?? seedErr),
          });
        }
        const retry = await fetchChecklist(supabase, id);
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) return errJson(error.message, 400);
    const checklist = (data ?? []).map((row) => ({
      id: row.id,
      action_id: row.action_id,
      label: row.label ?? row.item_text ?? row.item ?? "Checklist item",
      done: Boolean(row.done),
      sort_order: row.sort_order ?? null,
      created_at: row.created_at ?? null,
    }));
    return okJson({ checklist });
  } catch (e: unknown) {
    console.error("[GET /api/actions/[id]/checklist]", e);
    return errJson("Errore interno del server", 500);
  }
}
