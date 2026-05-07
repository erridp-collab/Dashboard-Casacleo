import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createToken(secret: string): string {
  const ts = Date.now().toString();
  const sig = createHmac("sha256", secret).update(ts).digest("hex");
  return `${ts}.${sig}`;
}

describe("proxy auth enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AUTH_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.APP_PASSWORD;
  });

  it("returns 401 for API requests without auth cookie", async () => {
    const { proxy } = await import("../proxy");
    const response = proxy(new NextRequest("http://localhost/api/bookings"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("redirects protected pages to /login without auth cookie", async () => {
    const { proxy } = await import("../proxy");
    const response = proxy(new NextRequest("http://localhost/bookings"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("redirects /login to / when auth cookie is valid", async () => {
    const { proxy } = await import("../proxy");
    const token = createToken("test-secret");
    const request = new NextRequest("http://localhost/login", {
      headers: { cookie: `auth-token=${token}` },
    });
    const response = proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });
});
