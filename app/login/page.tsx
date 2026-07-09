"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { InlineAlert } from "@/components/inline-alert";
import { PublicFormProtectionFields } from "@/components/public-form-protection-fields";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const [renderedAt] = useState(() => String(Date.now()));

  return (
    <AuthShell
      icon={<LockKeyhole className="h-5 w-5" />}
      title="Accedi"
      subtitle="Usa email e password del tuo workspace per tornare subito nella tua area operativa."
      footer={
        <>
          Primo accesso?{" "}
          <Link href="/signup" className="font-semibold text-sidebar-bg transition hover:text-primary">
            Richiedi accesso
          </Link>
        </>
      }
    >
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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="password" className="label-base">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-medium text-text-secondary transition hover:text-text-primary">
              Password dimenticata?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="input-base pr-11"
              placeholder="La tua password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary transition hover:text-text-primary"
              aria-label={showPassword ? "Nascondi password" : "Mostra password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {state?.error ? <InlineAlert tone="error">{state.error}</InlineAlert> : null}

        <button type="submit" disabled={isPending} className="btn-primary w-full">
          {isPending ? "Accesso..." : "Accedi"}
        </button>
      </form>
    </AuthShell>
  );
}
