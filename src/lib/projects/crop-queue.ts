import type { CropPixels } from "@/lib/canvas/crop";

export function cropQueueItemId(file: Pick<File, "name" | "size" | "lastModified">, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

export function cropQueueStatus(crop: CropPixels | null) {
  return crop ? "Cropped" : "Full image";
}

export function shouldCropQueuedFile(crop: CropPixels | null, previewUrl: string | null) {
  return Boolean(crop && previewUrl);
}
