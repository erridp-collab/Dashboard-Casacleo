import { errJson } from "@/lib/http/apiResponse";
import {
  ForbiddenError,
  UnauthorizedError,
  type OrganizationContext,
  requireOrganizationContext,
} from "@/lib/organizationContext";
import type { TimingEntry } from "@/lib/timing/serverTiming";

export async function requireRouteContext(): Promise<
  { ok: true; context: OrganizationContext; timing: TimingEntry[] } |
  { ok: false; response: Response }
> {
  const timing: TimingEntry[] = [];
  try {
    const context = await requireOrganizationContext(timing);
    return { ok: true, context, timing };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { ok: false, response: errJson("Unauthorized", 401) };
    }
    if (error instanceof ForbiddenError) {
      return { ok: false, response: errJson("Forbidden", 403) };
    }
    console.error("[requireRouteContext]", error);
    return { ok: false, response: errJson("Errore interno del server", 500) };
  }
}
