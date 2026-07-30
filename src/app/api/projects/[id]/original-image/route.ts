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
import { assertProjectAccess, imagePath, thumbnailPathFor } from "@/lib/projects";
import { getObjectStore, mediaKey } from "@/lib/storage/media";
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
    const { id } = await context.params;
    const owner = await assertProjectAccess(id);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) return NextResponse.json({ message: "Source file is required." }, { status: 400 });
    if (!isAllowedImageFile(file)) {
      return NextResponse.json({ message: `Upload ${ALLOWED_IMAGE_LABEL} only.` }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ message: "File is too large." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const store = getObjectStore();
    // Keyed to the project owner so an admin replacement lands beside the
    // project's other assets rather than under the admin's own prefix.
    const path = imagePath(owner.user_id, id, "original", getExtension(file));
    await store.putObject({
      key: mediaKey(ORIGINAL_IMAGES_BUCKET, path),
      body: Buffer.from(await file.arrayBuffer()),
      contentType: getAllowedImageContentType(file) || file.type || "application/octet-stream",
      cacheControl: "public, max-age=3600",
    });

    const { error } = await supabase
      .from("projects")
      .update({ original_image_path: path })
      .eq("id", id)
      .eq("user_id", owner.user_id);

    if (error) throw new Error(error.message);
    if (owner.original_image_path && owner.original_image_path !== path) {
      await store.deleteObjects([
        mediaKey(ORIGINAL_IMAGES_BUCKET, owner.original_image_path),
        mediaKey(ORIGINAL_IMAGES_BUCKET, thumbnailPathFor(owner.original_image_path)),
      ]);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to update image." },
      { status: 500 },
    );
  }
}
