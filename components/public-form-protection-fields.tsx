import {
  PUBLIC_FORM_HONEYPOT_FIELD,
  PUBLIC_FORM_TIMESTAMP_FIELD,
} from "@/lib/formProtection";

export function PublicFormProtectionFields({ renderedAt }: { renderedAt: string }) {
  return (
    <>
      <input type="hidden" name={PUBLIC_FORM_TIMESTAMP_FIELD} value={renderedAt} />
      <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={PUBLIC_FORM_HONEYPOT_FIELD}>Lascia vuoto questo campo</label>
        <input
          id={PUBLIC_FORM_HONEYPOT_FIELD}
          name={PUBLIC_FORM_HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
    </>
  );
}
