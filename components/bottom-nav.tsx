"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Euro, Home, Settings, Warehouse } from "lucide-react";

const NAV_ITEMS = [
  { href: "/actions", label: "Azioni", icon: ClipboardList },
  { href: "/bookings", label: "Prenotazioni", icon: Home },
  { href: "/inventory", label: "Rifornimento", icon: Warehouse },
  { href: "/finance", label: "Spese", icon: Euro },
  { href: "/settings", label: "Impostazioni", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/platform")
  ) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-brand-dark md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        willChange: "transform",
        transform: "translateZ(0)",
      }}
    >
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[54px] flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors duration-150 ${
                active ? "text-gold" : "text-white/55 hover:text-white"
              }`}
            >
              {active && <span className="absolute inset-x-3 top-0 h-[3px] rounded-b-sm bg-gold" aria-hidden="true" />}
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" strokeWidth={active ? 2.5 : 1.75} />
              <span
                className={`w-full truncate text-center text-[10px] leading-tight ${active ? "font-bold" : "font-medium"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
