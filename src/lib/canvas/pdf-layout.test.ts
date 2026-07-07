import assert from "node:assert/strict";
import test from "node:test";
import { createPdfExportPlan, getGraphPrintSizeMm } from "./pdf-layout.ts";

const A4_PAPER = { widthCm: 21, heightCm: 29.7 };

test("test2 PDF export layout keeps centimeter print size", () => {
  const settings = {
    graphWidth: 5,
    graphHeight: 8,
    cellSizeCm: 10,
  };

  const graphSize = getGraphPrintSizeMm(settings);
  assert.equal(graphSize.widthMm / 10, 50);
  assert.equal(graphSize.heightMm / 10, 80);

  const plan = createPdfExportPlan({
    settings,
    paper: A4_PAPER,
    canvasWidth: 800,
    canvasHeight: 1280,
  });

  assert.equal(plan.graphWidthMm, 500);
  assert.equal(plan.graphHeightMm, 800);
  assert.equal(plan.pageWidthMm, 210);
  assert.equal(plan.pageHeightMm, 297);
  assert.equal(plan.pagesX, 3);
  assert.equal(plan.pagesY, 4);
  assert.equal(plan.totalPages, 12);

  const firstTile = plan.tiles[0];
  assert.equal(firstTile.destinationXMm, 0);
  assert.equal(firstTile.destinationYMm, 0);
  assert.equal(firstTile.destinationWidthMm, 200);
  assert.equal(firstTile.destinationHeightMm, 200);

  const lastTile = plan.tiles.at(-1);
  assert.ok(lastTile);
  assert.equal(lastTile.destinationXMm, 0);
  assert.equal(lastTile.destinationYMm, 0);
  assert.equal(lastTile.destinationWidthMm, 100);
  assert.equal(lastTile.destinationHeightMm, 200);
  assert.equal(lastTile.sourceX, 640);
  assert.equal(lastTile.sourceY, 960);
  assert.equal(lastTile.sourceWidth, 160);
  assert.equal(lastTile.sourceHeight, 320);
});

test("single-page PDF export centers graph on paper", () => {
  const plan = createPdfExportPlan({
    settings: {
      graphWidth: 5,
      graphHeight: 5,
      cellSizeCm: 1,
    },
    paper: A4_PAPER,
    canvasWidth: 800,
    canvasHeight: 800,
  });

  assert.equal(plan.totalPages, 1);
  assert.equal(plan.tiles[0].destinationXMm, 80);
  assert.equal(plan.tiles[0].destinationYMm, 123.5);
  assert.equal(plan.tiles[0].destinationWidthMm, 50);
  assert.equal(plan.tiles[0].destinationHeightMm, 50);
});

test("PDF export ignores legacy image padding for requested graph width", () => {
  const settings = {
    graphWidth: 8,
    graphHeight: 8,
    cellSizeCm: 1,
    imagePadding: 160,
  };

  const graphSize = getGraphPrintSizeMm(settings);
  assert.equal(graphSize.widthMm / 10, 8);
  assert.equal(graphSize.heightMm / 10, 8);

  const plan = createPdfExportPlan({
    settings,
    paper: A4_PAPER,
    canvasWidth: 1600,
    canvasHeight: 1600,
  });

  assert.equal(plan.totalPages, 1);
  assert.equal(plan.tiles[0].destinationWidthMm, 80);
  assert.equal(plan.tiles[0].destinationHeightMm, 80);
});

test("single-page PDF export supports left top alignment", () => {
  const plan = createPdfExportPlan({
    settings: {
      graphWidth: 5,
      graphHeight: 5,
      cellSizeCm: 1,
      printHorizontalAlignment: "left",
      printVerticalAlignment: "top",
    },
    paper: A4_PAPER,
    canvasWidth: 800,
    canvasHeight: 800,
  });

  assert.equal(plan.totalPages, 1);
  assert.equal(plan.tiles[0].destinationXMm, 0);
  assert.equal(plan.tiles[0].destinationYMm, 0);
});

