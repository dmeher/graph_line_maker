import assert from "node:assert/strict";
import test from "node:test";
import { clampVectorizerLineAdjust, normalizeGraphImageTraceEngine } from "../graph-paper.ts";
import {
  applyUnlockedSourcePatch,
  flipLayerBoxInBounds,
  normalizeRotationDegrees,
  reorderSourceImages,
  rotateLayerBoxInBounds,
  scaleLayerBoxToBounds,
  sourceAssetCacheKey,
  snapCellToGrid,
  snapRectToLayerGuides,
  sourceLayouts,
  sourceProcessingCacheKey,
  sourceVectorizerCacheKey,
  sourceRenderOrder,
  sourcesUseVerticalStackSlots,
  stackEndCell,
  transformLayerOrientation,
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
    imageAutoEnhance: false,
    imageDenoiseLevel: "off",
    imageEdgeDetection: "standard",
    imageColorQuantization: "off",
    vectorizerLineAdjust: 0,
    vectorizerInkThreshold: 210,
    vectorizerFidelity: "exact",
    x: 1,
    y: 0,
    topPadding: 0,
    bottomPadding: 0,
    locked: false,
    visible: true,
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

test("source render order draws bottom-to-top from the visible layer list", () => {
  const first = source({ id: "first" });
  const second = source({ id: "second" });

  const layouts = sourceRenderOrder([first, second]);

  assert.deepEqual(layouts.map((layout) => layout.source.id), ["second", "first"]);
});

test("source reorder reflows auto-stacked source slots", () => {
  const first = source({ id: "first", y: 0, height: 10 });
  const second = source({ id: "second", y: 10, height: 12 });
  const third = source({ id: "third", y: 22, height: 8 });

  const reordered = reorderSourceImages([first, second, third], 1, 0);

  assert.equal(sourcesUseVerticalStackSlots([first, second, third]), true);
  assert.deepEqual(reordered.map((item) => item.id), ["second", "first", "third"]);
  assert.deepEqual(reordered.map((item) => item.y), [0, 12, 22]);
});

test("source reorder preserves free-positioned source geometry", () => {
  const first = source({ id: "first", y: 4, height: 10 });
  const second = source({ id: "second", y: 9, height: 12 });
  const third = source({ id: "third", y: 30, height: 8 });

  const reordered = reorderSourceImages([first, second, third], 1, 0);

  assert.equal(sourcesUseVerticalStackSlots([first, second, third]), false);
  assert.deepEqual(reordered.map((item) => item.id), ["second", "first", "third"]);
  assert.deepEqual(reordered.map((item) => item.y), [9, 4, 30]);
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

test("single-layer orientation transforms do not move or resize the layer", () => {
  const original = source({ x: 2.5, y: 4, width: 7, height: 11, rotationDegrees: 345 });
  const rotated = transformLayerOrientation(original, { type: "rotate", direction: 1 });
  const flippedX = transformLayerOrientation(rotated, { type: "flip", axis: "x" });
  const flippedY = transformLayerOrientation(flippedX, { type: "flip", axis: "y" });

  assert.equal(rotated.rotationDegrees, 0);
  assert.deepEqual(
    { x: rotated.x, y: rotated.y, width: rotated.width, height: rotated.height },
    { x: original.x, y: original.y, width: original.width, height: original.height },
  );
  assert.equal(flippedX.flipX, true);
  assert.equal(flippedX.flipY, false);
  assert.equal(flippedY.flipX, true);
  assert.equal(flippedY.flipY, true);
});

test("single-layer orientation transforms leave locked layers unchanged", () => {
  const original = source({ locked: true, rotationDegrees: 30, flipX: false, flipY: true });

  assert.equal(transformLayerOrientation(original, { type: "rotate", direction: 1 }), original);
  assert.equal(transformLayerOrientation(original, { type: "flip", axis: "x" }), original);
});

test("source processing cache key changes only for relevant source fields", () => {
  const layout = { x: 1, y: 2, width: 8, height: 10 };
  const base = sourceProcessingCacheKey(source(), layout);
  const renamed = sourceProcessingCacheKey(source({ name: "Renamed" }), layout);
  const moved = sourceProcessingCacheKey(source(), { ...layout, x: 1.5 });
  const recolored = sourceProcessingCacheKey(source({ sourceFillThreshold: 0.7 }), layout);
  const enhanced = sourceProcessingCacheKey(source({ imageAutoEnhance: true }), layout);
  const quantized = sourceProcessingCacheKey(source({ imageColorQuantization: 8 }), layout);
  const lineAdjusted = sourceProcessingCacheKey(source({ vectorizerLineAdjust: 0.5 }), layout);
  const thresholdChanged = sourceProcessingCacheKey(source({ vectorizerInkThreshold: 190 }), layout);
  const smoothed = sourceProcessingCacheKey(source({ vectorizerFidelity: "smooth" }), layout);
  const imageChanged = sourceProcessingCacheKey(source({ path: "sources/next.png" }), layout);

  assert.equal(renamed, base);
  assert.notEqual(moved, base);
  assert.notEqual(recolored, base);
  assert.notEqual(enhanced, base);
  assert.notEqual(quantized, base);
  assert.notEqual(lineAdjusted, base);
  assert.notEqual(thresholdChanged, base);
  assert.notEqual(smoothed, base);
  assert.notEqual(imageChanged, base);
});

test("native vectorizer cache key ignores graph placement but changes with source content", () => {
  const original = source({ id: "lion", path: "projects/lion.jpeg", url: "https://example.test/lion.jpeg" });
  const moved = source({ ...original, x: 4, y: 8, width: 12, height: 16, rotationDegrees: 90 });
  const duplicateLayer = source({ ...original, id: "lion-copy", url: "https://example.test/lion.jpeg?signature=next" });
  const replaced = source({ ...original, path: "projects/lion-v2.jpeg", url: "https://example.test/lion-v2.jpeg" });
  const erased = source({ ...original, eraseStrokes: [{ points: [{ x: 0.2, y: 0.3 }], radius: 0.02 }] });

  assert.equal(sourceVectorizerCacheKey(moved), sourceVectorizerCacheKey(original));
  assert.equal(sourceAssetCacheKey(duplicateLayer), sourceAssetCacheKey(original));
  assert.equal(sourceVectorizerCacheKey(duplicateLayer), sourceVectorizerCacheKey(original));
  assert.notEqual(sourceVectorizerCacheKey(replaced), sourceVectorizerCacheKey(original));
  assert.notEqual(sourceVectorizerCacheKey(erased), sourceVectorizerCacheKey(original));
});

test("vectorizer line adjustment clamps to half steps inside range", () => {
  assert.equal(clampVectorizerLineAdjust(0.24), 0);
  assert.equal(clampVectorizerLineAdjust(0.25), 0.5);
  assert.equal(clampVectorizerLineAdjust(-7.76), -8);
  assert.equal(clampVectorizerLineAdjust(16.4), 16);
});

test("legacy image trace engines normalize to vectorizer", () => {
  assert.equal(normalizeGraphImageTraceEngine("default"), "vectorizer");
  assert.equal(normalizeGraphImageTraceEngine("image-tracer"), "vectorizer");
  assert.equal(normalizeGraphImageTraceEngine("vectorizer"), "vectorizer");
});

test("snap rect aligns moving layer edges and centers to nearby layers", () => {
  const result = snapRectToLayerGuides(
    { id: "moving", x: 9.8, y: 1.1, width: 4, height: 4 },
    [{ id: "target", x: 14, y: 8, width: 6, height: 6 }],
    { threshold: 0.3, gridStep: 0.5 },
  );

  assert.equal(result.x, 10);
  assert.deepEqual(result.guides, [{ axis: "x", value: 14 }]);
});

test("selection scaling preserves each layer's relative position and size", () => {
  const scaled = scaleLayerBoxToBounds(
    { id: "second", x: 6, y: 4, width: 2, height: 3 },
    { x: 2, y: 2, width: 8, height: 6 },
    { x: 4, y: 3, width: 16, height: 3 },
  );

  assert.deepEqual(scaled, { id: "second", x: 12, y: 4, width: 4, height: 1.5 });
});

test("selection transforms rotate and flip layer boxes around the shared bounds", () => {
  const box = { id: "second", x: 4, y: 4, width: 2, height: 1 };
  const bounds = { x: 2, y: 3, width: 10, height: 4 };

  assert.deepEqual(flipLayerBoxInBounds(box, bounds, "x"), { id: "second", x: 8, y: 4, width: 2, height: 1 });
  assert.deepEqual(flipLayerBoxInBounds(box, bounds, "y"), { id: "second", x: 4, y: 5, width: 2, height: 1 });
  assert.deepEqual(rotateLayerBoxInBounds(box, bounds, 1), { id: "second", x: 7, y: 2, width: 1, height: 2 });
  assert.deepEqual(rotateLayerBoxInBounds(box, bounds, -1), { id: "second", x: 6, y: 6, width: 1, height: 2 });
});
