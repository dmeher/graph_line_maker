import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_CANVAS_PIXELS,
  assertCanvasBudget,
  clampGraphCellDimensions,
  inspectCanvasBudget,
} from "./performance-limits.ts";

test("canvas budget accepts the default project size", () => {
  const budget = inspectCanvasBudget(400, 4480, 12);
  assert.equal(budget.allowed, true);
});

test("canvas budget rejects excessive pixels before allocation", () => {
  const side = Math.ceil(Math.sqrt(MAX_CANVAS_PIXELS)) + 1;
  assert.throws(() => assertCanvasBudget(side, side), /safe limit|need about/);
});

test("graph dimensions are proportionally clamped to the pixel budget", () => {
  const result = clampGraphCellDimensions(150, 150, 40);
  assert.equal(result.width, 100);
  assert.equal(result.height, 100);
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
