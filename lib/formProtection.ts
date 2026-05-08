export const PUBLIC_FORM_HONEYPOT_FIELD = "company_website";
export const PUBLIC_FORM_TIMESTAMP_FIELD = "form_rendered_at";
export const MIN_PUBLIC_FORM_SUBMIT_MS = 1200;

export type PublicFormProtectionResult =
  | { ok: true }
  | { ok: false; reason: "honeypot_filled" | "missing_timestamp" | "submitted_too_fast" };

function toTrimmedString(value: FormDataEntryValue | null): string {
  return value?.toString().trim() ?? "";
}

export function validatePublicFormProtection(
  formData: FormData,
  now = Date.now(),
  minSubmitMs = MIN_PUBLIC_FORM_SUBMIT_MS,
): PublicFormProtectionResult {
  const honeypotValue = toTrimmedString(formData.get(PUBLIC_FORM_HONEYPOT_FIELD));
  if (honeypotValue) {
    return { ok: false, reason: "honeypot_filled" };
  }

  const rawRenderedAt = toTrimmedString(formData.get(PUBLIC_FORM_TIMESTAMP_FIELD));
  const renderedAt = Number(rawRenderedAt);

  if (!rawRenderedAt || !Number.isFinite(renderedAt) || renderedAt <= 0) {
    return { ok: false, reason: "missing_timestamp" };
  }

  if (now - renderedAt < minSubmitMs) {
    return { ok: false, reason: "submitted_too_fast" };
  }

  return { ok: true };
}
