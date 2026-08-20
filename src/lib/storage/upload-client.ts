"use client";

/**
 * Browser-side helpers for direct-to-R2 uploads.
 *
 * Uploads bypass the media gateway deliberately: they are rare next to reads,
 * gain nothing from a CDN, and streaming 50 MB bodies through a Worker would
 * burn paid request duration. The browser PUTs straight to R2 with a presigned
 * URL, which requires CORS on the bucket.
 */

export const SOURCE_THUMBNAIL_MAX_EDGE = 256;
/**
 * Dashboard cards render the **top** of the chart cropped to the card box, not
 * the whole graph: a 20x102-cell project is 400x4080, and a contained preview of
 * that is an unreadable hairline. The derivative is therefore cropped to the
 * card's aspect before it is scaled, so `object-fit: cover` on the card has a
 * source of the right shape. A max-edge box instead produced a 50x512 strip that
 * the card had to magnify roughly sevenfold.
 */
export const CARD_THUMBNAIL_ASPECT = 4 / 3;
export const CARD_THUMBNAIL_MAX_WIDTH = 768;
const THUMBNAIL_QUALITY = 0.72;

export type PresignedUpload = {
  path: string;
  url: string;
  contentType: string;
  thumbPath?: string;
  thumbUrl?: string;
  thumbContentType?: string;
};

/**
 * The content type and byte length are covered by the presigned signature, so
 * they must match exactly what the server signed. Sending a different value
 * fails with a SignatureDoesNotMatch from R2 rather than silently storing the
 * wrong metadata.
 */
export async function putToPresignedUrl(url: string, body: Blob, contentType: string) {
  const response = await fetch(url, {
    method: "PUT",
    body,
    headers: { "content-type": contentType },
  });
  if (!response.ok) {
    throw new Error(`Upload failed with HTTP ${response.status}.`);
  }
}

async function decodeToBitmapSource(file: Blob): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    // createImageBitmap rejects SVG without an intrinsic size in some engines;
    // an <img> handles those, so fall back before giving up.
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = objectUrl;
    });
  } finally {
    // Revoking after decode is safe: the bitmap data is already owned by the element.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

/**
 * Renders a bounded WebP derivative.
 *
 * The clipart library grid renders assets into 40x40 boxes and the dashboard
 * into small cards; both previously pulled the full-resolution original, which
 * the bucket allows to be 50 MB. Generating the derivative here rather than on
 * the server avoids putting `sharp` plus SVG rasterisation on Vercel, and the
 * browser has already decoded these images for cropping.
 *
 * Returns null when the file cannot be decoded (PDFs, corrupt images). Callers
 * treat that as non-fatal and fall back to the full-size asset.
 */
export async function createThumbnailBlob(file: Blob, maxEdge: number): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  const source = await decodeToBitmapSource(file);
  if (!source) return null;

  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  if (!width || !height) {
    if ("close" in source) source.close();
    return null;
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return renderThumbnail(source, { x: 0, y: 0, width, height }, Math.round(width * scale), Math.round(height * scale));
}

/**
 * Renders the dashboard card derivative: the top of the image, cropped to the
 * card's aspect ratio.
 *
 * The crop mirrors `object-fit: cover; object-position: center top` exactly, so
 * the card displays the derivative one-to-one instead of magnifying it. It never
 * upscales — a 400px-wide processed chart yields a 400px-wide derivative, which
 * is simply the resolution the graph was rendered at.
 */
export async function createCardThumbnailBlob(
  file: Blob,
  aspectRatio = CARD_THUMBNAIL_ASPECT,
  maxWidth = CARD_THUMBNAIL_MAX_WIDTH,
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  const source = await decodeToBitmapSource(file);
  if (!source) return null;

  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  if (!width || !height) {
    if ("close" in source) source.close();
    return null;
  }

  const wider = width / height > aspectRatio;
  const cropWidth = wider ? Math.max(1, Math.round(height * aspectRatio)) : width;
  const cropHeight = wider ? height : Math.max(1, Math.round(width / aspectRatio));
  const scale = Math.min(1, maxWidth / cropWidth);

  return renderThumbnail(
    source,
    // Horizontally centred, vertically top-anchored, like the card's own crop.
    { x: Math.round((width - cropWidth) / 2), y: 0, width: cropWidth, height: cropHeight },
    Math.round(cropWidth * scale),
    Math.round(cropHeight * scale),
  );
}

type SourceRect = { x: number; y: number; width: number; height: number };

async function renderThumbnail(
  source: ImageBitmap | HTMLImageElement,
  crop: SourceRect,
  targetWidth: number,
  targetHeight: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, targetWidth);
  canvas.height = Math.max(1, targetHeight);
  const context = canvas.getContext("2d");
  if (!context) {
    if ("close" in source) source.close();
    return null;
  }

  // These are large downscales of fine grid lines; the default filter aliases them.
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source as CanvasImageSource,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  if ("close" in source) source.close();

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", THUMBNAIL_QUALITY);
  });
}

/**
 * Uploads a file and, best effort, its thumbnail. A failed thumbnail never
 * fails the upload — legacy assets have none either, and every render site
 * falls back to the full-size URL.
 */
export async function uploadWithThumbnail(
  upload: PresignedUpload,
  file: Blob,
  maxEdge = SOURCE_THUMBNAIL_MAX_EDGE,
): Promise<{ thumbUploaded: boolean }> {
  await putToPresignedUrl(upload.url, file, upload.contentType);

  if (!upload.thumbUrl || !upload.thumbContentType) return { thumbUploaded: false };

  try {
    const thumbnail = await createThumbnailBlob(file, maxEdge);
    if (!thumbnail) return { thumbUploaded: false };
    await putToPresignedUrl(upload.thumbUrl, thumbnail, upload.thumbContentType);
    return { thumbUploaded: true };
  } catch {
    return { thumbUploaded: false };
  }
}
