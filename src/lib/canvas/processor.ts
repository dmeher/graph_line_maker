import { hexToRgb, rgbToHex } from "@/lib/canvas/color";
import { createGridNumberLabels } from "@/lib/canvas/grid-numbering";
import { maskFromImageData, maskFromVectorizedImageData, type ImageDataLike } from "@/lib/canvas/ink-mask";
import { mergeLayerPixelMasks } from "@/lib/canvas/layer-mask-merge";
import { isPdfSource, renderPdfFirstPageToCanvas } from "@/lib/canvas/pdf";
import { createThinArtworkMasks, expandMaskForLineSize } from "@/lib/canvas/thinning";
import { normalizeRotationDegrees } from "@/lib/editor/source-layout";
import {
  DEFAULT_GRID_LINE_COLOR,
  DEFAULT_OUTLINE_COLOR,
  GRAPH_MAJOR_CELL_PIXELS,
  GRAPH_SUBDIVISIONS,
  clampVectorizerInkThreshold,
  clampVectorizerLineAdjust,
  isFillColor,
  isGraphVectorizerFidelity,
  isTransparentFillColor,
} from "@/lib/graph-paper";
import { assertCanvasBudget } from "@/lib/canvas/performance-limits";
import { markGraphCacheHit, startGraphPerformanceStage } from "@/lib/performance/marks";
import { ByteLruCache } from "@/lib/performance/byte-lru";
import type { GraphSettings, PaletteColor } from "@/lib/types";

type CanvasLike = HTMLCanvasElement | OffscreenCanvas;
type ProcessingContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const CELL_LINE_SIDE_KEYS = ["top", "right", "bottom", "left"] as const;

type ProcessedGraphFor<TCanvas extends CanvasLike> = {
  canvas: TCanvas;
  palette: PaletteColor[];
  fillRegions: FillRegion[];
  fillRegionMap: Uint16Array;
};

export type ProcessedGraph = ProcessedGraphFor<HTMLCanvasElement>;

export type FillRegion = {
  id: string;
  color: string;
  cellCount: number;
  centerX: number;
  centerY: number;
  kind: FillRegionKind;
};

type ContentBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FillRegionKind = "source" | "enclosed";

export type VectorizerSourcePlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDegrees: number;
  flipX: boolean;
  flipY: boolean;
  offsetX?: number;
  offsetY?: number;
};

export type VectorizerSource = {
  canvas: HTMLCanvasElement;
  placement: VectorizerSourcePlacement;
};

export type FittedImageLayer = {
  canvas: HTMLCanvasElement;
  settings: GraphSettings;
  vectorizerSource?: VectorizerSource;
  vectorizerCacheKey?: string;
};

export type WorkerFittedImageLayer = {
  canvas: OffscreenCanvas;
  settings: GraphSettings;
  vectorizerCacheKey?: string;
};

type AnyFittedImageLayer = {
  canvas: CanvasLike;
  settings: GraphSettings;
  vectorizerSource?: VectorizerSource;
  vectorizerCacheKey?: string;
};

type FillMaskLayer = {
  mask: Uint8Array;
  kind: FillRegionKind;
};

const contentBoundsCache = new WeakMap<CanvasLike, ContentBounds>();
const vectorizedSvgRequests = new Map<string, Promise<string | null>>();
type VectorizedImageResult = {
  imageData: ImageDataLike;
  vectorizedInkMask: Uint8Array | null;
  vectorizedInkCoverage: Uint8Array | null;
};
const MAX_VECTORIZED_SVG_CACHE_BYTES = 8 * 1024 * 1024;
const MAX_VECTORIZED_IMAGE_CACHE_BYTES = 96 * 1024 * 1024;
const vectorizedSvgCache = new ByteLruCache<string, string>(MAX_VECTORIZED_SVG_CACHE_BYTES);
const vectorizedImageCache = new ByteLruCache<string, VectorizedImageResult>(MAX_VECTORIZED_IMAGE_CACHE_BYTES);

export function clearCanvasProcessingCaches() {
  vectorizedSvgCache.clear();
  vectorizedImageCache.clear();
}

function positiveInteger(value: unknown, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
}

function positiveNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function hasDrawableCanvas(canvas: CanvasLike | null | undefined) {
  return Boolean(canvas && positiveInteger(canvas.width, 0) > 0 && positiveInteger(canvas.height, 0) > 0);
}

function createProcessingCanvas(width: number, height: number) {
  const safeWidth = positiveInteger(width);
  const safeHeight = positiveInteger(height);
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = safeWidth;
    canvas.height = safeHeight;
    return canvas;
  }
  return new OffscreenCanvas(safeWidth, safeHeight);
}

function getProcessingContext(canvas: CanvasLike, options?: CanvasRenderingContext2DSettings) {
  return canvas.getContext("2d", options) as ProcessingContext2D | null;
}

function nativeImageDataFrom(imageData: ImageDataLike) {
  if (typeof ImageData === "undefined") return null;
  if (imageData instanceof ImageData) return imageData;
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function outlineColorForSettings(settings: GraphSettings, fallback?: GraphSettings) {
  return settings.outlineColor || settings.lineColor || fallback?.outlineColor || fallback?.lineColor || DEFAULT_OUTLINE_COLOR;
}

function lineThicknessForSettings(settings: GraphSettings) {
  void settings;
  return 0;
}

function vectorizerFidelityForSettings(settings: GraphSettings) {
  return isGraphVectorizerFidelity(settings.vectorizerFidelity) ? settings.vectorizerFidelity : "exact";
}

function vectorizerRequestKey(settings: GraphSettings, layerCacheKey: string | undefined, width: number, height: number) {
  if (!layerCacheKey) return null;
  const lineAdjust = clampVectorizerLineAdjust(settings.vectorizerLineAdjust);
  const inkThreshold = clampVectorizerInkThreshold(settings.vectorizerInkThreshold);
  const fidelity = vectorizerFidelityForSettings(settings);
  return `${layerCacheKey}:vectorizer:${width}x${height}:${lineAdjust}:${inkThreshold}:${fidelity}`;
}

function rememberVectorizedSvg(key: string, svg: string) {
  vectorizedSvgCache.set(key, svg, { bytes: svg.length * 2 });
}

function vectorizedResultBytes(result: VectorizedImageResult) {
  return result.imageData.data.byteLength +
    (result.vectorizedInkMask?.byteLength ?? 0) +
    (result.vectorizedInkCoverage?.byteLength ?? 0);
}

function readVectorizedImage(key: string) {
  return vectorizedImageCache.get(key) ?? null;
}

function rememberVectorizedImage(key: string, result: VectorizedImageResult) {
  vectorizedImageCache.set(key, result, { bytes: vectorizedResultBytes(result) });
}

function canUseBrowserSvgRasterization() {
  return typeof document !== "undefined" && typeof Image !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined";
}

function canvasBlob(canvas: CanvasLike, type = "image/png") {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to create vectorizer input."));
    }, type);
  });
}

async function imageDataToPngBlob(imageData: ImageDataLike) {
  const nativeImageData = nativeImageDataFrom(imageData);
  if (!nativeImageData) return null;
  const canvas = createProcessingCanvas(imageData.width, imageData.height);
  const context = getProcessingContext(canvas, { willReadFrequently: true });
  if (!context) return null;
  context.putImageData(nativeImageData, 0, 0);
  return canvasBlob(canvas);
}

