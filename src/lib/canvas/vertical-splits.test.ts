import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  clearVerticalSplitMaskColumns,
  isCellInVerticalSplit,
  normalizeVerticalSplits,
  verticalSplitBoundaryPixelPositions,
  verticalSplitPixelRanges,
} from "./vertical-splits.ts";

const splitOverlaySource = readFileSync(
  new URL("../../components/editor/graph-vertical-split-overlay.tsx", import.meta.url),
  "utf8",
);
const processorSource = readFileSync(new URL("./processor.ts", import.meta.url), "utf8");

test("vertical splits normalize, clamp, and merge blank cell ranges", () => {
  assert.deepEqual(
    normalizeVerticalSplits(
      [
        { startCell: 9, endCell: 8 },
        { startCell: 5, endCell: 6 },
        { startCell: 20, endCell: 30 },
        { startCell: Number.NaN, endCell: 4 },
      ],
      12,
    ),
    [
      { startCell: 5, endCell: 6 },
      { startCell: 8, endCell: 10 },
    ],
  );
  assert.deepEqual(normalizeVerticalSplits([{ startCell: 2, endCell: 4 }], 2), []);
});

test("vertical split ranges use grid numbers after the left gutter and retain the graph width", () => {
  const splits = normalizeVerticalSplits([{ startCell: 5, endCell: 7 }], 12);

  assert.deepEqual(verticalSplitPixelRanges(splits, 12, 480), [{ startX: 200, endX: 320 }]);
  assert.deepEqual(verticalSplitBoundaryPixelPositions(splits, 12, 480), [200, 320]);
  assert.equal(isCellInVerticalSplit(4, splits), false);
  assert.equal(isCellInVerticalSplit(5, splits), true);
  assert.equal(isCellInVerticalSplit(7, splits), true);
  assert.equal(isCellInVerticalSplit(8, splits), false);
});

test("vertical split masking clears only the selected columns", () => {
  const mask = new Uint8Array(20).fill(1);
  clearVerticalSplitMaskColumns(mask, 10, 2, [{ startCell: 2, endCell: 3 }], 5);

  assert.deepEqual(Array.from(mask), [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1]);
});

test("split blanks redraw unclipped bold boundary strokes after masking", () => {
  assert.ok(splitOverlaySource.indexOf("<rect") < splitOverlaySource.indexOf("<path"));
  assert.match(splitOverlaySource, /overflow: "visible"/);
  assert.match(splitOverlaySource, /GRID_BUCKET_WIDTH_UNITS\.major/);
  assert.ok(
    processorSource.indexOf("drawVerticalSplitBlankSpace(output, settings);") <
      processorSource.indexOf("drawVerticalSplitBoundaryLines(output, settings);"),
  );
});
