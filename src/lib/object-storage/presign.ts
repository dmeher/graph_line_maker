// GENERATED FILE — DO NOT EDIT.
// Canonical source: packages/object-storage/src/<name>
// Re-generate with: node packages/object-storage/sync.mjs
/**
 * Synchronous SigV4 query-string presigner for R2 GET requests.
 *
 * Used only by the `direct` read mode, which lets local development read from
 * R2 without a media-gateway Worker running. The AWS SDK's presigner is async
 * because of its credential-provider and middleware abstractions; with static
 * credentials the computation is a pure HMAC chain, so this stays synchronous
 * and `signReadUrl` keeps its signature. `tests/presign.test.ts` asserts this
 * produces byte-identical output to `@aws-sdk/s3-request-presigner`.
 */

import { createHash, createHmac } from "node:crypto";

const ALGORITHM = "AWS4-HMAC-SHA256";
/** R2 has no regions; its S3 API expects the literal "auto". */
const REGION = "auto";
const SERVICE = "s3";
/** S3 rejects a presigned URL that claims to live longer than seven days. */
const MAX_EXPIRES_SECONDS = 604_800;

export type PresignGetInput = {
  /** https://<account-id>.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
  /** Signing instant. Pin it to keep the generated URL stable and cacheable. */
  date: Date;
};

/**
 * `encodeURIComponent` leaves `!'()*` alone, but SigV4 requires them encoded.
 * A mismatch here changes the canonical request and silently breaks the
 * signature, so it must not be skipped.
 */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function amzDateStamps(date: Date) {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

export function presignR2GetUrl(input: PresignGetInput): string {
  if (!Number.isInteger(input.expiresInSeconds) || input.expiresInSeconds <= 0) {
    throw new Error("Presigned URL expiry must be a positive integer.");
  }
  if (input.expiresInSeconds > MAX_EXPIRES_SECONDS) {
    throw new Error("Presigned URL expiry cannot exceed seven days.");
  }

  const endpoint = new URL(input.endpoint);
  const host = endpoint.host;
  const { amzDate, dateStamp } = amzDateStamps(input.date);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  // Path-style addressing, matching `forcePathStyle: true` on the S3 client.
  const canonicalUri = `/${[input.bucket, ...input.key.split("/")].map(encodeRfc3986).join("/")}`;

  // SigV4 requires query parameters sorted by encoded name. This list is
  // already in order: uppercase `X` (0x58) sorts before lowercase `x` (0x78).
  //
  // This deliberately mirrors the exact parameter set @aws-sdk/s3-request-presigner
  // emits, including its conventions (`x-id`, `x-amz-checksum-mode`) that the
  // protocol does not require. Reproducing the SDK byte for byte is how
  // correctness is verified without a live R2 call — see tests/presign.test.ts.
  // If an SDK upgrade changes this set, that test fails loudly rather than
  // leaving direct-mode reads to fail with an opaque 403.
  const query: Array<[string, string]> = [
    ["X-Amz-Algorithm", ALGORITHM],
    ["X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD"],
    ["X-Amz-Credential", `${input.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(input.expiresInSeconds)],
    ["X-Amz-SignedHeaders", "host"],
    ["x-amz-checksum-mode", "ENABLED"],
    ["x-id", "GetObject"],
  ];
  const canonicalQueryString = query
    .map(([name, value]) => `${encodeRfc3986(name)}=${encodeRfc3986(value)}`)
    .join("&");

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQueryString,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [ALGORITHM, amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, dateStamp), REGION), SERVICE),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  return `${endpoint.origin}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}
