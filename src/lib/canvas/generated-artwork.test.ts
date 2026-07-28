import assert from "node:assert/strict";
import test from "node:test";
import type { GraphShapeDrawing } from "../types.ts";
import { generatedShapeFillColorAtPoint } from "./generated-artwork.ts";

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