function styleVectorizedSvgForMask(svg: string, settings: GraphSettings) {
  void settings;
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return svg;
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (document.querySelector("parsererror")) return svg;

  document.querySelectorAll("path, polygon, polyline, line, circle, ellipse, rect").forEach((element) => {
    element.removeAttribute("style");
    element.setAttribute("fill", "#000000");
    element.setAttribute("stroke", "none");
  });

  return new XMLSerializer().serializeToString(document.documentElement);
}

async function fetchVectorizedSvg(imageData: ImageDataLike, settings: GraphSettings, signal?: AbortSignal, layerCacheKey?: string) {
  const requestKey = vectorizerRequestKey(settings, layerCacheKey, imageData.width, imageData.height);
  if (requestKey) {
    const cached = vectorizedSvgCache.get(requestKey);
    if (cached) {
      markGraphCacheHit("vector-svg", cached.length * 2);
      return cached;
    }
    const pending = vectorizedSvgRequests.get(requestKey);
    if (pending) return pending;
  }

  const blob = await imageDataToPngBlob(imageData);
  if (!blob) return null;
  const finishVectorRequest = startGraphPerformanceStage("vector-request", {
    inputBytes: blob.size,
    width: imageData.width,
    height: imageData.height,
  });

  const request = (async () => {
    try {
      const formData = new FormData();
      formData.set("image", blob, "layer.png");
      formData.set("lineAdjust", String(clampVectorizerLineAdjust(settings.vectorizerLineAdjust)));
      formData.set("inkThreshold", String(clampVectorizerInkThreshold(settings.vectorizerInkThreshold)));
      formData.set("fidelity", vectorizerFidelityForSettings(settings));

      const response = await fetch("/api/vectorize", {
        method: "POST",
        body: formData,
        signal: requestKey ? undefined : signal,
      });
      if (!response.ok) return null;
      const svg = styleVectorizedSvgForMask(await response.text(), settings);
      if (requestKey) rememberVectorizedSvg(requestKey, svg);
      return svg;
    } finally {
      finishVectorRequest();
    }
  })();

  if (requestKey) {
    vectorizedSvgRequests.set(requestKey, request);
    request.finally(() => vectorizedSvgRequests.delete(requestKey)).catch(() => {});
  }

  return request;
}

async function svgToImageData(svg: string, width: number, height: number) {
  if (!canUseBrowserSvgRasterization()) return null;
  const finishRasterization = startGraphPerformanceStage("svg-rasterization", {
    svgBytes: svg.length,
    width,
    height,
  });
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    const canvas = createProcessingCanvas(width, height);
    const context = getProcessingContext(canvas, { willReadFrequently: true });
    if (!context) return null;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally {
    URL.revokeObjectURL(url);
    finishRasterization();
  }
}

async function vectorizeImageDataToLineImageData(imageData: ImageDataLike, settings: GraphSettings, signal?: AbortSignal, layerCacheKey?: string) {
  const requestKey = vectorizerRequestKey(settings, layerCacheKey, imageData.width, imageData.height);
  if (requestKey) {
    const cached = readVectorizedImage(requestKey);
    if (cached) {
      markGraphCacheHit("vector-image", vectorizedResultBytes(cached));
      return cached;
    }
  }
  try {
    const svg = await fetchVectorizedSvg(imageData, settings, signal, layerCacheKey);
    if (!svg) return { imageData, vectorizedInkMask: null, vectorizedInkCoverage: null };
    const tracedImageData = await svgToImageData(svg, imageData.width, imageData.height);
    if (!tracedImageData) return { imageData, vectorizedInkMask: null, vectorizedInkCoverage: null };
    const vectorizedInk = maskFromVectorizedImageData(tracedImageData);
    const result = vectorizedInk.count
      ? {
          imageData: tracedImageData,
          vectorizedInkMask: vectorizedInk.mask,
          vectorizedInkCoverage: vectorizedInk.coverage,
        }
      : { imageData, vectorizedInkMask: null, vectorizedInkCoverage: null };
    if (requestKey && result.vectorizedInkMask) rememberVectorizedImage(requestKey, result);
    return result;
  } catch {
    return { imageData, vectorizedInkMask: null, vectorizedInkCoverage: null };
  }
}

function graphDimensions(settings: GraphSettings) {
  const graphWidth = positiveInteger(settings.graphWidth);
  const graphHeight = positiveInteger(settings.graphHeight);
  const cellWidth = GRAPH_MAJOR_CELL_PIXELS;
  const cellHeight = GRAPH_MAJOR_CELL_PIXELS;
  const imageAreaWidth = graphWidth * cellWidth;
  const imageAreaHeight = graphHeight * cellHeight;
  const imageWidthCells = positiveNumber(settings.imageWidth, graphWidth);
  const imageHeightCells = positiveNumber(settings.imageHeight, graphHeight);
  const imageWidth = Math.max(1, Math.min(imageAreaWidth, Math.round(imageWidthCells * cellWidth)));
  const imageHeight = Math.max(1, Math.min(imageAreaHeight, Math.round(imageHeightCells * cellHeight)));
  const outputWidth = imageAreaWidth;
  const outputHeight = imageAreaHeight;

  return {
    cellWidth,
    cellHeight,
    graphWidth,
    graphHeight,
    imageWidth,
    imageHeight,
    imageAreaWidth,
    imageAreaHeight,
    minorWidth: cellWidth / GRAPH_SUBDIVISIONS,
    minorHeight: cellHeight / GRAPH_SUBDIVISIONS,
    outputWidth,
    outputHeight,
  };
}

export async function loadImageToCanvas(fileOrUrl: File | Blob | string, fileName?: string) {
  const finishDecode = startGraphPerformanceStage("decode", {
    kind: isPdfSource(fileOrUrl, fileName) ? "pdf" : "image",
    sourceBytes: typeof fileOrUrl === "string" ? 0 : fileOrUrl.size,
  });
  if (isPdfSource(fileOrUrl, fileName)) {
    try {
      const canvas = (await renderPdfFirstPageToCanvas(fileOrUrl)).canvas;
      finishDecode({ width: canvas.width, height: canvas.height });
      return canvas;
    } catch (error) {
      finishDecode({ failed: true });
      throw error;
    }
  }

  const url = typeof fileOrUrl === "string" ? fileOrUrl : URL.createObjectURL(fileOrUrl);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    const width = positiveInteger(image.naturalWidth || image.width, 0);
    const height = positiveInteger(image.naturalHeight || image.height, 0);
    if (!width || !height) throw new Error("The selected image has no drawable pixels.");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is not available.");
    context.drawImage(image, 0, 0);
    finishDecode({ width, height });
    return canvas;
  } catch (error) {
    finishDecode({ failed: true });
    throw error;
  } finally {
    if (typeof fileOrUrl !== "string") URL.revokeObjectURL(url);
  }
}

export function resizeImage(canvas: HTMLCanvasElement, maxWidth: number, maxHeight: number) {
  if (!hasDrawableCanvas(canvas)) throw new Error("The selected image has no drawable pixels.");
  const safeMaxWidth = positiveInteger(maxWidth);
  const safeMaxHeight = positiveInteger(maxHeight);
  const ratio = Math.min(1, safeMaxWidth / canvas.width, safeMaxHeight / canvas.height);
  if (ratio >= 1) return canvas;

  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(canvas.width * ratio));
  output.height = Math.max(1, Math.round(canvas.height * ratio));
  const context = output.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is not available.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(canvas, 0, 0, output.width, output.height);
  return output;
}

