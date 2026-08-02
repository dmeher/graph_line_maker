import assert from "node:assert/strict";
import test from "node:test";
import type { GraphShapeDrawing } from "../types.ts";
import { generatedShapeFillColorAtPoint, resolveGeneratedTopology } from "./generated-artwork.ts";

const CELL_PIXELS = 10;

function shape(
  overrides: Partial<GraphShapeDrawing> & Pick<GraphShapeDrawing, "kind">,
): GraphShapeDrawing {
  return {
    id: "shape",
    name: "Generated shape",
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    strokeColor: "#000000",
    fillColor: "#ffffff",
    strokeWidth: 2,
    sides: ["top", "right", "bottom", "left"],
    locked: false,
    visible: true,
    rotationDegrees: 0,
    flipX: false,
    flipY: false,
    ...overrides,
  };
}

test("transparent, invisible, and open generated shapes do not expose a fill", () => {
  const shapes = [
    shape({ kind: "rectangle", fillColor: "transparent" }),
    shape({ kind: "rectangle", fillColor: "#000000", visible: false }),
    shape({ kind: "line", fillColor: "#000000" }),
    shape({ kind: "arrow", fillColor: "#000000" }),
  ];

  assert.equal(generatedShapeFillColorAtPoint(shapes, 10, 10, CELL_PIXELS), null);
});

test("the later filled shape wins when generated artwork overlaps", () => {
  const shapes = [
    shape({ kind: "rectangle", id: "back", fillColor: "#ffffff" }),
    shape({ kind: "square", id: "front", fillColor: "#e6252a" }),
  ];

  assert.equal(
    generatedShapeFillColorAtPoint(shapes, 10, 10, CELL_PIXELS),
    "#e6252a",
  );
});

test("rectangle and ellipse fills follow their rendered path geometry", () => {
  const rectangle = shape({
    kind: "rectangle",
    x: 1,
    y: 2,
    width: 3,
    height: 2,
    fillColor: "#169b52",
  });
  const ellipse = shape({
    kind: "oval",
    x: 5,
    y: 1,
    width: 4,
    height: 2,
    fillColor: "#e6252a",
  });

  assert.equal(
    generatedShapeFillColorAtPoint([rectangle], 20, 30, CELL_PIXELS),
    "#169b52",
  );
  assert.equal(
    generatedShapeFillColorAtPoint([rectangle], 5, 30, CELL_PIXELS),
    null,
  );
  assert.equal(
    generatedShapeFillColorAtPoint([ellipse], 70, 20, CELL_PIXELS),
    "#e6252a",
  );
  assert.equal(
    generatedShapeFillColorAtPoint([ellipse], 51, 11, CELL_PIXELS),
    null,
  );
});

test("rotation is inverted before testing the generated shape path", () => {
  const rectangle = shape({
    kind: "rectangle",
    x: 1,
    y: 1,
    width: 4,
    height: 2,
    rotationDegrees: 90,
    fillColor: "#169b52",
  });

  // Pre-transform (45, 20) rotates around (30, 20) to screen point (30, 35).
  assert.equal(
    generatedShapeFillColorAtPoint([rectangle], 30, 35, CELL_PIXELS),
    "#169b52",
  );
  assert.equal(
    generatedShapeFillColorAtPoint([rectangle], 45, 20, CELL_PIXELS),
    null,
  );
});

test("a vertically flipped half-circle uses its mirrored filled half", () => {
  const halfCircle = shape({
    kind: "half-circle",
    width: 4,
    height: 2,
    flipY: true,
    fillColor: "#e6252a",
  });

  assert.equal(
    generatedShapeFillColorAtPoint([halfCircle], 5, 2, CELL_PIXELS),
    "#e6252a",
  );
  assert.equal(
    generatedShapeFillColorAtPoint([halfCircle], 5, 18, CELL_PIXELS),
    null,
  );
});

const GRID = 20;

function grid16() {
  return new Uint16Array(GRID * GRID);
}

function grid8() {
  return new Uint8Array(GRID * GRID);
}

/** Marks a half-open rectangle of the grid with `value`. */
function paint(
  target: Uint16Array | Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
  value = 1,
) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      target[row * GRID + column] = value;
    }
  }
}

function at(map: Uint16Array, x: number, y: number) {
  return map[y * GRID + x];
}

/** A 12x12 imported contour with its right wall missing between rows 5 and 14. */
function openContourInk() {
  const ink = grid8();
  paint(ink, 4, 4, 12, 1);
  paint(ink, 4, 15, 12, 1);
  paint(ink, 4, 4, 1, 12);
  return ink;
}

