import { DEFAULT_PRINT_PAPER_SIZE, GRAPH_MAJOR_CELL_PIXELS, PRINT_PAPER_SIZES } from "@/lib/graph-paper";
import { createPdfExportPlan, MAX_PAGES_PER_PDF_FILE } from "@/lib/canvas/pdf-layout";
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
const OUTSIDE_LABEL_TOP_Y = 6;
const OUTSIDE_LABEL_BOTTOM_Y = 8;
const OUTSIDE_LABEL_LEFT_X = 8;
const OUTSIDE_LABEL_RIGHT_X = 10;
const OUTSIDE_LABEL_FALLBACK_TOLERANCE_PX = Math.round(GRAPH_MAJOR_CELL_PIXELS * 0.9);
const MAX_TOTAL_PDF_PAGES = 240;
const LEFT_RIGHT_OUTSIDE_Y_OFFSET = 0.45;
const OUTSIDE_GRID_NUMBER_COLOR = "#000000";
const COMPANY_HALLMARK_PATH = "/brand/company-hallmark.jpeg";
const COMPANY_HALLMARK_ASPECT_RATIO = 9 / 16;
const COMPANY_HALLMARK_ROTATION_DEGREES = -90;
const COMPANY_HALLMARK_PAGE_PADDING_MM = 4;
const COMPANY_HALLMARK_GRAPH_GAP_MM = 3;
const COMPANY_HALLMARK_MAX_WIDTH_MM = 70;

export type CompanyHallmarkPlacement = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

