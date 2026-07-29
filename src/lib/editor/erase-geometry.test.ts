import assert from "node:assert/strict";
import test from "node:test";
import {
  clipGraphPolygonToPlacedContent,
  graphBrushIntersectsPlacedContent,
  graphPixelToSourcePixel,
  graphPolygonIntersectsPlacedContent,
  isGraphPixelWithinPlacedContent,
  sourcePixelRadiusForGraphBrush,
  sourcePixelToGraphPixel,
  type ContentBounds,
  type PlacementTransform,
} from "./erase-geometry.ts";

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

test("destructive edits retain the pristine transformed frame when edge ink changes bounds", () => {
  const pristineBounds: ContentBounds = { x: 10, y: 20, width: 100, height: 80 };
  // Simulates an erase stroke removing ink from the top/left edges of the
  // working canvas. Rendering must still use pristineBounds for placement.
  const postEraseMeasuredBounds: ContentBounds = { x: 32, y: 37, width: 68, height: 54 };
  const placement: PlacementTransform = {
    drawX: 320,
    drawY: 120,
    drawWidth: 420,
    drawHeight: 250,
    rotationDegrees: 270,
    flipX: true,
    flipY: true,
  };
  const originalSourcePoint = { x: 25, y: 75 };
  const graphPoint = sourcePixelToGraphPixel(
    originalSourcePoint.x,
    originalSourcePoint.y,
    placement,
    pristineBounds,
  );

  const stableRoundTrip = graphPixelToSourcePixel(graphPoint.x, graphPoint.y, placement, pristineBounds);
  const shiftedRoundTrip = graphPixelToSourcePixel(graphPoint.x, graphPoint.y, placement, postEraseMeasuredBounds);

  assert.ok(Math.abs(stableRoundTrip.x - originalSourcePoint.x) < 1e-6);
  assert.ok(Math.abs(stableRoundTrip.y - originalSourcePoint.y) < 1e-6);
  assert.ok(
    Math.abs(shiftedRoundTrip.x - originalSourcePoint.x) > 1 || Math.abs(shiftedRoundTrip.y - originalSourcePoint.y) > 1,
    "using a post-erase content box would remap the same graph pixel to a different source pixel",
  );
});

test("precise destructive hit testing respects rotation, offsets, and flips", () => {
  const fortyFiveDegreePlacement: PlacementTransform = {
    drawX: 100,
    drawY: 100,
    drawWidth: 200,
    drawHeight: 120,
    rotationDegrees: 45,
    flipX: false,
    flipY: false,
  };
  const oldAxisAlignedCorner = { x: 100, y: 100 };
  assert.ok(
    oldAxisAlignedCorner.x >= fortyFiveDegreePlacement.drawX
      && oldAxisAlignedCorner.x <= fortyFiveDegreePlacement.drawX + fortyFiveDegreePlacement.drawWidth
      && oldAxisAlignedCorner.y >= fortyFiveDegreePlacement.drawY
      && oldAxisAlignedCorner.y <= fortyFiveDegreePlacement.drawY + fortyFiveDegreePlacement.drawHeight,
  );
  assert.equal(
    isGraphPixelWithinPlacedContent(
      oldAxisAlignedCorner.x,
      oldAxisAlignedCorner.y,
      fortyFiveDegreePlacement,
      bounds,
    ),
    false,
    "a corner inside the legacy layout rectangle is outside the rotated artwork frame",
  );

  const offsetQuarterTurnPlacement: PlacementTransform = {
    drawX: 360,
    drawY: 210,
    drawWidth: 240,
    drawHeight: 160,
    rotationDegrees: 90,
    flipX: true,
    flipY: false,
  };
  const insideGraphPoint = sourcePixelToGraphPixel(70, 60, offsetQuarterTurnPlacement, bounds);
  assert.equal(
    isGraphPixelWithinPlacedContent(
      insideGraphPoint.x,
      insideGraphPoint.y,
      offsetQuarterTurnPlacement,
      bounds,
    ),
    true,
  );
});

test("lasso hit testing accepts enclosure or crossing with all vertices outside the image", () => {
  const placement: PlacementTransform = {
    drawX: 100,
    drawY: 100,
    drawWidth: 200,
    drawHeight: 120,
    rotationDegrees: 0,
    flipX: false,
    flipY: false,
  };
  const enclosingLasso = [
    { x: 60, y: 60 },
    { x: 340, y: 60 },
    { x: 340, y: 260 },
    { x: 60, y: 260 },
  ];
  const crossingLasso = [
    { x: 60, y: 145 },
    { x: 340, y: 145 },
    { x: 340, y: 175 },
    { x: 60, y: 175 },
  ];
  const distantLasso = [
    { x: 500, y: 500 },
    { x: 580, y: 500 },
    { x: 580, y: 580 },
    { x: 500, y: 580 },
  ];

  for (const point of [...enclosingLasso, ...crossingLasso]) {
    assert.equal(isGraphPixelWithinPlacedContent(point.x, point.y, placement, bounds), false);
  }
  assert.equal(graphPolygonIntersectsPlacedContent(enclosingLasso, placement, bounds), true);
  assert.equal(graphPolygonIntersectsPlacedContent(crossingLasso, placement, bounds), true);
  assert.equal(graphPolygonIntersectsPlacedContent(distantLasso, placement, bounds), false);
});

