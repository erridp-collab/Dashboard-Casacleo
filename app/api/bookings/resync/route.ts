import { errJson, okJson } from "@/lib/http/apiResponse";
import { resyncBookingDomainState } from "@/lib/booking-automation";

export async function POST() {
  try {
    await resyncBookingDomainState();
    return okJson({ ok: true, sync: { mode: "manual", status: "completed" } });
  } catch (error) {
    console.error("[POST /api/bookings/resync]", error);
    return errJson("Re-sync prenotazioni fallito", 500);
  }
}
