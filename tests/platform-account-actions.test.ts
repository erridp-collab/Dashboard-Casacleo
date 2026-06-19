import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockHeaders,
  mockRedirect,
  mockRevalidatePath,
  mockRequirePlatformAdmin,
  mockSupabaseAuthClient,
} = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockRedirect: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockRequirePlatformAdmin: vi.fn(),
  mockSupabaseAuthClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/lib/platformAdmin", () => ({
  requirePlatformAdmin: mockRequirePlatformAdmin,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabaseAuth", () => ({
  supabaseAuthClient: mockSupabaseAuthClient,
}));

vi.mock("@/lib/email/resend", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

describe("platform account actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(
      new Headers({
        host: "localhost:3000",
        origin: "http://localhost:3000",
      }),
    );
    mockRequirePlatformAdmin.mockResolvedValue({
      userId: "admin-1",
      email: "admin@example.com",
    });
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("resends the reset link for an existing account", async () => {
    const generateLink = vi.fn().mockResolvedValue({
      data: { properties: { action_link: "https://example.com/set-password" } },
      error: null,
    });
    const supabaseAdminModule = await import("@/lib/supabaseAdmin");
    vi.mocked(supabaseAdminModule.supabaseAdmin).mockReturnValue({
      auth: { admin: { generateLink } },
    } as never);

    const { resendAccountResetLinkAction } = await import("@/app/platform/actions");
    const formData = new FormData();
    formData.set("email", "owner@example.com");

    await expect(resendAccountResetLinkAction(formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(generateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "owner@example.com",
      options: { redirectTo: "http://localhost:3000/reset-password" },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/platform/accounts");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/platform/accounts?email=owner%40example.com&notice=reset-sent",
    );
  });

  it("disables an account through Supabase admin", async () => {
    const updateUserById = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const supabaseAdminModule = await import("@/lib/supabaseAdmin");
    vi.mocked(supabaseAdminModule.supabaseAdmin).mockReturnValue({
      auth: {
        admin: {
          updateUserById,
        },
      },
    } as never);

    const { disablePlatformAccountAction } = await import("@/app/platform/actions");
    const formData = new FormData();
    formData.set("user_id", "user-1");
    formData.set("email", "owner@example.com");

    await expect(disablePlatformAccountAction(formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(updateUserById).toHaveBeenCalledWith("user-1", {
      ban_duration: "876000h",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/platform/accounts");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/platform/accounts?email=owner%40example.com&notice=account-disabled",
    );
  });

  it("reactivates a disabled account", async () => {
    const updateUserById = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const supabaseAdminModule = await import("@/lib/supabaseAdmin");
    vi.mocked(supabaseAdminModule.supabaseAdmin).mockReturnValue({
      auth: {
        admin: {
          updateUserById,
        },
      },
    } as never);

    const { reactivatePlatformAccountAction } = await import("@/app/platform/actions");
    const formData = new FormData();
    formData.set("user_id", "user-1");
    formData.set("email", "owner@example.com");

    await expect(reactivatePlatformAccountAction(formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(updateUserById).toHaveBeenCalledWith("user-1", {
      ban_duration: "none",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/platform/accounts");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/platform/accounts?email=owner%40example.com&notice=account-reactivated",
    );
  });
});