test("brush hit testing includes every transformed image touched by the footprint", () => {
  const placement: PlacementTransform = {
    drawX: 100,
    drawY: 80,
    drawWidth: 200,
    drawHeight: 160,
    rotationDegrees: 90,
    flipX: true,
    flipY: false,
  };
  const justOutsideLeft = sourcePixelToGraphPixel(bounds.x - 3, bounds.y + bounds.height / 2, placement, bounds);
  const farOutsideLeft = sourcePixelToGraphPixel(bounds.x - 7, bounds.y + bounds.height / 2, placement, bounds);

  assert.equal(
    graphBrushIntersectsPlacedContent(justOutsideLeft.x, justOutsideLeft.y, 7, "circle", placement, bounds),
    true,
    "a circular brush reaching across an artwork edge should include that image",
  );
  assert.equal(
    graphBrushIntersectsPlacedContent(farOutsideLeft.x, farOutsideLeft.y, 7, "circle", placement, bounds),
    false,
  );
  assert.equal(
    graphBrushIntersectsPlacedContent(farOutsideLeft.x, farOutsideLeft.y, 16, "square", placement, bounds),
    true,
    "a square brush converts its graph-space footprint after rotation and flip",
  );
});

test("one graph-space brush size converts consistently for low- and high-resolution sources", () => {
  const lowResolutionBounds: ContentBounds = { x: 10, y: 20, width: 100, height: 80 };
  const highResolutionBounds: ContentBounds = { x: 100, y: 200, width: 1000, height: 800 };
  const placement: PlacementTransform = {
    drawX: 200,
    drawY: 150,
    drawWidth: 200,
    drawHeight: 160,
    rotationDegrees: 0,
    flipX: false,
    flipY: false,
  };
  const graphRadius = 16;
  const lowSourceRadius = sourcePixelRadiusForGraphBrush(graphRadius, placement, lowResolutionBounds);
  const highSourceRadius = sourcePixelRadiusForGraphBrush(graphRadius, placement, highResolutionBounds);

  assert.equal(lowSourceRadius, 8);
  assert.equal(highSourceRadius, 80);

  for (const [contentBounds, sourceRadius] of [
    [lowResolutionBounds, lowSourceRadius],
    [highResolutionBounds, highSourceRadius],
  ] as const) {
    const nearEdge = sourcePixelToGraphPixel(
      contentBounds.x - sourceRadius * 0.75,
      contentBounds.y + contentBounds.height / 2,
      placement,
      contentBounds,
    );
    const outside = sourcePixelToGraphPixel(
      contentBounds.x - sourceRadius * 1.25,
      contentBounds.y + contentBounds.height / 2,
      placement,
      contentBounds,
    );
    assert.equal(
      graphBrushIntersectsPlacedContent(nearEdge.x, nearEdge.y, graphRadius, "circle", placement, contentBounds),
      true,
    );
    assert.equal(
      graphBrushIntersectsPlacedContent(outside.x, outside.y, graphRadius, "circle", placement, contentBounds),
      false,
    );
  }
});

test("lasso polygons clip independently to each intersected content frame", () => {
  const placement: PlacementTransform = {
    drawX: 100,
    drawY: 50,
    drawWidth: 200,
    drawHeight: 160,
    rotationDegrees: 0,
    flipX: false,
    flipY: false,
  };
  const largeLasso = [
    { x: 40, y: 10 },
    { x: 360, y: 10 },
    { x: 360, y: 280 },
    { x: 40, y: 280 },
  ];
  const clipped = clipGraphPolygonToPlacedContent(largeLasso, placement, bounds);

  assert.ok(clipped.length >= 3);
  for (const point of clipped) {
    assert.ok(point.x >= bounds.x - 1e-6 && point.x <= bounds.x + bounds.width + 1e-6);
    assert.ok(point.y >= bounds.y - 1e-6 && point.y <= bounds.y + bounds.height + 1e-6);
  }
  assert.equal(graphPolygonIntersectsPlacedContent(largeLasso, placement, bounds), true);
});
