import { hexToRgb, rgbToHex } from "@/lib/canvas/color";
import { maskFromImageData } from "@/lib/canvas/ink-mask";
import { isPdfSource, renderPdfFirstPageToCanvas } from "@/lib/canvas/pdf";
import { createThinArtworkMasks, expandMaskForLineSize } from "@/lib/canvas/thinning";
import {
  DEFAULT_GRID_LINE_COLOR,
  GRAPH_MAJOR_CELL_PIXELS,
  GRAPH_SUBDIVISIONS,
  clampImageLineThickness,
  isFillColor,
  isTransparentFillColor,
} from "@/lib/graph-paper";
import type { GraphSettings, PaletteColor } from "@/lib/types";

export type ProcessedGraph = {
  canvas: HTMLCanvasElement;
  palette: PaletteColor[];
  fillRegions: FillRegion[];
  fillRegionMap: Uint16Array;
};

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

export type FittedImageLayer = {
  canvas: HTMLCanvasElement;
  settings: GraphSettings;
};

type FillMaskLayer = {
  mask: Uint8Array;
  kind: FillRegionKind;
};

const contentBoundsCache = new WeakMap<HTMLCanvasElement, ContentBounds>();

function graphDimensions(settings: GraphSettings) {
  const graphWidth = Math.max(1, Math.round(settings.graphWidth || 1));
  const graphHeight = Math.max(1, Math.round(settings.graphHeight || 1));
  const cellWidth = GRAPH_MAJOR_CELL_PIXELS;
  const cellHeight = GRAPH_MAJOR_CELL_PIXELS;
  const imageAreaWidth = graphWidth * cellWidth;
  const imageAreaHeight = graphHeight * cellHeight;
  const imageWidth = Math.max(1, Math.min(imageAreaWidth, Math.round(Number(settings.imageWidth || graphWidth) * cellWidth)));
  const imageHeight = Math.max(1, Math.min(imageAreaHeight, Math.round(Number(settings.imageHeight || graphHeight) * cellHeight)));
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
  if (isPdfSource(fileOrUrl, fileName)) {
    return (await renderPdfFirstPageToCanvas(fileOrUrl)).canvas;
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
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is not available.");
    context.drawImage(image, 0, 0);
    return canvas;
  } finally {
    if (typeof fileOrUrl !== "string") URL.revokeObjectURL(url);
  }
}

