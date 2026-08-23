export const MAX_PAGES_PER_PDF_FILE = 80;
/** Fixed left/right printer-safe area used by every PDF and browser-print page. */
export const PDF_HORIZONTAL_PAGE_MARGIN_MM = 10;
/** Vertical printer-safe gutter used when outside grid numbers are printed above/below the graph. */
export const PDF_VERTICAL_LABEL_MARGIN_MM = 7;
/** Extra left lane for the first column when it contains the hallmark row. */
export const PDF_FIRST_COLUMN_HALLMARK_MARGIN_MM = 40;

export type PdfExportPaper = {
  widthCm: number;
  heightCm: number;
};

export type PdfExportSettings = {
  graphWidth: number;
  graphHeight: number;
  cellSizeCm: number;
  imagePadding?: number;
  pageMargin?: number;
  showNumbers?: boolean;
  gridNumberPlacement?: "inside" | "outside";
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
  cutGuideLeftXMm: number;
  cutGuideRightXMm: number;
  cutGuideTopYMm: number;
  cutGuideBottomYMm: number;
};

export type PdfExportPlan = {
  orientation: "landscape" | "portrait";
  graphWidthMm: number;
  graphHeightMm: number;
  pageWidthMm: number;
  pageHeightMm: number;
  pageHorizontalMarginMm: number;
  pageVerticalMarginMm: number;
  printablePageWidthMm: number;
  printablePageHeightMm: number;
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

function pageSpanWithoutCuttingCells(pageSizeMm: number, graphSizeMm: number, cellSizeMm: number) {
  if (graphSizeMm <= pageSizeMm) return graphSizeMm;
  const wholeCellsPerPage = Math.floor(pageSizeMm / cellSizeMm);
  if (wholeCellsPerPage < 1) return pageSizeMm;
  return Math.max(cellSizeMm, wholeCellsPerPage * cellSizeMm);
}

function safeVerticalPageMarginMm({
  settings,
  graphHeightMm,
  canvasHeight,
  pageHeightMm,
  cellSizeMm,
  minimumMarginMm = 0,
}: {
  settings: PdfExportSettings;
  graphHeightMm: number;
  canvasHeight: number;
  pageHeightMm: number;
  cellSizeMm: number;
  minimumMarginMm?: number;
}) {
  const pageMarginPixels = Number(settings.pageMargin);
  const pixelHeightMm = graphHeightMm / Math.max(1, canvasHeight);
  const rawMarginMm = Number.isFinite(pageMarginPixels) && pageMarginPixels > 0 ? pageMarginPixels * pixelHeightMm : 0;
  const requestedMarginMm = Math.max(0, minimumMarginMm, rawMarginMm);
  if (requestedMarginMm <= 0) return 0;
  const maxMarginMm = Math.max(0, (pageHeightMm - Math.min(pageHeightMm, cellSizeMm)) / 2);
  return Math.min(requestedMarginMm, maxMarginMm);
}

function safeHorizontalPageMarginMm(pageWidthMm: number, cellSizeMm: number) {
  const minimumPrintableWidthMm = Math.min(pageWidthMm, cellSizeMm);
  const maxMarginMm = Math.max(0, (pageWidthMm - minimumPrintableWidthMm) / 2);
  return Math.min(PDF_HORIZONTAL_PAGE_MARGIN_MM, maxMarginMm);
}

function safeFirstColumnHallmarkMarginMm(pageWidthMm: number, cellSizeMm: number, rightMarginMm: number) {
  const minimumPrintableWidthMm = Math.min(pageWidthMm, cellSizeMm);
  const maxLeftMarginMm = Math.max(0, pageWidthMm - rightMarginMm - minimumPrintableWidthMm);
  return Math.min(PDF_FIRST_COLUMN_HALLMARK_MARGIN_MM, maxLeftMarginMm);
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
  const safeCanvasWidth = Math.max(1, Math.round(canvasWidth));
  const safeCanvasHeight = Math.max(1, Math.round(canvasHeight));
  const cellSizeMm = cmToMm(Math.max(0.05, safePositive(settings.cellSizeCm, 1)));
  const needsOutsideGridNumberMargin = settings.showNumbers === true && settings.gridNumberPlacement === "outside";
  const pageVerticalMarginMm = safeVerticalPageMarginMm({
    settings,
    graphHeightMm: graphSize.heightMm,
    canvasHeight: safeCanvasHeight,
    pageHeightMm,
    cellSizeMm,
    minimumMarginMm: needsOutsideGridNumberMargin ? PDF_VERTICAL_LABEL_MARGIN_MM : 0,
  });
  const pageHorizontalMarginMm = safeHorizontalPageMarginMm(pageWidthMm, cellSizeMm);
  const printablePageWidthMm = Math.max(
    Math.min(pageWidthMm, cellSizeMm),
    pageWidthMm - pageHorizontalMarginMm * 2,
  );
  const printablePageHeightMm = Math.max(cellSizeMm, pageHeightMm - pageVerticalMarginMm * 2);
  const tileHeightMm = pageSpanWithoutCuttingCells(printablePageHeightMm, graphSize.heightMm, cellSizeMm);
  const pagesY = Math.max(1, Math.ceil(graphSize.heightMm / tileHeightMm));
  const standardTileWidthMm = pageSpanWithoutCuttingCells(printablePageWidthMm, graphSize.widthMm, cellSizeMm);
  const reservesHallmarkLane = pagesY > 1 && graphSize.widthMm > standardTileWidthMm;
  const firstColumnLeftMarginMm = reservesHallmarkLane
    ? safeFirstColumnHallmarkMarginMm(pageWidthMm, cellSizeMm, pageHorizontalMarginMm)
    : pageHorizontalMarginMm;
  const firstColumnPrintableWidthMm = Math.max(
    Math.min(pageWidthMm, cellSizeMm),
    pageWidthMm - firstColumnLeftMarginMm - pageHorizontalMarginMm,
  );
  const horizontalTileWidthsMm: number[] = [];
  let remainingGraphWidthMm = graphSize.widthMm;
  if (reservesHallmarkLane) {
    const firstColumnWidthMm = pageSpanWithoutCuttingCells(firstColumnPrintableWidthMm, remainingGraphWidthMm, cellSizeMm);
    horizontalTileWidthsMm.push(firstColumnWidthMm);
    remainingGraphWidthMm -= firstColumnWidthMm;
  }
  while (remainingGraphWidthMm > 0) {
    const columnWidthMm = pageSpanWithoutCuttingCells(printablePageWidthMm, remainingGraphWidthMm, cellSizeMm);
    horizontalTileWidthsMm.push(columnWidthMm);
    remainingGraphWidthMm -= columnWidthMm;
  }
  const pagesX = horizontalTileWidthsMm.length;
  const singlePageOffsetX =
    pageHorizontalMarginMm +
    alignmentOffset(Math.max(0, printablePageWidthMm - graphSize.widthMm), settings.printHorizontalAlignment ?? "center");
  const singlePageOffsetY =
    pageVerticalMarginMm +
    alignmentOffset(Math.max(0, printablePageHeightMm - graphSize.heightMm), settings.printVerticalAlignment ?? "center");
  const tiles: PdfExportTile[] = [];

  // Keep every vertical page in a column together before advancing right. This
  // is the natural order for assembling or reading a wide tiled graph.
  let sourceStartMmX = 0;
  for (let tileX = 0; tileX < pagesX; tileX += 1) {
    const columnWidthMm = horizontalTileWidthsMm[tileX];
    for (let tileY = 0; tileY < pagesY; tileY += 1) {
      const sourceStartMmY = tileY * tileHeightMm;
      const sourceEndMmX = Math.min(sourceStartMmX + columnWidthMm, graphSize.widthMm);
      const sourceEndMmY = Math.min(sourceStartMmY + tileHeightMm, graphSize.heightMm);
      const sourceX = Math.round((sourceStartMmX / graphSize.widthMm) * safeCanvasWidth);
      const sourceY = Math.round((sourceStartMmY / graphSize.heightMm) * safeCanvasHeight);
      const sourceEndX = Math.round((sourceEndMmX / graphSize.widthMm) * safeCanvasWidth);
      const sourceEndY = Math.round((sourceEndMmY / graphSize.heightMm) * safeCanvasHeight);
      const destinationWidthMm = sourceEndMmX - sourceStartMmX;
      const destinationHeightMm = sourceEndMmY - sourceStartMmY;
      const destinationXMm = pagesX === 1
        ? singlePageOffsetX
        : tileX === 0 && reservesHallmarkLane
          ? pageWidthMm - pageHorizontalMarginMm - destinationWidthMm
          : pageHorizontalMarginMm;
      const destinationYMm = pagesY === 1 ? singlePageOffsetY : pageVerticalMarginMm;

      tiles.push({
        index: tiles.length,
        tileX,
        tileY,
        sourceX,
        sourceY,
        sourceWidth: Math.max(1, sourceEndX - sourceX),
        sourceHeight: Math.max(1, sourceEndY - sourceY),
        destinationXMm,
        destinationYMm,
        destinationWidthMm,
        destinationHeightMm,
        cutGuideLeftXMm: destinationXMm,
        cutGuideRightXMm: destinationXMm + destinationWidthMm,
        cutGuideTopYMm: destinationYMm,
        cutGuideBottomYMm: destinationYMm + destinationHeightMm,
      });
    }
    sourceStartMmX += columnWidthMm;
  }

  return {
    orientation: landscape ? "landscape" : "portrait",
    graphWidthMm: graphSize.widthMm,
    graphHeightMm: graphSize.heightMm,
    pageWidthMm,
    pageHeightMm,
    pageHorizontalMarginMm,
    pageVerticalMarginMm,
    printablePageWidthMm,
    printablePageHeightMm,
    pagesX,
    pagesY,
    totalPages: pagesX * pagesY,
    splitIntoFiles: pagesX * pagesY > maxPagesPerFile,
    tiles,
  };
}
