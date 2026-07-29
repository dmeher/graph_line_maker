/**
 * A persisted fill override is normally keyed by a stable region ID. That ID
 * is intentionally cheap to calculate, but a re-vectorization or a generated
 * artwork topology change can move a region's centroid just enough to produce
 * a different key. This module reconciles an already-rendered frame with the
 * next frame by matching the actual fill pixels rather than trusting the key.
 *
 * It is deliberately renderer-agnostic: callers retain the previous
 * `fillRegionMap` and region list, pass the next equivalent frame after a
 * render, and commit the returned override map if it changed.
 */

export type FillRegionReconciliationRegion = {
  /** Persistent, layer-scoped region ID. */
  id: string;
  /** Ephemeral number written to the frame's fill-region map. */
  mapId: number;
  /** Numeric ID retained only for projects saved before scoped IDs existed. */
  legacyId?: string;
  /** Earlier in-memory scoped IDs that should migrate to `id` on render. */
  fallbackIds?: readonly string[];
  /** `source` or `enclosed` for current processor regions. */
  kind?: string;
};

/** Both regular arrays and Uint16Array fill maps can be supplied. */
export type FillRegionReconciliationMap = ArrayLike<number>;

export type FillRegionReconciliationFrame<T extends FillRegionReconciliationRegion = FillRegionReconciliationRegion> = {
  fillRegions: readonly T[];
  fillRegionMap: FillRegionReconciliationMap;
  /** Pixel dimensions of the map when a graph resize needs coordinate matching. */
  width?: number;
  height?: number;
};

export type FillRegionReconciliationOptions = {
  /**
   * Minimum fraction of the next region that must originate from an old
   * region before a colour can move. Measuring against the next region lets
   * a filled enclosure retain its colour when a new line splits it into two
   * smaller enclosed regions, while still refusing to colour a mostly-new or
   * merged region by accident.
   */
  minimumOverlapRatio?: number;
  /** Reject tiny coincidental overlaps, even when the regions are very small. */
  minimumOverlapPixels?: number;
};

export type FillRegionReconciliationMatch = {
  fromId: string;
  toId: string;
  color: string;
  scope: string;
  kind: string;
  overlapPixels: number;
  previousCoverage: number;
  nextCoverage: number;
  previousOverlapRatio: number;
  nextOverlapRatio: number;
};

export type FillRegionReconciliationResult = {
  /** The prior map with unambiguous reconciled keys promoted to the new frame. */
  fillRegions: Record<string, string>;
  matches: readonly FillRegionReconciliationMatch[];
};

type ScopedRegionIdentity = {
  scope: string;
  kind: string;
};

type RegionDescriptor = {
  region: FillRegionReconciliationRegion;
  identity: ScopedRegionIdentity;
};

type OverlapCandidate = {
  previous: RegionDescriptor;
  next: RegionDescriptor;
  color: string;
  colorKey: string;
  overlapPixels: number;
  previousCoverage: number;
  nextCoverage: number;
  previousOverlapRatio: number;
  nextOverlapRatio: number;
  confidence: number;
};

const DEFAULT_MINIMUM_OVERLAP_RATIO = 0.72;
const DEFAULT_MINIMUM_OVERLAP_PIXELS = 4;
const SCOPED_ARTWORK_TYPES = new Set(["source", "clipart", "generated"]);

function clampRatio(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_MINIMUM_OVERLAP_RATIO;
  return Math.max(0.5, Math.min(1, value ?? DEFAULT_MINIMUM_OVERLAP_RATIO));
}

function clampPixels(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_MINIMUM_OVERLAP_PIXELS;
  return Math.max(1, Math.floor(value ?? DEFAULT_MINIMUM_OVERLAP_PIXELS));
}

/**
 * Returns the scope and kind encoded in a current scoped ID. The parsing is
 * intentionally from the end so source IDs may contain dashes without making
 * the identity format brittle.
 */
