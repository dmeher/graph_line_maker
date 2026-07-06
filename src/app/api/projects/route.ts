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
import { defaultGraphSettings, imagePath, normalizeGraphSettings } from "@/lib/projects";
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

function settingsForImage() {
  const cellWidth = defaultGraphSettings.cellWidth;
  const cellHeight = defaultGraphSettings.cellHeight;
  const graphWidth = defaultGraphSettings.graphWidth;
  const graphHeight = defaultGraphSettings.graphHeight;

  return normalizeGraphSettings({
    ...defaultGraphSettings,
    graphWidth,
    graphHeight,
    imageWidth: defaultGraphSettings.imageWidth,
    imageHeight: defaultGraphSettings.imageHeight,
    imagePadding: 0,
    cellWidth,
    cellHeight,
    pixelSize: cellWidth,
    gridCellSize: cellWidth,
    outputWidth: graphWidth * cellWidth,
    outputHeight: graphHeight * cellHeight,
    spotShape: "round",
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const formData = await request.formData();
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const file = formData.get("file");

    if (!title) return NextResponse.json({ message: "Project title is required." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ message: "Source file is required." }, { status: 400 });
    if (!isAllowedImageFile(file)) {
      return NextResponse.json({ message: `Upload ${ALLOWED_IMAGE_LABEL} only.` }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ message: "File is too large." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const settings = settingsForImage();
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        user_id: session.userId,
        title,
        description: description || null,
        settings,
        width: settings.outputWidth,
        height: settings.outputHeight,
        pixel_size: settings.pixelSize,
        grid_cell_size: settings.gridCellSize,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    const path = imagePath(session.userId, project.id, "original", getExtension(file));
    const { error: uploadError } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: getAllowedImageContentType(file) || file.type,
      upsert: true,
    });

    if (uploadError) throw new Error(uploadError.message);

    const { error: updateError } = await supabase
      .from("projects")
      .update({ original_image_path: path })
      .eq("id", project.id)
      .eq("user_id", session.userId);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ ok: true, projectId: project.id, redirectTo: `/projects/${project.id}` });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create project." },
      { status: 500 },
    );
  }
}
