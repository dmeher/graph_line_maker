import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-white p-6">
      <section className="w-full max-w-md rounded-md border border-[var(--line)] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-slate-100 text-slate-700">
          <WifiOff size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">You are offline</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Opened projects can keep working from this browser session. New online data needs a connection.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white"
        >
          Try dashboard
        </Link>
      </section>
    </main>
  );
}
