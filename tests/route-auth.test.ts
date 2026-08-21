import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ForbiddenError,
  UnauthorizedError,
  requireOrganizationContext,
} from "@/lib/organizationContext";
import { requireRouteContext } from "@/lib/routeAuth";

vi.mock("@/lib/organizationContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/organizationContext")>();
  return {
    ...actual,
    requireOrganizationContext: vi.fn(),
  };
});

const requireOrganizationContextMock = vi.mocked(requireOrganizationContext);

describe("requireRouteContext", () => {
  beforeEach(() => {
    requireOrganizationContextMock.mockReset();
  });

  it("returns 401 when the session cannot be authenticated", async () => {
    requireOrganizationContextMock.mockRejectedValue(new UnauthorizedError("Unauthorized"));

    const result = await requireRouteContext();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected an unauthorized response");
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 403 when the user has no organization membership", async () => {
    requireOrganizationContextMock.mockRejectedValue(new ForbiddenError("Forbidden"));

    const result = await requireRouteContext();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a forbidden response");
    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("returns only the server-verified organization context", async () => {
    const context = {
      organizationId: "org-verified",
      role: "owner" as const,
      userId: "user-verified",
      email: "owner@example.com",
    };
    requireOrganizationContextMock.mockResolvedValue(context);

    const result = await requireRouteContext();

    expect(result).toEqual({ ok: true, context, timing: [] });
  });
});
