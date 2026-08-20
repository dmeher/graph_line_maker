import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DESIGN_ASSETS_BUCKET, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { MAX_CANVAS_DIMENSION, MAX_CANVAS_PIXELS } from "@/lib/canvas/performance-limits";
import { designLibraryPath, designPreviewPath } from "@/lib/design/paths";
import { assertDesignAccess } from "@/lib/design/server";
import { getObjectStore, mediaKey, mediaUrlsForBucket } from "@/lib/storage/media";
import { MAX_THUMBNAIL_BYTES, THUMBNAIL_CONTENT_TYPE, thumbnailPathFor } from "@/lib/storage/paths";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const publishSchema = z.object({
  itemId: z.string().uuid(), kind: z.enum(["design", "clipart"]), title: z.string().trim().min(1).max(160),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]), type: z.enum(["image/png", "image/jpeg", "image/webp"]).default("image/png"),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES), width: z.number().int().min(1).max(MAX_CANVAS_DIMENSION), height: z.number().int().min(1).max(MAX_CANVAS_DIMENSION),
}).refine((value) => value.width * value.height <= MAX_CANVAS_PIXELS, "Published image exceeds the safe pixel limit.");
type Context = { params: Promise<{ id: string }> };
const TTL_SECONDS = 15 * 60;

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id: designId } = await context.params;
    const { row } = await assertDesignAccess(designId);
    const parsed = publishSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid published image." }, { status: 400 });
    const extension = parsed.data.type === "image/jpeg" ? "jpg" : parsed.data.type.split("/")[1];
    const path = designLibraryPath(row.user_id, parsed.data.kind, parsed.data.itemId, extension);
    const thumbPath = thumbnailPathFor(path);
    const store = getObjectStore();
    const existing = await getSupabaseAdmin().from("design_library_items").select("id").eq("id", parsed.data.itemId).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data || await store.objectExists(mediaKey(DESIGN_ASSETS_BUCKET, path))) return NextResponse.json({ message: "A published item with this immutable ID already exists." }, { status: 409 });
    const [url, thumbUrl] = await Promise.all([
      store.presignPut(mediaKey(DESIGN_ASSETS_BUCKET, path), { contentType: parsed.data.type, contentLength: parsed.data.size, ttlSeconds: TTL_SECONDS }),
      store.presignPut(mediaKey(DESIGN_ASSETS_BUCKET, thumbPath), { contentType: THUMBNAIL_CONTENT_TYPE, ttlSeconds: TTL_SECONDS }),
    ]);
    return NextResponse.json({ upload: { ...parsed.data, path, url, contentType: parsed.data.type, thumbPath, thumbUrl, thumbContentType: THUMBNAIL_CONTENT_TYPE } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to prepare publication." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id: designId } = await context.params;
    const { row } = await assertDesignAccess(designId);
    const body = await request.json().catch(() => ({}));
    const parsed = publishSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid published image." }, { status: 400 });
    const extension = parsed.data.type === "image/jpeg" ? "jpg" : parsed.data.type.split("/")[1];
    const path = designLibraryPath(row.user_id, parsed.data.kind, parsed.data.itemId, extension);
    if (body.path !== path) return NextResponse.json({ message: "Invalid publication path." }, { status: 400 });
    const store = getObjectStore();
    const object = await store.headObject(mediaKey(DESIGN_ASSETS_BUCKET, path));
    if (!object || object.contentLength !== parsed.data.size || object.contentLength > MAX_UPLOAD_BYTES || object.contentType !== parsed.data.type) {
      if (object) await store.deleteObjects([mediaKey(DESIGN_ASSETS_BUCKET, path)]);
      return NextResponse.json({ message: "Published image upload could not be verified." }, { status: 400 });
    }
    const candidateThumb = body.thumbUploaded === true ? thumbnailPathFor(path) : null;
    let thumbPath: string | null = null;
    if (candidateThumb) {
      const thumb = await store.headObject(mediaKey(DESIGN_ASSETS_BUCKET, candidateThumb));
      if (thumb && thumb.contentLength <= MAX_THUMBNAIL_BYTES) thumbPath = candidateThumb;
      else if (thumb) await store.deleteObjects([mediaKey(DESIGN_ASSETS_BUCKET, candidateThumb)]);
    }
    const { data, error } = await getSupabaseAdmin().from("design_library_items").insert({ id: parsed.data.itemId, user_id: row.user_id, kind: parsed.data.kind, title: parsed.data.title, tags: Array.from(new Set(parsed.data.tags.map((tag) => tag.toLowerCase()))), path, thumb_path: thumbPath, mime_type: parsed.data.type, width: parsed.data.width, height: parsed.data.height, size_bytes: parsed.data.size, source_design_id: designId }).select("created_at, updated_at").single();
    if (error) {
      await store.deleteObjects([mediaKey(DESIGN_ASSETS_BUCKET, path), ...(thumbPath ? [mediaKey(DESIGN_ASSETS_BUCKET, thumbPath)] : [])]);
      throw new Error(error.message);
    }
    if (parsed.data.kind === "design") {
      const previewPath = designPreviewPath(row.user_id, designId, extension);
      const previewThumbPath = thumbPath ? thumbnailPathFor(previewPath) : null;
      try {
        await store.copyObject(mediaKey(DESIGN_ASSETS_BUCKET, path), mediaKey(DESIGN_ASSETS_BUCKET, previewPath));
        if (thumbPath && previewThumbPath) await store.copyObject(mediaKey(DESIGN_ASSETS_BUCKET, thumbPath), mediaKey(DESIGN_ASSETS_BUCKET, previewThumbPath));
        await getSupabaseAdmin().from("designs").update({ preview_path: previewPath, preview_thumb_path: previewThumbPath }).eq("id", designId);
      } catch { /* publication remains valid even if the private draft preview cannot be refreshed */ }
    }
    const urls = mediaUrlsForBucket(DESIGN_ASSETS_BUCKET, [path, thumbPath]);
    return NextResponse.json({ item: { id: parsed.data.itemId, userId: row.user_id, kind: parsed.data.kind, title: parsed.data.title, tags: parsed.data.tags, path, thumbPath, mimeType: parsed.data.type, width: parsed.data.width, height: parsed.data.height, sizeBytes: parsed.data.size, sourceDesignId: designId, ownerEmail: "", ownerDisplayName: null, url: urls.get(path) ?? null, thumbUrl: thumbPath ? urls.get(thumbPath) ?? null : null, createdAt: (data as { created_at: string }).created_at, updatedAt: (data as { updated_at: string }).updated_at } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to publish image." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { id: designId } = await context.params;
    const { row } = await assertDesignAccess(designId);
    const body = await request.json().catch(() => ({}));
    const kind = body.kind === "clipart" ? "clipart" : "design";
    const itemId = z.string().uuid().safeParse(body.itemId);
    if (!itemId.success) return NextResponse.json({ ok: true });
    const finalized = await getSupabaseAdmin().from("design_library_items").select("id").eq("id", itemId.data).maybeSingle();
    if (finalized.error) throw new Error(finalized.error.message);
    if (finalized.data) return NextResponse.json({ message: "A finalized library item must be deleted through the library endpoint." }, { status: 409 });
    const path = designLibraryPath(row.user_id, kind, itemId.data, body.type === "image/jpeg" ? "jpg" : body.type === "image/webp" ? "webp" : "png");
    await getObjectStore().deleteObjects([mediaKey(DESIGN_ASSETS_BUCKET, path), mediaKey(DESIGN_ASSETS_BUCKET, thumbnailPathFor(path))]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to clean up publication." }, { status: 500 });
  }
}
