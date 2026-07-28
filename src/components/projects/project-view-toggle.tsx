"use client";

import { Grid2X2, Rows3 } from "lucide-react";
import { useEffect, useState } from "react";

type ProjectView = "grid" | "list";

const PROJECT_VIEW_STORAGE_KEY = "graph-pixel-project-view";

function isProjectView(value: string | null): value is ProjectView {
  return value === "grid" || value === "list";
}

export function ProjectViewToggle() {
  const [view, setView] = useState<ProjectView>("grid");

  useEffect(() => {
    try {
      const storedView = window.localStorage.getItem(PROJECT_VIEW_STORAGE_KEY);
      if (isProjectView(storedView)) {
        setView(storedView);
        document.documentElement.dataset.projectView = storedView;
        return;
      }
    } catch {
      // Storage can be unavailable in restricted browsing modes.
    }
    document.documentElement.dataset.projectView = "grid";
  }, []);

  function chooseView(nextView: ProjectView) {
    setView(nextView);
    document.documentElement.dataset.projectView = nextView;
    try {
      window.localStorage.setItem(PROJECT_VIEW_STORAGE_KEY, nextView);
    } catch {
      // The view still changes for this session when storage is unavailable.
    }
  }

  return (
    <div className="project-view-toggle" role="group" aria-label="Project view">
      <button
        type="button"
        className={view === "grid" ? "is-active" : ""}
        onClick={() => chooseView("grid")}
        aria-label="Grid view"
        aria-pressed={view === "grid"}
        title="Grid view"
      >
        <Grid2X2 size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={view === "list" ? "is-active" : ""}
        onClick={() => chooseView("list")}
        aria-label="List view"
        aria-pressed={view === "list"}
        title="List view"
      >
        <Rows3 size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
