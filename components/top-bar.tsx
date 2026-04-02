"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, Euro, Home, Plus, Settings, Warehouse } from "lucide-react";

const NAV_ITEMS = [
  { href: "/actions", label: "Azioni", icon: ClipboardList },
  { href: "/bookings", label: "Prenotazioni", icon: Home },
  { href: "/inventory", label: "Rifornimento", icon: Warehouse },
  { href: "/finance", label: "Spese", icon: Euro },
  { href: "/settings", label: "Impostazioni", icon: Settings },
];

export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 rounded-xl px-2 py-1 text-zinc-900 hover:bg-zinc-100">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold">Airbnb Manager</span>
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
                  active ? "bg-blue-50 text-blue-700" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Spacer on mobile so CTA stays on the right */}
        <div className="flex-1 md:hidden" />

        <Link
          href="/bookings"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuova prenotazione</span>
        </Link>
      </div>
    </header>
  );
}
