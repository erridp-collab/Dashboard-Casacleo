import { describe, expect, it } from "vitest";
import { isPublicPath } from "../middleware";

describe("isPublicPath", () => {
  it("permette /login", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it("permette /signup", () => {
    expect(isPublicPath("/signup")).toBe(true);
  });

  it("permette /forgot-password", () => {
    expect(isPublicPath("/forgot-password")).toBe(true);
  });

  it("permette /reset-password con query string", () => {
    expect(isPublicPath("/reset-password")).toBe(true);
  });

  it("permette /_next/static/...", () => {
    expect(isPublicPath("/_next/static/chunks/app.js")).toBe(true);
  });

  it("permette /api/bookings", () => {
    expect(isPublicPath("/api/bookings")).toBe(true);
  });

  it("permette /favicon.ico", () => {
    expect(isPublicPath("/favicon.ico")).toBe(true);
  });

  it("permette /manifest.json", () => {
    expect(isPublicPath("/manifest.json")).toBe(true);
  });

  it("blocca /", () => {
    expect(isPublicPath("/")).toBe(false);
  });

  it("blocca /bookings", () => {
    expect(isPublicPath("/bookings")).toBe(false);
  });

  it("blocca /actions", () => {
    expect(isPublicPath("/actions")).toBe(false);
  });

  it("blocca /platform/requests", () => {
    expect(isPublicPath("/platform/requests")).toBe(false);
  });

  it("blocca /settings", () => {
    expect(isPublicPath("/settings")).toBe(false);
  });
});
