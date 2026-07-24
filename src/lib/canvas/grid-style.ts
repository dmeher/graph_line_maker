import { GRAPH_MAJOR_CELL_PIXELS, GRAPH_MINOR_PIXEL_SIZE, GRAPH_SUBDIVISIONS } from "@/lib/graph-paper";

/**
 * Shared grid-line styling so the editor preview (SVG overlay) and the exports
 * (vector grid in print/PDF) render an identical hierarchy. Line widths are
 * expressed in graph-pixel (viewBox) units relative to the configured
 * `gridLineThickness`, so they scale with zoom/output size like real graph paper:
 * the thickness-to-cell ratio stays constant and the three tiers stay legible.
 */

export type GridBucket = "minor" | "mid" | "strong" | "major";

export const GRID_BUCKET_ORDER: GridBucket[] = ["minor", "mid", "strong", "major"];

export const GRID_BUCKET_OPACITY: Record<GridBucket, number> = {
  minor: 0.34,
  mid: 0.52,
  strong: 0.58,
  major: 0.78,
};

/**
 * Width in graph-pixel units per unit of `gridLineThickness`, forming a clear but
 * restrained three-tier hierarchy: minor < 5th (mid) < 0th/10th (major). The major
 * line is distinctly (not overwhelmingly) thicker than the 5th line.
 */
export const GRID_BUCKET_WIDTH_UNITS: Record<GridBucket, number> = {
  minor: 0.6,
  mid: 1.2,
  strong: 1.5,
  major: 1.8,
};

/** Millimetres represented by one graph-pixel unit, given the cell size in cm. */
export function gridUnitMm(cellSizeCm: number) {
  const cellSizeMm = (Number.isFinite(cellSizeCm) && cellSizeCm > 0 ? cellSizeCm : 1) * 10;
  return cellSizeMm / GRAPH_MAJOR_CELL_PIXELS;
}

export function majorEveryMinorFor(majorGridEvery: number) {
  const every = Math.max(1, Math.round(majorGridEvery || 1));
  return every * GRAPH_SUBDIVISIONS;
}

export function gridBucketForIndex(index: number, majorEveryMinor: number): GridBucket {
  if (index % majorEveryMinor === 0) return "major";
  if (index % GRAPH_SUBDIVISIONS === 0) return "strong";
  if (index % 5 === 0) return "mid";
  return "minor";
}

/** Number of minor divisions across a canvas dimension (line indices are 0..count). */
export function gridLineCount(sizePx: number) {
  return Math.max(1, Math.round(sizePx / GRAPH_MINOR_PIXEL_SIZE));
}

export function gridLinePositionPx(index: number) {
  return index * GRAPH_MINOR_PIXEL_SIZE;
}
