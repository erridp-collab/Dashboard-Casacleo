import { findPrimaryOrganizationForUser, isOnboardingComplete } from "@/lib/organizationContext";
import { isPlatformAdminClaims } from "@/lib/platformAdmin";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  clearAuthCookies,
  readActiveOrganizationId,
  readSessionTokens,
  verifySessionTokens,
  writeSessionCookies,
} from "@/lib/supabaseAuth";

const PUBLIC_PATH_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export async function proxy(request: NextRequest) {
  const tokens = readSessionTokens(request.cookies);
  const verified = await verifySessionTokens(tokens);
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isSignupPage = request.nextUrl.pathname.startsWith("/signup");
  const isOnboardingPage = request.nextUrl.pathname.startsWith("/onboarding");
  const isPlatformPage = request.nextUrl.pathname.startsWith("/platform");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const isPublicPage = PUBLIC_PATH_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
  const isAuthenticated = Boolean(verified.user);
  const isPlatformAdmin = isPlatformAdminClaims(verified.user?.app_metadata);
  const response = NextResponse.next();

  if (verified.refreshed && verified.session) {
    writeSessionCookies(response.cookies, verified.session);
  }

  if (!isAuthenticated && tokens?.accessToken) {
    clearAuthCookies(response.cookies);
  }

  if (!isAuthenticated && !isPublicPage) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    if (tokens?.accessToken) {
      clearAuthCookies(redirectResponse.cookies);
    }
    return redirectResponse;
  }

  if (isAuthenticated && (isLoginPage || isSignupPage)) {
    return NextResponse.redirect(new URL("/", request.url));
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

    if (organization && !isOnboardingComplete(organization.settings)) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
