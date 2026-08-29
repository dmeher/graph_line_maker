import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  A4_PREVIEW_DEFAULT_SPATA_COUNT,
  A4_PREVIEW_BACKGROUND_OPTIONS,
  A4_PREVIEW_BORDER_HEIGHT_MM,
  A4_PREVIEW_BORDER_OPTIONS,
  A4_PREVIEW_DPI,
  A4_PREVIEW_LANDSCAPE_THRESHOLD_CM,
  A4_PREVIEW_REPEAT_OPTIONS,
  A4_PREVIEW_TARGET_WIDTH_CM,
  DEFAULT_A4_PREVIEW_BORDER_ID,
  createA4GraphPreviewLayout,
  createA4PreviewArtworkWidthCm,
  createA4PreviewRepeatCount,
  createA4GraphPreviewSourceCrop,
  isA4PreviewTileMirrored,
  printA4PreviewBlob,
  setPngResolution,
} from "./a4-graph-preview.ts";

test("A4 preview offers sixteen light paper backgrounds plus transparent", () => {
  const transparent = A4_PREVIEW_BACKGROUND_OPTIONS.find((background) => background.id === "transparent");
  const white = A4_PREVIEW_BACKGROUND_OPTIONS.find((background) => background.id === "white");
  const paintedBackgrounds = A4_PREVIEW_BACKGROUND_OPTIONS.filter((background) => background.color !== null);

  assert.equal(A4_PREVIEW_BACKGROUND_OPTIONS.length, 17);
  assert.equal(paintedBackgrounds.length, 16);
  assert.equal(white?.color, "#ffffff");
  assert.equal(transparent?.color, null);
  assert.equal(new Set(A4_PREVIEW_BACKGROUND_OPTIONS.map((background) => background.id)).size, 17);
  assert.equal(new Set(paintedBackgrounds.map((background) => background.color)).size, 16);
});

