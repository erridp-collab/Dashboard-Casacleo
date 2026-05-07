import { errJson } from "@/lib/http/apiResponse";
import {
  ForbiddenError,
  UnauthorizedError,
  type OrganizationContext,
  requireOrganizationContext,
} from "@/lib/organizationContext";

export async function requireRouteContext(): Promise<
  { ok: true; context: OrganizationContext } |
  { ok: false; response: Response }
> {
  try {
    const context = await requireOrganizationContext();
    return { ok: true, context };
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
