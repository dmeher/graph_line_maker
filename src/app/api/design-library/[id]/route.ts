import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DESIGN_ASSETS_BUCKET } from "@/lib/constants";
import { assertLibraryMutationAccess } from "@/lib/design/server";
import { getObjectStore, mediaKey } from "@/lib/storage/media";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
const updateSchema = z.object({ title: z.string().trim().min(1).max(160), tags: z.array(z.string().trim().min(1).max(40)).max(20) });

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    await assertLibraryMutationAccess(id);
    const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid library item." }, { status: 400 });
    const { error } = await getSupabaseAdmin().from("design_library_items").update({ title: parsed.data.title, tags: Array.from(new Set(parsed.data.tags.map((tag) => tag.toLowerCase()))) }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to update library item." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const { row } = await assertLibraryMutationAccess(id);
    const { error } = await getSupabaseAdmin().from("design_library_items").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await getObjectStore().deleteObjects([mediaKey(DESIGN_ASSETS_BUCKET, row.path), ...(row.thumb_path ? [mediaKey(DESIGN_ASSETS_BUCKET, row.thumb_path)] : [])]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to delete library item." }, { status: 500 });
  }
}
