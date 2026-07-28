"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cloud, CloudOff, PanelLeftClose, PanelLeftOpen, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { AppNav, SignOutButton } from "@/components/layout/app-nav";
import { BrandMark } from "@/components/layout/brand-mark";
import { OfflineSessionBridge } from "@/components/layout/offline-session-bridge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { CurrentSession } from "@/lib/types";

type OfflineSessionTicket = {
  token: string;
  expiresAt: string;
};

const SIDEBAR_COLLAPSED_STORAGE_KEY = "graph-pixel-sidebar-collapsed";

function compactPageTitle(pathname: string) {
  if (pathname === "/projects/new") return "New project";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Project library";
}

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true");
    } catch {
      // Local storage can be unavailable in restricted browsing modes.
    }
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((collapsed) => {
      const nextCollapsed = !collapsed;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(nextCollapsed));
      } catch {
        // The visual control still works for this session without persistence.
      }
      return nextCollapsed;
    });
  }

  const initials = (session.displayName || session.email || "GP").slice(0, 2).toUpperCase();
  const accountTitle = `${session.displayName || session.email} · ${session.role}`;
  const pageTitle = compactPageTitle(pathname);

  if (isProjectEditor) {
    return (
      <div className="shell atelier-shell atelier-shell--editor">
        {offlineSessionTicket ? <OfflineSessionBridge session={session} offlineSessionTicket={offlineSessionTicket} /> : null}
        <main className="shell-main shell-main--editor">{children}</main>
      </div>
    );
  }

  return (
    <div
      className={"shell atelier-shell " + (sidebarCollapsed ? "is-sidebar-collapsed" : "")}
      data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
    >
      {offlineSessionTicket ? <OfflineSessionBridge session={session} offlineSessionTicket={offlineSessionTicket} /> : null}

      <aside className="workspace-sidebar atelier-sidebar" aria-label="Application navigation">
        <header className="workspace-sidebar__header atelier-sidebar__header">
          <Link
            href="/dashboard"
            className="workspace-sidebar__brand atelier-sidebar__brand"
            aria-label="Graph Pixel Maker dashboard"
          >
            <BrandMark />
          </Link>
          <div className="atelier-sidebar__identity">
            <span>Atelier OS</span>
            <small>Graph-making studio</small>
          </div>
          <button
            type="button"
            className="atelier-sidebar__collapse"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand application sidebar" : "Collapse application sidebar"}
            aria-pressed={sidebarCollapsed}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
          </button>
        </header>

        <div className="workspace-sidebar__body atelier-sidebar__body">
          <section className="atelier-sidebar__workspace" aria-labelledby="atelier-workspace-label">
            <div className="atelier-sidebar__workspace-heading">
              <span className="atelier-sidebar__workspace-mark" aria-hidden="true">
                <Sparkles size={14} />
              </span>
              <span>
                <small id="atelier-workspace-label">Workspace</small>
                <strong>Personal studio</strong>
              </span>
            </div>
            <Link
              href="/projects/new"
              prefetch={false}
              className="atelier-sidebar__create"
              aria-label="Create a new graph project"
            >
              <Plus size={17} aria-hidden="true" />
              <span>New project</span>
            </Link>
          </section>

          <div className="atelier-sidebar__navigation">
            <p className="workspace-sidebar__section-label">Studio</p>
            <AppNav variant="rail" />
          </div>
        </div>

        <footer className="workspace-sidebar__footer atelier-sidebar__footer">
          <div
            className={
              "workspace-sidebar__status atelier-sidebar__connection " +
              (isOnline ? "is-online" : "is-offline")
            }
            role="status"
            title={isOnline ? "Online" : "Offline"}
          >
            <span className="atelier-sidebar__connection-icon" aria-hidden="true">
              {isOnline ? <Cloud size={16} /> : <CloudOff size={16} />}
            </span>
            <span>
              <strong>{isOnline ? "Studio synced" : "Working offline"}</strong>
              <small>{isOnline ? "Changes can be saved" : "Local editing is available"}</small>
            </span>
          </div>

          <div className="workspace-sidebar__account atelier-sidebar__account" title={accountTitle}>
            <span className="shell-avatar atelier-sidebar__avatar" aria-hidden="true">{initials}</span>
            <span className="workspace-sidebar__account-copy">
              <strong>{session.displayName || session.email.split("@")[0]}</strong>
              <small>{session.email}</small>
              <span className="workspace-sidebar__account-role">{session.role}</span>
            </span>
          </div>

          <div className="workspace-sidebar__utilities atelier-sidebar__utilities">
            <div className="workspace-sidebar__theme atelier-sidebar__utility">
              <span className="workspace-sidebar__utility-copy">
                <strong>Studio theme</strong>
                <small>Change appearance</small>
              </span>
              <ThemeToggle variant="rail" />
            </div>
            <SignOutButton variant="rail" />
          </div>
        </footer>
      </aside>

      <header className="shell-mobilebar atelier-topbar">
        <div className="shell-mobilebar__side atelier-topbar__brand">
          <Link href="/dashboard" aria-label="Graph Pixel Maker dashboard">
            <BrandMark />
          </Link>
          <span className="atelier-topbar__divider" aria-hidden="true" />
          <span className="atelier-topbar__page">
            <small>Atelier OS</small>
            <strong>{pageTitle}</strong>
          </span>
        </div>
        <div className="shell-mobilebar__side atelier-topbar__actions">
          <Link
            href="/projects/new"
            prefetch={false}
            className="atelier-topbar__create"
            aria-label="Create a new project"
          >
            <Plus size={18} aria-hidden="true" />
          </Link>
          <span
            className={"shell-status atelier-topbar__status " + (isOnline ? "shell-status--online" : "")}
            role="status"
            aria-label={isOnline ? "Studio synced" : "Working offline"}
          >
            <i aria-hidden="true" />
            <span>{isOnline ? "Synced" : "Offline"}</span>
          </span>
          <ThemeToggle variant="mobile" />
          <span className="shell-avatar" title={accountTitle}>{initials}</span>
        </div>
      </header>

      <main className="shell-main atelier-shell__main">{children}</main>

      <AppNav variant="dock" />
    </div>
  );
}
