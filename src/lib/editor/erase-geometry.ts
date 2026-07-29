/**
 * Pure geometry for the image-line eraser. Maps between graph-output-pixel space
 * and a source image's own pixel space, inverting the placement transform used
 * by the processor (`placeSourceImageData`): translate to the placed-box centre,
 * rotate, then flip, drawing the image's content bounds into the fitted box.
 */

export type PlacementTransform = {
  /** Placed-box position/size in graph OUTPUT PIXELS. */
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
  rotationDegrees: number;
  flipX: boolean;
  flipY: boolean;
};

export type ContentBounds = { x: number; y: number; width: number; height: number };

function normalizeRotation(rotationDegrees: number) {
  return ((rotationDegrees % 360) + 360) % 360;
}

function fittedBox(placement: PlacementTransform) {
  const rotation = normalizeRotation(placement.rotationDegrees);
  const rotatedSideways = rotation === 90 || rotation === 270;
  return {
    rotation,
    fittedWidth: rotatedSideways ? placement.drawHeight : placement.drawWidth,
    fittedHeight: rotatedSideways ? placement.drawWidth : placement.drawHeight,
    centerX: placement.drawX + placement.drawWidth / 2,
    centerY: placement.drawY + placement.drawHeight / 2,
  };
}

/** Maps a graph-output-pixel point to a pixel in the source canvas. */
export function graphPixelToSourcePixel(
  gx: number,
  gy: number,
  placement: PlacementTransform,
  bounds: ContentBounds,
): { x: number; y: number } {
  const { rotation, fittedWidth, fittedHeight, centerX, centerY } = fittedBox(placement);
  const rx = gx - centerX;
  const ry = gy - centerY;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Inverse rotation R(-θ) applied to the centred point.
  const ux = rx * cos + ry * sin;
  const uy = -rx * sin + ry * cos;
  // Inverse flip (scale of ±1).
  const lx = placement.flipX ? -ux : ux;
  const ly = placement.flipY ? -uy : uy;
  const cu = fittedWidth ? lx / fittedWidth + 0.5 : 0.5;
  const cv = fittedHeight ? ly / fittedHeight + 0.5 : 0.5;
  return {
    x: bounds.x + cu * bounds.width,
    y: bounds.y + cv * bounds.height,
  };
}

/** Whether a graph-output pixel lands inside the transformed source-content frame. */
export function isGraphPixelWithinPlacedContent(
  gx: number,
  gy: number,
  placement: PlacementTransform,
  bounds: ContentBounds,
  edgeTolerance = 0,
) {
  const point = graphPixelToSourcePixel(gx, gy, placement, bounds);
  return (
    point.x >= bounds.x - edgeTolerance
    && point.x <= bounds.x + bounds.width + edgeTolerance
    && point.y >= bounds.y - edgeTolerance
    && point.y <= bounds.y + bounds.height + edgeTolerance
  );
}

/**
 * Converts the editor's graph-output-pixel brush radius into the source-local
 * radius that a persisted erase stroke needs. `GraphEraseStroke.radius` is
 * normalized against source-canvas width, so the source x-axis is the stable
 * reference axis for this conversion. Normal source placement preserves the
 * artwork aspect ratio, making the horizontal and vertical scales the same.
 */
export function sourcePixelRadiusForGraphBrush(
  graphRadius: number,
  placement: PlacementTransform,
  bounds: ContentBounds,
) {
  const { fittedWidth } = fittedBox(placement);
  const sourcePixels = Math.max(0, graphRadius);
  const graphPixelsPerSourcePixel = Math.abs(fittedWidth) / Math.max(1e-6, bounds.width);
  return sourcePixels / Math.max(1e-6, graphPixelsPerSourcePixel);
}

/**
 * Whether a graph-space erase brush touches the transformed content frame.
 *
 * The editor owns brush size in graph output pixels, so a 16px brush remains
 * a 16px footprint regardless of a source image's intrinsic resolution. Each
 * target converts that radius to its source-local working-canvas coordinates
 * before hit testing and persisting the non-destructive stroke.
 */
export function graphBrushIntersectsPlacedContent(
  gx: number,
  gy: number,
  graphRadius: number,
  shape: "circle" | "square",
  placement: PlacementTransform,
  bounds: ContentBounds,
) {
  const point = graphPixelToSourcePixel(gx, gy, placement, bounds);
  const brushRadius = sourcePixelRadiusForGraphBrush(graphRadius, placement, bounds);
  const left = bounds.x;
  const top = bounds.y;
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;

  if (shape === "square") {
    return (
      point.x + brushRadius >= left
      && point.x - brushRadius <= right
      && point.y + brushRadius >= top
      && point.y - brushRadius <= bottom
    );
  }

  const nearestX = Math.min(right, Math.max(left, point.x));
  const nearestY = Math.min(bottom, Math.max(top, point.y));
  return Math.hypot(point.x - nearestX, point.y - nearestY) <= brushRadius;
}

type Point = { x: number; y: number };

function pointInBounds(point: Point, bounds: ContentBounds, edgeTolerance = 0) {
  return (
    point.x >= bounds.x - edgeTolerance
    && point.x <= bounds.x + bounds.width + edgeTolerance
    && point.y >= bounds.y - edgeTolerance
    && point.y <= bounds.y + bounds.height + edgeTolerance
  );
}

