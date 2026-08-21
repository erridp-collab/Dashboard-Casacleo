import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("proxy auth enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards API requests without performing duplicate middleware auth", async () => {
    const authModule = await import("@/lib/supabaseAuth");
    const verifySpy = vi.spyOn(authModule, "verifySessionTokens");
    const { proxy } = await import("../proxy");
    const response = await proxy(new NextRequest("http://localhost/api/bookings"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it("excludes public PWA assets from the proxy matcher", async () => {
    const { config } = await import("../proxy");
    const matcher = config.matcher.join(" ");

    for (const asset of ["sw.js", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png"]) {
      expect(matcher).toContain(asset);
    }
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
    vi.spyOn(authModule, "verifyAccessTokenSubject").mockResolvedValue("user-1");
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

  it("starts the organization lookup early but still waits for authoritative getUser", async () => {
    let resolveAuth!: (value: {
      user: { id: string; email: string; app_metadata: Record<string, unknown> };
      session: null;
      refreshed: false;
    }) => void;
    const authPromise = new Promise<Parameters<typeof resolveAuth>[0]>((resolve) => {
      resolveAuth = resolve;
    });
    const authModule = await import("@/lib/supabaseAuth");
    vi.spyOn(authModule, "verifyAccessTokenSubject").mockResolvedValue("user-1");
    vi.spyOn(authModule, "verifySessionTokens").mockReturnValue(authPromise as never);

    const organizationModule = await import("@/lib/organizationContext");
    const organizationSpy = vi.spyOn(organizationModule, "findPrimaryOrganizationForUser").mockResolvedValue({
      id: "org-1",
      name: "Org 1",
      slug: "org-1",
      currency_code: "EUR",
      timezone: "Europe/Rome",
      settings: { onboarding_completed: true },
    });

    const { proxy } = await import("../proxy");
    const responsePromise = proxy(new NextRequest("http://localhost/settings", {
      headers: { cookie: "sb-access-token=test-token; sb-refresh-token=refresh-token" },
    }));

    await vi.waitFor(() => expect(organizationSpy).toHaveBeenCalledWith("user-1", null));
    let settled = false;
    void responsePromise.finally(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolveAuth({
      user: { id: "user-1", email: "test@example.com", app_metadata: {} },
      session: null,
      refreshed: false,
    });
    await expect(responsePromise).resolves.toMatchObject({ status: 200 });
  });

  it("discards a speculative organization when claims subject and getUser differ", async () => {
    const authModule = await import("@/lib/supabaseAuth");
    vi.spyOn(authModule, "verifyAccessTokenSubject").mockResolvedValue("user-a");
    vi.spyOn(authModule, "verifySessionTokens").mockResolvedValue({
      user: { id: "user-b", email: "user-b@example.com", app_metadata: {} } as never,
      session: null,
      refreshed: false,
    });

    const organizationModule = await import("@/lib/organizationContext");
    const organizationSpy = vi.spyOn(organizationModule, "findPrimaryOrganizationForUser")
      .mockImplementation(async (userId) => ({
        id: userId === "user-a" ? "org-a" : "org-b",
        name: userId,
        slug: userId,
        currency_code: "EUR",
        timezone: "Europe/Rome",
        settings: { onboarding_completed: userId === "user-b" },
      }));

    const { proxy } = await import("../proxy");
    const response = await proxy(new NextRequest("http://localhost/settings", {
      headers: { cookie: "sb-access-token=test-token; sb-refresh-token=refresh-token" },
    }));

    expect(response.status).toBe(200);
    expect(organizationSpy.mock.calls.map(([userId]) => userId)).toEqual(["user-a", "user-b"]);
  });

  it("never authorizes a verified claim when authoritative getUser rejects it", async () => {
    const authModule = await import("@/lib/supabaseAuth");
    vi.spyOn(authModule, "verifyAccessTokenSubject").mockResolvedValue("user-a");
    vi.spyOn(authModule, "verifySessionTokens").mockResolvedValue({
      user: null,
      session: null,
      refreshed: false,
    });
    const organizationModule = await import("@/lib/organizationContext");
    const organizationSpy = vi.spyOn(organizationModule, "findPrimaryOrganizationForUser").mockResolvedValue({
      id: "org-a",
      name: "Org A",
      slug: "org-a",
      currency_code: "EUR",
      timezone: "Europe/Rome",
      settings: { onboarding_completed: true },
    });

    const { proxy } = await import("../proxy");
    const response = await proxy(new NextRequest("http://localhost/settings", {
      headers: { cookie: "sb-access-token=test-token; sb-refresh-token=refresh-token" },
    }));

    expect(organizationSpy).toHaveBeenCalledWith("user-a", null);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
});
