import { findPrimaryOrganizationForUser, isOnboardingComplete } from "@/lib/organizationContext";
import { isPlatformAdminClaims } from "@/lib/platformAdmin";
import { isPublicPath } from "@/lib/publicPaths";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  clearAuthCookies,
  readActiveOrganizationId,
  readSessionTokens,
  verifySessionTokens,
  writeSessionCookies,
} from "@/lib/supabaseAuth";
import { serverTimingHeader, timed, type TimingEntry } from "@/lib/timing/serverTiming";
import { logRequestTiming } from "@/lib/timing/requestTiming";

export async function proxy(request: NextRequest) {
  const reqId = crypto.randomUUID();
  const phases: TimingEntry[] = [];
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", reqId);

  const tokens = readSessionTokens(request.cookies);
  const verified = await timed(phases, "mw-auth", () => verifySessionTokens(tokens));
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");
  const isSignupPage = pathname === "/signup" || pathname.startsWith("/signup/");
  const isOnboardingPage = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const isPlatformPage = pathname === "/platform" || pathname.startsWith("/platform/");
  const isApiRoute = pathname.startsWith("/api/");
  const isPublicPage = isPublicPath(pathname);
  const isAuthenticated = Boolean(verified.user);
  const isPlatformAdmin = isPlatformAdminClaims(verified.user?.app_metadata);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  function finish(res: NextResponse): NextResponse {
    res.headers.set("x-request-id", reqId);
    res.headers.set("Server-Timing", serverTimingHeader(phases));
    logRequestTiming(reqId, "middleware", pathname, phases);
    return res;
  }

  if (verified.refreshed && verified.session) {
    writeSessionCookies(response.cookies, verified.session);
  }

  if (!isAuthenticated && tokens?.accessToken) {
    clearAuthCookies(response.cookies);
  }

  if (!isAuthenticated) {
    if (isApiRoute) {
      return finish(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
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

  if (isAuthenticated && !isApiRoute && !isPublicPage && !isOnboardingPage && verified.user) {
    const activeOrganizationId = readActiveOrganizationId(request.cookies);
    const userId = verified.user.id;
    const organization = await timed(phases, "mw-org", () =>
      findPrimaryOrganizationForUser(userId, activeOrganizationId),
    );

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
