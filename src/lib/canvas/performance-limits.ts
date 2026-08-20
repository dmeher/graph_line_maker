export const MAX_CANVAS_DIMENSION = 24_000;
export const MAX_CANVAS_PIXELS = 16_000_000;
export const MAX_PROCESSING_ESTIMATED_BYTES = 512 * 1024 * 1024;
/** Product limits: one cell renders at 1 cm, so a graph is at most 20 cm wide and 125 cm tall. */
export const MAX_GRAPH_WIDTH_CELLS = 100;
export const MAX_GRAPH_HEIGHT_CELLS = 125;
/**
 * Source/clipart working canvases are downscaled to at most this many pixels at load.
 * Equals the largest possible output canvas (20 x 125 cells at 40 px/cell = 800 x 5000),
 * so a full-graph placement keeps at least 1x sampling while huge uploads shrink sharply.
 */
export const MAX_WORKING_SOURCE_PIXELS = 4_000_000;

const BASE_PROCESSING_BYTES_PER_PIXEL = 18;
// The renderer merges one source layer at a time, so only one layer's scratch
// buffers are live alongside the shared output maps at any instant.
const SEQUENTIAL_LAYER_SCRATCH_BYTES_PER_PIXEL = 10;

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
  // Keep the parameter for callers that report visible-layer counts, but do not
  // multiply sequential scratch memory by every layer in the document.
  void positiveInteger(layerCount);
  const pixels = safeWidth * safeHeight;
  const estimatedBytes = pixels * (BASE_PROCESSING_BYTES_PER_PIXEL + SEQUENTIAL_LAYER_SCRATCH_BYTES_PER_PIXEL);

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
  let width = Math.max(1, Math.min(MAX_GRAPH_WIDTH_CELLS, Math.min(sideLimit, positiveInteger(widthCells))));
  let height = Math.max(1, Math.min(MAX_GRAPH_HEIGHT_CELLS, Math.min(sideLimit, positiveInteger(heightCells))));
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
