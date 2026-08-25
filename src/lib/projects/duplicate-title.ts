/** The same maximum enforced by the project save schema and editor title input. */
export const MAX_PROJECT_TITLE_LENGTH = 160;

const COPY_SUFFIX = " Copy";

/**
 * Creates a display name that is immediately valid for a copied project.
 * Keeping the suffix prevents a duplicate of a 156–160-character title from
 * becoming a project that the next explicit save rejects.
 */
export function duplicateProjectTitle(title: string) {
  const sourceTitle = title.trim() || "Untitled project";
  const baseLength = MAX_PROJECT_TITLE_LENGTH - COPY_SUFFIX.length;
  return `${sourceTitle.slice(0, baseLength)}${COPY_SUFFIX}`;
}

/** Repairs overlong copies made before duplicate titles observed the save limit. */
export function normalizeDuplicateProjectTitle(title: string) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle.endsWith(COPY_SUFFIX)) return title;
  return duplicateProjectTitle(trimmedTitle.slice(0, -COPY_SUFFIX.length));
}
