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

function settingsForImage(width: number, height: number) {
  const cellWidth = defaultGraphSettings.cellWidth;
  const cellHeight = defaultGraphSettings.cellHeight;
  const safeWidth = Number.isFinite(width) && width > 0 ? width : defaultGraphSettings.outputWidth;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : defaultGraphSettings.outputHeight;
  const targetAspect = safeWidth / safeHeight;
  const maxCells = Math.max(1, Math.floor(6000 / cellWidth));
  const naturalLongSide = Math.max(safeWidth / cellWidth, safeHeight / cellHeight);
  const aspectLongSide = Math.max(targetAspect, 1 / targetAspect) * 2;
  const targetLongSide = Math.max(1, Math.min(maxCells, Math.round(Math.max(12, naturalLongSide, aspectLongSide))));
  let graphWidth = 1;
  let graphHeight = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestArea = 0;

  for (let candidateWidth = 1; candidateWidth <= targetLongSide; candidateWidth += 1) {
    for (let candidateHeight = 1; candidateHeight <= targetLongSide; candidateHeight += 1) {
      if (Math.max(candidateWidth, candidateHeight) > targetLongSide) continue;
      const aspectScore = Math.abs(Math.log((candidateWidth / candidateHeight) / targetAspect));
      const area = candidateWidth * candidateHeight;
      if (aspectScore < bestScore - 0.000001 || (Math.abs(aspectScore - bestScore) <= 0.000001 && area > bestArea)) {
        graphWidth = candidateWidth;
        graphHeight = candidateHeight;
        bestScore = aspectScore;
        bestArea = area;
      }
    }
  }

  return normalizeGraphSettings({
    ...defaultGraphSettings,
    graphWidth,
    graphHeight,
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
    const width = Number(formData.get("width") || defaultGraphSettings.outputWidth);
    const height = Number(formData.get("height") || defaultGraphSettings.outputHeight);
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
    const settings = settingsForImage(width, height);
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
