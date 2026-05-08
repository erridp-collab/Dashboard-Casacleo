import { describe, expect, it } from "vitest";
import {
  MIN_PUBLIC_FORM_SUBMIT_MS,
  PUBLIC_FORM_HONEYPOT_FIELD,
  PUBLIC_FORM_TIMESTAMP_FIELD,
  validatePublicFormProtection,
} from "@/lib/formProtection";

describe("validatePublicFormProtection", () => {
  it("accepts a normal form submission", () => {
    const now = Date.now();
    const formData = new FormData();
    formData.set(PUBLIC_FORM_HONEYPOT_FIELD, "");
    formData.set(PUBLIC_FORM_TIMESTAMP_FIELD, String(now - MIN_PUBLIC_FORM_SUBMIT_MS - 100));

    expect(validatePublicFormProtection(formData, now)).toEqual({ ok: true });
  });

  it("rejects when the honeypot field is filled", () => {
    const now = Date.now();
    const formData = new FormData();
    formData.set(PUBLIC_FORM_HONEYPOT_FIELD, "bot");
    formData.set(PUBLIC_FORM_TIMESTAMP_FIELD, String(now - MIN_PUBLIC_FORM_SUBMIT_MS - 100));

    expect(validatePublicFormProtection(formData, now)).toEqual({
      ok: false,
      reason: "honeypot_filled",
    });
  });

  it("rejects when the timestamp is missing", () => {
    const formData = new FormData();
    formData.set(PUBLIC_FORM_HONEYPOT_FIELD, "");

    expect(validatePublicFormProtection(formData)).toEqual({
      ok: false,
      reason: "missing_timestamp",
    });
  });

  it("rejects when the form is submitted too quickly", () => {
    const now = Date.now();
    const formData = new FormData();
    formData.set(PUBLIC_FORM_HONEYPOT_FIELD, "");
    formData.set(PUBLIC_FORM_TIMESTAMP_FIELD, String(now - 200));

    expect(validatePublicFormProtection(formData, now)).toEqual({
      ok: false,
      reason: "submitted_too_fast",
    });
  });
});
