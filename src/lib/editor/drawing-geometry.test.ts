import assert from "node:assert/strict";
import test from "node:test";
import {
  alignLineEndpointToCellAxis,
  GENERATED_OPEN_PATH_SELECTION_BUFFER_CM,
  hasIntentionalDrag,
  LINE_AXIS_ALIGNMENT_TOLERANCE_DEGREES,
  measureGeneratedOpenPathHit,
  oneCellBoundsAtGraphPoint,
  pointHitsGeneratedOpenPath,
} from "./drawing-geometry.ts";
import type { GraphShapeDrawing } from "../types.ts";

function pointAtAngle(degrees: number, length = 10) {
  const radians = degrees * (Math.PI / 180);
  return {
    x: Math.cos(radians) * length,
    y: Math.sin(radians) * length,
  };
}

function openShape(overrides: Partial<GraphShapeDrawing> = {}): GraphShapeDrawing {
  return {
    id: "shape-1",
    name: "Line",
    kind: "line",
    x: 0,
    y: 2,
    width: 4,
    height: 0,
    strokeColor: "#000000",
    fillColor: "transparent",
    strokeWidth: 4,
    strokeStyle: "solid",
    sides: [],
    locked: false,
    visible: true,
    rotationDegrees: 0,
    flipX: false,
    flipY: false,
    groupId: null,
    ...overrides,
  };
}

test("intentional drag requires movement greater than three pixels", () => {
  assert.equal(hasIntentionalDrag({ x: 12, y: 18 }, { x: 12, y: 18 }), false);
  assert.equal(hasIntentionalDrag({ x: 0, y: 0 }, { x: 3, y: 0 }), false);
  assert.equal(hasIntentionalDrag({ x: 0, y: 0 }, { x: 3.0001, y: 0 }), true);
  assert.equal(hasIntentionalDrag({ x: 0, y: 0 }, { x: 2.2, y: 2.2 }), true);
  assert.equal(hasIntentionalDrag({ x: 0, y: 0 }, { x: Number.NaN, y: 4 }), false);
});

test("line alignment snaps inclusively within five degrees of horizontal", () => {
  const start = { x: 4, y: 7 };

  for (const degrees of [-5, -4.999, 4.999, 5]) {
    const offset = pointAtAngle(degrees);
    const end = { x: start.x + offset.x, y: start.y + offset.y };
    assert.deepEqual(
      alignLineEndpointToCellAxis(start, end),
      { x: end.x, y: start.y },
      `${degrees} degrees should align horizontally`,
    );
  }

  for (const degrees of [5.001, -5.001]) {
    const offset = pointAtAngle(degrees);
    const end = { x: start.x + offset.x, y: start.y + offset.y };
    assert.deepEqual(alignLineEndpointToCellAxis(start, end), end);
  }
});

test("line alignment snaps inclusively within five degrees of vertical", () => {
  const start = { x: 8, y: 3 };

  for (const degrees of [85, 85.001, 94.999, 95]) {
    const offset = pointAtAngle(degrees);
    const end = { x: start.x + offset.x, y: start.y + offset.y };
    assert.deepEqual(
      alignLineEndpointToCellAxis(start, end),
      { x: start.x, y: end.y },
      `${degrees} degrees should align vertically`,
    );
  }

  for (const degrees of [84.999, 95.001]) {
    const offset = pointAtAngle(degrees);
    const end = { x: start.x + offset.x, y: start.y + offset.y };
    assert.deepEqual(alignLineEndpointToCellAxis(start, end), end);
  }
});

test("line alignment preserves diagonals and supports reverse directions", () => {
  const start = { x: 0, y: 0 };
  const diagonal = pointAtAngle(45);
  assert.deepEqual(alignLineEndpointToCellAxis(start, diagonal), diagonal);

  for (const degrees of [175, -175]) {
    const end = pointAtAngle(degrees);
    assert.deepEqual(
      alignLineEndpointToCellAxis(start, end),
      { x: end.x, y: 0 },
      `${degrees} degrees should align horizontally without changing direction`,
    );
  }
});

test("line alignment bypass preserves the exact endpoint", () => {
  const start = { x: 2, y: 3 };
  const offset = pointAtAngle(LINE_AXIS_ALIGNMENT_TOLERANCE_DEGREES - 1);
  const end = { x: start.x + offset.x, y: start.y + offset.y };

  assert.deepEqual(alignLineEndpointToCellAxis(start, end, { bypass: true }), end);
  assert.deepEqual(alignLineEndpointToCellAxis(start, start), start);
});

test("one-cell bounds use the containing graph cell", () => {
  assert.deepEqual(
    oneCellBoundsAtGraphPoint({ x: 2.8, y: 7.1 }, { width: 10, height: 12 }),
    { x: 2, y: 7, width: 1, height: 1 },
  );
  assert.deepEqual(
    oneCellBoundsAtGraphPoint({ x: 9.999, y: 11.999 }, { width: 10, height: 12 }),
    { x: 9, y: 11, width: 1, height: 1 },
  );
});

test("one-cell bounds reject points outside the graph", () => {
  const graph = { width: 10, height: 12 };
  assert.equal(oneCellBoundsAtGraphPoint({ x: -0.001, y: 4 }, graph), null);
  assert.equal(oneCellBoundsAtGraphPoint({ x: 4, y: -0.001 }, graph), null);
  assert.equal(oneCellBoundsAtGraphPoint({ x: 10, y: 4 }, graph), null);
  assert.equal(oneCellBoundsAtGraphPoint({ x: 4, y: 12 }, graph), null);
  assert.equal(oneCellBoundsAtGraphPoint({ x: Number.NaN, y: 4 }, graph), null);
  assert.equal(oneCellBoundsAtGraphPoint({ x: 4, y: 4 }, { width: 0, height: 12 }), null);
});

