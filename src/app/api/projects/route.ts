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
import { defaultGraphSettings, imagePath, normalizeGraphSettings, sourceImagePath } from "@/lib/projects";
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

function roundCells(value: number) {
  return Math.round(value * 100) / 100;
}

function defaultSourceX(graphWidth: number, width: number) {
  return roundCells(Math.max(0, (graphWidth - width) / 2));
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const formData = await request.formData();
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const files = [...formData.getAll("files"), ...formData.getAll("file")].filter((value): value is File => value instanceof File);

    if (!title) return NextResponse.json({ message: "Project title is required." }, { status: 400 });
    if (!files.length) return NextResponse.json({ message: "At least one source file is required." }, { status: 400 });
    if (files.length > 12) return NextResponse.json({ message: "Upload up to 12 source files." }, { status: 400 });
    for (const file of files) {
      if (!isAllowedImageFile(file)) {
        return NextResponse.json({ message: `Upload ${ALLOWED_IMAGE_LABEL} only.` }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ message: "File is too large." }, { status: 400 });
      }
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

    const uploadedImages = await Promise.all(
      files.map(async (file, index) => {
        const imageId = index === 0 ? "original" : crypto.randomUUID();
        const path =
          index === 0
            ? imagePath(session.userId, project.id, "original", getExtension(file))
            : sourceImagePath(session.userId, project.id, imageId, getExtension(file));
        const { error: uploadError } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).upload(path, file, {
          cacheControl: "3600",
          contentType: getAllowedImageContentType(file) || file.type,
          upsert: index === 0,
        });

        if (uploadError) throw new Error(uploadError.message);
        return {
          id: imageId,
          name: file.name || `Source ${index + 1}`,
          path,
        };
      }),
    );

    const sourceImages = uploadedImages.map((image, index) => ({
      ...image,
      width: settings.imageWidth,
      height: settings.imageHeight,
      measurementUnit: settings.measurementUnit,
      imageLineThickness: settings.imageLineThickness,
      sourceFillThreshold: settings.sourceFillThreshold,
      sourceFillMinStrokePixels: settings.sourceFillMinStrokePixels,
      strokeGapClosePixels: settings.strokeGapClosePixels,
      x: defaultSourceX(settings.graphWidth, settings.imageWidth),
      y: index * settings.imageHeight,
      topPadding: 0,
      bottomPadding: 0,
      locked: false,
      rotationDegrees: 0 as const,
      flipX: false,
      flipY: false,
    }));
    const settingsWithSources = normalizeGraphSettings({
      ...settings,
      sourceImages,
    });

    const { error: updateError } = await supabase
      .from("projects")
      .update({ original_image_path: uploadedImages[0]?.path ?? null, settings: settingsWithSources })
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
