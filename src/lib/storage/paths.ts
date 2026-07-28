/**
 * Pure storage-path helpers.
 *
 * Deliberately free of `server-only` and of any Supabase or AWS import: these
 * are needed by server routes, by client upload code, and by unit tests, so
 * they must stay importable from every runtime.
 */

/**
 * Derives the thumbnail path for a stored asset by inserting a `thumbs/`
 * segment before the file name.
 *
 * The clipart library grid and the dashboard cards previously rendered
 * full-resolution originals — which the bucket allows to be 50 MB — into 40x40
 * and card-sized boxes. Cloudflare R2 makes that egress free, but it is still
 * tens of megabytes across the wire per editor open, so uploads now carry a
 * bounded WebP derivative.
 *
 * The derivation must stay stable: upload writes this key and cleanup deletes
 * it, with no stored mapping between them.
 */
export function thumbnailPathFor(path: string) {
  const separator = path.lastIndexOf("/");
  const directory = separator === -1 ? "" : path.slice(0, separator + 1);
  const fileName = separator === -1 ? path : path.slice(separator + 1);
  const stem = fileName.replace(/\.[^.]+$/, "") || fileName;
  return `${directory}thumbs/${stem}.webp`;
}

export const THUMBNAIL_CONTENT_TYPE = "image/webp";

/** Generous ceiling for a 256px (source/clipart) or 512px (card) WebP. */
export const MAX_THUMBNAIL_BYTES = 512 * 1024;
