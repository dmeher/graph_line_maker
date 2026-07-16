import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BACKGROUND_TOLERANCE,
  MAX_BACKGROUND_TOLERANCE,
  MAX_ERASE_POINTS_PER_LAYER,
  MAX_ERASE_STROKES_PER_LAYER,
  backgroundRemovalSignature,
  eraseStrokesSignature,
  normalizeBackgroundRemoval,
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

test("normalizeEraseStrokes rounds points and drops empty strokes", () => {
  const strokes = normalizeEraseStrokes([
    { points: [{ x: 1.4, y: 2.6 }, { x: 3, y: 4 }], radius: 8 },
    { points: [], radius: 5 },
    { notPoints: true },
  ]);
  assert.equal(strokes.length, 1);
  assert.deepEqual(strokes[0].points, [{ x: 1, y: 3 }, { x: 3, y: 4 }]);
  assert.equal(strokes[0].radius, 8);
});

test("normalizeEraseStrokes enforces the per-layer point budget", () => {
  const big = Array.from({ length: MAX_ERASE_STROKES_PER_LAYER + 20 }, () => ({
    points: Array.from({ length: 300 }, (_unused, index) => ({ x: index, y: index })),
    radius: 4,
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
  const a = eraseStrokesSignature([{ points: [{ x: 1, y: 1 }], radius: 4 }]);
  const b = eraseStrokesSignature([{ points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], radius: 4 }]);
  assert.notEqual(a, b);
  assert.equal(backgroundRemovalSignature(undefined), "0");
  assert.notEqual(backgroundRemovalSignature({ enabled: true, tolerance: 0.1 }), backgroundRemovalSignature({ enabled: true, tolerance: 0.2 }));
});
