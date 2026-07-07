import { DEFAULT_PRINT_PAPER_SIZE, PRINT_PAPER_SIZES } from "@/lib/graph-paper";
import { createPdfExportPlan, MAX_PAGES_PER_PDF_FILE } from "@/lib/canvas/pdf-layout";
import type { GraphSettings, PaletteColor } from "@/lib/types";

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

function canvasSliceToDataUrl(
  canvas: HTMLCanvasElement,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
) {
  const slice = document.createElement("canvas");
  slice.width = sourceWidth;
  slice.height = sourceHeight;
  const context = slice.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");
  context.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  return slice.toDataURL("image/png");
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
  const { jsPDF } = await import("jspdf");
  const settings = typeof settingsOrMargin === "number" ? null : settingsOrMargin;
  const margin = typeof settingsOrMargin === "number" ? Math.max(0, Math.round(settingsOrMargin)) : 0;

  if (settings) {
    const paper = PRINT_PAPER_SIZES[settings.printPaperSize] ?? PRINT_PAPER_SIZES[DEFAULT_PRINT_PAPER_SIZE];
    const plan = createPdfExportPlan({ settings, paper, canvasWidth: canvas.width, canvasHeight: canvas.height });
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

      pdf.addImage(
        canvasSliceToDataUrl(canvas, tile.sourceX, tile.sourceY, tile.sourceWidth, tile.sourceHeight),
        "PNG",
        tile.destinationXMm,
        tile.destinationYMm,
        tile.destinationWidthMm,
        tile.destinationHeightMm,
      );
      drawPdfCutGuides(pdf, tile.cutGuideTopYMm, tile.cutGuideBottomYMm, plan.pageWidthMm, plan.pageHeightMm);
      pagesInCurrentFile += 1;
    }

    if (pagesInCurrentFile > 0) saveCurrentPdf();
    return;
  }

  const width = canvas.width + margin * 2;
  const height = canvas.height + margin * 2;
  const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "px", format: [width, height] });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, canvas.width, canvas.height);
  pdf.save(pdfFilename(filename));
}

export function printCanvas(canvas: HTMLCanvasElement, settings: GraphSettings, title = "Graph") {
  const paper = PRINT_PAPER_SIZES[settings.printPaperSize] ?? PRINT_PAPER_SIZES[DEFAULT_PRINT_PAPER_SIZE];
  const plan = createPdfExportPlan({ settings, paper, canvasWidth: canvas.width, canvasHeight: canvas.height });
  const printWindow = window.open("", "_blank");
  if (!printWindow) throw new Error("Unable to open the print window.");
  printWindow.opener = null;

  const pages = plan.tiles
    .map((tile) => {
      const imageUrl = canvasSliceToDataUrl(canvas, tile.sourceX, tile.sourceY, tile.sourceWidth, tile.sourceHeight);
      const cutGuides = uniqueCutGuideYPositions(tile.cutGuideTopYMm, tile.cutGuideBottomYMm, plan.pageHeightMm)
        .map((y) => `<span class="cut-guide" style="top:${y}mm"></span>`)
        .join("");
      return `<section class="page"><img src="${imageUrl}" alt="" style="left:${tile.destinationXMm}mm;top:${tile.destinationYMm}mm;width:${tile.destinationWidthMm}mm;height:${tile.destinationHeightMm}mm" />${cutGuides}</section>`;
    })
    .join("");

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
    .cut-guide {
      position: absolute;
      left: 0;
      right: 0;
      z-index: 2;
      height: 0;
      border-top: 0.25mm dotted rgba(51, 65, 85, 0.78);
    }
  </style>
</head>
<body>
  ${pages}
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
