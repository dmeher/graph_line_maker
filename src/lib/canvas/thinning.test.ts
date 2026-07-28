import assert from "node:assert/strict";
import test from "node:test";
import { createEnclosedRegionMask, createThinArtworkMasks, expandMaskForLineSize } from "./thinning.ts";

function createMask(width: number, height: number) {
  return new Uint8Array(width * height);
}

function fillRect(mask: Uint8Array, width: number, x: number, y: number, rectWidth: number, rectHeight: number) {
  for (let yy = y; yy < y + rectHeight; yy += 1) {
    for (let xx = x; xx < x + rectWidth; xx += 1) {
      mask[yy * width + xx] = 1;
    }
  }
}

function setPixels(mask: Uint8Array, width: number, pixels: Array<[number, number]>) {
  for (const [x, y] of pixels) {
    mask[y * width + x] = 1;
  }
}

function drawSegment(mask: Uint8Array, width: number, start: [number, number], end: [number, number]) {
  let [x, y] = start;
  const [endX, endY] = end;
  const dx = Math.abs(endX - x);
  const dy = Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  let error = dx - dy;

  while (true) {
    mask[y * width + x] = 1;
    if (x === endX && y === endY) break;
    const doubledError = error * 2;
    if (doubledError > -dy) {
      error -= dy;
      x += stepX;
    }
    if (doubledError < dx) {
      error += dx;
      y += stepY;
    }
  }
}

function count(mask: Uint8Array) {
  return mask.reduce((sum, value) => sum + value, 0);
}

function maskEquals(actual: Uint8Array, expected: Uint8Array) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    assert.equal(actual[index], expected[index], `mask differs at pixel ${index}`);
  }
}

function componentCount(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let components = 0;

  function enqueue(index: number, tail: number) {
    if (visited[index] || !mask[index]) return tail;
    visited[index] = 1;
    queue[tail] = index;
    return tail + 1;
  }

  for (let start = 0; start < mask.length; start += 1) {
    if (visited[start] || !mask[start]) continue;
    components += 1;
    let head = 0;
    let tail = enqueue(start, 0);
    while (head < tail) {
      const index = queue[head];
      head += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) {
          tail = enqueue(yy * width + xx, tail);
        }
      }
    }
  }

  return components;
}

test("three generated line segments form a fillable enclosed region", () => {
  const width = 24;
  const height = 18;
  const barrier = createMask(width, height);
  drawSegment(barrier, width, [5, 13], [12, 3]);
  drawSegment(barrier, width, [12, 3], [19, 13]);
  drawSegment(barrier, width, [19, 13], [5, 13]);

  const enclosed = createEnclosedRegionMask(barrier, width, height);

  assert.ok(count(enclosed) > 0);
  assert.equal(enclosed[9 * width + 12], 1);
  assert.equal(enclosed[1 * width + 1], 0);
});

test("an open generated-line barrier does not create a fillable region", () => {
  const width = 24;
  const height = 18;
  const barrier = createMask(width, height);
  drawSegment(barrier, width, [5, 13], [12, 3]);
  drawSegment(barrier, width, [12, 3], [19, 13]);
  drawSegment(barrier, width, [19, 13], [5, 13]);
  barrier[13 * width + 12] = 0;

  const enclosed = createEnclosedRegionMask(barrier, width, height);

  assert.equal(count(enclosed), 0);
});

test("thick stroke components thin without breaking apart", () => {
  const width = 24;
  const height = 24;
  const mask = createMask(width, height);
  fillRect(mask, width, 3, 10, 16, 5);
  fillRect(mask, width, 12, 4, 3, 12);

  const result = createThinArtworkMasks(mask, width, height, { strokeGapClosePixels: 0 });

  assert.equal(count(result.fillMask), 0);
  assert.ok(count(result.strokeMask) < count(mask));
  assert.equal(componentCount(result.strokeMask, width, height), 1);
});

test("vectorized contours bypass legacy thinning and scanline cleanup", () => {
  const width = 40;
  const height = 18;
  const mask = createMask(width, height);
  fillRect(mask, width, 3, 3, 30, 1);
  fillRect(mask, width, 5, 9, 24, 5);

  const result = createThinArtworkMasks(mask, width, height, {
    preserveSourceInk: true,
    strokeGapClosePixels: 2,
  });

  maskEquals(result.outlineMask, mask);
  maskEquals(result.strokeMask, mask);
  assert.equal(count(result.sourceFillMask), 0);
  assert.equal(count(result.fillMask), count(result.enclosedFillMask));
});

