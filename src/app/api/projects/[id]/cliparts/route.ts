import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ORIGINAL_IMAGES_BUCKET,
  getAllowedImageContentType,
  getImageExtension,
  isAllowedImageFile,
  isPdfFile,
} from "@/lib/constants";
import {
  MAX_THUMBNAIL_BYTES,
  THUMBNAIL_CONTENT_TYPE,
  assertProjectAccess,
  clipartImagePath,
  thumbnailPathFor,
} from "@/lib/projects";
import { getObjectStore, mediaKey, mediaUrlsForBucket } from "@/lib/storage/media";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const MAX_CLIPART_UPLOADS = 24;
const MAX_CLIPART_UPLOAD_BYTES = 6 * 1024 * 1024;
const MAX_CLIPART_UPLOAD_TOTAL_BYTES = 48 * 1024 * 1024;
const UPLOAD_URL_TTL_SECONDS = 15 * 60;

type ClipartMetadata = { id: string; name: string; fileName: string; type: string; size: number };

function getExtension(file: { name?: string; type?: string }) {
  const nameExtension = getImageExtension(file.name || "");
  if (ALLOWED_IMAGE_EXTENSIONS.has(nameExtension) && nameExtension !== "pdf") return nameExtension === "jpeg" ? "jpg" : nameExtension;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  return "jpg";
}

