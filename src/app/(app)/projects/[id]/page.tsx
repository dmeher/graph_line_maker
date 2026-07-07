import { notFound } from "next/navigation";
import { EditorClient } from "@/components/editor/editor-client";
import { getMockEditorProject, getProjectForCurrentUser } from "@/lib/projects";

export const metadata = {
  title: "Project editor",
};

export default async function ProjectEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "mock-editor") return <EditorClient project={getMockEditorProject()} />;

  const project = await getProjectForCurrentUser(id);
  if (!project) notFound();

  return <EditorClient project={project} />;
}
