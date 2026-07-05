import { NextRequest, NextResponse } from "next/server";
import { PROCESSED_IMAGES_BUCKET } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import { assertProjectOwner, imagePath } from "@/lib/projects";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const owner = await assertProjectOwner(id);
    const blob = await request.blob();

    if (blob.type !== "image/png") {
      return NextResponse.json({ message: "Processed output must be a PNG image." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (owner.processed_image_path) {
      await supabase.storage.from(PROCESSED_IMAGES_BUCKET).remove([owner.processed_image_path]);
    }

    const path = imagePath(session.userId, id, "processed", "png");
    const { error: uploadError } = await supabase.storage.from(PROCESSED_IMAGES_BUCKET).upload(path, blob, {
      cacheControl: "3600",
      contentType: "image/png",
      upsert: true,
    });

    if (uploadError) throw new Error(uploadError.message);

    const { error } = await supabase
      .from("projects")
      .update({ processed_image_path: path })
      .eq("id", id)
      .eq("user_id", session.userId);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, path });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to save processed image." },
      { status: 500 },
    );
  }
}

