import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCleaningReminder } from "@/lib/email/resend";
import { addDaysLocalIT, todayLocalIT } from "@/lib/localDate";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Sicurezza di base per chiamate cron: richiediamo un token segreto
    const secret = searchParams.get("secret");
    if (secret !== process.env.APP_PASSWORD && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Default: cerchiamo le pulizie di domani (o "oggi" se passato come parametro)
    const dayOffset = Number(searchParams.get("daysAhead") ?? 1);
    const targetDate = addDaysLocalIT(todayLocalIT(), dayOffset);

    // Usiamo il client Supabase con Service Role per aggirare RLS (visto che siamo un job di sistema)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

    // 1. Troviamo tutte le azioni di pulizia previste per quella data
    const { data: actions, error: actionsError } = await supabaseAdmin
      .from("actions")
      .select(`
        id, 
        action_type, 
        action_date, 
        status, 
        organization_id,
        booking:bookings (
          check_out,
          guests
        )
      `)
      .eq("action_date", targetDate)
      .ilike("action_type", "%pulizia%")
      .neq("status", "FATTO");

    if (actionsError) throw actionsError;

    if (!actions || actions.length === 0) {
      return NextResponse.json({ message: `Nessuna pulizia programmata per il ${targetDate}` });
    }

    // 2. Raggruppiamo le azioni per organizzazione
    const orgActions: Record<string, typeof actions> = {};
    for (const a of actions) {
      if (!orgActions[a.organization_id]) orgActions[a.organization_id] = [];
      orgActions[a.organization_id].push(a);
    }

    // 3. Inviamo una mail per ogni organizzazione ai propri "owner" o "staff"
    let sentCount = 0;

    for (const [orgId, orgActionList] of Object.entries(orgActions)) {
      // Troviamo l'email del destinatario (es. l'owner dell'organizzazione)
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .eq("organization_id", orgId)
        .eq("role", "owner")
        .limit(1)
        .single();

      if (!roles) continue;

      // Recuperiamo la mail dell'utente tramite auth.users (necessita permessi admin)
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(roles.user_id);
      const email = userData?.user?.email;
      
      if (!email) continue;

      // Costruiamo la lista HTML
      const htmlList = orgActionList.map(a => {
        const guests = a.booking && Array.isArray(a.booking) ? a.booking[0]?.guests : (a.booking as { guests?: number })?.guests;
        return `<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e4e4e7;">
          <strong style="color:#701a2f;font-size:16px;">${a.action_type}</strong><br/>
          <span style="font-size:14px;color:#71717a;">Ospiti uscenti: ${guests || '?' } - Stato: Da Fare</span>
        </div>`;
      }).join("");

      await sendCleaningReminder({
        to: email,
        hostName: "Host", // Potremmo recuperare il nome dall'org
        date: targetDate,
        cleaningActionsHtml: htmlList
      });

      sentCount++;
    }

    return NextResponse.json({ 
      success: true, 
      date: targetDate, 
      emailsSent: sentCount,
      actionsFound: actions.length
    });

  } catch (err: unknown) {
    console.error("Cron Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
