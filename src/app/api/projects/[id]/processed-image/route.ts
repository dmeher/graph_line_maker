import { NextRequest, NextResponse } from "next/server";
import { PROCESSED_IMAGES_BUCKET } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import {
  MAX_THUMBNAIL_BYTES,
  THUMBNAIL_CONTENT_TYPE,
  assertProjectOwner,
  imagePath,
  thumbnailPathFor,
} from "@/lib/projects";
import { getObjectStore, mediaKey } from "@/lib/storage/media";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Accepts the full processed PNG, or — with `?variant=thumbnail` — the bounded
 * WebP derivative the dashboard cards render. The derivative is a separate
 * request so the common save path stays a single raw-blob PUT.
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const owner = await assertProjectOwner(id);
    const isThumbnail = request.nextUrl.searchParams.get("variant") === "thumbnail";
    const blob = await request.blob();

    const supabase = getSupabaseAdmin();
    const store = getObjectStore();
    const path = imagePath(session.userId, id, "processed", "png");

    if (isThumbnail) {
      if (blob.type !== THUMBNAIL_CONTENT_TYPE) {
        return NextResponse.json({ message: "Processed thumbnail must be a WebP image." }, { status: 400 });
      }
      if (blob.size > MAX_THUMBNAIL_BYTES) {
        return NextResponse.json({ message: "Processed thumbnail is too large." }, { status: 413 });
      }

      const thumbPath = thumbnailPathFor(path);
      await store.putObject({
        key: mediaKey(PROCESSED_IMAGES_BUCKET, thumbPath),
        body: Buffer.from(await blob.arrayBuffer()),
        contentType: THUMBNAIL_CONTENT_TYPE,
        cacheControl: "public, max-age=3600",
      });

      const { error: thumbError } = await supabase
        .from("projects")
        .update({ processed_thumb_path: thumbPath })
        .eq("id", id)
        .eq("user_id", session.userId);
      if (thumbError) throw new Error(thumbError.message);
      return NextResponse.json({ ok: true, path: thumbPath });
    }

    if (blob.type !== "image/png") {
      return NextResponse.json({ message: "Processed output must be a PNG image." }, { status: 400 });
    }

    // The replacement is written to the same deterministic key, so an explicit
    // delete of the previous object is only needed when the path actually
    // changed. Removing it first would leave a window with no processed image.
    if (owner.processed_image_path && owner.processed_image_path !== path) {
      await store.deleteObjects([
        mediaKey(PROCESSED_IMAGES_BUCKET, owner.processed_image_path),
        mediaKey(PROCESSED_IMAGES_BUCKET, thumbnailPathFor(owner.processed_image_path)),
      ]);
    }

    await store.putObject({
      key: mediaKey(PROCESSED_IMAGES_BUCKET, path),
      body: Buffer.from(await blob.arrayBuffer()),
      contentType: "image/png",
      cacheControl: "public, max-age=3600",
    });

    const { error } = await supabase
      .from("projects")
      .update({ processed_image_path: path })
      .eq("id", id)
      .eq("user_id", session.userId);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, path });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to save processed image." },
      { status: 500 },
    );
  }
}
