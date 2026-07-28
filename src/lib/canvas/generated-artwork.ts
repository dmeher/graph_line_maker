import { GRAPH_MAJOR_CELL_PIXELS, isTransparentFillColor } from "../graph-paper.ts";
import { normalizeRotationDegrees } from "../editor/source-layout.ts";
import type { GraphShapeDrawing } from "../types.ts";

const GEOMETRY_EPSILON = 1e-9;

type Point = {
  x: number;
  y: number;
};

type ClosedShapeGeometry = {
  kind: Exclude<GraphShapeDrawing["kind"], "line" | "arrow">;
  left: number;
  top: number;
  width: number;
  height: number;
};

function inverseShapeTransform(
  shape: GraphShapeDrawing,
  pixelX: number,
  pixelY: number,
  cellPixels: number,
): Point {
  const x = shape.x * cellPixels;
  const y = shape.y * cellPixels;
  const width = shape.width * cellPixels;
  const height = shape.height * cellPixels;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const radians = (normalizeRotationDegrees(shape.rotationDegrees) * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const deltaX = pixelX - centerX;
  const deltaY = pixelY - centerY;

  // Canvas renders T(center) * R(rotation) * S(flips) * T(-center).
  // Undo rotation first, then the self-inverse horizontal/vertical mirrors.
  const rotatedX = deltaX * cosine + deltaY * sine;
  const rotatedY = -deltaX * sine + deltaY * cosine;

  return {
    x: centerX + (shape.flipX ? -rotatedX : rotatedX),
    y: centerY + (shape.flipY ? -rotatedY : rotatedY),
  };
}

function closedShapeGeometry(shape: GraphShapeDrawing, cellPixels: number): ClosedShapeGeometry | null {
  if (shape.kind === "line" || shape.kind === "arrow") return null;

  const x = shape.x * cellPixels;
  const y = shape.y * cellPixels;
  const rawWidth = shape.width * cellPixels;
  const rawHeight = shape.height * cellPixels;
  if (![x, y, rawWidth, rawHeight].every(Number.isFinite)) return null;

  const rectangleWidth = Math.max(1, Math.abs(rawWidth));
  const rectangleHeight = Math.max(1, Math.abs(rawHeight));
  const squareSize = Math.max(rectangleWidth, rectangleHeight);

  return {
    kind: shape.kind,
    left: Math.min(x, x + rawWidth),
    top: Math.min(y, y + rawHeight),
    width: shape.kind === "square" || shape.kind === "circle" ? squareSize : rectangleWidth,
    height: shape.kind === "square" || shape.kind === "circle" ? squareSize : rectangleHeight,
  };
}

function pointIsInsideClosedShape(point: Point, geometry: ClosedShapeGeometry) {
  const { kind, left, top, width, height } = geometry;

  if (kind === "square" || kind === "rectangle") {
    return (
      point.x >= left - GEOMETRY_EPSILON &&
      point.x <= left + width + GEOMETRY_EPSILON &&
      point.y >= top - GEOMETRY_EPSILON &&
      point.y <= top + height + GEOMETRY_EPSILON
    );
  }

  const centerX = left + width / 2;
  const centerY = kind === "half-circle" ? top + height : top + height / 2;
  const radiusX = width / 2;
  const radiusY = kind === "half-circle" ? height : height / 2;
  const normalizedX = (point.x - centerX) / radiusX;
  const normalizedY = (point.y - centerY) / radiusY;
  const insideEllipse =
    normalizedX * normalizedX + normalizedY * normalizedY <= 1 + GEOMETRY_EPSILON;

  if (kind === "half-circle") {
    return insideEllipse && point.y <= centerY + GEOMETRY_EPSILON;
  }

  return insideEllipse;
}

/**
 * Returns the fill of the topmost generated closed shape at an output pixel.
 * Geometry intentionally mirrors the generated-shape pass in `processor.ts`:
 * open paths and transparent fills do not provide an initial region color.
 */
export function generatedShapeFillColorAtPoint(
  shapes: readonly GraphShapeDrawing[],
  pixelX: number,
  pixelY: number,
  cellPixels = GRAPH_MAJOR_CELL_PIXELS,
): string | null {
  if (
    !Number.isFinite(pixelX) ||
    !Number.isFinite(pixelY) ||
    !Number.isFinite(cellPixels) ||
    cellPixels <= 0
  ) {
    return null;
  }

  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    const shape = shapes[index];
    if (
      shape.visible === false ||
      shape.kind === "line" ||
      shape.kind === "arrow" ||
      isTransparentFillColor(shape.fillColor)
    ) {
      continue;
    }

    const geometry = closedShapeGeometry(shape, cellPixels);
    if (!geometry) continue;
    const localPoint = inverseShapeTransform(shape, pixelX, pixelY, cellPixels);
    if (pointIsInsideClosedShape(localPoint, geometry)) return shape.fillColor;
  }

  return null;
}
