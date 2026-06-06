import { NextRequest, NextResponse } from "next/server";

// Note: AUTH_ACCESS_COOKIE from lib/supabaseAuth.ts is not imported here because
// that module has `import "server-only"` which is incompatible with Edge Runtime.

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/_next/",
  // /api/ routes handle auth themselves via requireRouteContext(); exclude from middleware redirect
  "/api/",
];

const PUBLIC_EXACT_PATHS = ["/favicon.ico", "/manifest.json"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.includes(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => {
    // For prefixes ending with "/", use startsWith directly (e.g., "/_next/", "/api/")
    // For prefixes without "/", check exact match or path separator (e.g., "/login")
    if (prefix.endsWith("/")) {
      return pathname.startsWith(prefix);
    }
    return pathname === prefix || pathname.startsWith(prefix + "/");
  });
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Cookie presence is a fast-path guard only. Validity is enforced by route handlers via verifySessionTokens().
  const hasSession = Boolean(request.cookies.get("sb-access-token")?.value);
  if (!hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json).*)",
  ],
};
