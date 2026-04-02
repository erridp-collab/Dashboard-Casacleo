"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Euro, Home, Settings, Warehouse } from "lucide-react";

const NAV_ITEMS = [
  { href: "/actions", label: "Azioni", icon: ClipboardList },
  { href: "/bookings", label: "Prenot.", icon: Home },
  { href: "/inventory", label: "Scorte", icon: Warehouse },
  { href: "/finance", label: "Spese", icon: Euro },
  { href: "/settings", label: "Impost.", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around px-1 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition ${
                active ? "text-blue-600" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
