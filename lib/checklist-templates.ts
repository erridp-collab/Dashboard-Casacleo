import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_CHECKLIST_TEMPLATES: Record<string, string[]> = {
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

function normalizeActionType(actionType: string): string {
  return String(actionType ?? "").toUpperCase().trim();
}

export async function getChecklistTemplate(
  supabase: SupabaseClient,
  actionType: string,
): Promise<string[]> {
  const normalized = normalizeActionType(actionType);
  const fallback = DEFAULT_CHECKLIST_TEMPLATES[normalized] ?? [];
  if (!normalized) return fallback;

  const { data, error } = await supabase
    .from("action_checklist_templates")
    .select("label, sort_order")
    .eq("action_type", normalized)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return fallback;

  const labels = (data ?? [])
    .map((row) => String(row.label ?? "").trim())
    .filter(Boolean);

  return labels.length > 0 ? labels : fallback;
}
