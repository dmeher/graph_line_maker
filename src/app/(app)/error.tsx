"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button, EmptyState } from "@/components/ui/primitives";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="system-state-page">
      <EmptyState
        className="system-state-card system-state-card--error"
        icon={<AlertTriangle size={28} />}
        title="This workspace could not be loaded"
        description="Your projects are unchanged. Check your connection and try loading this page again."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button tone="primary" onClick={reset}><RefreshCw size={16} /> Try again</Button>
            <Link href="/dashboard" className="ui-button">Return to projects</Link>
          </div>
        }
      />
    </main>
  );
}