test("A4 preview offers the default spata strip plus supplied, Sambalpuri-inspired, and modern border collections", () => {
  const sambalpuriBorders = A4_PREVIEW_BORDER_OPTIONS.filter((border) => border.id.startsWith("sambalpuri-"));
  const modernBorders = A4_PREVIEW_BORDER_OPTIONS.filter((border) => border.id.startsWith("modern-"));

  assert.equal(DEFAULT_A4_PREVIEW_BORDER_ID, "sambalpuri-spata-default");
  assert.equal(A4_PREVIEW_BORDER_OPTIONS[0]?.id, DEFAULT_A4_PREVIEW_BORDER_ID);
  assert.equal(A4_PREVIEW_BORDER_OPTIONS.length, 16);
  assert.equal(new Set(A4_PREVIEW_BORDER_OPTIONS.map((border) => border.path)).size, 16);
  assert.deepEqual(sambalpuriBorders.map((border) => border.id), [
    "sambalpuri-spata-default",
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

test("the default spata border renders 20 alternating 1 cm slots with a fixed divider", () => {
  const svg = readFileSync(new URL("../../../public/preview-borders/sambalpuri-spata-default.svg", import.meta.url), "utf8");

  assert.equal(A4_PREVIEW_DEFAULT_SPATA_COUNT, 20);
  assert.match(svg, /viewBox="0 0 240 4800"/);
  assert.match(svg, /data-spata-per-tile="5"/);
  assert.match(svg, /data-tile-repeats="4"/);
  assert.match(svg, /data-spata-count="20"/);
  assert.match(svg, /data-box-slot-mm="10"/);
  assert.match(svg, /data-divider-mm="0.5"/);
  assert.match(svg, /<rect id="white-square" width="40" height="40" fill="#fff"\/>/);
  assert.equal((svg.match(/<use href="#white-square"/g) ?? []).length, 14);
  assert.equal((svg.match(/<use href="#five-spata-(?:red|dark)-first"/g) ?? []).length, 4);
  assert.equal((svg.match(/<use href="#five-spata-red-first"/g) ?? []).length, 2);
  assert.equal((svg.match(/<use href="#five-spata-dark-first"/g) ?? []).length, 2);
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

test("A4 preview repeats cover an 80 cm logical artwork width", () => {
  assert.equal(A4_PREVIEW_TARGET_WIDTH_CM, 80);
  assert.equal(createA4PreviewRepeatCount(10), 8);
  assert.equal(createA4PreviewRepeatCount(20), 4);
  assert.equal(createA4PreviewRepeatCount(13), 7);
  assert.equal(createA4PreviewRepeatCount(80), 1);
});

test("A4 preview ignores the two blank graph gutters when calculating repeats", () => {
  assert.equal(createA4PreviewArtworkWidthCm(8), 6);
  assert.equal(createA4PreviewArtworkWidthCm(2), 2);
  assert.equal(createA4GraphPreviewLayout({ graphWidthCm: 8 }).repeatCount, 14);
});

test("A4 preview can repeat with or without left-right flipping", () => {
  assert.deepEqual(A4_PREVIEW_REPEAT_OPTIONS.map((option) => option.id), ["flip", "no-flip"]);
  assert.equal(isA4PreviewTileMirrored(0), false);
  assert.equal(isA4PreviewTileMirrored(1), true);
  assert.equal(isA4PreviewTileMirrored(2), false);
  assert.equal(isA4PreviewTileMirrored(0, "no-flip"), false);
  assert.equal(isA4PreviewTileMirrored(1, "no-flip"), false);
  assert.equal(isA4PreviewTileMirrored(2, "no-flip"), false);
});

test("A4 previews are portrait through a 30 cm graph width", () => {
  const layout = createA4GraphPreviewLayout({ graphWidthCm: A4_PREVIEW_LANDSCAPE_THRESHOLD_CM });

  assert.equal(layout.orientation, "portrait");
  assert.equal(layout.dpi, A4_PREVIEW_DPI);
  assert.equal(layout.repeatCount, 3);
  assert.equal(layout.width, 2480);
  assert.equal(layout.height, 3508);
});

test("A4 previews switch to landscape above a 30 cm graph width", () => {
  const layout = createA4GraphPreviewLayout({ graphWidthCm: A4_PREVIEW_LANDSCAPE_THRESHOLD_CM + 0.01 });

  assert.equal(layout.orientation, "landscape");
  assert.equal(layout.width, 3508);
  assert.equal(layout.height, 2480);
});

test("A4 preview reserves the top 10 mm after 5 mm padding for the project name and 1 cm horizontal borders", () => {
  const layout = createA4GraphPreviewLayout({ graphWidthCm: 20 });

  assert.equal(A4_PREVIEW_BORDER_HEIGHT_MM, 10);
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

test("A4 preview excludes the one-cell blank gutter on both sides of the artwork", () => {
  assert.deepEqual(
    createA4GraphPreviewSourceCrop({ sourceWidth: 400, sourceHeight: 2_000, graphWidthCm: 10 }),
    { x: 40, y: 0, width: 320, height: 2_000 },
  );
  assert.deepEqual(
    createA4GraphPreviewSourceCrop({ sourceWidth: 80, sourceHeight: 400, graphWidthCm: 2 }),
    { x: 0, y: 0, width: 80, height: 400 },
  );
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

test("A4 preview print opens one exact A4 page from the generated PNG", () => {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let printedHtml = "";
  const printListeners = new Map<string, () => void>();
  const printWindow = {
    opener: null,
    document: {
      open() {},
      write(html: string) {
        printedHtml = html;
      },
      close() {},
    },
    addEventListener(event: string, listener: () => void) {
      printListeners.set(event, listener);
    },
    close() {},
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { open: () => printWindow },
  });

  try {
    printA4PreviewBlob(new Blob(["preview"], { type: "image/png" }), {
      title: "A4 <preview>",
      orientation: "landscape",
    });

    assert.match(printedHtml, /@page \{ size: 297mm 210mm; margin: 0; \}/);
    assert.match(printedHtml, /width: 297mm;/);
    assert.match(printedHtml, /height: 210mm;/);
    assert.match(printedHtml, /A4 &lt;preview&gt;/);
    assert.match(printedHtml, /<img id="a4-preview-image"/);
  } finally {
    printListeners.get("beforeunload")?.();
    if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
