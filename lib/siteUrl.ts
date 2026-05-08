import "server-only";

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getSiteUrl(headersList: Headers): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  const origin = headersList.get("origin")?.trim();
  if (origin) {
    return trimTrailingSlash(origin);
  }

  const host =
    headersList.get("x-forwarded-host")?.trim() ??
    headersList.get("host")?.trim() ??
    "";

  if (!host) return "";

  const proto =
    headersList.get("x-forwarded-proto")?.trim() ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${proto}://${host}`;
}
