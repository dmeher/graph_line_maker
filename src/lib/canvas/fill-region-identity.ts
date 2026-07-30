import { GRAPH_MAJOR_CELL_PIXELS } from "../graph-paper.ts";
import { normalizeRotationDegrees } from "../editor/source-layout.ts";

export type FillRegionIdentityPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDegrees: number;
  flipX: boolean;
  flipY: boolean;
  offsetX?: number;
  offsetY?: number;
};

export type FillRegionIdentityRegion = {
  id: string;
  legacyId?: string;
};

/**
 * Quantization steps for the normalized `u`/`v` tail of a scoped region ID.
 * Reconciliation compares those tails, so it must use the same scale.
 */
export const FILL_REGION_ID_PRECISION = 2048;
const ID_PRECISION = FILL_REGION_ID_PRECISION;
const LEGACY_FILL_REGION_ID = /^\d+$/;
const SCOPED_FILL_REGION_ID =
  /^(?:source|clipart|generated):[A-Za-z0-9-]{1,96}:(?:source|enclosed):(?!0\d)\d{1,4}:(?!0\d)\d{1,4}$/;

/**
 * Validates persisted fill override keys. Numeric keys are retained for legacy
 * projects; new keys are scoped to one artwork layer and its local region.
 */
export function isStoredFillRegionId(value: string) {
  if (LEGACY_FILL_REGION_ID.test(value)) return true;
  if (!SCOPED_FILL_REGION_ID.test(value)) return false;

  const [, , , u, v] = value.split(":");
  return Number(u) <= ID_PRECISION && Number(v) <= ID_PRECISION;
}

function normalizedRotation(value: number) {
  // Layer transforms are intentionally quantized to the editor's 15-degree
  // rotation step. Fill identities must apply that exact same transform when
  // converting a rendered region back to local artwork coordinates; rounding
  // to 90 degrees made every intermediate rotation resolve to a different
  // persisted fill key after a re-render.
  return normalizeRotationDegrees(value);
}

/**
 * The first scoped-ID implementation rounded every rotation to a cardinal
 * quarter turn. Keep that exact calculation available only as a read-time
 * alias so existing saved colours can be promoted to the corrected identity.
 */
function legacyCardinalRotation(value: number) {
  return ((Math.round(value / 90) * 90) % 360 + 360) % 360;
}

function quantize(value: number) {
  return Math.max(0, Math.min(ID_PRECISION, Math.round(value * ID_PRECISION)));
}

/** Returns the persistent namespace used by rendered imported or generated artwork. */
export function fillRegionLayerScope(type: "source" | "clipart" | "generated", id: string) {
  return `${type}:${id}`;
}

/**
 * Resolves an output point back into the unrotated, unflipped layer rectangle.
 * The resulting key follows the artwork when its layer is moved, rotated, or flipped.
 */
function createFillRegionId({
  layerId,
  kind,
  centerX,
  centerY,
  placement,
  rotationForIdentity,
}: {
  layerId: string;
  kind: string;
  centerX: number;
  centerY: number;
  placement?: FillRegionIdentityPlacement;
  rotationForIdentity: (value: number) => number;
}) {
  if (!placement) return `${layerId}:${kind}:screen:${Math.round(centerX)}:${Math.round(centerY)}`;

  const drawWidth = placement.width * GRAPH_MAJOR_CELL_PIXELS;
  const drawHeight = placement.height * GRAPH_MAJOR_CELL_PIXELS;
  if (!Number.isFinite(drawWidth) || !Number.isFinite(drawHeight) || drawWidth <= 0 || drawHeight <= 0) {
    return `${layerId}:${kind}:screen:${Math.round(centerX)}:${Math.round(centerY)}`;
  }

  const rotation = rotationForIdentity(placement.rotationDegrees);
  const sideways = rotation === 90 || rotation === 270;
  const fittedWidth = sideways ? drawHeight : drawWidth;
  const fittedHeight = sideways ? drawWidth : drawHeight;
  const layerCenterX = placement.x * GRAPH_MAJOR_CELL_PIXELS + (placement.offsetX ?? 0) + drawWidth / 2;
  const layerCenterY = placement.y * GRAPH_MAJOR_CELL_PIXELS + (placement.offsetY ?? 0) + drawHeight / 2;
  const radians = (rotation * Math.PI) / 180;
  const dx = centerX - layerCenterX;
  const dy = centerY - layerCenterY;

  // Invert canvas rotation, then the optional horizontal/vertical mirror.
  const rotatedX = dx * Math.cos(radians) + dy * Math.sin(radians);
  const rotatedY = -dx * Math.sin(radians) + dy * Math.cos(radians);
  const localX = placement.flipX ? -rotatedX : rotatedX;
  const localY = placement.flipY ? -rotatedY : rotatedY;
  const u = (localX + fittedWidth / 2) / fittedWidth;
  const v = (localY + fittedHeight / 2) / fittedHeight;

  return `${layerId}:${kind}:${quantize(u)}:${quantize(v)}`;
}

