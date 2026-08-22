"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { CopyPlus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { duplicateProject, deleteProject } from "@/app/(app)/projects/actions";

export function ProjectCardActions({
  projectId,
  projectTitle,
  ownerLabel = null,
}: {
  projectId: string;
  projectTitle: string;
  /** Set when an admin is acting on someone else's project. */
  ownerLabel?: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isDeletingRef = useRef(false);
  const router = useRouter();
  isDeletingRef.current = isDeleting;

  const closeDeleteDialog = useCallback(() => {
    if (isDeletingRef.current) return;
    setConfirmDelete(false);
    setDeleteError(null);
  }, []);

  function confirmProjectDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDeletingRef.current) return;
    const formData = new FormData(event.currentTarget);
    setDeleteError(null);
    isDeletingRef.current = true;

    startDeleteTransition(async () => {
      try {
        const result = await deleteProject(formData);
        if (!result.ok) {
          isDeletingRef.current = false;
          setDeleteError(result.message ?? "Unable to delete the project. Please try again.");
          return;
        }

        setConfirmDelete(false);
        router.refresh();
      } catch {
        isDeletingRef.current = false;
        setDeleteError("Unable to delete the project. Please try again.");
      }
    });
  }

  useEffect(() => {
    if (!confirmDelete) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeDeleteDialog();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, [confirmDelete, closeDeleteDialog]);

  return (
    <>
      <div className="project-card-actions" role="group" aria-label={`Actions for ${projectTitle}`}>
        <form action={duplicateProject}>
          <input type="hidden" name="projectId" value={projectId} />
          <button className="project-card-actions__button" title="Duplicate project" aria-label={"Duplicate " + projectTitle}>
            <CopyPlus size={15} aria-hidden="true" />
            <span>Duplicate</span>
          </button>
        </form>
        <button type="button" className="project-card-actions__button project-card-actions__button--danger" onClick={() => { setDeleteError(null); setConfirmDelete(true); }} title="Delete project" aria-label={"Delete " + projectTitle}>
          <Trash2 size={15} aria-hidden="true" />
          <span>Delete</span>
        </button>
      </div>

      {confirmDelete ? (
        <div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleteDialog(); }}>
          <section className="ui-confirm-dialog project-delete-dialog" role="alertdialog" aria-modal="true" aria-busy={isDeleting} aria-labelledby="delete-project-title" aria-describedby="delete-project-description">
            <button type="button" className="ui-btn-icon ui-confirm-dialog__close" onClick={closeDeleteDialog} disabled={isDeleting} aria-label="Close confirmation">
              <X size={16} aria-hidden="true" />
            </button>
            <span className="ui-confirm-dialog__icon" aria-hidden="true"><Trash2 size={20} /></span>
            <h2 id="delete-project-title">Delete project?</h2>
            <p id="delete-project-description">
              “{projectTitle}”{ownerLabel ? <> — owned by <strong>{ownerLabel}</strong></> : null} and its stored source
              files will be permanently removed.
            </p>
            {deleteError ? <p className="ui-confirm-dialog__error" role="alert">{deleteError}</p> : null}
            <div className="ui-confirm-dialog__actions">
              <button ref={cancelButtonRef} type="button" className="ui-btn" onClick={closeDeleteDialog} disabled={isDeleting}>Cancel</button>
              <form onSubmit={confirmProjectDelete}>
                <input type="hidden" name="projectId" value={projectId} />
                <button className="ui-btn ui-btn-danger" disabled={isDeleting}>{isDeleting ? "Deleting…" : "Delete project"}</button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
