import Link from "next/link";
import { ArrowRight, FolderOpen, Grid3X3, ImageIcon, Plus, Search } from "lucide-react";
import { ProjectCardActions } from "@/components/projects/project-card-actions";
import { getProjectSummaries } from "@/lib/projects";
import { formatDateTime } from "@/lib/utils/format";
import type { ProjectSummary } from "@/lib/types";

export const metadata = {
  title: "Projects",
};

function projectColors(project: ProjectSummary) {
  return project.palettePreview.length
    ? project.palettePreview.map((color) => color.hex)
    : ["#008c8f", "#0f172a", "#cbd5e1"];
}

function ProjectThumbnail({ project }: { project: ProjectSummary }) {
  // Prefer the bounded WebP derivative. Cards used to render the full processed
  // canvas PNG — up to 25 of them per page. Projects saved before derivatives
  // existed have none and keep falling back until their next save.
  const previewUrl = project.processedThumbUrl || project.processedImageUrl || project.originalImageUrl;
  if (previewUrl) {
    return (
      <img
        src={previewUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="project-card__image"
      />
    );
  }

  const colors = projectColors(project);
  const stops = colors.map((color, index) => color + " " + (index / colors.length) * 100 + "% " + ((index + 1) / colors.length) * 100 + "%").join(", ");
  return (
    <div
      className="project-card__placeholder"
      style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(135deg, " + stops + ")" }}
    >
      <ImageIcon size={26} aria-hidden="true" />
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ q?: string; cursor?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const { projects, nextCursor } = await getProjectSummaries({ query, cursor: params.cursor });
  const nextParams = new URLSearchParams();
  if (query) nextParams.set("q", query);
  if (nextCursor) nextParams.set("cursor", nextCursor);

  return (
    <div className="projects-page">
      <header className="page-heading">
        <div>
          <p className="page-eyebrow">Workspace</p>
          <h1>Projects</h1>
          <p>Create, organize, and reopen graph-ready artwork.</p>
        </div>
        <Link href="/projects/new" prefetch={false} className="ui-btn ui-btn-primary page-primary-action">
          <Plus size={17} aria-hidden="true" />
          New project
        </Link>
      </header>

      <section className="projects-toolbar" aria-label="Project filters">
        <form className="projects-search">
          <Search size={17} aria-hidden="true" />
          <input name="q" defaultValue={query} placeholder="Search projects" aria-label="Search projects" />
          {query ? <Link href="/dashboard">Clear</Link> : null}
        </form>
        <span className="ui-status"><Grid3X3 size={14} /> {projects.length} on this page</span>
      </section>

      {projects.length ? (
        <section className="project-grid" aria-label="Projects">
          {projects.map((project) => {
            const colors = projectColors(project);
            return (
              <article className="project-card" key={project.id}>
                <Link href={"/projects/" + project.id} prefetch={false} className="project-card__preview" aria-label={"Open " + project.title}>
                  <ProjectThumbnail project={project} />
                  <span className="project-card__open">Open editor <ArrowRight size={14} /></span>
                </Link>
                <div className="project-card__body">
                  <div className="project-card__title-row">
                    <div>
                      <Link href={"/projects/" + project.id} prefetch={false}>{project.title}</Link>
                      <p>{project.description || project.originalImagePath?.split("/").pop() || "Graph project"}</p>
                    </div>
                    <ProjectCardActions projectId={project.id} projectTitle={project.title} />
                  </div>
                  <div className="project-card__meta">
                    <span>{project.width} × {project.height}</span>
                    <span>{project.colorCount} colors</span>
                    <span>Updated {formatDateTime(project.updatedAt)}</span>
                  </div>
                  <div className="project-card__palette" aria-label={colors.length + " preview colors"}>
                    {colors.slice(0, 6).map((color, index) => <span key={color + index} style={{ backgroundColor: color }} />)}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="projects-empty">
          <span><FolderOpen size={28} /></span>
          <h2>{query ? "No matching projects" : "Create your first graph project"}</h2>
          <p>{query ? "Try a different project name or clear the search." : "Upload line art, crop it precisely, and turn it into a printable graph."}</p>
          {query ? (
            <Link href="/dashboard" className="ui-btn">Clear search</Link>
          ) : (
            <Link href="/projects/new" prefetch={false} className="ui-btn ui-btn-primary"><Plus size={16} /> New project</Link>
          )}
        </section>
      )}

      <footer className="page-pagination">
        <span>Up to 25 projects per page</span>
        <div>
          {params.cursor ? <Link href={query ? "/dashboard?q=" + encodeURIComponent(query) : "/dashboard"} className="ui-btn">First page</Link> : null}
          {nextCursor ? <Link href={"/dashboard?" + nextParams.toString()} className="ui-btn">Next page <ArrowRight size={15} /></Link> : null}
        </div>
      </footer>
    </div>
  );
}
