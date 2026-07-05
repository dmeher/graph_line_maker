import { hexToRgb, rgbToHex } from "@/lib/canvas/color";
import { maskFromImageData } from "@/lib/canvas/ink-mask";
import { isPdfSource, renderPdfFirstPageToCanvas } from "@/lib/canvas/pdf";
import {
  DEFAULT_GRID_LINE_COLOR,
  GRAPH_MAJOR_CELL_PIXELS,
  GRAPH_SUBDIVISIONS,
  MAX_IMAGE_PADDING_PIXELS,
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
};

type ContentBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const contentBoundsCache = new WeakMap<HTMLCanvasElement, ContentBounds>();

function graphDimensions(settings: GraphSettings) {
  const graphWidth = Math.max(1, Math.round(settings.graphWidth || 1));
  const graphHeight = Math.max(1, Math.round(settings.graphHeight || 1));
  const cellWidth = GRAPH_MAJOR_CELL_PIXELS;
  const cellHeight = GRAPH_MAJOR_CELL_PIXELS;
  const imageAreaWidth = graphWidth * cellWidth;
  const imageAreaHeight = graphHeight * cellHeight;
  const maxPadding = Math.max(0, Math.min(MAX_IMAGE_PADDING_PIXELS, Math.floor((6000 - imageAreaWidth) / 2), Math.floor((6000 - imageAreaHeight) / 2)));
  const imagePadding = Math.max(0, Math.min(maxPadding, Math.round(settings.imagePadding ?? 0)));
  const outputWidth = imageAreaWidth + imagePadding * 2;
  const outputHeight = imageAreaHeight + imagePadding * 2;

  return {
    cellWidth,
    cellHeight,
    graphWidth,
    graphHeight,
    imagePadding,
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

  const padding = dimensions.imagePadding;
  const innerWidth = dimensions.imageAreaWidth;
  const innerHeight = dimensions.imageAreaHeight;
  const ratio = Math.min(innerWidth / contentBounds.width, innerHeight / contentBounds.height);
  const drawWidth = Math.max(1, Math.round(contentBounds.width * ratio));
  const drawHeight = Math.max(1, Math.round(contentBounds.height * ratio));
  const x = padding + Math.round((innerWidth - drawWidth) / 2) + Math.round(settings.imageOffsetX ?? 0);
  const y = padding + Math.round((innerHeight - drawHeight) / 2) + Math.round(settings.imageOffsetY ?? 0);
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

function findContentBounds(canvas: HTMLCanvasElement): ContentBounds {
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

function findOutside(edgeMask: Uint8Array, width: number, height: number) {
  const outside = new Uint8Array(edgeMask.length);
  const queue = new Int32Array(edgeMask.length);
  let head = 0;
  let tail = 0;

  function enqueue(index: number) {
    if (edgeMask[index] || outside[index]) return;
    outside[index] = 1;
    queue[tail] = index;
    tail += 1;
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y < height - 1) enqueue(index + width);
  }

  return outside;
}

function boundaryMask(mask: Uint8Array, width: number, height: number) {
  const boundary = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      if (
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        !mask[index - 1] ||
        !mask[index + 1] ||
        !mask[index - width] ||
        !mask[index + width]
      ) {
        boundary[index] = 1;
      }
    }
  }
  return boundary;
}

function maskContentBounds(mask: Uint8Array, width: number, height: number): ContentBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function strokeRunComplexity(mask: Uint8Array, width: number, bounds: ContentBounds) {
  const useColumns = bounds.width >= bounds.height;
  const majorStart = useColumns ? bounds.x : bounds.y;
  const majorEnd = majorStart + (useColumns ? bounds.width : bounds.height);
  const minorStart = useColumns ? bounds.y : bounds.x;
  const minorEnd = minorStart + (useColumns ? bounds.height : bounds.width);
  let slicesWithInk = 0;
  let multiRunSlices = 0;

  for (let major = majorStart; major < majorEnd; major += 1) {
    let runs = 0;
    let inRun = false;

    for (let minor = minorStart; minor < minorEnd; minor += 1) {
      const x = useColumns ? major : minor;
      const y = useColumns ? minor : major;
      if (mask[y * width + x]) {
        if (!inRun) {
          runs += 1;
          inRun = true;
        }
      } else {
        inRun = false;
      }
    }

    if (runs > 0) {
      slicesWithInk += 1;
      if (runs > 1) multiRunSlices += 1;
    }
  }

  return slicesWithInk ? multiRunSlices / slicesWithInk : 1;
}

