import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_LABEL,
  MAX_PROJECT_UPLOAD_TOTAL_BYTES,
  MAX_UPLOAD_BYTES,
  ORIGINAL_IMAGES_BUCKET,
  getAllowedImageContentType,
  getImageExtension,
  isAllowedImageFile,
} from "@/lib/constants";
import {
  MAX_THUMBNAIL_BYTES,
  THUMBNAIL_CONTENT_TYPE,
  assertProjectAccess,
  sourceImagePath,
  thumbnailPathFor,
} from "@/lib/projects";
import { getObjectStore, mediaKey, mediaUrlsForBucket } from "@/lib/storage/media";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const MAX_SOURCE_UPLOADS = 100;
const UPLOAD_URL_TTL_SECONDS = 15 * 60;

type UploadMetadata = { name: string; type: string; size: number; id: string };

function getExtension(file: { name?: string; type?: string }) {
  const nameExtension = getImageExtension(file.name || "");
  if (ALLOWED_IMAGE_EXTENSIONS.has(nameExtension)) return nameExtension === "jpeg" ? "jpg" : nameExtension;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "application/pdf" || file.type === "application/x-pdf") return "pdf";
  return "jpg";
}

function parseFiles(value: unknown): UploadMetadata[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const file = item as Record<string, unknown>;
    const name = String(file.name || "");
    const type = String(file.type || "");
    const size = Number(file.size);
    const requestedId = String(file.id || "");
    if (!name || !Number.isFinite(size) || size < 0) return [];
    return [{ name, type, size, id: /^[a-zA-Z0-9-]{1,80}$/.test(requestedId) ? requestedId : crypto.randomUUID() }];
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    // Keys stay under the project owner even when an admin uploads on their behalf.
    const { user_id: ownerUserId } = await assertProjectAccess(projectId);
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json({ message: "Source files must use signed direct uploads." }, { status: 415 });
    }
    const body = await request.json().catch(() => ({}));
    const files = parseFiles(body.files);
    if (!files.length) return NextResponse.json({ message: "At least one source file is required." }, { status: 400 });
    if (files.length > MAX_SOURCE_UPLOADS) return NextResponse.json({ message: `Upload up to ${MAX_SOURCE_UPLOADS} images at a time.` }, { status: 400 });
    if (files.reduce((total, file) => total + file.size, 0) > MAX_PROJECT_UPLOAD_TOTAL_BYTES) {
      return NextResponse.json({ message: "Combined upload is too large." }, { status: 413 });
    }
    for (const file of files) {
      if (!isAllowedImageFile(file)) return NextResponse.json({ message: `Upload ${ALLOWED_IMAGE_LABEL} only.` }, { status: 400 });
      if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ message: "File is too large." }, { status: 400 });
    }

    const store = getObjectStore();
    const uploads = await mapWithConcurrency(files, 4, async (file) => {
      const path = sourceImagePath(ownerUserId, projectId, file.id, getExtension(file));
      const thumbPath = thumbnailPathFor(path);
      // The browser must send exactly this content type and byte length: both
      // are folded into the SigV4 signature, which is the only way to bound a
      // presigned PUT. R2 has no POST-policy equivalent.
      const contentType = getAllowedImageContentType(file) || "application/octet-stream";
      const [url, thumbUrl] = await Promise.all([
        store.presignPut(mediaKey(ORIGINAL_IMAGES_BUCKET, path), {
          contentType,
          contentLength: file.size,
          ttlSeconds: UPLOAD_URL_TTL_SECONDS,
        }),
        store.presignPut(mediaKey(ORIGINAL_IMAGES_BUCKET, thumbPath), {
          contentType: THUMBNAIL_CONTENT_TYPE,
          ttlSeconds: UPLOAD_URL_TTL_SECONDS,
        }),
      ]);
      return { ...file, path, url, contentType, thumbPath, thumbUrl, thumbContentType: THUMBNAIL_CONTENT_TYPE };
    });
    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to prepare source uploads." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    const { user_id: ownerUserId } = await assertProjectAccess(projectId);
    const body = await request.json().catch(() => ({}));
    const prefix = `${ownerUserId}/${projectId}/sources/`;
    const images: Array<{ id: string; name: string; path: string; thumbPath: string | null }> = (Array.isArray(body.uploads) ? body.uploads : []).flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const upload = item as Record<string, unknown>;
      const id = String(upload.id || "");
      const name = String(upload.name || "");
      const path = String(upload.path || "");
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !name || !path.startsWith(prefix)) return [];
      // Only ever trust the derived thumbnail location, never a client-supplied one.
      const thumbPath = upload.thumbUploaded === true ? thumbnailPathFor(path) : null;
      return [{ id, name, path, thumbPath }];
    });
    if (!images.length || images.length > MAX_SOURCE_UPLOADS) return NextResponse.json({ message: "Invalid source upload metadata." }, { status: 400 });

    const store = getObjectStore();
    // A presigned PUT is not self-limiting, so the finalize step is where the
    // size and type contract is actually enforced. Anything that slipped
    // through is deleted rather than left orphaned in the bucket.
    const verified = await mapWithConcurrency(images, 4, async (image) => {
      const key = mediaKey(ORIGINAL_IMAGES_BUCKET, image.path);
      const head = await store.headObject(key);
      if (!head) throw new Error(`Upload did not complete for ${image.name}.`);
      if (head.contentLength > MAX_UPLOAD_BYTES) {
        await store.deleteObjects([key]);
        throw new Error(`${image.name} is larger than the allowed upload size.`);
      }

      let thumbPath: string | null = null;
      if (image.thumbPath) {
        const thumbKey = mediaKey(ORIGINAL_IMAGES_BUCKET, image.thumbPath);
        const thumbHead = await store.headObject(thumbKey);
        if (thumbHead && thumbHead.contentLength <= MAX_THUMBNAIL_BYTES) {
          thumbPath = image.thumbPath;
        } else if (thumbHead) {
          await store.deleteObjects([thumbKey]);
        }
      }
      return { ...image, thumbPath };
    });

    const signed = mediaUrlsForBucket(ORIGINAL_IMAGES_BUCKET, [
      ...verified.map((image) => image.path),
      ...verified.map((image) => image.thumbPath),
    ]);
    return NextResponse.json({
      images: verified.map((image) => ({
        id: image.id,
        name: image.name,
        path: image.path,
        url: signed.get(image.path) ?? null,
        thumbPath: image.thumbPath,
        thumbUrl: image.thumbPath ? signed.get(image.thumbPath) ?? null : null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to finalize source uploads." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    const { user_id: ownerUserId } = await assertProjectAccess(projectId);
    const body = await request.json().catch(() => ({}));
    const prefix = `${ownerUserId}/${projectId}/sources/`;
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
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to clean up source uploads." }, { status: 500 });
  }
}
