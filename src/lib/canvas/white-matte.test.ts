import assert from "node:assert/strict";
import test from "node:test";
import { unmatteWhiteBackgroundImageData } from "./white-matte.ts";

function image(data: number[]) {
  return { width: data.length / 4, height: 1, data: new Uint8ClampedArray(data) };
}

test("removes an opaque white matte completely", () => {
  const source = image([255, 255, 255, 255]);
  const result = unmatteWhiteBackgroundImageData(source);

  assert.deepEqual(Array.from(result.data), [0, 0, 0, 0]);
  assert.deepEqual(Array.from(source.data), [255, 255, 255, 255]);
});

test("converts a grey antialiased edge into translucent black without a white halo", () => {
  const result = unmatteWhiteBackgroundImageData(image([224, 224, 224, 255]));

  assert.deepEqual(Array.from(result.data), [0, 0, 0, 31]);
});

test("retains a coloured foreground while removing its white matte", () => {
  // A 25%-opaque red pixel composited over white becomes (255, 191, 191).
  const result = unmatteWhiteBackgroundImageData(image([
    255, 191, 191, 255,
    255, 0, 0, 255,
  ]));

  assert.deepEqual(Array.from(result.data), [255, 0, 0, 64, 255, 0, 0, 255]);
});

test("respects source alpha and keeps transparent pixels transparent", () => {
  const result = unmatteWhiteBackgroundImageData(image([
    128, 128, 128, 128,
    30, 90, 180, 0,
  ]));

  assert.deepEqual(Array.from(result.data), [0, 0, 0, 64, 0, 0, 0, 0]);
});

test("clears near-white compression residue instead of turning it into faint specks", () => {
  const result = unmatteWhiteBackgroundImageData(image([250, 250, 250, 255]));

  assert.deepEqual(Array.from(result.data), [0, 0, 0, 0]);
});
