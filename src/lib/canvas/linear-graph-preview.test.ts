import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CANVAS_PIXELS } from "./performance-limits.ts";
import {
  LINEAR_GRAPH_PREVIEW_BORDER_CELLS,
  LINEAR_GRAPH_PREVIEW_REPEAT_COUNT,
  createLinearGraphPreviewLayout,
  isLinearGraphPreviewTileMirrored,
} from "./linear-graph-preview.ts";

test("linear graph previews repeat ten centered graph images with five-cell borders", () => {
  const layout = createLinearGraphPreviewLayout({ sourceWidth: 800, sourceHeight: 5000, cellPixels: 40 });

  assert.equal(layout.repeatCount, LINEAR_GRAPH_PREVIEW_REPEAT_COUNT);
  assert.equal(layout.borderHeight, LINEAR_GRAPH_PREVIEW_BORDER_CELLS * 40);
  assert.equal(layout.repeatStripWidth, 8000);
  assert.equal(layout.repeatStripX, (layout.logicalWidth - layout.repeatStripWidth) / 2);
  assert.ok(layout.logicalWidth / layout.logicalHeight >= 16 / 9);
});

test("linear graph preview alternates original and horizontally mirrored tiles", () => {
  assert.equal(isLinearGraphPreviewTileMirrored(0), false);
  assert.equal(isLinearGraphPreviewTileMirrored(1), true);
  assert.equal(isLinearGraphPreviewTileMirrored(2), false);
});

test("linear graph previews downscale repeated large graphs before allocation", () => {
  const layout = createLinearGraphPreviewLayout({ sourceWidth: 3200, sourceHeight: 5000, cellPixels: 40 });

  assert.ok(layout.scale < 1);
  assert.ok(layout.width * layout.height <= MAX_CANVAS_PIXELS);
});
