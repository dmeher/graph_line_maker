import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DESIGN_ASSETS_BUCKET } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import { createBlankDesignDocument } from "@/lib/design/defaults";
import { designFilePath } from "@/lib/design/paths";
import { assertDesignAccess, createDesignRecord, updateDesignRecord } from "@/lib/design/server";
import { designDocumentSchema, parseDesignDocument } from "@/lib/design/schema";
import { getObjectStore, mediaKey } from "@/lib/storage/media";
import { thumbnailPathFor } from "@/lib/storage/paths";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
const bodySchema = z.object({ title: z.string().trim().min(1).max(160).optional(), kind: z.enum(["document", "template"]).default("document"), document: designDocumentSchema.optional() });

export async function POST(request: NextRequest, context: Context) {
  const copiedKeys: string[] = [];
  let destinationId: string | null = null;
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const { row } = await assertDesignAccess(id);
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid copy." }, { status: 400 });
    const sourceDocument = parsed.data.document ?? parseDesignDocument(row.document);
    const blank = createBlankDesignDocument(sourceDocument.canvas.width, sourceDocument.canvas.height, sourceDocument.canvas.background);
    destinationId = await createDesignRecord({ title: parsed.data.title ?? `${row.title} copy`, kind: parsed.data.kind, document: blank });
    const filesResult = await getSupabaseAdmin().from("design_files").select("id, name, path, thumb_path, mime_type, width, height, size_bytes").eq("design_id", id);
    if (filesResult.error) throw new Error(filesResult.error.message);
    const fileIdMap = new Map<string, string>();
    const copiedFiles: Array<Record<string, unknown>> = [];
    const store = getObjectStore();
    for (const file of (filesResult.data ?? []) as Array<{ id: string; name: string; path: string; thumb_path: string | null; mime_type: string; width: number; height: number; size_bytes: number }>) {
      const fileId = crypto.randomUUID(); fileIdMap.set(file.id, fileId);
      const extension = file.mime_type === "image/jpeg" ? "jpg" : file.mime_type === "image/webp" ? "webp" : "png";
      const path = designFilePath(session.userId, destinationId, fileId, extension);
      const thumbPath = file.thumb_path ? thumbnailPathFor(path) : null;
      await store.copyObject(mediaKey(DESIGN_ASSETS_BUCKET, file.path), mediaKey(DESIGN_ASSETS_BUCKET, path)); copiedKeys.push(mediaKey(DESIGN_ASSETS_BUCKET, path));
      if (file.thumb_path && thumbPath) { await store.copyObject(mediaKey(DESIGN_ASSETS_BUCKET, file.thumb_path), mediaKey(DESIGN_ASSETS_BUCKET, thumbPath)); copiedKeys.push(mediaKey(DESIGN_ASSETS_BUCKET, thumbPath)); }
      copiedFiles.push({ id: fileId, design_id: destinationId, user_id: session.userId, name: file.name, path, thumb_path: thumbPath, mime_type: file.mime_type, width: file.width, height: file.height, size_bytes: file.size_bytes });
    }
    if (copiedFiles.length) {
      const insert = await getSupabaseAdmin().from("design_files").insert(copiedFiles);
      if (insert.error) throw new Error(insert.error.message);
    }
    const document = { ...sourceDocument, nodes: sourceDocument.nodes.map((node) => node.type === "image" ? { ...node, fileId: fileIdMap.get(node.fileId) ?? node.fileId } : node) };
    if (!await updateDesignRecord({ designId: destinationId, baseRevision: 1, document })) throw new Error("Unable to initialize Design copy.");
    return NextResponse.json({ designId: destinationId }, { status: 201 });
  } catch (error) {
    if (copiedKeys.length) await getObjectStore().deleteObjects(copiedKeys).catch(() => {});
    if (destinationId) {
      try { await getSupabaseAdmin().from("designs").delete().eq("id", destinationId); } catch { /* best-effort rollback */ }
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to copy Design." }, { status: 500 });
  }
}
