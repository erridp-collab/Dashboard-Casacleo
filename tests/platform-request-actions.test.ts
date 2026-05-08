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

describe("platform request actions", () => {
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

  it("approves a pending request and provisions auth, workspace, and membership", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: "request-1",
          email: "owner@example.com",
          full_name: "Mario Rossi",
          organization_name: "Test Org",
          status: "pending",
          notes: null,
          auth_user_id: null,
          organization_id: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: "2026-05-08T08:00:00.000Z",
          updated_at: "2026-05-08T08:00:00.000Z",
        },
        error: null,
      });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });

    const requestUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const requestUpdate = vi.fn().mockReturnValue({ eq: requestUpdateEq });
    const requestInsert = vi.fn();

    const orgSingle = vi.fn().mockResolvedValue({
      data: { id: "org-1" },
      error: null,
    });
    const orgSelect = vi.fn().mockReturnValue({ single: orgSingle });
    const orgInsert = vi.fn().mockReturnValue({ select: orgSelect });

    const roleUpsert = vi.fn().mockResolvedValue({ error: null });

    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [],
      },
      error: null,
    });
    const getUserById = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "not found" },
    });
    const createUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "auth-1",
          email: "owner@example.com",
        },
      },
      error: null,
    });

    const from = vi.fn((table: string) => {
      if (table === "signup_requests") {
        return {
          select,
          update: requestUpdate,
          insert: requestInsert,
        };
      }
      if (table === "organizations") {
        return {
          insert: orgInsert,
        };
      }
      if (table === "user_roles") {
        return {
          upsert: roleUpsert,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const supabase = {
      from,
      auth: {
        admin: {
          listUsers,
          getUserById,
          createUser,
        },
      },
    };

    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseAuthClient.mockReturnValue({
      auth: {
        resetPasswordForEmail,
      },
    });

    const supabaseAdminModule = await import("@/lib/supabaseAdmin");
    vi.mocked(supabaseAdminModule.supabaseAdmin).mockReturnValue(supabase as never);

    const { approveSignupRequestAction } = await import("@/app/platform/actions");
    const formData = new FormData();
    formData.set("request_id", "request-1");

    await expect(approveSignupRequestAction(formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(createUser).toHaveBeenCalledTimes(1);
    expect(orgInsert).toHaveBeenCalledWith({
      name: "Test Org",
      slug: "test-org",
    });
    expect(roleUpsert).toHaveBeenCalledWith(
      {
        organization_id: "org-1",
        user_id: "auth-1",
        role: "owner",
      },
      { onConflict: "organization_id,user_id" },
    );
    expect(resetPasswordForEmail).toHaveBeenCalledWith("owner@example.com", {
      redirectTo: "http://localhost:3000/reset-password",
    });
    expect(requestUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "approved",
        auth_user_id: "auth-1",
        organization_id: "org-1",
        reviewed_by: "admin-1",
        notes: null,
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/platform/requests");
    expect(mockRedirect).toHaveBeenCalledWith("/platform/requests?notice=approved");
  });

  it("rejects a pending request", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "request-2",
        email: "owner@example.com",
        full_name: null,
        organization_name: "Test Org",
        status: "pending",
        notes: null,
        auth_user_id: null,
        organization_id: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: "2026-05-08T08:00:00.000Z",
        updated_at: "2026-05-08T08:00:00.000Z",
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const requestUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const requestUpdate = vi.fn().mockReturnValue({ eq: requestUpdateEq });

    const from = vi.fn((table: string) => {
      if (table === "signup_requests") {
        return {
          select,
          update: requestUpdate,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const supabaseAdminModule = await import("@/lib/supabaseAdmin");
    vi.mocked(supabaseAdminModule.supabaseAdmin).mockReturnValue({ from } as never);

    const { rejectSignupRequestAction } = await import("@/app/platform/actions");
    const formData = new FormData();
    formData.set("request_id", "request-2");

    await expect(rejectSignupRequestAction(formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(requestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        reviewed_by: "admin-1",
        notes: null,
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/platform/requests");
    expect(mockRedirect).toHaveBeenCalledWith("/platform/requests?notice=rejected");
  });
});
