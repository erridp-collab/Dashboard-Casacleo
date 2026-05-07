import { NextResponse } from "next/server";

export function okJson<T extends Record<string, unknown>>(payload: T, status = 200) {
  return NextResponse.json(payload, { status });
}

export function errJson(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      ...(extra ?? {}),
      error: message,
    },
    { status },
  );
}
