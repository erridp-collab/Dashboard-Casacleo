"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, ClipboardList, Euro, Home, Plus, Warehouse } from "lucide-react";

const NAV_ITEMS = [
  { href: "/bookings", label: "Bookings", icon: Home },
  { href: "/actions", label: "Actions", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/finance", label: "Finance", icon: Euro },
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

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
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

        <Link
          href="/bookings"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New booking
        </Link>
      </div>
    </header>
  );
}

