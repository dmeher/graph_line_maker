import { DEFAULT_PRINT_PAPER_SIZE, GRAPH_MAJOR_CELL_PIXELS, PRINT_PAPER_SIZES } from "@/lib/graph-paper";
import { createPdfExportPlan, MAX_PAGES_PER_PDF_FILE } from "@/lib/canvas/pdf-layout";
import { isGraphCanvasSizedForSettings } from "@/lib/canvas/pdf-export-guard";
import { companyHallmarkPlacement } from "@/lib/canvas/company-hallmark-layout";
import {
  GRID_BUCKET_ORDER,
  GRID_BUCKET_OPACITY,
  GRID_BUCKET_WIDTH_UNITS,
  gridBucketForIndex,
  gridLineCount,
  gridLinePositionPx,
  gridUnitMm,
  majorEveryMinorFor,
  type GridBucket,
} from "@/lib/canvas/grid-style";
import { createInteriorGridNumberLabels } from "@/lib/canvas/grid-numbering";
import type { GraphSettings, PaletteColor } from "@/lib/types";
import type { PdfExportTile } from "@/lib/canvas/pdf-layout";

type NumberPosition = { value: number; x: number; y: number };
type OutsideGridNumberLines = {
  top: NumberPosition[];
  bottom: NumberPosition[];
  left: NumberPosition[];
  right: NumberPosition[];
};

const OUTSIDE_LABEL_MARGIN_PX = 34;
const OUTSIDE_LABEL_LEFT_X = 8;
const OUTSIDE_LABEL_RIGHT_X = 10;
const OUTSIDE_LABEL_FALLBACK_TOLERANCE_PX = Math.round(GRAPH_MAJOR_CELL_PIXELS * 0.9);
const MAX_TOTAL_PDF_PAGES = 240;
// Cut guides sit just outside the graph edge so the dotted line brackets the
// graph immediately above/below the boundary grid line without overlapping it —
// only a hair's-width gap, while still running the full page width.
const CUT_GUIDE_GAP_MM = 0.5;
const TOP_BOTTOM_OUTSIDE_Y_OFFSET = 0.45;
const LEFT_RIGHT_OUTSIDE_Y_OFFSET = 0.45;
const OUTSIDE_GRID_NUMBER_COLOR = "#000000";
const COMPANY_HALLMARK_PATH = "/brand/company-hallmark.jpeg";
const COMPANY_HALLMARK_ROTATION_DEGREES = -90;
export { companyHallmarkPlacement, type CompanyHallmarkPlacement } from "@/lib/canvas/company-hallmark-layout";

