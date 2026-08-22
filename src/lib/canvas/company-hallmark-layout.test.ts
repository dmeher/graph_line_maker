import assert from "node:assert/strict";
import test from "node:test";
import { companyHallmarkPlacement } from "./company-hallmark-layout.ts";
import { createPdfExportPlan } from "./pdf-layout.ts";

const A4_PAPER = { widthCm: 21, heightCm: 29.7 };

test("the first-column second-row page reserves a dedicated hallmark lane without changing its right margin", () => {
  const plan = createPdfExportPlan({
    settings: { graphWidth: 80, graphHeight: 125, cellSizeCm: 1, printOrientation: "portrait" },
    paper: A4_PAPER,
    canvasWidth: 3200,
    canvasHeight: 5000,
  });
  const firstColumnSecondRow = plan.tiles[1];
  const hallmark = companyHallmarkPlacement(firstColumnSecondRow, plan.pageWidthMm, plan.pageHeightMm);

  assert.deepEqual([firstColumnSecondRow.tileX, firstColumnSecondRow.tileY], [0, 1]);
  assert.ok(hallmark);
  assert.equal(firstColumnSecondRow.destinationXMm, 40);
  assert.equal(firstColumnSecondRow.destinationWidthMm, 160);
  assert.equal(firstColumnSecondRow.destinationXMm + firstColumnSecondRow.destinationWidthMm, 200);
  assert.equal(hallmark.xMm, 4);
  assert.equal(hallmark.widthMm, 26.5);
  assert.ok(hallmark.xMm + hallmark.widthMm + 3 <= firstColumnSecondRow.destinationXMm - 26 * (160 / 640));
  assert.ok(hallmark.yMm >= firstColumnSecondRow.destinationYMm);
  assert.ok(hallmark.yMm + hallmark.heightMm <= firstColumnSecondRow.destinationYMm + firstColumnSecondRow.destinationHeightMm);
});

test("other columns retain the standard 1 cm left and right margins", () => {
  const plan = createPdfExportPlan({
    settings: { graphWidth: 80, graphHeight: 125, cellSizeCm: 1, printOrientation: "portrait" },
    paper: A4_PAPER,
    canvasWidth: 3200,
    canvasHeight: 5000,
  });
  const secondColumn = plan.tiles.find((tile) => tile.tileX === 1 && tile.tileY === 0);

  assert.ok(secondColumn);
  assert.equal(secondColumn.destinationXMm, 10);
  assert.equal(secondColumn.destinationXMm + secondColumn.destinationWidthMm, 200);
});

test("the hallmark is absent from every tile other than the first-column second row", () => {
  const tile = {
    tileX: 1,
    tileY: 0,
    destinationXMm: 10,
    destinationYMm: 0,
    destinationWidthMm: 190,
    destinationHeightMm: 290,
    sourceWidth: 760,
  };

  assert.equal(companyHallmarkPlacement(tile, 210, 297), null);
});
