import assert from "node:assert/strict";
import test from "node:test";
import { preprocessImageDataForGraph } from "./image-preprocessing.ts";
import { fillRegionNumberForRender, mergeLayerPixelMasks } from "./layer-mask-merge.ts";
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

test("layer merging writes bounded local masks at their graph placement", () => {
  const fillRegionMap = new Uint16Array(12);
  const outlineMask = new Uint8Array(12);
  const localFillRegionMap = new Uint16Array([
    0, 4,
    0, 0,
  ]);
  const layerOutlineMask = new Uint8Array([
    1, 0,
    0, 1,
  ]);

  mergeLayerPixelMasks(
    fillRegionMap,
    outlineMask,
    localFillRegionMap,
    layerOutlineMask,
    new Map([[4, 9]]),
    undefined,
    0,
    undefined,
    undefined,
    { offsetX: 1, offsetY: 1, width: 2, destinationWidth: 4 },
  );

  assert.deepEqual(Array.from(fillRegionMap), [
    0, 0, 0, 0,
    0, 0, 9, 0,
    0, 0, 0, 0,
  ]);
  assert.deepEqual(Array.from(outlineMask), [
    0, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
  ]);
});

test("fractional vector outlines render over an adjacent fill without changing hit testing", () => {
  const fillRegionMap = new Uint16Array([
    0, 0, 0, 0,
    0, 7, 0, 0,
    0, 0, 0, 0,
  ]);
  const outlineMask = new Uint8Array([
    0, 0, 0, 0,
    0, 0, 1, 1,
    0, 0, 0, 0,
  ]);
  const outlineCoverage = new Uint8Array([
    0, 0, 0, 0,
    0, 0, 128, 128,
    0, 0, 0, 0,
  ]);

  assert.equal(fillRegionNumberForRender(fillRegionMap, outlineMask, outlineCoverage, 4, 3, 6), 7);
  // The next soft edge cannot borrow the first one: only real fill-map pixels
  // are candidates, so the render-only bridge never expands across a contour.
  assert.equal(fillRegionNumberForRender(fillRegionMap, outlineMask, outlineCoverage, 4, 3, 7), 0);

  outlineCoverage[6] = 255;
  assert.equal(fillRegionNumberForRender(fillRegionMap, outlineMask, outlineCoverage, 4, 3, 6), 0);
  assert.deepEqual(Array.from(fillRegionMap), [
    0, 0, 0, 0,
    0, 7, 0, 0,
    0, 0, 0, 0,
  ]);
});

test("a generated region's own sparse map still resolves the soft outline underlay", () => {
  // Generated topology is painted from a map holding only its own regions. It
  // has to run through the same underlay lookup as the imported pass, or the
  // fractional contour pixel beside the fill renders as bare paper — the white
  // hairline that appeared around every filled region.
  const generatedFillRegionMap = new Uint16Array([
    0, 0, 0, 0,
    0, 4, 0, 0,
    0, 0, 0, 0,
  ]);
  const outlineMask = new Uint8Array([
    0, 0, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 0,
  ]);
  const outlineCoverage = new Uint8Array([
    0, 0, 0, 0,
    0, 0, 40, 0,
    0, 0, 0, 0,
  ]);

  assert.equal(fillRegionNumberForRender(generatedFillRegionMap, outlineMask, outlineCoverage, 4, 3, 6), 4);
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

test("an overlapping layer keeps the smaller enclosure at a contested pixel", () => {
  // Region 9 is a wide enclosure already merged from a lower layer; region 4 is
  // a small pocket in the incoming layer that overlaps its first two pixels.
  const fillRegionMap = new Uint16Array([9, 9, 9, 9]);
  const outlineMask = new Uint8Array([0, 0, 0, 0]);
  const localFillRegionMap = new Uint16Array([2, 2, 0, 0]);
  const layerOutlineMask = new Uint8Array([0, 0, 0, 0]);

  mergeLayerPixelMasks(
    fillRegionMap,
    outlineMask,
    localFillRegionMap,
    layerOutlineMask,
    new Map([[2, 4]]),
    undefined,
    0,
    undefined,
    undefined,
    undefined,
    new Map([
      [9, 4],
      [4, 2],
    ]),
  );

  assert.deepEqual(Array.from(fillRegionMap), [4, 4, 9, 9]);
});

test("an overlapping layer cannot replace an even smaller enclosure", () => {
  const fillRegionMap = new Uint16Array([5, 5]);
  const outlineMask = new Uint8Array([0, 0]);
  const localFillRegionMap = new Uint16Array([2, 2]);
  const layerOutlineMask = new Uint8Array([0, 0]);

  mergeLayerPixelMasks(
    fillRegionMap,
    outlineMask,
    localFillRegionMap,
    layerOutlineMask,
    new Map([[2, 8]]),
    undefined,
    0,
    undefined,
    undefined,
    undefined,
    new Map([
      [5, 2],
      [8, 40],
    ]),
  );

  assert.deepEqual(Array.from(fillRegionMap), [5, 5]);
});

test("overlap resolution never lets a fill overwrite a lower outline pixel", () => {
  // Outline pixels carry region 0, so the area comparison must not apply.
  const fillRegionMap = new Uint16Array([0]);
  const outlineMask = new Uint8Array([1]);
  const localFillRegionMap = new Uint16Array([2]);
  const layerOutlineMask = new Uint8Array([0]);

  mergeLayerPixelMasks(
    fillRegionMap,
    outlineMask,
    localFillRegionMap,
    layerOutlineMask,
    new Map([[2, 9]]),
    undefined,
    0,
    undefined,
    undefined,
    undefined,
    new Map([[9, 4000]]),
  );

  assert.deepEqual(Array.from(fillRegionMap), [9]);
  assert.deepEqual(Array.from(outlineMask), [0]);
});