function centerStrokeMask(mask: Uint8Array, width: number, bounds: ContentBounds) {
  const output = new Uint8Array(mask.length);
  const useColumns = bounds.width >= bounds.height;
  const majorStart = useColumns ? bounds.x : bounds.y;
  const majorEnd = majorStart + (useColumns ? bounds.width : bounds.height);
  const minorStart = useColumns ? bounds.y : bounds.x;
  const minorEnd = minorStart + (useColumns ? bounds.height : bounds.width);

  for (let major = majorStart; major < majorEnd; major += 1) {
    let first = -1;
    let last = -1;

    for (let minor = minorStart; minor < minorEnd; minor += 1) {
      const x = useColumns ? major : minor;
      const y = useColumns ? minor : major;
      if (!mask[y * width + x]) continue;
      if (first === -1) first = minor;
      last = minor;
    }

    if (first === -1) continue;
    const center = Math.round((first + last) / 2);
    const x = useColumns ? major : center;
    const y = useColumns ? center : major;
    output[y * width + x] = 1;
  }

  return output;
}

function shouldUseSingleStrokePath(bounds: ContentBounds, boundsCoverage: number, runComplexity: number) {
  const aspectRatio = Math.max(bounds.width, bounds.height) / Math.max(1, Math.min(bounds.width, bounds.height));
  return runComplexity <= 0.08 && (aspectRatio >= 1.7 || boundsCoverage <= 0.35);
}

function lineArtOutlineMask(mask: Uint8Array, width: number, height: number, inkCount: number) {
  const bounds = maskContentBounds(mask, width, height);
  if (!bounds) return mask;

  const boundsArea = bounds.width * bounds.height;
  const boundsCoverage = inkCount / Math.max(1, boundsArea);
  const runComplexity = strokeRunComplexity(mask, width, bounds);

  if (shouldUseSingleStrokePath(bounds, boundsCoverage, runComplexity)) return centerStrokeMask(mask, width, bounds);

  return mask;
}

function shouldPreserveInkAsLineArt(mask: Uint8Array, width: number, height: number, inkCount: number, coverage: number) {
  const bounds = maskContentBounds(mask, width, height);
  if (!bounds) return true;

  const boundsArea = bounds.width * bounds.height;
  const boundsCoverage = inkCount / Math.max(1, boundsArea);
  const aspectRatio = Math.max(bounds.width, bounds.height) / Math.max(1, Math.min(bounds.width, bounds.height));
  const runComplexity = strokeRunComplexity(mask, width, bounds);

  return (
    coverage <= 0.2 ||
    boundsCoverage <= 0.35 ||
    aspectRatio >= 3 ||
    shouldUseSingleStrokePath(bounds, boundsCoverage, runComplexity)
  );
}

function dilateMask(mask: Uint8Array, width: number, height: number, radius: number) {
  if (radius <= 0) return mask;

  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;

      const minX = Math.max(0, x - radius);
      const maxX = Math.min(width - 1, x + radius);
      const minY = Math.max(0, y - radius);
      const maxY = Math.min(height - 1, y + radius);
      for (let yy = minY; yy <= maxY; yy += 1) {
        for (let xx = minX; xx <= maxX; xx += 1) {
          output[yy * width + xx] = 1;
        }
      }
    }
  }

  return output;
}

function buildArtworkMasks(imageData: ImageData, settings: GraphSettings) {
  const width = imageData.width;
  const height = imageData.height;
  const { mask: inkMask, count: inkCount } = maskFromImageData(imageData);
  const coverage = inkCount / Math.max(1, inkMask.length);
  const fillMask = new Uint8Array(inkMask.length);
  let outlineMask: Uint8Array;

  if (coverage > 0.12 && !shouldPreserveInkAsLineArt(inkMask, width, height, inkCount, coverage)) {
    const boundary = boundaryMask(inkMask, width, height);
    outlineMask = boundary;
    for (let index = 0; index < inkMask.length; index += 1) {
      fillMask[index] = inkMask[index] && !boundary[index] ? 1 : 0;
    }
  } else {
    const outside = findOutside(inkMask, width, height);
    for (let index = 0; index < inkMask.length; index += 1) {
      fillMask[index] = !inkMask[index] && !outside[index] ? 1 : 0;
    }
    outlineMask = lineArtOutlineMask(inkMask, width, height, inkCount);
  }

  const dimensions = graphDimensions(settings);
  const imageLineThickness = clampImageLineThickness(settings.imageLineThickness);
  const outlineRadius = Math.max(0, Math.round(Math.min(dimensions.minorWidth, dimensions.minorHeight) * 0.045 * imageLineThickness));
  outlineMask = dilateMask(outlineMask, width, height, outlineRadius);

  return { fillMask, outlineMask };
}

function fillColorForRegion(settings: GraphSettings, regionId: string) {
  const customColor = settings.fillRegions?.[regionId];
  return customColor && isFillColor(customColor) ? customColor : settings.fillColor;
}