async function loadCompanyHallmarkPdfBytes() {
  try {
    const response = await fetch(new URL(COMPANY_HALLMARK_PATH, window.location.origin));
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.height;
    canvas.height = bitmap.width;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }
    context.translate(0, bitmap.width);
    context.rotate((COMPANY_HALLMARK_ROTATION_DEGREES * Math.PI) / 180);
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

function isDrawableCanvas(canvas: HTMLCanvasElement | null | undefined) {
  return Boolean(canvas && Number.isFinite(canvas.width) && Number.isFinite(canvas.height) && canvas.width > 0 && canvas.height > 0);
}

function positiveInteger(value: unknown, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
}

function getOutsideGridNumberLines(settings: GraphSettings): OutsideGridNumberLines {
  const graphWidth = Math.max(1, Math.round(settings.graphWidth || 1));
  const graphHeight = Math.max(1, Math.round(settings.graphHeight || 1));
  const graphWidthPx = graphWidth * GRAPH_MAJOR_CELL_PIXELS;
  const graphHeightPx = graphHeight * GRAPH_MAJOR_CELL_PIXELS;

  const topBottomLabels = createInteriorGridNumberLabels(graphWidth).map((label) => ({
    value: label.value,
    x: Math.round((label.cell - 0.5) * GRAPH_MAJOR_CELL_PIXELS),
  }));
  const leftRightLabels = createInteriorGridNumberLabels(graphHeight).map((label) => ({
    value: label.value,
    y: Math.round((label.cell - 1 + LEFT_RIGHT_OUTSIDE_Y_OFFSET) * GRAPH_MAJOR_CELL_PIXELS),
  }));

  return {
    top: topBottomLabels.map((label) => ({
      value: label.value,
      x: label.x,
      y: -Math.round(TOP_BOTTOM_OUTSIDE_Y_OFFSET * GRAPH_MAJOR_CELL_PIXELS),
    })),
    bottom: topBottomLabels.map((label) => ({
      value: label.value,
      x: label.x,
      y: Math.round(graphHeightPx + TOP_BOTTOM_OUTSIDE_Y_OFFSET * GRAPH_MAJOR_CELL_PIXELS),
    })),
    left: leftRightLabels.map((label) => ({
      value: label.value,
      x: OUTSIDE_LABEL_LEFT_X - OUTSIDE_LABEL_MARGIN_PX,
      y: label.y,
    })),
    right: leftRightLabels.map((label) => ({
      value: label.value,
      x: graphWidthPx + OUTSIDE_LABEL_RIGHT_X,
      y: label.y,
    })),
  };
}

function isOutsideGridNumberVisible(positionPx: number, tileStartPx: number, tileSizePx: number) {
  const tileEndPx = tileStartPx + tileSizePx;
  return positionPx >= tileStartPx - OUTSIDE_LABEL_FALLBACK_TOLERANCE_PX && positionPx <= tileEndPx + OUTSIDE_LABEL_FALLBACK_TOLERANCE_PX;
}

function addOutsideGridNumbersToPdfPage(
  pdf: import("jspdf").jsPDF,
  tile: PdfExportTile,
  lines: OutsideGridNumberLines,
  graphWidthPx: number,
  graphHeightPx: number,
) {
  const hasGridNumbers =
    lines.top.length > 0 ||
    lines.bottom.length > 0 ||
    lines.left.length > 0 ||
    lines.right.length > 0;
  if (!hasGridNumbers) return;

  const xScaleMmPerPx = tile.sourceWidth > 0 ? tile.destinationWidthMm / tile.sourceWidth : 0;
  const yScaleMmPerPx = tile.sourceHeight > 0 ? tile.destinationHeightMm / tile.sourceHeight : 0;
  if (xScaleMmPerPx === 0 || yScaleMmPerPx === 0) return;
  pdf.setTextColor(0, 0, 0);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);

  const maybeAdd = (line: NumberPosition, axis: "x" | "y") => {
    const localX = line.x - tile.sourceX;
    const localY = line.y - tile.sourceY;
    const position = axis === "x" ? line.x : line.y;
    if (!isOutsideGridNumberVisible(position, axis === "x" ? tile.sourceX : tile.sourceY, axis === "x" ? tile.sourceWidth : tile.sourceHeight))
      return;

    const xMm = tile.destinationXMm + localX * xScaleMmPerPx;
    const yMm = tile.destinationYMm + localY * yScaleMmPerPx;
    const align = axis === "x" ? "center" : "left";
    pdf.text(String(line.value), xMm, yMm, { align });
  };

  for (const line of lines.top) {
    if (tile.sourceY !== 0 || !isOutsideGridNumberVisible(line.x, tile.sourceX, tile.sourceWidth)) continue;
    maybeAdd(line, "x");
  }

  for (const line of lines.bottom) {
    if (Math.round(tile.sourceY + tile.sourceHeight) !== graphHeightPx || !isOutsideGridNumberVisible(line.x, tile.sourceX, tile.sourceWidth)) continue;
    maybeAdd(line, "x");
  }

  for (const line of lines.left) {
    if (tile.sourceX !== 0 || !isOutsideGridNumberVisible(line.y, tile.sourceY, tile.sourceHeight)) continue;
    maybeAdd(line, "y");
  }

  for (const line of lines.right) {
    if (tile.sourceX + tile.sourceWidth !== graphWidthPx || !isOutsideGridNumberVisible(line.y, tile.sourceY, tile.sourceHeight)) continue;
    maybeAdd(line, "y");
  }
}

