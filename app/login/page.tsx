"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <LockKeyhole className="h-6 w-6 text-zinc-900" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-zinc-900">
            Accedi
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Usa email e password del tuo workspace.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" action={formAction}>
          <div>
            <label htmlFor="email" className="sr-only">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="relative block w-full appearance-none rounded-xl border border-zinc-300 px-3 py-3 text-zinc-900 placeholder-zinc-500 focus:z-10 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 sm:text-sm"
              placeholder="Email"
            />
          </div>

          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="relative block w-full appearance-none rounded-xl border border-zinc-300 px-3 py-3 text-zinc-900 placeholder-zinc-500 focus:z-10 focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 sm:text-sm"
              placeholder="Password"
            />
          </div>

          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {state.error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isPending}
              className="group relative flex w-full justify-center rounded-xl border border-transparent bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50"
            >
              {isPending ? "Accesso..." : "Accedi"}
            </button>
          </div>

          <p className="text-center text-sm text-zinc-600">
            Primo accesso?{" "}
            <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-700">
              Crea il tuo workspace
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
