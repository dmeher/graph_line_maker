import Link from "next/link";
import { Copy, Plus, Search, Trash2 } from "lucide-react";
import { duplicateProject, deleteProject } from "@/app/(app)/projects/actions";
import { getProjectSummaries } from "@/lib/projects";
import { formatDateTime } from "@/lib/utils/format";
import type { ProjectSummary } from "@/lib/types";

export const metadata = {
  title: "Dashboard",
};

const placeholderProjects = [
  ["Mountain Landscape", "mountain_landscape.png", "96 x 96", 22, ["#14213d", "#4d908e", "#90be6d", "#f9c74f"]],
  ["City Skyline", "city_skyline.png", "128 x 64", 24, ["#001219", "#005f73", "#94d2bd", "#e9d8a6"]],
  ["Forest Path", "forest_path.png", "96 x 96", 20, ["#1b4332", "#2d6a4f", "#74c69d", "#d8f3dc"]],
  ["Sunset Over Sea", "sunset_over_sea.png", "128 x 64", 18, ["#f94144", "#f3722c", "#f9c74f", "#277da1"]],
  ["Pixel Character", "pixel_character.png", "64 x 64", 16, ["#264653", "#e76f51", "#f4a261", "#2a9d8f"]],
  ["Retro Car", "retro_car.png", "96 x 64", 19, ["#111827", "#dc2626", "#f8fafc", "#64748b"]],
  ["Game Tileset", "game_tileset.png", "128 x 128", 32, ["#4a3728", "#8f5d3c", "#6b8e23", "#c9b37e"]],
] as const;

function PreviewStrip({ colors }: { colors: readonly string[] }) {
  return (
    <div className="grid h-10 w-[148px] grid-cols-12 overflow-hidden rounded-sm border border-[#d7dde5] bg-white">
      {Array.from({ length: 48 }).map((_, index) => (
        <span
          key={index}
          className="border-r border-b border-white/30"
          style={{ backgroundColor: colors[(index + Math.floor(index / 12)) % colors.length] }}
        />
      ))}
    </div>
  );
}

function PaletteDots({ colors }: { colors: readonly string[] }) {
  return (
    <div className="flex gap-0.5">
      {colors.map((color, index) => (
        <span key={`${color}-${index}`} className="h-3.5 w-3.5 rounded-[2px] border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}

function projectColors(project: ProjectSummary) {
  return project.palettePreview.length ? project.palettePreview.map((color) => color.hex) : ["#008c8f", "#111827", "#e5e7eb", "#f97316"];
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const projects = await getProjectSummaries(params.q);
  const showingPlaceholders = projects.length === 0;

  return (
    <div className="mock-card min-h-[calc(100dvh-96px)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#d7dde5] px-6 py-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-[#101828]">Projects</h1>
        </div>
        <Link href="/projects/new" prefetch={false} className="mock-btn mock-btn-primary">
          Create project
          <Plus size={16} strokeWidth={2} />
        </Link>
      </div>

      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <form className="relative w-full max-w-[320px]">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" />
          <input name="q" defaultValue={params.q || ""} placeholder="Search projects" className="mock-input h-9 pl-9" />
        </form>
        {showingPlaceholders ? <span className="text-xs font-medium text-[#667085]">Placeholder library shown until projects are saved</span> : null}
      </div>

      <div className="overflow-x-auto px-6 pb-4">
        <table className="mock-table min-w-[920px]">
          <thead>
            <tr>
              <th>Project name</th>
              <th>Preview</th>
              <th>Size</th>
              <th>Colors</th>
              <th>Created</th>
              <th>Updated</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const colors = projectColors(project);
              return (
                <tr key={project.id}>
                  <td>
                    <Link href={`/projects/${project.id}`} prefetch={false} className="font-semibold text-[#101828] hover:text-[#008c8f]">
                      {project.title}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-[#667085]">{project.description || project.originalImagePath?.split("/").pop() || "graph_project.png"}</p>
                  </td>
                  <td><PreviewStrip colors={colors} /></td>
                  <td className="font-semibold text-[#101828]">{project.width} x {project.height}</td>
                  <td><div className="flex items-center gap-2"><span>{project.colorCount}</span><PaletteDots colors={colors.slice(0, 4)} /></div></td>
                  <td>{formatDateTime(project.createdAt)}</td>
                  <td>{formatDateTime(project.updatedAt)}</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <form action={duplicateProject}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <button className="grid h-8 w-8 place-items-center rounded-md text-[#475467] hover:bg-[#f2f4f7]" title="Duplicate">
                          <Copy size={16} strokeWidth={1.8} />
                        </button>
                      </form>
                      <form action={deleteProject}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <button className="grid h-8 w-8 place-items-center rounded-md text-[#ef4444] hover:bg-red-50" title="Delete">
                          <Trash2 size={16} strokeWidth={1.8} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {showingPlaceholders
              ? placeholderProjects.map(([title, file, size, colorsCount, colors], index) => (
                  <tr key={title}>
                    <td>
                      <Link href="/projects/mock-editor" prefetch={false} className="font-semibold text-[#101828] hover:text-[#008c8f]">
                        {title}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-[#667085]">{file}</p>
                    </td>
                    <td><PreviewStrip colors={colors} /></td>
                    <td className="font-semibold text-[#101828]">{size}</td>
                    <td><div className="flex items-center gap-2"><span>{colorsCount}</span><PaletteDots colors={colors} /></div></td>
                    <td>May {12 - Math.min(index, 4)}, 2025<br /><span className="text-[11px] text-[#667085]">10:{45 - index} AM</span></td>
                    <td>May {12 - Math.min(index, 4)}, 2025<br /><span className="text-[11px] text-[#667085]">10:{45 + index} AM</span></td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button className="grid h-8 w-8 place-items-center rounded-md text-[#475467] hover:bg-[#f2f4f7]" title="Duplicate placeholder">
                          <Copy size={16} strokeWidth={1.8} />
                        </button>
                        <button className="grid h-8 w-8 place-items-center rounded-md text-[#ef4444] hover:bg-red-50" title="Delete placeholder">
                          <Trash2 size={16} strokeWidth={1.8} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[#e8edf2] px-6 py-4 text-xs text-[#667085]">
        <span>Showing 1 to {showingPlaceholders ? placeholderProjects.length : projects.length} of {showingPlaceholders ? placeholderProjects.length : projects.length} projects</span>
        <div className="flex items-center gap-2">
          <button className="mock-btn h-8 px-3 text-xs">&lt;</button>
          <button className="mock-btn h-8 border-[#008c8f] px-3 text-xs text-[#008c8f]">1</button>
          <button className="mock-btn h-8 px-3 text-xs">&gt;</button>
          <button className="mock-btn h-8 px-3 text-xs">25 / page</button>
        </div>
      </div>
    </div>
  );
}