function createPrintGridNumberSpans(
  tile: PdfExportTile,
  lines: OutsideGridNumberLines,
  graphWidthPx: number,
  graphHeightPx: number,
) {
  const xScaleMmPerPx = tile.sourceWidth > 0 ? tile.destinationWidthMm / tile.sourceWidth : 0;
  const yScaleMmPerPx = tile.sourceHeight > 0 ? tile.destinationHeightMm / tile.sourceHeight : 0;
  if (xScaleMmPerPx === 0 || yScaleMmPerPx === 0) return "";

  const colorStyle = `color: ${OUTSIDE_GRID_NUMBER_COLOR}`;
  const fontSize = "3.7mm";
  const spans: string[] = [];

  const addLine = (line: NumberPosition, axis: "x" | "y") => {
    const localX = line.x - tile.sourceX;
    const localY = line.y - tile.sourceY;
    const position = axis === "x" ? line.x : line.y;
    if (!isOutsideGridNumberVisible(position, axis === "x" ? tile.sourceX : tile.sourceY, axis === "x" ? tile.sourceWidth : tile.sourceHeight))
      return;

    const xMm = tile.destinationXMm + localX * xScaleMmPerPx;
    const yMm = tile.destinationYMm + localY * yScaleMmPerPx;
    const className = axis === "x" ? "print-grid-number print-grid-number-horizontal" : "print-grid-number print-grid-number-vertical";
    const alignTransform = axis === "x" ? "translate(-50%, -50%)" : "translate(0, -50%)";

    spans.push(
      `<span class="${className}" style="left:${xMm}mm; top:${yMm}mm; font-size:${fontSize}; transform:${alignTransform}; ${colorStyle}">${line.value}</span>`,
    );
  };

  for (const line of lines.top) {
    if (tile.sourceY !== 0 || !isOutsideGridNumberVisible(line.x, tile.sourceX, tile.sourceWidth)) continue;
    addLine(line, "x");
  }

  for (const line of lines.bottom) {
    if (Math.round(tile.sourceY + tile.sourceHeight) !== graphHeightPx || !isOutsideGridNumberVisible(line.x, tile.sourceX, tile.sourceWidth))
      continue;
    addLine(line, "x");
  }

  for (const line of lines.left) {
    if (tile.sourceX !== 0 || !isOutsideGridNumberVisible(line.y, tile.sourceY, tile.sourceHeight)) continue;
    addLine(line, "y");
  }

  for (const line of lines.right) {
    if (tile.sourceX + tile.sourceWidth !== graphWidthPx || !isOutsideGridNumberVisible(line.y, tile.sourceY, tile.sourceHeight)) continue;
    addLine(line, "y");
  }

  return spans.join("");
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = (hex || "").replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((character) => character + character).join("") : clean;
  const int = Number.parseInt(value.slice(0, 6), 16);
  if (!Number.isFinite(int)) return [220, 38, 38];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

type TileGridGroup = { bucket: GridBucket; widthMm: number; opacity: number; vertical: number[]; horizontal: number[] };

/**
 * Grid lines for one export/print tile, in tile-local millimetres (0..width/height
 * of the tile's placed region). Widths use the shared grid-style weights so the
 * printed/PDF grid matches the editor preview exactly, and — because they are drawn
 * as vectors at physical mm widths — they stay crisp at any print scale instead of
 * blurring like the old baked-raster grid. Lines are grouped by weight bucket to
 * keep PDF state changes and SVG nodes minimal. (The dot pattern is exported as its
 * equivalent line grid.)
 */
function tileGridGroups(tile: PdfExportTile, settings: GraphSettings, canvasWidth: number, canvasHeight: number) {
  const base = Math.max(1, Math.min(10, Math.round(settings.gridLineThickness || 1)));
  const unitMm = gridUnitMm(settings.cellSizeCm ?? 1);
  const majorEveryMinor = majorEveryMinorFor(settings.majorGridEvery ?? 1);
  const xScale = tile.sourceWidth > 0 ? tile.destinationWidthMm / tile.sourceWidth : 0;
  const yScale = tile.sourceHeight > 0 ? tile.destinationHeightMm / tile.sourceHeight : 0;
  const columns = gridLineCount(canvasWidth);
  const rows = gridLineCount(canvasHeight);

  const byBucket = new Map<GridBucket, TileGridGroup>();
  const ensure = (bucket: GridBucket) => {
    let group = byBucket.get(bucket);
    if (!group) {
      group = {
        bucket,
        widthMm: GRID_BUCKET_WIDTH_UNITS[bucket] * base * unitMm,
        opacity: GRID_BUCKET_OPACITY[bucket],
        vertical: [],
        horizontal: [],
      };
      byBucket.set(bucket, group);
    }
    return group;
  };

  for (let index = 0; index <= columns; index += 1) {
    const px = gridLinePositionPx(index);
    if (px < tile.sourceX - 0.5 || px > tile.sourceX + tile.sourceWidth + 0.5) continue;
    ensure(gridBucketForIndex(index, majorEveryMinor)).vertical.push((px - tile.sourceX) * xScale);
  }
  for (let index = 0; index <= rows; index += 1) {
    const px = gridLinePositionPx(index);
    if (px < tile.sourceY - 0.5 || px > tile.sourceY + tile.sourceHeight + 0.5) continue;
    ensure(gridBucketForIndex(index, majorEveryMinor)).horizontal.push((px - tile.sourceY) * yScale);
  }

  const groups = GRID_BUCKET_ORDER.map((bucket) => byBucket.get(bucket)).filter((group): group is TileGridGroup => Boolean(group));
  return { groups, widthMm: tile.destinationWidthMm, heightMm: tile.destinationHeightMm };
}

function drawGridLinesToPdfPage(
  pdf: import("jspdf").jsPDF,
  tile: PdfExportTile,
  settings: GraphSettings,
  canvasWidth: number,
  canvasHeight: number,
) {
  const { groups, widthMm, heightMm } = tileGridGroups(tile, settings, canvasWidth, canvasHeight);
  if (!groups.length) return;
  const [red, green, blue] = hexToRgbTuple(settings.gridLineColor || "#dc2626");
  pdf.setDrawColor(red, green, blue);
  pdf.setLineCap("butt");
  const x0 = tile.destinationXMm;
  const y0 = tile.destinationYMm;
  for (const group of groups) {
    // Keep the established PDF treatment: jsPDF applies this to fills, while
    // its vector strokes remain fully opaque and therefore crisp on paper.
    pdf.setGState(pdf.GState({ opacity: group.opacity }));
    pdf.setLineWidth(group.widthMm);
    for (const vertical of group.vertical) pdf.line(x0 + vertical, y0, x0 + vertical, y0 + heightMm);
    for (const horizontal of group.horizontal) pdf.line(x0, y0 + horizontal, x0 + widthMm, y0 + horizontal);
  }
  pdf.setGState(pdf.GState({ opacity: 1 }));
}

function createPrintGridSvg(tile: PdfExportTile, settings: GraphSettings, canvasWidth: number, canvasHeight: number, zIndex: number) {
  const { groups, widthMm, heightMm } = tileGridGroups(tile, settings, canvasWidth, canvasHeight);
  if (!groups.length) return "";
  const color = escapeHtml(settings.gridLineColor || "#dc2626");
  const paths = groups
    .map((group) => {
      let d = "";
      for (const vertical of group.vertical) d += `M${vertical} 0V${heightMm}`;
      for (const horizontal of group.horizontal) d += `M0 ${horizontal}H${widthMm}`;
      // Match the established PDF grid: fully opaque vector strokes, with the
      // hierarchy carried by the shared line widths rather than faded alpha.
      return `<path d="${d}" stroke="${color}" stroke-width="${group.widthMm}" stroke-opacity="1" fill="none" />`;
    })
    .join("");
  return `<svg class="print-grid" style="left:${tile.destinationXMm}mm;top:${tile.destinationYMm}mm;width:${widthMm}mm;height:${heightMm}mm;z-index:${zIndex}" viewBox="0 0 ${widthMm} ${heightMm}" preserveAspectRatio="none">${paths}</svg>`;
}

function canvasToObjectUrl(canvas: HTMLCanvasElement, type = "image/png") {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(URL.createObjectURL(blob));
      else reject(new Error("Unable to export canvas."));
    }, type);
  });
}