function fitCanvas(canvas: CanvasLike, settings: GraphSettings) {
  if (!hasDrawableCanvas(canvas)) throw new Error("The selected image has no drawable pixels.");
  const dimensions = graphDimensions(settings);
  const width = dimensions.outputWidth;
  const height = dimensions.outputHeight;
  const contentBounds = findContentBounds(canvas);
  const output = createProcessingCanvas(width, height);
  const context = getProcessingContext(output, { willReadFrequently: true });
  if (!context) throw new Error("Canvas is not available.");
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const drawWidth = dimensions.imageWidth;
  const drawHeight = dimensions.imageHeight;
  const x = Math.round((dimensions.imageAreaWidth - drawWidth) / 2) + Math.round(settings.imageOffsetX ?? 0);
  const y = Math.round((dimensions.imageAreaHeight - drawHeight) / 2) + Math.round(settings.imageOffsetY ?? 0);
  context.drawImage(
    canvas,
    contentBounds.x,
    contentBounds.y,
    contentBounds.width,
    contentBounds.height,
    x,
    y,
    drawWidth,
    drawHeight,
  );
  return output;
}

export function findContentBounds(canvas: CanvasLike): ContentBounds {
  const cached = contentBoundsCache.get(canvas);
  if (cached) return cached;
  if (!hasDrawableCanvas(canvas)) throw new Error("The selected image has no drawable pixels.");

  const context = getProcessingContext(canvas, { willReadFrequently: true });
  if (!context) throw new Error("Canvas is not available.");
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 16) continue;
      const isNearWhite = data[index] >= 250 && data[index + 1] >= 250 && data[index + 2] >= 250;
      if (isNearWhite) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    const fullBounds = { x: 0, y: 0, width: canvas.width, height: canvas.height };
    contentBoundsCache.set(canvas, fullBounds);
    return fullBounds;
  }

  const contentMargin = 2;
  const x = Math.max(0, minX - contentMargin);
  const y = Math.max(0, minY - contentMargin);
  const right = Math.min(canvas.width - 1, maxX + contentMargin);
  const bottom = Math.min(canvas.height - 1, maxY + contentMargin);
  const bounds = {
    x,
    y,
    width: Math.max(1, right - x + 1),
    height: Math.max(1, bottom - y + 1),
  };
  contentBoundsCache.set(canvas, bounds);
  return bounds;
}

function buildArtworkMasksFromImageData(
  artworkImageData: ImageDataLike,
  width: number,
  height: number,
  settings: GraphSettings,
  vectorizedInkMask?: Uint8Array | null,
  vectorizedInkCoverage?: Uint8Array | null,
) {
  const finishMaskCreation = startGraphPerformanceStage("mask-creation", {
    width,
    height,
    vectorized: Boolean(vectorizedInkMask),
  });
  const inkMask = vectorizedInkMask ?? maskFromImageData(artworkImageData).mask;
  const masks = createThinArtworkMasks(inkMask, width, height, {
    preserveSourceInk: Boolean(vectorizedInkMask),
    sourceFillThreshold: settings.sourceFillThreshold,
    sourceFillMinStrokePixels: settings.sourceFillMinStrokePixels,
    strokeGapClosePixels: settings.strokeGapClosePixels,
  });
  const imageLineThickness = lineThicknessForSettings(settings);
  const outlineMask = expandMaskForLineSize(masks.outlineMask, width, height, imageLineThickness);
  const outlineCoverage = vectorizedInkCoverage
    ? Uint8Array.from(outlineMask, (value, pixel) => (value ? (vectorizedInkCoverage[pixel] ?? 255) : 0))
    : null;

  const result = {
    enclosedFillMask: masks.enclosedFillMask,
    fillMask: masks.fillMask,
    outlineMask,
    outlineCoverage,
    sourceFillMask: masks.sourceFillMask,
  };
  finishMaskCreation({ maskBytes: width * height * (result.outlineCoverage ? 5 : 4) });
  return result;
}

function buildArtworkMasks(imageData: ImageDataLike, settings: GraphSettings) {
  return buildArtworkMasksFromImageData(imageData, imageData.width, imageData.height, settings);
}

async function buildArtworkMasksAsync(imageData: ImageDataLike, settings: GraphSettings, signal?: AbortSignal, layerCacheKey?: string) {
  const vectorized = await vectorizeImageDataToLineImageData(imageData, settings, signal, layerCacheKey);
  return buildArtworkMasksFromImageData(
    vectorized.imageData,
    imageData.width,
    imageData.height,
    settings,
    vectorized.vectorizedInkMask,
    vectorized.vectorizedInkCoverage,
  );
}

function placeVectorizedSourceImageData(
  vectorizedImageData: ImageDataLike,
  sourceCanvas: HTMLCanvasElement,
  placement: VectorizerSourcePlacement,
  outputWidth: number,
  outputHeight: number,
) {
  const nativeImageData = nativeImageDataFrom(vectorizedImageData);
  if (!nativeImageData) return null;

  const vectorizedCanvas = createProcessingCanvas(vectorizedImageData.width, vectorizedImageData.height);
  const vectorizedContext = getProcessingContext(vectorizedCanvas, { willReadFrequently: true });
  if (!vectorizedContext) return null;
  vectorizedContext.putImageData(nativeImageData, 0, 0);

  const output = createProcessingCanvas(outputWidth, outputHeight);
  const outputContext = getProcessingContext(output, { willReadFrequently: true });
  if (!outputContext) return null;
  outputContext.clearRect(0, 0, outputWidth, outputHeight);
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";

  const bounds = findContentBounds(sourceCanvas);
  const drawX = Math.round(placement.x * GRAPH_MAJOR_CELL_PIXELS + (placement.offsetX ?? 0));
  const drawY = Math.round(placement.y * GRAPH_MAJOR_CELL_PIXELS + (placement.offsetY ?? 0));
  const drawWidth = Math.round(placement.width * GRAPH_MAJOR_CELL_PIXELS);
  const drawHeight = Math.round(placement.height * GRAPH_MAJOR_CELL_PIXELS);
  if (
    !Number.isFinite(drawX) ||
    !Number.isFinite(drawY) ||
    !Number.isFinite(drawWidth) ||
    !Number.isFinite(drawHeight) ||
    drawWidth <= 0 ||
    drawHeight <= 0
  ) {
    return null;
  }

  const rotation = normalizeRotationDegrees(placement.rotationDegrees);
  const rotatedSideways = rotation === 90 || rotation === 270;
  const fittedWidth = rotatedSideways ? drawHeight : drawWidth;
  const fittedHeight = rotatedSideways ? drawWidth : drawHeight;
  if (fittedWidth <= 0 || fittedHeight <= 0) return null;

  outputContext.save();
  outputContext.translate(drawX + drawWidth / 2, drawY + drawHeight / 2);
  outputContext.rotate((rotation * Math.PI) / 180);
  outputContext.scale(placement.flipX ? -1 : 1, placement.flipY ? -1 : 1);
  outputContext.drawImage(
    vectorizedCanvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    -fittedWidth / 2,
    -fittedHeight / 2,
    fittedWidth,
    fittedHeight,
  );
  outputContext.restore();

  return outputContext.getImageData(0, 0, outputWidth, outputHeight);
}

