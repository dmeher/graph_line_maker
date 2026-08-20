"use client";

import { MAX_CANVAS_DIMENSION, MAX_CANVAS_PIXELS } from "@/lib/canvas/performance-limits";
import { renderPdfFirstPageToCanvas } from "@/lib/canvas/pdf";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import type { DesignFile, DesignImageNode, DesignMaskOperation } from "@/lib/design/types";
import { SOURCE_THUMBNAIL_MAX_EDGE, createThumbnailBlob, putToPresignedUrl, uploadWithThumbnail, type PresignedUpload } from "@/lib/storage/upload-client";

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality = 0.92) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to encode image.")), type, quality));
}

export async function normalizeDesignFile(file: File | Blob, name = "image.png") {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Keep image files under 50 MB.");
  const isPdf = file.type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  let source: CanvasImageSource & { width: number; height: number };
  let releaseSource: (() => void) | null = null;
  if (isPdf) source = (await renderPdfFirstPageToCanvas(file)).canvas;
  else {
    const url = URL.createObjectURL(file);
    let image: HTMLImageElement;
    try { image = await new Promise<HTMLImageElement>((resolve, reject) => { const candidate = new Image(); candidate.onload = () => resolve(candidate); candidate.onerror = () => reject(new Error("Unable to decode the selected image.")); candidate.src = url; }); }
    catch (error) { URL.revokeObjectURL(url); throw error; }
    source = Object.assign(image, { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
    releaseSource = () => URL.revokeObjectURL(url);
  }
  if (!source.width || !source.height) { releaseSource?.(); throw new Error("The selected image has no drawable pixels."); }
  const scale = Math.min(1, MAX_CANVAS_DIMENSION / source.width, MAX_CANVAS_DIMENSION / source.height, Math.sqrt(MAX_CANVAS_PIXELS / (source.width * source.height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) { releaseSource?.(); throw new Error("Canvas is not available."); }
  context.imageSmoothingQuality = "high";
  try { context.drawImage(source, 0, 0, canvas.width, canvas.height); }
  finally { releaseSource?.(); }
  const blob = await canvasToBlob(canvas, "image/png");
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error("The normalized PNG is larger than 50 MB. Reduce its dimensions and try again.");
  return { blob, width: canvas.width, height: canvas.height, name: name.replace(/\.[^.]+$/, "") + ".png", type: "image/png" as const };
}

type PreparedFile = { id: string; name: string; type: "image/png" | "image/jpeg" | "image/webp"; size: number; width: number; height: number };

export async function uploadDesignFiles(designId: string, items: Array<{ metadata: PreparedFile; blob: Blob }>): Promise<DesignFile[]> {
  const response = await fetch(`/api/designs/${designId}/files`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files: items.map((item) => item.metadata) }) });
  const prepared = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(prepared.uploads)) throw new Error(prepared.message || "Unable to prepare image upload.");
  const uploads = prepared.uploads as PresignedUpload[];
  try {
    const thumbUploaded = await Promise.all(uploads.map((upload, index) => uploadWithThumbnail(upload, items[index].blob, SOURCE_THUMBNAIL_MAX_EDGE).then((result) => result.thumbUploaded)));
    const finalize = await fetch(`/api/designs/${designId}/files`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ files: items.map((item) => item.metadata), uploads: uploads.map((upload, index) => ({ path: upload.path, thumbUploaded: thumbUploaded[index] })) }) });
    const payload = await finalize.json().catch(() => ({}));
    if (!finalize.ok || !Array.isArray(payload.files)) throw new Error(payload.message || "Unable to finalize image upload.");
    return payload.files as DesignFile[];
  } catch (error) {
    await fetch(`/api/designs/${designId}/files`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ paths: prepared.uploads.map((upload: PresignedUpload) => upload.path) }) }).catch(() => {});
    throw error;
  }
}

