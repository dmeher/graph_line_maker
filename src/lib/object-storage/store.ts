// GENERATED FILE — DO NOT EDIT.
// Canonical source: packages/object-storage/src/<name>
// Re-generate with: node packages/object-storage/sync.mjs
/**
 * S3-protocol client for Cloudflare R2.
 *
 * Ported from supabase-neon-migrator/worker/r2-storage.ts (multipart threshold,
 * batched deletes, body buffering) and extended with the read/presign surface
 * the runtime apps need. R2 bindings are not an option here: every app deploys
 * to the Vercel Node runtime, not to Cloudflare Workers.
 */

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { assertSafeObjectKey } from "./canonical";
import { normalizeObjectStoreConfig, type ObjectStoreConfig } from "./config";

const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024;
const MULTIPART_PART_BYTES = 8 * 1024 * 1024;
const DELETE_BATCH_SIZE = 1000;
const DEFAULT_PRESIGN_TTL_SECONDS = 900;

export type PutObjectInput = {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  metadata?: Record<string, string>;
  /** Sent to R2 and echoed by the gateway; use a long value for immutable objects. */
  cacheControl?: string;
};

export type HeadObjectResult = {
  key: string;
  contentLength: number;
  contentType: string | null;
  etag: string | null;
  lastModified: Date | null;
};

export type GetObjectResult = {
  key: string;
  body: Buffer;
  contentType: string | null;
};

