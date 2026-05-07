import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getChecklistTemplate } from "@/lib/checklist-templates";
import { parseLocalDateIT } from "@/lib/localDate";
import { resolveOrganizationId } from "@/lib/organizationContext";
import { syncShoppingAction } from "@/lib/stock";

type BookingRow = {
  id: string;
  check_in: string;
  check_out: string;
};

type DesiredAction = {
  booking_id: string;
  action_date: string;
  action_type: string;
  status: "DA_FARE";
  details: string | null;
};

const MANAGED_ACTION_TYPES = ["PULIZIA", "PREPARA_LETTO", "BIANCHERIA", "LAVATRICI", "MANUT_3", "MANUT_4", "MANUTENZIONE"];
const ASYNC_RESYNC_RETRIES = 2;
const ASYNC_RESYNC_RETRY_DELAY_MS = 250;

function daysBetween(fromDate: string, toDate: string): number {
  const from = parseLocalDateIT(fromDate);
  const to = parseLocalDateIT(toDate);
  if (!from || !to) return 0;
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function actionKey(action: { booking_id: string | null; action_type: string; action_date: string }): string {
  return `${action.booking_id ?? ""}|${action.action_type}|${action.action_date}`;
}

async function ensureChecklist(actionId: string, actionType: string, organizationId?: string): Promise<void> {
  const supabase = supabaseAdmin();
  const checklist = await getChecklistTemplate(supabase, actionType);
  if (!checklist || checklist.length === 0) return;

  let existingQuery = supabase
    .from("action_checklist")
    .select("id")
    .eq("action_id", actionId);
  if (organizationId) existingQuery = existingQuery.eq("organization_id", organizationId);

  const { data: existingRows, error: existingErr } = await existingQuery;

  if (existingErr) throw new Error(existingErr.message);
  if ((existingRows ?? []).length > 0) return;

  const variants: Record<string, unknown>[][] = [
    checklist.map((label, index) => ({ action_id: actionId, done: false, sort_order: index + 1, label })),
    checklist.map((label) => ({ action_id: actionId, done: false, label })),
    checklist.map((label, index) => ({ action_id: actionId, done: false, sort_order: index + 1, item_text: label })),
    checklist.map((label) => ({ action_id: actionId, done: false, item_text: label })),
    checklist.map((label, index) => ({ action_id: actionId, done: false, sort_order: index + 1, item: label })),
    checklist.map((label) => ({ action_id: actionId, done: false, item: label })),
  ];

  let lastError = "";
  for (const rows of variants) {
    const insert = await supabase.from("action_checklist").insert(rows);
    if (!insert.error) return;
    lastError = insert.error.message;
  }
  throw new Error(lastError || "Unable to seed action checklist");
}

export function computeDesiredActions(bookings: BookingRow[]): DesiredAction[] {
  const desired: DesiredAction[] = [];
  let prevCheckOut: string | null = null;

  for (let i = 0; i < bookings.length; i += 1) {
    const booking = bookings[i];
    const stayIndex = i + 1;

    desired.push({
      booking_id: booking.id,
      action_date: booking.check_out,
      action_type: "PULIZIA",
      status: "DA_FARE",
      details: null,
    });

    desired.push({
      booking_id: booking.id,
      action_date: booking.check_out,
      action_type: "BIANCHERIA",
      status: "DA_FARE",
      details: "Cambio biancheria consigliato",
    });

    if (prevCheckOut && daysBetween(prevCheckOut, booking.check_in) > 3) {
      desired.push({
        booking_id: booking.id,
        action_date: booking.check_in,
        action_type: "PREPARA_LETTO",
        status: "DA_FARE",
        details: "Preparare letto dopo periodo senza ospiti",
      });
    }

    if (stayIndex % 3 === 0) {
      desired.push({
        booking_id: booking.id,
        action_date: booking.check_out,
        action_type: "LAVATRICI",
        status: "DA_FARE",
        details: null,
      });
      desired.push({
        booking_id: booking.id,
        action_date: booking.check_out,
        action_type: "MANUT_3",
        status: "DA_FARE",
        details: null,
      });
    }

    if (stayIndex % 4 === 0) {
      desired.push({
        booking_id: booking.id,
        action_date: booking.check_out,
        action_type: "MANUT_4",
        status: "DA_FARE",
        details: null,
      });
    }

    prevCheckOut = booking.check_out;
  }

  return desired;
}

export async function syncBookingAutomations(organizationId?: string): Promise<void> {
  const supabase = supabaseAdmin();
  const resolvedOrganizationId = await resolveOrganizationId(organizationId);
  if (!resolvedOrganizationId) throw new Error("Unable to resolve organization");

  const { data: bookingsData, error: bookingsErr } = await supabase
    .from("bookings")
    .select("id, check_in, check_out")
    .eq("organization_id", resolvedOrganizationId)
    .order("check_out", { ascending: true });

  if (bookingsErr) throw new Error(bookingsErr.message);

  const bookings = (bookingsData ?? []).map((b) => ({
    id: String(b.id),
    check_in: String(b.check_in),
    check_out: String(b.check_out),
  }));

  const desired = computeDesiredActions(bookings);
  const desiredMap = new Map(desired.map((a) => [actionKey(a), a]));

  const { data: existingData, error: existingErr } = await supabase
    .from("actions")
    .select("id, booking_id, action_type, action_date")
    .eq("organization_id", resolvedOrganizationId)
    .not("booking_id", "is", null)
    .in("action_type", MANAGED_ACTION_TYPES);

  if (existingErr) throw new Error(existingErr.message);

  const existing = (existingData ?? []).map((a) => ({
    id: String(a.id),
    booking_id: a.booking_id ? String(a.booking_id) : null,
    action_type: String(a.action_type),
    action_date: String(a.action_date),
  }));
  const existingMap = new Map(existing.map((a) => [actionKey(a), a]));

  const toCreate = desired.filter((a) => !existingMap.has(actionKey(a)));
  const toDelete = existing.filter((a) => !desiredMap.has(actionKey(a)));

  // Delete obsolete actions: checklist first (FK), then action — all in parallel.
  await Promise.all(
    toDelete.map(async (row) => {
      const { error: checklistErr } = await supabase.from("action_checklist").delete().eq("action_id", row.id);
      if (checklistErr) throw new Error(checklistErr.message);
      const { error: actionErr } = await supabase.from("actions").delete().eq("organization_id", resolvedOrganizationId).eq("id", row.id);
      if (actionErr) throw new Error(actionErr.message);
    }),
  );

  // Create new actions in parallel, then seed their checklists in parallel.
  const createdIds = await Promise.all(
    toCreate.map(async (row) => {
      const { data: created, error: createErr } = await supabase
        .from("actions")
        .insert({ ...row, organization_id: resolvedOrganizationId })
        .select("id")
        .single();
      if (createErr) throw new Error(createErr.message);
      return { id: String(created.id), action_type: row.action_type };
    }),
  );
  await Promise.all(createdIds.map(({ id, action_type }) => ensureChecklist(id, action_type, resolvedOrganizationId)));

  // Ensure checklist also for pre-existing managed actions.
  const merged = [...existing.filter((a) => desiredMap.has(actionKey(a))), ...toCreate.map((a) => ({
    id: "",
    booking_id: a.booking_id,
    action_type: a.action_type,
    action_date: a.action_date,
  }))];

  if (merged.length > 0) {
    const { data: refreshed, error: refreshErr } = await supabase
      .from("actions")
      .select("id, action_type, booking_id, action_date")
      .eq("organization_id", resolvedOrganizationId)
      .not("booking_id", "is", null)
      .in("action_type", ["PULIZIA", "LAVATRICI", "MANUT_3", "MANUT_4"]);
    if (refreshErr) throw new Error(refreshErr.message);
    await Promise.all((refreshed ?? []).map((row) => ensureChecklist(String(row.id), String(row.action_type), resolvedOrganizationId)));
  }
}

export async function resyncBookingDomainState(organizationId?: string): Promise<void> {
  const resolvedOrganizationId = await resolveOrganizationId(organizationId);
  if (!resolvedOrganizationId) throw new Error("Unable to resolve organization");
  await syncBookingAutomations(resolvedOrganizationId);
  await syncShoppingAction(resolvedOrganizationId);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function scheduleBookingDomainResync(
  source: string,
  metadata?: Record<string, string>,
  organizationId?: string,
): void {
  void (async () => {
    for (let attempt = 1; attempt <= ASYNC_RESYNC_RETRIES; attempt += 1) {
      try {
        await resyncBookingDomainState(organizationId);
        console.info("[booking-resync] completed", { source, attempt, ...(metadata ?? {}) });
        return;
      } catch (error) {
        const isLastAttempt = attempt === ASYNC_RESYNC_RETRIES;
        console.error("[booking-resync] failed", {
          source,
          attempt,
          willRetry: !isLastAttempt,
          ...(metadata ?? {}),
          error,
        });
        if (isLastAttempt) return;
        await wait(ASYNC_RESYNC_RETRY_DELAY_MS * attempt);
      }
    }
  })();
}
