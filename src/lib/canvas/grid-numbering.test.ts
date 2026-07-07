import assert from "node:assert/strict";
import test from "node:test";
import { createGridNumberLabels } from "./grid-numbering.ts";

test("grid numbering creates labels on all four graph edges", () => {
  const labels = createGridNumberLabels(10, 12, 40, 40);

  assert.equal(labels.top.length, 10);
  assert.equal(labels.bottom.length, 10);
  assert.equal(labels.left.length, 12);
  assert.equal(labels.right.length, 12);
  assert.deepEqual(labels.top[0], { value: 1, x: 20, y: 11 });
  assert.deepEqual(labels.bottom.at(-1), { value: 10, x: 380, y: 473 });
  assert.deepEqual(labels.left[0], { value: 1, x: 7, y: 22 });
  assert.deepEqual(labels.right.at(-1), { value: 12, x: 393, y: 462 });
});

test("grid numbering clamps invalid graph sizes to a visible one-cell graph", () => {
  const labels = createGridNumberLabels(0, Number.NaN, 0, -1);

  assert.equal(labels.top.length, 1);
  assert.equal(labels.bottom.length, 1);
  assert.equal(labels.left.length, 1);
  assert.equal(labels.right.length, 1);
  assert.equal(labels.top[0].value, 1);
  assert.equal(labels.left[0].value, 1);
});
