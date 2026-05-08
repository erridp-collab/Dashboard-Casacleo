import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSupabaseAuthClient, mockHeaders, mockCookies } = vi.hoisted(() => ({
  mockSupabaseAuthClient: vi.fn(),
  mockHeaders: vi.fn(),
  mockCookies: vi.fn(),
}));

vi.mock("@/lib/supabaseAuth", () => ({
  clearAuthCookies: vi.fn(),
  supabaseAuthClient: mockSupabaseAuthClient,
  writeActiveOrganizationCookie: vi.fn(),
  writeSessionCookies: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
  cookies: mockCookies,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("signupAction error messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
    mockCookies.mockResolvedValue({
      delete: vi.fn(),
      set: vi.fn(),
    });
    mockSupabaseAuthClient.mockReturnValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          error: { message: "User already registered" },
          data: { user: null, session: null },
        }),
      },
    });
  });

  it("masks raw Supabase signup errors", async () => {
    const { signupAction } = await import("@/app/actions/auth");
    const formData = new FormData();
    formData.set("organization_name", "Test Org");
    formData.set("email", "test@example.com");
    formData.set("password", "password123");

    const result = await signupAction(null, formData);

    expect(result?.error).toBe("Registrazione non completata. Verifica i dati e riprova.");
    expect(result?.error?.toLowerCase()).not.toContain("already registered");
  });
});
