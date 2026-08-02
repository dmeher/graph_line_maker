import { GRAPH_MAJOR_CELL_PIXELS, isTransparentFillColor } from "../graph-paper.ts";
import { normalizeRotationDegrees } from "../editor/source-layout.ts";
import { createEnclosedRegionMask, dilateMask } from "./thinning.ts";
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

/**
 * Graph pixels a generated stroke is grown by when it acts as a fill barrier.
 *
 * A line drawn to close an open contour reads as connected to the user well
 * before it overlaps the artwork's ink pixel for pixel, and a barrier that
 * leaks by a single pixel silently produces no fillable region at all. Only the
 * barrier is grown — the painted stroke keeps its own width, and the pixels the
 * margin took are handed back to the enclosures beside it.
 */
export const GENERATED_STROKE_GAP_CLOSE_PIXELS = 2;

/**
 * A recomputed region counts as an existing region that merely lost a few
 * pixels to a stroke — rather than a new region — when one existing region
 * accounts for this much of it and this much of that region survived into it.
 * Below either ratio the strokes changed the topology (a split, a merge, or a
 * newly closed contour) and the area becomes generated-artwork topology.
 */
const UNCHANGED_REGION_COVERAGE_RATIO = 0.9;
const UNCHANGED_REGION_SURVIVAL_RATIO = 0.9;

export type GeneratedTopologyRegion = {
  /** Value written into the returned map for this region. */
  regionNumber: number;
  pixelCount: number;
  centerX: number;
  centerY: number;
};

export type GeneratedTopologyResolution = {
  /** Region numbers for the pixels generated strokes own; 0 everywhere else. */
  fillRegionMap: Uint16Array;
  regions: GeneratedTopologyRegion[];
};

type RegionAccumulator = {
  pixelCount: number;
  sumX: number;
  sumY: number;
  touchesGeneratedInk: boolean;
  existingPixels: Map<number, number>;
};

function hasNeighborInMask(mask: Uint8Array, width: number, height: number, pixel: number) {
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  if (x > 0 && mask[pixel - 1]) return true;
  if (x < width - 1 && mask[pixel + 1]) return true;
  if (y > 0 && mask[pixel - width]) return true;
  if (y < height - 1 && mask[pixel + width]) return true;
  return false;
}

function firstNeighborLabel(labelMap: Uint16Array, width: number, height: number, pixel: number) {
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  if (x > 0 && labelMap[pixel - 1]) return labelMap[pixel - 1];
  if (x < width - 1 && labelMap[pixel + 1]) return labelMap[pixel + 1];
  if (y > 0 && labelMap[pixel - width]) return labelMap[pixel - width];
  if (y < height - 1 && labelMap[pixel + width]) return labelMap[pixel + width];
  return 0;
}

/** Four-connected labeling of an enclosed-area mask. */
function labelEnclosedRegions(mask: Uint8Array, width: number, height: number) {
  const labelMap = new Uint16Array(mask.length);
  const queue = new Int32Array(mask.length);
  let lastLabel = 0;

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || labelMap[start] || lastLabel >= 65535) continue;
    lastLabel += 1;
    let head = 0;
    let tail = 0;
    labelMap[start] = lastLabel;
    queue[tail] = start;
    tail += 1;

    while (head < tail) {
      const pixel = queue[head];
      head += 1;
      const x = pixel % width;
      const y = Math.floor(pixel / width);

      const enqueue = (next: number) => {
        if (!mask[next] || labelMap[next]) return;
        labelMap[next] = lastLabel;
        queue[tail] = next;
        tail += 1;
      };

      if (x > 0) enqueue(pixel - 1);
      if (x < width - 1) enqueue(pixel + 1);
      if (y > 0) enqueue(pixel - width);
      if (y < height - 1) enqueue(pixel + width);
    }
  }

  return { labelMap, lastLabel };
}

