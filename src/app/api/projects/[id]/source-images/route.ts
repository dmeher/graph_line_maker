import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_LABEL,
  MAX_PROJECT_UPLOAD_TOTAL_BYTES,
  MAX_UPLOAD_BYTES,
  ORIGINAL_IMAGES_BUCKET,
  getImageExtension,
  isAllowedImageFile,
} from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import { assertProjectOwner, sourceImagePath } from "@/lib/projects";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const MAX_SOURCE_UPLOADS = 12;

type UploadMetadata = { name: string; type: string; size: number; id: string };

function getExtension(file: { name?: string; type?: string }) {
  const nameExtension = getImageExtension(file.name || "");
  if (ALLOWED_IMAGE_EXTENSIONS.has(nameExtension)) return nameExtension === "jpeg" ? "jpg" : nameExtension;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "application/pdf" || file.type === "application/x-pdf") return "pdf";
  return "jpg";
}

function parseFiles(value: unknown): UploadMetadata[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const file = item as Record<string, unknown>;
    const name = String(file.name || "");
    const type = String(file.type || "");
    const size = Number(file.size);
    const requestedId = String(file.id || "");
    if (!name || !Number.isFinite(size) || size < 0) return [];
    return [{ name, type, size, id: /^[a-zA-Z0-9-]{1,80}$/.test(requestedId) ? requestedId : crypto.randomUUID() }];
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id: projectId } = await context.params;
    await assertProjectOwner(projectId);
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json({ message: "Source files must use signed direct uploads." }, { status: 415 });
    }
    const body = await request.json().catch(() => ({}));
    const files = parseFiles(body.files);
    if (!files.length) return NextResponse.json({ message: "At least one source file is required." }, { status: 400 });
    if (files.length > MAX_SOURCE_UPLOADS) return NextResponse.json({ message: `Upload up to ${MAX_SOURCE_UPLOADS} images at a time.` }, { status: 400 });
    if (files.reduce((total, file) => total + file.size, 0) > MAX_PROJECT_UPLOAD_TOTAL_BYTES) {
      return NextResponse.json({ message: "Combined upload is too large." }, { status: 413 });
    }
    for (const file of files) {
      if (!isAllowedImageFile(file)) return NextResponse.json({ message: `Upload ${ALLOWED_IMAGE_LABEL} only.` }, { status: 400 });
      if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ message: "File is too large." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const uploads = await mapWithConcurrency(files, 4, async (file) => {
      const path = sourceImagePath(session.userId, projectId, file.id, getExtension(file));
      const { data, error } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).createSignedUploadUrl(path, { upsert: true });
      if (error || !data?.token) throw new Error(error?.message || "Unable to prepare source upload.");
      return { ...file, path, token: data.token };
    });
    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to prepare source uploads." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id: projectId } = await context.params;
    await assertProjectOwner(projectId);
    const body = await request.json().catch(() => ({}));
    const prefix = `${session.userId}/${projectId}/sources/`;
    const images: Array<{ id: string; name: string; path: string }> = (Array.isArray(body.uploads) ? body.uploads : []).flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const upload = item as Record<string, unknown>;
      const id = String(upload.id || "");
      const name = String(upload.name || "");
      const path = String(upload.path || "");
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !name || !path.startsWith(prefix)) return [];
      return [{ id, name, path }];
    });
    if (!images.length || images.length > MAX_SOURCE_UPLOADS) return NextResponse.json({ message: "Invalid source upload metadata." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    await mapWithConcurrency(images, 4, async (image) => {
      const { data: exists, error } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).exists(image.path);
      if (error || !exists) throw new Error(`Upload did not complete for ${image.name}.`);
    });
    const { data: signed, error: signError } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).createSignedUrls(images.map((image) => image.path), 60 * 60);
    if (signError) throw new Error(signError.message);
    const signedByPath = new Map((signed ?? []).flatMap((item) => item.path ? [[item.path, item.signedUrl ?? null] as const] : []));
    return NextResponse.json({ images: images.map((image) => ({ ...image, url: signedByPath.get(image.path) ?? null })) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to finalize source uploads." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id: projectId } = await context.params;
    await assertProjectOwner(projectId);
    const body = await request.json().catch(() => ({}));
    const prefix = `${session.userId}/${projectId}/sources/`;
    const paths: string[] = (Array.isArray(body.paths) ? body.paths : []).map(String).filter((path: string) => path.startsWith(prefix));
    if (paths.length) await getSupabaseAdmin().storage.from(ORIGINAL_IMAGES_BUCKET).remove(paths);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to clean up source uploads." }, { status: 500 });
  }
}