test("curved diagonal line art remains connected and faithful", () => {
  const width = 18;
  const height = 18;
  const mask = createMask(width, height);
  setPixels(mask, width, [
    [3, 13],
    [4, 12],
    [5, 11],
    [6, 10],
    [7, 9],
    [8, 8],
    [9, 8],
    [10, 7],
    [11, 6],
    [12, 5],
    [13, 4],
  ]);

  const result = createThinArtworkMasks(mask, width, height, { strokeGapClosePixels: 0 });

  assert.equal(count(result.fillMask), 0);
  maskEquals(result.strokeMask, mask);
});

test("isolated scanned paper lines are removed from the artwork mask", () => {
  const width = 40;
  const height = 18;
  const mask = createMask(width, height);
  fillRect(mask, width, 3, 3, 30, 1);
  setPixels(mask, width, [
    [10, 12],
    [11, 11],
    [12, 10],
    [13, 9],
    [14, 8],
    [15, 7],
    [16, 7],
    [17, 6],
    [18, 5],
  ]);

  const result = createThinArtworkMasks(mask, width, height, { strokeGapClosePixels: 0 });

  for (let x = 3; x < 33; x += 1) {
    assert.equal(result.strokeMask[3 * width + x], 0);
  }
  assert.equal(count(result.strokeMask), 9);
});

test("fixed line size 3 expansion adds one pixel around source strokes", () => {
  const width = 9;
  const height = 9;
  const mask = createMask(width, height);
  fillRect(mask, width, 4, 2, 1, 5);

  const expanded = expandMaskForLineSize(mask, width, height, 3);

  assert.equal(count(expanded), 21);
  for (let y = 2; y <= 6; y += 1) {
    assert.equal(expanded[y * width + 3], 1);
    assert.equal(expanded[y * width + 4], 1);
    assert.equal(expanded[y * width + 5], 1);
  }
});

test("line size increases outline thickness monotonically", () => {
  const width = 16;
  const height = 16;
  const mask = createMask(width, height);
  fillRect(mask, width, 8, 4, 1, 8);

  const thin = expandMaskForLineSize(mask, width, height, 0);
  const medium = expandMaskForLineSize(mask, width, height, 3);
  const thick = expandMaskForLineSize(mask, width, height, 6);

  assert.ok(count(thin) < count(medium));
  assert.ok(count(medium) < count(thick));
});

test("solid filled rectangle remains filled with a thin boundary", () => {
  const width = 14;
  const height = 14;
  const mask = createMask(width, height);
  fillRect(mask, width, 4, 4, 6, 6);

  const result = createThinArtworkMasks(mask, width, height, { strokeGapClosePixels: 0 });

  assert.equal(count(result.fillMask), 36);
  assert.equal(count(result.strokeMask), 0);
  assert.ok(count(result.outlineMask) > 0);
  assert.equal(result.fillMask[6 * width + 6], 1);
});

test("hollow thick rectangle fills its closed interior only", () => {
  const width = 16;
  const height = 16;
  const mask = createMask(width, height);
  fillRect(mask, width, 3, 3, 10, 3);
  fillRect(mask, width, 3, 10, 10, 3);
  fillRect(mask, width, 3, 3, 3, 10);
  fillRect(mask, width, 10, 3, 3, 10);

  const result = createThinArtworkMasks(mask, width, height, { strokeGapClosePixels: 0 });

  assert.equal(count(result.fillMask), 16);
  assert.equal(result.fillMask[7 * width + 7], 1);
  assert.equal(result.fillMask[1 * width + 1], 0);
  assert.ok(count(result.strokeMask) < count(mask));
  assert.equal(componentCount(result.strokeMask, width, height), 1);
});

test("open outline does not create a fillable section", () => {
  const width = 16;
  const height = 16;
  const mask = createMask(width, height);
  fillRect(mask, width, 3, 10, 10, 1);
  fillRect(mask, width, 3, 3, 1, 8);
  fillRect(mask, width, 12, 3, 1, 8);

  const result = createThinArtworkMasks(mask, width, height, { strokeGapClosePixels: 0 });

  assert.equal(count(result.fillMask), 0);
  assert.equal(result.strokeMask[10 * width + 8], 1);
});

