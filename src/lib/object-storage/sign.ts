// GENERATED FILE — DO NOT EDIT.
// Canonical source: packages/object-storage/src/<name>
// Re-generate with: node packages/object-storage/sync.mjs
/**
 * Node-side signing for gateway read URLs.
 *
 * Signing is a pure local computation: no network call, no round trip to any
 * provider. This replaces Supabase's createSignedUrl(s), which was an HTTP
 * request on the render path — graph-pixel-maker signed up to 132 paths that
 * way on every editor open.
 */

import { createHmac } from "node:crypto";

import {
  DEFAULT_BUCKET_SECONDS,
  DEFAULT_TTL_SECONDS,
  SIGNATURE_LENGTH,
  assertSafeObjectKey,
  buildSignedUrl,
  canonicalPayload,
  computeExpiry,
  decodeObjectKey,
  timingSafeEqualHex,
} from "./canonical";
import { presignR2GetUrl } from "./presign";

export type DirectR2Options = {
  /** https://<account-id>.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type SignerOptions = {
  /** Origin of the media gateway Worker, e.g. https://files.example.com */
  gatewayUrl: string;
  /** Shared secret; must equal the Worker secret for this bucket alias. */
  signingKey: string;
  ttlSeconds?: number;
  bucketSeconds?: number;
  /**
   * Local-development escape hatch. When set, reads are signed as direct
   * presigned S3 GETs against R2 instead of gateway URLs, so no Worker needs to
   * be running or deployed to view files.
   *
   * Not for production: these URLs bypass Cloudflare's edge cache entirely, so
   * every read becomes a billed Class B operation, and they expose the R2
   * endpoint. `gatewayUrl` and `signingKey` are unused in this mode.
   */
  directR2?: DirectR2Options;
};

export function signaturePayload(key: string, exp: number, signingKey: string): string {
  return createHmac("sha256", signingKey)
    .update(canonicalPayload(key, exp))
    .digest("hex")
    .slice(0, SIGNATURE_LENGTH);
}

function resolve(options: SignerOptions) {
  if (!options.directR2) {
    if (!options.gatewayUrl) throw new Error("Media gateway URL is not configured.");
    if (!options.signingKey) throw new Error("Media gateway signing key is not configured.");
  }
  return {
    gatewayUrl: options.gatewayUrl,
    signingKey: options.signingKey,
    directR2: options.directR2,
    ttlSeconds: options.ttlSeconds ?? DEFAULT_TTL_SECONDS,
    bucketSeconds: options.bucketSeconds ?? DEFAULT_BUCKET_SECONDS,
  };
}

/**
 * Presigned S3 GET, pinned to the time-bucket start.
 *
 * Pinning keeps the URL byte-identical for the whole bucket, exactly like the
 * gateway path — otherwise a fresh SigV4 timestamp per render would defeat the
 * browser cache and reintroduce the very problem this scheme exists to fix.
 * The expiry spans the bucket plus the TTL so it is never already stale.
 */
function directReadUrl(
  key: string,
  directR2: DirectR2Options,
  nowSeconds: number,
  ttlSeconds: number,
  bucketSeconds: number,
): string {
  const bucketStart = Math.floor(nowSeconds / bucketSeconds) * bucketSeconds;
  return presignR2GetUrl({
    ...directR2,
    key,
    expiresInSeconds: bucketSeconds + ttlSeconds,
    date: new Date(bucketStart * 1000),
  });
}

/** Signs one object key into a stable, cacheable read URL. */
export function signReadUrl(key: string, options: SignerOptions, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const resolved = resolve(options);
  const safeKey = assertSafeObjectKey(key);

  if (resolved.directR2) {
    return directReadUrl(safeKey, resolved.directR2, nowSeconds, resolved.ttlSeconds, resolved.bucketSeconds);
  }

  const exp = computeExpiry(nowSeconds, resolved.ttlSeconds, resolved.bucketSeconds);
  return buildSignedUrl(resolved.gatewayUrl, {
    key: safeKey,
    exp,
    sig: signaturePayload(safeKey, exp, resolved.signingKey),
  });
}

/**
 * Batch variant. Deduplicates and shares one expiry across the whole batch, so
 * a page that renders the same object twice emits one identical URL.
 * Unsafe keys map to null rather than throwing, matching the tolerant shape the
 * previous Supabase helpers had.
 */
export function signReadUrls(
  keys: Array<string | null | undefined>,
  options: SignerOptions,
  nowSeconds = Math.floor(Date.now() / 1000),
): Map<string, string | null> {
  const resolved = resolve(options);
  const result = new Map<string, string | null>();
  const unique = Array.from(new Set(keys.filter((key): key is string => Boolean(key))));
  if (!unique.length) return result;

  const exp = computeExpiry(nowSeconds, resolved.ttlSeconds, resolved.bucketSeconds);
  for (const key of unique) {
    try {
      const safeKey = assertSafeObjectKey(key);
      result.set(key, resolved.directR2
        ? directReadUrl(safeKey, resolved.directR2, nowSeconds, resolved.ttlSeconds, resolved.bucketSeconds)
        : buildSignedUrl(resolved.gatewayUrl, {
          key: safeKey,
          exp,
          sig: signaturePayload(safeKey, exp, resolved.signingKey),
        }));
    } catch {
      result.set(key, null);
    }
  }
  return result;
}

/** Server-side verification, used by tests and by any Node consumer of a gateway URL. */
export function verifyReadUrl(url: string, signingKey: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const sig = parsed.searchParams.get("sig");
  const rawExp = parsed.searchParams.get("exp");
  if (!sig || !rawExp || !/^\d{1,15}$/.test(rawExp)) return false;

  const exp = Number(rawExp);
  if (exp <= nowSeconds) return false;

  let key: string;
  try {
    key = assertSafeObjectKey(decodeObjectKey(parsed.pathname));
  } catch {
    return false;
  }
  return timingSafeEqualHex(sig, signaturePayload(key, exp, signingKey));
}
