import { NextResponse } from "next/server";
import { DESIGN_ASSETS_BUCKET } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import { createBlankDesignDocument, createDesignImageNode } from "@/lib/design/defaults";
import { designFilePath } from "@/lib/design/paths";
import { createDesignRecord, updateDesignRecord } from "@/lib/design/server";
import { getObjectStore, mediaKey } from "@/lib/storage/media";
import { thumbnailPathFor } from "@/lib/storage/paths";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const copiedKeys: string[] = [];
  let designId: string | null = null;
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const { data, error } = await getSupabaseAdmin().from("design_library_items").select("id, title, path, thumb_path, mime_type, width, height, size_bytes").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ message: "Library item not found." }, { status: 404 });
    const item = data as { title: string; path: string; thumb_path: string | null; mime_type: string; width: number; height: number; size_bytes: number };
    const document = createBlankDesignDocument(item.width, item.height, null);
    designId = await createDesignRecord({ title: `${item.title} remix`, document });
    const fileId = crypto.randomUUID();
    const extension = item.mime_type === "image/jpeg" ? "jpg" : item.mime_type === "image/webp" ? "webp" : "png";
    const path = designFilePath(session.userId, designId, fileId, extension);
    const thumbPath = item.thumb_path ? thumbnailPathFor(path) : null;
    const store = getObjectStore();
    await store.copyObject(mediaKey(DESIGN_ASSETS_BUCKET, item.path), mediaKey(DESIGN_ASSETS_BUCKET, path));
    copiedKeys.push(mediaKey(DESIGN_ASSETS_BUCKET, path));
    if (item.thumb_path && thumbPath) {
      await store.copyObject(mediaKey(DESIGN_ASSETS_BUCKET, item.thumb_path), mediaKey(DESIGN_ASSETS_BUCKET, thumbPath));
      copiedKeys.push(mediaKey(DESIGN_ASSETS_BUCKET, thumbPath));
    }
    const insert = await getSupabaseAdmin().from("design_files").insert({ id: fileId, design_id: designId, user_id: session.userId, name: item.title, path, thumb_path: thumbPath, mime_type: item.mime_type, width: item.width, height: item.height, size_bytes: item.size_bytes });
    if (insert.error) throw new Error(insert.error.message);
    document.nodes.push(createDesignImageNode({ fileId, name: item.title, width: item.width, height: item.height }));
    const updated = await updateDesignRecord({ designId, baseRevision: 1, document });
    if (!updated) throw new Error("Unable to initialize remix.");
    return NextResponse.json({ designId }, { status: 201 });
  } catch (error) {
    if (copiedKeys.length) await getObjectStore().deleteObjects(copiedKeys).catch(() => {});
    if (designId) {
      try { await getSupabaseAdmin().from("designs").delete().eq("id", designId); } catch { /* best-effort rollback */ }
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to remix library item." }, { status: 500 });
  }
}