function placeSourceImageData(
  sourceCanvas: HTMLCanvasElement,
  placement: VectorizerSourcePlacement,
  outputWidth: number,
  outputHeight: number,
) {
  const output = createProcessingCanvas(outputWidth, outputHeight);
  const outputContext = getProcessingContext(output, { willReadFrequently: true });
  if (!outputContext) return null;
  outputContext.clearRect(0, 0, outputWidth, outputHeight);
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";

  const bounds = findContentBounds(sourceCanvas);
  const drawX = Math.round(placement.x * GRAPH_MAJOR_CELL_PIXELS + (placement.offsetX ?? 0));
  const drawY = Math.round(placement.y * GRAPH_MAJOR_CELL_PIXELS + (placement.offsetY ?? 0));
  const drawWidth = Math.round(placement.width * GRAPH_MAJOR_CELL_PIXELS);
  const drawHeight = Math.round(placement.height * GRAPH_MAJOR_CELL_PIXELS);
  if (drawWidth <= 0 || drawHeight <= 0) return null;

  const rotation = normalizeRotationDegrees(placement.rotationDegrees);
  const rotatedSideways = rotation === 90 || rotation === 270;
  const fittedWidth = rotatedSideways ? drawHeight : drawWidth;
  const fittedHeight = rotatedSideways ? drawWidth : drawHeight;
  outputContext.save();
  outputContext.translate(drawX + drawWidth / 2, drawY + drawHeight / 2);
  outputContext.rotate((rotation * Math.PI) / 180);
  outputContext.scale(placement.flipX ? -1 : 1, placement.flipY ? -1 : 1);
  outputContext.drawImage(
    sourceCanvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    -fittedWidth / 2,
    -fittedHeight / 2,
    fittedWidth,
    fittedHeight,
  );
  outputContext.restore();
  return outputContext.getImageData(0, 0, outputWidth, outputHeight);
}

async function buildLayerArtworkMasksAsync(
  layer: AnyFittedImageLayer,
  fallbackImageData: ImageDataLike | null,
  width: number,
  height: number,
  signal?: AbortSignal,
) {
  const vectorizerSource = layer.vectorizerSource;
  if (!vectorizerSource || !hasDrawableCanvas(vectorizerSource.canvas)) {
    if (!fallbackImageData) throw new Error("Layer image data is not available.");
    return buildArtworkMasksAsync(fallbackImageData, layer.settings, signal, layer.vectorizerCacheKey);
  }

  function fallbackMasks() {
    const placedSource = placeSourceImageData(vectorizerSource!.canvas, vectorizerSource!.placement, width, height);
    return buildArtworkMasks(placedSource ?? fallbackImageData ?? { data: new Uint8ClampedArray(width * height * 4), width, height }, layer.settings);
  }

  const sourceContext = getProcessingContext(vectorizerSource.canvas, { willReadFrequently: true });
  if (!sourceContext) return fallbackMasks();
  const sourceImageData = sourceContext.getImageData(0, 0, vectorizerSource.canvas.width, vectorizerSource.canvas.height);
  const vectorized = await vectorizeImageDataToLineImageData(
    sourceImageData,
    layer.settings,
    signal,
    layer.vectorizerCacheKey,
  );
  if (!vectorized.vectorizedInkMask) return fallbackMasks();

  const placedImageData = placeVectorizedSourceImageData(
    vectorized.imageData,
    vectorizerSource.canvas,
    vectorizerSource.placement,
    width,
    height,
  );
  if (!placedImageData) return fallbackMasks();
  const placedInk = maskFromVectorizedImageData(placedImageData);
  if (!placedInk.count) return fallbackMasks();

  return buildArtworkMasksFromImageData(
    placedImageData,
    width,
    height,
    layer.settings,
    placedInk.mask,
    placedInk.coverage,
  );
}

function defaultFillColorForRegion(settings: GraphSettings, kind: FillRegionKind) {
  return kind === "source" ? settings.outlineColor || settings.lineColor : settings.fillColor;
}

function fillColorForRegion(settings: GraphSettings, regionId: string, kind: FillRegionKind) {
  const customColor = settings.fillRegions?.[regionId];
  return customColor && isFillColor(customColor) ? customColor : defaultFillColorForRegion(settings, kind);
}

function colorForRegion(settings: GraphSettings, region: FillRegion) {
  const customColor = settings.fillRegions?.[region.id];
  return customColor && isFillColor(customColor) ? customColor : region.color;
}

function labelFillRegions(fillLayers: FillMaskLayer[], width: number, height: number, settings: GraphSettings) {
  const finishRegionLabeling = startGraphPerformanceStage("region-labeling", {
    width,
    height,
    layers: fillLayers.length,
  });
  const fillRegionMap = new Uint16Array(width * height);
  const queue = new Int32Array(fillRegionMap.length);
  const regions: FillRegion[] = [];
  let nextRegionId = 0;

  for (const { mask: fillMask, kind } of fillLayers) {
    const visited = new Uint8Array(fillMask.length);

    for (let start = 0; start < fillMask.length; start += 1) {
      if (!fillMask[start] || visited[start] || fillRegionMap[start] || nextRegionId >= 65535) continue;

      nextRegionId += 1;
      let head = 0;
      let tail = 0;
      let count = 0;
      let sumX = 0;
      let sumY = 0;
      const regionId = String(nextRegionId);

      visited[start] = 1;
      fillRegionMap[start] = nextRegionId;
      queue[tail] = start;
      tail += 1;

      while (head < tail) {
        const index = queue[head];
        head += 1;
        count += 1;

        const x = index % width;
        const y = Math.floor(index / width);
        sumX += x;
        sumY += y;

        function enqueue(next: number) {
          if (!fillMask[next] || visited[next] || fillRegionMap[next]) return;
          visited[next] = 1;
          fillRegionMap[next] = nextRegionId;
          queue[tail] = next;
          tail += 1;
        }

        if (x > 0) enqueue(index - 1);
        if (x < width - 1) enqueue(index + 1);
        if (y > 0) enqueue(index - width);
        if (y < height - 1) enqueue(index + width);
      }

      regions.push({
        id: regionId,
        color: fillColorForRegion(settings, regionId, kind),
        cellCount: count,
        centerX: count ? Math.round(sumX / count) : 0,
        centerY: count ? Math.round(sumY / count) : 0,
        kind,
      });
    }
  }

  finishRegionLabeling({ regions: regions.length, mapBytes: fillRegionMap.byteLength });
  return { fillRegionMap, regions };
}

