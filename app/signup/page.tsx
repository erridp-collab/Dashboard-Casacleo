"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Building2, Send } from "lucide-react";
import { requestAccessAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { InlineAlert } from "@/components/inline-alert";
import { PublicFormProtectionFields } from "@/components/public-form-protection-fields";

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(requestAccessAction, null);
  const [renderedAt] = useState(() => String(Date.now()));

  return (
    <AuthShell
      icon={<Building2 className="h-5 w-5" />}
      title="Richiedi accesso"
      subtitle="Invia la richiesta del tuo workspace. L&apos;attivazione viene approvata manualmente dalla piattaforma."
      footer={
        <>
          Hai gia un account?{" "}
          <Link href="/login" className="font-semibold text-brand-primary transition-colors duration-150 hover:text-brand-hover">
            Accedi
          </Link>
        </>
      }
    >
      {state?.success ? (
        <InlineAlert tone="success" title="Richiesta inviata">
          <p>Se i dati sono validi, la richiesta verra presa in carico dall&apos;amministrazione della piattaforma.</p>
          <p className="mt-2">Quando l&apos;account verra approvato, riceverai le istruzioni per attivare l&apos;accesso.</p>
        </InlineAlert>
      ) : (
        <form className="relative space-y-5" action={formAction}>
          <PublicFormProtectionFields renderedAt={renderedAt} />
          <div className="space-y-1.5">
            <label htmlFor="organization_name" className="label-base">
              Nome organizzazione
            </label>
            <input
              id="organization_name"
              name="organization_name"
              type="text"
              required
              minLength={3}
              className="input-base"
              placeholder="es. Casa al mare"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="full_name" className="label-base">
              Nome completo
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              className="input-base"
              placeholder="Mario Rossi"
            />
            <p className="text-xs text-text-tertiary">Facoltativo, utile per facilitare l&apos;approvazione.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="label-base">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="input-base"
              placeholder="tu@esempio.com"
            />
          </div>

          {state?.error ? <InlineAlert tone="error">{state.error}</InlineAlert> : null}

          <button type="submit" disabled={isPending} className="btn-primary w-full">
            <Send className="h-4 w-4" />
            {isPending ? "Invio..." : "Invia richiesta"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
