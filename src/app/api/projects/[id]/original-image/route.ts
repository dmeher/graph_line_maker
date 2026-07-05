import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_LABEL,
  MAX_UPLOAD_BYTES,
  ORIGINAL_IMAGES_BUCKET,
  getAllowedImageContentType,
  getImageExtension,
  isAllowedImageFile,
} from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import { assertProjectOwner, imagePath } from "@/lib/projects";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function getExtension(file: File) {
  const nameExtension = getImageExtension(file.name);
  if (ALLOWED_IMAGE_EXTENSIONS.has(nameExtension)) return nameExtension === "jpeg" ? "jpg" : nameExtension;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "application/pdf" || file.type === "application/x-pdf") return "pdf";
  return "jpg";
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const owner = await assertProjectOwner(id);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) return NextResponse.json({ message: "Source file is required." }, { status: 400 });
    if (!isAllowedImageFile(file)) {
      return NextResponse.json({ message: `Upload ${ALLOWED_IMAGE_LABEL} only.` }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ message: "File is too large." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    if (owner.original_image_path) {
      await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).remove([owner.original_image_path]);
    }

    const path = imagePath(session.userId, id, "original", getExtension(file));
    const { error: uploadError } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: getAllowedImageContentType(file) || file.type,
      upsert: true,
    });

    if (uploadError) throw new Error(uploadError.message);

    const { error } = await supabase
      .from("projects")
      .update({ original_image_path: path })
      .eq("id", id)
      .eq("user_id", session.userId);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to update image." },
      { status: 500 },
    );
  }
}
