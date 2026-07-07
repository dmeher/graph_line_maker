import assert from "node:assert/strict";
import test from "node:test";
import {
  applyUnlockedSourcePatch,
  normalizeRotationDegrees,
  snapCellToGrid,
  sourceLayouts,
  sourceProcessingCacheKey,
  stackEndCell,
} from "./source-layout.ts";
import type { GraphSourceImage } from "@/lib/types";

function source(overrides: Partial<GraphSourceImage> = {}): GraphSourceImage {
  return {
    id: "source-1",
    name: "Source",
    path: null,
    url: null,
    width: 8,
    height: 10,
    measurementUnit: "cm",
    imageLineThickness: 0,
    sourceFillThreshold: 0.58,
    sourceFillMinStrokePixels: 7,
    strokeGapClosePixels: 0,
    x: 1,
    y: 0,
    topPadding: 0,
    bottomPadding: 0,
    locked: false,
    rotationDegrees: 0,
    flipX: false,
    flipY: false,
    ...overrides,
  };
}

test("source layouts use absolute positions without shifting neighbors", () => {
  const first = source({ id: "a", width: 8, height: 10, y: 0, bottomPadding: 1 });
  const second = source({ id: "b", width: 8, height: 10, y: 3.5, topPadding: 9 });

  const layouts = sourceLayouts([first, second]);

  assert.equal(layouts[0].y, 0);
  assert.equal(layouts[0].height, 10);
  assert.equal(layouts[1].y, 3.5);
  assert.equal(layouts[1].height, 10);
  assert.equal(stackEndCell([first, second]), 13.5);
});

test("source layouts allow overflow instead of fitting into graph height", () => {
  const layouts = sourceLayouts([
    source({ id: "a", y: 0, height: 10 }),
    source({ id: "b", y: 10, height: 10 }),
    source({ id: "c", y: 20, height: 10 }),
  ]);

  assert.equal(layouts.at(-1)?.y, 20);
  assert.equal(stackEndCell(layouts.map((layout) => layout.source)), 30);
});

test("locked source patch leaves geometry and transform unchanged", () => {
  const locked = source({ locked: true, x: 2, y: 3, width: 8, rotationDegrees: 90, flipX: false });

  const patched = applyUnlockedSourcePatch(locked, { x: 9, y: 12, width: 4, rotationDegrees: 180, flipX: true });

  assert.equal(patched.x, 2);
  assert.equal(patched.y, 3);
  assert.equal(patched.width, 8);
  assert.equal(patched.rotationDegrees, 90);
  assert.equal(patched.flipX, false);
});

test("snap lands on half-cell or whole-cell graph lines", () => {
  assert.equal(snapCellToGrid(2.24), 2);
  assert.equal(snapCellToGrid(2.26), 2.5);
  assert.equal(snapCellToGrid(2.74), 2.5);
  assert.equal(snapCellToGrid(2.76), 3);
});

test("rotation normalizes to fifteen-degree steps", () => {
  assert.equal(normalizeRotationDegrees(7), 0);
  assert.equal(normalizeRotationDegrees(8), 15);
  assert.equal(normalizeRotationDegrees(44), 45);
  assert.equal(normalizeRotationDegrees(-15), 345);
  assert.equal(normalizeRotationDegrees(450), 90);
});

test("source processing cache key changes only for relevant source fields", () => {
  const layout = { x: 1, y: 2, width: 8, height: 10 };
  const base = sourceProcessingCacheKey(source(), layout);
  const renamed = sourceProcessingCacheKey(source({ name: "Renamed" }), layout);
  const moved = sourceProcessingCacheKey(source(), { ...layout, x: 1.5 });
  const recolored = sourceProcessingCacheKey(source({ sourceFillThreshold: 0.7 }), layout);

  assert.equal(renamed, base);
  assert.notEqual(moved, base);
  assert.notEqual(recolored, base);
});
