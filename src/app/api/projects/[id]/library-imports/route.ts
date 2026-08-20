import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DESIGN_ASSETS_BUCKET, ORIGINAL_IMAGES_BUCKET } from "@/lib/constants";
import { assertProjectAccess, clipartImagePath, sourceImagePath } from "@/lib/projects";
import { getObjectStore, mediaKey, mediaUrlsForBucket } from "@/lib/storage/media";
import { thumbnailPathFor } from "@/lib/storage/paths";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const importSchema = z.object({ itemId: z.string().uuid(), target: z.enum(["source", "clipart"]), assetId: z.string().uuid() });
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const copied: string[] = [];
  try {
    const { id: projectId } = await context.params;
    const project = await assertProjectAccess(projectId);
    const parsed = importSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid library import." }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from("design_library_items").select("id, kind, title, path, thumb_path, mime_type, width, height, size_bytes, created_at").eq("id", parsed.data.itemId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ message: "Library item not found." }, { status: 404 });
    const item = data as { kind: "design" | "clipart"; title: string; path: string; thumb_path: string | null; mime_type: string; width: number; height: number; created_at: string };
    if (item.kind === "clipart" && parsed.data.target === "source") return NextResponse.json({ message: "Clipart library items can only be inserted as clipart." }, { status: 400 });
    const extension = item.mime_type === "image/jpeg" ? "jpg" : item.mime_type === "image/webp" ? "webp" : "png";
    const path = parsed.data.target === "source" ? sourceImagePath(project.user_id, projectId, parsed.data.assetId, extension) : clipartImagePath(project.user_id, projectId, parsed.data.assetId, extension);
    const thumbPath = item.thumb_path ? thumbnailPathFor(path) : null;
    const store = getObjectStore();
    const destinationKey = mediaKey(ORIGINAL_IMAGES_BUCKET, path);
    await store.copyObject(mediaKey(DESIGN_ASSETS_BUCKET, item.path), destinationKey); copied.push(destinationKey);
    if (item.thumb_path && thumbPath) { const thumbKey = mediaKey(ORIGINAL_IMAGES_BUCKET, thumbPath); await store.copyObject(mediaKey(DESIGN_ASSETS_BUCKET, item.thumb_path), thumbKey); copied.push(thumbKey); }
    const urls = mediaUrlsForBucket(ORIGINAL_IMAGES_BUCKET, [path, thumbPath]);
    return NextResponse.json({ asset: { id: parsed.data.assetId, name: item.title, path, thumbPath, url: urls.get(path) ?? null, thumbUrl: thumbPath ? urls.get(thumbPath) ?? null : null, mimeType: item.mime_type, width: item.width, height: item.height, createdAt: item.created_at, target: parsed.data.target } });
  } catch (error) {
    if (copied.length) await getObjectStore().deleteObjects(copied).catch(() => {});
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to import library item." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { id: projectId } = await context.params;
    const project = await assertProjectAccess(projectId);
    const body = await request.json().catch(() => ({}));
    const paths = (Array.isArray(body.paths) ? body.paths : []).map(String).filter((path: string) => path.startsWith(`${project.user_id}/${projectId}/`)).slice(0, 24);
    if (paths.length) await getObjectStore().deleteObjects(paths.flatMap((path: string) => [mediaKey(ORIGINAL_IMAGES_BUCKET, path), mediaKey(ORIGINAL_IMAGES_BUCKET, thumbnailPathFor(path))]));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to clean up library import." }, { status: 500 });
  }
}
