import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { listDesignLibrary, listDesignSummaries } from "@/lib/design/server";
import { DesignWorkspace } from "@/components/design/design-workspace";

export const metadata: Metadata = { title: "Design workspace | Graph Pixel Maker" };

export default async function DesignPage() {
  const session = await requireSession();
  const [library, drafts, templates] = await Promise.all([
    listDesignLibrary({ limit: 48 }),
    listDesignSummaries({ kind: "document", includeAll: session.role === "admin", limit: 48 }),
    listDesignSummaries({ kind: "template", includeAll: session.role === "admin", limit: 48 }),
  ]);
  return <DesignWorkspace session={session} initialLibrary={library.items} initialLibraryCursor={library.nextCursor} initialDrafts={drafts} initialTemplates={templates} />;
}
