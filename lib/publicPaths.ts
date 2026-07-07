const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/_next/",
  "/api/",
];

// PWA manifest + icons must be reachable without a session cookie: the OS-level
// "add to home screen" / WebAPK install flow (esp. on Android) fetches these
// unauthenticated, so gating them behind login makes it fall back to a
// generic icon instead of the real logo.
const PUBLIC_EXACT_PATHS = [
  "/favicon.ico",
  "/manifest.json",
  "/manifest.webmanifest",
  "/sw.js",
  "/alva-logo.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/badge-72.png",
];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.includes(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => {
    if (prefix.endsWith("/")) return pathname.startsWith(prefix);
    return pathname === prefix || pathname.startsWith(prefix + "/");
  });
}
