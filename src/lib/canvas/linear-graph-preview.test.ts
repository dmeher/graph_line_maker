import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CANVAS_PIXELS } from "./performance-limits.ts";
import {
  LINEAR_GRAPH_PREVIEW_BORDER_CELLS,
  LINEAR_GRAPH_PREVIEW_REPEAT_COUNT,
  LINEAR_GRAPH_PREVIEW_SIDE_PADDING_CELLS,
  LINEAR_GRAPH_PREVIEW_WIDTH_CELLS,
  createLinearGraphPreviewLayout,
  isLinearGraphPreviewTileMirrored,
} from "./linear-graph-preview.ts";

test("linear graph previews use a fixed 200-cell canvas and omit its edge padding", () => {
  const layout = createLinearGraphPreviewLayout({ sourceWidth: 800, sourceHeight: 5000, cellPixels: 40 });

  assert.equal(layout.repeatCount, LINEAR_GRAPH_PREVIEW_REPEAT_COUNT);
  assert.equal(layout.borderHeight, LINEAR_GRAPH_PREVIEW_BORDER_CELLS * 40);
  assert.equal(layout.logicalWidth, LINEAR_GRAPH_PREVIEW_WIDTH_CELLS * 40);
  assert.equal(layout.sourceContentX, LINEAR_GRAPH_PREVIEW_SIDE_PADDING_CELLS * 40);
  assert.equal(layout.sourceContentWidth, 720);
  assert.equal(layout.repeatStripWidth, 7200);
  assert.equal(layout.repeatStripX, (layout.logicalWidth - layout.repeatStripWidth) / 2);
});

test("linear graph previews retain narrow graphs that have no interior column", () => {
  const layout = createLinearGraphPreviewLayout({ sourceWidth: 80, sourceHeight: 120, cellPixels: 40 });

  assert.equal(layout.sourceContentX, 0);
  assert.equal(layout.sourceContentWidth, 80);
});

test("linear graph previews scale a wide repeat strip into the 200-cell canvas", () => {
  const layout = createLinearGraphPreviewLayout({ sourceWidth: 4000, sourceHeight: 5000, cellPixels: 40 });

  assert.equal(layout.repeatStripWidth, LINEAR_GRAPH_PREVIEW_WIDTH_CELLS * 40);
  assert.ok(layout.repeatTileScale < 1);
});

test("linear graph preview alternates original and horizontally mirrored tiles", () => {
  assert.equal(isLinearGraphPreviewTileMirrored(0), false);
  assert.equal(isLinearGraphPreviewTileMirrored(1), true);
  assert.equal(isLinearGraphPreviewTileMirrored(2), false);
});

test("linear graph previews downscale a tall 200-cell canvas before allocation", () => {
  const layout = createLinearGraphPreviewLayout({ sourceWidth: 800, sourceHeight: 5000, cellPixels: 40 });

  assert.ok(layout.scale < 1);
  assert.ok(layout.width * layout.height <= MAX_CANVAS_PIXELS);
});
