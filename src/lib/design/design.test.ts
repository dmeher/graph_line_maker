import assert from "node:assert/strict";
import test from "node:test";
import { createBlankDesignDocument, createBuiltInDesignDocument, createDesignImageNode } from "./defaults.ts";
import { detectExtractionCandidates } from "./extraction.ts";
import { placementForSplitRect, snapDesignNodePosition, splitNormalizedCrop, splitPixelRect } from "./geometry.ts";
import { estimateDesignDocumentBytes, pruneDesignHistory } from "./history.ts";
import { designFilePath, designLibraryPath, designPreviewPath } from "./paths.ts";
import { designDocumentSchema } from "./schema.ts";

test("pixel splits preserve every odd-sized pixel without overlap", () => {
  const vertical = splitPixelRect({ x: 0, y: 0, width: 101, height: 55 }, "vertical");
  assert.deepEqual(vertical, [
    { x: 0, y: 0, width: 50, height: 55 },
    { x: 50, y: 0, width: 51, height: 55 },
  ]);
  const quarters = splitPixelRect({ x: 3, y: 7, width: 101, height: 55 }, "quarters");
  assert.equal(quarters.reduce((sum, rect) => sum + rect.width * rect.height, 0), 101 * 55);
  assert.deepEqual(quarters.at(-1), { x: 53, y: 34, width: 51, height: 28 });
});

test("normalized crop splits stay inside the original crop", () => {
  const crop = { x: 0.2, y: 0.1, width: 0.6, height: 0.8 };
  const pieces = splitNormalizedCrop(crop, "quarters");
  assert.equal(pieces.length, 4);
  assert.equal(pieces.reduce((sum, piece) => sum + piece.width * piece.height, 0), crop.width * crop.height);
  assert.equal(Math.max(...pieces.map((piece) => piece.x + piece.width)), crop.x + crop.width);
  assert.equal(Math.max(...pieces.map((piece) => piece.y + piece.height)), crop.y + crop.height);
});

test("horizontal and vertical odd-dimension splits cover every pixel", () => {
  const source = { x: 11, y: 13, width: 7, height: 5 };
  for (const mode of ["horizontal", "vertical", "quarters"] as const) {
    const pieces = splitPixelRect(source, mode);
    const pixels = new Set<string>();
    for (const piece of pieces) for (let y = piece.y; y < piece.y + piece.height; y += 1) for (let x = piece.x; x < piece.x + piece.width; x += 1) {
      const key = `${x}:${y}`;
      assert.equal(pixels.has(key), false, `${mode} overlaps ${key}`);
      pixels.add(key);
    }
    assert.equal(pixels.size, source.width * source.height);
  }
});

test("split placements preserve rotation and flips around the original center", () => {
  const node = { x: 100, y: 200, width: 400, height: 200, rotation: 90, flipX: true, flipY: false };
  const left = placementForSplitRect(node, { width: 101, height: 55 }, { x: 0, y: 0, width: 50, height: 55 });
  const right = placementForSplitRect(node, { width: 101, height: 55 }, { x: 50, y: 0, width: 51, height: 55 });
  assert.ok(Math.abs(left.width + right.width - node.width) < 1e-9);
  assert.ok(left.y > right.y, "horizontal flip before rotation reverses the rotated piece order");
});

test("snapping aligns node centers and neighbouring edges within the threshold", () => {
  const moving = { id: "moving", width: 100, height: 80 };
  const nodes = [{ id: "target", x: 300, y: 200, width: 120, height: 90, visible: true }];
  assert.deepEqual(snapDesignNodePosition(moving, { x: 247, y: 117 }, nodes, { width: 1000, height: 800 }), { x: 250, y: 120, snappedX: true, snappedY: true });
  assert.deepEqual(snapDesignNodePosition(moving, { x: 143, y: 337 }, [], { width: 1000, height: 800 }, 4), { x: 143, y: 337, snappedX: false, snappedY: false });
});

test("Design document schema accepts editable nodes and rejects unsafe canvases", () => {
  const document = createBlankDesignDocument(1200, 900, null);
  document.nodes.push(createDesignImageNode({ fileId: crypto.randomUUID(), name: "Artwork", width: 500, height: 300 }));
  assert.equal(designDocumentSchema.parse(document).nodes.length, 1);
  assert.equal(designDocumentSchema.safeParse({ ...document, canvas: { ...document.canvas, width: 5000, height: 5000 } }).success, false);
  assert.equal(designDocumentSchema.safeParse({ ...document, nodes: [document.nodes[0], document.nodes[0]] }).success, false);
});

test("panel presets create editable two- and four-panel layouts", () => {
  assert.equal(createBuiltInDesignDocument("two-panel").nodes.length, 2);
  assert.equal(createBuiltInDesignDocument("four-panel").nodes.length, 4);
});

test("Design history retains the newest command within count and byte budgets", () => {
  const documents = Array.from({ length: 5 }, (_, index) => ({ ...createBlankDesignDocument(100, 100, null), nodes: [], marker: "x".repeat(index * 300) })) as unknown as ReturnType<typeof createBlankDesignDocument>[];
  const budget = estimateDesignDocumentBytes(documents[3]) + estimateDesignDocumentBytes(documents[4]);
  const pruned = pruneDesignHistory(documents, 4, budget);
  assert.deepEqual(pruned, documents.slice(3));
});

test("extraction groups nearby details and keeps distant artwork separate", () => {
  const width = 120;
  const height = 60;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) data.set([255, 255, 255, 255], pixel * 4);
  const paint = (left: number, top: number, right: number, bottom: number) => {
    for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) data.set([0, 0, 0, 255], (y * width + x) * 4);
  };
  paint(8, 10, 18, 30);
  paint(20, 14, 24, 20);
  paint(88, 18, 104, 38);
  const candidates = detectExtractionCandidates({ width, height, data }, { groupingRatio: 0.025, paddingRatio: 0, minimumComponentRatio: 0.00001 });
  assert.equal(candidates.length, 2);
  assert.ok(candidates[0].x < 30);
  assert.ok(candidates[1].x > 70);
});

test("extraction supports transparent backgrounds and enforces the 100-piece boundary", () => {
  const width = 440; const height = 440; const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < 11; row += 1) for (let column = 0; column < 11; column += 1) {
    const left = 6 + column * 39; const top = 6 + row * 39;
    for (let y = top; y < top + 5; y += 1) for (let x = left; x < left + 5; x += 1) data.set([20, 20, 20, 255], (y * width + x) * 4);
  }
  const candidates = detectExtractionCandidates({ width, height, data }, { groupingRatio: 0.001, paddingRatio: 0, minimumComponentRatio: 0.00001, maxCandidates: 100 });
  assert.equal(candidates.length, 100);
  assert.ok(candidates.every((candidate) => candidate.width >= 5 && candidate.height >= 5));
});

test("Design R2 paths are owner-scoped and immutable-id based", () => {
  assert.equal(designFilePath("USER-1", "DESIGN-2", "FILE-3", "PNG"), "user-1/designs/design-2/files/file-3.png");
  assert.equal(designLibraryPath("USER-1", "clipart", "ITEM-4"), "user-1/library/cliparts/item-4.png");
  assert.equal(designLibraryPath("USER-1", "design", "ITEM-4"), "user-1/library/designs/item-4.png");
  assert.equal(designPreviewPath("USER-1", "DESIGN-2", "webp"), "user-1/designs/design-2/preview.webp");
});
