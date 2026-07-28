"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LibraryBig, LoaderCircle, LogOut, PenTool, SlidersHorizontal } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { OFFLINE_SESSION_STORAGE_KEY, USER_DATA_CLEAR_MESSAGE } from "@/lib/auth/offline-session";
import { clearEditorSessionDrafts } from "@/lib/editor/session-draft";

const navItems = [
  { href: "/dashboard", label: "Projects", description: "Browse your studio", icon: LibraryBig },
  { href: "/projects/new", label: "Create", description: "Convert new artwork", icon: PenTool },
  { href: "/settings", label: "Settings", description: "Account and access", icon: SlidersHorizontal },
] as const;

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
        className="workspace-sidebar__action workspace-signout atelier-sidebar__signout"
        title={loggingOut ? "Signing out…" : "Sign out"}
        aria-label={loggingOut ? "Signing out" : "Sign out"}
      >
        <span className="workspace-sidebar__action-icon" aria-hidden="true">
          {loggingOut ? <LoaderCircle size={17} className="animate-spin" /> : <LogOut size={17} strokeWidth={1.8} />}
        </span>
        <span className="workspace-sidebar__action-copy">
          <strong>{loggingOut ? "Signing out…" : "Sign out"}</strong>
          <small>{loggingOut ? "Closing your session" : "End this workspace session"}</small>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loggingOut}
      className="atelier-dock__signout"
      aria-label={loggingOut ? "Signing out" : "Sign out"}
    >
      {loggingOut ? <LoaderCircle size={19} className="animate-spin" aria-hidden="true" /> : <LogOut size={19} strokeWidth={1.8} aria-hidden="true" />}
      <span>Sign out</span>
    </button>
  );
}

export function AppNav({ variant }: { variant: "rail" | "dock" }) {
  const pathname = usePathname();

  if (variant === "rail") {
    return (
      <nav className="workspace-nav atelier-sidebar-nav" aria-label="Primary">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.href === "/projects/new" ? false : null}
              className={"workspace-nav__item atelier-nav__item " + (active ? "is-active" : "")}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
            >
              <span className="workspace-nav__icon atelier-nav__icon" aria-hidden="true">
                <Icon size={19} strokeWidth={1.8} />
              </span>
              <span className="workspace-nav__copy atelier-nav__copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
              <span className="atelier-nav__indicator" aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="shell-dock atelier-dock" aria-label="Primary">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={item.href === "/projects/new" ? false : null}
            className={"atelier-dock__item " + (active ? "is-active" : "")}
            aria-current={active ? "page" : undefined}
          >
            <span className="atelier-dock__icon" aria-hidden="true">
              <Icon size={19} strokeWidth={1.8} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
      <SignOutButton variant="dock" />
    </nav>
  );
}
