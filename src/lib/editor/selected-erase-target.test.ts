import assert from "node:assert/strict";
import test from "node:test";
import { selectedEraseTarget } from "./selected-erase-target.ts";
import type { GraphSourceImage } from "@/lib/types";

function source(overrides: Partial<GraphSourceImage> = {}): GraphSourceImage {
  return {
    id: "source-1",
    name: "Source",
    path: null,
    url: null,
    width: 8,
    height: 8,
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
    x: 0,
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

test("erase targets only one explicit unlocked source selection", () => {
  const target = source();
  const other = source({ id: "source-2" });

  assert.equal(selectedEraseTarget([target, other], "source-1", ["source:source-1"]), target);
  assert.equal(selectedEraseTarget([target, other], "source-1", []), null);
  assert.equal(selectedEraseTarget([target, other], "source-1", ["source:source-1", "source:source-2"]), null);
  assert.equal(selectedEraseTarget([target, other], "source-1", ["shape:shape-1"]), null);
});

test("hidden sources remain erasable, while locked or missing selections do not", () => {
  const target = source();

  const hidden = source({ visible: false });
  assert.equal(selectedEraseTarget([hidden], "source-1", ["source:source-1"]), hidden);
  assert.equal(selectedEraseTarget([source({ locked: true })], "source-1", ["source:source-1"]), null);
  assert.equal(selectedEraseTarget([target], "missing", ["source:missing"]), null);
});