export async function exportCanvasAsPNG(canvas: HTMLCanvasElement, filename: string) {
  const url = await canvasToObjectUrl(canvas);
  const link = document.createElement("a");
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function pdfFilename(filename: string, part?: number) {
  const clean = filename.endsWith(".pdf") ? filename.slice(0, -4) : filename;
  return part ? `${clean}-part-${part}.pdf` : `${clean}.pdf`;
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to encode canvas image."));
    }, "image/png");
  });
}

async function canvasSliceToPngBlob(
  canvas: HTMLCanvasElement,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
) {
  if (!isDrawableCanvas(canvas)) throw new Error("The processed image is empty. Reprocess the project before exporting.");
  const safeSourceX = Math.max(0, Math.round(Number(sourceX) || 0));
  const safeSourceY = Math.max(0, Math.round(Number(sourceY) || 0));
  const safeSourceWidth = Math.min(canvas.width - safeSourceX, positiveInteger(sourceWidth));
  const safeSourceHeight = Math.min(canvas.height - safeSourceY, positiveInteger(sourceHeight));
  if (safeSourceWidth <= 0 || safeSourceHeight <= 0) {
    throw new Error("The export tile is empty. Reprocess the project before exporting.");
  }

  const slice = document.createElement("canvas");
  slice.width = safeSourceWidth;
  slice.height = safeSourceHeight;
  const context = slice.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");
  context.drawImage(canvas, safeSourceX, safeSourceY, safeSourceWidth, safeSourceHeight, 0, 0, safeSourceWidth, safeSourceHeight);
  return canvasToPngBlob(slice);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function uniqueCutGuidePositions(startMm: number, endMm: number, pageSizeMm: number) {
  const safeStart = Math.max(0, Math.min(pageSizeMm, startMm));
  const safeEnd = Math.max(0, Math.min(pageSizeMm, endMm));
  return Array.from(new Set([safeStart, safeEnd].map((value) => Math.round(value * 1000) / 1000)));
}

function drawPdfCutGuides(pdf: import("jspdf").jsPDF, tile: PdfExportTile, pageWidthMm: number, pageHeightMm: number) {
  pdf.setGState(pdf.GState({ opacity: 1 }));
  pdf.setDrawColor(51, 65, 85);
  pdf.setLineWidth(0.25);
  pdf.setLineDashPattern([1.5, 1.5], 0);
  // Full-page dotted lines sit just outside every tile edge. They preserve the
  // established horizontal guides and make split columns equally clear.
  const leftMm = tile.cutGuideLeftXMm - CUT_GUIDE_GAP_MM;
  const rightMm = tile.cutGuideRightXMm + CUT_GUIDE_GAP_MM;
  const topMm = tile.cutGuideTopYMm - CUT_GUIDE_GAP_MM;
  const bottomMm = tile.cutGuideBottomYMm + CUT_GUIDE_GAP_MM;
  for (const x of uniqueCutGuidePositions(leftMm, rightMm, pageWidthMm)) {
    pdf.line(x, 0, x, pageHeightMm);
  }
  for (const y of uniqueCutGuidePositions(topMm, bottomMm, pageHeightMm)) {
    pdf.line(0, y, pageWidthMm, y);
  }
  pdf.setLineDashPattern([], 0);
}

export async function exportCanvasAsPDF(canvas: HTMLCanvasElement, filename: string, settingsOrMargin: GraphSettings | number = 0) {
  if (!isDrawableCanvas(canvas)) throw new Error("The processed image is empty. Reprocess the project before exporting.");
  const { jsPDF } = await import("jspdf");
  const settings = typeof settingsOrMargin === "number" ? null : settingsOrMargin;
  const margin = typeof settingsOrMargin === "number" ? Math.max(0, Math.round(settingsOrMargin)) : 0;

  if (settings) {
    // The print path already receives the correct settled canvas. Keep PDF
    // equally exact even when this function is called outside EditorClient:
    // otherwise an old 800 px-wide frame can put 20 cells into a new 10 cm
    // graph and silently turn each cell into 0.5 cm.
    if (!isGraphCanvasSizedForSettings(canvas, settings)) {
      throw new Error("The graph dimensions changed before the canvas finished rendering. Wait for the update, then export the PDF again.");
    }
    const paper = PRINT_PAPER_SIZES[settings.printPaperSize] ?? PRINT_PAPER_SIZES[DEFAULT_PRINT_PAPER_SIZE];
    const plan = createPdfExportPlan({ settings, paper, canvasWidth: canvas.width, canvasHeight: canvas.height });
    if (plan.tiles.length > MAX_TOTAL_PDF_PAGES) {
      throw new Error(`This export needs ${plan.tiles.length.toLocaleString()} pages. The limit is ${MAX_TOTAL_PDF_PAGES}; reduce the graph size or increase the cell size.`);
    }
    const outsideGridNumberLines =
      settings.showNumbers && settings.gridNumberPlacement === "outside" ? getOutsideGridNumberLines(settings) : null;
    const graphWidthPx = Math.max(1, Math.round(canvas.width));
    const graphHeightPx = Math.max(1, Math.round(canvas.height));
    const companyHallmarkBytes = plan.totalPages > 1 ? await loadCompanyHallmarkPdfBytes() : null;
    function createPdf() {
      const nextPdf = new jsPDF({ orientation: plan.orientation, unit: "mm", format: [plan.pageWidthMm, plan.pageHeightMm] });
      nextPdf.viewerPreferences({ PrintScaling: "None" });
      return nextPdf;
    }

    let pdf = createPdf();
    let pagesInCurrentFile = 0;
    let filePart = 1;

    function saveCurrentPdf() {
      pdf.save(pdfFilename(filename, plan.splitIntoFiles ? filePart : undefined));
      filePart += 1;
      pdf = createPdf();
      pagesInCurrentFile = 0;
    }

    const [bgRed, bgGreen, bgBlue] = hexToRgbTuple(settings.backgroundColor || "#ffffff");
    for (const tile of plan.tiles) {
      if (plan.splitIntoFiles && pagesInCurrentFile >= MAX_PAGES_PER_PDF_FILE) saveCurrentPdf();
      if (pagesInCurrentFile > 0) pdf.addPage([plan.pageWidthMm, plan.pageHeightMm], plan.orientation);

      // Paper backdrop, then vector grid behind the transparent artwork ("back"),
      // so grid lines are drawn as crisp vectors instead of baked into the raster.
      pdf.setGState(pdf.GState({ opacity: 1 }));
      pdf.setFillColor(bgRed, bgGreen, bgBlue);
      pdf.rect(tile.destinationXMm, tile.destinationYMm, tile.destinationWidthMm, tile.destinationHeightMm, "F");
      if (settings.gridLineLayer === "back") drawGridLinesToPdfPage(pdf, tile, settings, canvas.width, canvas.height);

      const tileBytes = new Uint8Array(
        await (await canvasSliceToPngBlob(canvas, tile.sourceX, tile.sourceY, tile.sourceWidth, tile.sourceHeight)).arrayBuffer(),
      );
      pdf.addImage(
        tileBytes,
        "PNG",
        tile.destinationXMm,
        tile.destinationYMm,
        tile.destinationWidthMm,
        tile.destinationHeightMm,
      );
      if (settings.gridLineLayer !== "back") drawGridLinesToPdfPage(pdf, tile, settings, canvas.width, canvas.height);
      if (outsideGridNumberLines) {
        addOutsideGridNumbersToPdfPage(pdf, tile, outsideGridNumberLines, graphWidthPx, graphHeightPx);
      }
      const hallmark = companyHallmarkBytes && companyHallmarkPlacement(tile, plan.pageWidthMm, plan.pageHeightMm);
      if (hallmark) {
        pdf.addImage(companyHallmarkBytes, "PNG", hallmark.xMm, hallmark.yMm, hallmark.widthMm, hallmark.heightMm);
      }
      drawPdfCutGuides(pdf, tile, plan.pageWidthMm, plan.pageHeightMm);
      pagesInCurrentFile += 1;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }

    if (pagesInCurrentFile > 0) saveCurrentPdf();
    return;
  }

  const width = canvas.width + margin * 2;
  const height = canvas.height + margin * 2;
  const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "px", format: [width, height] });
  const imageBytes = new Uint8Array(await (await canvasToPngBlob(canvas)).arrayBuffer());
  pdf.addImage(imageBytes, "PNG", margin, margin, canvas.width, canvas.height);
  pdf.save(pdfFilename(filename));
}

