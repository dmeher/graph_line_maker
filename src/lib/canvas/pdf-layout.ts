export const MAX_PAGES_PER_PDF_FILE = 80;

const GRAPH_MAJOR_CELL_PIXELS = 160;

export type PdfExportPaper = {
  widthCm: number;
  heightCm: number;
};

export type PdfExportSettings = {
  graphWidth: number;
  graphHeight: number;
  cellSizeCm: number;
  imagePadding?: number;
  printOrientation?: "auto" | "portrait" | "landscape";
  printHorizontalAlignment?: "left" | "center" | "right";
  printVerticalAlignment?: "top" | "center" | "bottom";
};

export type PdfExportTile = {
  index: number;
  tileX: number;
  tileY: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  destinationXMm: number;
  destinationYMm: number;
  destinationWidthMm: number;
  destinationHeightMm: number;
};

export type PdfExportPlan = {
  orientation: "landscape" | "portrait";
  graphWidthMm: number;
  graphHeightMm: number;
  pageWidthMm: number;
  pageHeightMm: number;
  pagesX: number;
  pagesY: number;
  totalPages: number;
  splitIntoFiles: boolean;
  tiles: PdfExportTile[];
};

function cmToMm(value: number) {
  return value * 10;
}

function safePositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function alignmentOffset(extraSpaceMm: number, alignment: "left" | "center" | "right" | "top" | "bottom") {
  if (alignment === "left" || alignment === "top") return 0;
  if (alignment === "right" || alignment === "bottom") return extraSpaceMm;
  return extraSpaceMm / 2;
}

export function getGraphPrintSizeMm(settings: PdfExportSettings) {
  const graphWidth = Math.max(1, Math.round(safePositive(settings.graphWidth, 1)));
  const graphHeight = Math.max(1, Math.round(safePositive(settings.graphHeight, 1)));
  const cellSizeCm = Math.max(0.05, safePositive(settings.cellSizeCm, 1));

  return {
    widthMm: cmToMm(graphWidth * cellSizeCm),
    heightMm: cmToMm(graphHeight * cellSizeCm),
  };
}

export function createPdfExportPlan({
  settings,
  paper,
  canvasWidth,
  canvasHeight,
  maxPagesPerFile = MAX_PAGES_PER_PDF_FILE,
}: {
  settings: PdfExportSettings;
  paper: PdfExportPaper;
  canvasWidth: number;
  canvasHeight: number;
  maxPagesPerFile?: number;
}): PdfExportPlan {
  const graphSize = getGraphPrintSizeMm(settings);
  const landscape =
    settings.printOrientation === "landscape" ||
    (settings.printOrientation !== "portrait" && graphSize.widthMm > graphSize.heightMm);
  const pageWidthMm = cmToMm(landscape ? Math.max(paper.widthCm, paper.heightCm) : Math.min(paper.widthCm, paper.heightCm));
  const pageHeightMm = cmToMm(landscape ? Math.min(paper.widthCm, paper.heightCm) : Math.max(paper.widthCm, paper.heightCm));
  const pagesX = Math.max(1, Math.ceil(graphSize.widthMm / pageWidthMm));
  const pagesY = Math.max(1, Math.ceil(graphSize.heightMm / pageHeightMm));
  const safeCanvasWidth = Math.max(1, Math.round(canvasWidth));
  const safeCanvasHeight = Math.max(1, Math.round(canvasHeight));
  const extraWidthMm = Math.max(0, pagesX * pageWidthMm - graphSize.widthMm);
  const extraHeightMm = Math.max(0, pagesY * pageHeightMm - graphSize.heightMm);
  const gridOffsetX = alignmentOffset(extraWidthMm, settings.printHorizontalAlignment ?? "center");
  const gridOffsetY = alignmentOffset(extraHeightMm, settings.printVerticalAlignment ?? "center");
  const tiles: PdfExportTile[] = [];

  for (let tileY = 0; tileY < pagesY; tileY += 1) {
    for (let tileX = 0; tileX < pagesX; tileX += 1) {
      const pageStartMmX = tileX * pageWidthMm;
      const pageStartMmY = tileY * pageHeightMm;
      const graphStartMmX = gridOffsetX;
      const graphStartMmY = gridOffsetY;
      const graphEndMmX = gridOffsetX + graphSize.widthMm;
      const graphEndMmY = gridOffsetY + graphSize.heightMm;
      const intersectionStartMmX = Math.max(pageStartMmX, graphStartMmX);
      const intersectionStartMmY = Math.max(pageStartMmY, graphStartMmY);
      const intersectionEndMmX = Math.min(pageStartMmX + pageWidthMm, graphEndMmX);
      const intersectionEndMmY = Math.min(pageStartMmY + pageHeightMm, graphEndMmY);
      const sourceStartMmX = intersectionStartMmX - graphStartMmX;
      const sourceStartMmY = intersectionStartMmY - graphStartMmY;
      const sourceEndMmX = intersectionEndMmX - graphStartMmX;
      const sourceEndMmY = intersectionEndMmY - graphStartMmY;
      const sourceX = Math.round((sourceStartMmX / graphSize.widthMm) * safeCanvasWidth);
      const sourceY = Math.round((sourceStartMmY / graphSize.heightMm) * safeCanvasHeight);
      const sourceEndX = Math.round((sourceEndMmX / graphSize.widthMm) * safeCanvasWidth);
      const sourceEndY = Math.round((sourceEndMmY / graphSize.heightMm) * safeCanvasHeight);

      tiles.push({
        index: tiles.length,
        tileX,
        tileY,
        sourceX,
        sourceY,
        sourceWidth: Math.max(1, sourceEndX - sourceX),
        sourceHeight: Math.max(1, sourceEndY - sourceY),
        destinationXMm: intersectionStartMmX - pageStartMmX,
        destinationYMm: intersectionStartMmY - pageStartMmY,
        destinationWidthMm: intersectionEndMmX - intersectionStartMmX,
        destinationHeightMm: intersectionEndMmY - intersectionStartMmY,
      });
    }
  }

  return {
    orientation: landscape ? "landscape" : "portrait",
    graphWidthMm: graphSize.widthMm,
    graphHeightMm: graphSize.heightMm,
    pageWidthMm,
    pageHeightMm,
    pagesX,
    pagesY,
    totalPages: pagesX * pagesY,
    splitIntoFiles: pagesX * pagesY > maxPagesPerFile,
    tiles,
  };
}
