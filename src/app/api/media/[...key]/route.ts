import { NextResponse } from "next/server";
import { DESIGN_ASSETS_BUCKET, ORIGINAL_IMAGES_BUCKET, PROCESSED_IMAGES_BUCKET } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import { assertSafeObjectKey, mediaReadModeFromEnv } from "@/lib/object-storage";
import { getObjectStore } from "@/lib/storage/media";

export const runtime = "nodejs";

type Context = { params: Promise<{ key?: string[] }> };

const ALLOWED_MEDIA_KEY_PREFIXES = [
  `${ORIGINAL_IMAGES_BUCKET}/`,
  `${PROCESSED_IMAGES_BUCKET}/`,
  `${DESIGN_ASSETS_BUCKET}/`,
];

function isAllowedMediaKey(key: string) {
  return ALLOWED_MEDIA_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function mediaError(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(_request: Request, context: Context) {
  try {
    if (mediaReadModeFromEnv() !== "direct") return mediaError("Media proxy is not enabled.", 404);
    await requireSession();

    const { key: segments = [] } = await context.params;
    const key = assertSafeObjectKey(segments.join("/"));
    if (!isAllowedMediaKey(key)) return mediaError("Invalid media key.", 400);

    const object = await getObjectStore().getObject(key);
    if (!object) return mediaError("Media not found.", 404);

    const responseBody = new Uint8Array(object.body.byteLength);
    responseBody.set(object.body);

    return new NextResponse(responseBody.buffer, {
      headers: {
        "cache-control": "private, max-age=3600",
        "content-length": String(object.body.byteLength),
        "content-type": object.contentType ?? "application/octet-stream",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load media.";
    const status = message === "Sign in is required." ? 401 : 500;
    return mediaError(message, status);
  }
}
