import type { GraphSourceImage } from "@/lib/types";
import { backgroundRemovalSignature, eraseStrokesSignature } from "./layer-extras.ts";

export const ROTATION_STEP_DEGREES = 15;
const STACK_POSITION_EPSILON = 0.01;

export type SourceLayout = {
  source: GraphSourceImage;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SourcePositionPatch = Partial<Pick<GraphSourceImage, "x" | "y" | "topPadding" | "bottomPadding" | "width" | "height">>;
export type SourceTransformPatch = Partial<Pick<GraphSourceImage, "rotationDegrees" | "flipX" | "flipY">>;
export type LayerSnapBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type LayerSnapGuide = {
  axis: "x" | "y";
  value: number;
};
export type LayerSnapResult = {
  x: number;
  y: number;
  guides: LayerSnapGuide[];
};

/** Scales a layer's rectangle with its containing selection bounds. */
export function scaleLayerBoxToBounds(
  box: LayerSnapBox,
  startBounds: Pick<LayerSnapBox, "x" | "y" | "width" | "height">,
  nextBounds: Pick<LayerSnapBox, "x" | "y" | "width" | "height">,
): LayerSnapBox {
  const scaleX = nextBounds.width / Math.max(0.01, startBounds.width);
  const scaleY = nextBounds.height / Math.max(0.01, startBounds.height);
  return {
    ...box,
    x: roundCells(nextBounds.x + (box.x - startBounds.x) * scaleX),
    y: roundCells(nextBounds.y + (box.y - startBounds.y) * scaleY),
    width: roundCells(Math.max(0.01, box.width * scaleX)),
    height: roundCells(Math.max(0.01, box.height * scaleY)),
  };
}

/** Mirrors a layer rectangle within its containing selection bounds. */
export function flipLayerBoxInBounds(
  box: LayerSnapBox,
  bounds: Pick<LayerSnapBox, "x" | "y" | "width" | "height">,
  axis: "x" | "y",
): LayerSnapBox {
  return {
    ...box,
    x: axis === "x" ? roundCells(bounds.x + bounds.width - (box.x - bounds.x) - box.width) : box.x,
    y: axis === "y" ? roundCells(bounds.y + bounds.height - (box.y - bounds.y) - box.height) : box.y,
  };
}

/** Rotates a layer rectangle by a quarter turn around its selection bounds' center. */
export function rotateLayerBoxInBounds(
  box: LayerSnapBox,
  bounds: Pick<LayerSnapBox, "x" | "y" | "width" | "height">,
  direction: -1 | 1,
): LayerSnapBox {
  const rotatedBoundsX = bounds.x + (bounds.width - bounds.height) / 2;
  const rotatedBoundsY = bounds.y + (bounds.height - bounds.width) / 2;
  const localX = box.x - bounds.x;
  const localY = box.y - bounds.y;

  return {
    ...box,
    x: roundCells(direction === 1 ? rotatedBoundsX + bounds.height - localY - box.height : rotatedBoundsX + localY),
    y: roundCells(direction === 1 ? rotatedBoundsY + localX : rotatedBoundsY + bounds.width - localX - box.width),
    width: roundCells(Math.max(0.01, box.height)),
    height: roundCells(Math.max(0.01, box.width)),
  };
}

export function sourceLayouts(sources: GraphSourceImage[]): SourceLayout[] {
  return sources.map((source) => ({
    source,
    x: source.x,
    y: source.y,
    width: source.width,
    height: source.height,
  }));
}

export function sourceRenderOrder(sources: GraphSourceImage[]): SourceLayout[] {
  return sourceLayouts(sources).reverse();
}

function roundCells(value: number) {
  return Math.round(value * 100) / 100;
}

function sameCellPosition(first: number, second: number) {
  return Math.abs(first - second) <= STACK_POSITION_EPSILON;
}

export function sourcesUseVerticalStackSlots(sources: GraphSourceImage[]) {
  if (sources.length < 2) return false;
  const sortedSources = [...sources].sort((first, second) => first.y - second.y);
  let nextY = 0;

  for (const source of sortedSources) {
    const expectedY = roundCells(nextY + source.topPadding);
    if (!sameCellPosition(source.y, expectedY)) return false;
    nextY = source.y + source.height + source.bottomPadding;
  }

  return true;
}

export function reflowSourceVerticalStack(sources: GraphSourceImage[]) {
  let nextY = 0;
  return sources.map((source) => {
    const y = roundCells(nextY + source.topPadding);
    nextY = y + source.height + source.bottomPadding;
    return sameCellPosition(source.y, y) ? source : { ...source, y };
  });
}

export function reorderSourceImages(sources: GraphSourceImage[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= sources.length || toIndex >= sources.length) return sources;
  const shouldReflowStack = sourcesUseVerticalStackSlots(sources);
  const nextSources = [...sources];
  const [source] = nextSources.splice(fromIndex, 1);
  nextSources.splice(toIndex, 0, source);
  return shouldReflowStack ? reflowSourceVerticalStack(nextSources) : nextSources;
}

export function stackEndCell(sources: GraphSourceImage[]) {
  const layouts = sourceLayouts(sources);
  if (!layouts.length) return 0;
  return Math.max(...layouts.map((layout) => layout.y + layout.height + layout.source.bottomPadding));
}

export function normalizeRotationDegrees(value: unknown): GraphSourceImage["rotationDegrees"] {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return (((Math.round(numeric / ROTATION_STEP_DEGREES) * ROTATION_STEP_DEGREES) % 360) + 360) % 360;
}

export function snapCellToGrid(value: number, gridStep = 0.5) {
  if (!Number.isFinite(value)) return 0;
  const step = Math.max(0.1, gridStep);
  return Math.round((Math.round(value / step) * step) * 100) / 100;
}

function snapCandidate(value: number, candidates: number[], threshold: number) {
  let bestValue: number | null = null;
  let bestDistance = threshold;
  for (const candidate of candidates) {
    const distance = Math.abs(value - candidate);
    if (distance > bestDistance) continue;
    bestDistance = distance;
    bestValue = candidate;
  }
  return bestValue;
}

export function snapRectToLayerGuides(
  rect: LayerSnapBox,
  targets: LayerSnapBox[],
  options: { threshold?: number; gridStep?: number; disabled?: boolean } = {},
): LayerSnapResult {
  if (options.disabled) return { x: roundCells(rect.x), y: roundCells(rect.y), guides: [] };
  const threshold = Math.max(0.01, options.threshold ?? 0.25);
  const gridStep = options.gridStep ?? 0.5;
  let x = snapCellToGrid(rect.x, gridStep);
  let y = snapCellToGrid(rect.y, gridStep);
  const sourceXAnchors = [x, x + rect.width / 2, x + rect.width];
  const sourceYAnchors = [y, y + rect.height / 2, y + rect.height];
  const targetXAnchors = targets.flatMap((target) => [target.x, target.x + target.width / 2, target.x + target.width]);
  const targetYAnchors = targets.flatMap((target) => [target.y, target.y + target.height / 2, target.y + target.height]);
  const snappedLeft = snapCandidate(sourceXAnchors[0], targetXAnchors, threshold);
  const snappedCenterX = snapCandidate(sourceXAnchors[1], targetXAnchors, threshold);
  const snappedRight = snapCandidate(sourceXAnchors[2], targetXAnchors, threshold);
  const snappedTop = snapCandidate(sourceYAnchors[0], targetYAnchors, threshold);
  const snappedCenterY = snapCandidate(sourceYAnchors[1], targetYAnchors, threshold);
  const snappedBottom = snapCandidate(sourceYAnchors[2], targetYAnchors, threshold);
  const xOptions = [
    snappedLeft === null ? null : { x: snappedLeft, guide: snappedLeft },
    snappedCenterX === null ? null : { x: snappedCenterX - rect.width / 2, guide: snappedCenterX },
    snappedRight === null ? null : { x: snappedRight - rect.width, guide: snappedRight },
  ].filter((option): option is { x: number; guide: number } => Boolean(option));
  const yOptions = [
    snappedTop === null ? null : { y: snappedTop, guide: snappedTop },
    snappedCenterY === null ? null : { y: snappedCenterY - rect.height / 2, guide: snappedCenterY },
    snappedBottom === null ? null : { y: snappedBottom - rect.height, guide: snappedBottom },
  ].filter((option): option is { y: number; guide: number } => Boolean(option));
  const bestX = xOptions.length
    ? xOptions.reduce((best, option) => (Math.abs(option.x - x) < Math.abs(best.x - x) ? option : best), xOptions[0])
    : null;
  const bestY = yOptions.length
    ? yOptions.reduce((best, option) => (Math.abs(option.y - y) < Math.abs(best.y - y) ? option : best), yOptions[0])
    : null;
  const guides: LayerSnapGuide[] = [];
  if (bestX && Math.abs(bestX.x - x) <= threshold) {
    x = roundCells(bestX.x);
    guides.push({ axis: "x", value: roundCells(bestX.guide) });
  }
  if (bestY && Math.abs(bestY.y - y) <= threshold) {
    y = roundCells(bestY.y);
    guides.push({ axis: "y", value: roundCells(bestY.guide) });
  }
  return { x: roundCells(x), y: roundCells(y), guides };
}

export function sourceProcessingCacheKey(source: GraphSourceImage, layout: Pick<SourceLayout, "x" | "y" | "width" | "height">) {
  return [
    source.id,
    source.path ?? "",
    source.url ?? "",
    layout.x,
    layout.y,
    layout.width,
    layout.height,
    source.rotationDegrees,
    source.flipX ? 1 : 0,
    source.flipY ? 1 : 0,
    source.imageLineThickness,
    source.sourceFillThreshold,
    source.sourceFillMinStrokePixels,
    source.strokeGapClosePixels,
    source.imageAutoEnhance ? 1 : 0,
    source.imageDenoiseLevel,
    source.imageEdgeDetection,
    source.imageColorQuantization,
    source.vectorizerLineAdjust,
    source.vectorizerInkThreshold,
    source.vectorizerSketchRemoval,
    source.vectorizerFidelity,
    eraseStrokesSignature(source.eraseStrokes),
    backgroundRemovalSignature(source.backgroundRemoval),
  ].join("|");
}

/** Stable identity for a source asset shared by multiple editable layers. */
export function sourceAssetCacheKey(source: GraphSourceImage) {
  if (source.path) return `path:${source.path}`;
  if (source.url) return `url:${source.url}`;
  return `source:${source.id}`;
}

export function sourceVectorizerCacheKey(source: GraphSourceImage) {
  return [
    "source",
    sourceAssetCacheKey(source),
    eraseStrokesSignature(source.eraseStrokes),
    backgroundRemovalSignature(source.backgroundRemoval),
  ].join("|");
}

export function canChangeSourcePosition(source: GraphSourceImage) {
  return !source.locked;
}

export function applyUnlockedSourcePatch<T extends GraphSourceImage>(
  source: T,
  patch: SourcePositionPatch & SourceTransformPatch,
): T {
  if (source.locked) return source;
  return { ...source, ...patch };
}
