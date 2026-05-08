import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCookies, mockVerifySessionTokens, mockWriteSessionCookies } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockVerifySessionTokens: vi.fn(),
  mockWriteSessionCookies: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/supabaseAuth", () => ({
  readSessionTokens: vi.fn().mockReturnValue({
    accessToken: "access-token",
    refreshToken: "refresh-token",
  }),
  verifySessionTokens: mockVerifySessionTokens,
  writeSessionCookies: mockWriteSessionCookies,
}));

describe("requirePlatformAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    });
  });

  it("accepts users flagged as platform admin", async () => {
    mockVerifySessionTokens.mockResolvedValue({
      user: {
        id: "admin-1",
        email: "admin@example.com",
        app_metadata: { is_platform_admin: true },
      },
      session: null,
      refreshed: false,
    });

    const { requirePlatformAdmin } = await import("@/lib/platformAdmin");

    await expect(requirePlatformAdmin()).resolves.toEqual({
      userId: "admin-1",
      email: "admin@example.com",
    });
  });

  it("rejects authenticated users without the platform flag", async () => {
    mockVerifySessionTokens.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        app_metadata: {},
      },
      session: null,
      refreshed: false,
    });

    const { PlatformForbiddenError, requirePlatformAdmin } = await import("@/lib/platformAdmin");

    await expect(requirePlatformAdmin()).rejects.toBeInstanceOf(PlatformForbiddenError);
  });
});