export function getFillRegionReconciliationIdentity(
  region: FillRegionReconciliationRegion,
): ScopedRegionIdentity | null {
  const parts = region.id.split(":");
  if (parts.length < 5 || !SCOPED_ARTWORK_TYPES.has(parts[0])) return null;

  // Non-vector fallbacks retain a `:screen:x:y` tail. They are not normally
  // persisted, but recognising them keeps in-memory reconciliation correct.
  const screenScoped = parts[parts.length - 3] === "screen";
  const kindIndex = parts.length - (screenScoped ? 4 : 3);
  const encodedKind = parts[kindIndex];
  const scope = parts.slice(0, kindIndex).join(":");
  const kind = region.kind ?? encodedKind;
  if (!scope || !kind || (region.kind && encodedKind !== region.kind)) return null;

  return { scope, kind };
}

function createFrameIndex(frame: FillRegionReconciliationFrame) {
  const byMapId = new Map<number, RegionDescriptor>();
  const byId = new Map<string, RegionDescriptor>();
  for (const region of frame.fillRegions) {
    const identity = getFillRegionReconciliationIdentity(region);
    if (!identity || !Number.isInteger(region.mapId) || region.mapId <= 0) continue;
    const descriptor = { region, identity };
    byMapId.set(region.mapId, descriptor);
    byId.set(region.id, descriptor);
  }
  return { byMapId, byId };
}

function overrideForRegion(overrides: Record<string, string>, region: FillRegionReconciliationRegion) {
  if (region.id in overrides) return { color: overrides[region.id], key: region.id };
  if (region.legacyId && region.legacyId in overrides) return { color: overrides[region.legacyId], key: region.legacyId };
  for (const fallbackId of region.fallbackIds ?? []) {
    if (fallbackId in overrides) return { color: overrides[fallbackId], key: fallbackId };
  }
  return null;
}

function candidateKey(previousMapId: number, nextMapId: number) {
  return `${previousMapId}:${nextMapId}`;
}

function mapDimensions(frame: FillRegionReconciliationFrame) {
  const width = Math.floor(frame.width ?? 0);
  const height = Math.floor(frame.height ?? 0);
  if (width <= 0 || height <= 0 || width * height !== frame.fillRegionMap.length) return null;
  return { width, height };
}

/**
 * Reconciles per-region fill colours across two rendered frames.
 *
 * Matches stay within one layer scope and region kind, and require at least
 * 72% of each next region to overlap an old region by default. A single old
 * region may therefore promote its colour to multiple new children after a
 * line splits an enclosure. In contrast, a merged or mostly-new region is
 * left alone unless one prior colour clearly dominates it. In particular, all
 * generated artwork belongs to `generated:artwork`, so its newly-labelled
 * topology is reconciled by actual pixel overlap instead of centroid-key
 * coincidence.
 */