export async function publishDesignBlob(input: { designId: string; blob: Blob; kind: "design" | "clipart"; title: string; tags?: string[]; width: number; height: number }) {
  const itemId = crypto.randomUUID();
  const metadata = { itemId, kind: input.kind, title: input.title, tags: input.tags ?? [], type: "image/png", size: input.blob.size, width: input.width, height: input.height };
  const prepare = await fetch(`/api/designs/${input.designId}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(metadata) });
  const prepared = await prepare.json().catch(() => ({}));
  if (!prepare.ok || !prepared.upload) throw new Error(prepared.message || "Unable to prepare library save.");
  const upload = prepared.upload as PresignedUpload;
  try {
    await putToPresignedUrl(upload.url, input.blob, upload.contentType);
    let thumbUploaded = false;
    if (upload.thumbUrl && upload.thumbContentType) {
      try {
        const thumbnail = await createThumbnailBlob(input.blob, input.kind === "clipart" ? 256 : 512);
        if (thumbnail) {
          await putToPresignedUrl(upload.thumbUrl, thumbnail, upload.thumbContentType);
          thumbUploaded = true;
        }
      } catch {
        // The immutable full-size item remains usable when its optional derivative fails.
      }
    }
    const finalize = await fetch(`/api/designs/${input.designId}/publish`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...metadata, path: upload.path, thumbUploaded }) });
    const payload = await finalize.json().catch(() => ({}));
    if (!finalize.ok || !payload.item) throw new Error(payload.message || "Unable to save to the shared library.");
    return payload.item;
  } catch (error) {
    await fetch(`/api/designs/${input.designId}/publish`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(metadata) }).catch(() => {});
    throw error;
  }
}

export function loadDesignImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.crossOrigin = "anonymous"; image.onload = () => resolve(image); image.onerror = () => reject(new Error("Unable to load image.")); image.src = url;
  });
}

function drawMaskPath(context: CanvasRenderingContext2D, operation: DesignMaskOperation, width: number, height: number) {
  context.beginPath();
  if (operation.kind === "lasso") {
    operation.points.forEach((point, index) => index ? context.lineTo(point.x * width, point.y * height) : context.moveTo(point.x * width, point.y * height));
    context.closePath(); context.fill(); return;
  }
  context.lineWidth = Math.max(1, operation.radius * width * 2); context.lineCap = "round"; context.lineJoin = "round";
  operation.points.forEach((point, index) => index ? context.lineTo(point.x * width, point.y * height) : context.moveTo(point.x * width, point.y * height));
  if (operation.points.length === 1) { const point = operation.points[0]; context.moveTo(point.x * width + 0.01, point.y * height); context.lineTo(point.x * width, point.y * height); }
  context.stroke();
}

export function renderDesignImageBitmap(image: CanvasImageSource & { width: number; height: number }, node: DesignImageNode) {
  const cropX = Math.round(node.crop.x * image.width); const cropY = Math.round(node.crop.y * image.height);
  const cropWidth = Math.max(1, Math.round(node.crop.width * image.width)); const cropHeight = Math.max(1, Math.round(node.crop.height * image.height));
  const canvas = document.createElement("canvas"); canvas.width = cropWidth; canvas.height = cropHeight;
  const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas is not available.");
  const a = node.adjustments;
  context.filter = `brightness(${Math.max(0, 1 + a.brightness)}) contrast(${Math.max(0, 1 + a.contrast / 100)}) saturate(${Math.max(0, 1 + a.saturation)}) hue-rotate(${a.hue}deg) blur(${a.blur}px) grayscale(${a.grayscale ? 1 : 0}) sepia(${a.sepia ? 1 : 0}) invert(${a.invert ? 1 : 0})`;
  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  context.filter = "none";
  const pristine = document.createElement("canvas"); pristine.width = cropWidth; pristine.height = cropHeight; const pristineContext = pristine.getContext("2d");
  if (pristineContext) { pristineContext.filter = `brightness(${Math.max(0, 1 + a.brightness)}) contrast(${Math.max(0, 1 + a.contrast / 100)}) saturate(${Math.max(0, 1 + a.saturation)}) hue-rotate(${a.hue}deg) blur(${a.blur}px) grayscale(${a.grayscale ? 1 : 0}) sepia(${a.sepia ? 1 : 0}) invert(${a.invert ? 1 : 0})`; pristineContext.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight); }
  for (const operation of node.masks) {
    context.save(); context.globalCompositeOperation = operation.mode === "erase" ? "destination-out" : "source-over";
    if (operation.mode === "restore" && pristineContext) {
      context.beginPath();
      if (operation.kind === "lasso") { operation.points.forEach((point, index) => index ? context.lineTo(point.x * cropWidth, point.y * cropHeight) : context.moveTo(point.x * cropWidth, point.y * cropHeight)); context.closePath(); context.clip(); }
      else { context.lineWidth = Math.max(1, operation.radius * cropWidth * 2); context.lineCap = "round"; operation.points.forEach((point, index) => index ? context.lineTo(point.x * cropWidth, point.y * cropHeight) : context.moveTo(point.x * cropWidth, point.y * cropHeight)); context.strokeStyle = context.createPattern(pristine, "no-repeat") ?? "transparent"; context.stroke(); }
      if (operation.kind === "lasso") context.drawImage(pristine, 0, 0);
    } else { context.fillStyle = "#000"; context.strokeStyle = "#000"; drawMaskPath(context, operation, cropWidth, cropHeight); }
    context.restore();
  }
  return canvas;
}
