import type { GraphVerticalSplit } from "../types.ts";

type PixelColumnMask = Uint8Array | Uint16Array;

function positiveInteger(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.round(numeric));
}

/**
 * Uses the same numbering as outside grid labels: number 1 is the first cell
 * after the left 1 cm gutter, and the final 1 cm gutter is not numbered.
 * Reversed inputs are ordered, out-of-range values are clamped when added, and
 * overlapping/adjacent ranges collapse into one blank run.
 */
export function normalizeVerticalSplits(value: unknown, graphWidth: number): GraphVerticalSplit[] {
  const width = positiveInteger(graphWidth, 1);
  if (width < 3 || !Array.isArray(value)) return [];

  const lastNumberedCell = width - 2;
  const splits: GraphVerticalSplit[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    const rawStart = Number(record.startCell);
    const rawEnd = Number(record.endCell);
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) continue;

    const first = Math.round(Math.min(rawStart, rawEnd));
    const last = Math.round(Math.max(rawStart, rawEnd));
    const startCell = Math.max(1, Math.min(lastNumberedCell, first));
    const endCell = Math.max(1, Math.min(lastNumberedCell, last));
    splits.push({ startCell, endCell });
  }

  splits.sort((left, right) => left.startCell - right.startCell || left.endCell - right.endCell);
  const normalized: GraphVerticalSplit[] = [];
  for (const split of splits) {
    const previous = normalized.at(-1);
    if (previous && split.startCell <= previous.endCell + 1) {
      previous.endCell = Math.max(previous.endCell, split.endCell);
    } else {
      normalized.push({ ...split });
    }
  }
  return normalized;
}

export function isCellInVerticalSplit(cell: number, splits: readonly GraphVerticalSplit[]) {
  return splits.some((split) => cell >= split.startCell && cell <= split.endCell);
}

export type VerticalSplitPixelRange = {
  startX: number;
  endX: number;
};

/** Returns half-open pixel ranges aligned to whole graph cells. */
export function verticalSplitPixelRanges(
  splits: readonly GraphVerticalSplit[],
  graphWidth: number,
  pixelWidth: number,
): VerticalSplitPixelRange[] {
  const widthCells = positiveInteger(graphWidth, 1);
  const widthPixels = positiveInteger(pixelWidth, widthCells);
  return normalizeVerticalSplits(splits, widthCells).map((split) => ({
    startX: Math.round((split.startCell / widthCells) * widthPixels),
    endX: Math.round(((split.endCell + 1) / widthCells) * widthPixels),
  }));
}

/** Split section edges, redrawn after the blank mask so strokes stay full-width. */
export function verticalSplitBoundaryPixelPositions(
  splits: readonly GraphVerticalSplit[],
  graphWidth: number,
  pixelWidth: number,
) {
  const positions = verticalSplitPixelRanges(splits, graphWidth, pixelWidth).flatMap((range) => [
    range.startX,
    range.endX,
  ]);
  return Array.from(new Set(positions)).sort((left, right) => left - right);
}

/** Clears split columns from a row-major pixel mask used for hit testing/rendering. */
export function clearVerticalSplitMaskColumns(
  mask: PixelColumnMask,
  pixelWidth: number,
  pixelHeight: number,
  splits: readonly GraphVerticalSplit[],
  graphWidth: number,
) {
  const width = positiveInteger(pixelWidth, 1);
  const height = positiveInteger(pixelHeight, 1);
  const ranges = verticalSplitPixelRanges(splits, graphWidth, width);
  if (!ranges.length) return mask;

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    for (const range of ranges) {
      mask.fill(0, rowStart + range.startX, rowStart + range.endX);
    }
  }
  return mask;
}
