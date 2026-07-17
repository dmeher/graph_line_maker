"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav, SignOutButton } from "@/components/layout/app-nav";
import { BrandMark, LogoMark } from "@/components/layout/brand-mark";
import { OfflineSessionBridge } from "@/components/layout/offline-session-bridge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { CurrentSession } from "@/lib/types";

type OfflineSessionTicket = {
  token: string;
  expiresAt: string;
};

export function AppShell({
  session,
  offlineSessionTicket,
  children,
}: {
  session: CurrentSession;
  offlineSessionTicket: OfflineSessionTicket | null;
  children: React.ReactNode;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const pathname = usePathname();
  const isProjectEditor = pathname.startsWith("/projects/") && pathname !== "/projects/new";

  useEffect(() => {
    function syncOnlineState() {
      setIsOnline(navigator.onLine);
    }
    syncOnlineState();
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);
    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

  const initials = (session.displayName || session.email || "GP").slice(0, 2).toUpperCase();
  const accountTitle = `${session.displayName || session.email} · ${session.role}`;

  if (isProjectEditor) {
    return (
      <div className="shell">
        {offlineSessionTicket ? <OfflineSessionBridge session={session} offlineSessionTicket={offlineSessionTicket} /> : null}
        <main className="shell-main shell-main--editor">{children}</main>
      </div>
    );
  }

  return (
    <div className="shell">
      {offlineSessionTicket ? <OfflineSessionBridge session={session} offlineSessionTicket={offlineSessionTicket} /> : null}

      <aside className="shell-rail" aria-label="Application navigation">
        <Link href="/dashboard" className="shell-rail__logo" aria-label="Graph Pixel Maker dashboard">
          <LogoMark className="h-10 w-10" />
        </Link>
        <AppNav variant="rail" />
        <div className="shell-rail__foot">
          <span
            className={"shell-status " + (isOnline ? "shell-status--online" : "")}
            role="status"
            title={isOnline ? "Online" : "Offline"}
          >
            <i aria-hidden="true" />
            <span className="sr-only">{isOnline ? "Online" : "Offline"}</span>
          </span>
          <ThemeToggle variant="rail" />
          <span className="shell-avatar" title={accountTitle}>{initials}</span>
          <SignOutButton variant="rail" />
        </div>
      </aside>

      <header className="shell-mobilebar">
        <div className="shell-mobilebar__side">
          <Link href="/dashboard" aria-label="Graph Pixel Maker dashboard">
            <BrandMark />
          </Link>
        </div>
        <div className="shell-mobilebar__side">
          <span className={"shell-status " + (isOnline ? "shell-status--online" : "")} role="status">
            <i aria-hidden="true" />
            {isOnline ? "Online" : "Offline"}
          </span>
          <ThemeToggle variant="mobile" />
          <span className="shell-avatar" title={accountTitle}>{initials}</span>
        </div>
      </header>

      <main className="shell-main">{children}</main>

      <AppNav variant="dock" />
    </div>
  );
}
