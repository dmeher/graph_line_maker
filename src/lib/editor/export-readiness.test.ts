import assert from "node:assert/strict";
import test from "node:test";
import { graphExportBlockReason, type GraphExportReadinessInput } from "./export-readiness.ts";

function settledInput(overrides: Partial<GraphExportReadinessInput> = {}): GraphExportReadinessInput {
  return {
    currentRenderFailed: false,
    processing: false,
    hasDragPreview: false,
    renderedSignature: "10|112|current",
    currentSignature: "10|112|current",
    canvas: { width: 400, height: 4480 },
    expectedCanvasWidth: 400,
    expectedCanvasHeight: 4480,
    ...overrides,
  };
}

test("export readiness blocks the queued debounce frame", () => {
  assert.equal(
    graphExportBlockReason(
      settledInput({
        renderedSignature: "20|112|previous",
        currentSignature: "10|112|current",
      }),
    ),
    "outdated-frame",
  );
});

test("export readiness blocks a stale canvas whose cells no longer match the graph", () => {
  assert.equal(
    graphExportBlockReason(
      settledInput({
        canvas: { width: 800, height: 4480 },
      }),
    ),
    "outdated-frame",
  );
});

test("export readiness permits only a settled current graph frame", () => {
  assert.equal(graphExportBlockReason(settledInput()), null);
});

test("export readiness blocks active, dragging, missing, and failed frames", () => {
  assert.equal(graphExportBlockReason(settledInput({ processing: true })), "processing");
  assert.equal(graphExportBlockReason(settledInput({ hasDragPreview: true })), "drag-preview");
  assert.equal(graphExportBlockReason(settledInput({ canvas: null })), "missing-canvas");
  assert.equal(graphExportBlockReason(settledInput({ currentRenderFailed: true })), "failed-render");
});
