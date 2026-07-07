"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plus, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects/new", label: "New", icon: Plus },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export function AppNav({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname();

  if (variant === "desktop") {
    return (
      <nav className="hidden items-center gap-1 md:flex">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          const className = `inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
            active ? "bg-teal-50 text-[var(--teal)]" : "text-slate-600 hover:bg-slate-100"
          }`;
          const content = (
            <>
              <Icon size={16} aria-hidden="true" />
              {item.label}
            </>
          );

          return (
            <Link key={item.href} href={item.href} prefetch={false} className={className}>
              {content}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-[var(--line)] bg-white md:hidden">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        const className = `flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${
          active ? "text-[var(--teal)]" : "text-slate-500"
        }`;
        const content = (
          <>
            <Icon size={18} aria-hidden="true" />
            {item.label}
          </>
        );

        return (
          <Link key={item.href} href={item.href} prefetch={false} className={className}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
