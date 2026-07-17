import assert from "node:assert/strict";
import test from "node:test";
import { fullCrop, mapCropBetweenDimensions, normalizeCrop, normalizeCropRect, pixelCropFromNormalized, transformedImageSize } from "./crop.ts";

test("crop bounds are normalized without escaping native dimensions", () => {
  assert.deepEqual(normalizeCrop({ x: -4, y: 95, width: 300, height: 40 }, 200, 100), {
    x: 0,
    y: 95,
    width: 200,
    height: 5,
  });
  assert.deepEqual(fullCrop(640.4, 479.6), { x: 0, y: 0, width: 640, height: 480 });
});

test("quarter turns and straighten angles produce native transformed bounds", () => {
  assert.deepEqual(transformedImageSize(800, 600, 90, 0), {
    width: 600,
    height: 800,
    rotationDegrees: 90,
  });
  const straightened = transformedImageSize(800, 600, 0, 5);
  assert.ok(straightened.width > 800);
  assert.ok(straightened.height > 600);
  assert.equal(straightened.rotationDegrees, 5);
});

test("normalized batch crop maps consistently between compatible files", () => {
  assert.deepEqual(
    mapCropBetweenDimensions(
      { x: 100, y: 50, width: 600, height: 400 },
      { width: 1000, height: 500 },
      { width: 2000, height: 1000 },
    ),
    { x: 200, y: 100, width: 1200, height: 800 },
  );
});

test("normalized crop bounds round-trip at the native canvas boundary", () => {
  const normalized = normalizeCropRect({ x: 120, y: 80, width: 600, height: 320 }, 1200, 800);
  assert.deepEqual(normalized, { x: 0.1, y: 0.1, width: 0.5, height: 0.4 });
  assert.deepEqual(pixelCropFromNormalized(normalized, 2400, 1600), { x: 240, y: 160, width: 1200, height: 640 });
});
