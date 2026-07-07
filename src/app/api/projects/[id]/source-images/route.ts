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
import { assertProjectOwner, sourceImagePath } from "@/lib/projects";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const MAX_SOURCE_UPLOADS = 12;

function getExtension(file: File) {
  const nameExtension = getImageExtension(file.name);
  if (ALLOWED_IMAGE_EXTENSIONS.has(nameExtension)) return nameExtension === "jpeg" ? "jpg" : nameExtension;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "application/pdf" || file.type === "application/x-pdf") return "pdf";
  return "jpg";
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    await assertProjectOwner(id);
    const formData = await request.formData();
    const files = [...formData.getAll("files"), ...formData.getAll("file")].filter((value): value is File => value instanceof File);
    const requestedIds = formData.getAll("ids").map((value) => String(value || ""));

    if (!files.length) return NextResponse.json({ message: "At least one source file is required." }, { status: 400 });
    if (files.length > MAX_SOURCE_UPLOADS) {
      return NextResponse.json({ message: `Upload up to ${MAX_SOURCE_UPLOADS} images at a time.` }, { status: 400 });
    }

    for (const file of files) {
      if (!isAllowedImageFile(file)) {
        return NextResponse.json({ message: `Upload ${ALLOWED_IMAGE_LABEL} only.` }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ message: "File is too large." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const images = await Promise.all(
      files.map(async (file, index) => {
        const requestedId = requestedIds[index]?.trim();
        const imageId = requestedId && /^[a-zA-Z0-9-]{1,80}$/.test(requestedId) ? requestedId : crypto.randomUUID();
        const path = sourceImagePath(session.userId, id, imageId, getExtension(file));
        const { error } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).upload(path, file, {
          cacheControl: "3600",
          contentType: getAllowedImageContentType(file) || file.type,
          upsert: true,
        });

        if (error) throw new Error(error.message);
        return {
          id: imageId,
          name: file.name || "Source image",
          path,
        };
      }),
    );

    return NextResponse.json({ images });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to upload source images." },
      { status: 500 },
    );
  }
}
