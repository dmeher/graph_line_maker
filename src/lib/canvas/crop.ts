import { transformedImageSize } from "./crop-geometry.ts";

export { transformedImageSize } from "./crop-geometry.ts";

export type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NormalizedCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropAspectRatio = { width: number; height: number } | null;

export type CropTransform = {
  crop: CropPixels | null;
  rotationDegrees: number;
  straightenDegrees: number;
  flipX: boolean;
  flipY: boolean;
  aspectRatio: number | null;
};

export const DEFAULT_CROP_TRANSFORM: CropTransform = {
  crop: null,
  rotationDegrees: 0,
  straightenDegrees: 0,
  flipX: false,
  flipY: false,
  aspectRatio: null,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function positiveInteger(value: unknown, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
}

function decodedImageSize(image: HTMLImageElement) {
  const width = positiveInteger(image.naturalWidth || image.width, 0);
  const height = positiveInteger(image.naturalHeight || image.height, 0);
  if (!width || !height) throw new Error("The selected image has no drawable pixels.");
  return { width, height };
}

function assertDrawableCanvas(canvas: HTMLCanvasElement) {
  if (positiveInteger(canvas.width, 0) <= 0 || positiveInteger(canvas.height, 0) <= 0) {
    throw new Error("The selected image has no drawable pixels.");
  }
}

function outputFileName(fileName: string, type: string) {
  const extension = type === "image/png" ? "png" : fileName.split(".").pop() || "png";
  return `${fileName.replace(/\.[^.]+$/, "")}.${extension}`;
}

export function fullCrop(width: number, height: number): CropPixels {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

export function normalizeCrop(crop: CropPixels, width: number, height: number): CropPixels {
  const safeWidth = positiveInteger(width);
  const safeHeight = positiveInteger(height);
  const x = clamp(Math.round(Number(crop.x) || 0), 0, Math.max(0, safeWidth - 1));
  const y = clamp(Math.round(Number(crop.y) || 0), 0, Math.max(0, safeHeight - 1));
  const cropWidth = clamp(Math.round(Number(crop.width) || 1), 1, safeWidth - x);
  const cropHeight = clamp(Math.round(Number(crop.height) || 1), 1, safeHeight - y);
  return { x, y, width: cropWidth, height: cropHeight };
}

export function normalizeCropRect(crop: CropPixels, width: number, height: number): NormalizedCropRect {
  const safeWidth = positiveInteger(width);
  const safeHeight = positiveInteger(height);
  const bounded = normalizeCrop(crop, safeWidth, safeHeight);
  return {
    x: bounded.x / safeWidth,
    y: bounded.y / safeHeight,
    width: bounded.width / safeWidth,
    height: bounded.height / safeHeight,
  };
}

export function pixelCropFromNormalized(crop: NormalizedCropRect, width: number, height: number): CropPixels {
  const safeWidth = positiveInteger(width);
  const safeHeight = positiveInteger(height);
  return normalizeCrop(
    {
      x: Math.round(clamp(Number(crop.x) || 0, 0, 1) * safeWidth),
      y: Math.round(clamp(Number(crop.y) || 0, 0, 1) * safeHeight),
      width: Math.round(clamp(Number(crop.width) || 0, 0, 1) * safeWidth),
      height: Math.round(clamp(Number(crop.height) || 0, 0, 1) * safeHeight),
    },
    safeWidth,
    safeHeight,
  );
}

export function mapCropBetweenDimensions(
  crop: CropPixels,
  source: { width: number; height: number },
  target: { width: number; height: number },
) {
  const sourceWidth = positiveInteger(source.width);
  const sourceHeight = positiveInteger(source.height);
  const targetWidth = positiveInteger(target.width);
  const targetHeight = positiveInteger(target.height);
  const normalized = normalizeCrop(crop, sourceWidth, sourceHeight);
  return normalizeCrop(
    {
      x: Math.round((normalized.x / sourceWidth) * targetWidth),
      y: Math.round((normalized.y / sourceHeight) * targetHeight),
      width: Math.round((normalized.width / sourceWidth) * targetWidth),
      height: Math.round((normalized.height / sourceHeight) * targetHeight),
    },
    targetWidth,
    targetHeight,
  );
}

function canvasToFile(canvas: HTMLCanvasElement, fileName: string, type: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(new File([blob], outputFileName(fileName, type), { type }));
        else reject(new Error("Unable to crop image."));
      },
      type,
      0.94,
    );
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = src;
  });
}

export async function cropImageUrlToFile(imageUrl: string, crop: CropPixels, fileName: string, type = "image/png") {
  const image = await loadImage(imageUrl);
  const { width: naturalWidth, height: naturalHeight } = decodedImageSize(image);
  const cropPixels = normalizeCrop(crop, naturalWidth, naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  context.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height,
  );

  return canvasToFile(canvas, fileName, type);
}

function drawTransformedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  fullWidth: number,
  fullHeight: number,
  cropX: number,
  cropY: number,
  rotationDegrees: number,
  flipX: boolean,
  flipY: boolean,
  scale = 1,
) {
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.translate(fullWidth * scale / 2 - cropX, fullHeight * scale / 2 - cropY);
  context.rotate((rotationDegrees * Math.PI) / 180);
  context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  context.drawImage(
    image,
    -image.naturalWidth * scale / 2,
    -image.naturalHeight * scale / 2,
    image.naturalWidth * scale,
    image.naturalHeight * scale,
  );
  context.restore();
}

