import { GRAPH_MAJOR_CELL_PIXELS } from "../graph-paper.ts";
import type { GraphShapeDrawing } from "../types.ts";
import { normalizeRotationDegrees } from "./source-layout.ts";

export type DrawingPoint = Readonly<{
  x: number;
  y: number;
}>;

export type GraphCellBounds = Readonly<{
  x: number;
  y: number;
  width: 1;
  height: 1;
}>;

export type GraphDimensions = Readonly<{
  width: number;
  height: number;
}>;

export type LineAlignmentOptions = Readonly<{
  bypass?: boolean;
  toleranceDegrees?: number;
}>;

export const DRAWING_DRAG_THRESHOLD_PX = 3;
export const LINE_AXIS_ALIGNMENT_TOLERANCE_DEGREES = 5;
export const GENERATED_OPEN_PATH_SELECTION_BUFFER_CM = 0.2;

export type GeneratedOpenPathHitOptions = Readonly<{
  cellSizeCm: number;
  bufferCm?: number;
  cellPixels?: number;
}>;

export type GeneratedOpenPathHitResult = Readonly<{
  /** Distance to the closest rendered segment's centerline. */
  centerlineDistanceCells: number;
  /** Distance beyond the rendered stroke edge; zero means the point is on the stroke. */
  visibleDistanceCells: number;
  visibleDistanceCm: number;
  selectionBufferCells: number;
  maximumCenterlineDistanceCells: number;
}>;

function isFinitePoint(point: DrawingPoint) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

/**
 * Distinguishes a deliberate drag from a click or pointer jitter.
 * The threshold is exclusive: exactly three pixels remains a click.
 */
export function hasIntentionalDrag(
  start: DrawingPoint,
  end: DrawingPoint,
  thresholdPx = DRAWING_DRAG_THRESHOLD_PX,
) {
  if (!isFinitePoint(start) || !isFinitePoint(end)) return false;
  const safeThreshold = Number.isFinite(thresholdPx) ? Math.max(0, thresholdPx) : DRAWING_DRAG_THRESHOLD_PX;
  return Math.hypot(end.x - start.x, end.y - start.y) > safeThreshold;
}

/**
 * Snaps an endpoint to the nearest horizontal or vertical graph axis only when
 * its angle falls inside the configured buffer. Signed deltas are preserved so
 * leftward lines and arrow direction remain intact.
 */
export function alignLineEndpointToCellAxis(
  start: DrawingPoint,
  end: DrawingPoint,
  options: LineAlignmentOptions = {},
): DrawingPoint {
  if (options.bypass || !isFinitePoint(start) || !isFinitePoint(end)) return { ...end };

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  if (deltaX === 0 && deltaY === 0) return { ...end };

  const requestedTolerance = options.toleranceDegrees ?? LINE_AXIS_ALIGNMENT_TOLERANCE_DEGREES;
  const toleranceDegrees = Number.isFinite(requestedTolerance)
    ? Math.max(0, Math.min(45, requestedTolerance))
    : LINE_AXIS_ALIGNMENT_TOLERANCE_DEGREES;
  const angleFromHorizontal = Math.atan2(Math.abs(deltaY), Math.abs(deltaX)) * (180 / Math.PI);
  const comparisonEpsilon = 1e-10;

  if (angleFromHorizontal <= toleranceDegrees + comparisonEpsilon) {
    return { x: end.x, y: start.y };
  }
  if (90 - angleFromHorizontal <= toleranceDegrees + comparisonEpsilon) {
    return { x: start.x, y: end.y };
  }
  return { ...end };
}

/**
 * Resolves the single graph cell containing a pointer. Points on the outer
 * right or bottom boundary are outside the graph and therefore return null.
 */
export function oneCellBoundsAtGraphPoint(
  point: DrawingPoint,
  graph: GraphDimensions,
): GraphCellBounds | null {
  if (!isFinitePoint(point) || !Number.isFinite(graph.width) || !Number.isFinite(graph.height)) return null;

  const graphWidth = Math.floor(graph.width);
  const graphHeight = Math.floor(graph.height);
  if (
    graphWidth <= 0 ||
    graphHeight <= 0 ||
    point.x < 0 ||
    point.y < 0 ||
    point.x >= graphWidth ||
    point.y >= graphHeight
  ) {
    return null;
  }

  return {
    x: Math.floor(point.x),
    y: Math.floor(point.y),
    width: 1,
    height: 1,
  };
}