function parseFiles(value: unknown): ClipartMetadata[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const file = item as Record<string, unknown>;
    const id = String(file.id || "");
    const name = String(file.name || "").trim();
    const fileName = String(file.fileName || "");
    const type = String(file.type || "");
    const size = Number(file.size);
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !name || !fileName || !Number.isFinite(size) || size < 0) return [];
    return [{ id, name, fileName, type, size }];
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    // Keys stay under the project owner even when an admin uploads on their behalf.
    const { user_id: ownerUserId } = await assertProjectAccess(projectId);
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json({ message: "Cliparts must use signed direct uploads." }, { status: 415 });
    }
    const body = await request.json().catch(() => ({}));
    const files = parseFiles(body.files);
    if (!files.length) return NextResponse.json({ message: "At least one clipart file is required." }, { status: 400 });
    if (files.length > MAX_CLIPART_UPLOADS) return NextResponse.json({ message: `Upload up to ${MAX_CLIPART_UPLOADS} cliparts at a time.` }, { status: 400 });
    if (files.reduce((total, file) => total + file.size, 0) > MAX_CLIPART_UPLOAD_TOTAL_BYTES) {
      return NextResponse.json({ message: "Combined clipart upload must be 48 MB or smaller." }, { status: 413 });
    }
    for (const file of files) {
      const validationInput = { name: file.fileName, type: file.type };
      if (!isAllowedImageFile(validationInput) || isPdfFile(validationInput)) return NextResponse.json({ message: "Upload PNG, JPG, WEBP, or SVG cliparts only." }, { status: 400 });
      if (file.size > MAX_CLIPART_UPLOAD_BYTES) return NextResponse.json({ message: "Keep each clipart under 6 MB." }, { status: 400 });
    }

    const store = getObjectStore();
    const uploads = await mapWithConcurrency(files, 4, async (file) => {
      const path = clipartImagePath(ownerUserId, projectId, file.id, getExtension({ name: file.fileName, type: file.type }));
      const thumbPath = thumbnailPathFor(path);
      // Both the content type and the byte length are folded into the SigV4
      // signature; the browser must send exactly these values. That is the only
      // way to bound a presigned PUT, since R2 has no POST-policy equivalent.
      const mimeType = getAllowedImageContentType({ name: file.fileName, type: file.type }) || file.type || "image/jpeg";
      const [url, thumbUrl] = await Promise.all([
        store.presignPut(mediaKey(ORIGINAL_IMAGES_BUCKET, path), {
          contentType: mimeType,
          contentLength: file.size,
          ttlSeconds: UPLOAD_URL_TTL_SECONDS,
        }),
        store.presignPut(mediaKey(ORIGINAL_IMAGES_BUCKET, thumbPath), {
          contentType: THUMBNAIL_CONTENT_TYPE,
          ttlSeconds: UPLOAD_URL_TTL_SECONDS,
        }),
      ]);
      return { ...file, path, url, mimeType, thumbPath, thumbUrl, thumbContentType: THUMBNAIL_CONTENT_TYPE };
    });
    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to prepare clipart uploads." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    const { user_id: ownerUserId } = await assertProjectAccess(projectId);
    const body = await request.json().catch(() => ({}));
    const prefix = `${ownerUserId}/${projectId}/cliparts/`;
    const uploads: Array<{ id: string; name: string; path: string; mimeType: string; thumbPath: string | null }> = (Array.isArray(body.uploads) ? body.uploads : []).flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const upload = item as Record<string, unknown>;
      const id = String(upload.id || "");
      const name = String(upload.name || "");
      const path = String(upload.path || "");
      const mimeType = String(upload.mimeType || "image/png");
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !name || !path.startsWith(prefix)) return [];
      // Only ever trust the derived thumbnail location, never a client-supplied one.
      const thumbPath = upload.thumbUploaded === true ? thumbnailPathFor(path) : null;
      return [{ id, name, path, mimeType, thumbPath }];
    });
    if (!uploads.length || uploads.length > MAX_CLIPART_UPLOADS) return NextResponse.json({ message: "Invalid clipart metadata." }, { status: 400 });

    const store = getObjectStore();
    // A presigned PUT cannot cap its own body, so finalize is where the size
    // contract is actually enforced; anything oversized is deleted, not orphaned.
    const verified = await mapWithConcurrency(uploads, 4, async (upload) => {
      const key = mediaKey(ORIGINAL_IMAGES_BUCKET, upload.path);
      const head = await store.headObject(key);
      if (!head) throw new Error(`Upload did not complete for ${upload.name}.`);
      if (head.contentLength > MAX_CLIPART_UPLOAD_BYTES) {
        await store.deleteObjects([key]);
        throw new Error(`${upload.name} is larger than the allowed clipart size.`);
      }

      let thumbPath: string | null = null;
      if (upload.thumbPath) {
        const thumbKey = mediaKey(ORIGINAL_IMAGES_BUCKET, upload.thumbPath);
        const thumbHead = await store.headObject(thumbKey);
        if (thumbHead && thumbHead.contentLength <= MAX_THUMBNAIL_BYTES) {
          thumbPath = upload.thumbPath;
        } else if (thumbHead) {
          await store.deleteObjects([thumbKey]);
        }
      }
      return { ...upload, thumbPath };
    });

    const signed = mediaUrlsForBucket(ORIGINAL_IMAGES_BUCKET, [
      ...verified.map((upload) => upload.path),
      ...verified.map((upload) => upload.thumbPath),
    ]);
    const createdAt = new Date().toISOString();
    return NextResponse.json({
      assets: verified.map((upload) => ({
        ...upload,
        url: signed.get(upload.path) ?? null,
        thumbUrl: upload.thumbPath ? signed.get(upload.thumbPath) ?? null : null,
        createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to finalize cliparts." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    const { user_id: ownerUserId } = await assertProjectAccess(projectId);
    const body = await request.json().catch(() => ({}));
    const prefix = `${ownerUserId}/${projectId}/cliparts/`;
    const paths: string[] = (Array.isArray(body.paths) ? body.paths : []).map(String).filter((path: string) => path.startsWith(prefix));
    if (paths.length) {
      // Remove each asset's derivative alongside it so cleanup cannot orphan thumbnails.
      await getObjectStore().deleteObjects(
        paths.flatMap((path) => [
          mediaKey(ORIGINAL_IMAGES_BUCKET, path),
          mediaKey(ORIGINAL_IMAGES_BUCKET, thumbnailPathFor(path)),
        ]),
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to clean up cliparts." }, { status: 500 });
  }
}
