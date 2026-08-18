"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Mail } from "lucide-react";
import { forgotPasswordAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { InlineAlert } from "@/components/inline-alert";
import { PublicFormProtectionFields } from "@/components/public-form-protection-fields";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, null);
  const [renderedAt] = useState(() => String(Date.now()));

  return (
    <AuthShell
      icon={<Mail className="h-5 w-5" />}
      title="Password dimenticata"
      subtitle="Inserisci la tua email e ti invieremo un link per impostare una nuova password."
      footer={
        <Link href="/login" className="font-semibold text-brand-primary transition-colors duration-150 hover:text-brand-hover">
          Torna al login
        </Link>
      }
    >
      {state?.success ? (
        <InlineAlert tone="success" title="Email inviata">
          <p>Se l&apos;indirizzo e registrato, riceverai un link entro pochi minuti.</p>
        </InlineAlert>
      ) : (
        <form className="relative space-y-5" action={formAction}>
          <PublicFormProtectionFields renderedAt={renderedAt} />
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
            {isPending ? "Invio in corso..." : "Invia link di reset"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