function labelFillRegions(fillMask: Uint8Array, width: number, height: number, settings: GraphSettings) {
  const fillRegionMap = new Uint16Array(fillMask.length);
  const queue = new Int32Array(fillMask.length);
  const regions: FillRegion[] = [];
  let nextRegionId = 0;

  for (let start = 0; start < fillMask.length; start += 1) {
    if (!fillMask[start] || fillRegionMap[start] || nextRegionId >= 65535) continue;

    nextRegionId += 1;
    let head = 0;
    let tail = 0;
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    const regionId = String(nextRegionId);

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

      if (x > 0) {
        const next = index - 1;
        if (fillMask[next] && !fillRegionMap[next]) {
          fillRegionMap[next] = nextRegionId;
          queue[tail] = next;
          tail += 1;
        }
      }
      if (x < width - 1) {
        const next = index + 1;
        if (fillMask[next] && !fillRegionMap[next]) {
          fillRegionMap[next] = nextRegionId;
          queue[tail] = next;
          tail += 1;
        }
      }
      if (y > 0) {
        const next = index - width;
        if (fillMask[next] && !fillRegionMap[next]) {
          fillRegionMap[next] = nextRegionId;
          queue[tail] = next;
          tail += 1;
        }
      }
      if (y < height - 1) {
        const next = index + width;
        if (fillMask[next] && !fillRegionMap[next]) {
          fillRegionMap[next] = nextRegionId;
          queue[tail] = next;
          tail += 1;
        }
      }
    }

    regions.push({
      id: regionId,
      color: fillColorForRegion(settings, regionId),
      cellCount: count,
      centerX: count ? Math.round(sumX / count) : 0,
      centerY: count ? Math.round(sumY / count) : 0,
    });
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
  const imageData = layerContext.createImageData(width, height);
  const data = imageData.data;

  for (let pixel = 0, index = 0; pixel < fillRegionMap.length; pixel += 1, index += 4) {
    const regionNumber = fillRegionMap[pixel];
    if (!regionNumber) continue;

    const regionId = String(regionNumber);
    const hex = fillColorForRegion(settings, regionId);
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
  const midLineWidth = 2;
  const majorLineWidth = 4;

  context.save();
  context.fillStyle = settings.gridLineColor || DEFAULT_GRID_LINE_COLOR;

  function lineWidthForIndex(index: number) {
    if (index % GRAPH_SUBDIVISIONS === 0) return majorLineWidth;
    if (index % 5 === 0) return midLineWidth;
    return minorLineWidth;
  }

  function lineStart(index: number, count: number, spacing: number, lineWidth: number, limit: number) {
    if (index === 0) return 0;
    if (index === count) return Math.max(0, limit - lineWidth);
    return Math.round(index * spacing - lineWidth / 2);
  }

  for (let column = 0; column <= columns; column += 1) {
    const lineWidth = lineWidthForIndex(column);
    const x = lineStart(column, columns, minorWidth, lineWidth, canvas.width);
    context.fillRect(x, 0, lineWidth, canvas.height);
  }

  for (let row = 0; row <= rows; row += 1) {
    const lineWidth = lineWidthForIndex(row);
    const y = lineStart(row, rows, minorHeight, lineWidth, canvas.height);
    context.fillRect(0, y, canvas.width, lineWidth);
  }

  context.restore();
}

export function pixelateImage(sourceCanvas: HTMLCanvasElement, settings: GraphSettings) {
  const fitted = fitCanvas(sourceCanvas, settings);
  const fittedContext = fitted.getContext("2d", { willReadFrequently: true });
  if (!fittedContext) throw new Error("Canvas is not available.");

  const sourceData = fittedContext.getImageData(0, 0, fitted.width, fitted.height);
  const { fillMask, outlineMask } = buildArtworkMasks(sourceData, settings);
  const { fillRegionMap, regions } = labelFillRegions(fillMask, fitted.width, fitted.height, settings);

  const output = document.createElement("canvas");
  output.width = fitted.width;
  output.height = fitted.height;
  const outputContext = output.getContext("2d", { willReadFrequently: true });
  if (!outputContext) throw new Error("Canvas is not available.");

  outputContext.fillStyle = settings.backgroundColor || "#ffffff";
  outputContext.fillRect(0, 0, output.width, output.height);
  if (settings.gridLineLayer === "back") drawGraphPaperGrid(output, settings);
  drawFillRegions(outputContext, fillRegionMap, output.width, output.height, settings, 0.8);
  if (settings.gridLineLayer !== "back") drawGraphPaperGrid(output, settings);
  const imageLineThickness = clampImageLineThickness(settings.imageLineThickness);
  drawMaskLayer(outputContext, outlineMask, output.width, output.height, settings.outlineColor || settings.lineColor, 255, 0.325 * imageLineThickness);

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

export function generateGridOverlay(canvas: HTMLCanvasElement, settings: GraphSettings) {
  drawGraphPaperGrid(canvas, settings);
}

export async function pixelateImageWithWorker(
  sourceCanvas: HTMLCanvasElement,
  settings: GraphSettings,
  _palette: PaletteColor[],
) {
  return pixelateImage(sourceCanvas, settings);
}