export function createStableFillRegionId({
  layerId,
  kind,
  centerX,
  centerY,
  placement,
}: {
  layerId: string;
  kind: string;
  centerX: number;
  centerY: number;
  placement?: FillRegionIdentityPlacement;
}) {
  return createFillRegionId({
    layerId,
    kind,
    centerX,
    centerY,
    placement,
    rotationForIdentity: normalizedRotation,
  });
}

/**
 * Reads a scoped fill key produced before arbitrary 15-degree rotations were
 * supported by the identity transform. New edits always write the stable key.
 */
export function createLegacyCardinalFillRegionId({
  layerId,
  kind,
  centerX,
  centerY,
  placement,
}: {
  layerId: string;
  kind: string;
  centerX: number;
  centerY: number;
  placement?: FillRegionIdentityPlacement;
}) {
  return createFillRegionId({
    layerId,
    kind,
    centerX,
    centerY,
    placement,
    rotationForIdentity: legacyCardinalRotation,
  });
}

/** Promotes pre-stable numeric fill IDs to the matching current layer-scoped IDs. */
export function migrateLegacyFillRegionOverrides<T extends FillRegionIdentityRegion>(
  overrides: Record<string, string>,
  regions: readonly T[],
) {
  let next: Record<string, string> | null = null;
  for (const region of regions) {
    if (!region.legacyId || region.legacyId === region.id || !(region.legacyId in overrides) || region.id in overrides) continue;
    next ??= { ...overrides };
    next[region.id] = overrides[region.legacyId];
    delete next[region.legacyId];
  }
  return next ?? overrides;
}

/** Copies layer-scoped color overrides when a source or clipart is duplicated. */
export function copyFillRegionOverrides(
  overrides: Record<string, string>,
  scopeRemaps: readonly { from: string; to: string }[],
) {
  if (!scopeRemaps.length) return overrides;
  const next = { ...overrides };
  let changed = false;
  for (const { from, to } of scopeRemaps) {
    const fromPrefix = `${from}:`;
    for (const [key, color] of Object.entries(overrides)) {
      if (!key.startsWith(fromPrefix)) continue;
      const copiedKey = `${to}:${key.slice(fromPrefix.length)}`;
      if (copiedKey in next) continue;
      next[copiedKey] = color;
      changed = true;
    }
  }
  return changed ? next : overrides;
}

/** Drops overrides belonging to artwork whose pixels have been replaced or reprocessed. */
export function removeFillRegionOverridesForScopes(overrides: Record<string, string>, scopes: readonly string[]) {
  if (!scopes.length) return overrides;
  const prefixes = scopes.map((scope) => `${scope}:`);
  let next: Record<string, string> | null = null;
  for (const key of Object.keys(overrides)) {
    if (!prefixes.some((prefix) => key.startsWith(prefix))) continue;
    next ??= { ...overrides };
    delete next[key];
  }
  return next ?? overrides;
}
