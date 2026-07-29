import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  FileImage,
  FolderOpen,
  Frame,
  Grid2X2,
  ImageIcon,
  Layers3,
  Palette,
  Plus,
  Ruler,
  Search,
  Sparkles,
} from "lucide-react";
import { ProjectCardActions } from "@/components/projects/project-card-actions";
import { ProjectViewToggle } from "@/components/projects/project-view-toggle";
import { getProjectSummaries } from "@/lib/projects";
import { formatDateTime } from "@/lib/utils/format";
import type { ProjectSummary } from "@/lib/types";

export const metadata = {
  title: "Projects",
};

function projectColors(project: ProjectSummary) {
  return project.palettePreview.length
    ? project.palettePreview.map((color) => color.hex)
    : ["#315bff", "#ff674d", "#89a67f", "#272727"];
}

function ProjectThumbnail({ project }: { project: ProjectSummary }) {
  // Prefer the bounded WebP derivative. Projects saved before thumbnails existed
  // keep the full-image fallback until their next save.
  const previewUrl = project.processedThumbUrl || project.processedImageUrl || project.originalImageUrl;
  if (previewUrl) {
    return (
        <img
          src={previewUrl}
          alt=""
          loading="lazy"
        decoding="async"
        className="project-card__image studio-project-card__image"
      />
    );
  }

  const colors = projectColors(project);
  const stops = colors
    .map((color, index) => color + " " + (index / colors.length) * 100 + "% " + ((index + 1) / colors.length) * 100 + "%")
    .join(", ");

  return (
    <div
      className="project-card__placeholder studio-project-card__placeholder"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(135deg, " +
          stops +
          ")",
      }}
    >
      <ImageIcon size={27} aria-hidden="true" />
      <span>Preview after first save</span>
    </div>
  );
}

