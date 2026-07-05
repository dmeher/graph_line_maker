import assert from "node:assert/strict";
import test from "node:test";
import { createSubpixelMaskPlan, skeletonizeMask, subpixelStrokeStyle } from "./subpixel-mask.ts";

function maskFromPoints(width: number, height: number, points: Array<[number, number]>) {
  const mask = new Uint8Array(width * height);
  for (const [x, y] of points) {
    mask[y * width + x] = 1;
  }
  return mask;
}

function countMask(mask: Uint8Array) {
  return mask.reduce((sum, value) => sum + value, 0);
}

test("subpixel mask plan keeps every mask pixel drawable", () => {
  const points: Array<[number, number]> = [
    [0, 0],
    [2, 1],
    [4, 2],
    [1, 4],
  ];
  const plan = createSubpixelMaskPlan(maskFromPoints(6, 6, points), 6, 6);

  assert.equal(plan.dots.length, points.length);
});

test("subpixel mask plan connects adjacent horizontal, vertical, and diagonal pixels", () => {
  const plan = createSubpixelMaskPlan(
    maskFromPoints(4, 4, [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 2],
    ]),
    4,
    4,
  );

  assert.ok(plan.segments.some((segment) => segment.x1 === 0.5 && segment.y1 === 0.5 && segment.x2 === 1.5 && segment.y2 === 0.5));
  assert.ok(plan.segments.some((segment) => segment.x1 === 1.5 && segment.y1 === 0.5 && segment.x2 === 1.5 && segment.y2 === 1.5));
  assert.ok(plan.segments.some((segment) => segment.x1 === 1.5 && segment.y1 === 1.5 && segment.x2 === 2.5 && segment.y2 === 2.5));
});

test("skeletonize mask thins a solid stroke while keeping its center path", () => {
  const points: Array<[number, number]> = [];
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 5; x += 1) points.push([x, y]);
  }

  const mask = maskFromPoints(7, 5, points);
  const skeleton = skeletonizeMask(mask, 7, 5);

  assert.ok(countMask(skeleton) < countMask(mask));
  assert.equal(skeleton[2 * 7 + 3], 1);
});

test("skeletonize mask keeps one-pixel strokes intact", () => {
  const mask = maskFromPoints(7, 5, [
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 2],
  ]);
  const skeleton = skeletonizeMask(mask, 7, 5);

  assert.deepEqual(Array.from(skeleton), Array.from(mask));
});

test("subpixel stroke style keeps ultra-thin values drawable", () => {
  assert.deepEqual(subpixelStrokeStyle(0.01), { alpha: 1, strokeWidth: 0.25 });
  assert.deepEqual(subpixelStrokeStyle(0.1), { alpha: 1, strokeWidth: 0.25 });
  assert.deepEqual(subpixelStrokeStyle(0.99), { alpha: 1, strokeWidth: 0.99 });
});
