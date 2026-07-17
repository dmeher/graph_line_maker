import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--background)] p-6">
      <section className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-8 text-center shadow-[var(--shadow-soft)]">
        <div className="mx-auto grid h-13 w-13 place-items-center rounded-xl border border-[rgb(251_191_36_/_0.3)] bg-[rgb(251_191_36_/_0.12)] p-3 text-[var(--amber)]">
          <WifiOff size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-[var(--foreground)]">You are offline</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Opened projects can keep working from this browser session. New online data needs a connection.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--teal)] px-5 text-sm font-semibold text-[#052722]"
        >
          Try dashboard
        </Link>
      </section>
    </main>
  );
}
