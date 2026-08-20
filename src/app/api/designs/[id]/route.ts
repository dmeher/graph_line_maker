import { NextRequest, NextResponse } from "next/server";
import { DESIGN_ASSETS_BUCKET } from "@/lib/constants";
import { assertDesignAccess, getDesignForCurrentUser, updateDesignRecord } from "@/lib/design/server";
import { designDocumentSchema } from "@/lib/design/schema";
import { getObjectStore, mediaKey } from "@/lib/storage/media";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const design = await getDesignForCurrentUser(id);
    if (!design) return NextResponse.json({ message: "Design not found." }, { status: 404 });
    return NextResponse.json({ design });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to load Design." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const baseRevision = Number(body.baseRevision);
    if (!Number.isInteger(baseRevision) || baseRevision < 1) return NextResponse.json({ message: "A valid base revision is required." }, { status: 400 });
    const parsed = designDocumentSchema.safeParse(body.document);
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid Design document." }, { status: 400 });
    const updated = await updateDesignRecord({ designId: id, baseRevision, title: typeof body.title === "string" ? body.title : undefined, document: parsed.data });
    if (!updated) return NextResponse.json({ message: "This Design changed elsewhere.", code: "REVISION_CONFLICT" }, { status: 409 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to save Design." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const { row } = await assertDesignAccess(id);
    const files = await getSupabaseAdmin().from("design_files").select("path, thumb_path").eq("design_id", id);
    if (files.error) throw new Error(files.error.message);
    const keys = [row.preview_path, row.preview_thumb_path, ...(files.data ?? []).flatMap((file: { path: string; thumb_path: string | null }) => [file.path, file.thumb_path])].filter((path): path is string => Boolean(path)).map((path) => mediaKey(DESIGN_ASSETS_BUCKET, path));
    const { error } = await getSupabaseAdmin().from("designs").delete().eq("id", id);
    if (error) throw new Error(error.message);
    if (keys.length) await getObjectStore().deleteObjects(keys).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to delete Design." }, { status: 500 });
  }
}
