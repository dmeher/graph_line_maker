import "server-only";

import {
  createObjectStore,
  objectKey,
  objectStoreConfigFromEnv,
  signReadUrl,
  signReadUrls,
  signerOptionsFromEnv,
  type ObjectStore,
  type SignerOptions,
} from "@/lib/object-storage";

/**
 * Cloudflare R2 replaces Supabase Storage for every source and processed image.
 *
 * Two properties matter here and neither existed before:
 *  - R2 charges nothing for egress, which is the reason for the move.
 *  - Read URLs are signed locally. `createSignedUrls` was an HTTP round trip to
 *    Supabase on the render path, and this editor signs up to 132 paths per
 *    open. That request is now gone entirely.
 */

export const hasMediaConfig = Boolean(
  process.env.R2_S3_ENDPOINT?.trim()
  && process.env.R2_BUCKET?.trim()
  && process.env.R2_ACCESS_KEY_ID?.trim()
  && process.env.R2_SECRET_ACCESS_KEY?.trim(),
);

/**
 * Signing is possible when either the media gateway is configured, or the app
 * is in local-development `direct` read mode, which signs presigned S3 GETs
 * straight against R2 and needs no gateway at all.
 */
export const hasMediaSignerConfig =
  process.env.MEDIA_READ_MODE?.trim().toLowerCase() === "direct"
    ? hasMediaConfig
    : Boolean(process.env.MEDIA_GATEWAY_URL?.trim() && process.env.MEDIA_GATEWAY_SIGNING_KEY?.trim());

export const missingMediaConfigMessage =
  "Cloudflare R2 configuration is missing. Set R2_S3_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, MEDIA_GATEWAY_URL, and MEDIA_GATEWAY_SIGNING_KEY.";

let store: ObjectStore | null = null;
let signer: SignerOptions | null = null;

export function getObjectStore(): ObjectStore {
  if (!hasMediaConfig) throw new Error(missingMediaConfigMessage);
  if (!store) store = createObjectStore(objectStoreConfigFromEnv());
  return store;
}

export function tryGetObjectStore(): ObjectStore | null {
  return hasMediaConfig ? getObjectStore() : null;
}

function getSignerOptions(): SignerOptions {
  if (!hasMediaSignerConfig) throw new Error(missingMediaConfigMessage);
  if (!signer) signer = signerOptionsFromEnv();
  return signer;
}

/**
 * Builds the R2 key for a stored path. Keys keep the legacy Supabase bucket
 * name as their first segment, so every `original_image_path`,
 * `processed_image_path`, and `settings.sourceImages[].path` already in the
 * database resolves without any data rewrite.
 */
export function mediaKey(bucket: string, path: string): string {
  return objectKey(bucket, path);
}

/** Signs one stored path into a stable, cacheable gateway URL. */
export function mediaUrl(bucket: string, path: string): string {
  return signReadUrl(mediaKey(bucket, path), getSignerOptions());
}

/**
 * Batch variant keyed by the **stored path**, not the R2 key, so callers keep
 * using the same lookup shape the Supabase helper had.
 * Returns an empty map when signing is not configured, matching the previous
 * behaviour where an unconfigured environment degraded instead of throwing.
 */
export function mediaUrlsForBucket(
  bucket: string,
  paths: Array<string | null | undefined>,
): Map<string, string | null> {
  const byPath = new Map<string, string | null>();
  const unique = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  if (!unique.length || !hasMediaSignerConfig) return byPath;

  const signed = signReadUrls(unique.map((path) => mediaKey(bucket, path)), getSignerOptions());
  for (const path of unique) {
    byPath.set(path, signed.get(mediaKey(bucket, path)) ?? null);
  }
  return byPath;
}
