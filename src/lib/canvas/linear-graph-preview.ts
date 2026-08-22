import { GRAPH_MAJOR_CELL_PIXELS } from "../graph-paper.ts";
import { MAX_CANVAS_DIMENSION, MAX_CANVAS_PIXELS } from "./performance-limits.ts";

export const LINEAR_GRAPH_PREVIEW_REPEAT_COUNT = 10;
export const LINEAR_GRAPH_PREVIEW_BORDER_CELLS = 5;
const LANDSCAPE_RATIO = 16 / 9;

export type LinearGraphPreviewLayout = {
  width: number;
  height: number;
  logicalWidth: number;
  logicalHeight: number;
  scale: number;
  sourceWidth: number;
  sourceHeight: number;
  repeatCount: number;
  borderHeight: number;
  repeatStripWidth: number;
  repeatStripX: number;
};

export type LinearGraphPreviewOptions = {
  backgroundColor?: string;
  borderColor?: string;
  cellPixels?: number;
  repeatCount?: number;
  borderCells?: number;
  maxPixels?: number;
};

/** Every second tile is mirrored horizontally, creating the left/right repeat. */
export function isLinearGraphPreviewTileMirrored(index: number) {
  return Number.isFinite(index) && Math.trunc(index) % 2 !== 0;
}

function positiveInteger(value: number | undefined, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.max(1, Math.round(numeric)) : fallback;
}

/**
 * Plans a landscape presentation image without allocating it. The graph is
 * copied ten times in a centered horizontal strip, with five graph cells of
 * decorative border above and below. Large graph canvases are uniformly scaled
 * down before allocation so this optional preview stays inside canvas limits.
 */
export function createLinearGraphPreviewLayout({
  sourceWidth,
  sourceHeight,
  cellPixels = GRAPH_MAJOR_CELL_PIXELS,
  repeatCount = LINEAR_GRAPH_PREVIEW_REPEAT_COUNT,
  borderCells = LINEAR_GRAPH_PREVIEW_BORDER_CELLS,
  maxPixels = MAX_CANVAS_PIXELS,
}: {
  sourceWidth: number;
  sourceHeight: number;
} & Pick<LinearGraphPreviewOptions, "cellPixels" | "repeatCount" | "borderCells" | "maxPixels">): LinearGraphPreviewLayout {
  const safeSourceWidth = positiveInteger(sourceWidth, 1);
  const safeSourceHeight = positiveInteger(sourceHeight, 1);
  const safeCellPixels = positiveInteger(cellPixels, GRAPH_MAJOR_CELL_PIXELS);
  const safeRepeatCount = positiveInteger(repeatCount, LINEAR_GRAPH_PREVIEW_REPEAT_COUNT);
  const safeBorderCells = positiveInteger(borderCells, LINEAR_GRAPH_PREVIEW_BORDER_CELLS);
  const safeMaxPixels = positiveInteger(maxPixels, MAX_CANVAS_PIXELS);
  const borderHeight = safeCellPixels * safeBorderCells;
  const repeatStripWidth = safeSourceWidth * safeRepeatCount;
  const logicalHeight = safeSourceHeight + borderHeight * 2;
  // The ten-copy strip can be very narrow for tall graphs. Extra paper on each
  // side keeps the result landscape while retaining the graph at its center.
  const logicalWidth = Math.max(repeatStripWidth, Math.ceil(logicalHeight * LANDSCAPE_RATIO));
  const scale = Math.min(
    1,
    Math.sqrt(safeMaxPixels / (logicalWidth * logicalHeight)),
    MAX_CANVAS_DIMENSION / logicalWidth,
    MAX_CANVAS_DIMENSION / logicalHeight,
  );
  const width = Math.max(1, Math.floor(logicalWidth * scale));
  const height = Math.max(1, Math.floor(logicalHeight * scale));

  return {
    width,
    height,
    logicalWidth,
    logicalHeight,
    // Use the real rounded dimensions so every drawn element remains inside
    // the allocated canvas after integer rounding.
    scale: Math.min(width / logicalWidth, height / logicalHeight),
    sourceWidth: safeSourceWidth,
    sourceHeight: safeSourceHeight,
    repeatCount: safeRepeatCount,
    borderHeight,
    repeatStripWidth,
    repeatStripX: (logicalWidth - repeatStripWidth) / 2,
  };
}

