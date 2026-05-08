import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockHeaders,
  mockCookies,
  mockRedirect,
  mockSupabaseAuthClient,
  mockClearAuthCookies,
  mockWriteSessionCookies,
} = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockCookies: vi.fn(),
  mockRedirect: vi.fn(),
  mockSupabaseAuthClient: vi.fn(),
  mockClearAuthCookies: vi.fn(),
  mockWriteSessionCookies: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
  cookies: mockCookies,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/organizationContext", () => ({
  resolveDefaultOrganizationId: vi.fn(),
}));

vi.mock("@/lib/supabaseAuth", () => ({
  clearAuthCookies: mockClearAuthCookies,
  supabaseAuthClient: mockSupabaseAuthClient,
  writeActiveOrganizationCookie: vi.fn(),
  writeSessionCookies: mockWriteSessionCookies,
}));

import {
  forgotPasswordAction,
  logoutAction,
  resetPasswordAction,
  signupAction,
} from "@/app/actions/auth";

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(
      new Headers({
        host: "localhost:3000",
        origin: "http://localhost:3000",
      }),
    );
    mockCookies.mockResolvedValue({
      delete: vi.fn(),
      set: vi.fn(),
    });
  });

  describe("logoutAction", () => {
    it("rejects requests from a different origin", async () => {
      mockHeaders.mockResolvedValue(
        new Headers({
          host: "localhost:3000",
          origin: "https://evil.com",
        }),
      );

      await expect(logoutAction(null, new FormData())).resolves.toEqual({
        error: "Richiesta non autorizzata",
      });
      expect(mockClearAuthCookies).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("allows logout from the same origin", async () => {
      await logoutAction(null, new FormData());

      expect(mockClearAuthCookies).toHaveBeenCalledTimes(1);
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });
  });

  describe("forgotPasswordAction", () => {
    it("returns an error if email is missing", async () => {
      const formData = new FormData();

      await expect(forgotPasswordAction(null, formData)).resolves.toEqual({
        error: "Email obbligatoria",
      });
    });

    it("returns success without revealing whether the user exists", async () => {
      const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseAuthClient.mockReturnValue({
        auth: {
          resetPasswordForEmail,
        },
      });

      const formData = new FormData();
      formData.set("email", "test@example.com");

      await expect(forgotPasswordAction(null, formData)).resolves.toEqual({ success: true });
      expect(resetPasswordForEmail).toHaveBeenCalledWith("test@example.com", {
        redirectTo: "http://localhost:3000/reset-password",
      });
    });
  });

  describe("resetPasswordAction", () => {
    it("returns an error if password is too short", async () => {
      const formData = new FormData();
      formData.set("password", "short");
      formData.set("confirm_password", "short");

      await expect(resetPasswordAction(null, formData)).resolves.toEqual({
        error: "La password deve avere almeno 8 caratteri",
      });
    });

    it("returns an error when passwords do not match", async () => {
      const formData = new FormData();
      formData.set("password", "password123");
      formData.set("confirm_password", "different123");

      await expect(resetPasswordAction(null, formData)).resolves.toEqual({
        error: "Le password non coincidono",
      });
    });

    it("returns success when passwords are valid", async () => {
      const formData = new FormData();
      formData.set("password", "password123");
      formData.set("confirm_password", "password123");

      await expect(resetPasswordAction(null, formData)).resolves.toEqual({ success: true });
    });
  });

  describe("signupAction", () => {
    it("returns an error if organization name is too short", async () => {
      const formData = new FormData();
      formData.set("organization_name", "A");
      formData.set("email", "test@example.com");
      formData.set("password", "password123");

      await expect(signupAction(null, formData)).resolves.toEqual({
        error: expect.stringContaining("organizzazione"),
      });
    });
  });
});
