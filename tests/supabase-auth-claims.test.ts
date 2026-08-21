import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/supabase-js")>();
  return { ...actual, createClient: mocks.createClient };
});

import { verifyAccessTokenSubject } from "@/lib/supabaseAuth";

describe("verifyAccessTokenSubject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    mocks.createClient.mockReturnValue({ auth: { getClaims: mocks.getClaims } });
  });

  it("returns only a subject verified by getClaims", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });

    await expect(verifyAccessTokenSubject({ accessToken: "signed-token", refreshToken: null })).resolves.toBe("user-a");
    expect(mocks.getClaims).toHaveBeenCalledWith("signed-token");
  });

  it("does not trust a token when cryptographic claim verification fails", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: new Error("invalid signature") });

    await expect(verifyAccessTokenSubject({ accessToken: "forged-token", refreshToken: null })).resolves.toBeNull();
  });

  it("does not inspect claims when there is no access token", async () => {
    await expect(verifyAccessTokenSubject(null)).resolves.toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
