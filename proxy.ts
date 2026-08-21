import { findPrimaryOrganizationForUser, isOnboardingComplete } from "@/lib/organizationContext";
import { isPlatformAdminClaims } from "@/lib/platformAdmin";
import { isPublicPath } from "@/lib/publicPaths";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  clearAuthCookies,
  readActiveOrganizationId,
  readSessionTokens,
  verifyAccessTokenSubject,
  verifySessionTokens,
  writeSessionCookies,
} from "@/lib/supabaseAuth";
import { serverTimingHeader, timed, type TimingEntry } from "@/lib/timing/serverTiming";
import { logRequestTiming } from "@/lib/timing/requestTiming";

export async function proxy(request: NextRequest) {
  const startedAt = performance.now();
  const reqId = crypto.randomUUID();
  const phases: TimingEntry[] = [];
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", reqId);

  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");

  // API Route Handlers are the authoritative security boundary: every tenant
  // route resolves the authenticated user and verifies organization membership
  // through requireRouteContext(). Running the same remote auth lookup here
  // would add latency without adding an independent security check.
  //
  // We still overwrite x-request-id before forwarding the request so callers
  // cannot spoof server correlation ids. No identity or tenant context is ever
  // accepted from request headers.
  if (isApiRoute) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");
  const isSignupPage = pathname === "/signup" || pathname.startsWith("/signup/");
  const isOnboardingPage = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const isPlatformPage = pathname === "/platform" || pathname.startsWith("/platform/");
  const isPublicPage = isPublicPath(pathname);
  const needsOrganization = !isPublicPage && !isOnboardingPage && !isPlatformPage;
  const tokens = readSessionTokens(request.cookies);
  const authPromise = timed(phases, "mw-auth", () => verifySessionTokens(tokens));
  const claimedUserId = needsOrganization
    ? await timed(phases, "mw-claims", () => verifyAccessTokenSubject(tokens))
    : null;
  const activeOrganizationId = needsOrganization ? readActiveOrganizationId(request.cookies) : null;
  const speculativeOrganizationPromise = claimedUserId
    ? timed(phases, "mw-org", () => findPrimaryOrganizationForUser(claimedUserId, activeOrganizationId)).then(
        (organization) => ({ ok: true as const, organization }),
        (error: unknown) => ({ ok: false as const, error }),
      )
    : null;
  const verified = await authPromise;
  const isAuthenticated = Boolean(verified.user);
  const isPlatformAdmin = isPlatformAdminClaims(verified.user?.app_metadata);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  function finish(res: NextResponse): NextResponse {
    res.headers.set("x-request-id", reqId);
    res.headers.set("Server-Timing", serverTimingHeader(phases));
    logRequestTiming(reqId, "middleware", pathname, phases, {
      wallMs: performance.now() - startedAt,
    });
    return res;
  }

  if (verified.refreshed && verified.session) {
    writeSessionCookies(response.cookies, verified.session);
  }

  if (!isAuthenticated && tokens?.accessToken) {
    clearAuthCookies(response.cookies);
  }

  if (!isAuthenticated) {
    if (!isPublicPage) {
      const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
      if (tokens?.accessToken) {
        clearAuthCookies(redirectResponse.cookies);
      }
      return finish(redirectResponse);
    }
  }

  if (isAuthenticated && (isLoginPage || isSignupPage)) {
    return finish(NextResponse.redirect(new URL(isPlatformAdmin ? "/platform" : "/", request.url)));
  }

  if (isAuthenticated && isPlatformPage) {
    if (!isPlatformAdmin) {
      return finish(NextResponse.redirect(new URL("/", request.url)));
    }
    return finish(response);
  }

  if (isAuthenticated && !isPublicPage && !isOnboardingPage && verified.user) {
    const userId = verified.user.id;
    let organization;
    if (claimedUserId === userId && speculativeOrganizationPromise) {
      const speculative = await speculativeOrganizationPromise;
      if (!speculative.ok) throw speculative.error;
      organization = speculative.organization;
    } else {
      organization = await timed(phases, "mw-org", () =>
        findPrimaryOrganizationForUser(userId, activeOrganizationId),
      );
    }

    if (!organization && isPlatformAdmin) {
      return finish(NextResponse.redirect(new URL("/platform", request.url)));
    }

    if (organization && !isOnboardingComplete(organization.settings)) {
      return finish(NextResponse.redirect(new URL("/onboarding", request.url)));
    }
  }

  return finish(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|sw.js|alva-logo.png|apple-touch-icon.png|icon-192.png|icon-512.png|icon-maskable-192.png|badge-72.png).*)",
  ],
};
