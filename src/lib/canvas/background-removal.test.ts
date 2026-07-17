import assert from "node:assert/strict";
import test from "node:test";
import { removeBackgroundImageData } from "./background-removal.ts";

function solidBackgroundWithSubject() {
  // 6x6 image: white background, a 2x2 black subject in the middle.
  const width = 6;
  const height = 6;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const x = i % width;
    const y = (i - x) / width;
    const subject = x >= 2 && x <= 3 && y >= 2 && y <= 3;
    const value = subject ? 0 : 255;
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

function alphaAt(image: { width: number; data: Uint8ClampedArray | Uint8Array }, x: number, y: number) {
  return image.data[(y * image.width + x) * 4 + 3];
}

test("removes the uniform background but keeps the subject opaque", () => {
  const image = solidBackgroundWithSubject();
  const result = removeBackgroundImageData(image, 0.1);
  assert.equal(alphaAt(result, 0, 0), 0, "corner background should be transparent");
  assert.equal(alphaAt(result, 5, 5), 0, "opposite corner background should be transparent");
  assert.equal(alphaAt(result, 2, 2), 255, "subject pixel should stay opaque");
  assert.equal(alphaAt(result, 3, 3), 255, "subject pixel should stay opaque");
});

test("does not mutate the input image data", () => {
  const image = solidBackgroundWithSubject();
  const before = Uint8ClampedArray.from(image.data);
  removeBackgroundImageData(image, 0.2);
  assert.deepEqual(Array.from(image.data), Array.from(before));
});

test("a fully uniform image has its background cleared", () => {
  const width = 4;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const result = removeBackgroundImageData({ width, height, data }, 0.05);
  assert.equal(alphaAt(result, 1, 1), 0);
  assert.equal(alphaAt(result, 2, 2), 0);
});
