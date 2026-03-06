import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CHECKLIST_TEMPLATES: Record<string, string[]> = {
  PULIZIA: [
    "Spolvera tutte le superfici",
    "Pulisci bagno e sanitari",
    "Cambia e sistema la biancheria",
    "Controlla e svuota i cestini",
  ],
  LAVATRICI: [
    "Avvia ciclo lenzuola",
    "Avvia ciclo asciugamani",
    "Asciuga e piega i set",
  ],
  MANUT_3: [
    "Controlla porte e finestre",
    "Usa disgorgante doccia",
    "Lava coperte extra",
  ],
  MANUT_4: [
    "Lava piumino",
    "Lava coprimaterasso",
    "Lava copricuscino",
  ],
  MANUTENZIONE: [
    "Verifica luci e prese elettriche",
    "Controlla rubinetti e scarichi",
    "Verifica climatizzazione/riscaldamento",
    "Segnala eventuali danni o anomalie",
  ],
};

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
  const template = CHECKLIST_TEMPLATES[actionType.toUpperCase()];
  if (!template || template.length === 0) return;

  const baseRows = template.map((label, index) => ({
    action_id: actionId,
    done: false,
    sort_order: index + 1,
    label,
  }));
  let insert = await supabase.from("action_checklist").insert(baseRows);
  if (!insert.error) return;
  if (insert.error.code !== "42703") throw new Error(insert.error.message);

  const itemTextRows = template.map((label, index) => ({
    action_id: actionId,
    done: false,
    sort_order: index + 1,
    item_text: label,
  }));
  insert = await supabase.from("action_checklist").insert(itemTextRows);
  if (!insert.error) return;
  if (insert.error.code !== "42703") throw new Error(insert.error.message);

  const itemRows = template.map((label, index) => ({
    action_id: actionId,
    done: false,
    sort_order: index + 1,
    item: label,
  }));
  const last = await supabase.from("action_checklist").insert(itemRows);
  if (last.error) throw new Error(last.error.message);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing action id" }, { status: 400 });

    const supabase = supabaseAdmin();
    let { data, error } = await fetchChecklist(supabase, id);

    if (!error && (data ?? []).length === 0) {
      const { data: actionRow, error: actionErr } = await supabase
        .from("actions")
        .select("action_type")
        .eq("id", id)
        .maybeSingle();
      if (actionErr) return NextResponse.json({ error: actionErr.message }, { status: 400 });
      if (actionRow?.action_type) {
        await seedChecklistFromTemplate(supabase, id, String(actionRow.action_type));
        const retry = await fetchChecklist(supabase, id);
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const checklist = (data ?? []).map((row) => ({
      id: row.id,
      action_id: row.action_id,
      label: row.label ?? row.item_text ?? row.item ?? "Checklist item",
      done: Boolean(row.done),
      sort_order: row.sort_order ?? null,
      created_at: row.created_at ?? null,
    }));
    return NextResponse.json({ checklist }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "SERVER_CRASH", details: String((e as Error)?.message ?? e) },
      { status: 500 },
    );
  }
}