export async function printCanvas(canvas: HTMLCanvasElement, settings: GraphSettings, title = "Graph") {
  if (!isDrawableCanvas(canvas)) throw new Error("The processed image is empty. Reprocess the project before printing.");
  const paper = PRINT_PAPER_SIZES[settings.printPaperSize] ?? PRINT_PAPER_SIZES[DEFAULT_PRINT_PAPER_SIZE];
  const plan = createPdfExportPlan({ settings, paper, canvasWidth: canvas.width, canvasHeight: canvas.height });
  if (plan.tiles.length > MAX_TOTAL_PDF_PAGES) {
    throw new Error(`This print needs ${plan.tiles.length.toLocaleString()} pages. The limit is ${MAX_TOTAL_PDF_PAGES}; reduce the graph size or increase the cell size.`);
  }
  const outsideGridNumberLines =
    settings.showNumbers && settings.gridNumberPlacement === "outside" ? getOutsideGridNumberLines(settings) : null;
  const printWindow = window.open("", "_blank");
  if (!printWindow) throw new Error("Unable to open the print window.");
  printWindow.opener = null;
  const graphWidthPx = Math.max(1, Math.round(canvas.width));
  const graphHeightPx = Math.max(1, Math.round(canvas.height));
  const companyHallmarkUrl = new URL(COMPANY_HALLMARK_PATH, window.location.origin).href;
  const backgroundColor = escapeHtml(settings.backgroundColor || "#ffffff");
  const gridZIndex = settings.gridLineLayer === "back" ? 1 : 3;

  const objectUrls: string[] = [];
  const pages: string[] = [];
  for (const tile of plan.tiles) {
      const imageUrl = URL.createObjectURL(
        await canvasSliceToPngBlob(canvas, tile.sourceX, tile.sourceY, tile.sourceWidth, tile.sourceHeight),
      );
      objectUrls.push(imageUrl);
      const horizontalCutGuides = uniqueCutGuidePositions(
        tile.cutGuideTopYMm - CUT_GUIDE_GAP_MM,
        tile.cutGuideBottomYMm + CUT_GUIDE_GAP_MM,
        plan.pageHeightMm,
      )
        .map((y) => `<span class="cut-guide cut-guide-horizontal" style="top:${y}mm"></span>`)
        .join("");
      const verticalCutGuides = uniqueCutGuidePositions(
        tile.cutGuideLeftXMm - CUT_GUIDE_GAP_MM,
        tile.cutGuideRightXMm + CUT_GUIDE_GAP_MM,
        plan.pageWidthMm,
      )
        .map((x) => `<span class="cut-guide cut-guide-vertical" style="left:${x}mm"></span>`)
        .join("");
      const cutGuides = `${horizontalCutGuides}${verticalCutGuides}`;
      const gridNumberSpans = outsideGridNumberLines
        ? createPrintGridNumberSpans(
            tile,
            outsideGridNumberLines,
            graphWidthPx,
            graphHeightPx,
          )
        : "";
      const hallmark = companyHallmarkPlacement(tile, plan.pageWidthMm, plan.pageHeightMm);
      const hallmarkImage = hallmark
        ? `<span class="company-hallmark" style="left:${hallmark.xMm}mm;top:${hallmark.yMm}mm;width:${hallmark.widthMm}mm;height:${hallmark.heightMm}mm"><img src="${companyHallmarkUrl}" alt="" style="left:${(hallmark.widthMm - hallmark.heightMm) / 2}mm;top:${(hallmark.heightMm - hallmark.widthMm) / 2}mm;width:${hallmark.heightMm}mm;height:${hallmark.widthMm}mm" /></span>`
        : "";
      // Paper backdrop + crisp vector grid (SVG) behind/above the transparent
      // artwork image, so grid lines print sharp at any scale instead of blurring.
      const backdrop = `<span class="print-bg" style="left:${tile.destinationXMm}mm;top:${tile.destinationYMm}mm;width:${tile.destinationWidthMm}mm;height:${tile.destinationHeightMm}mm;background:${backgroundColor}"></span>`;
      const gridSvg = createPrintGridSvg(tile, settings, canvas.width, canvas.height, gridZIndex);
      pages.push(`<section class="page">${backdrop}${gridSvg}<img class="print-art" src="${imageUrl}" alt="" style="left:${tile.destinationXMm}mm;top:${tile.destinationYMm}mm;width:${tile.destinationWidthMm}mm;height:${tile.destinationHeightMm}mm" />${hallmarkImage}${gridNumberSpans}${cutGuides}</section>`);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: ${plan.pageWidthMm}mm ${plan.pageHeightMm}mm; margin: 0; }
    html, body {
      margin: 0;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      position: relative;
      width: ${plan.pageWidthMm}mm;
      height: ${plan.pageHeightMm}mm;
      overflow: hidden;
      background: white;
      break-after: page;
      page-break-after: always;
    }
    .page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    img { display: block; position: absolute; }
    .print-bg { position: absolute; z-index: 0; }
    .print-grid {
      position: absolute;
      overflow: visible;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-art { z-index: 2; }
    .company-hallmark { position: absolute; z-index: 4; overflow: visible; }
    .company-hallmark img { transform: rotate(-90deg); transform-origin: center; object-fit: contain; }
    .cut-guide {
      position: absolute;
      z-index: 5;
      pointer-events: none;
    }
    .cut-guide-horizontal {
      left: 0;
      right: 0;
      height: 0;
      border-top: 0.25mm dotted rgba(51, 65, 85, 0.78);
    }
    .cut-guide-vertical {
      top: 0;
      bottom: 0;
      width: 0;
      border-left: 0.25mm dotted rgba(51, 65, 85, 0.78);
    }
    .print-grid-number {
      position: absolute;
      font-family: Arial, sans-serif;
      font-weight: 300;
      line-height: 1;
      z-index: 6;
      pointer-events: none;
      white-space: nowrap;
      user-select: none;
    }
    .print-grid-number-horizontal {
      transform: translate(-50%, -50%);
    }
    .print-grid-number-vertical {
      transform: translate(0, -50%);
    }
  </style>
</head>
<body>
  ${pages.join("")}
  <script>
    window.addEventListener("load", () => {
      setTimeout(() => {
        window.focus();
        window.print();
      }, 100);
    });
  </script>
</body>
</html>`);
  printWindow.document.close();
  printWindow.addEventListener("afterprint", () => objectUrls.forEach((url) => URL.revokeObjectURL(url)), { once: true });
}

export function exportSettingsAsJSON(
  filename: string,
  settings: GraphSettings,
  palette: PaletteColor[],
  metadata: Record<string, unknown>,
) {
  const blob = new Blob([JSON.stringify({ metadata, settings, palette }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