export function reconcileFillRegionOverrides({
  overrides,
  previous,
  next,
  options,
}: {
  overrides: Record<string, string>;
  previous: FillRegionReconciliationFrame;
  next: FillRegionReconciliationFrame;
  options?: FillRegionReconciliationOptions;
}): FillRegionReconciliationResult {
  // Most settled frames have no user-authored fill overrides. Avoid walking a
  // graph-sized map (up to four million pixels) when there is nothing to
  // preserve or migrate.
  if (!Object.keys(overrides).length) {
    return { fillRegions: overrides, matches: [] };
  }

  const minimumOverlapRatio = clampRatio(options?.minimumOverlapRatio);
  const minimumOverlapPixels = clampPixels(options?.minimumOverlapPixels);
  const previousIndex = createFrameIndex(previous);
  const nextIndex = createFrameIndex(next);
  const candidates: OverlapCandidate[] = [];

  // Stable IDs already agree. This also promotes a legacy numeric key without
  // relying on equal map dimensions.
  for (const [id, previousDescriptor] of previousIndex.byId) {
    const nextDescriptor = nextIndex.byId.get(id);
    if (!nextDescriptor) continue;
    const override = overrideForRegion(overrides, previousDescriptor.region);
    if (!override || nextDescriptor.identity.scope !== previousDescriptor.identity.scope || nextDescriptor.identity.kind !== previousDescriptor.identity.kind) {
      continue;
    }
    candidates.push({
      previous: previousDescriptor,
      next: nextDescriptor,
      color: override.color,
      colorKey: override.key,
      overlapPixels: 0,
      previousCoverage: 0,
      nextCoverage: 0,
      previousOverlapRatio: 1,
      nextOverlapRatio: 1,
      confidence: 1,
    });
  }

  // Match frame pixels only when their coordinates are comparable. For a
  // graph resize, compare the shared top-left graph area rather than treating
  // two row-major maps with different widths as one linear coordinate system.
  // Graph content keeps its graph coordinates during a resize, so this lets
  // generated-artwork fills retain their colour even though their document
  // normalized IDs change.
  const previousDimensions = mapDimensions(previous);
  const nextDimensions = mapDimensions(next);
  const sameGrid = previous.fillRegionMap.length === next.fillRegionMap.length
    && (!previousDimensions || !nextDimensions || (
      previousDimensions.width === nextDimensions.width
      && previousDimensions.height === nextDimensions.height
    ));
  const canCompareResizedGrid = !sameGrid && previousDimensions && nextDimensions;
  if (previous.fillRegionMap !== next.fillRegionMap && (sameGrid || canCompareResizedGrid)) {
    const previousCoverage = new Map<number, number>();
    const nextCoverage = new Map<number, number>();
    const intersections = new Map<string, number>();

    const addCoverage = (coverage: Map<number, number>, mapId: number, descriptor: RegionDescriptor | undefined) => {
      if (descriptor) coverage.set(mapId, (coverage.get(mapId) ?? 0) + 1);
    };
    const addIntersection = (previousMapId: number, nextMapId: number) => {
      const previousDescriptor = previousIndex.byMapId.get(previousMapId);
      const nextDescriptor = nextIndex.byMapId.get(nextMapId);
      if (!previousDescriptor || !nextDescriptor) return;
      if (
        previousDescriptor.identity.scope !== nextDescriptor.identity.scope ||
        previousDescriptor.identity.kind !== nextDescriptor.identity.kind
      ) {
        return;
      }
      const key = candidateKey(previousMapId, nextMapId);
      intersections.set(key, (intersections.get(key) ?? 0) + 1);
    };

    if (sameGrid) {
      for (let pixel = 0; pixel < previous.fillRegionMap.length; pixel += 1) {
        const previousMapId = previous.fillRegionMap[pixel] ?? 0;
        const nextMapId = next.fillRegionMap[pixel] ?? 0;
        addCoverage(previousCoverage, previousMapId, previousIndex.byMapId.get(previousMapId));
        addCoverage(nextCoverage, nextMapId, nextIndex.byMapId.get(nextMapId));
        addIntersection(previousMapId, nextMapId);
      }
    } else if (previousDimensions && nextDimensions) {
      for (let pixel = 0; pixel < previous.fillRegionMap.length; pixel += 1) {
        const mapId = previous.fillRegionMap[pixel] ?? 0;
        addCoverage(previousCoverage, mapId, previousIndex.byMapId.get(mapId));
      }
      for (let pixel = 0; pixel < next.fillRegionMap.length; pixel += 1) {
        const mapId = next.fillRegionMap[pixel] ?? 0;
        addCoverage(nextCoverage, mapId, nextIndex.byMapId.get(mapId));
      }
      const sharedWidth = Math.min(previousDimensions.width, nextDimensions.width);
      const sharedHeight = Math.min(previousDimensions.height, nextDimensions.height);
      for (let y = 0; y < sharedHeight; y += 1) {
        const previousRow = y * previousDimensions.width;
        const nextRow = y * nextDimensions.width;
        for (let x = 0; x < sharedWidth; x += 1) {
          addIntersection(previous.fillRegionMap[previousRow + x] ?? 0, next.fillRegionMap[nextRow + x] ?? 0);
        }
      }
    }

    for (const [key, overlapPixels] of intersections) {
      const [previousMapIdText, nextMapIdText] = key.split(":");
      const previousMapId = Number(previousMapIdText);
      const nextMapId = Number(nextMapIdText);
      const previousDescriptor = previousIndex.byMapId.get(previousMapId);
      const nextDescriptor = nextIndex.byMapId.get(nextMapId);
      if (!previousDescriptor || !nextDescriptor || previousDescriptor.region.id === nextDescriptor.region.id) continue;

      const override = overrideForRegion(overrides, previousDescriptor.region);
      const previousPixels = previousCoverage.get(previousMapId) ?? 0;
      const nextPixels = nextCoverage.get(nextMapId) ?? 0;
      if (!override || overlapPixels < minimumOverlapPixels || !previousPixels || !nextPixels) continue;

      const previousOverlapRatio = overlapPixels / previousPixels;
      const nextOverlapRatio = overlapPixels / nextPixels;
      candidates.push({
        previous: previousDescriptor,
        next: nextDescriptor,
        color: override.color,
        colorKey: override.key,
        overlapPixels,
        previousCoverage: previousPixels,
        nextCoverage: nextPixels,
        previousOverlapRatio,
        nextOverlapRatio,
        confidence: nextOverlapRatio,
      });
    }
  }

  // Resolve each next region once. A direct stable-ID match always wins. For
  // a changed topology, candidates with the same old colour can combine their
  // non-overlapping coverage of the next region. This is important for undo:
  // two children produced by a newly drawn line can merge back into their
  // original enclosure, and both children must restore the same colour rather
  // than each falling below the single-region confidence threshold.
  const candidatesByTarget = new Map<string, OverlapCandidate[]>();
  for (const candidate of candidates) {
    const targetId = candidate.next.region.id;
    const targetCandidates = candidatesByTarget.get(targetId) ?? [];
    targetCandidates.push(candidate);
    candidatesByTarget.set(targetId, targetCandidates);
  }

  let reconciled: Record<string, string> | null = null;
  const matches: FillRegionReconciliationMatch[] = [];
  for (const [toId, targetCandidates] of candidatesByTarget) {
    const directMatch = targetCandidates.find((candidate) => candidate.previous.region.id === toId);
    let winningCandidates: OverlapCandidate[];
    if (directMatch) {
      winningCandidates = [directMatch];
    } else {
      const candidatesByColor = new Map<string, { color: string; candidates: OverlapCandidate[]; overlapPixels: number; nextCoverage: number }>();
      for (const candidate of targetCandidates) {
        const colorKey = candidate.color.toLowerCase();
        const group = candidatesByColor.get(colorKey) ?? {
          color: candidate.color,
          candidates: [],
          overlapPixels: 0,
          nextCoverage: candidate.nextCoverage,
        };
        group.candidates.push(candidate);
        group.overlapPixels += candidate.overlapPixels;
        group.nextCoverage = Math.max(group.nextCoverage, candidate.nextCoverage);
        candidatesByColor.set(colorKey, group);
      }

      const winningColor = [...candidatesByColor.values()]
        .filter((group) => group.nextCoverage > 0 && group.overlapPixels / group.nextCoverage >= minimumOverlapRatio)
        .sort(
          (left, right) =>
            right.overlapPixels / right.nextCoverage - left.overlapPixels / left.nextCoverage ||
            right.overlapPixels - left.overlapPixels ||
            left.color.localeCompare(right.color),
        )[0];
      if (!winningColor) continue;
      winningCandidates = winningColor.candidates;
    }

    // A direct override on the current rendered ID is newer and always wins.
    const targetHasExplicitOverride = toId in overrides;
    const promotionColor = targetHasExplicitOverride ? overrides[toId] : winningCandidates[0]!.color;
    const needsPromotion = winningCandidates.some((candidate) => candidate.colorKey !== toId) && !targetHasExplicitOverride;
    const staleKeys = new Set(
      winningCandidates
        .map((candidate) => candidate.colorKey)
        .filter((colorKey) => colorKey !== toId && !nextIndex.byId.has(colorKey)),
    );
    if (needsPromotion || staleKeys.size) reconciled ??= { ...overrides };
    if (needsPromotion) reconciled![toId] = promotionColor;
    for (const staleKey of staleKeys) delete reconciled![staleKey];

    for (const candidate of winningCandidates) {
      matches.push({
        fromId: candidate.previous.region.id,
        toId,
        color: promotionColor,
        scope: candidate.previous.identity.scope,
        kind: candidate.previous.identity.kind,
        overlapPixels: candidate.overlapPixels,
        previousCoverage: candidate.previousCoverage,
        nextCoverage: candidate.nextCoverage,
        previousOverlapRatio: candidate.previousOverlapRatio,
        nextOverlapRatio: candidate.nextOverlapRatio,
      });
    }
  }

  return {
    fillRegions: reconciled ?? overrides,
    matches,
  };
}
