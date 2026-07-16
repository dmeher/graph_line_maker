import assert from "node:assert/strict";
import test from "node:test";
import { preprocessImageDataForGraph } from "./image-preprocessing.ts";
import { mergeLayerPixelMasks } from "./layer-mask-merge.ts";
import type { GraphSettings } from "../types.ts";

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

test("layer merging preserves vector outline coverage and clears it below top fills", () => {
  const fillRegionMap = new Uint16Array([0, 0]);
  const outlineMask = new Uint8Array([0, 1]);
  const outlineCoverage = new Uint8Array([0, 192]);
  const localFillRegionMap = new Uint16Array([0, 2]);
  const layerOutlineMask = new Uint8Array([1, 0]);
  const layerOutlineCoverage = new Uint8Array([37, 0]);

  mergeLayerPixelMasks(
    fillRegionMap,
    outlineMask,
    localFillRegionMap,
    layerOutlineMask,
    new Map([[2, 9]]),
    undefined,
    0,
    outlineCoverage,
    layerOutlineCoverage,
  );

  assert.deepEqual(Array.from(fillRegionMap), [0, 9]);
  assert.deepEqual(Array.from(outlineMask), [1, 0]);
  assert.deepEqual(Array.from(outlineCoverage), [37, 0]);
});

test("image preprocessing applies color quantization without mutating input", () => {
  const imageData = {
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([
      30, 30, 30, 255,
      230, 230, 230, 255,
    ]),
  };
  const result = preprocessImageDataForGraph(imageData, {
    imageAutoEnhance: false,
    imageDenoiseLevel: "off",
    imageEdgeDetection: "standard",
    imageColorQuantization: 2,
  } as GraphSettings);

  assert.deepEqual(Array.from(result.data), [
    0, 0, 0, 255,
    255, 255, 255, 255,
  ]);
  assert.deepEqual(Array.from(imageData.data), [
    30, 30, 30, 255,
    230, 230, 230, 255,
  ]);
});