export async function transformImageUrlToFile({
  imageUrl,
  crop,
  rotationDegrees = 0,
  straightenDegrees = 0,
  flipX = false,
  flipY = false,
  fileName,
  type = "image/png",
}: {
  imageUrl: string;
  crop?: CropPixels | null;
  rotationDegrees?: number;
  straightenDegrees?: number;
  flipX?: boolean;
  flipY?: boolean;
  fileName: string;
  type?: string;
}) {
  const image = await loadImage(imageUrl);
  const { width: naturalWidth, height: naturalHeight } = decodedImageSize(image);
  const transformed = transformedImageSize(naturalWidth, naturalHeight, rotationDegrees, straightenDegrees);
  const cropPixels = crop ? normalizeCrop(crop, transformed.width, transformed.height) : fullCrop(transformed.width, transformed.height);
  const canvas = document.createElement("canvas");
  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  drawTransformedImage(
    context,
    image,
    transformed.width,
    transformed.height,
    cropPixels.x,
    cropPixels.y,
    transformed.rotationDegrees,
    flipX,
    flipY,
  );

  return canvasToFile(canvas, fileName, type);
}

export async function detectContentCropResult({
  imageUrl,
  rotationDegrees = 0,
  straightenDegrees = 0,
  flipX = false,
  flipY = false,
  tolerance = 34,
  marginRatio = 0,
  maxAnalysisPixels = 2_000_000,
}: {
  imageUrl: string;
  rotationDegrees?: number;
  straightenDegrees?: number;
  flipX?: boolean;
  flipY?: boolean;
  tolerance?: number;
  marginRatio?: number;
  maxAnalysisPixels?: number;
}): Promise<ArtworkDetectionResult> {
  try {
    const { detectArtworkCropInWorker } = await import("@/lib/canvas/crop-detection-client");
    const workerResult = await detectArtworkCropInWorker({
      imageUrl,
      rotationDegrees,
      straightenDegrees,
      flipX,
      flipY,
      maxAnalysisPixels,
    });
    if (workerResult) {
      if (!workerResult.crop || marginRatio === 0) return workerResult;
      const transformedImage = await loadImage(imageUrl);
      const source = decodedImageSize(transformedImage);
      const transformed = transformedImageSize(source.width, source.height, rotationDegrees, straightenDegrees);
      const margin = Math.max(0, Math.round(Math.min(transformed.width, transformed.height) * marginRatio));
      return {
        ...workerResult,
        crop: normalizeCrop(
          {
            x: workerResult.crop.x - margin,
            y: workerResult.crop.y - margin,
            width: workerResult.crop.width + margin * 2,
            height: workerResult.crop.height + margin * 2,
          },
          transformed.width,
          transformed.height,
        ),
      };
    }
  } catch {
    // Capability, fetch, or worker failures use the bounded main-thread path.
  }

  const image = await loadImage(imageUrl);
  const source = decodedImageSize(image);
  const sourceScale = Math.min(1, Math.sqrt(maxAnalysisPixels / (source.width * source.height)));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = Math.max(1, Math.round(source.width * sourceScale));
  sourceCanvas.height = Math.max(1, Math.round(source.height * sourceScale));
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("Canvas is not available.");
  sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
  const background = estimateArtworkBackground(sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)).background;

  const transformed = transformedImageSize(source.width, source.height, rotationDegrees, straightenDegrees);
  const analysisScale = Math.min(1, Math.sqrt(maxAnalysisPixels / (transformed.width * transformed.height)));
  const analysis = document.createElement("canvas");
  analysis.width = Math.max(1, Math.round(transformed.width * analysisScale));
  analysis.height = Math.max(1, Math.round(transformed.height * analysisScale));
  const context = analysis.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is not available.");
  if (background[3] > 0) {
    context.fillStyle = `rgba(${Math.round(background[0])}, ${Math.round(background[1])}, ${Math.round(background[2])}, ${background[3] / 255})`;
    context.fillRect(0, 0, analysis.width, analysis.height);
  }
  drawTransformedImage(
    context,
    image,
    transformed.width,
    transformed.height,
    0,
    0,
    transformed.rotationDegrees,
    flipX,
    flipY,
    analysisScale,
  );

  const detected = detectArtworkBounds(context.getImageData(0, 0, analysis.width, analysis.height), {
    colorTolerance: tolerance,
  });
  if (!detected.crop) return detected;
  const nativeMargin = Math.max(0, Math.round(Math.min(transformed.width, transformed.height) * marginRatio));
  return {
    ...detected,
    crop: normalizeCrop(
      {
        x: Math.floor(detected.crop.x / analysisScale) - nativeMargin,
        y: Math.floor(detected.crop.y / analysisScale) - nativeMargin,
        width: Math.ceil(detected.crop.width / analysisScale) + nativeMargin * 2,
        height: Math.ceil(detected.crop.height / analysisScale) + nativeMargin * 2,
      },
      transformed.width,
      transformed.height,
    ),
  };
}

export async function detectContentCrop(options: Parameters<typeof detectContentCropResult>[0]) {
  return (await detectContentCropResult(options)).crop;
}

export async function cropCanvasToFile(canvas: HTMLCanvasElement, crop: CropPixels, fileName: string, type = "image/png") {
  assertDrawableCanvas(canvas);
  const cropPixels = normalizeCrop(crop, canvas.width, canvas.height);
  const output = document.createElement("canvas");
  output.width = cropPixels.width;
  output.height = cropPixels.height;
  const context = output.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  context.drawImage(
    canvas,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height,
  );

  return canvasToFile(output, fileName, type);
}
import {
  detectArtworkBounds,
  estimateArtworkBackground,
  type ArtworkDetectionResult,
} from "./artwork-detection.ts";
