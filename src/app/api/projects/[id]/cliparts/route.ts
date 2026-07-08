import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ORIGINAL_IMAGES_BUCKET,
  getAllowedImageContentType,
  getImageExtension,
  isAllowedImageFile,
  isPdfFile,
} from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import { assertProjectOwner, clipartImagePath } from "@/lib/projects";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const MAX_CLIPART_UPLOADS = 24;
const MAX_CLIPART_UPLOAD_BYTES = 6 * 1024 * 1024;

function getExtension(file: File) {
  const nameExtension = getImageExtension(file.name);
  if (ALLOWED_IMAGE_EXTENSIONS.has(nameExtension) && nameExtension !== "pdf") return nameExtension === "jpeg" ? "jpg" : nameExtension;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
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
    const requestedNames = formData.getAll("names").map((value) => String(value || "").trim());

    if (!files.length) return NextResponse.json({ message: "At least one clipart file is required." }, { status: 400 });
    if (files.length > MAX_CLIPART_UPLOADS) {
      return NextResponse.json({ message: `Upload up to ${MAX_CLIPART_UPLOADS} cliparts at a time.` }, { status: 400 });
    }

    for (const file of files) {
      if (!isAllowedImageFile(file) || isPdfFile(file)) {
        return NextResponse.json({ message: "Upload PNG, JPG, WEBP, or SVG cliparts only." }, { status: 400 });
      }
      if (file.size > MAX_CLIPART_UPLOAD_BYTES) {
        return NextResponse.json({ message: "Clipart file is too large. Keep each clipart under 6 MB." }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const assets = await Promise.all(
      files.map(async (file, index) => {
        const requestedId = requestedIds[index]?.trim();
        const clipartId = requestedId && /^[a-zA-Z0-9-]{1,80}$/.test(requestedId) ? requestedId : crypto.randomUUID();
        const requestedName = requestedNames[index];
        const baseName = file.name.replace(/\.[^.]+$/i, "").trim();
        const assetName = requestedName || baseName || "Clipart";
        const contentType = getAllowedImageContentType(file) || file.type || "image/jpeg";
        const path = clipartImagePath(session.userId, id, clipartId, getExtension(file));
        const { error } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).upload(path, file, {
          cacheControl: "3600",
          contentType,
          upsert: true,
        });

        if (error) throw new Error(error.message);
        const { data: signed } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).createSignedUrl(path, 60 * 60);
        return {
          id: clipartId,
          name: assetName,
          path,
          url: signed?.signedUrl ?? null,
          mimeType: contentType,
          createdAt: now,
        };
      }),
    );

    return NextResponse.json({ assets });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to upload cliparts." },
      { status: 500 },
    );
  }
}