/** Places the hallmark on export page two without ever covering the graph tile. */
export function companyHallmarkPlacement(
  tile: PdfExportTile,
  pageWidthMm: number,
  pageHeightMm: number,
): CompanyHallmarkPlacement | null {
  if (tile.index !== 1) return null;
  const padding = COMPANY_HALLMARK_PAGE_PADDING_MM;
  const graphRight = tile.destinationXMm + tile.destinationWidthMm;
  const graphBottom = tile.destinationYMm + tile.destinationHeightMm;
  const candidates = [
    { x: padding, y: padding, width: tile.destinationXMm - padding - COMPANY_HALLMARK_GRAPH_GAP_MM, height: pageHeightMm - padding * 2 },
    { x: graphRight + COMPANY_HALLMARK_GRAPH_GAP_MM, y: padding, width: pageWidthMm - graphRight - padding - COMPANY_HALLMARK_GRAPH_GAP_MM, height: pageHeightMm - padding * 2 },
    { x: padding, y: padding, width: pageWidthMm - padding * 2, height: tile.destinationYMm - padding - COMPANY_HALLMARK_GRAPH_GAP_MM },
    { x: padding, y: graphBottom + COMPANY_HALLMARK_GRAPH_GAP_MM, width: pageWidthMm - padding * 2, height: pageHeightMm - graphBottom - padding - COMPANY_HALLMARK_GRAPH_GAP_MM },
  ]
    .filter((candidate) => candidate.width > 0 && candidate.height > 0)
    .sort((a, b) => b.width * b.height - a.width * a.height);
  const area = candidates[0];
  if (!area) return null;

  const widthMm = Math.min(COMPANY_HALLMARK_MAX_WIDTH_MM, area.width, area.height * COMPANY_HALLMARK_ASPECT_RATIO);
  const heightMm = widthMm / COMPANY_HALLMARK_ASPECT_RATIO;
  if (widthMm < 18 || heightMm < 10) return null;
  return {
    xMm: area.x + (area.width - widthMm) / 2,
    yMm: area.y + (area.height - heightMm) / 2,
    widthMm,
    heightMm,
  };
}

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

  const topBottomLabels = Array.from({ length: graphWidth }, (_, index) => ({
    value: index + 1,
    x: Math.round((index + 0.5) * GRAPH_MAJOR_CELL_PIXELS),
  }));
  const leftRightLabels = Array.from({ length: graphHeight }, (_, index) => ({
    value: index + 1,
    y: Math.round((index + LEFT_RIGHT_OUTSIDE_Y_OFFSET) * GRAPH_MAJOR_CELL_PIXELS),
  }));

  return {
    top: topBottomLabels.map((label) => ({
      value: label.value,
      x: label.x,
      y: OUTSIDE_LABEL_TOP_Y - OUTSIDE_LABEL_MARGIN_PX,
    })),
    bottom: topBottomLabels.map((label) => ({
      value: label.value,
      x: label.x,
      y: graphHeightPx + OUTSIDE_LABEL_BOTTOM_Y,
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

function uniqueCutGuideYPositions(topMm: number, bottomMm: number, pageHeightMm: number) {
  const safeTop = Math.max(0, Math.min(pageHeightMm, topMm));
  const safeBottom = Math.max(0, Math.min(pageHeightMm, bottomMm));
  return Array.from(new Set([safeTop, safeBottom].map((value) => Math.round(value * 1000) / 1000)));
}

function drawPdfCutGuides(
  pdf: import("jspdf").jsPDF,
  topMm: number,
  bottomMm: number,
  pageWidthMm: number,
  pageHeightMm: number,
) {
  pdf.setDrawColor(51, 65, 85);
  pdf.setLineWidth(0.25);
  pdf.setLineDashPattern([1.5, 1.5], 0);
  for (const y of uniqueCutGuideYPositions(topMm, bottomMm, pageHeightMm)) {
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

    for (const tile of plan.tiles) {
      if (plan.splitIntoFiles && pagesInCurrentFile >= MAX_PAGES_PER_PDF_FILE) saveCurrentPdf();
      if (pagesInCurrentFile > 0) pdf.addPage([plan.pageWidthMm, plan.pageHeightMm], plan.orientation);

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
      if (outsideGridNumberLines) {
        addOutsideGridNumbersToPdfPage(pdf, tile, outsideGridNumberLines, graphWidthPx, graphHeightPx);
      }
      const hallmark = companyHallmarkBytes && companyHallmarkPlacement(tile, plan.pageWidthMm, plan.pageHeightMm);
      if (hallmark) {
        pdf.addImage(companyHallmarkBytes, "PNG", hallmark.xMm, hallmark.yMm, hallmark.widthMm, hallmark.heightMm);
      }
      drawPdfCutGuides(pdf, tile.cutGuideTopYMm, tile.cutGuideBottomYMm, plan.pageWidthMm, plan.pageHeightMm);
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

  const objectUrls: string[] = [];
  const pages: string[] = [];
  for (const tile of plan.tiles) {
      const imageUrl = URL.createObjectURL(
        await canvasSliceToPngBlob(canvas, tile.sourceX, tile.sourceY, tile.sourceWidth, tile.sourceHeight),
      );
      objectUrls.push(imageUrl);
      const cutGuides = uniqueCutGuideYPositions(tile.cutGuideTopYMm, tile.cutGuideBottomYMm, plan.pageHeightMm)
        .map((y) => `<span class="cut-guide" style="top:${y}mm"></span>`)
        .join("");
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
      pages.push(`<section class="page"><img src="${imageUrl}" alt="" style="left:${tile.destinationXMm}mm;top:${tile.destinationYMm}mm;width:${tile.destinationWidthMm}mm;height:${tile.destinationHeightMm}mm" />${hallmarkImage}${gridNumberSpans}${cutGuides}</section>`);
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
    html, body { margin: 0; background: white; }
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
    .company-hallmark { position: absolute; z-index: 1; overflow: visible; }
    .company-hallmark img { transform: rotate(-90deg); transform-origin: center; object-fit: contain; }
    .cut-guide {
      position: absolute;
      left: 0;
      right: 0;
      z-index: 2;
      height: 0;
      border-top: 0.25mm dotted rgba(51, 65, 85, 0.78);
    }
    .print-grid-number {
      position: absolute;
      font-family: Arial, sans-serif;
      font-weight: 300;
      line-height: 1;
      z-index: 3;
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
