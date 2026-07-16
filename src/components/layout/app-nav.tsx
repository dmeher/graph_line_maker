"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Folder, LayoutDashboard, Loader2, LogOut, PlusCircle, Settings } from "lucide-react";
import { useState, type FormEvent } from "react";
import { OFFLINE_SESSION_STORAGE_KEY, USER_DATA_CLEAR_MESSAGE } from "@/lib/auth/offline-session";
import { clearEditorSessionDrafts } from "@/lib/editor/session-draft";

const navItems = [
  { href: "/dashboard", label: "Dashboard", mobileLabel: "Projects", icon: LayoutDashboard },
  { href: "/projects/new", label: "Create project", mobileLabel: "Create", icon: PlusCircle },
  { href: "/settings", label: "Settings", mobileLabel: "Settings", icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export function AppNav({ variant, collapsed = false }: { variant: "desktop" | "mobile"; collapsed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function logout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error("Unable to sign out.");
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; redirectTo?: string } | null;
      if (!payload?.ok) throw new Error("Unable to sign out.");
      try {
        window.sessionStorage.removeItem(OFFLINE_SESSION_STORAGE_KEY);
        clearEditorSessionDrafts(window.sessionStorage);
      } catch {
        // Storage can be blocked in restricted browsing modes.
      }
      if ("serviceWorker" in navigator) {
        const message = { type: USER_DATA_CLEAR_MESSAGE };
        navigator.serviceWorker.controller?.postMessage(message);
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        registration?.active?.postMessage(message);
      }
      window.dispatchEvent(new Event(USER_DATA_CLEAR_MESSAGE));
      const redirectTo = payload.redirectTo || "/login";
      router.replace(redirectTo);
      router.refresh();
      window.setTimeout(() => {
        if (window.location.pathname !== redirectTo) window.location.assign(redirectTo);
      }, 1200);
    } catch (error) {
      setLoggingOut(false);
      setLogoutError(error instanceof Error ? error.message : "Unable to sign out. Check your connection and try again.");
    }
  }

  if (variant === "desktop") {
    return (
      <nav className={"app-nav flex flex-1 flex-col gap-1 " + (collapsed ? "app-nav--collapsed" : "")} aria-label="Primary">
        <div className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href) || (item.href === "/dashboard" && pathname.startsWith("/projects/") && pathname !== "/projects/new");
            const Icon = item.icon === LayoutDashboard && pathname.startsWith("/projects") ? Folder : item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={item.href === "/projects/new" ? false : null}
                title={collapsed ? item.label : undefined}
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition ${
                  active ? "bg-[#dff3f2] text-[#007f83]" : "text-[#344054] hover:bg-[#f2f4f7]"
                }`}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span className="app-nav__label">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="grid gap-1 border-t border-[#e5eaf0] p-3">
          <form action="/api/auth/logout" method="post" onSubmit={logout}>
            <button disabled={loggingOut} className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-[13px] font-medium text-[#344054] hover:bg-[#f2f4f7] disabled:opacity-60">
              {loggingOut ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />}
              <span className="app-nav__label">{loggingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </form>
          {logoutError ? <p className="px-3 py-1 text-xs leading-5 text-red-700" role="alert">{logoutError}</p> : null}
        </div>
      </nav>
    );
  }

  return (
    <nav className="mobile-app-nav" aria-label="Primary">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon === PlusCircle ? PlusCircle : item.icon;
        const className = `flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${
          active ? "bg-[var(--teal-wash)] text-[var(--teal)]" : "text-slate-500"
        }`;
        const content = (
          <>
            <Icon size={18} aria-hidden="true" />
            {item.mobileLabel}
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