function pointOnSegment(point: Point, start: Point, end: Point) {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > 1e-7) return false;
  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  if (dot < -1e-7) return false;
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  return dot <= lengthSquared + 1e-7;
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const start = polygon[previous];
    const end = polygon[index];
    if (pointOnSegment(point, start, end)) return true;
    const crosses = (start.y > point.y) !== (end.y > point.y);
    if (crosses && point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x) {
      inside = !inside;
    }
  }
  return inside;
}

function orientation(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  const epsilon = 1e-7;

  if (Math.abs(first) <= epsilon && pointOnSegment(c, a, b)) return true;
  if (Math.abs(second) <= epsilon && pointOnSegment(d, a, b)) return true;
  if (Math.abs(third) <= epsilon && pointOnSegment(a, c, d)) return true;
  if (Math.abs(fourth) <= epsilon && pointOnSegment(b, c, d)) return true;
  return (first > 0) !== (second > 0) && (third > 0) !== (fourth > 0);
}

/**
 * Tests a graph-space lasso against a transformed source-content frame. This
 * deliberately permits lasso vertices outside an image: enclosing or crossing
 * its frame is still a valid destructive selection.
 */
export function graphPolygonIntersectsPlacedContent(
  graphPoints: Point[],
  placement: PlacementTransform,
  bounds: ContentBounds,
  edgeTolerance = 0,
) {
  if (graphPoints.length < 3) return false;
  const polygon = graphPoints.map((point) => graphPixelToSourcePixel(point.x, point.y, placement, bounds));
  if (polygon.some((point) => pointInBounds(point, bounds, edgeTolerance))) return true;

  const left = bounds.x - edgeTolerance;
  const top = bounds.y - edgeTolerance;
  const right = bounds.x + bounds.width + edgeTolerance;
  const bottom = bounds.y + bounds.height + edgeTolerance;
  const rectangle = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
  if (rectangle.some((corner) => pointInPolygon(corner, polygon))) return true;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    for (let edge = 0; edge < rectangle.length; edge += 1) {
      if (segmentsIntersect(start, end, rectangle[edge], rectangle[(edge + 1) % rectangle.length])) return true;
    }
  }
  return false;
}

function clipPolygonAgainstVerticalEdge(points: Point[], x: number, keepGreater: boolean) {
  const output: Point[] = [];
  if (!points.length) return output;
  const isInside = (point: Point) => (keepGreater ? point.x >= x : point.x <= x);
  const intersect = (start: Point, end: Point) => {
    const deltaX = end.x - start.x;
    if (Math.abs(deltaX) <= 1e-9) return { x, y: start.y };
    const ratio = (x - start.x) / deltaX;
    return { x, y: start.y + (end.y - start.y) * ratio };
  };

  let previous = points.at(-1)!;
  let previousInside = isInside(previous);
  for (const point of points) {
    const inside = isInside(point);
    if (inside !== previousInside) output.push(intersect(previous, point));
    if (inside) output.push(point);
    previous = point;
    previousInside = inside;
  }
  return output;
}

function clipPolygonAgainstHorizontalEdge(points: Point[], y: number, keepGreater: boolean) {
  const output: Point[] = [];
  if (!points.length) return output;
  const isInside = (point: Point) => (keepGreater ? point.y >= y : point.y <= y);
  const intersect = (start: Point, end: Point) => {
    const deltaY = end.y - start.y;
    if (Math.abs(deltaY) <= 1e-9) return { x: start.x, y };
    const ratio = (y - start.y) / deltaY;
    return { x: start.x + (end.x - start.x) * ratio, y };
  };

  let previous = points.at(-1)!;
  let previousInside = isInside(previous);
  for (const point of points) {
    const inside = isInside(point);
    if (inside !== previousInside) output.push(intersect(previous, point));
    if (inside) output.push(point);
    previous = point;
    previousInside = inside;
  }
  return output;
}

/**
 * Clips a graph-space lasso to a source's own content bounds and returns that
 * source-local polygon. A single lasso can therefore be committed to every
 * intersected image without storing out-of-range UV coordinates for the
 * smaller or partially covered images.
 */
export function clipGraphPolygonToPlacedContent(
  graphPoints: Point[],
  placement: PlacementTransform,
  bounds: ContentBounds,
) {
  let polygon = graphPoints.map((point) => graphPixelToSourcePixel(point.x, point.y, placement, bounds));
  polygon = clipPolygonAgainstVerticalEdge(polygon, bounds.x, true);
  polygon = clipPolygonAgainstVerticalEdge(polygon, bounds.x + bounds.width, false);
  polygon = clipPolygonAgainstHorizontalEdge(polygon, bounds.y, true);
  polygon = clipPolygonAgainstHorizontalEdge(polygon, bounds.y + bounds.height, false);
  return polygon;
}

/** Forward transform (source pixel -> graph output pixel); primarily for tests/round-trips. */
export function sourcePixelToGraphPixel(
  sx: number,
  sy: number,
  placement: PlacementTransform,
  bounds: ContentBounds,
): { x: number; y: number } {
  const { rotation, fittedWidth, fittedHeight, centerX, centerY } = fittedBox(placement);
  const cu = bounds.width ? (sx - bounds.x) / bounds.width : 0.5;
  const cv = bounds.height ? (sy - bounds.y) / bounds.height : 0.5;
  const lx = (cu - 0.5) * fittedWidth;
  const ly = (cv - 0.5) * fittedHeight;
  const fx = placement.flipX ? -lx : lx;
  const fy = placement.flipY ? -ly : ly;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = fx * cos - fy * sin;
  const ry = fx * sin + fy * cos;
  return { x: rx + centerX, y: ry + centerY };
}
