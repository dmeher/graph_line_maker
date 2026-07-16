import assert from "node:assert/strict";
import test from "node:test";
import { graphPixelToSourcePixel, sourcePixelToGraphPixel, type ContentBounds, type PlacementTransform } from "./erase-geometry.ts";

const bounds: ContentBounds = { x: 10, y: 20, width: 100, height: 80 };

function roundTrip(placement: PlacementTransform) {
  for (const [sx, sy] of [
    [10, 20],
    [110, 100],
    [60, 60],
    [35, 90],
  ] as const) {
    const graph = sourcePixelToGraphPixel(sx, sy, placement, bounds);
    const back = graphPixelToSourcePixel(graph.x, graph.y, placement, bounds);
    assert.ok(Math.abs(back.x - sx) < 1e-6, `x round-trip (${sx},${sy}) -> ${back.x}`);
    assert.ok(Math.abs(back.y - sy) < 1e-6, `y round-trip (${sx},${sy}) -> ${back.y}`);
  }
}

test("identity placement round-trips source<->graph pixels", () => {
  roundTrip({ drawX: 0, drawY: 0, drawWidth: 200, drawHeight: 160, rotationDegrees: 0, flipX: false, flipY: false });
});

test("offset + scaled placement round-trips", () => {
  roundTrip({ drawX: 320, drawY: 120, drawWidth: 400, drawHeight: 320, rotationDegrees: 0, flipX: false, flipY: false });
});

test("flipped placement round-trips", () => {
  roundTrip({ drawX: 40, drawY: 60, drawWidth: 200, drawHeight: 160, rotationDegrees: 0, flipX: true, flipY: true });
});

test("quarter-turn rotation round-trips", () => {
  roundTrip({ drawX: 40, drawY: 60, drawWidth: 200, drawHeight: 160, rotationDegrees: 90, flipX: false, flipY: false });
  roundTrip({ drawX: 40, drawY: 60, drawWidth: 200, drawHeight: 160, rotationDegrees: 270, flipX: true, flipY: false });
});

test("box center maps to the content-bounds center", () => {
  const placement: PlacementTransform = { drawX: 100, drawY: 50, drawWidth: 200, drawHeight: 160, rotationDegrees: 0, flipX: false, flipY: false };
  const point = graphPixelToSourcePixel(100 + 100, 50 + 80, placement, bounds);
  assert.ok(Math.abs(point.x - (bounds.x + bounds.width / 2)) < 1e-6);
  assert.ok(Math.abs(point.y - (bounds.y + bounds.height / 2)) < 1e-6);
});
