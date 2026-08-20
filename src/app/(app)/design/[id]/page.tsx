import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDesignForCurrentUser } from "@/lib/design/server";
import { DesignEditorLoader } from "@/components/design/design-editor-loader";

export default async function DesignEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireSession()]);
  const design = await getDesignForCurrentUser(id);
  if (!design) notFound();
  return <DesignEditorLoader design={design} sessionUserId={session.userId} />;
}