export type PresignPutOptions = {
  contentType: string;
  ttlSeconds?: number;
  /**
   * When set, the exact byte length is folded into the SigV4 signature, so an
   * upload of any other size is rejected by R2 itself. A presigned PUT cannot
   * otherwise be size-capped — R2 has no POST-policy equivalent.
   */
  contentLength?: number;
};

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function responseBodyBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const transformable = body as { transformToByteArray?: () => Promise<Uint8Array> } | null;
  if (transformable && typeof transformable.transformToByteArray === "function") {
    return Buffer.from(await transformable.transformToByteArray());
  }
  if (body && typeof body === "object" && Symbol.asyncIterator in body) {
    const chunks: Buffer[] = [];
    for await (const part of body as AsyncIterable<Uint8Array | Buffer | string>) {
      chunks.push(Buffer.isBuffer(part) ? part : Buffer.from(part));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("R2 object response did not contain a readable body.");
}

function isNotFound(error: unknown): boolean {
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return candidate?.name === "NotFound"
    || candidate?.name === "NoSuchKey"
    || candidate?.$metadata?.httpStatusCode === 404;
}

export type ObjectStore = ReturnType<typeof createObjectStore>;

export function createObjectStore(rawConfig: ObjectStoreConfig) {
  const config = normalizeObjectStoreConfig(rawConfig);
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  async function putObject(input: PutObjectInput): Promise<void> {
    const key = assertSafeObjectKey(input.key);
    const body = Buffer.isBuffer(input.body) ? input.body : Buffer.from(input.body);

    if (body.byteLength < MULTIPART_THRESHOLD_BYTES) {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl,
        Metadata: input.metadata,
      }));
      return;
    }

    const created = await client.send(new CreateMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: input.contentType,
      CacheControl: input.cacheControl,
      Metadata: input.metadata,
    }));
    if (!created.UploadId) throw new Error("R2 did not return a multipart upload identifier.");

    const uploadId = created.UploadId;
    try {
      const parts: Array<{ ETag: string; PartNumber: number }> = [];
      let partNumber = 1;
      for (let offset = 0; offset < body.byteLength; offset += MULTIPART_PART_BYTES) {
        const uploaded = await client.send(new UploadPartCommand({
          Bucket: config.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: body.subarray(offset, Math.min(offset + MULTIPART_PART_BYTES, body.byteLength)),
        }));
        if (!uploaded.ETag) throw new Error("R2 did not return a multipart part ETag.");
        parts.push({ ETag: uploaded.ETag, PartNumber: partNumber });
        partNumber += 1;
      }
      await client.send(new CompleteMultipartUploadCommand({
        Bucket: config.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }));
    } catch (error) {
      await client.send(new AbortMultipartUploadCommand({
        Bucket: config.bucket,
        Key: key,
        UploadId: uploadId,
      })).catch(() => undefined);
      throw error;
    }
  }

  /** Returns null when the object does not exist, rather than throwing. */
  async function headObject(key: string): Promise<HeadObjectResult | null> {
    const safeKey = assertSafeObjectKey(key);
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: safeKey }));
      return {
        key: safeKey,
        contentLength: head.ContentLength ?? 0,
        contentType: head.ContentType?.split(";")[0] ?? null,
        etag: head.ETag ?? null,
        lastModified: head.LastModified ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async function objectExists(key: string): Promise<boolean> {
    return (await headObject(key)) !== null;
  }

  /** Buffers the whole object. Only for server-side consumers that need the bytes. */
  async function getObject(key: string): Promise<GetObjectResult | null> {
    const safeKey = assertSafeObjectKey(key);
    try {
      const object = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: safeKey }));
      return {
        key: safeKey,
        body: await responseBodyBuffer(object.Body),
        contentType: object.ContentType?.split(";")[0] ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async function deleteObjects(keys: string[]): Promise<{ deleted: number }> {
    // Array.from rather than spread: consuming apps target older ES levels
    // where spreading a Set needs --downlevelIteration.
    const unique = Array.from(new Set(keys.filter(Boolean).map(assertSafeObjectKey)));
    if (!unique.length) return { deleted: 0 };

    let deleted = 0;
    for (const batch of chunk(unique, DELETE_BATCH_SIZE)) {
      const result = await client.send(new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }));
      if (result.Errors?.length) {
        const first = result.Errors[0];
        throw new Error(`R2 delete failed: ${first?.Code ?? "unknown"}${first?.Message ? `: ${first.Message}` : ""}`);
      }
      deleted += batch.length;
    }
    return { deleted };
  }

  async function copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const from = assertSafeObjectKey(sourceKey);
    const to = assertSafeObjectKey(destinationKey);
    await client.send(new CopyObjectCommand({
      Bucket: config.bucket,
      // CopySource is bucket-qualified and must be URL encoded.
      CopySource: `${config.bucket}/${from.split("/").map(encodeURIComponent).join("/")}`,
      Key: to,
    }));
  }

  async function listObjects(prefix: string, maxKeys = 1000): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const page = await client.send(new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
        MaxKeys: Math.min(maxKeys, 1000),
        ContinuationToken: continuationToken,
      }));
      for (const item of page.Contents ?? []) {
        if (item.Key) keys.push(item.Key);
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken && keys.length < maxKeys);
    return keys.slice(0, maxKeys);
  }

  /** Presigned direct-to-R2 upload URL for the browser. Requires bucket CORS. */
  async function presignPut(key: string, options: PresignPutOptions): Promise<string> {
    const safeKey = assertSafeObjectKey(key);
    return getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: safeKey,
        ContentType: options.contentType,
        ContentLength: options.contentLength,
      }),
      { expiresIn: options.ttlSeconds ?? DEFAULT_PRESIGN_TTL_SECONDS },
    );
  }

  /**
   * Escape hatch for non-browser consumers that cannot use the gateway. Prefer
   * signReadUrl: these URLs bypass Cloudflare's cache and churn on every call.
   */
  async function presignGet(key: string, ttlSeconds = DEFAULT_PRESIGN_TTL_SECONDS): Promise<string> {
    const safeKey = assertSafeObjectKey(key);
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: config.bucket, Key: safeKey }),
      { expiresIn: ttlSeconds },
    );
  }

  /** Cheap reachability probe; ListObjectsV2 works with bucket-scoped tokens where HeadBucket does not. */
  async function assertAccessible(): Promise<void> {
    await client.send(new ListObjectsV2Command({ Bucket: config.bucket, MaxKeys: 1 }));
  }

  return {
    bucket: config.bucket,
    endpoint: config.endpoint,
    putObject,
    headObject,
    objectExists,
    getObject,
    deleteObjects,
    copyObject,
    listObjects,
    presignPut,
    presignGet,
    assertAccessible,
  };
}
