"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Settings, LayoutDashboard, LogOut } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import type { CurrentSession } from "@/lib/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects/new", label: "New", icon: Plus },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ session, children }: { session: CurrentSession; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[var(--panel)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <Link href="/dashboard" prefetch={false} aria-label="Graph Pixel Maker dashboard">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                    active ? "bg-teal-50 text-[var(--teal)]" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={16} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-xs font-semibold text-slate-950">{session.displayName || session.email}</p>
              <p className="text-xs capitalize text-slate-500">{session.role}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)] bg-white text-slate-600 hover:bg-slate-50"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px]">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-[var(--line)] bg-white md:hidden">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${
                active ? "text-[var(--teal)]" : "text-slate-500"
              }`}
            >
              <Icon size={18} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="h-16 md:hidden" />
    </div>
  );
}