/** The same contour, closed, with its interior already labeled as one region. */
function closedContour() {
  const ink = openContourInk();
  paint(ink, 15, 4, 1, 12);
  const existingFillRegionMap = grid16();
  paint(existingFillRegionMap, 5, 5, 10, 10, 9);
  return { ink, existingFillRegionMap };
}

test("a line closing an open contour creates a fillable region", () => {
  const artworkInkMask = openContourInk();
  const existingFillRegionMap = grid16();
  const strokeMask = grid8();
  paint(strokeMask, 15, 4, 1, 12);

  const closed = resolveGeneratedTopology({
    strokeMask,
    artworkInkMask,
    existingFillRegionMap,
    width: GRID,
    height: GRID,
  });

  assert.equal(closed.regions.length, 1);
  assert.equal(at(closed.fillRegionMap, 10, 10), 1);
  // Outside the contour stays unenclosed.
  assert.equal(at(closed.fillRegionMap, 18, 18), 0);

  // Without the line the same artwork encloses nothing.
  const open = resolveGeneratedTopology({
    strokeMask: grid8(),
    artworkInkMask,
    existingFillRegionMap,
    width: GRID,
    height: GRID,
  });
  assert.deepEqual(open.regions, []);
});

test("a line that stops short of the artwork still closes the contour", () => {
  const artworkInkMask = openContourInk();
  const existingFillRegionMap = grid16();
  // Two pixels short of the contour at both ends.
  const strokeMask = grid8();
  paint(strokeMask, 15, 6, 1, 8);

  const closed = resolveGeneratedTopology({
    strokeMask,
    artworkInkMask,
    existingFillRegionMap,
    width: GRID,
    height: GRID,
  });
  assert.equal(closed.regions.length, 1);
  assert.equal(at(closed.fillRegionMap, 10, 10), 1);

  const withoutGapClosing = resolveGeneratedTopology({
    strokeMask,
    artworkInkMask,
    existingFillRegionMap,
    width: GRID,
    height: GRID,
    gapClosePixels: 0,
  });
  assert.deepEqual(withoutGapClosing.regions, []);
});

test("a line across an enclosure splits it into two fillable regions", () => {
  const { ink, existingFillRegionMap } = closedContour();
  const strokeMask = grid8();
  paint(strokeMask, 4, 10, 12, 1);

  const split = resolveGeneratedTopology({
    strokeMask,
    artworkInkMask: ink,
    existingFillRegionMap,
    width: GRID,
    height: GRID,
  });

  assert.equal(split.regions.length, 2);
  const above = at(split.fillRegionMap, 10, 6);
  const below = at(split.fillRegionMap, 10, 13);
  assert.ok(above);
  assert.ok(below);
  assert.notEqual(above, below);
  // The gap-closing margin is returned to the halves; only the painted stroke
  // stays out of both.
  assert.equal(at(split.fillRegionMap, 10, 9), above);
  assert.equal(at(split.fillRegionMap, 10, 11), below);
  assert.equal(at(split.fillRegionMap, 10, 10), 0);
});

test("a solid artwork region bounds a generated enclosure like ink does", () => {
  // The left wall is a solid source-fill region rather than outline ink.
  const artworkInkMask = grid8();
  paint(artworkInkMask, 4, 4, 12, 1);
  paint(artworkInkMask, 4, 15, 12, 1);
  const existingFillRegionMap = grid16();
  paint(existingFillRegionMap, 4, 4, 1, 12, 21);
  const strokeMask = grid8();
  paint(strokeMask, 15, 4, 1, 12);

  const resolution = resolveGeneratedTopology({
    strokeMask,
    artworkInkMask,
    existingFillRegionMap,
    artworkRegionNumbers: new Set([21]),
    width: GRID,
    height: GRID,
  });

  assert.equal(resolution.regions.length, 1);
  assert.equal(at(resolution.fillRegionMap, 10, 10), 1);
});

test("enclosures the strokes never reach keep their imported identity", () => {
  const { ink, existingFillRegionMap } = closedContour();
  // A stroke well outside the contour.
  const strokeMask = grid8();
  paint(strokeMask, 18, 0, 1, 3);

  const resolution = resolveGeneratedTopology({
    strokeMask,
    artworkInkMask: ink,
    existingFillRegionMap,
    width: GRID,
    height: GRID,
  });

  assert.deepEqual(resolution.regions, []);
  assert.equal(at(resolution.fillRegionMap, 10, 10), 0);
});

test("a stroke that only clips an enclosure leaves it with the imported layer", () => {
  const { ink, existingFillRegionMap } = closedContour();
  const strokeMask = grid8();
  paint(strokeMask, 6, 5, 1, 2);

  const resolution = resolveGeneratedTopology({
    strokeMask,
    artworkInkMask: ink,
    existingFillRegionMap,
    width: GRID,
    height: GRID,
  });

  assert.deepEqual(resolution.regions, []);
});
