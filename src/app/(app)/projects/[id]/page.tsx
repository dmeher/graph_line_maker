import { notFound } from "next/navigation";
import { EditorClient } from "@/components/editor/editor-client";
import { getProjectForCurrentUser } from "@/lib/projects";

export const metadata = {
  title: "Project editor",
};

export default async function ProjectEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectForCurrentUser(id);
  if (!project) notFound();

  return <EditorClient project={project} />;
}
