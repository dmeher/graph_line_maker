import assert from "node:assert/strict";
import test from "node:test";
import {
  CSS_PIXELS_PER_CM,
  DEFAULT_CANVAS_ZOOM,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  actualSizeCanvasZoom,
  canvasZoomPercent,
  clampCanvasZoom,
  parseCanvasZoomPercent,
  roundCanvasZoom,
  stepCanvasZoom,
} from "./canvas-zoom.ts";

test("zoom is clamped to the supported range", () => {
  assert.equal(MIN_CANVAS_ZOOM, 0.01);
  assert.equal(clampCanvasZoom(2), 2);
  assert.equal(clampCanvasZoom(12), MAX_CANVAS_ZOOM);
  assert.equal(clampCanvasZoom(0.01), MIN_CANVAS_ZOOM);
  assert.equal(clampCanvasZoom(Number.NaN), DEFAULT_CANVAS_ZOOM);
});

test("rounding keeps the stored zoom on whole percents", () => {
  assert.equal(roundCanvasZoom(1.23456), 1.23);
  assert.equal(canvasZoomPercent(roundCanvasZoom(1.235)), 124);
  assert.equal(canvasZoomPercent(3.5), 350);
});

test("actual size makes one cell measure one centimetre", () => {
  const cellPixels = 40;
  const zoom = actualSizeCanvasZoom(cellPixels);

  // A cell is drawn cellPixels wide and scaled by zoom, so this is its
  // on-screen width in CSS pixels — one centimetre at the CSS reference pixel.
  assert.ok(Math.abs(cellPixels * zoom - CSS_PIXELS_PER_CM) < 1e-9);
  assert.equal(canvasZoomPercent(zoom), 94);
  // Whole-percent rounding would cost about a millimetre across 20 cells.
  assert.ok(Math.abs(zoom - 0.94) > 0.004);

  assert.equal(actualSizeCanvasZoom(0), DEFAULT_CANVAS_ZOOM);
  assert.equal(actualSizeCanvasZoom(Number.NaN), DEFAULT_CANVAS_ZOOM);
  // An implausibly small cell cannot escape the supported zoom range.
  assert.equal(actualSizeCanvasZoom(1), MAX_CANVAS_ZOOM);
});

test("each step moves ten percentage points and stops at the bounds", () => {
  assert.equal(canvasZoomPercent(stepCanvasZoom(1, 1)), 110);
  assert.equal(canvasZoomPercent(stepCanvasZoom(1, -1)), 90);
  assert.equal(canvasZoomPercent(stepCanvasZoom(MAX_CANVAS_ZOOM, 1)), 500);
  assert.equal(canvasZoomPercent(stepCanvasZoom(MIN_CANVAS_ZOOM, -1)), 1);

  // Repeated steps must not drift off whole percents.
  let zoom = MIN_CANVAS_ZOOM;
  for (let press = 0; press < 12; press += 1) zoom = stepCanvasZoom(zoom, 1);
  assert.equal(canvasZoomPercent(zoom), 121);
  assert.equal(zoom, 1.21);
});

test("a typed percentage is read with or without decoration", () => {
  assert.equal(parseCanvasZoomPercent("150"), 1.5);
  assert.equal(parseCanvasZoomPercent(" 85 "), 0.85);
  assert.equal(parseCanvasZoomPercent("120%"), 1.2);
  assert.equal(parseCanvasZoomPercent("1,000"), MAX_CANVAS_ZOOM);
  assert.equal(parseCanvasZoomPercent("500"), 5);
});

test("an out-of-range percentage clamps, but unusable text is rejected", () => {
  assert.equal(parseCanvasZoomPercent("9000"), MAX_CANVAS_ZOOM);
  assert.equal(parseCanvasZoomPercent("1"), MIN_CANVAS_ZOOM);
  assert.equal(parseCanvasZoomPercent("0.5"), MIN_CANVAS_ZOOM);
  // Null lets the caller restore the current zoom instead of jumping.
  assert.equal(parseCanvasZoomPercent(""), null);
  assert.equal(parseCanvasZoomPercent("abc"), null);
  assert.equal(parseCanvasZoomPercent("0"), null);
  assert.equal(parseCanvasZoomPercent("-120"), null);
});
