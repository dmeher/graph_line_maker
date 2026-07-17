import { notFound } from "next/navigation";
import { NewProjectForm } from "@/components/projects/new-project-form";

export default function DevCropTestPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="p-3 sm:p-4 lg:p-5">
      <NewProjectForm />
    </main>
  );
}