function ProjectPalette({ colors }: { colors: string[] }) {
  return (
    <div className="project-card__palette studio-project-card__swatches" aria-label={`${colors.length} preview colors`}>
      {colors.slice(0, 6).map((color, index) => (
        <span key={color + index} style={{ backgroundColor: color }} />
      ))}
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
    <div className="projects-page workspace-page atelier-page studio-dashboard">
      <header className="studio-dashboard__masthead">
        <div className="studio-dashboard__intro">
          <p className="page-eyebrow studio-dashboard__eyebrow">
            <Sparkles size={13} aria-hidden="true" />
            Atelier / Projects
          </p>
          <h1>Your working studio.</h1>
          <p className="studio-dashboard__lead">
            Pick up a chart exactly where you left it, or turn fresh artwork into a production-ready graph.
          </p>
          <div className="studio-dashboard__actions">
            <Link
              href="/projects/new"
              prefetch={false}
              className="ui-btn ui-btn-primary studio-dashboard__primary-action"
            >
              <Plus size={17} aria-hidden="true" />
              Create project
            </Link>
            <a href="#project-library" className="ui-btn studio-dashboard__secondary-action">
              Browse library
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
        </div>

        <Link
          href="/projects/new"
          prefetch={false}
          className="studio-command-card"
          aria-label="Start a new graph project from artwork"
        >
          <span className="studio-command-card__label">
            <FileImage size={15} aria-hidden="true" />
            New conversion
          </span>
          <span className="studio-command-card__canvas" aria-hidden="true">
            <i className="studio-command-card__grid" />
            <i className="studio-command-card__art studio-command-card__art--one" />
            <i className="studio-command-card__art studio-command-card__art--two" />
            <i className="studio-command-card__cursor" />
          </span>
          <span className="studio-command-card__footer">
            <span>
              <strong>Drop in your line art</strong>
              <small>Crop, clean and convert</small>
            </span>
            <span className="studio-command-card__arrow" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </span>
        </Link>

        <dl className="studio-dashboard__facts" aria-label="Studio summary">
          <div>
            <dt><Layers3 size={15} aria-hidden="true" /> In this view</dt>
            <dd>{projects.length}</dd>
            <span>{projects.length === 1 ? "project" : "projects"}</span>
          </div>
          <div>
            <dt><Frame size={15} aria-hidden="true" /> Canvas model</dt>
            <dd>1 cm</dd>
            <span>per graph cell</span>
          </div>
          <div>
            <dt><Palette size={15} aria-hidden="true" /> Output</dt>
            <dd>4</dd>
            <span>export formats</span>
          </div>
        </dl>
      </header>

      <section id="project-library" className="projects-library studio-library" aria-labelledby="projects-library-title">
        <header className="projects-library__header studio-library__header">
          <div>
            <p className="page-eyebrow">{query ? "Search results" : "Project library"}</p>
            <h2 id="projects-library-title">{query ? `Matching “${query}”` : "Recent work"}</h2>
            <p>{query ? `${projects.length} ${projects.length === 1 ? "project" : "projects"} found on this page.` : "Recently updated projects appear first."}</p>
          </div>
          <span className="studio-library__count">
            <strong>{projects.length}</strong>
            <span>shown</span>
          </span>
        </header>

        <div className="projects-toolbar studio-library__toolbar">
          <form className="projects-search studio-search" role="search">
            <Search size={18} aria-hidden="true" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search by project title…"
              aria-label="Search projects"
            />
            {query ? <Link href="/dashboard" className="studio-search__clear">Clear</Link> : null}
            <button type="submit" className="projects-search__submit studio-search__submit">
              Search
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </form>
          <div className="studio-library__controls">
            <div className="studio-library__view-slot" data-project-view-slot>
              <ProjectViewToggle />
            </div>
            <div className="projects-toolbar__note studio-library__sort" aria-label="Current sort order">
              <Clock3 size={14} aria-hidden="true" />
              Last edited
            </div>
          </div>
        </div>

        {projects.length ? (
          <div className="project-grid studio-project-grid">
            <Link
              href="/projects/new"
              prefetch={false}
              className="studio-project-card studio-project-card--create"
              aria-label="Create a new project"
            >
              <span className="studio-project-card__create-visual" aria-hidden="true">
                <span><Plus size={24} /></span>
                <i />
                <i />
                <i />
              </span>
              <span className="studio-project-card__create-copy">
                <strong>Start something new</strong>
                <small>Upload artwork and enter the crop studio.</small>
              </span>
              <span className="studio-project-card__create-link">
                New project
                <ArrowRight size={15} aria-hidden="true" />
              </span>
            </Link>

            {projects.map((project, projectIndex) => {
              const colors = projectColors(project);
              const projectDescription = project.description || project.originalImagePath?.split("/").pop() || "Graph project";

              return (
                <article className="project-card studio-project-card" key={project.id}>
                  <Link
                    href={"/projects/" + project.id}
                    prefetch={false}
                    className="project-card__preview studio-project-card__preview"
                    aria-label={`Open ${project.title}`}
                  >
                    <span className="studio-project-card__media">
                      <ProjectThumbnail project={project} />
                      <span className="studio-project-card__paper-grid" aria-hidden="true" />
                    </span>
                    <span className="studio-project-card__topline">
                      <span className="project-card__type studio-project-card__status">
                        <i aria-hidden="true" />
                        Ready
                      </span>
                      <span className="studio-project-card__index" aria-hidden="true">
                        {String(projectIndex + 1).padStart(2, "0")}
                      </span>
                    </span>
                    <span className="project-card__open studio-project-card__open">
                      Open editor
                      <ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </Link>

                  <div className="project-card__body studio-project-card__body">
                    <div className="project-card__title-row studio-project-card__heading">
                      <div>
                        <Link href={"/projects/" + project.id} prefetch={false}>{project.title}</Link>
                        <p title={projectDescription}>{projectDescription}</p>
                      </div>
                      <ProjectCardActions projectId={project.id} projectTitle={project.title} />
                    </div>

                    <dl className="project-card__details studio-project-card__metrics">
                      <div className="project-card__detail studio-project-card__metric">
                        <dt><Ruler size={14} aria-hidden="true" /> Canvas</dt>
                        <dd>{project.width} × {project.height}</dd>
                      </div>
                      <div className="project-card__detail studio-project-card__metric">
                        <dt><Palette size={14} aria-hidden="true" /> Palette</dt>
                        <dd>{project.colorCount} {project.colorCount === 1 ? "color" : "colors"}</dd>
                      </div>
                    </dl>

                    <div className="project-card__palette-row studio-project-card__palette-row">
                      <span className="project-card__palette-label">Palette</span>
                      <ProjectPalette colors={colors} />
                    </div>

                    <footer className="project-card__footer studio-project-card__footer">
                      <Clock3 size={13} aria-hidden="true" />
                      <span>Edited <time dateTime={project.updatedAt}>{formatDateTime(project.updatedAt)}</time></span>
                    </footer>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="projects-empty studio-library__empty">
            <span className="studio-library__empty-icon" aria-hidden="true"><FolderOpen size={28} /></span>
            <p className="page-eyebrow">{query ? "No matches" : "Your studio is ready"}</p>
            <h3>{query ? "Nothing matched that search" : "Create your first graph project"}</h3>
            <p>
              {query
                ? "Try another title or return to the complete library."
                : "Upload line art, refine the crop, and build a printable graph in one workflow."}
            </p>
            {query ? (
              <Link href="/dashboard" className="ui-btn">View all projects</Link>
            ) : (
              <Link href="/projects/new" prefetch={false} className="ui-btn ui-btn-primary">
                <Plus size={16} aria-hidden="true" />
                Create project
              </Link>
            )}
          </div>
        )}
      </section>

      <footer className="page-pagination studio-library__pagination" aria-label="Project pages">
        <span><Grid2X2 size={13} aria-hidden="true" /> Up to 25 projects per page</span>
        <div>
          {params.cursor ? (
            <Link href={query ? "/dashboard?q=" + encodeURIComponent(query) : "/dashboard"} className="ui-btn">
              First page
            </Link>
          ) : null}
          {nextCursor ? (
            <Link href={"/dashboard?" + nextParams.toString()} className="ui-btn">
              Next page
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
