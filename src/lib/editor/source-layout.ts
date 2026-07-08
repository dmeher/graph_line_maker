import type { GraphSourceImage } from "@/lib/types";

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