test("single-page PDF export supports right bottom alignment", () => {
  const plan = createPdfExportPlan({
    settings: {
      graphWidth: 5,
      graphHeight: 5,
      cellSizeCm: 1,
      printHorizontalAlignment: "right",
      printVerticalAlignment: "bottom",
    },
    paper: A4_PAPER,
    canvasWidth: 800,
    canvasHeight: 800,
  });

  assert.equal(plan.totalPages, 1);
  assert.equal(plan.tiles[0].destinationXMm, 160);
  assert.equal(plan.tiles[0].destinationYMm, 247);
});

test("PDF export can force landscape orientation", () => {
  const plan = createPdfExportPlan({
    settings: {
      graphWidth: 5,
      graphHeight: 5,
      cellSizeCm: 1,
      printOrientation: "landscape",
    },
    paper: A4_PAPER,
    canvasWidth: 800,
    canvasHeight: 800,
  });

  assert.equal(plan.orientation, "landscape");
  assert.equal(plan.pageWidthMm, 297);
  assert.equal(plan.pageHeightMm, 210);
  assert.equal(plan.tiles[0].destinationXMm, 123.5);
  assert.equal(plan.tiles[0].destinationYMm, 80);
});

test("multi-page PDF export splits on whole graph-cell boundaries", () => {
  const plan = createPdfExportPlan({
    settings: {
      graphWidth: 10,
      graphHeight: 112,
      cellSizeCm: 1,
      printHorizontalAlignment: "center",
      printVerticalAlignment: "center",
    },
    paper: A4_PAPER,
    canvasWidth: 400,
    canvasHeight: 4480,
  });

  assert.equal(plan.pagesX, 1);
  assert.equal(plan.pagesY, 4);
  assert.equal(plan.tiles[0].destinationXMm, 55);
  assert.equal(plan.tiles[0].destinationYMm, 0);

  for (const tile of plan.tiles) {
    assert.equal(tile.sourceY % 40, 0);
    assert.equal(tile.sourceHeight % 40, 0);
    assert.equal(tile.destinationHeightMm % 10, 0);
  }

  assert.equal(plan.tiles[0].destinationHeightMm, 290);
  assert.equal(plan.tiles.at(-1)?.destinationHeightMm, 250);
});

test("PDF export reserves top and bottom safe margins on every printed page", () => {
  const plan = createPdfExportPlan({
    settings: {
      graphWidth: 10,
      graphHeight: 112,
      cellSizeCm: 1,
      pageMargin: 24,
      printHorizontalAlignment: "center",
      printVerticalAlignment: "top",
    },
    paper: A4_PAPER,
    canvasWidth: 400,
    canvasHeight: 4480,
  });

  assert.equal(plan.pageVerticalMarginMm, 6);
  assert.equal(plan.printablePageHeightMm, 285);
  assert.equal(plan.pagesY, 4);
  assert.equal(plan.tiles[0].destinationYMm, 6);
  assert.equal(plan.tiles[0].destinationHeightMm, 280);
  assert.equal(plan.tiles[0].cutGuideTopYMm, 6);
  assert.equal(plan.tiles[0].cutGuideBottomYMm, 286);
  assert.equal(plan.tiles.at(-1)?.destinationYMm, 6);
  assert.equal(plan.tiles.at(-1)?.destinationHeightMm, 280);
  assert.equal(plan.tiles.at(-1)?.cutGuideTopYMm, 6);
  assert.equal(plan.tiles.at(-1)?.cutGuideBottomYMm, 286);

  for (const tile of plan.tiles) {
    assert.ok(tile.destinationYMm >= plan.pageVerticalMarginMm);
    assert.ok(tile.destinationYMm + tile.destinationHeightMm <= plan.pageHeightMm - plan.pageVerticalMarginMm);
    assert.equal(tile.cutGuideTopYMm, tile.destinationYMm);
    assert.equal(tile.cutGuideBottomYMm, tile.destinationYMm + tile.destinationHeightMm);
    assert.equal(tile.destinationHeightMm % 10, 0);
  }
});
