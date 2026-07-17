import assert from "node:assert/strict";
import test from "node:test";
import { fullCrop, mapCropBetweenDimensions, normalizeCrop, normalizeCropRect, pixelCropFromNormalized, quickCropSegment, quickCropWithin, transformedImageSize } from "./crop.ts";

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

test("quick crop selects every half and quarter of an even-sized image", () => {
  const expected = {
    left: { x: 0, y: 0, width: 400, height: 300 },
    right: { x: 400, y: 0, width: 400, height: 300 },
    top: { x: 0, y: 0, width: 800, height: 150 },
    bottom: { x: 0, y: 150, width: 800, height: 150 },
    "top-left": { x: 0, y: 0, width: 400, height: 150 },
    "top-right": { x: 400, y: 0, width: 400, height: 150 },
    "bottom-left": { x: 0, y: 150, width: 400, height: 150 },
    "bottom-right": { x: 400, y: 150, width: 400, height: 150 },
  } as const;

  for (const [segment, crop] of Object.entries(expected)) {
    assert.deepEqual(quickCropSegment(800, 300, segment as keyof typeof expected), crop);
  }
});

test("quick crop preserves every pixel across odd-sized split boundaries", () => {
  assert.deepEqual(quickCropSegment(801, 301, "left"), { x: 0, y: 0, width: 400, height: 301 });
  assert.deepEqual(quickCropSegment(801, 301, "right"), { x: 400, y: 0, width: 401, height: 301 });
  assert.deepEqual(quickCropSegment(801, 301, "bottom-right"), { x: 400, y: 150, width: 401, height: 151 });
});

test("quick crop stays valid when an image cannot be split on one axis", () => {
  assert.deepEqual(quickCropSegment(1, 7, "right"), { x: 0, y: 0, width: 1, height: 7 });
  assert.deepEqual(quickCropSegment(7, 1, "bottom"), { x: 0, y: 0, width: 7, height: 1 });
  assert.deepEqual(quickCropSegment(1, 1, "bottom-right"), { x: 0, y: 0, width: 1, height: 1 });
});

test("quick crop refines the current detected artwork bounds", () => {
  const detectedArtwork = { x: 37, y: 53, width: 301, height: 201 };

  assert.deepEqual(quickCropWithin(detectedArtwork, "top-right"), {
    x: 187,
    y: 53,
    width: 151,
    height: 100,
  });
  assert.deepEqual(quickCropWithin(detectedArtwork, "bottom-left"), {
    x: 37,
    y: 153,
    width: 150,
    height: 101,
  });
});
