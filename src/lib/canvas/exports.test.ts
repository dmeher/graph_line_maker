import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isGraphCanvasSizedForSettings } from "./pdf-export-guard.ts";

const exportsSource = readFileSync(new URL("./exports.ts", import.meta.url), "utf8");

test("browser-print grid keeps the PDF's opaque vector-stroke treatment", () => {
  assert.match(exportsSource, /pdf\.setGState\(pdf\.GState\(\{ opacity: group\.opacity \}\)\);/);
  assert.match(exportsSource, /stroke-opacity="1"/);
  assert.match(exportsSource, /-webkit-print-color-adjust: exact;/);
  assert.match(exportsSource, /print-color-adjust: exact;/);
});

test("PDF and browser print include dotted vertical cut guides for tiled columns", () => {
  assert.match(exportsSource, /tile\.cutGuideLeftXMm - CUT_GUIDE_GAP_MM/);
  assert.match(exportsSource, /tile\.cutGuideRightXMm \+ CUT_GUIDE_GAP_MM/);
  assert.match(exportsSource, /pdf\.line\(x, 0, x, pageHeightMm\);/);
  assert.match(exportsSource, /cut-guide-vertical/);
  assert.match(exportsSource, /border-left: 0\.25mm dotted/);
});

test("PDF rejects a canvas whose pixels no longer correspond to the current graph cells", () => {
  const settings = { graphWidth: 10, graphHeight: 10 };
  assert.equal(isGraphCanvasSizedForSettings({ width: 400, height: 400 }, settings), true);
  // A former 20-cell-wide 800 px frame must never be exported as a new
  // 10-cell-wide, 10 cm graph: it would make every cell 0.5 cm.
  assert.equal(isGraphCanvasSizedForSettings({ width: 800, height: 400 }, settings), false);
});
