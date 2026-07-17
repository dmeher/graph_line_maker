import assert from "node:assert/strict";
import test from "node:test";
import { detectArtworkBounds } from "./artwork-detection.ts";

function image(width: number, height: number, background: [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) data.set(background, pixel * 4);
  return { width, height, data };
}

function fillRect(
  target: ReturnType<typeof image>,
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number, number],
) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      target.data.set(color, (row * target.width + column) * 4);
    }
  }
}

test("detect artwork finds tight line-art bounds on a light background", () => {
  const target = image(80, 60, [250, 250, 248, 255]);
  fillRect(target, 20, 12, 38, 2, [18, 24, 38, 255]);
  fillRect(target, 20, 12, 2, 34, [18, 24, 38, 255]);
  fillRect(target, 56, 12, 2, 34, [18, 24, 38, 255]);
  fillRect(target, 20, 44, 38, 2, [18, 24, 38, 255]);

  const result = detectArtworkBounds(target);
  assert.equal(result.reason, "detected");
  assert.ok(result.confidence > 0.5);
  assert.deepEqual(result.crop, { x: 19, y: 11, width: 40, height: 36 });
});

test("detect artwork supports transparent images", () => {
  const target = image(50, 50, [0, 0, 0, 0]);
  fillRect(target, 8, 10, 20, 18, [0, 0, 0, 255]);
  const result = detectArtworkBounds(target);
  assert.ok(result.crop);
  assert.deepEqual(result.crop, { x: 7, y: 9, width: 22, height: 20 });
});

test("detect artwork ignores isolated border noise", () => {
  const target = image(100, 70, [255, 255, 255, 255]);
  fillRect(target, 25, 18, 45, 28, [20, 20, 20, 255]);
  fillRect(target, 2, 2, 1, 1, [0, 0, 0, 255]);
  fillRect(target, 96, 64, 1, 1, [0, 0, 0, 255]);
  const result = detectArtworkBounds(target);
  assert.deepEqual(result.crop, { x: 24, y: 17, width: 47, height: 30 });
});

test("detect artwork leaves an empty uniform image unchanged", () => {
  const target = image(40, 30, [232, 238, 244, 255]);
  const result = detectArtworkBounds(target);
  assert.equal(result.crop, null);
  assert.equal(result.reason, "empty");
});
