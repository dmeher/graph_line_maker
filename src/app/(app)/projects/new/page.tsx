import { NewProjectForm } from "@/components/projects/new-project-form";

export const metadata = {
  title: "New project",
};

export default function NewProjectPage() {
  return (
    <div className="p-3 sm:p-4 lg:p-5">
      <NewProjectForm />
    </div>
  );
}

