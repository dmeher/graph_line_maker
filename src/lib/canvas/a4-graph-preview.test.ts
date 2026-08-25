import assert from "node:assert/strict";
import test from "node:test";
import {
  A4_PREVIEW_BORDER_OPTIONS,
  A4_PREVIEW_DPI,
  A4_PREVIEW_LANDSCAPE_THRESHOLD_CM,
  A4_PREVIEW_REPEAT_COUNT,
  createA4GraphPreviewLayout,
  setPngResolution,
} from "./a4-graph-preview.ts";

test("A4 preview offers supplied, Sambalpuri-inspired, and modern border collections", () => {
  const sambalpuriBorders = A4_PREVIEW_BORDER_OPTIONS.filter((border) => border.id.startsWith("sambalpuri-"));
  const modernBorders = A4_PREVIEW_BORDER_OPTIONS.filter((border) => border.id.startsWith("modern-"));

  assert.equal(A4_PREVIEW_BORDER_OPTIONS.length, 15);
  assert.equal(new Set(A4_PREVIEW_BORDER_OPTIONS.map((border) => border.path)).size, 15);
  assert.deepEqual(sambalpuriBorders.map((border) => border.id), [
    "sambalpuri-pasapali",
    "sambalpuri-shankha-chakra",
    "sambalpuri-padma-vine",
    "sambalpuri-machha-jali",
    "sambalpuri-temple-rudraksha",
  ]);
  assert.deepEqual(modernBorders.map((border) => border.id), [
    "modern-geo-pulse",
    "modern-deco-fan",
    "modern-monoline-wave",
    "modern-pixel-circuit",
    "modern-organic-arches",
  ]);
});

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function chunk(type: string, data: number[]) {
  const output = new Uint8Array(12 + data.length);
  writeUint32(output, 0, data.length);
  output.set(Array.from(type, (character) => character.charCodeAt(0)), 4);
  output.set(data, 8);
  return output;
}

function concatenate(chunks: Uint8Array[]) {
  const output = new Uint8Array(chunks.reduce((total, item) => total + item.length, 0));
  let offset = 0;
  for (const item of chunks) {
    output.set(item, offset);
    offset += item.length;
  }
  return output;
}

test("A4 previews are portrait through a 30 cm graph width", () => {
  const layout = createA4GraphPreviewLayout({ graphWidthCm: A4_PREVIEW_LANDSCAPE_THRESHOLD_CM });

  assert.equal(layout.orientation, "portrait");
  assert.equal(layout.dpi, A4_PREVIEW_DPI);
  assert.equal(layout.repeatCount, A4_PREVIEW_REPEAT_COUNT);
  assert.equal(layout.width, 2480);
  assert.equal(layout.height, 3508);
});

test("A4 previews switch to landscape above a 30 cm graph width", () => {
  const layout = createA4GraphPreviewLayout({ graphWidthCm: A4_PREVIEW_LANDSCAPE_THRESHOLD_CM + 0.01 });

  assert.equal(layout.orientation, "landscape");
  assert.equal(layout.width, 3508);
  assert.equal(layout.height, 2480);
});

test("A4 preview reserves the top 10 mm after 5 mm padding for the project name and horizontal borders", () => {
  const layout = createA4GraphPreviewLayout({ graphWidthCm: 20 });

  assert.equal(layout.title.x, layout.padding);
  assert.equal(layout.title.y, layout.padding);
  assert.equal(layout.title.height, layout.topMargin - layout.padding);
  assert.equal(layout.title.y + layout.title.height, layout.topBorder.y);
  assert.equal(layout.topBorder.x, layout.padding);
  assert.equal(layout.topBorder.x + layout.topBorder.width, layout.width - layout.padding);
  assert.equal(layout.graph.y, layout.topBorder.y + layout.topBorder.height);
  assert.equal(layout.graph.y + layout.graph.height, layout.bottomBorder.y);
  assert.equal(layout.bottomBorder.y + layout.bottomBorder.height, layout.height - layout.padding);
  assert.equal(layout.graph.x, layout.padding);
  assert.equal(layout.graph.width, layout.width - layout.padding * 2);
  assert.equal(layout.graph.width / layout.repeatCount > 0, true);
});

test("A4 preview PNGs include 300-DPI pHYs metadata", () => {
  const source = concatenate([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", Array(13).fill(0)),
    chunk("IEND", []),
  ]);
  const output = setPngResolution(source);
  const physicalChunkStart = 8 + 25;

  assert.equal(String.fromCharCode(...output.slice(physicalChunkStart + 4, physicalChunkStart + 8)), "pHYs");
  const pixelsPerMetre = (output[physicalChunkStart + 8] ?? 0) * 0x1000000
    + ((output[physicalChunkStart + 9] ?? 0) << 16)
    + ((output[physicalChunkStart + 10] ?? 0) << 8)
    + (output[physicalChunkStart + 11] ?? 0);
  assert.equal(pixelsPerMetre, 11811);
  assert.equal(output[physicalChunkStart + 16], 1);
});
