import { notFound } from "next/navigation";
import { EditorClient } from "@/components/editor/editor-client";
import { getCurrentSession } from "@/lib/auth/session";
import { getMockEditorProject, getProjectForCurrentUser, getProjectOwnerLabel } from "@/lib/projects";

export const metadata = {
  title: "Project editor",
};

export default async function ProjectEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "mock-editor") return <EditorClient project={getMockEditorProject()} />;

  const project = await getProjectForCurrentUser(id);
  if (!project) notFound();

  // Admins can open any project, so the editor must say whose it is. The extra
  // lookup only runs on that path; the session is request-memoized.
  const session = await getCurrentSession();
  const ownerLabel = session && session.userId !== project.userId ? await getProjectOwnerLabel(project.userId) : null;

  return <EditorClient project={project} ownerLabel={ownerLabel} />;
}