function drawDecorativeBorder(
  context: CanvasRenderingContext2D,
  { y, width, height, cellPixels, color, top }: {
    y: number;
    width: number;
    height: number;
    cellPixels: number;
    color: string;
    top: boolean;
  },
) {
  context.save();
  context.fillStyle = color;
  context.globalAlpha = 0.08;
  context.fillRect(0, y, width, height);

  context.strokeStyle = color;
  context.lineWidth = Math.max(1, cellPixels / 40);
  context.globalAlpha = 0.2;
  context.beginPath();
  for (let x = 0; x <= width; x += cellPixels) {
    context.moveTo(x, y);
    context.lineTo(x, y + height);
  }
  for (let lineY = y; lineY <= y + height; lineY += cellPixels) {
    context.moveTo(0, lineY);
    context.lineTo(width, lineY);
  }
  context.stroke();

  // A chain of mirrored diamonds makes the band read as a deliberate border,
  // while its geometry remains tied to the graph's one-centimetre cells.
  const centerY = y + height / 2;
  const radius = Math.max(2, cellPixels * 0.3);
  context.globalAlpha = 0.82;
  context.lineWidth = Math.max(1.5, cellPixels / 18);
  context.beginPath();
  for (let centerX = cellPixels; centerX < width + cellPixels; centerX += cellPixels * 2) {
    context.moveTo(centerX, centerY - radius);
    context.lineTo(centerX + radius, centerY);
    context.lineTo(centerX, centerY + radius);
    context.lineTo(centerX - radius, centerY);
    context.closePath();
  }
  context.stroke();

  context.globalAlpha = 0.9;
  context.lineWidth = Math.max(2, cellPixels / 14);
  context.beginPath();
  const innerEdge = top ? y + height : y;
  context.moveTo(0, innerEdge);
  context.lineTo(width, innerEdge);
  context.stroke();
  context.restore();
}

/** Creates the browser-only landscape preview canvas from a settled graph. */
export function createLinearGraphPreview(
  sourceCanvas: HTMLCanvasElement,
  options: LinearGraphPreviewOptions = {},
) {
  if (sourceCanvas.width <= 0 || sourceCanvas.height <= 0) {
    throw new Error("The graph image is empty. Wait for the canvas to finish rendering.");
  }

  const layout = createLinearGraphPreviewLayout({
    sourceWidth: sourceCanvas.width,
    sourceHeight: sourceCanvas.height,
    ...options,
  });
  const cellPixels = positiveInteger(options.cellPixels, GRAPH_MAJOR_CELL_PIXELS);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  context.fillStyle = options.backgroundColor || "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(layout.scale, 0, 0, layout.scale, 0, 0);
  const borderColor = options.borderColor || "#dc2626";
  drawDecorativeBorder(context, {
    y: 0,
    width: layout.logicalWidth,
    height: layout.borderHeight,
    cellPixels,
    color: borderColor,
    top: true,
  });
  drawDecorativeBorder(context, {
    y: layout.borderHeight + layout.sourceHeight,
    width: layout.logicalWidth,
    height: layout.borderHeight,
    cellPixels,
    color: borderColor,
    top: false,
  });

  context.imageSmoothingEnabled = true;
  for (let index = 0; index < layout.repeatCount; index += 1) {
    const x = layout.repeatStripX + index * layout.sourceWidth;
    context.save();
    if (isLinearGraphPreviewTileMirrored(index)) {
      context.translate(x + layout.sourceWidth, layout.borderHeight);
      context.scale(-1, 1);
      context.drawImage(sourceCanvas, 0, 0, layout.sourceWidth, layout.sourceHeight);
    } else {
      context.drawImage(sourceCanvas, x, layout.borderHeight, layout.sourceWidth, layout.sourceHeight);
    }
    context.restore();
  }
  context.setTransform(1, 0, 0, 1, 0, 0);

  return { canvas, layout };
}
