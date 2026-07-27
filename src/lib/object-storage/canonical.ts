// GENERATED FILE — DO NOT EDIT.
// Canonical source: packages/object-storage/src/<name>
// Re-generate with: node packages/object-storage/sync.mjs
/**
 * Isomorphic, dependency-free half of the signed-read-URL scheme.
 *
 * This module is shared verbatim by the Next.js apps (which sign, using
 * node:crypto) and by the Cloudflare media gateway Worker (which verifies,
 * using WebCrypto). Keeping the canonical string construction in exactly one
 * place is what makes the two sides provably agree, so it must not import
 * anything runtime-specific.
 */

export const SIGNATURE_VERSION = "v1";

/** 128 bits of HMAC-SHA256, hex encoded. Enough to forge-proof a URL, short enough to keep it readable. */
export const SIGNATURE_LENGTH = 32;

export const DEFAULT_TTL_SECONDS = 3600;
export const DEFAULT_BUCKET_SECONDS = 3600;

export type SignedUrlParts = {
  key: string;
  exp: number;
  sig: string;
};

/**
 * Rounds the expiry up to a fixed time-bucket boundary so that every caller
 * within the same bucket produces a byte-identical URL.
 *
 * This is the whole point of the scheme. Supabase's createSignedUrl minted a
 * fresh JWT per call, so the URL changed on every render and no browser or CDN
 * cache entry could ever be reused. With a rounded expiry the URL is stable for
 * a full bucket, and the object is genuinely cacheable.
 *
 * The result is always at least `ttlSeconds` in the future: at the moment just
 * before the bucket rolls over, the remaining lifetime is exactly `ttlSeconds`.
 */
export function computeExpiry(
  nowSeconds: number,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  bucketSeconds: number = DEFAULT_BUCKET_SECONDS,
): number {
  if (!Number.isFinite(nowSeconds) || nowSeconds < 0) throw new Error("Invalid current time for signed URL expiry.");
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) throw new Error("Signed URL TTL must be a positive integer.");
  if (!Number.isInteger(bucketSeconds) || bucketSeconds <= 0) throw new Error("Signed URL bucket size must be a positive integer.");
  return Math.ceil((nowSeconds + ttlSeconds) / bucketSeconds) * bucketSeconds;
}

/**
 * The exact byte string covered by the HMAC. Newline separated so no field can
 * absorb another's content, and version prefixed so the scheme can be rotated
 * without ambiguity.
 */
export function canonicalPayload(key: string, exp: number): string {
  return `${SIGNATURE_VERSION}\n${key}\n${exp}`;
}

/** Percent-encodes each path segment while leaving the separators intact. */
export function encodeObjectKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function decodeObjectKey(pathname: string): string {
  return pathname.replace(/^\/+/, "").split("/").map(decodeURIComponent).join("/");
}

export function buildSignedUrl(gatewayUrl: string, parts: SignedUrlParts): string {
  const base = gatewayUrl.replace(/\/+$/, "");
  return `${base}/${encodeObjectKey(parts.key)}?exp=${parts.exp}&sig=${parts.sig}`;
}

/**
 * The cache key deliberately drops `exp` and `sig`. Without this, every rollover
 * into a new time bucket would present a brand-new URL to the edge cache and
 * discard a perfectly warm copy of an immutable object.
 */
export function cacheKeyUrl(gatewayUrl: string, key: string): string {
  const base = gatewayUrl.replace(/\/+$/, "");
  return `${base}/${encodeObjectKey(key)}`;
}

export type ParsedSignedRequest =
  | { ok: true; key: string; exp: number; sig: string }
  | { ok: false; reason: "missing_key" | "missing_signature" | "malformed_expiry" };

export function parseSignedRequest(url: URL): ParsedSignedRequest {
  let key: string;
  try {
    key = decodeObjectKey(url.pathname);
  } catch {
    // decodeURIComponent throws on malformed percent escapes.
    return { ok: false, reason: "missing_key" };
  }
  if (!key) return { ok: false, reason: "missing_key" };

  const sig = url.searchParams.get("sig");
  if (!sig) return { ok: false, reason: "missing_signature" };

  const rawExp = url.searchParams.get("exp");
  if (!rawExp || !/^\d{1,15}$/.test(rawExp)) return { ok: false, reason: "malformed_expiry" };

  return { ok: true, key, exp: Number(rawExp), sig };
}

/**
 * Length-independent, short-circuit-free comparison. Both inputs here are hex
 * of a known fixed length, but the constant-time property still matters because
 * the attacker controls one side.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

const CHAR_CODE_BACKSLASH = 0x5c;
const CHAR_CODE_DELETE = 0x7f;
const CHAR_CODE_FIRST_PRINTABLE = 0x20;

/**
 * Control characters and backslashes are rejected outright: both let two
 * different key strings address the same object, and both have a history of
 * confusing S3 path parsers. Written as a code-point scan rather than a regex
 * so the intent is legible.
 */
function hasUnsafeCharacters(key: string): boolean {
  for (let index = 0; index < key.length; index += 1) {
    const code = key.charCodeAt(index);
    if (code < CHAR_CODE_FIRST_PRINTABLE || code === CHAR_CODE_DELETE || code === CHAR_CODE_BACKSLASH) {
      return true;
    }
  }
  return false;
}

/**
 * Guards against traversal, absolute keys, control-character injection, and the
 * empty or dot segments that let two different key strings address the same
 * object. Applied on both the signing and the serving side.
 *
 * Spaces are allowed: uploaded file names legitimately contain them and they
 * are percent-encoded in the URL anyway.
 */
export function assertSafeObjectKey(key: string): string {
  if (
    !key
    || key.length > 1024
    || hasUnsafeCharacters(key)
    || key.startsWith("/")
    || key.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Invalid object key.");
  }
  return key;
}

export function isSafeObjectKey(key: string): boolean {
  try {
    assertSafeObjectKey(key);
    return true;
  } catch {
    return false;
  }
}

/** Joins a legacy Supabase bucket name and object path into the R2 key that replaced it. */
export function objectKey(legacyBucket: string, path: string): string {
  return assertSafeObjectKey(`${legacyBucket}/${path.replace(/^\/+/, "")}`);
}

/** Builds a public CDN URL for an object in the world-readable bucket. */
export function publicUrl(cdnUrl: string, key: string): string {
  return `${cdnUrl.replace(/\/+$/, "")}/${encodeObjectKey(assertSafeObjectKey(key))}`;
}
