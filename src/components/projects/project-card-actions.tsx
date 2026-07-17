"use client";

import { useState } from "react";
import { Copy, Trash2, X } from "lucide-react";
import { duplicateProject, deleteProject } from "@/app/(app)/projects/actions";

export function ProjectCardActions({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <div className="project-card-actions">
        <form action={duplicateProject}>
          <input type="hidden" name="projectId" value={projectId} />
          <button className="ui-btn-icon" title="Duplicate project" aria-label={"Duplicate " + projectTitle}>
            <Copy size={16} aria-hidden="true" />
          </button>
        </form>
        <button type="button" className="ui-btn-icon project-delete-button" onClick={() => setConfirmDelete(true)} title="Delete project" aria-label={"Delete " + projectTitle}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      {confirmDelete ? (
        <div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmDelete(false); }}>
          <section className="ui-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-project-title" aria-describedby="delete-project-description">
            <button type="button" className="ui-btn-icon ui-confirm-dialog__close" onClick={() => setConfirmDelete(false)} aria-label="Close confirmation">
              <X size={16} />
            </button>
            <span className="ui-confirm-dialog__icon"><Trash2 size={20} /></span>
            <h2 id="delete-project-title">Delete project?</h2>
            <p id="delete-project-description">“{projectTitle}” and its stored source files will be permanently removed.</p>
            <div className="ui-confirm-dialog__actions">
              <button type="button" className="ui-btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <form action={deleteProject}>
                <input type="hidden" name="projectId" value={projectId} />
                <button className="ui-btn ui-btn-danger">Delete project</button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