test("open-path selection adds a physical 0.2 cm buffer outside the visual stroke", () => {
  const shape = openShape();
  const halfStrokeCells = shape.strokeWidth / 2 / 40;
  const maximumDistance =
    GENERATED_OPEN_PATH_SELECTION_BUFFER_CM + halfStrokeCells;

  assert.equal(
    pointHitsGeneratedOpenPath(
      shape,
      { x: 2, y: 2 + maximumDistance },
      { cellSizeCm: 1 },
    ),
    true,
  );
  assert.equal(
    pointHitsGeneratedOpenPath(
      shape,
      { x: 2, y: 2 + maximumDistance + 0.001 },
      { cellSizeCm: 1 },
    ),
    false,
  );
});

test("open-path buffer converts physical centimetres through the graph cell size", () => {
  const shape = openShape({ strokeWidth: 1 });

  assert.equal(
    pointHitsGeneratedOpenPath(shape, { x: 2, y: 2.41 }, { cellSizeCm: 0.5 }),
    true,
  );
  assert.equal(
    pointHitsGeneratedOpenPath(shape, { x: 2, y: 2.42 }, { cellSizeCm: 0.5 }),
    false,
  );
});

test("open-path hit measurement exposes distance for nearest-overlap selection", () => {
  const first = measureGeneratedOpenPathHit(
    openShape({ id: "first", y: 2 }),
    { x: 2, y: 2.12 },
    { cellSizeCm: 1 },
  );
  const second = measureGeneratedOpenPathHit(
    openShape({ id: "second", y: 2.3 }),
    { x: 2, y: 2.12 },
    { cellSizeCm: 1 },
  );

  assert.ok(first);
  assert.ok(second);
  assert.ok(first.centerlineDistanceCells < second.centerlineDistanceCells);
  assert.ok(Math.abs(first.visibleDistanceCells - 0.07) < 1e-12);
  assert.ok(Math.abs(first.visibleDistanceCm - 0.07) < 1e-12);
});

test("signed endpoints, rotation, and flips mirror the canvas transform", () => {
  const signed = openShape({ x: 5, y: 4, width: -3, height: -2 });
  assert.equal(
    pointHitsGeneratedOpenPath(signed, { x: 3.5, y: 3 }, { cellSizeCm: 1, bufferCm: 0 }),
    true,
  );

  const rotated = openShape({ x: 1, y: 1, width: 4, height: 0, rotationDegrees: 90 });
  assert.equal(
    pointHitsGeneratedOpenPath(rotated, { x: 3, y: 0 }, { cellSizeCm: 1, bufferCm: 0 }),
    true,
  );
  assert.equal(
    pointHitsGeneratedOpenPath(rotated, { x: 1, y: 1 }, { cellSizeCm: 1, bufferCm: 0 }),
    false,
  );

  const flipped = openShape({ x: 1, y: 1, width: 3, height: 2, flipX: true, flipY: true });
  assert.equal(
    pointHitsGeneratedOpenPath(flipped, { x: 2.5, y: 2 }, { cellSizeCm: 1, bufferCm: 0 }),
    true,
  );
});

test("dashed and dotted lines keep one continuous vector selection path", () => {
  const dashed = openShape({ y: 0, strokeWidth: 1, strokeStyle: "dashed" });
  const dotted = openShape({ y: 0, strokeWidth: 1, strokeStyle: "dotted" });
  const options = { cellSizeCm: 1, bufferCm: 0 };

  assert.equal(pointHitsGeneratedOpenPath(dashed, { x: 0.05, y: 0 }, options), true);
  assert.equal(pointHitsGeneratedOpenPath(dashed, { x: 0.1375, y: 0 }, options), true);
  assert.equal(pointHitsGeneratedOpenPath(dotted, { x: 0.0125, y: 0 }, options), true);
  assert.equal(pointHitsGeneratedOpenPath(dotted, { x: 0.0625, y: 0 }, options), true);
});

test("arrowheads are selectable after the same rotation and flip transform", () => {
  const arrow = openShape({
    kind: "arrow",
    y: 0,
    strokeWidth: 4,
    flipX: true,
  });
  const line = openShape({
    y: 0,
    strokeWidth: 4,
    flipX: true,
  });
  const arrowheadPoint = { x: 0.1732, y: 0.1 };
  const options = { cellSizeCm: 1, bufferCm: 0 };

  assert.equal(pointHitsGeneratedOpenPath(arrow, arrowheadPoint, options), true);
  assert.equal(pointHitsGeneratedOpenPath(line, arrowheadPoint, options), false);
});

test("open-path hit testing rejects hidden, closed, degenerate-input, and distant shapes", () => {
  const point = { x: 2, y: 2 };
  const options = { cellSizeCm: 1 };

  assert.equal(pointHitsGeneratedOpenPath(openShape({ visible: false }), point, options), false);
  assert.equal(pointHitsGeneratedOpenPath(openShape({ kind: "rectangle" }), point, options), false);
  assert.equal(pointHitsGeneratedOpenPath(openShape(), point, { cellSizeCm: 0 }), false);
  assert.equal(pointHitsGeneratedOpenPath(openShape(), { x: Number.NaN, y: 2 }, options), false);
  assert.equal(pointHitsGeneratedOpenPath(openShape(), { x: 2, y: 3 }, options), false);
});
