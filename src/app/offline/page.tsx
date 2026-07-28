import Link from "next/link";
import { ArrowRight, CloudOff, HardDrive, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section className="offline-card" aria-labelledby="offline-title">
        <div className="offline-card__icon">
          <WifiOff size={22} aria-hidden="true" />
        </div>
        <p className="page-eyebrow"><CloudOff size={13} aria-hidden="true" /> Connection unavailable</p>
        <h1 id="offline-title">Your local studio is still open.</h1>
        <p>
          Opened projects can keep working from this browser session. New online data needs a connection.
        </p>
        <div className="offline-card__capability">
          <HardDrive size={17} aria-hidden="true" />
          <span>
            <strong>Available offline</strong>
            <small>Previously opened editable projects and local session drafts.</small>
          </span>
        </div>
        <Link href="/dashboard" className="ui-btn ui-btn-primary offline-card__action">
          Try your workspace <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
