import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PlatformForbiddenError,
  PlatformUnauthorizedError,
  requirePlatformAdmin,
} from "@/lib/platformAdmin";

const PLATFORM_NAV_ITEMS = [
  { href: "/platform", label: "Overview" },
  { href: "/platform/requests", label: "Richieste" },
  { href: "/platform/accounts", label: "Account" },
];

async function requirePlatformAdminOrRedirect() {
  try {
    return await requirePlatformAdmin();
  } catch (error) {
    if (error instanceof PlatformUnauthorizedError) {
      redirect("/login");
    }
    if (error instanceof PlatformForbiddenError) {
      redirect("/");
    }
    throw error;
  }
}

export default async function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await requirePlatformAdminOrRedirect();

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
            Platform
          </p>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-zinc-900">Console piattaforma</h1>
              <p className="max-w-3xl text-sm text-zinc-600">
                Gestione richieste accesso, provisioning account e operazioni amministrative.
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              <span className="font-medium text-zinc-900">Admin:</span>{" "}
              {admin.email ?? admin.userId}
            </div>
          </div>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          {PLATFORM_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {children}
    </section>
  );
}
