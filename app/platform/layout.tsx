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
      <header className="rounded-2xl border border-border-strong/12 bg-surface-raised p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand-primary">
            Platform
          </p>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-text-primary">Console piattaforma</h1>
              <p className="max-w-3xl text-sm text-text-secondary">
                Gestione richieste accesso, provisioning account e operazioni amministrative.
              </p>
            </div>
            <div className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Admin:</span>{" "}
              {admin.email ?? admin.userId}
            </div>
          </div>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          {PLATFORM_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-border-strong/18 px-4 py-2 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-brand-primary/6 hover:text-text-primary"
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
