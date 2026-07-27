import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_LABEL,
  MAX_PROJECT_UPLOAD_FILES,
  MAX_UPLOAD_BYTES,
  MAX_PROJECT_UPLOAD_TOTAL_BYTES,
  ORIGINAL_IMAGES_BUCKET,
  getAllowedImageContentType,
  getImageExtension,
  isAllowedImageFile,
} from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import {
  MAX_THUMBNAIL_BYTES,
  THUMBNAIL_CONTENT_TYPE,
  assertProjectOwner,
  defaultGraphSettings,
  imagePath,
  normalizeGraphSettings,
  sourceImagePath,
  thumbnailPathFor,
} from "@/lib/projects";
import { getObjectStore, mediaKey } from "@/lib/storage/media";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const UPLOAD_URL_TTL_SECONDS = 15 * 60;

function getExtension(file: { name?: string; type?: string }) {
  const nameExtension = getImageExtension(file.name || "");
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

type UploadMetadata = {
  name: string;
  type: string;
  size: number;
};

type PreparedUpload = UploadMetadata & {
  id: string;
  path: string;
  /** Presigned direct-to-R2 PUT URL; replaces the Supabase upload token. */
  url: string;
  contentType: string;
  thumbPath: string;
  thumbUrl: string;
  thumbContentType: string;
};

function parseUploadMetadata(value: unknown): UploadMetadata[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const file = item as Record<string, unknown>;
    const name = typeof file.name === "string" ? file.name : "";
    const type = typeof file.type === "string" ? file.type : "";
    const size = Number(file.size);
    if (!name || !Number.isFinite(size) || size < 0) return [];
    return [{ name, type, size }];
  });
}

function validateUploadMetadata(files: UploadMetadata[]) {
  if (!files.length) return "At least one source file is required.";
  if (files.length > MAX_PROJECT_UPLOAD_FILES) return `Upload up to ${MAX_PROJECT_UPLOAD_FILES} source files.`;
  if (files.reduce((total, file) => total + file.size, 0) > MAX_PROJECT_UPLOAD_TOTAL_BYTES) return "Combined upload is too large.";
  for (const file of files) {
    if (!isAllowedImageFile(file)) return `Upload ${ALLOWED_IMAGE_LABEL} only.`;
    if (file.size > MAX_UPLOAD_BYTES) return "File is too large.";
  }
  return null;
}

