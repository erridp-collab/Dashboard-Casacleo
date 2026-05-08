import { Ban, CheckCircle2, KeyRound, Search, UserRound } from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import {
  disablePlatformAccountAction,
  reactivatePlatformAccountAction,
  resendAccountResetLinkAction,
} from "@/app/platform/actions";
import { findAuthUserByEmail } from "@/lib/accountProvisioning";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type MembershipRecord = {
  organization_id: string;
  role: string;
  organizations:
    | {
        name: string;
        slug: string;
      }[]
    | null;
};

function normalizeSearchParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return "";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Non disponibile";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isAccountDisabled(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil).getTime() > Date.now();
}

function getBanner(searchParams: Record<string, string | string[] | undefined>) {
  const notice = normalizeSearchParam(searchParams.notice);
  const error = normalizeSearchParam(searchParams.error);

  if (notice === "reset-sent") {
    return {
      tone: "success",
      text: "Link di reset reinviato correttamente.",
    };
  }

  if (notice === "account-disabled") {
    return {
      tone: "success",
      text: "Account disattivato. Il login resta bloccato finche non lo riattivi.",
    };
  }

  if (notice === "account-reactivated") {
    return {
      tone: "success",
      text: "Account riattivato correttamente.",
    };
  }

  if (error === "reset-unavailable") {
    return {
      tone: "error",
      text: "Configurazione reset password non disponibile.",
    };
  }

  if (error === "reset-failed") {
    return {
      tone: "error",
      text: "Invio del reset non riuscito.",
    };
  }

  if (error === "disable-failed") {
    return {
      tone: "error",
      text: "Disattivazione account non riuscita.",
    };
  }

  if (error === "reactivate-failed") {
    return {
      tone: "error",
      text: "Riattivazione account non riuscita.",
    };
  }

  if (error === "invalid-account") {
    return {
      tone: "error",
      text: "Seleziona prima un account valido.",
    };
  }

  return null;
}

async function loadMemberships(userId: string): Promise<MembershipRecord[]> {
  const supabase = supabaseAdmin();
  const result = await supabase
    .from("user_roles")
    .select("organization_id, role, organizations(name, slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []) as unknown as MembershipRecord[];
}

export default async function PlatformAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams: Record<string, string | string[] | undefined> = await (
    searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({})
  );
  const email = normalizeSearchParam(resolvedSearchParams.email).toLowerCase();
  const banner = getBanner(resolvedSearchParams);
  const user = email ? await findAuthUserByEmail(email) : null;
  const memberships = user ? await loadMemberships(user.id) : [];
  const isDisabled = isAccountDisabled(user?.banned_until);

  return (
    <div className="space-y-6">
      {banner ? (
        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm",
            banner.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
            banner.tone === "error" && "border-rose-200 bg-rose-50 text-rose-800",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {banner.text}
        </div>
      ) : null}

      <Card className="p-6">
        <CardHeader
          title="Ricerca account"
          subtitle="Cerca un utente per email e gestisci reset, blocco o riattivazione."
          action={<Search className="h-4 w-4 text-blue-600" />}
        />

        <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            type="email"
            name="email"
            defaultValue={email}
            placeholder="utente@esempio.com"
            className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
          <button
            type="submit"
            className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Cerca account
          </button>
        </form>
      </Card>

      {!email ? (
        <Card className="p-6">
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
            Inserisci un&apos;email per cercare un account piattaforma.
          </div>
        </Card>
      ) : !user ? (
        <Card className="p-6">
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
            Nessun account trovato per <span className="font-medium text-zinc-900">{email}</span>.
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">Stato account</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900">
                    {isDisabled ? "Disattivato" : "Attivo"}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    {isDisabled
                      ? `Bloccato fino a ${formatDate(user.banned_until)}`
                      : "Login e reset password disponibili"}
                  </p>
                </div>
                <Ban className={`h-5 w-5 ${isDisabled ? "text-rose-500" : "text-zinc-400"}`} />
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">Email</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900">
                    {user.email ?? email}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    {user.email_confirmed_at ? "Email confermata" : "Email non ancora confermata"}
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">Accesso recente</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-900">
                    {user.last_sign_in_at ? "Presente" : "Mai entrato"}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    {user.last_sign_in_at
                      ? formatDate(user.last_sign_in_at)
                      : `Creato il ${formatDate(user.created_at)}`}
                  </p>
                </div>
                <UserRound className="h-5 w-5 text-blue-500" />
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <Card className="p-6">
              <CardHeader
                title="Membership"
                subtitle="Workspace a cui l'utente risulta associato."
              />

              {memberships.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
                  Nessuna membership trovata per questo account.
                </div>
              ) : (
                <div className="space-y-3">
                  {memberships.map((membership) => {
                    const organization = membership.organizations?.[0] ?? null;

                    return (
                      <div
                        key={`${membership.organization_id}-${membership.role}`}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                      >
                        <p className="font-medium text-zinc-900">
                          {organization?.name ?? membership.organization_id}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {organization?.slug ?? "slug non disponibile"} - ruolo {membership.role}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <CardHeader
                title="Azioni supporto"
                subtitle="Operazioni rapide per supportare l'utente senza uscire dalla console."
                action={<KeyRound className="h-4 w-4 text-blue-600" />}
              />

              <div className="space-y-3">
                <form action={resendAccountResetLinkAction}>
                  <input type="hidden" name="email" value={user.email ?? email} />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    Reinvio link reset password
                  </button>
                </form>

                {!isDisabled ? (
                  <form action={disablePlatformAccountAction}>
                    <input type="hidden" name="user_id" value={user.id} />
                    <input type="hidden" name="email" value={user.email ?? email} />
                    <button
                      type="submit"
                      className="w-full rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Disattiva account
                    </button>
                  </form>
                ) : (
                  <form action={reactivatePlatformAccountAction}>
                    <input type="hidden" name="user_id" value={user.id} />
                    <input type="hidden" name="email" value={user.email ?? email} />
                    <button
                      type="submit"
                      className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Riattiva account
                    </button>
                  </form>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
