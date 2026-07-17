import assert from "node:assert/strict";
import test from "node:test";
import {
  copyFillRegionOverrides,
  createStableFillRegionId,
  isStoredFillRegionId,
  migrateLegacyFillRegionOverrides,
} from "./fill-region-identity.ts";
import { GRAPH_MAJOR_CELL_PIXELS } from "../graph-paper.ts";

const layerId = "source:lion";

test("stored fill override keys accept legacy and scoped artwork regions only", () => {
  assert.equal(isStoredFillRegionId("17"), true);
  assert.equal(isStoredFillRegionId("source:lion-7:enclosed:552:1475"), true);
  assert.equal(isStoredFillRegionId("clipart:flower-1:source:0:2048"), true);
  assert.equal(isStoredFillRegionId("source:lion:enclosed:2049:0"), false);
  assert.equal(isStoredFillRegionId("source:lion:screen:10:20"), false);
  assert.equal(isStoredFillRegionId("not-a-fill-region"), false);
});

function pointForArtworkPosition(
  placement: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotationDegrees: number;
    flipX: boolean;
    flipY: boolean;
  },
  u: number,
  v: number,
) {
  const drawWidth = placement.width * GRAPH_MAJOR_CELL_PIXELS;
  const drawHeight = placement.height * GRAPH_MAJOR_CELL_PIXELS;
  const sideways = placement.rotationDegrees === 90 || placement.rotationDegrees === 270;
  const fittedWidth = sideways ? drawHeight : drawWidth;
  const fittedHeight = sideways ? drawWidth : drawHeight;
  const localX = (u - 0.5) * fittedWidth * (placement.flipX ? -1 : 1);
  const localY = (v - 0.5) * fittedHeight * (placement.flipY ? -1 : 1);
  const radians = (placement.rotationDegrees * Math.PI) / 180;
  return {
    centerX: (placement.x + placement.width / 2) * GRAPH_MAJOR_CELL_PIXELS + localX * Math.cos(radians) - localY * Math.sin(radians),
    centerY: (placement.y + placement.height / 2) * GRAPH_MAJOR_CELL_PIXELS + localX * Math.sin(radians) + localY * Math.cos(radians),
  };
}

test("stable fill IDs follow a region across position, rotation, and mirrors", () => {
  const positions = [
    { x: 2, y: 3, width: 5, height: 8, rotationDegrees: 0, flipX: false, flipY: false },
    { x: 7, y: 4, width: 5, height: 8, rotationDegrees: 90, flipX: false, flipY: false },
    { x: 1, y: 9, width: 5, height: 8, rotationDegrees: 180, flipX: true, flipY: false },
    { x: 4, y: 2, width: 5, height: 8, rotationDegrees: 270, flipX: true, flipY: true },
  ];
  const ids = positions.map((placement) => {
    const point = pointForArtworkPosition(placement, 0.27, 0.72);
    return createStableFillRegionId({ layerId, kind: "enclosed", placement, ...point });
  });

  assert.deepEqual(new Set(ids).size, 1);
});

test("legacy numeric fill overrides promote to the matching layer-scoped region", () => {
  const migrated = migrateLegacyFillRegionOverrides(
    { "4": "#b0b0b0" },
    [{ id: "source:lion:enclosed:10:20", legacyId: "4" }],
  );

  assert.deepEqual(migrated, { "source:lion:enclosed:10:20": "#b0b0b0" });
});

test("duplicating a layer copies only its scoped fill overrides", () => {
  const copied = copyFillRegionOverrides(
    {
      "source:lion:enclosed:10:20": "#000000",
      "source:flower:enclosed:10:20": "#b0b0b0",
    },
    [{ from: "source:lion", to: "source:lion-copy" }],
  );

  assert.deepEqual(copied, {
    "source:lion:enclosed:10:20": "#000000",
    "source:lion-copy:enclosed:10:20": "#000000",
    "source:flower:enclosed:10:20": "#b0b0b0",
  });
});
