import { NextResponse } from "next/server";
import { DESIGN_ASSETS_BUCKET, ORIGINAL_IMAGES_BUCKET, PROCESSED_IMAGES_BUCKET } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import { verifySignedPayload } from "@/lib/auth/security";
import { assertSafeObjectKey, mediaReadModeFromEnv } from "@/lib/object-storage";
import { getObjectStore } from "@/lib/storage/media";

export const runtime = "nodejs";

type Context = { params: Promise<{ key?: string[] }> };

type LocalMediaUploadToken = {
  kind?: string;
  key?: string;
  contentType?: string;
  contentLength?: number;
  exp?: number;
};

const ALLOWED_MEDIA_KEY_PREFIXES = [
  `${ORIGINAL_IMAGES_BUCKET}/`,
  `${PROCESSED_IMAGES_BUCKET}/`,
  `${DESIGN_ASSETS_BUCKET}/`,
];

function isAllowedMediaKey(key: string) {
  return ALLOWED_MEDIA_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function uploadError(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: { "cache-control": "no-store" } });
}

function verifyUploadToken(token: string | null, key: string): LocalMediaUploadToken | null {
  const payload = verifySignedPayload<LocalMediaUploadToken>(token);
  if (
    payload?.kind !== "local-media-upload" ||
    payload.key !== key ||
    !payload.contentType ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }
  return payload;
}

export async function PUT(request: Request, context: Context) {
  try {
    if (mediaReadModeFromEnv() !== "direct") return uploadError("Media upload proxy is not enabled.", 404);
    await requireSession();

    const { key: segments = [] } = await context.params;
    const key = assertSafeObjectKey(segments.join("/"));
    if (!isAllowedMediaKey(key)) return uploadError("Invalid media key.", 400);

    const token = verifyUploadToken(new URL(request.url).searchParams.get("token"), key);
    if (!token) return uploadError("Invalid upload token.", 403);

    const requestContentType = request.headers.get("content-type")?.split(";")[0]?.toLowerCase() ?? "";
    if (requestContentType !== token.contentType.toLowerCase()) return uploadError("Invalid upload content type.", 400);

    const blob = await request.blob();
    if (typeof token.contentLength === "number" && blob.size !== token.contentLength) {
      return uploadError("Invalid upload length.", 400);
    }

    await getObjectStore().putObject({
      key,
      body: Buffer.from(await blob.arrayBuffer()),
      contentType: token.contentType,
      cacheControl: "public, max-age=3600",
    });

    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload media.";
    const status = message === "Sign in is required." ? 401 : 500;
    return uploadError(message, status);
  }
}