/**
 * Returns the pixels the grown barrier took from the enclosures to the nearest
 * region, so a fill still runs up to the painted stroke instead of leaving a
 * halo of bare paper beside it. Only pixels that are barrier solely because of
 * gap closing are eligible; the stroke and the artwork's own ink stay unlabeled.
 */
function expandLabelsIntoGap(
  labelMap: Uint16Array,
  gapMask: Uint8Array,
  width: number,
  height: number,
  rounds: number,
) {
  for (let round = 0; round < rounds; round += 1) {
    const pixels: number[] = [];
    const labels: number[] = [];
    for (let pixel = 0; pixel < labelMap.length; pixel += 1) {
      if (labelMap[pixel] || !gapMask[pixel]) continue;
      const label = firstNeighborLabel(labelMap, width, height, pixel);
      if (!label) continue;
      pixels.push(pixel);
      labels.push(label);
    }
    if (!pixels.length) return;
    // Applied after the scan so one round cannot cascade a single label across
    // the whole ring in one pass.
    for (let index = 0; index < pixels.length; index += 1) {
      labelMap[pixels[index]] = labels[index];
    }
  }
}

/**
 * Decides whether a region of the recomputed topology belongs to the generated
 * artwork instead of the imported layer that used to own its pixels.
 *
 * Regions the strokes never touch keep the layer-scoped identity the imported
 * pass gave them, so this never disturbs fills elsewhere on the graph. A region
 * the strokes do touch is handed over only when it is not simply the same
 * region minus the pixels the stroke covered — which is what makes a line drawn
 * across an enclosure produce two independently fillable halves, and a line
 * that closes an open contour produce a fillable region where there was none.
 */
function generatedTopologyOwnsRegion(
  region: RegionAccumulator,
  dominantExistingRegion: number,
  dominantExistingPixels: number,
  existingRegionTotal: number,
) {
  if (!region.pixelCount || !region.touchesGeneratedInk) return false;
  if (!dominantExistingRegion || existingRegionTotal <= 0) return true;
  const coverage = dominantExistingPixels / region.pixelCount;
  const survival = dominantExistingPixels / existingRegionTotal;
  return !(coverage >= UNCHANGED_REGION_COVERAGE_RATIO && survival >= UNCHANGED_REGION_SURVIVAL_RATIO);
}

/**
 * Rebuilds the enclosure topology from generated strokes and imported artwork
 * ink together, and returns only the regions the strokes are responsible for.
 *
 * Strokes cannot be treated as an isolated barrier layer. An enclosure a user
 * builds by drawing across a gap in an uploaded contour is bounded by the
 * image's own ink along most of its perimeter, and a line drawn across an
 * existing enclosure only splits it if the two halves are relabeled. Both cases
 * need the union of the two barriers.
 */