test("separate closed sections become separate fillable regions", () => {
  const width = 20;
  const height = 14;
  const mask = createMask(width, height);
  fillRect(mask, width, 2, 2, 5, 1);
  fillRect(mask, width, 2, 6, 5, 1);
  fillRect(mask, width, 2, 2, 1, 5);
  fillRect(mask, width, 6, 2, 1, 5);
  fillRect(mask, width, 10, 3, 5, 1);
  fillRect(mask, width, 10, 7, 5, 1);
  fillRect(mask, width, 10, 3, 1, 5);
  fillRect(mask, width, 14, 3, 1, 5);

  const result = createThinArtworkMasks(mask, width, height, { strokeGapClosePixels: 0 });

  assert.equal(count(result.fillMask), 18);
  assert.equal(componentCount(result.fillMask, width, height), 2);
  assert.equal(result.fillMask[4 * width + 4], 1);
  assert.equal(result.fillMask[5 * width + 12], 1);
  assert.equal(result.fillMask[1 * width + 1], 0);
});

test("source fill and adjacent closed pocket stay in separate fill layers", () => {
  const width = 18;
  const height = 14;
  const mask = createMask(width, height);
  fillRect(mask, width, 3, 3, 7, 8);
  fillRect(mask, width, 9, 3, 6, 1);
  fillRect(mask, width, 9, 10, 6, 1);
  fillRect(mask, width, 14, 3, 1, 8);

  const result = createThinArtworkMasks(mask, width, height, {
    sourceFillMinStrokePixels: 7,
    sourceFillThreshold: 0.58,
    strokeGapClosePixels: 0,
  });

  assert.equal(result.sourceFillMask[6 * width + 6], 1);
  assert.equal(result.enclosedFillMask[6 * width + 12], 1);
  assert.equal(result.sourceFillMask[6 * width + 12], 0);
  assert.equal(result.enclosedFillMask[6 * width + 6], 0);
  assert.equal(componentCount(result.sourceFillMask, width, height), 1);
  assert.equal(componentCount(result.enclosedFillMask, width, height), 1);
});

test("mixed filled shape plus thick line produces one fill and one faithful stroke", () => {
  const width = 26;
  const height = 16;
  const mask = createMask(width, height);
  fillRect(mask, width, 2, 3, 5, 5);
  fillRect(mask, width, 12, 9, 10, 3);

  const result = createThinArtworkMasks(mask, width, height, { strokeGapClosePixels: 0 });

  assert.equal(count(result.fillMask), 25);
  assert.ok(count(result.strokeMask) > 0);
  assert.ok(count(result.strokeMask) < 30);
  assert.equal(result.fillMask[5 * width + 4], 1);
});

test("source strokes at or above fill width become fill regions", () => {
  const width = 34;
  const height = 16;
  const mask = createMask(width, height);
  fillRect(mask, width, 3, 5, 26, 7);

  const result = createThinArtworkMasks(mask, width, height, {
    sourceFillMinStrokePixels: 7,
    sourceFillThreshold: 0.58,
    strokeGapClosePixels: 0,
  });

  assert.equal(count(result.fillMask), 182);
  assert.equal(count(result.strokeMask), 0);
  assert.equal(result.fillMask[8 * width + 16], 1);
});

test("source strokes below fill width stay as thinned line work", () => {
  const width = 34;
  const height = 16;
  const mask = createMask(width, height);
  fillRect(mask, width, 3, 6, 26, 5);

  const result = createThinArtworkMasks(mask, width, height, {
    sourceFillMinStrokePixels: 7,
    sourceFillThreshold: 0.58,
    strokeGapClosePixels: 0,
  });

  assert.equal(count(result.fillMask), 0);
  assert.ok(count(result.strokeMask) > 0);
  assert.ok(count(result.strokeMask) < count(mask));
});

test("tapered wide branch remains fill while thin connected detail stays line", () => {
  const width = 34;
  const height = 24;
  const mask = createMask(width, height);
  fillRect(mask, width, 10, 3, 8, 8);
  fillRect(mask, width, 11, 11, 6, 4);
  fillRect(mask, width, 12, 15, 5, 3);
  fillRect(mask, width, 17, 12, 10, 1);

  const result = createThinArtworkMasks(mask, width, height, {
    sourceFillMinStrokePixels: 7,
    sourceFillThreshold: 0.58,
    strokeGapClosePixels: 0,
  });

  assert.equal(result.fillMask[16 * width + 14], 1);
  assert.equal(result.fillMask[12 * width + 26], 0);
  assert.equal(result.strokeMask[12 * width + 26], 1);
});
