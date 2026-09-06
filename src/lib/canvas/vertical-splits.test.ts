import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isCellInVerticalSplit,
  isGraphXInVerticalSplit,
  normalizeVerticalSplits,
  verticalSplitBoundaryPixelPositions,
  verticalSplitPixelRanges,
  verticalSplitSignature,
} from "./vertical-splits.ts";

const splitOverlaySource = readFileSync(
  new URL("../../components/editor/graph-vertical-split-overlay.tsx", import.meta.url),
  "utf8",
);
const processorSource = readFileSync(new URL("./processor.ts", import.meta.url), "utf8");
const editorSource = readFileSync(
  new URL("../../components/editor/editor-client.tsx", import.meta.url),
  "utf8",
);

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

test("vertical split hit testing follows the numbered graph-space range", () => {
  const splits = [{ startCell: 2, endCell: 3 }];
  assert.equal(isGraphXInVerticalSplit(0.999, splits), false);
  assert.equal(isGraphXInVerticalSplit(1, splits), false);
  assert.equal(isGraphXInVerticalSplit(2, splits), true);
  assert.equal(isGraphXInVerticalSplit(3.999, splits), true);
  assert.equal(isGraphXInVerticalSplit(4, splits), false);
  assert.equal(verticalSplitSignature([{ startCell: 3, endCell: 2 }], 5), "5:2-3");
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

test("split edits bypass full canvas processing and refresh flattened output lazily", () => {
  const signatureStart = editorSource.indexOf("function buildProcessingSignature");
  const signatureEnd = editorSource.indexOf("function hasSameProcessingSettings", signatureStart);
  assert.ok(signatureStart >= 0 && signatureEnd > signatureStart);
  assert.doesNotMatch(editorSource.slice(signatureStart, signatureEnd), /verticalSplits/);
  assert.doesNotMatch(editorSource, /renderKey,\s*settings,\s*sourceLoadSettled/);
  assert.match(editorSource, /function hasSameProcessingSettings/);
  assert.match(editorSource, /if \(key === "verticalSplits"\)/);
  assert.match(editorSource, /const splitOnlyCommand = command\.patches\.every/);
  assert.match(editorSource, /function ensureProcessedCanvasForSettings/);
  assert.match(editorSource, /isGraphXInVerticalSplit\(graphX, current\.verticalSplits\)/);
  assert.doesNotMatch(processorSource, /maskVerticalSplitProcessingData|clearVerticalSplitArtwork/);
});
