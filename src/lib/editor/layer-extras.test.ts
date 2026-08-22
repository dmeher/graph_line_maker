import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BACKGROUND_TOLERANCE,
  MAX_BACKGROUND_TOLERANCE,
  MAX_ERASE_POINTS_PER_LAYER,
  MAX_ERASE_STROKES_PER_LAYER,
  MAX_POLYGON_UV_OVERSHOOT,
  backgroundRemovalSignature,
  eraseStrokesSignature,
  normalizeBackgroundRemoval,
  normalizeEraseBrushPoint,
  normalizeEraseStrokes,
  normalizeGroupId,
  normalizeLayerGroups,
} from "./layer-extras.ts";

test("normalizeGroupId trims, bounds, and nullifies blanks", () => {
  assert.equal(normalizeGroupId("  group-1  "), "group-1");
  assert.equal(normalizeGroupId(""), null);
  assert.equal(normalizeGroupId(null), null);
  assert.equal(normalizeGroupId(123), null);
  assert.equal(normalizeGroupId("x".repeat(200))?.length, 80);
});

test("normalizeEraseStrokes keeps normalized coords and drops empty strokes", () => {
  const strokes = normalizeEraseStrokes([
    { points: [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 1 }], radius: 0.02 },
    { points: [], radius: 0.02 },
    { notPoints: true },
  ]);
  assert.equal(strokes.length, 1);
  assert.deepEqual(strokes[0].points, [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 1 }]);
  assert.equal(strokes[0].radius, 0.02);
});

test("normalizeEraseStrokes drops legacy pixel-space strokes instead of clamping them", () => {
  const strokes = normalizeEraseStrokes([
    { points: [{ x: 140, y: 260 }, { x: 300, y: 400 }], radius: 12 },
    { points: [{ x: 0.1, y: 0.2 }], radius: 0.03 },
  ]);
  assert.equal(strokes.length, 1);
  assert.deepEqual(strokes[0].points, [{ x: 0.1, y: 0.2 }]);
});

test("normalizeEraseStrokes enforces the per-layer point budget", () => {
  const big = Array.from({ length: MAX_ERASE_STROKES_PER_LAYER + 20 }, () => ({
    points: Array.from({ length: 300 }, (_unused, index) => ({ x: (index % 100) / 100, y: (index % 100) / 100 })),
    radius: 0.01,
  }));
  const strokes = normalizeEraseStrokes(big);
  assert.ok(strokes.length <= MAX_ERASE_STROKES_PER_LAYER);
  const totalPoints = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
  assert.ok(totalPoints <= MAX_ERASE_POINTS_PER_LAYER);
});

test("normalizeBackgroundRemoval only returns config when enabled", () => {
  assert.equal(normalizeBackgroundRemoval(undefined), undefined);
  assert.equal(normalizeBackgroundRemoval({ enabled: false, tolerance: 0.2 }), undefined);
  const config = normalizeBackgroundRemoval({ enabled: true, tolerance: 5 });
  assert.equal(config?.enabled, true);
  assert.equal(config?.tolerance, MAX_BACKGROUND_TOLERANCE);
  const clampedLow = normalizeBackgroundRemoval({ enabled: true, tolerance: -1 });
  assert.ok((clampedLow?.tolerance ?? 0) > 0);
  const defaulted = normalizeBackgroundRemoval({ enabled: true });
  assert.equal(defaulted?.tolerance, DEFAULT_BACKGROUND_TOLERANCE);
});

test("normalizeLayerGroups dedupes ids and bounds names", () => {
  const groups = normalizeLayerGroups([
    { id: "a", name: "Group A" },
    { id: "a", name: "duplicate" },
    { id: "b", name: "" },
    { notAGroup: true },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].id, "a");
  assert.equal(groups[1].name, "Group");
});

test("signatures change when erase/background state changes", () => {
  assert.equal(eraseStrokesSignature(undefined), "0");
  const a = eraseStrokesSignature([{ points: [{ x: 0.1, y: 0.1 }], radius: 0.02 }]);
  const b = eraseStrokesSignature([{ points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }], radius: 0.02 }]);
  const c = eraseStrokesSignature([{ points: [{ x: 0.1, y: 0.1 }, { x: 0.2001, y: 0.2 }], radius: 0.02 }]);
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.equal(backgroundRemovalSignature(undefined), "0");
  assert.notEqual(backgroundRemovalSignature({ enabled: true, tolerance: 0.1 }), backgroundRemovalSignature({ enabled: true, tolerance: 0.2 }));
});

test("normalizeEraseBrushPoint bounds and rounds one transient brush sample", () => {
  assert.deepEqual(normalizeEraseBrushPoint({ x: 0.123456, y: 0.654321 }), { x: 0.1235, y: 0.6543 });
  assert.deepEqual(normalizeEraseBrushPoint({ x: -4, y: 8 }), { x: -0.001, y: 1.001 });
});

test("the erase signature includes each normalized stroke point and configuration", () => {
  const base = [
    { points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }], radius: 0.02, shape: "circle" as const },
    { points: [{ x: 0.7, y: 0.7 }], radius: 0.03, shape: "square" as const },
  ];
  const changedInteriorPoint = [
    { ...base[0], points: [{ x: 0.2, y: 0.1 }, { x: 0.3, y: 0.3 }] },
    base[1],
  ];
  const changedEarlierRadius = [{ ...base[0], radius: 0.04 }, base[1]];
  const changedEarlierShape = [{ ...base[0], shape: "square" as const }, base[1]];
  const polygon = [
    { points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.4 }], radius: 0.01, shape: "polygon" as const },
    base[1],
  ];
  const filledPolygon = [{ ...polygon[0], fill: "#000000" as const }, base[1]];

  const signature = eraseStrokesSignature(base);
  assert.notEqual(signature, eraseStrokesSignature(changedInteriorPoint));
  assert.notEqual(signature, eraseStrokesSignature(changedEarlierRadius));
  assert.notEqual(signature, eraseStrokesSignature(changedEarlierShape));
  assert.notEqual(eraseStrokesSignature(polygon), eraseStrokesSignature(filledPolygon));
});

