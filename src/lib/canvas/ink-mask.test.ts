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

test("vectorized ink repairs only tiny enclosed low-coverage pinholes", () => {
  const imageData = createImageData(14, 14, [0, 0, 0]);
  imageData.data.fill(0);

  for (let y = 1; y <= 12; y += 1) {
    for (let x = 1; x <= 12; x += 1) setPixel(imageData, x, y, [0, 0, 0]);
  }

  // Seven mixed transparent/low-alpha pixels are a vectorization artifact and
  // should become opaque ink.
  const pinhole: Array<[number, number, number]> = [
    [3, 3, 0],
    [4, 3, 1],
    [5, 3, 80],
    [3, 4, 160],
    [4, 4, 0],
    [5, 4, 64],
    [4, 5, 0],
  ];
  for (const [x, y, alpha] of pinhole) setPixel(imageData, x, y, [0, 0, 0], alpha);

  // Eight pixels are large enough to remain a genuine fill pocket.
  const preservedHole: Array<[number, number]> = [
    [8, 8], [9, 8], [10, 8], [11, 8],
    [8, 9], [9, 9], [10, 9], [11, 9],
  ];
  for (const [x, y] of preservedHole) setPixel(imageData, x, y, [0, 0, 0], 0);

  // A low-alpha contour that reaches the exterior remains antialiased.
  setPixel(imageData, 0, 6, [0, 0, 0], 1);

  const result = maskFromVectorizedImageData(imageData);

  for (const [x, y] of pinhole) {
    const pixel = y * imageData.width + x;
    assert.equal(result.mask[pixel], 1);
    assert.equal(result.coverage[pixel], 255);
  }
  for (const [x, y] of preservedHole) {
    const pixel = y * imageData.width + x;
    assert.equal(result.mask[pixel], 0);
    assert.equal(result.coverage[pixel], 0);
  }
  assert.equal(result.mask[6 * imageData.width], 1);
  assert.equal(result.coverage[6 * imageData.width], 1);
});

test("repairs a pinhole ringed by antialiased ink", () => {
  // The regression this guards: a rasterized vector hole is always ringed by
  // partially transparent pixels. Treating those as part of the hole (a
  // coverage threshold does) grew a one-pixel hole by its eight-pixel rim,
  // exceeding the size budget and skipping the repair entirely — so solid
  // artwork rendered with white specks showing the paper and grid through it.
  for (const rimAlpha of [220, 150, 60, 32]) {
    const imageData = createImageData(11, 11, [0, 0, 0]);

    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      setPixel(imageData, 5 + dx, 5 + dy, [0, 0, 0], rimAlpha);
    }
    setPixel(imageData, 5, 5, [0, 0, 0], 0);

    const result = maskFromVectorizedImageData(imageData);
    const pixel = 5 * imageData.width + 5;
    assert.equal(result.mask[pixel], 1, `hole left open with rim alpha ${rimAlpha}`);
    assert.equal(result.coverage[pixel], 255, `hole not made opaque with rim alpha ${rimAlpha}`);
  }
});

test("leaves the outer contour's antialiasing untouched", () => {
  // Only enclosed islands are repaired. A shape's own soft edge reaches the
  // exterior, so it must keep its coverage — promoting it would thicken every
  // contour and lose the smooth edges the vector path exists to preserve.
  const imageData = createImageData(11, 11, [0, 0, 0]);
  imageData.data.fill(0);

  for (let y = 3; y <= 7; y += 1) {
    for (let x = 3; x <= 7; x += 1) setPixel(imageData, x, y, [0, 0, 0], 255);
  }
  // A soft edge on the outside of the block, continuous with the background.
  setPixel(imageData, 2, 5, [0, 0, 0], 120);

  const result = maskFromVectorizedImageData(imageData);

  assert.equal(result.coverage[5 * imageData.width + 2], 120);
  assert.equal(result.mask[5 * imageData.width + 0], 0);
});

test("treats a wholly faint island as a significant hole, not a pinhole", () => {
  // Boundary of the rule: the budget counts pixels that read as paper. A 3x3
  // island where even the rim is near-invisible is nine such pixels, past
  // thinning's significant-hole threshold of eight, so it stays a fill region
  // the user can colour rather than being silently painted solid.
  const imageData = createImageData(11, 11, [0, 0, 0]);
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
    setPixel(imageData, 5 + dx, 5 + dy, [0, 0, 0], 8);
  }
  setPixel(imageData, 5, 5, [0, 0, 0], 0);

  const result = maskFromVectorizedImageData(imageData);

  assert.equal(result.mask[5 * imageData.width + 5], 0);
});

