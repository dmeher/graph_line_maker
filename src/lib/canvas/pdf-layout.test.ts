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
  assert.equal(plan.pagesY, 3);
  assert.equal(plan.totalPages, 9);

  const firstTile = plan.tiles[0];
  assert.equal(firstTile.destinationXMm, 65);
  assert.equal(firstTile.destinationYMm, 45.5);
  assert.equal(firstTile.destinationWidthMm, 145);
  assert.equal(firstTile.destinationHeightMm, 251.5);

  const lastTile = plan.tiles.at(-1);
  assert.ok(lastTile);
  assert.equal(lastTile.destinationXMm, 0);
  assert.equal(lastTile.destinationYMm, 0);
  assert.equal(lastTile.destinationWidthMm, 145);
  assert.equal(lastTile.destinationHeightMm, 251.5);
  assert.equal(lastTile.sourceX, 568);
  assert.equal(lastTile.sourceY, 878);
  assert.equal(lastTile.sourceWidth, 232);
  assert.equal(lastTile.sourceHeight, 402);
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

test("PDF export adds image padding outside the requested graph width", () => {
  const settings = {
    graphWidth: 8,
    graphHeight: 8,
    cellSizeCm: 1,
    imagePadding: 160,
  };

  const graphSize = getGraphPrintSizeMm(settings);
  assert.equal(graphSize.widthMm / 10, 10);
  assert.equal(graphSize.heightMm / 10, 10);

  const plan = createPdfExportPlan({
    settings,
    paper: A4_PAPER,
    canvasWidth: 1600,
    canvasHeight: 1600,
  });

  assert.equal(plan.totalPages, 1);
  assert.equal(plan.tiles[0].destinationWidthMm, 100);
  assert.equal(plan.tiles[0].destinationHeightMm, 100);
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
