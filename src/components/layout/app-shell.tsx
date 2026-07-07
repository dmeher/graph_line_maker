import Link from "next/link";
import { ChevronDown, CircleHelp, Cloud, Grid3X3, Home, Menu, Moon } from "lucide-react";
import { AppNav } from "@/components/layout/app-nav";
import { BrandMark } from "@/components/layout/brand-mark";
import { OfflineSessionBridge } from "@/components/layout/offline-session-bridge";
import { createOfflineSessionTicket } from "@/lib/auth/session";
import type { CurrentSession } from "@/lib/types";

export function AppShell({ session, children }: { session: CurrentSession; children: React.ReactNode }) {
  return (
    <div className="mock-shell">
      <OfflineSessionBridge session={session} offlineSessionTicket={createOfflineSessionTicket(session)} />
      <header className="mock-topbar">
        <div className="flex min-w-0 items-center gap-5">
          <button className="grid h-9 w-9 place-items-center rounded-md text-[#101828] hover:bg-[#f2f4f7]" aria-label="Menu">
            <Menu size={22} strokeWidth={1.8} />
          </button>
          <Link href="/dashboard" prefetch={false} aria-label="Graph Pixel Maker dashboard" className="[--brand-text:#101828]">
            <BrandMark />
          </Link>
        </div>

        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden items-center gap-2 text-sm font-medium text-[#101828] lg:flex">
            <Cloud size={19} className="text-[#008c8f]" strokeWidth={1.8} />
            <span>Online</span>
          </div>
          <button className="hidden h-9 w-9 place-items-center rounded-full text-[#101828] hover:bg-[#f2f4f7] sm:grid" aria-label="Home">
            <Home size={18} strokeWidth={1.8} />
          </button>
          <button className="hidden h-9 w-9 place-items-center rounded-full text-[#101828] hover:bg-[#f2f4f7] sm:grid" aria-label="Apps">
            <Grid3X3 size={18} strokeWidth={1.8} />
          </button>
          <button className="hidden h-9 w-9 place-items-center rounded-full text-[#101828] hover:bg-[#f2f4f7] sm:grid" aria-label="Help">
            <CircleHelp size={19} strokeWidth={1.8} />
          </button>
          <button className="hidden h-9 w-9 place-items-center rounded-full text-[#101828] hover:bg-[#f2f4f7] sm:grid" aria-label="Theme">
            <Moon size={18} strokeWidth={1.8} />
          </button>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#007f83] text-sm font-semibold text-white">
              {(session.displayName || session.email || "DM").slice(0, 2).toUpperCase()}
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold leading-4 text-[#101828]">{session.displayName || "Demo User"}</p>
              <p className="text-xs capitalize leading-4 text-[#667085]">{session.role}</p>
            </div>
            <ChevronDown size={17} className="hidden text-[#101828] sm:block" strokeWidth={1.8} />
          </div>
        </div>
      </header>

      <aside className="mock-sidebar">
        <AppNav variant="desktop" />
      </aside>

      <main className="mock-main">{children}</main>

      <AppNav variant="mobile" />
      <div className="h-16 md:hidden" />
    </div>
  );
}
