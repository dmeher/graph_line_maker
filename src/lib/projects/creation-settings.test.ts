import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectSettingsWithSources } from "./creation-settings.ts";
import type { GraphSettings } from "../types.ts";

function creationSettingsFixture(): GraphSettings {
  return {
    graphWidth: 10,
    imageWidth: 8,
    imageHeight: 10,
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
    vectorizerSketchRemoval: 0,
    vectorizerFidelity: "exact",
    sourceImages: [],
  } as GraphSettings;
}

test("creation settings vectorize every finalized upload by default", () => {
  const settings = buildProjectSettingsWithSources(
    creationSettingsFixture(),
    [
      { id: "source-a", name: "A", path: "sources/a.png", thumbPath: null },
      { id: "source-b", name: "B", path: "sources/b.png", thumbPath: "sources/thumbs/b.webp" },
    ],
    { vectorizeSources: true },
  );

  assert.deepEqual(
    settings.sourceImages.map((source) => source.vectorize),
    [true, true],
  );
});

test("creation settings preserve the direct-raster import choice", () => {
  const settings = buildProjectSettingsWithSources(
    creationSettingsFixture(),
    [{ id: "source-a", name: "A", path: "sources/a.png", thumbPath: null }],
    { vectorizeSources: false },
  );

  assert.equal(settings.sourceImages[0]?.vectorize, false);
});
