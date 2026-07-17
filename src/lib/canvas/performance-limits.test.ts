import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_CANVAS_PIXELS,
  MAX_GRAPH_HEIGHT_CELLS,
  MAX_GRAPH_WIDTH_CELLS,
  assertCanvasBudget,
  clampGraphCellDimensions,
  inspectCanvasBudget,
} from "./performance-limits.ts";

test("canvas budget accepts the default project size", () => {
  const budget = inspectCanvasBudget(400, 4480, 12);
  assert.equal(budget.allowed, true);
});

test("canvas budget accounts for one sequential layer scratch buffer", () => {
  const singleLayer = inspectCanvasBudget(320, 4480, 1);
  const eightyThreeLayers = inspectCanvasBudget(320, 4480, 83);

  assert.equal(eightyThreeLayers.allowed, true);
  assert.equal(eightyThreeLayers.estimatedBytes, singleLayer.estimatedBytes);
  assert.ok(eightyThreeLayers.estimatedBytes <= MAX_CANVAS_PIXELS * 28);
});

test("canvas budget rejects excessive pixels before allocation", () => {
  const side = Math.ceil(Math.sqrt(MAX_CANVAS_PIXELS)) + 1;
  assert.throws(() => assertCanvasBudget(side, side), /safe limit|need about/);
});

test("graph dimensions clamp to the product maximums (20 x 125 cells)", () => {
  const result = clampGraphCellDimensions(150, 150, 40);
  assert.equal(result.width, MAX_GRAPH_WIDTH_CELLS);
  assert.equal(result.height, 125);
});

test("graph dimensions within the caps are preserved", () => {
  assert.deepEqual(clampGraphCellDimensions(10, 112, 40), { width: 10, height: 112 });
  assert.deepEqual(clampGraphCellDimensions(MAX_GRAPH_WIDTH_CELLS, MAX_GRAPH_HEIGHT_CELLS, 40), {
    width: MAX_GRAPH_WIDTH_CELLS,
    height: MAX_GRAPH_HEIGHT_CELLS,
  });
});

test("oversized legacy projects clamp each axis independently", () => {
  assert.deepEqual(clampGraphCellDimensions(1000, 60, 40), { width: MAX_GRAPH_WIDTH_CELLS, height: 60 });
  assert.deepEqual(clampGraphCellDimensions(12, 1000, 40), { width: 12, height: MAX_GRAPH_HEIGHT_CELLS });
});

test("graph dimension clamping normalizes malformed saved settings", () => {
  const result = clampGraphCellDimensions("not-a-number" as unknown as number, Number.NaN, "40" as unknown as number);
  assert.deepEqual(result, { width: 1, height: 1 });
});

test("canvas budget inspection never returns NaN dimensions", () => {
  const budget = inspectCanvasBudget(Number.NaN, "bad-height" as unknown as number, "bad-layer-count" as unknown as number);
  assert.equal(budget.width, 1);
  assert.equal(budget.height, 1);
  assert.equal(budget.pixels, 1);
  assert.equal(Number.isFinite(budget.estimatedBytes), true);
});
