import Link from "next/link";
import { LogOut } from "lucide-react";
import { AppNav } from "@/components/layout/app-nav";
import { BrandMark } from "@/components/layout/brand-mark";
import { OfflineSessionBridge } from "@/components/layout/offline-session-bridge";
import { createOfflineSessionTicket } from "@/lib/auth/session";
import type { CurrentSession } from "@/lib/types";

export function AppShell({ session, children }: { session: CurrentSession; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--panel)]">
      <OfflineSessionBridge session={session} offlineSessionTicket={createOfflineSessionTicket(session)} />
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <Link href="/dashboard" prefetch={false} aria-label="Graph Pixel Maker dashboard">
            <BrandMark />
          </Link>
          <AppNav variant="desktop" />
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

      <AppNav variant="mobile" />
      <div className="h-16 md:hidden" />
    </div>
  );
}
