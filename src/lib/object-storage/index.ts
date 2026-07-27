// GENERATED FILE — DO NOT EDIT.
// Canonical source: packages/object-storage/src/<name>
// Re-generate with: node packages/object-storage/sync.mjs
/**
 * Canonical Cloudflare R2 storage layer shared by every app in this folder.
 *
 * Do not edit the vendored copies under <app>/src/lib/object-storage — edit
 * packages/object-storage and re-run `node packages/object-storage/sync.mjs`.
 */

export {
  DEFAULT_BUCKET_SECONDS,
  DEFAULT_TTL_SECONDS,
  SIGNATURE_LENGTH,
  SIGNATURE_VERSION,
  assertSafeObjectKey,
  buildSignedUrl,
  cacheKeyUrl,
  canonicalPayload,
  computeExpiry,
  decodeObjectKey,
  encodeObjectKey,
  isSafeObjectKey,
  objectKey,
  parseSignedRequest,
  publicUrl,
  timingSafeEqualHex,
  type ParsedSignedRequest,
  type SignedUrlParts,
} from "./canonical";

export {
  assertGatewayUrl,
  assertR2Bucket,
  assertR2Endpoint,
  normalizeObjectStoreConfig,
  type ObjectStoreConfig,
} from "./config";

export {
  signReadUrl,
  signReadUrls,
  signaturePayload,
  verifyReadUrl,
  type DirectR2Options,
  type SignerOptions,
} from "./sign";

export { presignR2GetUrl, type PresignGetInput } from "./presign";

export {
  createObjectStore,
  type GetObjectResult,
  type HeadObjectResult,
  type ObjectStore,
  type PresignPutOptions,
  type PutObjectInput,
} from "./store";

export {
  mediaReadModeFromEnv,
  objectStoreConfigFromEnv,
  publicCdnUrlFromEnv,
  signerOptionsFromEnv,
  type MediaReadMode,
} from "./env";