function inverseGeneratedShapeTransform(
  shape: GraphShapeDrawing,
  point: DrawingPoint,
): DrawingPoint {
  const centerX = shape.x + shape.width / 2;
  const centerY = shape.y + shape.height / 2;
  const radians = (normalizeRotationDegrees(shape.rotationDegrees) * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const deltaX = point.x - centerX;
  const deltaY = point.y - centerY;
  const rotatedX = deltaX * cosine + deltaY * sine;
  const rotatedY = -deltaX * sine + deltaY * cosine;

  return {
    x: centerX + (shape.flipX ? -rotatedX : rotatedX),
    y: centerY + (shape.flipY ? -rotatedY : rotatedY),
  };
}

function pointToSegmentDistance(
  point: DrawingPoint,
  start: DrawingPoint,
  end: DrawingPoint,
) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared <= Number.EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + projection * deltaX),
    point.y - (start.y + projection * deltaY),
  );
}

function renderedStrokeWidthPixels(shape: GraphShapeDrawing) {
  // Keep this equivalent to the generated-shape canvas pass.
  return Math.max(1, Math.min(24, Number(shape.strokeWidth) || 3));
}

function openPathBodySegments(
  shape: GraphShapeDrawing,
) {
  const start = { x: shape.x, y: shape.y };
  const end = { x: shape.x + shape.width, y: shape.y + shape.height };
  // A dashed or dotted line remains one selectable vector object. Treat its
  // conceptual shaft as continuous so a click in a visual dash gap still
  // selects the line instead of falling through to a broad image below it.
  return [{ start, end }];
}

function openPathArrowheadSegments(
  shape: GraphShapeDrawing,
  strokeWidthPixels: number,
  cellPixels: number,
) {
  if (shape.kind !== "arrow") return [];

  const angle = Math.atan2(shape.height, shape.width);
  const headLength = Math.max(10, strokeWidthPixels * 4) / cellPixels;
  const end = {
    x: shape.x + shape.width,
    y: shape.y + shape.height,
  };

  return [-Math.PI / 6, Math.PI / 6].map((offset) => ({
    start: end,
    end: {
      x: end.x - headLength * Math.cos(angle + offset),
      y: end.y - headLength * Math.sin(angle + offset),
    },
  }));
}

/**
 * Measures a selectable generated Line/Arrow in graph-cell coordinates.
 *
 * The rendered stroke width is included before applying the physical 0.2 cm
 * interaction buffer. A result is returned only when the point is inside that
 * combined hit area; callers can compare `centerlineDistanceCells` to choose
 * the nearest shape when buffered hit areas overlap.
 */
export function measureGeneratedOpenPathHit(
  shape: GraphShapeDrawing,
  point: DrawingPoint,
  options: GeneratedOpenPathHitOptions,
): GeneratedOpenPathHitResult | null {
  if (
    shape.visible === false ||
    (shape.kind !== "line" && shape.kind !== "arrow") ||
    !isFinitePoint(point) ||
    ![shape.x, shape.y, shape.width, shape.height].every(Number.isFinite) ||
    !Number.isFinite(options.cellSizeCm) ||
    options.cellSizeCm <= 0
  ) {
    return null;
  }

  const requestedCellPixels = options.cellPixels ?? GRAPH_MAJOR_CELL_PIXELS;
  const cellPixels =
    Number.isFinite(requestedCellPixels) && requestedCellPixels > 0
      ? requestedCellPixels
      : GRAPH_MAJOR_CELL_PIXELS;
  const requestedBufferCm =
    options.bufferCm ?? GENERATED_OPEN_PATH_SELECTION_BUFFER_CM;
  const bufferCm = Number.isFinite(requestedBufferCm)
    ? Math.max(0, requestedBufferCm)
    : GENERATED_OPEN_PATH_SELECTION_BUFFER_CM;
  const strokeWidthPixels = renderedStrokeWidthPixels(shape);
  const halfStrokeWidthCells = strokeWidthPixels / (2 * cellPixels);
  const selectionBufferCells = bufferCm / options.cellSizeCm;
  const maximumCenterlineDistanceCells = halfStrokeWidthCells + selectionBufferCells;
  const localPoint = inverseGeneratedShapeTransform(shape, point);
  const segments = [
    ...openPathBodySegments(shape),
    ...openPathArrowheadSegments(shape, strokeWidthPixels, cellPixels),
  ];
  const centerlineDistanceCells = segments.reduce(
    (closest, segment) =>
      Math.min(closest, pointToSegmentDistance(localPoint, segment.start, segment.end)),
    Number.POSITIVE_INFINITY,
  );

  if (centerlineDistanceCells > maximumCenterlineDistanceCells + Number.EPSILON) return null;

  const visibleDistanceCells = Math.max(0, centerlineDistanceCells - halfStrokeWidthCells);
  return {
    centerlineDistanceCells,
    visibleDistanceCells,
    visibleDistanceCm: visibleDistanceCells * options.cellSizeCm,
    selectionBufferCells,
    maximumCenterlineDistanceCells,
  };
}

export function pointHitsGeneratedOpenPath(
  shape: GraphShapeDrawing,
  point: DrawingPoint,
  options: GeneratedOpenPathHitOptions,
) {
  return measureGeneratedOpenPathHit(shape, point, options) !== null;
}
