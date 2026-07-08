import assert from "node:assert/strict";
import test from "node:test";
import { cropQueueItemId, cropQueueStatus, shouldCropQueuedFile } from "./crop-queue.ts";

const fileLike = {
  name: "source.png",
  size: 1234,
  lastModified: 1786021916000,
};

test("crop queue item ids include file metadata and queue index", () => {
  assert.equal(cropQueueItemId(fileLike, 2), "source.png-1234-1786021916000-2");
});

test("crop queue status distinguishes full image from edited crops", () => {
  assert.equal(cropQueueStatus(null), "Full image");
  assert.equal(cropQueueStatus({ x: 2, y: 3, width: 40, height: 50 }), "Cropped");
});

test("queued files are cropped only when a crop and preview are available", () => {
  assert.equal(shouldCropQueuedFile(null, "blob:preview"), false);
  assert.equal(shouldCropQueuedFile({ x: 0, y: 0, width: 10, height: 10 }, null), false);
  assert.equal(shouldCropQueuedFile({ x: 0, y: 0, width: 10, height: 10 }, "blob:preview"), true);
});