function createMaskLayer(
  mask: Uint8Array,
  width: number,
  height: number,
  color: string,
  alpha = 255,
  coverage?: Uint8Array | null,
) {
  const canvas = createProcessingCanvas(width, height);
  const context = getProcessingContext(canvas, { willReadFrequently: true });
  if (!context) throw new Error("Canvas is not available.");

  const rgb = hexToRgb(color);
  const imageData = context.createImageData(width, height);
  const data = imageData.data;
  for (let pixel = 0, index = 0; pixel < mask.length; pixel += 1, index += 4) {
    if (!mask[pixel]) continue;
    data[index] = rgb.r;
    data[index + 1] = rgb.g;
    data[index + 2] = rgb.b;
    data[index + 3] = coverage ? Math.round((alpha * coverage[pixel]) / 255) : alpha;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function drawFillRegions(
  context: ProcessingContext2D,
  fillRegionMap: Uint16Array,
  regions: FillRegion[],
  width: number,
  height: number,
  settings: GraphSettings,
  blurRadius: number,
) {
  const layer = createProcessingCanvas(width, height);
  const layerContext = getProcessingContext(layer, { willReadFrequently: true });
  if (!layerContext) throw new Error("Canvas is not available.");

  const colorCache = new Map<string, ReturnType<typeof hexToRgb>>();
  const regionByNumber = new Map(regions.map((region) => [Number(region.id), region] as const));
  const imageData = layerContext.createImageData(width, height);
  const data = imageData.data;

  for (let pixel = 0, index = 0; pixel < fillRegionMap.length; pixel += 1, index += 4) {
    const regionNumber = fillRegionMap[pixel];
    if (!regionNumber) continue;

    const region = regionByNumber.get(regionNumber);
    if (!region) continue;
    const hex = colorForRegion(settings, region);
    if (isTransparentFillColor(hex)) continue;
    let rgb = colorCache.get(hex);
    if (!rgb) {
      rgb = hexToRgb(hex);
      colorCache.set(hex, rgb);
    }
    data[index] = rgb.r;
    data[index + 1] = rgb.g;
    data[index + 2] = rgb.b;
    data[index + 3] = 255;
  }

  layerContext.putImageData(imageData, 0, 0);
  if (blurRadius <= 0) {
    context.drawImage(layer, 0, 0);
    return;
  }

  const softened = createProcessingCanvas(width, height);
  const softenedContext = getProcessingContext(softened);
  if (!softenedContext) throw new Error("Canvas is not available.");
  softenedContext.filter = `blur(${blurRadius}px)`;
  softenedContext.drawImage(layer, 0, 0);
  context.drawImage(softened, 0, 0);
}

function drawMaskLayer(
  context: ProcessingContext2D,
  mask: Uint8Array,
  width: number,
  height: number,
  color: string,
  alpha: number,
  blurRadius: number,
  coverage?: Uint8Array | null,
) {
  const layer = createMaskLayer(mask, width, height, color, alpha, coverage);
  if (blurRadius <= 0) {
    context.drawImage(layer, 0, 0);
    return;
  }

  const softened = createProcessingCanvas(width, height);
  const softenedContext = getProcessingContext(softened);
  if (!softenedContext) throw new Error("Canvas is not available.");
  softenedContext.filter = `blur(${blurRadius}px)`;
  softenedContext.drawImage(layer, 0, 0);
  context.drawImage(softened, 0, 0);
}

function drawColoredMaskLayers(
  context: ProcessingContext2D,
  mask: Uint8Array,
  colorMap: Uint16Array,
  colorsByNumber: ReadonlyMap<number, string>,
  width: number,
  height: number,
  fallbackColor: string,
  alpha: number,
  blurRadius: number,
  coverage?: Uint8Array | null,
) {
  const masksByColor = new Map<string, Uint8Array>();
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const value = mask[pixel];
    if (!value) continue;
    const color = colorsByNumber.get(colorMap[pixel]) ?? fallbackColor;
    let colorMask = masksByColor.get(color);
    if (!colorMask) {
      colorMask = new Uint8Array(mask.length);
      masksByColor.set(color, colorMask);
    }
    colorMask[pixel] = value;
  }

  for (const [color, colorMask] of masksByColor) {
    drawMaskLayer(context, colorMask, width, height, color, alpha, blurRadius, coverage);
  }
}

function drawGraphPaperGrid(canvas: CanvasLike, settings: GraphSettings) {
  const context = getProcessingContext(canvas);
  if (!context) throw new Error("Canvas is not available.");
  const ctx = context;

  const dimensions = graphDimensions(settings);
  const minorWidth = dimensions.minorWidth;
  const minorHeight = dimensions.minorHeight;
  const columns = Math.max(1, Math.round(dimensions.outputWidth / minorWidth));
  const rows = Math.max(1, Math.round(dimensions.outputHeight / minorHeight));
  const baseLineWidth = Math.max(1, Math.min(10, Math.round(settings.gridLineThickness || 1)));
  const minorLineWidth = settings.gridPattern === "dot" ? baseLineWidth : Math.max(1, baseLineWidth);
  const midLineWidth = Math.max(1, baseLineWidth);
  const majorLineWidth = Math.max(midLineWidth, baseLineWidth + 1);
  const majorEvery = Math.max(1, Math.round(settings.majorGridEvery || 5));
  const majorEveryMinor = Math.max(1, majorEvery * GRAPH_SUBDIVISIONS);
  const gridColor = hexToRgb(settings.gridLineColor || DEFAULT_GRID_LINE_COLOR);

  ctx.save();
  ctx.fillStyle = `rgb(${gridColor.r}, ${gridColor.g}, ${gridColor.b})`;

  function lineProfileForIndex(index: number) {
    if (index % majorEveryMinor === 0) return { width: majorLineWidth, alpha: 0.78 };
    if (index % GRAPH_SUBDIVISIONS === 0) return { width: midLineWidth, alpha: 0.58 };
    if (index % 5 === 0) return { width: midLineWidth, alpha: 0.52 };
    return { width: minorLineWidth, alpha: 0.34 };
  }

  function lineStart(index: number, count: number, spacing: number, lineWidth: number, limit: number) {
    if (index === 0) return 0;
    if (index === count) return Math.max(0, limit - lineWidth);
    return Math.round(index * spacing - lineWidth / 2);
  }

  function drawStyledLine(x: number, y: number, width: number, height: number) {
    if (settings.gridPattern === "dot") {
      const radius = Math.max(0.75, width * 0.65);
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + height / 2, radius, radius, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (settings.gridLineStyle === "solid") {
      ctx.fillRect(x, y, width, height);
      return;
    }

    const horizontal = width >= height;
    const dash = settings.gridLineStyle === "dashed" ? 12 : 3;
    const gap = settings.gridLineStyle === "dashed" ? 7 : 5;
    const limit = horizontal ? width : height;
    for (let offset = 0; offset < limit; offset += dash + gap) {
      const segment = Math.min(dash, limit - offset);
      if (horizontal) ctx.fillRect(x + offset, y, segment, height);
      else ctx.fillRect(x, y + offset, width, segment);
    }
  }

  for (let column = 0; column <= columns; column += 1) {
    const line = lineProfileForIndex(column);
    const x = lineStart(column, columns, minorWidth, line.width, canvas.width);
    ctx.globalAlpha = line.alpha;
    if (settings.gridPattern === "dot") {
      for (let row = 0; row <= rows; row += 1) {
        const y = lineStart(row, rows, minorHeight, line.width, canvas.height);
        drawStyledLine(x, y, line.width, line.width);
      }
    } else {
      drawStyledLine(x, 0, line.width, canvas.height);
    }
  }

  if (settings.gridPattern !== "dot") {
    for (let row = 0; row <= rows; row += 1) {
      const line = lineProfileForIndex(row);
      const y = lineStart(row, rows, minorHeight, line.width, canvas.height);
      ctx.globalAlpha = line.alpha;
      drawStyledLine(0, y, canvas.width, line.width);
    }
  }

  ctx.restore();
}

function drawGridNumbers(canvas: CanvasLike, settings: GraphSettings) {
  if (!settings.showNumbers || settings.gridNumberPlacement === "outside") return;
  const context = getProcessingContext(canvas);
  if (!context) throw new Error("Canvas is not available.");
  const ctx = context;

  const dimensions = graphDimensions(settings);
  const labels = createGridNumberLabels(
    dimensions.graphWidth,
    dimensions.graphHeight,
    dimensions.cellWidth,
    dimensions.cellHeight,
  );
  const gridColor = hexToRgb(settings.gridLineColor || DEFAULT_GRID_LINE_COLOR);
  const fontSize = Math.max(8, Math.min(13, Math.round(dimensions.cellWidth * 0.28)));
  ctx.save();
  ctx.font = `600 ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
  ctx.fillStyle = `rgba(${gridColor.r}, ${gridColor.g}, ${gridColor.b}, 0.78)`;

  function drawLabel(label: { value: number; x: number; y: number }) {
    const text = String(label.value);
    ctx.strokeText(text, label.x, label.y);
    ctx.fillText(text, label.x, label.y);
  }

  labels.top.forEach(drawLabel);
  labels.bottom.forEach(drawLabel);
  labels.left.forEach(drawLabel);
  labels.right.forEach(drawLabel);
  ctx.restore();
}

function drawManualGraphArtwork(canvas: CanvasLike, settings: GraphSettings) {
  const context = getProcessingContext(canvas);
  if (!context) throw new Error("Canvas is not available.");
  const cellWidth = GRAPH_MAJOR_CELL_PIXELS;
  const cellHeight = GRAPH_MAJOR_CELL_PIXELS;

  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";

  for (const paint of settings.cellPaints ?? []) {
    if (paint.visible === false) continue;
    const left = paint.x * cellWidth;
    const top = paint.y * cellHeight;
    const width = Math.max(1, paint.width * cellWidth);
    const height = Math.max(1, paint.height * cellHeight);
    const right = width / 2;
    const bottom = height / 2;
    const rotation = normalizeRotationDegrees(paint.rotationDegrees);

    context.save();
    context.translate(left + width / 2, top + height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.scale(paint.flipX ? -1 : 1, paint.flipY ? -1 : 1);

    if (!isTransparentFillColor(paint.fillColor)) {
      context.fillStyle = paint.fillColor;
      context.fillRect(-right, -bottom, width, height);
    }

    if (paint.sides.length) {
      context.beginPath();
      context.strokeStyle = paint.lineColor || settings.outlineColor || settings.lineColor;
      context.lineWidth = Math.max(1, Math.min(24, paint.lineWidth || 3));
      if (paint.sides.includes("top")) {
        context.moveTo(-right, -bottom);
        context.lineTo(right, -bottom);
      }
      if (paint.sides.includes("right")) {
        context.moveTo(right, -bottom);
        context.lineTo(right, bottom);
      }
      if (paint.sides.includes("bottom")) {
        context.moveTo(right, bottom);
        context.lineTo(-right, bottom);
      }
      if (paint.sides.includes("left")) {
        context.moveTo(-right, bottom);
        context.lineTo(-right, -bottom);
      }
      context.stroke();
    }
    context.restore();
  }

  for (const shape of settings.graphShapes ?? []) {
    if (shape.visible === false) continue;
    const x = shape.x * cellWidth;
    const y = shape.y * cellHeight;
    const width = shape.width * cellWidth;
    const height = shape.height * cellHeight;
    const strokeWidth = Math.max(1, Math.min(24, shape.strokeWidth || 3));
    context.strokeStyle = shape.strokeColor || settings.outlineColor || settings.lineColor;
    context.fillStyle = isTransparentFillColor(shape.fillColor) ? "rgba(0,0,0,0)" : shape.fillColor;
    context.lineWidth = strokeWidth;
    context.save();
    context.translate(x + width / 2, y + height / 2);
    context.rotate((normalizeRotationDegrees(shape.rotationDegrees) * Math.PI) / 180);
    context.scale(shape.flipX ? -1 : 1, shape.flipY ? -1 : 1);
    context.translate(-(x + width / 2), -(y + height / 2));
    context.beginPath();

    if (shape.kind === "line" || shape.kind === "arrow") {
      context.moveTo(x, y);
      context.lineTo(x + width, y + height);
      context.stroke();
      if (shape.kind === "arrow") {
        const angle = Math.atan2(height, width);
        const headLength = Math.max(10, strokeWidth * 4);
        context.beginPath();
        context.moveTo(x + width, y + height);
        context.lineTo(x + width - headLength * Math.cos(angle - Math.PI / 6), y + height - headLength * Math.sin(angle - Math.PI / 6));
        context.moveTo(x + width, y + height);
        context.lineTo(x + width - headLength * Math.cos(angle + Math.PI / 6), y + height - headLength * Math.sin(angle + Math.PI / 6));
        context.stroke();
      }
      context.restore();
      continue;
    }

    const left = Math.min(x, x + width);
    const top = Math.min(y, y + height);
    const rectWidth = Math.max(1, Math.abs(width));
    const rectHeight = Math.max(1, Math.abs(height));
    const squareSize = Math.max(rectWidth, rectHeight);
    const drawWidth = shape.kind === "square" || shape.kind === "circle" ? squareSize : rectWidth;
    const drawHeight = shape.kind === "square" || shape.kind === "circle" ? squareSize : rectHeight;
    const centerX = left + drawWidth / 2;
    const centerY = top + drawHeight / 2;

    if (shape.kind === "circle" || shape.kind === "oval") {
      context.ellipse(centerX, centerY, drawWidth / 2, drawHeight / 2, 0, 0, Math.PI * 2);
      if (!isTransparentFillColor(shape.fillColor)) context.fill();
      context.stroke();
    } else if (shape.kind === "half-circle") {
      context.moveTo(left, top + drawHeight);
      context.ellipse(centerX, top + drawHeight, drawWidth / 2, drawHeight, 0, Math.PI, Math.PI * 2);
      context.lineTo(left, top + drawHeight);
      context.closePath();
      if (!isTransparentFillColor(shape.fillColor)) context.fill();
      context.stroke();
    } else {
      context.rect(left, top, drawWidth, drawHeight);
      if (!isTransparentFillColor(shape.fillColor)) context.fill();
      const sides = isTransparentFillColor(shape.fillColor) ? (shape.sides?.length ? shape.sides : CELL_LINE_SIDE_KEYS) : CELL_LINE_SIDE_KEYS;
      if (sides.length) {
        context.beginPath();
        if (sides.includes("top")) {
          context.moveTo(left, top);
          context.lineTo(left + drawWidth, top);
        }
        if (sides.includes("right")) {
          context.moveTo(left + drawWidth, top);
          context.lineTo(left + drawWidth, top + drawHeight);
        }
        if (sides.includes("bottom")) {
          context.moveTo(left + drawWidth, top + drawHeight);
          context.lineTo(left, top + drawHeight);
        }
        if (sides.includes("left")) {
          context.moveTo(left, top + drawHeight);
          context.lineTo(left, top);
        }
        context.stroke();
      }
    }
    context.restore();
  }

  context.restore();
}

function pixelateCanvas(sourceCanvas: CanvasLike, settings: GraphSettings, options: { sourceIsFitted?: boolean } = {}) {
  const fitted = options.sourceIsFitted ? sourceCanvas : fitCanvas(sourceCanvas, settings);
  assertCanvasBudget(fitted.width, fitted.height, 1);
  const fittedContext = getProcessingContext(fitted, { willReadFrequently: true });
  if (!fittedContext) throw new Error("Canvas is not available.");

  const sourceData = fittedContext.getImageData(0, 0, fitted.width, fitted.height);
  const { enclosedFillMask, outlineMask, sourceFillMask } = buildArtworkMasks(sourceData, settings);
  const { fillRegionMap, regions } = labelFillRegions(
    [
      { mask: sourceFillMask, kind: "source" },
      { mask: enclosedFillMask, kind: "enclosed" },
    ],
    fitted.width,
    fitted.height,
    settings,
  );

  const output = createProcessingCanvas(fitted.width, fitted.height);
  const outputContext = getProcessingContext(output, { willReadFrequently: true });
  if (!outputContext) throw new Error("Canvas is not available.");

  outputContext.fillStyle = settings.backgroundColor || "#ffffff";
  outputContext.fillRect(0, 0, output.width, output.height);
  if (settings.gridLineLayer === "back") drawGraphPaperGrid(output, settings);
  drawFillRegions(outputContext, fillRegionMap, regions, output.width, output.height, settings, 0.8);
  const imageLineThickness = lineThicknessForSettings(settings);
  const outlineColor = outlineColorForSettings(settings);
  drawMaskLayer(outputContext, outlineMask, output.width, output.height, outlineColor, 255, 0.12 * imageLineThickness);
  if (settings.gridLineLayer !== "back") drawGraphPaperGrid(output, settings);
  drawManualGraphArtwork(output, settings);
  drawGridNumbers(output, settings);

  const outlineHex = rgbToHex(hexToRgb(outlineColor));
  const outlineCount = outlineMask.reduce((sum, value) => sum + value, 0);
  const fillCountsByColor = new Map<string, number>();
  for (const region of regions) {
    if (isTransparentFillColor(region.color)) continue;
    const hex = rgbToHex(hexToRgb(region.color));
    fillCountsByColor.set(hex, (fillCountsByColor.get(hex) ?? 0) + region.cellCount);
  }

  return {
    canvas: output,
    palette: [
      { name: "Outline", hex: outlineHex, locked: true, cellCount: outlineCount, sortOrder: 0 },
      ...Array.from(fillCountsByColor.entries()).map(([hex, cellCount], index) => ({
        name: index === 0 ? "Fill" : `Fill ${index + 1}`,
        hex,
        locked: true,
        cellCount,
        sortOrder: index + 1,
      })),
    ],
    fillRegions: regions,
    fillRegionMap,
  };
}

export function pixelateImage(sourceCanvas: HTMLCanvasElement, settings: GraphSettings, options: { sourceIsFitted?: boolean } = {}) {
  return pixelateCanvas(sourceCanvas, settings, options) as ProcessedGraph;
}

export function pixelateLayeredCanvases(layers: AnyFittedImageLayer[], settings: GraphSettings) {
  const dimensions = graphDimensions(settings);
  const width = dimensions.outputWidth;
  const height = dimensions.outputHeight;
  assertCanvasBudget(width, height, Math.max(1, layers.length));
  const output = createProcessingCanvas(width, height);
  const outputContext = getProcessingContext(output, { willReadFrequently: true });
  if (!outputContext) throw new Error("Canvas is not available.");

  const fillRegionMap = new Uint16Array(width * height);
  const outlineMask = new Uint8Array(width * height);
  const outlineColorMap = new Uint16Array(width * height);
  const outlineColorNumbers = new Map<string, number>();
  const outlineColorsByNumber = new Map<number, string>();
  const regions: FillRegion[] = [];
  let nextRegionId = 0;
  let maxLineThickness = 0;

  function outlineColorNumber(color: string) {
    const normalized = rgbToHex(hexToRgb(color));
    const existing = outlineColorNumbers.get(normalized);
    if (existing) return existing;
    const next = outlineColorNumbers.size + 1;
    outlineColorNumbers.set(normalized, next);
    outlineColorsByNumber.set(next, normalized);
    return next;
  }

  for (const layer of layers) {
    if (!hasDrawableCanvas(layer.canvas)) continue;
    const fitted =
      layer.canvas.width === width && layer.canvas.height === height
        ? layer.canvas
        : (() => {
            const canvas = createProcessingCanvas(width, height);
            const context = getProcessingContext(canvas, { willReadFrequently: true });
            if (!context) throw new Error("Canvas is not available.");
            context.drawImage(layer.canvas, 0, 0, width, height);
            return canvas;
          })();
    const fittedContext = getProcessingContext(fitted, { willReadFrequently: true });
    if (!fittedContext) throw new Error("Canvas is not available.");

    const sourceData = fittedContext.getImageData(0, 0, width, height);
    const { enclosedFillMask, outlineMask: layerOutlineMask, sourceFillMask } = buildArtworkMasks(sourceData, layer.settings);
    const layerOutlineColorNumber = outlineColorNumber(outlineColorForSettings(layer.settings, settings));
    const local = labelFillRegions(
      [
        { mask: sourceFillMask, kind: "source" },
        { mask: enclosedFillMask, kind: "enclosed" },
      ],
      width,
      height,
      settings,
    );

    const regionNumberMap = new Map<number, number>();
    for (const region of local.regions) {
      if (nextRegionId >= 65535) break;
      nextRegionId += 1;
      const globalId = String(nextRegionId);
      regionNumberMap.set(Number(region.id), nextRegionId);
      regions.push({
        ...region,
        id: globalId,
        color: fillColorForRegion(layer.settings, region.id, region.kind),
      });
    }

    mergeLayerPixelMasks(fillRegionMap, outlineMask, local.fillRegionMap, layerOutlineMask, regionNumberMap, outlineColorMap, layerOutlineColorNumber);
    maxLineThickness = Math.max(maxLineThickness, lineThicknessForSettings(layer.settings));
  }

  const visibleCounts = new Map<string, number>();
  for (let pixel = 0; pixel < fillRegionMap.length; pixel += 1) {
    const regionNumber = fillRegionMap[pixel];
    if (regionNumber) visibleCounts.set(String(regionNumber), (visibleCounts.get(String(regionNumber)) ?? 0) + 1);
  }
  const visibleRegions = regions
    .map((region) => ({
      ...region,
      cellCount: visibleCounts.get(region.id) ?? 0,
      color: colorForRegion(settings, region),
    }))
    .filter((region) => region.cellCount > 0);

  outputContext.fillStyle = settings.backgroundColor || "#ffffff";
  outputContext.fillRect(0, 0, output.width, output.height);
  if (settings.gridLineLayer === "back") drawGraphPaperGrid(output, settings);
  drawFillRegions(outputContext, fillRegionMap, visibleRegions, output.width, output.height, settings, 0.8);
  drawColoredMaskLayers(outputContext, outlineMask, outlineColorMap, outlineColorsByNumber, output.width, output.height, outlineColorForSettings(settings), 255, 0.12 * maxLineThickness);
  if (settings.gridLineLayer !== "back") drawGraphPaperGrid(output, settings);
  drawManualGraphArtwork(output, settings);
  drawGridNumbers(output, settings);

  const outlineCountsByColor = new Map<string, number>();
  for (let pixel = 0; pixel < outlineMask.length; pixel += 1) {
    const value = outlineMask[pixel];
    if (!value) continue;
    const color = outlineColorsByNumber.get(outlineColorMap[pixel]) ?? rgbToHex(hexToRgb(outlineColorForSettings(settings)));
    outlineCountsByColor.set(color, (outlineCountsByColor.get(color) ?? 0) + value);
  }
  if (!outlineCountsByColor.size) {
    outlineCountsByColor.set(rgbToHex(hexToRgb(outlineColorForSettings(settings))), 0);
  }
  const fillCountsByColor = new Map<string, number>();
  const visibleRegionById = new Map(visibleRegions.map((region) => [region.id, region] as const));
  for (const [regionId, cellCount] of visibleCounts) {
    const region = visibleRegionById.get(regionId);
    if (!region) continue;
    const color = colorForRegion(settings, region);
    if (isTransparentFillColor(color)) continue;
    const hex = rgbToHex(hexToRgb(color));
    fillCountsByColor.set(hex, (fillCountsByColor.get(hex) ?? 0) + cellCount);
  }

  return {
    canvas: output,
    palette: [
      ...Array.from(outlineCountsByColor.entries()).map(([hex, cellCount], index) => ({
        name: index === 0 ? "Outline" : `Outline ${index + 1}`,
        hex,
        locked: true,
        cellCount,
        sortOrder: index,
      })),
      ...Array.from(fillCountsByColor.entries()).map(([hex, cellCount], index) => ({
        name: index === 0 ? "Fill" : `Fill ${index + 1}`,
        hex,
        locked: true,
        cellCount,
        sortOrder: outlineCountsByColor.size + index,
      })),
    ],
    fillRegions: visibleRegions,
    fillRegionMap,
  };
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const error = new Error("Image processing was cancelled.");
  error.name = "AbortError";
  throw error;
}

export async function pixelateLayeredCanvasesAsync(
  layers: AnyFittedImageLayer[],
  settings: GraphSettings,
  options: { signal?: AbortSignal } = {},
) {
  const dimensions = graphDimensions(settings);
  const width = dimensions.outputWidth;
  const height = dimensions.outputHeight;
  assertCanvasBudget(width, height, Math.max(1, layers.length));
  const output = createProcessingCanvas(width, height);
  const outputContext = getProcessingContext(output, { willReadFrequently: true });
  if (!outputContext) throw new Error("Canvas is not available.");

  const fillRegionMap = new Uint16Array(width * height);
  const outlineMask = new Uint8Array(width * height);
  const outlineCoverage = new Uint8Array(width * height);
  const outlineColorMap = new Uint16Array(width * height);
  const outlineColorNumbers = new Map<string, number>();
  const outlineColorsByNumber = new Map<number, string>();
  const regions: FillRegion[] = [];
  let nextRegionId = 0;
  let maxLineThickness = 0;

  function outlineColorNumber(color: string) {
    const normalized = rgbToHex(hexToRgb(color));
    const existing = outlineColorNumbers.get(normalized);
    if (existing) return existing;
    const next = outlineColorNumbers.size + 1;
    outlineColorNumbers.set(normalized, next);
    outlineColorsByNumber.set(next, normalized);
    return next;
  }

  for (const layer of layers) {
    throwIfAborted(options.signal);
    if (!hasDrawableCanvas(layer.canvas)) continue;
    let sourceData: ImageDataLike | null = null;
    if (!layer.vectorizerSource) {
      const fitted =
        layer.canvas.width === width && layer.canvas.height === height
          ? layer.canvas
          : (() => {
              const canvas = createProcessingCanvas(width, height);
              const context = getProcessingContext(canvas, { willReadFrequently: true });
              if (!context) throw new Error("Canvas is not available.");
              context.drawImage(layer.canvas, 0, 0, width, height);
              return canvas;
            })();
      const fittedContext = getProcessingContext(fitted, { willReadFrequently: true });
      if (!fittedContext) throw new Error("Canvas is not available.");
      sourceData = fittedContext.getImageData(0, 0, width, height);
    }
    const {
      enclosedFillMask,
      outlineMask: layerOutlineMask,
      outlineCoverage: layerOutlineCoverage,
      sourceFillMask,
    } = await buildLayerArtworkMasksAsync(
      layer,
      sourceData,
      width,
      height,
      options.signal,
    );
    throwIfAborted(options.signal);
    const layerOutlineColorNumber = outlineColorNumber(outlineColorForSettings(layer.settings, settings));
    const local = labelFillRegions(
      [
        { mask: sourceFillMask, kind: "source" },
        { mask: enclosedFillMask, kind: "enclosed" },
      ],
      width,
      height,
      settings,
    );

    const regionNumberMap = new Map<number, number>();
    for (const region of local.regions) {
      if (nextRegionId >= 65535) break;
      nextRegionId += 1;
      const globalId = String(nextRegionId);
      regionNumberMap.set(Number(region.id), nextRegionId);
      regions.push({
        ...region,
        id: globalId,
        color: fillColorForRegion(layer.settings, region.id, region.kind),
      });
    }

    mergeLayerPixelMasks(
      fillRegionMap,
      outlineMask,
      local.fillRegionMap,
      layerOutlineMask,
      regionNumberMap,
      outlineColorMap,
      layerOutlineColorNumber,
      outlineCoverage,
      layerOutlineCoverage ?? undefined,
    );
    maxLineThickness = Math.max(maxLineThickness, lineThicknessForSettings(layer.settings));
  }

  const visibleCounts = new Map<string, number>();
  for (let pixel = 0; pixel < fillRegionMap.length; pixel += 1) {
    const regionNumber = fillRegionMap[pixel];
    if (regionNumber) visibleCounts.set(String(regionNumber), (visibleCounts.get(String(regionNumber)) ?? 0) + 1);
  }
  const visibleRegions = regions
    .map((region) => ({
      ...region,
      cellCount: visibleCounts.get(region.id) ?? 0,
      color: colorForRegion(settings, region),
    }))
    .filter((region) => region.cellCount > 0);

  outputContext.fillStyle = settings.backgroundColor || "#ffffff";
  outputContext.fillRect(0, 0, output.width, output.height);
  if (settings.gridLineLayer === "back") drawGraphPaperGrid(output, settings);
  drawFillRegions(outputContext, fillRegionMap, visibleRegions, output.width, output.height, settings, 0.8);
  drawColoredMaskLayers(
    outputContext,
    outlineMask,
    outlineColorMap,
    outlineColorsByNumber,
    output.width,
    output.height,
    outlineColorForSettings(settings),
    255,
    0.12 * maxLineThickness,
    outlineCoverage,
  );
  if (settings.gridLineLayer !== "back") drawGraphPaperGrid(output, settings);
  drawManualGraphArtwork(output, settings);
  drawGridNumbers(output, settings);

  const outlineCountsByColor = new Map<string, number>();
  for (let pixel = 0; pixel < outlineMask.length; pixel += 1) {
    const value = outlineMask[pixel];
    if (!value) continue;
    const color = outlineColorsByNumber.get(outlineColorMap[pixel]) ?? rgbToHex(hexToRgb(outlineColorForSettings(settings)));
    outlineCountsByColor.set(color, (outlineCountsByColor.get(color) ?? 0) + value);
  }
  if (!outlineCountsByColor.size) {
    outlineCountsByColor.set(rgbToHex(hexToRgb(outlineColorForSettings(settings))), 0);
  }
  const fillCountsByColor = new Map<string, number>();
  const visibleRegionById = new Map(visibleRegions.map((region) => [region.id, region] as const));
  for (const [regionId, cellCount] of visibleCounts) {
    const region = visibleRegionById.get(regionId);
    if (!region) continue;
    const color = colorForRegion(settings, region);
    if (isTransparentFillColor(color)) continue;
    const hex = rgbToHex(hexToRgb(color));
    fillCountsByColor.set(hex, (fillCountsByColor.get(hex) ?? 0) + cellCount);
  }

  return {
    canvas: output,
    palette: [
      ...Array.from(outlineCountsByColor.entries()).map(([hex, cellCount], index) => ({
        name: index === 0 ? "Outline" : `Outline ${index + 1}`,
        hex,
        locked: true,
        cellCount,
        sortOrder: index,
      })),
      ...Array.from(fillCountsByColor.entries()).map(([hex, cellCount], index) => ({
        name: index === 0 ? "Fill" : `Fill ${index + 1}`,
        hex,
        locked: true,
        cellCount,
        sortOrder: outlineCountsByColor.size + index,
      })),
    ],
    fillRegions: visibleRegions,
    fillRegionMap,
  };
}

export function pixelateLayeredImages(layers: FittedImageLayer[], settings: GraphSettings) {
  return pixelateLayeredCanvases(layers, settings) as ProcessedGraph;
}

export async function pixelateLayeredImagesAsync(
  layers: FittedImageLayer[],
  settings: GraphSettings,
  options: { signal?: AbortSignal } = {},
) {
  return (await pixelateLayeredCanvasesAsync(layers, settings, options)) as ProcessedGraph;
}

export function generateGridOverlay(canvas: HTMLCanvasElement, settings: GraphSettings) {
  drawGraphPaperGrid(canvas, settings);
}

export async function pixelateImageWithWorker(
  sourceCanvas: HTMLCanvasElement,
  settings: GraphSettings,
  _palette: PaletteColor[],
  options: { sourceIsFitted?: boolean } = {},
) {
  return pixelateImage(sourceCanvas, settings, options);
}
