"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder, HelpCircle, LayoutDashboard, LogOut, PlusCircle, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects/new", label: "Create project", icon: PlusCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export function AppNav({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname();

  if (variant === "desktop") {
    return (
      <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
        <div className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href) || (item.href === "/dashboard" && pathname.startsWith("/projects/") && pathname !== "/projects/new");
            const Icon = item.icon === LayoutDashboard && pathname.startsWith("/projects") ? Folder : item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={item.href === "/projects/new" ? false : null}
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition ${
                  active ? "bg-[#dff3f2] text-[#007f83]" : "text-[#344054] hover:bg-[#f2f4f7]"
                }`}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{item.label === "Create project" ? "Create project" : item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="grid gap-1 border-t border-[#e5eaf0] p-3">
          <a className="flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium text-[#344054] hover:bg-[#f2f4f7]">
            <HelpCircle size={18} strokeWidth={1.8} aria-hidden="true" />
            Help
          </a>
          <form action="/api/auth/logout" method="post">
            <button className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-[13px] font-medium text-[#344054] hover:bg-[#f2f4f7]">
              <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-[var(--line)] bg-white md:hidden">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon === PlusCircle ? PlusCircle : item.icon;
        const className = `flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${
          active ? "bg-[var(--teal-wash)] text-[var(--teal)]" : "text-slate-500"
        }`;
        const content = (
          <>
            <Icon size={18} aria-hidden="true" />
            {item.label}
          </>
        );

        return (
          <Link key={item.href} href={item.href} prefetch={item.href === "/projects/new" ? false : null} className={className}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