export function resizeImage(canvas: HTMLCanvasElement, maxWidth: number, maxHeight: number) {
  const ratio = Math.min(1, maxWidth / canvas.width, maxHeight / canvas.height);
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

function fitCanvas(canvas: HTMLCanvasElement, settings: GraphSettings) {
  const dimensions = graphDimensions(settings);
  const width = dimensions.outputWidth;
  const height = dimensions.outputHeight;
  const contentBounds = findContentBounds(canvas);
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d", { willReadFrequently: true });
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

export function findContentBounds(canvas: HTMLCanvasElement): ContentBounds {
  const cached = contentBoundsCache.get(canvas);
  if (cached) return cached;

  const context = canvas.getContext("2d", { willReadFrequently: true });
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

function buildArtworkMasks(imageData: ImageData, settings: GraphSettings) {
  const width = imageData.width;
  const height = imageData.height;
  const { mask: inkMask } = maskFromImageData(imageData);
  const masks = createThinArtworkMasks(inkMask, width, height, {
    sourceFillThreshold: settings.sourceFillThreshold,
    sourceFillMinStrokePixels: settings.sourceFillMinStrokePixels,
    strokeGapClosePixels: settings.strokeGapClosePixels,
  });
  const imageLineThickness = clampImageLineThickness(settings.imageLineThickness);
  const outlineMask = expandMaskForLineSize(masks.outlineMask, width, height, imageLineThickness);

  return {
    enclosedFillMask: masks.enclosedFillMask,
    fillMask: masks.fillMask,
    outlineMask,
    sourceFillMask: masks.sourceFillMask,
  };
}

function defaultFillColorForRegion(settings: GraphSettings, kind: FillRegionKind) {
  return kind === "source" ? settings.outlineColor || settings.lineColor : settings.fillColor;
}

function fillColorForRegion(settings: GraphSettings, regionId: string, kind: FillRegionKind) {
  const customColor = settings.fillRegions?.[regionId];
  return customColor && isFillColor(customColor) ? customColor : defaultFillColorForRegion(settings, kind);
}

function labelFillRegions(fillLayers: FillMaskLayer[], width: number, height: number, settings: GraphSettings) {
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

  return { fillRegionMap, regions };
}

function createMaskLayer(
  mask: Uint8Array,
  width: number,
  height: number,
  color: string,
  alpha = 255,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is not available.");

  const rgb = hexToRgb(color);
  const imageData = context.createImageData(width, height);
  const data = imageData.data;
  for (let pixel = 0, index = 0; pixel < mask.length; pixel += 1, index += 4) {
    if (!mask[pixel]) continue;
    data[index] = rgb.r;
    data[index + 1] = rgb.g;
    data[index + 2] = rgb.b;
    data[index + 3] = alpha;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function drawFillRegions(
  context: CanvasRenderingContext2D,
  fillRegionMap: Uint16Array,
  regions: FillRegion[],
  width: number,
  height: number,
  settings: GraphSettings,
  blurRadius: number,
) {
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const layerContext = layer.getContext("2d", { willReadFrequently: true });
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
    const hex = fillColorForRegion(settings, region.id, region.kind);
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

  const softened = document.createElement("canvas");
  softened.width = width;
  softened.height = height;
  const softenedContext = softened.getContext("2d");
  if (!softenedContext) throw new Error("Canvas is not available.");
  softenedContext.filter = `blur(${blurRadius}px)`;
  softenedContext.drawImage(layer, 0, 0);
  context.drawImage(softened, 0, 0);
}

function drawMaskLayer(
  context: CanvasRenderingContext2D,
  mask: Uint8Array,
  width: number,
  height: number,
  color: string,
  alpha: number,
  blurRadius: number,
) {
  const layer = createMaskLayer(mask, width, height, color, alpha);
  if (blurRadius <= 0) {
    context.drawImage(layer, 0, 0);
    return;
  }

  const softened = document.createElement("canvas");
  softened.width = width;
  softened.height = height;
  const softenedContext = softened.getContext("2d");
  if (!softenedContext) throw new Error("Canvas is not available.");
  softenedContext.filter = `blur(${blurRadius}px)`;
  softenedContext.drawImage(layer, 0, 0);
  context.drawImage(softened, 0, 0);
}

function drawGraphPaperGrid(canvas: HTMLCanvasElement, settings: GraphSettings) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  const dimensions = graphDimensions(settings);
  const minorWidth = dimensions.minorWidth;
  const minorHeight = dimensions.minorHeight;
  const columns = Math.max(1, Math.round(dimensions.outputWidth / minorWidth));
  const rows = Math.max(1, Math.round(dimensions.outputHeight / minorHeight));
  const minorLineWidth = 1;
  const midLineWidth = 1;
  const majorLineWidth = 2;
  const gridColor = hexToRgb(settings.gridLineColor || DEFAULT_GRID_LINE_COLOR);

  context.save();
  context.fillStyle = `rgb(${gridColor.r}, ${gridColor.g}, ${gridColor.b})`;

  function lineProfileForIndex(index: number) {
    if (index % GRAPH_SUBDIVISIONS === 0) return { width: majorLineWidth, alpha: 0.72 };
    if (index % 5 === 0) return { width: midLineWidth, alpha: 0.52 };
    return { width: minorLineWidth, alpha: 0.34 };
  }

  function lineStart(index: number, count: number, spacing: number, lineWidth: number, limit: number) {
    if (index === 0) return 0;
    if (index === count) return Math.max(0, limit - lineWidth);
    return Math.round(index * spacing - lineWidth / 2);
  }

  for (let column = 0; column <= columns; column += 1) {
    const line = lineProfileForIndex(column);
    const x = lineStart(column, columns, minorWidth, line.width, canvas.width);
    context.globalAlpha = line.alpha;
    context.fillRect(x, 0, line.width, canvas.height);
  }

  for (let row = 0; row <= rows; row += 1) {
    const line = lineProfileForIndex(row);
    const y = lineStart(row, rows, minorHeight, line.width, canvas.height);
    context.globalAlpha = line.alpha;
    context.fillRect(0, y, canvas.width, line.width);
  }

  context.restore();
}

export function pixelateImage(sourceCanvas: HTMLCanvasElement, settings: GraphSettings, options: { sourceIsFitted?: boolean } = {}) {
  const fitted = options.sourceIsFitted ? sourceCanvas : fitCanvas(sourceCanvas, settings);
  const fittedContext = fitted.getContext("2d", { willReadFrequently: true });
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

  const output = document.createElement("canvas");
  output.width = fitted.width;
  output.height = fitted.height;
  const outputContext = output.getContext("2d", { willReadFrequently: true });
  if (!outputContext) throw new Error("Canvas is not available.");

  outputContext.fillStyle = settings.backgroundColor || "#ffffff";
  outputContext.fillRect(0, 0, output.width, output.height);
  if (settings.gridLineLayer === "back") drawGraphPaperGrid(output, settings);
  drawFillRegions(outputContext, fillRegionMap, regions, output.width, output.height, settings, 0.8);
  if (settings.gridLineLayer !== "back") drawGraphPaperGrid(output, settings);
  const imageLineThickness = clampImageLineThickness(settings.imageLineThickness);
  drawMaskLayer(outputContext, outlineMask, output.width, output.height, settings.outlineColor || settings.lineColor, 255, 0.12 * imageLineThickness);

  const outlineHex = rgbToHex(hexToRgb(settings.outlineColor || settings.lineColor));
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

export function pixelateLayeredImages(layers: FittedImageLayer[], settings: GraphSettings) {
  const dimensions = graphDimensions(settings);
  const width = dimensions.outputWidth;
  const height = dimensions.outputHeight;
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const outputContext = output.getContext("2d", { willReadFrequently: true });
  if (!outputContext) throw new Error("Canvas is not available.");

  const fillRegionMap = new Uint16Array(width * height);
  const outlineMask = new Uint8Array(width * height);
  const regions: FillRegion[] = [];
  let nextRegionId = 0;
  let maxLineThickness = 0;

  for (const layer of layers) {
    const fitted =
      layer.canvas.width === width && layer.canvas.height === height
        ? layer.canvas
        : (() => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (!context) throw new Error("Canvas is not available.");
            context.drawImage(layer.canvas, 0, 0, width, height);
            return canvas;
          })();
    const fittedContext = fitted.getContext("2d", { willReadFrequently: true });
    if (!fittedContext) throw new Error("Canvas is not available.");

    const sourceData = fittedContext.getImageData(0, 0, width, height);
    const { enclosedFillMask, outlineMask: layerOutlineMask, sourceFillMask } = buildArtworkMasks(sourceData, layer.settings);
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
        color: fillColorForRegion(settings, globalId, region.kind),
      });
    }

    for (let pixel = 0; pixel < local.fillRegionMap.length; pixel += 1) {
      const localRegionNumber = local.fillRegionMap[pixel];
      if (!localRegionNumber) continue;
      const globalRegionNumber = regionNumberMap.get(localRegionNumber);
      if (globalRegionNumber) fillRegionMap[pixel] = globalRegionNumber;
    }

    for (let pixel = 0; pixel < layerOutlineMask.length; pixel += 1) {
      if (layerOutlineMask[pixel]) outlineMask[pixel] = 1;
    }
    maxLineThickness = Math.max(maxLineThickness, clampImageLineThickness(layer.settings.imageLineThickness));
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
      color: fillColorForRegion(settings, region.id, region.kind),
    }))
    .filter((region) => region.cellCount > 0);

  outputContext.fillStyle = settings.backgroundColor || "#ffffff";
  outputContext.fillRect(0, 0, output.width, output.height);
  if (settings.gridLineLayer === "back") drawGraphPaperGrid(output, settings);
  drawFillRegions(outputContext, fillRegionMap, visibleRegions, output.width, output.height, settings, 0.8);
  if (settings.gridLineLayer !== "back") drawGraphPaperGrid(output, settings);
  drawMaskLayer(outputContext, outlineMask, output.width, output.height, settings.outlineColor || settings.lineColor, 255, 0.12 * maxLineThickness);

  const outlineHex = rgbToHex(hexToRgb(settings.outlineColor || settings.lineColor));
  const outlineCount = outlineMask.reduce((sum, value) => sum + value, 0);
  const fillCountsByColor = new Map<string, number>();
  const visibleRegionById = new Map(visibleRegions.map((region) => [region.id, region] as const));
  for (const [regionId, cellCount] of visibleCounts) {
    const region = visibleRegionById.get(regionId);
    if (!region) continue;
    const color = fillColorForRegion(settings, region.id, region.kind);
    if (isTransparentFillColor(color)) continue;
    const hex = rgbToHex(hexToRgb(color));
    fillCountsByColor.set(hex, (fillCountsByColor.get(hex) ?? 0) + cellCount);
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
    fillRegions: visibleRegions,
    fillRegionMap,
  };
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

export async function pixelateLayeredImagesWithWorker(layers: FittedImageLayer[], settings: GraphSettings) {
  return pixelateLayeredImages(layers, settings);
}
