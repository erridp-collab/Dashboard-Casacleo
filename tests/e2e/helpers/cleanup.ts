import { resolveTestOrgId } from "./session";
import { supabaseTest } from "./fixtures";

const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6h: oltre questa soglia una riga E2E-* è quasi certamente un residuo di una run interrotta, non un test in corso.

/**
 * Playwright globalTeardown: rimuove i dati E2E-* rimasti orfani da una run
 * crashata a metà, sull'organizzazione dell'account personale di test. Non
 * tocca nulla di più recente di 6 ore, per non entrare in conflitto con una
 * run ancora attiva. `products` non ha una colonna `created_at`, va gestito
 * diversamente se/quando una spec inizierà a creare prodotti taggati.
 */
export default async function globalCleanup(): Promise<void> {
  const supabase = supabaseTest();
  const orgId = await resolveTestOrgId();
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("organization_id", orgId)
    .ilike("notes", "E2E-%")
    .lt("created_at", cutoff);
  if (!error && bookings && bookings.length > 0) {
    const ids = bookings.map((b) => String(b.id));
    const { data: actions } = await supabase.from("actions").select("id").in("booking_id", ids);
    const actionIds = (actions ?? []).map((a) => String(a.id));
    if (actionIds.length > 0) {
      await supabase.from("action_checklist").delete().in("action_id", actionIds);
      await supabase.from("actions").delete().in("id", actionIds);
    }
    await supabase.from("bookings").delete().in("id", ids);
  }

  // Le azioni MANUTENZIONE create da CleaningModal non hanno booking_id
  // collegato (verificato il 2026-08-20): eliminare la prenotazione non le
  // ripulisce, quindi vanno raccolte separatamente per `details`.
  const { data: strayActions, error: actionsError } = await supabase
    .from("actions")
    .select("id")
    .eq("organization_id", orgId)
    .ilike("details", "E2E-%")
    .lt("created_at", cutoff);
  if (!actionsError && strayActions && strayActions.length > 0) {
    const strayIds = strayActions.map((a) => String(a.id));
    await supabase.from("action_checklist").delete().in("action_id", strayIds);
    await supabase.from("actions").delete().in("id", strayIds);
  }
}
