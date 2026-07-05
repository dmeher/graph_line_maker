import Link from "next/link";
import { Copy, Plus, Search, Trash2 } from "lucide-react";
import { duplicateProject, deleteProject } from "@/app/(app)/projects/actions";
import { getProjectSummaries } from "@/lib/projects";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const projects = await getProjectSummaries(params.q);

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">
      <section className="rounded-md border border-[var(--line)] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-950">Projects</h1>
            <p className="mt-1 text-sm text-slate-600">Open saved graph charts or create a new line-art conversion.</p>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white shadow-sm"
          >
            <Plus size={16} aria-hidden="true" />
            Create project
          </Link>
        </div>

        <form className="mt-5 flex max-w-xl gap-2">
          <label className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={params.q || ""}
              placeholder="Search projects"
              className="h-11 w-full rounded-md border border-[var(--line)] pl-9 pr-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <button className="h-11 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-slate-700">
            Search
          </button>
        </form>
      </section>

      <section className="rounded-md border border-[var(--line)] bg-white shadow-sm">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-950">{projects.length} saved projects</h2>
        </div>

        {projects.length ? (
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {["Project", "Updated", "Size", "Colors", "Palette", "Actions"].map((head) => (
                    <th key={head} className="border-b border-[var(--line)] px-4 py-3">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50">
                    <td className="border-b border-[var(--line)] px-4 py-3">
                      <Link href={`/projects/${project.id}`} className="font-semibold text-slate-950 hover:text-[var(--teal)]">
                        {project.title}
                      </Link>
                      <p className="mt-1 max-w-sm truncate text-xs text-slate-500">{project.description || "No description"}</p>
                    </td>
                    <td className="border-b border-[var(--line)] px-4 py-3 text-slate-600">{formatDateTime(project.updatedAt)}</td>
                    <td className="border-b border-[var(--line)] px-4 py-3 font-mono text-xs text-slate-600">
                      {project.width} x {project.height}
                    </td>
                    <td className="border-b border-[var(--line)] px-4 py-3">{project.colorCount}</td>
                    <td className="border-b border-[var(--line)] px-4 py-3">
                      <div className="flex gap-1">
                        {project.palettePreview.length ? (
                          project.palettePreview.map((color) => (
                            <span
                              key={`${project.id}-${color.hex}-${color.sortOrder}`}
                              className="h-5 w-5 rounded-sm border border-slate-200"
                              style={{ backgroundColor: color.hex }}
                              title={`${color.name}: ${color.cellCount}`}
                            />
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">Not processed</span>
                        )}
                      </div>
                    </td>
                    <td className="border-b border-[var(--line)] px-4 py-3">
                      <div className="flex gap-2">
                        <form action={duplicateProject}>
                          <input type="hidden" name="projectId" value={project.id} />
                          <button className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50" title="Duplicate">
                            <Copy size={15} aria-hidden="true" />
                          </button>
                        </form>
                        <form action={deleteProject}>
                          <input type="hidden" name="projectId" value={project.id} />
                          <button className="grid h-9 w-9 place-items-center rounded-md border border-red-200 text-red-600 hover:bg-red-50" title="Delete">
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">No projects yet</h2>
              <p className="mt-2 max-w-md text-sm text-slate-600">
                Upload a lining image and create your first graph-paper pixel chart.
              </p>
              <Link
                href="/projects/new"
                className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white"
              >
                Create project
              </Link>
            </div>
          </div>
        )}

        {projects.length ? (
          <div className="divide-y divide-[var(--line)] lg:hidden">
            {projects.map((project) => (
              <article key={project.id} className="space-y-3 p-4">
                <div>
                  <Link href={`/projects/${project.id}`} className="font-semibold text-slate-950">
                    {project.title}
                  </Link>
                  <p className="mt-1 text-sm text-slate-600">{project.description || "No description"}</p>
                  <p className="mt-2 font-mono text-xs text-slate-500">
                    {project.width} x {project.height} - {project.colorCount} colors
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-1">
                    {project.palettePreview.map((color) => (
                      <span key={`${project.id}-mobile-${color.hex}-${color.sortOrder}`} className="h-5 w-5 rounded-sm border" style={{ backgroundColor: color.hex }} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <form action={duplicateProject}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <button className="h-9 rounded-md border border-[var(--line)] px-3 text-sm font-semibold text-slate-700">
                        Duplicate
                      </button>
                    </form>
                    <form action={deleteProject}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <button className="h-9 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-600">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

