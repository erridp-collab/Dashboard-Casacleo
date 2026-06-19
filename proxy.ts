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

export async function proxy(request: NextRequest) {
  const tokens = readSessionTokens(request.cookies);
  const verified = await verifySessionTokens(tokens);
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");
  const isSignupPage = pathname === "/signup" || pathname.startsWith("/signup/");
  const isOnboardingPage = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const isPlatformPage = pathname === "/platform" || pathname.startsWith("/platform/");
  const isApiRoute = pathname.startsWith("/api/");
  const isPublicPage = isPublicPath(pathname);
  const isAuthenticated = Boolean(verified.user);
  const isPlatformAdmin = isPlatformAdminClaims(verified.user?.app_metadata);
  const response = NextResponse.next();

  if (verified.refreshed && verified.session) {
    writeSessionCookies(response.cookies, verified.session);
  }

  if (!isAuthenticated && tokens?.accessToken) {
    clearAuthCookies(response.cookies);
  }

  if (!isAuthenticated) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isPublicPage) {
      const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
      if (tokens?.accessToken) {
        clearAuthCookies(redirectResponse.cookies);
      }
      return redirectResponse;
    }
  }

  if (isAuthenticated && (isLoginPage || isSignupPage)) {
    return NextResponse.redirect(new URL(isPlatformAdmin ? "/platform" : "/", request.url));
  }

  if (isAuthenticated && isPlatformPage) {
    if (!isPlatformAdmin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  if (isAuthenticated && !isApiRoute && !isPublicPage && !isOnboardingPage && verified.user) {
    const activeOrganizationId = readActiveOrganizationId(request.cookies);
    const organization = await findPrimaryOrganizationForUser(verified.user.id, activeOrganizationId);

    if (!organization && isPlatformAdmin) {
      return NextResponse.redirect(new URL("/platform", request.url));
    }

    if (organization && !isOnboardingComplete(organization.settings)) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
