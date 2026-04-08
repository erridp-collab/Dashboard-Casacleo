import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const authToken = request.cookies.get("auth-token");
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  // Se l'utente non e loggato e non e sulla pagina di login, bloccalo.
  if (!authToken?.value && !isLoginPage) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Se l'utente e loggato e prova ad andare in /login, mandalo alla home.
  if (authToken?.value === "authenticated" && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Esegui il proxy su tutte le route, escludendo asset statici e file next interni.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
