// GENERATED FILE — DO NOT EDIT.
// Canonical source: packages/object-storage/src/<name>
// Re-generate with: node packages/object-storage/sync.mjs
/**
 * Shared environment wiring so every app names its storage variables the same
 * way. Each app still keeps its own `requireEnv`-style module for everything
 * else; this only covers the R2 and media-gateway values.
 */

import { assertGatewayUrl, assertR2Bucket, assertR2Endpoint, type ObjectStoreConfig } from "./config";
import { DEFAULT_BUCKET_SECONDS, DEFAULT_TTL_SECONDS } from "./canonical";
import type { SignerOptions } from "./sign";

type EnvSource = Record<string, string | undefined>;

function required(env: EnvSource, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

function positiveInt(env: EnvSource, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }
  return parsed;
}

export function objectStoreConfigFromEnv(env: EnvSource = process.env): ObjectStoreConfig {
  return {
    endpoint: assertR2Endpoint(required(env, "R2_S3_ENDPOINT")),
    bucket: assertR2Bucket(required(env, "R2_BUCKET")),
    accessKeyId: required(env, "R2_ACCESS_KEY_ID"),
    secretAccessKey: required(env, "R2_SECRET_ACCESS_KEY"),
  };
}

export type MediaReadMode = "gateway" | "direct";

/**
 * `direct` signs presigned S3 GETs straight against R2, so local development
 * needs no media-gateway Worker running or deployed — point R2_BUCKET at a SIT
 * bucket and reads just work.
 *
 * It is not a production mode: those URLs bypass Cloudflare's edge cache, so
 * every read becomes a billed Class B operation and the R2 endpoint is exposed
 * in markup. Default is `gateway`.
 */
export function mediaReadModeFromEnv(env: EnvSource = process.env): MediaReadMode {
  const raw = env.MEDIA_READ_MODE?.trim().toLowerCase();
  if (!raw || raw === "gateway") return "gateway";
  if (raw === "direct") return "direct";
  throw new Error('MEDIA_READ_MODE must be "gateway" or "direct".');
}

export function signerOptionsFromEnv(env: EnvSource = process.env): SignerOptions {
  const ttlSeconds = positiveInt(env, "MEDIA_URL_TTL_SECONDS", DEFAULT_TTL_SECONDS);
  const bucketSeconds = positiveInt(env, "MEDIA_URL_BUCKET_SECONDS", DEFAULT_BUCKET_SECONDS);

  if (mediaReadModeFromEnv(env) === "direct") {
    const store = objectStoreConfigFromEnv(env);
    if (env.NODE_ENV === "production") {
      console.warn(
        "[object-storage] MEDIA_READ_MODE=direct in a production build. Reads bypass the Cloudflare edge cache and are billed per request; use the gateway outside local development.",
      );
    }
    return {
      // Unused in direct mode, but kept non-optional so callers need no branch.
      gatewayUrl: "",
      signingKey: "",
      ttlSeconds,
      bucketSeconds,
      directR2: {
        endpoint: store.endpoint,
        bucket: store.bucket,
        accessKeyId: store.accessKeyId,
        secretAccessKey: store.secretAccessKey,
      },
    };
  }

  return {
    gatewayUrl: assertGatewayUrl(required(env, "MEDIA_GATEWAY_URL")),
    signingKey: required(env, "MEDIA_GATEWAY_SIGNING_KEY"),
    ttlSeconds,
    bucketSeconds,
  };
}

/**
 * Public CDN origin for the world-readable bucket. Exposed to the browser, so
 * apps that need it read the NEXT_PUBLIC_ variant.
 */
export function publicCdnUrlFromEnv(env: EnvSource = process.env): string {
  return required(env, "NEXT_PUBLIC_MEDIA_CDN_URL").replace(/\/+$/, "");
}
