"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail } from "lucide-react";
import { forgotPasswordAction } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <Mail className="h-6 w-6 text-zinc-900" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-zinc-900">
            Password dimenticata
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Inserisci la tua email. Ti invieremo un link per impostare una nuova password.
          </p>
        </div>

        {state?.success ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-700">
            <p className="font-medium">Email inviata</p>
            <p className="mt-1">
              Se l&apos;indirizzo e registrato, riceverai un link entro pochi minuti.
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" action={formAction}>
            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full rounded-xl border border-zinc-300 px-3 py-3 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 sm:text-sm"
                placeholder="tu@esempio.com"
              />
            </div>

            {state?.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="flex w-full justify-center rounded-xl border border-transparent bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50"
            >
              {isPending ? "Invio in corso..." : "Invia link di reset"}
            </button>

            <p className="text-center text-sm text-zinc-600">
              <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
                Torna al login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