test("erase strokes carry a brush shape, defaulting to circle", () => {
  const [circle, square, legacy, bogus] = normalizeEraseStrokes([
    { points: [{ x: 0.1, y: 0.1 }], radius: 0.02, shape: "circle" },
    { points: [{ x: 0.2, y: 0.2 }], radius: 0.02, shape: "square" },
    // Saved before the square brush existed — must stay a circle.
    { points: [{ x: 0.3, y: 0.3 }], radius: 0.02 },
    { points: [{ x: 0.4, y: 0.4 }], radius: 0.02, shape: "triangle" },
  ]);

  assert.equal(circle.shape, "circle");
  assert.equal(square.shape, "square");
  assert.equal(legacy.shape, "circle");
  assert.equal(bogus.shape, "circle");
});

test("the erase signature changes with brush shape", () => {
  // Switching shape changes which pixels are erased, so a cached processed
  // layer must not survive the change.
  const points = [{ x: 0.5, y: 0.5 }];
  const circle = eraseStrokesSignature(normalizeEraseStrokes([{ points, radius: 0.02, shape: "circle" }]));
  const square = eraseStrokesSignature(normalizeEraseStrokes([{ points, radius: 0.02, shape: "square" }]));

  assert.notEqual(circle, square);
});

test("polygon regions need three vertices and may carry a fill", () => {
  const strokes = normalizeEraseStrokes([
    // A closed region: three vertices is the minimum that encloses area.
    { points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.4 }], radius: 0.02, shape: "polygon" },
    // Two vertices enclose nothing, so this is dropped rather than stored.
    { points: [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.6 }], radius: 0.02, shape: "polygon" },
    { points: [{ x: 0.1, y: 0.5 }, { x: 0.4, y: 0.5 }, { x: 0.4, y: 0.8 }], radius: 0.02, shape: "polygon", fill: "#ffffff" },
    { points: [{ x: 0.1, y: 0.6 }, { x: 0.4, y: 0.6 }, { x: 0.4, y: 0.9 }], radius: 0.02, shape: "polygon", fill: "#ff0000" },
  ]);

  assert.equal(strokes.length, 3);
  assert.equal(strokes[0].shape, "polygon");
  assert.equal(strokes[0].fill, undefined, "no fill means erase to transparent");
  assert.equal(strokes[1].fill, "#ffffff");
  // Only the canvas colour policy's values are accepted.
  assert.equal(strokes[2].fill, undefined);
});

test("fill is ignored on brush strokes, which always erase", () => {
  const [stroke] = normalizeEraseStrokes([
    { points: [{ x: 0.2, y: 0.2 }], radius: 0.02, shape: "circle", fill: "#000000" },
  ]);

  assert.equal(stroke.shape, "circle");
  assert.equal(stroke.fill, undefined);
});

test("the erase signature distinguishes erase from fill", () => {
  const points = [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.4 }];
  const erased = eraseStrokesSignature(normalizeEraseStrokes([{ points, radius: 0.02, shape: "polygon" }]));
  const filled = eraseStrokesSignature(normalizeEraseStrokes([{ points, radius: 0.02, shape: "polygon", fill: "#000000" }]));

  assert.notEqual(erased, filled);
});

test("lasso vertices may sit outside the image, brush points may not", () => {
  // A region traced across the graph legitimately overshoots the layer. Canvas
  // fill() clips it, so the vertices are kept unclamped to preserve the shape.
  const [region] = normalizeEraseStrokes([
    { points: [{ x: -0.5, y: 0.2 }, { x: 1.6, y: 0.2 }, { x: 1.6, y: 1.4 }], radius: 0.01, shape: "polygon" },
  ]);
  assert.equal(region.points[0].x, -0.5);
  assert.equal(region.points[1].x, 1.6);
  assert.equal(region.points[2].y, 1.4);

  // Brush strokes are painted inside the image; out-of-range values there mean
  // a legacy pixel-space draft and are still dropped.
  assert.equal(normalizeEraseStrokes([{ points: [{ x: 1.6, y: 0.2 }], radius: 0.02, shape: "circle" }]).length, 0);
});

test("wildly out-of-range coordinates are still rejected as corrupt", () => {
  // Pixel-space drafts (values in the hundreds) must not be mistaken for a
  // region that merely overshoots the image.
  const strokes = normalizeEraseStrokes([
    { points: [{ x: 300, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 300 }], radius: 0.01, shape: "polygon" },
  ]);
  assert.equal(strokes.length, 0);
});

test("a single out-of-bound vertex discards the whole region", () => {
  // This is why the editor must range-check a lasso before committing it. On a
  // tall multi-image graph, resolving the region against the wrong layer put
  // vertices many image-heights away; the region then vanished here with no
  // signal, which is what made the lasso look like it silently did nothing.
  const justInside = normalizeEraseStrokes([
    { points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.5, y: 1 + MAX_POLYGON_UV_OVERSHOOT }], radius: 0.01, shape: "polygon" },
  ]);
  assert.equal(justInside.length, 1, "the bound itself is still accepted");

  const justOutside = normalizeEraseStrokes([
    { points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.5, y: 1 + MAX_POLYGON_UV_OVERSHOOT + 0.001 }], radius: 0.01, shape: "polygon" },
  ]);
  assert.equal(justOutside.length, 0, "one bad vertex drops every other vertex with it");
});
