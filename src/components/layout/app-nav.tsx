"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Loader2, LogOut, PlusCircle, Settings } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { OFFLINE_SESSION_STORAGE_KEY, USER_DATA_CLEAR_MESSAGE } from "@/lib/auth/offline-session";
import { clearEditorSessionDrafts } from "@/lib/editor/session-draft";

const navItems = [
  { href: "/dashboard", label: "Projects", icon: LayoutGrid },
  { href: "/projects/new", label: "Create", icon: PlusCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/dashboard") return pathname.startsWith("/projects/") && pathname !== "/projects/new";
  return pathname.startsWith(href);
}

/** Shared sign-out control: clears drafts/offline tickets and service-worker data on success. */
export function SignOutButton({ variant }: { variant: "rail" | "dock" }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (loggingOut) return;
    setLoggingOut(true);

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
    } catch {
      setLoggingOut(false);
    }
  }

  if (variant === "rail") {
    return (
      <button
        type="button"
        onClick={logout}
        disabled={loggingOut}
        className="shell-signout"
        title={loggingOut ? "Signing out…" : "Sign out"}
        aria-label={loggingOut ? "Signing out" : "Sign out"}
      >
        {loggingOut ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <LogOut size={17} strokeWidth={1.9} aria-hidden="true" />}
      </button>
    );
  }

  return (
    <button type="button" onClick={logout} disabled={loggingOut} aria-label={loggingOut ? "Signing out" : "Sign out"}>
      {loggingOut ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <LogOut size={18} strokeWidth={1.9} aria-hidden="true" />}
      Sign out
    </button>
  );
}

export function AppNav({ variant }: { variant: "rail" | "dock" }) {
  const pathname = usePathname();

  if (variant === "rail") {
    return (
      <nav className="shell-rail__nav" aria-label="Primary">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.href === "/projects/new" ? false : null}
              className={"shell-rail__item " + (active ? "is-active" : "")}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="shell-dock" aria-label="Primary">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={item.href === "/projects/new" ? false : null}
            className={active ? "is-active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
      <SignOutButton variant="dock" />
    </nav>
  );
}
