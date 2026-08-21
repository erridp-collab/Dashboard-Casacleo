import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  readSessionTokens: vi.fn(),
  verifyAccessTokenSubject: vi.fn(),
  verifySessionTokens: vi.fn(),
  readActiveOrganizationId: vi.fn(),
  writeActiveOrganizationCookie: vi.fn(),
  writeSessionCookies: vi.fn(),
  supabaseAdmin: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabaseAuth", () => ({
  readSessionTokens: mocks.readSessionTokens,
  verifyAccessTokenSubject: mocks.verifyAccessTokenSubject,
  verifySessionTokens: mocks.verifySessionTokens,
  readActiveOrganizationId: mocks.readActiveOrganizationId,
  writeActiveOrganizationCookie: mocks.writeActiveOrganizationCookie,
  writeSessionCookies: mocks.writeSessionCookies,
}));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: mocks.supabaseAdmin }));

import { ForbiddenError, UnauthorizedError, requireOrganizationContext } from "@/lib/organizationContext";

type Membership = { organization_id: string; role: "owner" | "admin" | "staff" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function mockMemberships(rowsByUser: Record<string, Membership[]>, queriedUsers: string[]) {
  mocks.supabaseAdmin.mockImplementation(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((_column: string, userId: string) => ({
          order: vi.fn(async () => {
            queriedUsers.push(userId);
            return { data: rowsByUser[userId] ?? [], error: null };
          }),
        })),
      })),
    })),
  }));
}

describe("requireOrganizationContext parallel auth boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: vi.fn(), set: vi.fn() });
    mocks.readSessionTokens.mockReturnValue({ accessToken: "signed-token", refreshToken: "refresh-token" });
    mocks.readActiveOrganizationId.mockReturnValue("org-a");
  });

  it("starts membership lookup from verified claims but still waits for authoritative getUser", async () => {
    const auth = deferred<{
      user: { id: string; email: string } | null;
      session: null;
      refreshed: false;
    }>();
    const queriedUsers: string[] = [];
    mockMemberships({ "user-a": [{ organization_id: "org-a", role: "owner" }] }, queriedUsers);
    mocks.verifyAccessTokenSubject.mockResolvedValue("user-a");
    mocks.verifySessionTokens.mockReturnValue(auth.promise);

    const contextPromise = requireOrganizationContext();
    await vi.waitFor(() => expect(queriedUsers).toEqual(["user-a"]));

    let settled = false;
    void contextPromise.finally(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    auth.resolve({ user: { id: "user-a", email: "owner@example.com" }, session: null, refreshed: false });
    await expect(contextPromise).resolves.toEqual({
      organizationId: "org-a",
      role: "owner",
      userId: "user-a",
      email: "owner@example.com",
    });
  });

  it("never authorizes a cryptographically valid token rejected by getUser", async () => {
    const queriedUsers: string[] = [];
    mockMemberships({ "user-a": [{ organization_id: "org-a", role: "owner" }] }, queriedUsers);
    mocks.verifyAccessTokenSubject.mockResolvedValue("user-a");
    mocks.verifySessionTokens.mockResolvedValue({ user: null, session: null, refreshed: false });

    await expect(requireOrganizationContext()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(queriedUsers).toEqual(["user-a"]);
  });

  it("discards prefetched memberships when claim subject and getUser differ", async () => {
    const queriedUsers: string[] = [];
    mockMemberships(
      {
        "user-a": [{ organization_id: "org-a", role: "owner" }],
        "user-b": [{ organization_id: "org-b", role: "staff" }],
      },
      queriedUsers,
    );
    mocks.verifyAccessTokenSubject.mockResolvedValue("user-a");
    mocks.verifySessionTokens.mockResolvedValue({
      user: { id: "user-b", email: "staff@example.com" },
      session: null,
      refreshed: false,
    });
    mocks.readActiveOrganizationId.mockReturnValue("org-b");

    await expect(requireOrganizationContext()).resolves.toMatchObject({
      organizationId: "org-b",
      role: "staff",
      userId: "user-b",
    });
    expect(queriedUsers).toEqual(["user-a", "user-b"]);
  });

  it("uses the authoritative user after claims fallback and preserves membership denial", async () => {
    const queriedUsers: string[] = [];
    mockMemberships({}, queriedUsers);
    mocks.verifyAccessTokenSubject.mockResolvedValue(null);
    mocks.verifySessionTokens.mockResolvedValue({
      user: { id: "user-a", email: "owner@example.com" },
      session: null,
      refreshed: false,
    });

    await expect(requireOrganizationContext()).rejects.toBeInstanceOf(ForbiddenError);
    expect(queriedUsers).toEqual(["user-a"]);
  });
});
