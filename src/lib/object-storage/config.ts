// GENERATED FILE — DO NOT EDIT.
// Canonical source: packages/object-storage/src/<name>
// Re-generate with: node packages/object-storage/sync.mjs
/**
 * Configuration validation for the R2 S3 endpoint and bucket.
 *
 * Ported from supabase-neon-migrator/worker/config.ts, which already had these
 * validators reviewed and tested. Keeping the rules identical means a
 * misconfigured endpoint fails the same way in the apps as in the migrator.
 */

export type ObjectStoreConfig = {
  /** https://<account-id>.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/**
 * Rejects anything that is not the bare account S3 endpoint. Credentials,
 * query strings, and paths in an endpoint are always a configuration mistake
 * and would silently produce wrong object URLs.
 */
export function assertR2Endpoint(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Cloudflare R2 endpoint must be a valid HTTPS URL.");
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.search
    || url.hash
    || !url.hostname.toLowerCase().endsWith(".r2.cloudflarestorage.com")
    || !["", "/"].includes(url.pathname)
  ) {
    throw new Error("Cloudflare R2 endpoint must be the account S3 endpoint (https://<account>.r2.cloudflarestorage.com).");
  }
  return url.origin;
}

export function assertR2Bucket(value: string): string {
  const bucket = value.trim();
  if (!/^[a-z0-9](?:[a-z0-9.-]{1,61}[a-z0-9])$/.test(bucket) || bucket.includes("..")) {
    throw new Error("Cloudflare R2 bucket name is invalid.");
  }
  return bucket;
}

export function assertGatewayUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Media gateway URL must be a valid HTTPS URL.");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Media gateway URL must use HTTPS outside local development.");
  }
  return url.origin;
}

export function normalizeObjectStoreConfig(config: ObjectStoreConfig): ObjectStoreConfig {
  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error("Cloudflare R2 credentials are not configured.");
  }
  return {
    endpoint: assertR2Endpoint(config.endpoint),
    bucket: assertR2Bucket(config.bucket),
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  };
}
