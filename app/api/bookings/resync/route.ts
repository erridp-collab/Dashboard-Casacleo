import { errJson, okJson } from "@/lib/http/apiResponse";
import { resyncBookingDomainState } from "@/lib/booking-automation";
import { requireRouteContext } from "@/lib/routeAuth";

export async function POST() {
  try {
    const auth = await requireRouteContext();
    if (!auth.ok) return auth.response;
    await resyncBookingDomainState(auth.context.organizationId);
    return okJson({ ok: true, sync: { mode: "manual", status: "completed" } });
  } catch (error) {
    console.error("[POST /api/bookings/resync]", error);
    return errJson("Re-sync prenotazioni fallito", 500);
  }
}
