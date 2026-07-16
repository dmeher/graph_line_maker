"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cloud, CloudOff, Menu, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/layout/app-nav";
import { BrandMark } from "@/components/layout/brand-mark";
import { OfflineSessionBridge } from "@/components/layout/offline-session-bridge";
import type { CurrentSession } from "@/lib/types";

type OfflineSessionTicket = {
  token: string;
  expiresAt: string;
};

const SIDEBAR_COLLAPSED_STORAGE_KEY = "graph-pixel-sidebar-collapsed";

export function AppShell({
  session,
  offlineSessionTicket,
  children,
}: {
  session: CurrentSession;
  offlineSessionTicket: OfflineSessionTicket | null;
  children: React.ReactNode;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const pathname = usePathname();
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const isProjectEditor = pathname.startsWith("/projects/") && pathname !== "/projects/new";
  const showShellChrome = !isProjectEditor;

  const toggleNavigation = useCallback(() => {
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    if (desktop && !isProjectEditor) {
      setIsSidebarCollapsed((value) => {
        const next = !value;
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
        return next;
      });
      return;
    }
    setIsMenuOpen((value) => !value);
  }, [isProjectEditor]);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    try {
      setIsSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true");
    } catch {
      // Keep the expanded default when browser storage is unavailable.
    }
  }, []);

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
    function handleEditorMenu() {
      setIsMenuOpen((value) => !value);
    }
    window.addEventListener("graph-pixel-editor-menu", handleEditorMenu);
    return () => window.removeEventListener("graph-pixel-editor-menu", handleEditorMenu);
  }, []);

  const shellClassName = "mock-shell" + (isProjectEditor ? " mock-shell--editor" : "") + (isSidebarCollapsed ? " mock-shell--sidebar-collapsed" : "");
  const sidebarClassName =
    "mock-sidebar" +
    (isMenuOpen ? " mock-sidebar--open" : "") +
    (isSidebarCollapsed ? " mock-sidebar--collapsed" : "");
  const mainClassName = "mock-main" + (isProjectEditor ? " mock-main-editor" : "");

  return (
    <div className={shellClassName}>
      {offlineSessionTicket ? <OfflineSessionBridge session={session} offlineSessionTicket={offlineSessionTicket} /> : null}
      {isMenuOpen ? <button type="button" className="mock-nav-backdrop" aria-label="Close navigation" onClick={closeMenu} /> : null}

      {showShellChrome ? (
        <header className="mock-topbar">
          <div className="mock-topbar__brand">
            <button
              type="button"
              className="ui-btn-icon mock-menu-button"
              aria-label={isMenuOpen ? "Close navigation" : isSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={isMenuOpen || !isSidebarCollapsed}
              onClick={toggleNavigation}
            >
              <Menu size={20} strokeWidth={1.8} />
            </button>
            <Link href="/dashboard" aria-label="Graph Pixel Maker dashboard" className="[--brand-text:#101828]">
              <BrandMark />
            </Link>
          </div>

          <div className="mock-topbar__actions">
            <span className={"connection-status " + (isOnline ? "connection-status--online" : "connection-status--offline")} role="status">
              {isOnline ? <Cloud size={16} aria-hidden="true" /> : <CloudOff size={16} aria-hidden="true" />}
              <span>{isOnline ? "Online" : "Offline"}</span>
            </span>
            <Link href="/projects/new" prefetch={false} className="ui-btn ui-btn-primary mock-topbar__create">
              <Plus size={16} aria-hidden="true" />
              <span>New project</span>
            </Link>
            <div className="mock-account" title={session.email}>
              <span className="mock-account__avatar">
                {(session.displayName || session.email || "GP").slice(0, 2).toUpperCase()}
              </span>
              <span className="mock-account__copy">
                <strong>{session.displayName || session.email.split("@")[0]}</strong>
                <small>{session.role}</small>
              </span>
            </div>
          </div>
        </header>
      ) : null}

      <aside className={sidebarClassName} aria-label="Application navigation">
        <div className="mock-sidebar-head">
          <Link href="/dashboard" className="[--brand-text:#101828]" aria-label="Graph Pixel Maker dashboard">
            <BrandMark />
          </Link>
          <button type="button" onClick={closeMenu} className="mock-sidebar-close" aria-label="Close navigation">
            <X size={17} strokeWidth={1.8} />
          </button>
        </div>
        <AppNav variant="desktop" collapsed={isSidebarCollapsed && !isProjectEditor} />
      </aside>

      <main className={mainClassName}>{children}</main>

      {showShellChrome ? <AppNav variant="mobile" /> : null}
      {showShellChrome ? <div className="h-[calc(64px+env(safe-area-inset-bottom))] md:hidden" /> : null}
    </div>
  );
}
