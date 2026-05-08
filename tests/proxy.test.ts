import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("proxy auth enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 for API requests without auth cookie", async () => {
    const { proxy } = await import("../proxy");
    const response = await proxy(new NextRequest("http://localhost/api/bookings"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("redirects protected pages to /login without auth cookie", async () => {
    const { proxy } = await import("../proxy");
    const response = await proxy(new NextRequest("http://localhost/bookings"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("redirects /login to / when auth cookies are valid", async () => {
    const authModule = await import("@/lib/supabaseAuth");
    vi.spyOn(authModule, "verifySessionTokens").mockResolvedValue({
      user: { id: "user-1", email: "test@example.com" } as never,
      session: null,
      refreshed: false,
    });

    const { proxy } = await import("../proxy");
    const request = new NextRequest("http://localhost/login", {
      headers: { cookie: "sb-access-token=test-token; sb-refresh-token=refresh-token" },
    });
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("redirects /login to /platform for authenticated platform admins", async () => {
    const authModule = await import("@/lib/supabaseAuth");
    vi.spyOn(authModule, "verifySessionTokens").mockResolvedValue({
      user: {
        id: "user-1",
        email: "test@example.com",
        app_metadata: { is_platform_admin: true },
      } as never,
      session: null,
      refreshed: false,
    });

    const { proxy } = await import("../proxy");
    const request = new NextRequest("http://localhost/login", {
      headers: { cookie: "sb-access-token=test-token; sb-refresh-token=refresh-token" },
    });
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/platform");
  });

  it("allows unauthenticated access to /forgot-password", async () => {
    const { proxy } = await import("../proxy");
    const response = await proxy(new NextRequest("http://localhost/forgot-password"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows unauthenticated access to /reset-password", async () => {
    const { proxy } = await import("../proxy");
    const response = await proxy(new NextRequest("http://localhost/reset-password"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects non platform-admin users away from /platform", async () => {
    const authModule = await import("@/lib/supabaseAuth");
    vi.spyOn(authModule, "verifySessionTokens").mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", app_metadata: {} } as never,
      session: null,
      refreshed: false,
    });

    const { proxy } = await import("../proxy");
    const request = new NextRequest("http://localhost/platform", {
      headers: { cookie: "sb-access-token=test-token; sb-refresh-token=refresh-token" },
    });
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("allows platform-admin users to access /platform", async () => {
    const authModule = await import("@/lib/supabaseAuth");
    vi.spyOn(authModule, "verifySessionTokens").mockResolvedValue({
      user: {
        id: "user-1",
        email: "test@example.com",
        app_metadata: { is_platform_admin: true },
      } as never,
      session: null,
      refreshed: false,
    });

    const { proxy } = await import("../proxy");
    const request = new NextRequest("http://localhost/platform", {
      headers: { cookie: "sb-access-token=test-token; sb-refresh-token=refresh-token" },
    });
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects platform-admin users without organization membership away from tenant pages", async () => {
    const authModule = await import("@/lib/supabaseAuth");
    vi.spyOn(authModule, "verifySessionTokens").mockResolvedValue({
      user: {
        id: "user-1",
        email: "test@example.com",
        app_metadata: { is_platform_admin: true },
      } as never,
      session: null,
      refreshed: false,
    });

    const organizationModule = await import("@/lib/organizationContext");
    vi.spyOn(organizationModule, "findPrimaryOrganizationForUser").mockResolvedValue(null);

    const { proxy } = await import("../proxy");
    const request = new NextRequest("http://localhost/settings", {
      headers: { cookie: "sb-access-token=test-token; sb-refresh-token=refresh-token" },
    });
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/platform");
  });
});