function buildSettingsWithSources(uploadedImages: Array<{ id: string; name: string; path: string; thumbPath: string | null }>) {
  const settings = settingsForImage();
  const sourceImages = uploadedImages.map((image, index) => ({
    ...image,
    width: settings.imageWidth,
    height: settings.imageHeight,
    measurementUnit: settings.measurementUnit,
    imageLineThickness: settings.imageLineThickness,
    sourceFillThreshold: settings.sourceFillThreshold,
    sourceFillMinStrokePixels: settings.sourceFillMinStrokePixels,
    strokeGapClosePixels: settings.strokeGapClosePixels,
    imageAutoEnhance: settings.imageAutoEnhance,
    imageDenoiseLevel: settings.imageDenoiseLevel,
    imageEdgeDetection: settings.imageEdgeDetection,
    imageColorQuantization: settings.imageColorQuantization,
    vectorizerLineAdjust: settings.vectorizerLineAdjust,
    vectorizerInkThreshold: settings.vectorizerInkThreshold,
    vectorizerFidelity: settings.vectorizerFidelity,
    x: defaultSourceX(settings.graphWidth, settings.imageWidth),
    y: index * settings.imageHeight,
    topPadding: 0,
    bottomPadding: 0,
    locked: false,
    visible: true,
    rotationDegrees: 0 as const,
    flipX: false,
    flipY: false,
  }));
  return normalizeGraphSettings({ ...settings, sourceImages });
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      const files = parseUploadMetadata(body.files);
      if (!title) return NextResponse.json({ message: "Project title is required." }, { status: 400 });
      const validationError = validateUploadMetadata(files);
      if (validationError) return NextResponse.json({ message: validationError }, { status: 400 });

      const supabase = getSupabaseAdmin();
      const store = getObjectStore();
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

      try {
        const uploads = await mapWithConcurrency(files, 4, async (file, index): Promise<PreparedUpload> => {
          const id = index === 0 ? "original" : crypto.randomUUID();
          const path = index === 0
            ? imagePath(session.userId, project.id, "original", getExtension(file))
            : sourceImagePath(session.userId, project.id, id, getExtension(file));
          const thumbPath = thumbnailPathFor(path);
          // Content type and byte length are folded into the SigV4 signature,
          // so the browser must send exactly these. That is the only bound a
          // presigned PUT has — R2 offers no POST-policy equivalent.
          const contentType = getAllowedImageContentType(file) || "application/octet-stream";
          const [url, thumbUrl] = await Promise.all([
            store.presignPut(mediaKey(ORIGINAL_IMAGES_BUCKET, path), {
              contentType,
              contentLength: file.size,
              ttlSeconds: UPLOAD_URL_TTL_SECONDS,
            }),
            store.presignPut(mediaKey(ORIGINAL_IMAGES_BUCKET, thumbPath), {
              contentType: THUMBNAIL_CONTENT_TYPE,
              ttlSeconds: UPLOAD_URL_TTL_SECONDS,
            }),
          ]);
          return { ...file, id, path, url, contentType, thumbPath, thumbUrl, thumbContentType: THUMBNAIL_CONTENT_TYPE };
        });
        return NextResponse.json({ ok: true, projectId: project.id, uploads });
      } catch (signError) {
        await supabase.from("projects").delete().eq("id", project.id).eq("user_id", session.userId);
        throw signError;
      }
    }
    return NextResponse.json(
      { message: "Project files must use the signed direct-upload flow." },
      { status: 415 },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create project." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json().catch(() => ({}));
    const projectId = String(body.projectId || "");
    const uploads = Array.isArray(body.uploads) ? body.uploads : [];
    if (!/^[0-9a-f-]{36}$/i.test(projectId) || !uploads.length || uploads.length > MAX_PROJECT_UPLOAD_FILES) {
      return NextResponse.json({ message: "Invalid upload finalization request." }, { status: 400 });
    }
    await assertProjectOwner(projectId);
    const prefix = `${session.userId}/${projectId}/`;
    const uploadedImages: Array<{ id: string; name: string; path: string; thumbPath: string | null }> = uploads.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const upload = item as Record<string, unknown>;
      const id = String(upload.id || "");
      const name = String(upload.name || "");
      const path = String(upload.path || "");
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !name || !path.startsWith(prefix)) return [];
      // Only ever trust the derived thumbnail location, never a client-supplied one.
      const thumbPath = upload.thumbUploaded === true ? thumbnailPathFor(path) : null;
      return [{ id, name, path, thumbPath }];
    });
    if (uploadedImages.length !== uploads.length || uploadedImages[0]?.id !== "original") {
      return NextResponse.json({ message: "Invalid uploaded file metadata." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const store = getObjectStore();
    // A presigned PUT cannot cap its own body, so finalize is where the size
    // contract is enforced; anything oversized is deleted rather than orphaned.
    const verifiedImages = await mapWithConcurrency(uploadedImages, 4, async (image) => {
      const key = mediaKey(ORIGINAL_IMAGES_BUCKET, image.path);
      const head = await store.headObject(key);
      if (!head) throw new Error(`Upload did not complete for ${image.name}.`);
      if (head.contentLength > MAX_UPLOAD_BYTES) {
        await store.deleteObjects([key]);
        throw new Error(`${image.name} is larger than the allowed upload size.`);
      }

      let thumbPath: string | null = null;
      if (image.thumbPath) {
        const thumbKey = mediaKey(ORIGINAL_IMAGES_BUCKET, image.thumbPath);
        const thumbHead = await store.headObject(thumbKey);
        if (thumbHead && thumbHead.contentLength <= MAX_THUMBNAIL_BYTES) {
          thumbPath = image.thumbPath;
        } else if (thumbHead) {
          await store.deleteObjects([thumbKey]);
        }
      }
      return { ...image, thumbPath };
    });
    const finalizedSettings = buildSettingsWithSources(verifiedImages);
    const { error } = await supabase
      .from("projects")
      .update({ original_image_path: verifiedImages[0].path, settings: finalizedSettings })
      .eq("id", projectId)
      .eq("user_id", session.userId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, projectId, redirectTo: `/projects/${projectId}` });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to finalize project." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json().catch(() => ({}));
    const projectId = String(body.projectId || "");
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ message: "Invalid project." }, { status: 400 });
    await assertProjectOwner(projectId);
    const prefix = `${session.userId}/${projectId}/`;
    const paths: string[] = (Array.isArray(body.paths) ? body.paths : []).map(String).filter((path: string) => path.startsWith(prefix));
    const supabase = getSupabaseAdmin();
    if (paths.length) {
      // Remove each asset's derivative alongside it so cleanup cannot orphan thumbnails.
      await getObjectStore().deleteObjects(
        paths.flatMap((path) => [
          mediaKey(ORIGINAL_IMAGES_BUCKET, path),
          mediaKey(ORIGINAL_IMAGES_BUCKET, thumbnailPathFor(path)),
        ]),
      );
    }
    const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("user_id", session.userId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to clean up upload." }, { status: 500 });
  }
}
