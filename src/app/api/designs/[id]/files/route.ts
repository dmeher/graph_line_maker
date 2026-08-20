import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DESIGN_ASSETS_BUCKET, MAX_PROJECT_UPLOAD_TOTAL_BYTES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { designFilePath } from "@/lib/design/paths";
import { assertDesignAccess } from "@/lib/design/server";
import { MAX_CANVAS_DIMENSION, MAX_CANVAS_PIXELS } from "@/lib/canvas/performance-limits";
import { MAX_THUMBNAIL_BYTES, THUMBNAIL_CONTENT_TYPE, thumbnailPathFor } from "@/lib/storage/paths";
import { getObjectStore, mediaKey, mediaUrlsForBucket } from "@/lib/storage/media";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const MAX_FILES_PER_REQUEST = 24;
const UPLOAD_TTL_SECONDS = 15 * 60;
const fileSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(160), type: z.enum(["image/png", "image/jpeg", "image/webp"]), size: z.number().int().positive().max(MAX_UPLOAD_BYTES), width: z.number().int().min(1).max(MAX_CANVAS_DIMENSION), height: z.number().int().min(1).max(MAX_CANVAS_DIMENSION) }).refine((file) => file.width * file.height <= MAX_CANVAS_PIXELS, "Image exceeds the safe pixel limit.");
const filesSchema = z.array(fileSchema).min(1).max(MAX_FILES_PER_REQUEST).refine((files) => files.reduce((sum, file) => sum + file.size, 0) <= MAX_PROJECT_UPLOAD_TOTAL_BYTES, "Combined upload must be 150 MB or smaller.");
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id: designId } = await context.params;
    const { row } = await assertDesignAccess(designId);
    const parsed = filesSchema.safeParse((await request.json().catch(() => ({}))).files);
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid files." }, { status: 400 });
    const existing = await getSupabaseAdmin().from("design_files").select("id").in("id", parsed.data.map((file) => file.id)).limit(1);
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.length) return NextResponse.json({ message: "A Design file with this immutable ID already exists." }, { status: 409 });
    const store = getObjectStore();
    const uploads = await mapWithConcurrency(parsed.data, 4, async (file) => {
      const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const path = designFilePath(row.user_id, designId, file.id, extension);
      const thumbPath = thumbnailPathFor(path);
      if (await store.objectExists(mediaKey(DESIGN_ASSETS_BUCKET, path))) throw new Error("A Design object with this immutable ID already exists.");
      const [url, thumbUrl] = await Promise.all([
        store.presignPut(mediaKey(DESIGN_ASSETS_BUCKET, path), { contentType: file.type, contentLength: file.size, ttlSeconds: UPLOAD_TTL_SECONDS }),
        store.presignPut(mediaKey(DESIGN_ASSETS_BUCKET, thumbPath), { contentType: THUMBNAIL_CONTENT_TYPE, ttlSeconds: UPLOAD_TTL_SECONDS }),
      ]);
      return { ...file, path, url, contentType: file.type, thumbPath, thumbUrl, thumbContentType: THUMBNAIL_CONTENT_TYPE };
    });
    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to prepare Design files." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id: designId } = await context.params;
    const { row } = await assertDesignAccess(designId);
    const requestBody = await request.json().catch(() => ({}));
    const parsed = filesSchema.safeParse(requestBody.files);
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid files." }, { status: 400 });
    const uploads = Array.isArray(requestBody.uploads) ? requestBody.uploads : [];
    if (uploads.length !== parsed.data.length) return NextResponse.json({ message: "Upload metadata does not match the prepared files." }, { status: 400 });
    const store = getObjectStore();
    const verified = await mapWithConcurrency(parsed.data, 4, async (file, index) => {
      const upload = uploads[index] as Record<string, unknown>;
      const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const expectedPath = designFilePath(row.user_id, designId, file.id, extension);
      const path = String(upload.path || "");
      if (path !== expectedPath) throw new Error("Invalid Design file path.");
      const object = await store.headObject(mediaKey(DESIGN_ASSETS_BUCKET, path));
      if (!object || object.contentLength !== file.size || object.contentLength > MAX_UPLOAD_BYTES || object.contentType !== file.type) {
        if (object) await store.deleteObjects([mediaKey(DESIGN_ASSETS_BUCKET, path)]);
        throw new Error(`Upload verification failed for ${file.name}.`);
      }
      const candidateThumb = upload.thumbUploaded === true ? thumbnailPathFor(path) : null;
      let thumbPath: string | null = null;
      if (candidateThumb) {
        const thumb = await store.headObject(mediaKey(DESIGN_ASSETS_BUCKET, candidateThumb));
        if (thumb && thumb.contentLength <= MAX_THUMBNAIL_BYTES) thumbPath = candidateThumb;
        else if (thumb) await store.deleteObjects([mediaKey(DESIGN_ASSETS_BUCKET, candidateThumb)]);
      }
      return { ...file, path, thumbPath };
    });
    const { error } = await getSupabaseAdmin().from("design_files").insert(verified.map((file) => ({ id: file.id, design_id: designId, user_id: row.user_id, name: file.name, path: file.path, thumb_path: file.thumbPath, mime_type: file.type, width: file.width, height: file.height, size_bytes: file.size })));
    if (error) {
      await store.deleteObjects(verified.flatMap((file) => [mediaKey(DESIGN_ASSETS_BUCKET, file.path), file.thumbPath ? mediaKey(DESIGN_ASSETS_BUCKET, file.thumbPath) : ""]).filter(Boolean));
      throw new Error(error.message);
    }
    const urls = mediaUrlsForBucket(DESIGN_ASSETS_BUCKET, verified.flatMap((file) => [file.path, file.thumbPath]));
    return NextResponse.json({ files: verified.map((file) => ({ id: file.id, designId, name: file.name, path: file.path, thumbPath: file.thumbPath, mimeType: file.type, width: file.width, height: file.height, sizeBytes: file.size, createdAt: new Date().toISOString(), url: urls.get(file.path) ?? null, thumbUrl: file.thumbPath ? urls.get(file.thumbPath) ?? null : null })) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to finalize Design files." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { id: designId } = await context.params;
    const { row } = await assertDesignAccess(designId);
    const body = await request.json().catch(() => ({}));
    const prefix = `${row.user_id}/designs/${designId}/files/`;
    const paths = (Array.isArray(body.paths) ? body.paths : []).map(String).filter((path: string) => path.startsWith(prefix)).slice(0, MAX_FILES_PER_REQUEST);
    if (paths.length) {
      await getObjectStore().deleteObjects(paths.flatMap((path: string) => [mediaKey(DESIGN_ASSETS_BUCKET, path), mediaKey(DESIGN_ASSETS_BUCKET, thumbnailPathFor(path))]));
      await getSupabaseAdmin().from("design_files").delete().eq("design_id", designId).in("path", paths);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to clean up Design files." }, { status: 500 });
  }
}
