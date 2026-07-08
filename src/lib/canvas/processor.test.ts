import assert from "node:assert/strict";
import test from "node:test";
import { mergeLayerPixelMasks } from "./layer-mask-merge.ts";

test("transparent pixels in a top layer preserve lower artwork", () => {
  const fillRegionMap = new Uint16Array([0, 3, 0, 4]);
  const outlineMask = new Uint8Array([1, 1, 0, 1]);
  const localFillRegionMap = new Uint16Array([0, 0, 0, 0]);
  const layerOutlineMask = new Uint8Array([0, 0, 1, 0]);

  mergeLayerPixelMasks(fillRegionMap, outlineMask, localFillRegionMap, layerOutlineMask, new Map());

  assert.deepEqual(Array.from(fillRegionMap), [0, 3, 0, 4]);
  assert.deepEqual(Array.from(outlineMask), [1, 1, 1, 1]);
});

test("top layer strokes replace lower fill at the same pixel", () => {
  const fillRegionMap = new Uint16Array([7]);
  const outlineMask = new Uint8Array([0]);
  const localFillRegionMap = new Uint16Array([0]);
  const layerOutlineMask = new Uint8Array([1]);

  mergeLayerPixelMasks(fillRegionMap, outlineMask, localFillRegionMap, layerOutlineMask, new Map());

  assert.deepEqual(Array.from(fillRegionMap), [0]);
  assert.deepEqual(Array.from(outlineMask), [1]);
});

test("top layer fill hides lower outline inside its filled area", () => {
  const fillRegionMap = new Uint16Array([0]);
  const outlineMask = new Uint8Array([1]);
  const localFillRegionMap = new Uint16Array([2]);
  const layerOutlineMask = new Uint8Array([0]);

  mergeLayerPixelMasks(fillRegionMap, outlineMask, localFillRegionMap, layerOutlineMask, new Map([[2, 9]]));

  assert.deepEqual(Array.from(fillRegionMap), [9]);
  assert.deepEqual(Array.from(outlineMask), [0]);
});
