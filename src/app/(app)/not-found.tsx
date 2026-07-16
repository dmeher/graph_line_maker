import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";

export default function AppNotFound() {
  return (
    <main className="grid min-h-[70dvh] place-items-center p-5">
      <EmptyState
        icon={<FileQuestion size={28} />}
        title="Project not found"
        description="The project may have been removed or you may not have access to it."
        action={<Link href="/dashboard" className="ui-button ui-button--primary">Return to projects</Link>}
      />
    </main>
  );
}