test("still leaves a genuine enclosed pocket alone", () => {
  // Eight pixels is thinning's minimum significant hole, so this is a real fill
  // region the user can colour, not a rasterization artifact.
  const imageData = createImageData(13, 13, [0, 0, 0]);
  const pocket: Array<[number, number]> = [
    [5, 5], [6, 5], [7, 5], [8, 5],
    [5, 6], [6, 6], [7, 6], [8, 6],
  ];
  for (const [x, y] of pocket) setPixel(imageData, x, y, [0, 0, 0], 0);

  const result = maskFromVectorizedImageData(imageData);

  for (const [x, y] of pocket) {
    assert.equal(result.mask[y * imageData.width + x], 0, `pocket pixel ${x},${y} was swallowed`);
  }
});

test("never fills the exterior background", () => {
  // The flood reaches the canvas edge there, so the boundary check must stop it
  // regardless of how small the surrounding shape is.
  const imageData = createImageData(11, 11, [0, 0, 0]);
  for (let y = 0; y < 11; y += 1) {
    for (let x = 0; x < 11; x += 1) {
      if (x >= 4 && x <= 6 && y >= 4 && y <= 6) continue;
      setPixel(imageData, x, y, [0, 0, 0], 0);
    }
  }

  const result = maskFromVectorizedImageData(imageData);

  assert.equal(result.mask[0], 0);
  assert.equal(result.mask[5 * imageData.width + 5], 1);
});

test("solidifies antialiased seams between adjacent traced shapes", () => {
  // The vectorizer emits many adjacent filled paths, all normalised to solid
  // black. Rasterizing them antialiases each against its neighbour, so the
  // shared border composites to partial coverage. Those pixels are ink, so they
  // act as fill barriers, but drawn at reduced alpha they let the paper show
  // through as hairlines inside solid artwork.
  const imageData = createImageData(11, 11, [0, 0, 0]);
  for (let y = 0; y < 11; y += 1) setPixel(imageData, 5, y, [0, 0, 0], 190);

  const result = maskFromVectorizedImageData(imageData);

  // Interior seam pixels are restored to full opacity.
  for (let y = 1; y <= 9; y += 1) {
    assert.equal(result.coverage[y * imageData.width + 5], 255, `seam at y=${y} still translucent`);
  }
  // Pixels on the canvas edge have no full neighbourhood, so they are left be.
  assert.equal(result.coverage[5], 190);
});

test("does not solidify the outer contour's antialiasing", () => {
  // A soft edge facing the background must keep its coverage, or every contour
  // thickens and the vector path loses the smooth curves it exists to preserve.
  const imageData = createImageData(11, 11, [0, 0, 0]);
  imageData.data.fill(0);

  for (let y = 3; y <= 7; y += 1) {
    for (let x = 3; x <= 7; x += 1) setPixel(imageData, x, y, [0, 0, 0], 255);
  }
  for (let y = 3; y <= 7; y += 1) setPixel(imageData, 3, y, [0, 0, 0], 128);

  const result = maskFromVectorizedImageData(imageData);

  for (let y = 3; y <= 7; y += 1) {
    assert.equal(result.coverage[y * imageData.width + 3], 128, `contour edge at y=${y} was thickened`);
  }
});

test("keeps antialiasing around a genuine fill pocket", () => {
  // The rim faces a preserved hole, so promoting it would harden the edge of a
  // region the user can colour.
  const imageData = createImageData(15, 15, [0, 0, 0]);
  const pocket: Array<[number, number]> = [
    [6, 6], [7, 6], [8, 6], [9, 6],
    [6, 7], [7, 7], [8, 7], [9, 7],
  ];
  for (const [x, y] of pocket) setPixel(imageData, x, y, [0, 0, 0], 0);
  setPixel(imageData, 6, 5, [0, 0, 0], 140);

  const result = maskFromVectorizedImageData(imageData);

  assert.equal(result.mask[6 * imageData.width + 6], 0, "pocket was swallowed");
  assert.equal(result.coverage[5 * imageData.width + 6], 140, "pocket rim was hardened");
});
