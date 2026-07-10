export const MAX_CANVAS_DIMENSION = 24_000;
export const MAX_CANVAS_PIXELS = 16_000_000;
export const MAX_PROCESSING_ESTIMATED_BYTES = 512 * 1024 * 1024;

const BASE_PROCESSING_BYTES_PER_PIXEL = 18;
const LAYER_PROCESSING_BYTES_PER_PIXEL = 10;

export type CanvasBudget = {
  width: number;
  height: number;
  pixels: number;
  estimatedBytes: number;
  allowed: boolean;
  reason: string | null;
};

function positiveInteger(value: unknown, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
}

export function inspectCanvasBudget(width: number, height: number, layerCount = 1): CanvasBudget {
  const safeWidth = positiveInteger(width);
  const safeHeight = positiveInteger(height);
  const safeLayerCount = positiveInteger(layerCount);
  const pixels = safeWidth * safeHeight;
  const estimatedBytes = pixels * (BASE_PROCESSING_BYTES_PER_PIXEL + safeLayerCount * LAYER_PROCESSING_BYTES_PER_PIXEL);

  let reason: string | null = null;
  if (safeWidth > MAX_CANVAS_DIMENSION || safeHeight > MAX_CANVAS_DIMENSION) {
    reason = `Canvas sides must not exceed ${MAX_CANVAS_DIMENSION.toLocaleString()} pixels.`;
  } else if (pixels > MAX_CANVAS_PIXELS) {
    reason = `Canvas contains ${pixels.toLocaleString()} pixels; the safe limit is ${MAX_CANVAS_PIXELS.toLocaleString()}.`;
  } else if (estimatedBytes > MAX_PROCESSING_ESTIMATED_BYTES) {
    reason = `This project would need about ${Math.ceil(estimatedBytes / 1024 / 1024).toLocaleString()} MB while processing; the safe limit is ${Math.round(MAX_PROCESSING_ESTIMATED_BYTES / 1024 / 1024)} MB.`;
  }

  return {
    width: safeWidth,
    height: safeHeight,
    pixels,
    estimatedBytes,
    allowed: reason === null,
    reason,
  };
}

export function assertCanvasBudget(width: number, height: number, layerCount = 1) {
  const budget = inspectCanvasBudget(width, height, layerCount);
  if (!budget.allowed) throw new Error(budget.reason || "Canvas exceeds the safe processing budget.");
  return budget;
}

export function clampGraphCellDimensions(widthCells: number, heightCells: number, cellPixels: number) {
  const safeCellPixels = positiveInteger(cellPixels);
  const sideLimit = Math.max(1, Math.floor(MAX_CANVAS_DIMENSION / safeCellPixels));
  let width = Math.max(1, Math.min(sideLimit, positiveInteger(widthCells)));
  let height = Math.max(1, Math.min(sideLimit, positiveInteger(heightCells)));
  const maxCells = Math.max(1, Math.floor(MAX_CANVAS_PIXELS / (safeCellPixels * safeCellPixels)));

  if (width * height > maxCells) {
    const scale = Math.sqrt(maxCells / (width * height));
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));
    while (width * height > maxCells) {
      if (width >= height) width -= 1;
      else height -= 1;
    }
  }

  return { width, height };
}

export function graphDimensionsFitCanvasBudget(widthCells: number, heightCells: number, cellPixels: number) {
  const width = Math.round(widthCells * cellPixels);
  const height = Math.round(heightCells * cellPixels);
  return inspectCanvasBudget(width, height, 1).allowed;
}