export function resolveGeneratedTopology(params: {
  /** Pixels the generated strokes actually paint. */
  strokeMask: Uint8Array;
  /** Imported outline/contour ink, already merged across layers. */
  artworkInkMask?: Uint8Array | null;
  /** Region map the imported layers produced, before any stroke is merged in. */
  existingFillRegionMap: Uint16Array;
  /** Existing region numbers that are solid artwork rather than fillable emptiness. */
  artworkRegionNumbers?: ReadonlySet<number>;
  width: number;
  height: number;
  gapClosePixels?: number;
}): GeneratedTopologyResolution {
  const {
    strokeMask,
    artworkInkMask,
    existingFillRegionMap,
    artworkRegionNumbers,
    width,
    height,
  } = params;
  const gapClosePixels = Math.max(0, params.gapClosePixels ?? GENERATED_STROKE_GAP_CLOSE_PIXELS);
  const generatedBarrierMask = gapClosePixels > 0
    ? dilateMask(strokeMask, width, height, gapClosePixels)
    : strokeMask;

  const barrierMask = new Uint8Array(strokeMask.length);
  const gapMask = new Uint8Array(strokeMask.length);
  const hasArtworkRegions = Boolean(artworkRegionNumbers?.size);
  for (let pixel = 0; pixel < barrierMask.length; pixel += 1) {
    const artworkInk = Boolean(
      artworkInkMask?.[pixel] ||
        (hasArtworkRegions && artworkRegionNumbers!.has(existingFillRegionMap[pixel])),
    );
    if (generatedBarrierMask[pixel] || artworkInk) barrierMask[pixel] = 1;
    if (generatedBarrierMask[pixel] && !strokeMask[pixel] && !artworkInk) gapMask[pixel] = 1;
  }

  const { labelMap, lastLabel } = labelEnclosedRegions(
    createEnclosedRegionMask(barrierMask, width, height),
    width,
    height,
  );
  // The barrier is grown with a square kernel, so a ring pixel can sit up to
  // `2 * gapClosePixels` four-connected steps from the enclosure it belongs to.
  // Fewer rounds leave unlabeled specks of bare paper beside a drawn line.
  // Extra rounds are harmless: growth never leaves the ring.
  expandLabelsIntoGap(labelMap, gapMask, width, height, gapClosePixels * 2);

  const accumulators = new Map<number, RegionAccumulator>();
  const existingTotals = new Map<number, number>();
  for (let pixel = 0; pixel < labelMap.length; pixel += 1) {
    const existingRegion = existingFillRegionMap[pixel];
    if (existingRegion) existingTotals.set(existingRegion, (existingTotals.get(existingRegion) ?? 0) + 1);

    const label = labelMap[pixel];
    if (!label) continue;
    let accumulator = accumulators.get(label);
    if (!accumulator) {
      accumulator = { pixelCount: 0, sumX: 0, sumY: 0, touchesGeneratedInk: false, existingPixels: new Map() };
      accumulators.set(label, accumulator);
    }
    accumulator.pixelCount += 1;
    accumulator.sumX += pixel % width;
    accumulator.sumY += Math.floor(pixel / width);
    if (!accumulator.touchesGeneratedInk && hasNeighborInMask(generatedBarrierMask, width, height, pixel)) {
      accumulator.touchesGeneratedInk = true;
    }
    if (existingRegion) {
      accumulator.existingPixels.set(existingRegion, (accumulator.existingPixels.get(existingRegion) ?? 0) + 1);
    }
  }

  const fillRegionMap = new Uint16Array(labelMap.length);
  const regions: GeneratedTopologyRegion[] = [];
  const ownedNumbers = new Map<number, number>();

  for (let label = 1; label <= lastLabel; label += 1) {
    const accumulator = accumulators.get(label);
    if (!accumulator) continue;
    let dominantExistingRegion = 0;
    let dominantExistingPixels = 0;
    for (const [existingRegion, count] of accumulator.existingPixels) {
      if (count <= dominantExistingPixels) continue;
      dominantExistingRegion = existingRegion;
      dominantExistingPixels = count;
    }
    if (
      !generatedTopologyOwnsRegion(
        accumulator,
        dominantExistingRegion,
        dominantExistingPixels,
        existingTotals.get(dominantExistingRegion) ?? 0,
      )
    ) {
      continue;
    }

    const regionNumber = regions.length + 1;
    ownedNumbers.set(label, regionNumber);
    regions.push({
      regionNumber,
      pixelCount: accumulator.pixelCount,
      centerX: Math.round(accumulator.sumX / accumulator.pixelCount),
      centerY: Math.round(accumulator.sumY / accumulator.pixelCount),
    });
  }

  if (ownedNumbers.size) {
    for (let pixel = 0; pixel < labelMap.length; pixel += 1) {
      const regionNumber = ownedNumbers.get(labelMap[pixel]);
      if (regionNumber) fillRegionMap[pixel] = regionNumber;
    }
  }

  return { fillRegionMap, regions };
}

