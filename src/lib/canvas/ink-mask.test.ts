import assert from "node:assert/strict";
import test from "node:test";
import { maskFromImageData, maskFromVectorizedImageData } from "./ink-mask.ts";

function createImageData(width: number, height: number, color: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = color[0];
    data[index + 1] = color[1];
    data[index + 2] = color[2];
    data[index + 3] = 255;
  }
  return { width, height, data };
}

function setPixel(
  imageData: ReturnType<typeof createImageData>,
  x: number,
  y: number,
  color: [number, number, number],
  alpha = 255,
) {
  const index = (y * imageData.width + x) * 4;
  imageData.data[index] = color[0];
  imageData.data[index + 1] = color[1];
  imageData.data[index + 2] = color[2];
  imageData.data[index + 3] = alpha;
}

test("ink mask ignores textured paper and isolated dark specks", () => {
  const imageData = createImageData(12, 12, [248, 245, 239]);

  for (let x = 2; x <= 9; x += 1) setPixel(imageData, x, 6, [16, 16, 16]);
  setPixel(imageData, 1, 1, [184, 174, 160]);
  setPixel(imageData, 10, 10, [178, 166, 152]);
  setPixel(imageData, 3, 2, [222, 214, 203]);

  const result = maskFromImageData(imageData);

  assert.ok(result.threshold < 238);
  assert.equal(result.mask[1 * 12 + 1], 0);
  assert.equal(result.mask[10 * 12 + 10], 0);
  assert.equal(result.mask[2 * 12 + 3], 0);
  for (let x = 2; x <= 9; x += 1) assert.equal(result.mask[6 * 12 + x], 1);
});

test("vectorized ink mask preserves every visible SVG contour pixel", () => {
  const imageData = createImageData(20, 20, [0, 0, 0]);
  imageData.data.fill(0);
  setPixel(imageData, 2, 3, [0, 0, 0]);
  setPixel(imageData, 15, 16, [0, 0, 0]);
  setPixel(imageData, 10, 11, [0, 0, 0], 1);

  const result = maskFromVectorizedImageData(imageData);

  assert.equal(result.count, 3);
  assert.equal(result.mask[3 * 20 + 2], 1);
  assert.equal(result.mask[11 * 20 + 10], 1);
  assert.equal(result.mask[16 * 20 + 15], 1);
  assert.equal(result.coverage[3 * 20 + 2], 255);
  assert.equal(result.coverage[11 * 20 + 10], 1);
  assert.equal(result.coverage[16 * 20 + 15], 255);
});
