import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Backward-compatible fallback: older environments may only define APP_PASSWORD.
const SECRET = process.env.AUTH_SECRET ?? process.env.APP_PASSWORD ?? "";

function hmac(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function createAuthToken(): string {
  const ts = Date.now().toString();
  return `${ts}.${hmac(ts)}`;
}

export function verifyAuthToken(token: string): boolean {
  if (!SECRET) return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const ts = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(ts);
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
