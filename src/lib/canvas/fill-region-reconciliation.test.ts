import assert from "node:assert/strict";
import test from "node:test";
import {
  getFillRegionReconciliationIdentity,
  reconcileFillRegionOverrides,
  type FillRegionReconciliationFrame,
} from "./fill-region-reconciliation.ts";

function frame(
  fillRegions: FillRegionReconciliationFrame["fillRegions"],
  fillRegionMap: number[],
  dimensions?: { width: number; height: number },
): FillRegionReconciliationFrame {
  return { fillRegions, fillRegionMap: Uint16Array.from(fillRegionMap), ...dimensions };
}

test("reconciles a generated artwork override when a topology rerender changes its centroid key", () => {
  const previous = frame(
    [{ id: "generated:artwork:enclosed:1024:1024", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  );
  const next = frame(
    [{ id: "generated:artwork:enclosed:1030:1021", mapId: 9, kind: "enclosed" }],
    [9, 9, 9, 9, 9, 9, 9, 0, 0, 0, 0, 0],
  );

  const result = reconcileFillRegionOverrides({
    overrides: { "generated:artwork:enclosed:1024:1024": "#ef4444" },
    previous,
    next,
  });

  assert.deepEqual(result.fillRegions, { "generated:artwork:enclosed:1030:1021": "#ef4444" });
  assert.deepEqual(result.matches, [
    {
      fromId: "generated:artwork:enclosed:1024:1024",
      toId: "generated:artwork:enclosed:1030:1021",
      color: "#ef4444",
      scope: "generated:artwork",
      kind: "enclosed",
      overlapPixels: 7,
      previousCoverage: 8,
      nextCoverage: 7,
      previousOverlapRatio: 0.875,
      nextOverlapRatio: 1,
    },
  ]);
});

test("never transfers a colour between different layer scopes or fill kinds", () => {
  const previous = frame(
    [
      { id: "source:lion:enclosed:100:200", mapId: 1, kind: "enclosed" },
      { id: "generated:artwork:enclosed:100:200", mapId: 2, kind: "enclosed" },
    ],
    [1, 1, 1, 1, 2, 2, 2, 2],
  );
  const next = frame(
    [
      { id: "clipart:lion:enclosed:101:201", mapId: 3, kind: "enclosed" },
      { id: "generated:artwork:source:101:201", mapId: 4, kind: "source" },
    ],
    [3, 3, 3, 3, 4, 4, 4, 4],
  );
  const overrides = {
    "source:lion:enclosed:100:200": "#ef4444",
    "generated:artwork:enclosed:100:200": "#22c55e",
  };

  const result = reconcileFillRegionOverrides({ overrides, previous, next });

  assert.equal(result.fillRegions, overrides);
  assert.deepEqual(result.matches, []);
});

test("propagates a filled enclosure to each child when a new line splits it", () => {
  const previous = frame(
    [{ id: "generated:artwork:enclosed:500:500", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  );
  const next = frame(
    [
      { id: "generated:artwork:enclosed:498:500", mapId: 2, kind: "enclosed" },
      { id: "generated:artwork:enclosed:510:500", mapId: 3, kind: "enclosed" },
    ],
    [2, 2, 2, 2, 2, 3, 3, 3, 3, 3],
  );
  const overrides = { "generated:artwork:enclosed:500:500": "#3b82f6" };

  const result = reconcileFillRegionOverrides({ overrides, previous, next });

  assert.deepEqual(result.fillRegions, {
    "generated:artwork:enclosed:498:500": "#3b82f6",
    "generated:artwork:enclosed:510:500": "#3b82f6",
  });
  assert.equal(result.matches.length, 2);
  assert.equal(result.matches.every((match) => match.nextOverlapRatio === 1), true);
});

test("restores a shared child colour when undo merges a split enclosure", () => {
  const previous = frame(
    [
      { id: "generated:artwork:enclosed:498:500", mapId: 2, kind: "enclosed" },
      { id: "generated:artwork:enclosed:510:500", mapId: 3, kind: "enclosed" },
    ],
    [2, 2, 2, 2, 2, 3, 3, 3, 3, 3],
  );
  const next = frame(
    [{ id: "generated:artwork:enclosed:500:500", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  );

  const result = reconcileFillRegionOverrides({
    overrides: {
      "generated:artwork:enclosed:498:500": "#3b82f6",
      "generated:artwork:enclosed:510:500": "#3b82f6",
    },
    previous,
    next,
  });

  assert.deepEqual(result.fillRegions, { "generated:artwork:enclosed:500:500": "#3b82f6" });
  assert.equal(result.matches.length, 2);
  assert.equal(result.matches.every((match) => match.nextOverlapRatio === 0.5), true);
});

test("does not choose a fill when merged children have competing colours", () => {
  const previous = frame(
    [
      { id: "generated:artwork:enclosed:498:500", mapId: 2, kind: "enclosed" },
      { id: "generated:artwork:enclosed:510:500", mapId: 3, kind: "enclosed" },
    ],
    [2, 2, 2, 2, 2, 3, 3, 3, 3, 3],
  );
  const next = frame(
    [{ id: "generated:artwork:enclosed:500:500", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  );
  const overrides = {
    "generated:artwork:enclosed:498:500": "#3b82f6",
    "generated:artwork:enclosed:510:500": "#ef4444",
  };

  const result = reconcileFillRegionOverrides({ overrides, previous, next });

  assert.equal(result.fillRegions, overrides);
  assert.deepEqual(result.matches, []);
});

test("retains a generated fill across a graph resize using shared graph coordinates", () => {
  const previous = frame(
    [{ id: "generated:artwork:enclosed:500:500", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1, 1, 1, 1, 1],
    { width: 4, height: 2 },
  );
  const next = frame(
    [{ id: "generated:artwork:enclosed:500:333", mapId: 2, kind: "enclosed" }],
    [2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0],
    { width: 4, height: 3 },
  );

  const result = reconcileFillRegionOverrides({
    overrides: { "generated:artwork:enclosed:500:500": "#22c55e" },
    previous,
    next,
  });

  assert.deepEqual(result.fillRegions, { "generated:artwork:enclosed:500:333": "#22c55e" });
  assert.equal(result.matches[0]?.nextOverlapRatio, 1);
});

test("skips graph-map reconciliation when no fill overrides exist", () => {
  const previous = frame(
    [{ id: "source:lion:enclosed:500:500", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1],
  );
  const next = frame(
    [{ id: "source:lion:enclosed:501:500", mapId: 2, kind: "enclosed" }],
    [2, 2, 2, 2],
  );
  const overrides = {};

  const result = reconcileFillRegionOverrides({ overrides, previous, next });

  assert.equal(result.fillRegions, overrides);
  assert.deepEqual(result.matches, []);
});

test("retains the surviving key while extending its colour to a new split child", () => {
  const previous = frame(
    [{ id: "generated:artwork:enclosed:500:500", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1, 1, 1, 1, 1],
  );
  const next = frame(
    [
      { id: "generated:artwork:enclosed:500:500", mapId: 2, kind: "enclosed" },
      { id: "generated:artwork:enclosed:520:500", mapId: 3, kind: "enclosed" },
    ],
    [2, 2, 2, 2, 3, 3, 3, 3],
  );

  const result = reconcileFillRegionOverrides({
    overrides: { "generated:artwork:enclosed:500:500": "#22c55e" },
    previous,
    next,
  });

  assert.deepEqual(result.fillRegions, {
    "generated:artwork:enclosed:500:500": "#22c55e",
    "generated:artwork:enclosed:520:500": "#22c55e",
  });
});

test("preserves a newer explicit override on the next region", () => {
  const previous = frame(
    [{ id: "source:lion:enclosed:500:500", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1, 1, 1],
  );
  const next = frame(
    [{ id: "source:lion:enclosed:501:500", mapId: 2, kind: "enclosed" }],
    [2, 2, 2, 2, 2, 2],
  );

  const result = reconcileFillRegionOverrides({
    overrides: {
      "source:lion:enclosed:500:500": "#ef4444",
      "source:lion:enclosed:501:500": "#22c55e",
    },
    previous,
    next,
  });

  assert.deepEqual(result.fillRegions, { "source:lion:enclosed:501:500": "#22c55e" });
  assert.equal(result.matches[0]?.color, "#22c55e");
});

test("promotes a legacy numeric override when the stable identity already agrees", () => {
  const previous = frame(
    [{ id: "source:lion:enclosed:500:500", legacyId: "7", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1],
  );
  const next = frame(
    [{ id: "source:lion:enclosed:500:500", mapId: 9, kind: "enclosed" }],
    [9, 9, 9, 9, 9, 9],
  );

  const result = reconcileFillRegionOverrides({ overrides: { "7": "#f59e0b" }, previous, next });

  assert.deepEqual(result.fillRegions, { "source:lion:enclosed:500:500": "#f59e0b" });
  assert.equal(result.matches[0]?.overlapPixels, 0);
});

test("promotes a pre-15-degree scoped override through a read-time alias", () => {
  const currentId = "source:lion:enclosed:500:500";
  const priorCardinalId = "source:lion:enclosed:440:610";
  const previous = frame(
    [{ id: currentId, fallbackIds: [priorCardinalId], mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1],
  );
  const next = frame(
    [{ id: currentId, fallbackIds: [priorCardinalId], mapId: 9, kind: "enclosed" }],
    [9, 9, 9, 9],
  );

  const result = reconcileFillRegionOverrides({ overrides: { [priorCardinalId]: "#b0b0b0" }, previous, next });

  assert.deepEqual(result.fillRegions, { [currentId]: "#b0b0b0" });
});

test("parses scoped region identities only from valid scoped artwork keys", () => {
  assert.deepEqual(
    getFillRegionReconciliationIdentity({ id: "generated:artwork:enclosed:1024:512", mapId: 1, kind: "enclosed" }),
    { scope: "generated:artwork", kind: "enclosed" },
  );
  assert.deepEqual(
    getFillRegionReconciliationIdentity({ id: "source:lion:source:screen:10:20", mapId: 1, kind: "source" }),
    { scope: "source:lion", kind: "source" },
  );
  assert.equal(getFillRegionReconciliationIdentity({ id: "17", mapId: 1 }), null);
  assert.equal(getFillRegionReconciliationIdentity({ id: "source:lion:enclosed:10:20", mapId: 1, kind: "source" }), null);
});

test("retains a layer fill when the layer is resized larger", () => {
  // Enlarging rescales the artwork, so the region keeps its normalized position
  // inside the layer while its pixel area grows. The old region then covers far
  // less than the overlap threshold of the new one.
  const previous = frame(
    [{ id: "source:image-1:enclosed:1000:1000", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  );
  const next = frame(
    [{ id: "source:image-1:enclosed:1004:1003", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  );

  const result = reconcileFillRegionOverrides({
    overrides: { "source:image-1:enclosed:1000:1000": "#000000" },
    previous,
    next,
  });

  assert.deepEqual(result.fillRegions, { "source:image-1:enclosed:1004:1003": "#000000" });
});

test("retains a layer fill when a resize also moves the region clear of its old pixels", () => {
  const previous = frame(
    [{ id: "clipart:badge:enclosed:400:400", mapId: 1, kind: "enclosed" }],
    [1, 1, 0, 0, 0, 0],
  );
  const next = frame(
    [{ id: "clipart:badge:enclosed:407:396", mapId: 2, kind: "enclosed" }],
    [0, 0, 0, 2, 2, 2],
  );

  const result = reconcileFillRegionOverrides({
    overrides: { "clipart:badge:enclosed:400:400": "#b0b0b0" },
    previous,
    next,
  });

  assert.deepEqual(result.fillRegions, { "clipart:badge:enclosed:407:396": "#b0b0b0" });
});

test("does not pair regions by position across a genuine split", () => {
  // One previous region sits within tolerance of both children, so the
  // geometric pass must stand aside and let overlap voting decide.
  const previous = frame(
    [{ id: "source:image-1:enclosed:500:500", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  );
  const next = frame(
    [
      { id: "source:image-1:enclosed:496:500", mapId: 2, kind: "enclosed" },
      { id: "source:image-1:enclosed:504:500", mapId: 3, kind: "enclosed" },
    ],
    [2, 2, 2, 2, 2, 0, 3, 3, 3, 3, 3, 3],
  );

  const result = reconcileFillRegionOverrides({
    overrides: { "source:image-1:enclosed:500:500": "#3b82f6" },
    previous,
    next,
  });

  assert.deepEqual(result.fillRegions, {
    "source:image-1:enclosed:496:500": "#3b82f6",
    "source:image-1:enclosed:504:500": "#3b82f6",
  });
});

test("a distant region is never adopted as a resized match", () => {
  const previous = frame(
    [{ id: "source:image-1:enclosed:200:200", mapId: 1, kind: "enclosed" }],
    [1, 1, 0, 0, 0, 0],
  );
  const next = frame(
    [{ id: "source:image-1:enclosed:1800:1700", mapId: 2, kind: "enclosed" }],
    [0, 0, 0, 2, 2, 2],
  );
  const overrides = { "source:image-1:enclosed:200:200": "#000000" };

  const result = reconcileFillRegionOverrides({ overrides, previous, next });

  assert.equal(result.fillRegions, overrides);
  assert.deepEqual(result.matches, []);
});

test("retains a fill across a resize when the layer has many nearby regions", () => {
  // Real line art has several enclosed pockets close together. Only the middle
  // one is coloured; the others must not block the geometric pairing.
  const previous = frame(
    [
      { id: "source:image-1:enclosed:980:1000", mapId: 1, kind: "enclosed" },
      { id: "source:image-1:enclosed:1000:1000", mapId: 2, kind: "enclosed" },
      { id: "source:image-1:enclosed:1020:1000", mapId: 3, kind: "enclosed" },
    ],
    [1, 1, 1, 1, 0, 2, 2, 2, 2, 0, 3, 3, 3, 3, 0, 0],
  );
  const next = frame(
    [
      { id: "source:image-1:enclosed:983:1002", mapId: 4, kind: "enclosed" },
      { id: "source:image-1:enclosed:1003:1004", mapId: 5, kind: "enclosed" },
      { id: "source:image-1:enclosed:1023:1001", mapId: 6, kind: "enclosed" },
    ],
    [4, 4, 4, 4, 4, 4, 4, 0, 5, 5, 5, 5, 5, 5, 5, 0],
  );

  const result = reconcileFillRegionOverrides({
    overrides: { "source:image-1:enclosed:1000:1000": "#000000" },
    previous,
    next,
  });

  assert.deepEqual(result.fillRegions, { "source:image-1:enclosed:1003:1004": "#000000" });
});

test("repeated resizes keep the fill as the region key drifts each time", () => {
  // Each settled frame re-keys the region; the override must follow every hop
  // rather than surviving only the first one.
  const sizes = [4, 6, 9, 6, 12, 5];
  const keys = ["1000:1000", "1006:1003", "998:1007", "1004:996", "1009:1005", "995:1001"];
  let overrides: Record<string, string> = { "source:image-1:enclosed:1000:1000": "#b0b0b0" };

  for (let step = 1; step < sizes.length; step += 1) {
    const build = (size: number, id: string, mapId: number) =>
      frame(
        [{ id: `source:image-1:enclosed:${id}`, mapId, kind: "enclosed" }],
        Array.from({ length: 16 }, (_unused, pixel) => (pixel < size ? mapId : 0)),
      );
    const result = reconcileFillRegionOverrides({
      overrides,
      previous: build(sizes[step - 1]!, keys[step - 1]!, step),
      next: build(sizes[step]!, keys[step]!, step + 1),
    });
    overrides = result.fillRegions;
    assert.deepEqual(
      overrides,
      { [`source:image-1:enclosed:${keys[step]}`]: "#b0b0b0" },
      `lost the fill at resize step ${step}`,
    );
  }
});

test("recovers a fill whose region disappeared while the layer was small", () => {
  // Shrinking far enough closes a thin pocket, so the previous frame has no
  // region carrying the colour at all. Enlarging reopens the pocket at the same
  // normalized spot, and the orphaned key must find it again.
  const previous = frame(
    [{ id: "source:image-1:enclosed:200:200", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1, 0, 0, 0, 0],
  );
  const next = frame(
    [
      { id: "source:image-1:enclosed:200:200", mapId: 1, kind: "enclosed" },
      { id: "source:image-1:enclosed:1002:998", mapId: 2, kind: "enclosed" },
    ],
    [1, 1, 1, 1, 2, 2, 2, 2],
  );

  const result = reconcileFillRegionOverrides({
    overrides: { "source:image-1:enclosed:1000:1000": "#000000" },
    previous,
    next,
  });

  assert.deepEqual(result.fillRegions, { "source:image-1:enclosed:1002:998": "#000000" });
});

test("an orphaned key is never stolen from the region that still owns it", () => {
  const previous = frame(
    [{ id: "source:image-1:enclosed:1000:1000", mapId: 1, kind: "enclosed" }],
    [1, 1, 1, 1, 0, 0, 0, 0],
  );
  const next = frame(
    [
      { id: "source:image-1:enclosed:1000:1000", mapId: 1, kind: "enclosed" },
      { id: "source:image-1:enclosed:1002:998", mapId: 2, kind: "enclosed" },
    ],
    [1, 1, 1, 1, 2, 2, 2, 2],
  );
  const overrides = { "source:image-1:enclosed:1000:1000": "#000000" };

  const result = reconcileFillRegionOverrides({ overrides, previous, next });

  assert.equal(result.fillRegions["source:image-1:enclosed:1000:1000"], "#000000");
  assert.equal("source:image-1:enclosed:1002:998" in result.fillRegions, false);
});
