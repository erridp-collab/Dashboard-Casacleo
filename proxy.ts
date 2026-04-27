import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

// Backward-compatible fallback: older environments may only define APP_PASSWORD.
const SECRET = process.env.AUTH_SECRET ?? process.env.APP_PASSWORD ?? "";

function verifyToken(token: string): boolean {
  if (!SECRET || !token) return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const ts = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", SECRET).update(ts).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const rawToken = request.cookies.get("auth-token")?.value ?? "";
  const isAuthenticated = verifyToken(rawToken);
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  // Se l'utente non e loggato e non e sulla pagina di login, bloccalo.
  if (!isAuthenticated && !isLoginPage) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Se l'utente e loggato e prova ad andare in /login, mandalo alla home.
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Esegui il proxy su tutte le route, escludendo asset statici e file next interni.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
