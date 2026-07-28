import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";

export default function AppNotFound() {
  return (
    <main className="system-state-page">
      <EmptyState
        className="system-state-card"
        icon={<FileQuestion size={28} />}
        title="Project not found"
        description="The project may have been removed or you may not have access to it."
        action={<Link href="/dashboard" className="ui-button ui-button--primary">Return to projects</Link>}
      />
    </main>
  );
}
