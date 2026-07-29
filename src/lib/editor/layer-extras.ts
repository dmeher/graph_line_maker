import type { GraphBackgroundRemoval, GraphEraseStroke, GraphLayerGroup } from "@/lib/types";

/**
 * Pure normalizers + helpers for the layer "extras" added on top of the base
 * layer model: group membership, reversible erase strokes, and non-destructive
 * background removal. Kept dependency-free so both the client editor
 * (`editor-client.tsx`) and the server-only DAL (`projects.ts`) can reuse them.
 */

export const MAX_ERASE_STROKES_PER_LAYER = 80;
export const MAX_ERASE_POINTS_PER_STROKE = 400;
/** Cap total erase points per layer to keep the settings payload well under the 2 MB server-action limit. */
export const MAX_ERASE_POINTS_PER_LAYER = 6000;
/**
 * How far outside the image a lasso vertex may sit, in UV units. Generous
 * enough to trace across the whole graph, tight enough that legacy pixel-space
 * coordinates are still recognised as corrupt rather than accepted.
 */
export const MAX_POLYGON_UV_OVERSHOOT = 4;
/** Erase radius is stored as a fraction of the working canvas width (resolution independent). */
export const MIN_ERASE_RADIUS_FRACTION = 0.001;
export const MAX_ERASE_RADIUS_FRACTION = 0.5;
const DEFAULT_ERASE_RADIUS_FRACTION = 0.02;
/** Precision used when persisting normalized stroke values. */
const ERASE_COORD_DECIMALS = 4;

export const MIN_BACKGROUND_TOLERANCE = 0.02;
export const MAX_BACKGROUND_TOLERANCE = 0.6;
export const DEFAULT_BACKGROUND_TOLERANCE = 0.12;

const MAX_LAYER_GROUPS = 200;

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric as number));
}

export function normalizeGroupId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 80) : null;
}

export function clampEraseRadius(value: unknown): number {
  return clampNumber(value, MIN_ERASE_RADIUS_FRACTION, MAX_ERASE_RADIUS_FRACTION, DEFAULT_ERASE_RADIUS_FRACTION);
}

export function clampBackgroundTolerance(value: unknown): number {
  return clampNumber(value, MIN_BACKGROUND_TOLERANCE, MAX_BACKGROUND_TOLERANCE, DEFAULT_BACKGROUND_TOLERANCE);
}

function roundEraseCoord(value: number) {
  const factor = 10 ** ERASE_COORD_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * Normalize erase strokes: UV coords in 0..1, bounded strokes/points/total-points.
 * Strokes with out-of-range coordinates (e.g. legacy pixel-space drafts) are dropped
 * rather than clamped so they cannot smear along the canvas edge.
 */
export function normalizeEraseStrokes(value: unknown): GraphEraseStroke[] {
  if (!Array.isArray(value)) return [];
  const strokes: GraphEraseStroke[] = [];
  let totalPoints = 0;
  for (const raw of value) {
    if (strokes.length >= MAX_ERASE_STROKES_PER_LAYER) break;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const record = raw as { points?: unknown; radius?: unknown; shape?: unknown; fill?: unknown };
    if (!Array.isArray(record.points) || !record.points.length) continue;
    const radius = clampEraseRadius(record.radius);
    // Anything other than an explicit "square"/"polygon" is a circle, which
    // keeps strokes saved before those shapes existed rendering as before.
    const shape = record.shape === "square" ? "square" : record.shape === "polygon" ? "polygon" : "circle";
    // A lasso region may be traced anywhere on the graph, so its vertices can
    // sit outside the image and are kept unclamped — canvas fill() clips the
    // region to the layer, whereas clamping would distort the traced shape.
    // Brush strokes are still painted inside the image and stay 0..1.
    // The outer bound remains tight enough to reject legacy pixel-space drafts
    // (values in the hundreds), which is what this guard originally caught.
    const minCoord = shape === "polygon" ? -MAX_POLYGON_UV_OVERSHOOT : -0.001;
    const maxCoord = shape === "polygon" ? 1 + MAX_POLYGON_UV_OVERSHOOT : 1.001;
    const points: { x: number; y: number }[] = [];
    let legacyStroke = false;
    for (const point of record.points) {
      if (points.length >= MAX_ERASE_POINTS_PER_STROKE) break;
      if (totalPoints >= MAX_ERASE_POINTS_PER_LAYER) break;
      if (!point || typeof point !== "object") continue;
      const px = Number((point as { x?: unknown }).x);
      const py = Number((point as { y?: unknown }).y);
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      if (px < minCoord || px > maxCoord || py < minCoord || py > maxCoord) {
        legacyStroke = true;
        break;
      }
      points.push({
        x: roundEraseCoord(Math.max(minCoord, Math.min(maxCoord, px))),
        y: roundEraseCoord(Math.max(minCoord, Math.min(maxCoord, py))),
      });
      totalPoints += 1;
    }
    if (legacyStroke) {
      totalPoints -= points.length;
      continue;
    }
    // A polygon needs three vertices to enclose anything.
    if (shape === "polygon" && points.length < 3) continue;
    // Fill applies only to closed regions; a brush stroke always erases.
    const fill = shape === "polygon" && (record.fill === "#ffffff" || record.fill === "#000000") ? record.fill : undefined;
    if (points.length) strokes.push(fill ? { points, radius, shape, fill } : { points, radius, shape });
    if (totalPoints >= MAX_ERASE_POINTS_PER_LAYER) break;
  }
  return strokes;
}

/** Returns a normalized config only when enabled; otherwise `undefined` to keep the payload minimal. */
export function normalizeBackgroundRemoval(value: unknown): GraphBackgroundRemoval | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as { enabled?: unknown; tolerance?: unknown };
  if (record.enabled !== true) return undefined;
  return { enabled: true, tolerance: clampBackgroundTolerance(record.tolerance) };
}

export function normalizeLayerGroups(value: unknown): GraphLayerGroup[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const groups: GraphLayerGroup[] = [];
  for (const raw of value) {
    if (groups.length >= MAX_LAYER_GROUPS) break;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const id = normalizeGroupId((raw as { id?: unknown }).id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const rawName = (raw as { name?: unknown }).name;
    const name = typeof rawName === "string" && rawName.trim() ? rawName.trim().slice(0, 120) : "Group";
    groups.push({ id, name });
  }
  return groups;
}

/**
 * Stable full-geometry signature of erase state used to invalidate processing
 * and vector caches. Every normalized point is included: a stroke can change
 * materially while keeping the same count, endpoint, and radius.
 */
export function eraseStrokesSignature(strokes: GraphEraseStroke[] | undefined): string {
  if (!strokes?.length) return "0";
  return strokes
    .map((stroke) => {
      // Coordinates and radii are normalized to this same precision before
      // persistence. Keep the canonical representation here so equivalent
      // settings have the same cache key while every meaningful geometry
      // change invalidates a previously derived working canvas.
      const points = stroke.points
        .map((point) => `${point.x.toFixed(ERASE_COORD_DECIMALS)},${point.y.toFixed(ERASE_COORD_DECIMALS)}`)
        .join(";");
      return `${stroke.shape ?? "circle"}:${stroke.fill ?? "erase"}:${stroke.radius.toFixed(ERASE_COORD_DECIMALS)}:${points}`;
    })
    .join("|");
}

export function backgroundRemovalSignature(config: GraphBackgroundRemoval | undefined): string {
  return config?.enabled ? `1:${config.tolerance.toFixed(3)}` : "0";
}
