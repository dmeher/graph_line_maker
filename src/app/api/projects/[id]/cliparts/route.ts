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
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const MAX_CLIPART_UPLOADS = 24;
const MAX_CLIPART_UPLOAD_BYTES = 6 * 1024 * 1024;
const MAX_CLIPART_UPLOAD_TOTAL_BYTES = 48 * 1024 * 1024;

type ClipartMetadata = { id: string; name: string; fileName: string; type: string; size: number };

function getExtension(file: { name?: string; type?: string }) {
  const nameExtension = getImageExtension(file.name || "");
  if (ALLOWED_IMAGE_EXTENSIONS.has(nameExtension) && nameExtension !== "pdf") return nameExtension === "jpeg" ? "jpg" : nameExtension;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  return "jpg";
}

function parseFiles(value: unknown): ClipartMetadata[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const file = item as Record<string, unknown>;
    const id = String(file.id || "");
    const name = String(file.name || "").trim();
    const fileName = String(file.fileName || "");
    const type = String(file.type || "");
    const size = Number(file.size);
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !name || !fileName || !Number.isFinite(size) || size < 0) return [];
    return [{ id, name, fileName, type, size }];
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id: projectId } = await context.params;
    await assertProjectOwner(projectId);
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json({ message: "Cliparts must use signed direct uploads." }, { status: 415 });
    }
    const body = await request.json().catch(() => ({}));
    const files = parseFiles(body.files);
    if (!files.length) return NextResponse.json({ message: "At least one clipart file is required." }, { status: 400 });
    if (files.length > MAX_CLIPART_UPLOADS) return NextResponse.json({ message: `Upload up to ${MAX_CLIPART_UPLOADS} cliparts at a time.` }, { status: 400 });
    if (files.reduce((total, file) => total + file.size, 0) > MAX_CLIPART_UPLOAD_TOTAL_BYTES) {
      return NextResponse.json({ message: "Combined clipart upload must be 48 MB or smaller." }, { status: 413 });
    }
    for (const file of files) {
      const validationInput = { name: file.fileName, type: file.type };
      if (!isAllowedImageFile(validationInput) || isPdfFile(validationInput)) return NextResponse.json({ message: "Upload PNG, JPG, WEBP, or SVG cliparts only." }, { status: 400 });
      if (file.size > MAX_CLIPART_UPLOAD_BYTES) return NextResponse.json({ message: "Keep each clipart under 6 MB." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const uploads = await mapWithConcurrency(files, 4, async (file) => {
      const path = clipartImagePath(session.userId, projectId, file.id, getExtension({ name: file.fileName, type: file.type }));
      const { data, error } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).createSignedUploadUrl(path, { upsert: true });
      if (error || !data?.token) throw new Error(error?.message || "Unable to prepare clipart upload.");
      return { ...file, path, token: data.token, mimeType: getAllowedImageContentType({ name: file.fileName, type: file.type }) || file.type || "image/jpeg" };
    });
    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to prepare clipart uploads." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id: projectId } = await context.params;
    await assertProjectOwner(projectId);
    const body = await request.json().catch(() => ({}));
    const prefix = `${session.userId}/${projectId}/cliparts/`;
    const uploads: Array<{ id: string; name: string; path: string; mimeType: string }> = (Array.isArray(body.uploads) ? body.uploads : []).flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const upload = item as Record<string, unknown>;
      const id = String(upload.id || "");
      const name = String(upload.name || "");
      const path = String(upload.path || "");
      const mimeType = String(upload.mimeType || "image/png");
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !name || !path.startsWith(prefix)) return [];
      return [{ id, name, path, mimeType }];
    });
    if (!uploads.length || uploads.length > MAX_CLIPART_UPLOADS) return NextResponse.json({ message: "Invalid clipart metadata." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    await mapWithConcurrency(uploads, 4, async (upload) => {
      const { data: exists, error } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).exists(upload.path);
      if (error || !exists) throw new Error(`Upload did not complete for ${upload.name}.`);
    });
    const { data: signed, error: signError } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).createSignedUrls(uploads.map((upload) => upload.path), 60 * 60);
    if (signError) throw new Error(signError.message);
    const signedByPath = new Map((signed ?? []).flatMap((item) => item.path ? [[item.path, item.signedUrl ?? null] as const] : []));
    const createdAt = new Date().toISOString();
    return NextResponse.json({ assets: uploads.map((upload) => ({ ...upload, url: signedByPath.get(upload.path) ?? null, createdAt })) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to finalize cliparts." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id: projectId } = await context.params;
    await assertProjectOwner(projectId);
    const body = await request.json().catch(() => ({}));
    const prefix = `${session.userId}/${projectId}/cliparts/`;
    const paths: string[] = (Array.isArray(body.paths) ? body.paths : []).map(String).filter((path: string) => path.startsWith(prefix));
    if (paths.length) await getSupabaseAdmin().storage.from(ORIGINAL_IMAGES_BUCKET).remove(paths);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to clean up cliparts." }, { status: 500 });
  }
}
