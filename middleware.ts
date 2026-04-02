import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get("auth-token");
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  // Se l'utente non è loggato e non è sulla pagina di login, bloccalo.
  if (!authToken?.value && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Se l'utente è loggato e prova ad andare in /login, mandalo alla home.
  if (authToken?.value === "authenticated" && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Esegui il middleware su tutte le route, escludendo asset statici e file next interni
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
