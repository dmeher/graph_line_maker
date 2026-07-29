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
