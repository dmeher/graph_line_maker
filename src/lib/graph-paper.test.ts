import assert from "node:assert/strict";
import test from "node:test";
import {
  clampVectorizerSketchRemoval,
  CANVAS_BLACK,
  CANVAS_LIGHT_GREY,
  CANVAS_WHITE,
  DEFAULT_GRID_LINE_COLOR,
  DEFAULT_MAJOR_GRID_EVERY,
  GRAPH_VECTORIZER_FIDELITY_LABELS,
  GRAPH_LINE_GREEN,
  GRAPH_LINE_RED,
  TRANSPARENT_FILL_COLOR,
  isCanvasColor,
  isFillColor,
  isGraphLineColor,
  isGraphVectorizerFidelity,
  normalizeCanvasColor,
  normalizeCanvasFillColor,
  normalizeGraphLineColor,
} from "./graph-paper.ts";

test("canvas colors are limited to white, black, and light grey", () => {
  assert.equal(isCanvasColor(CANVAS_WHITE), true);
  assert.equal(isCanvasColor(CANVAS_BLACK), true);
  assert.equal(isCanvasColor(CANVAS_LIGHT_GREY), true);
  assert.equal(isCanvasColor("#dc2626"), false);
  assert.equal(isFillColor(TRANSPARENT_FILL_COLOR), true);
});

test("legacy colors normalize to the nearest approved canvas color", () => {
  assert.equal(normalizeCanvasColor("#111827"), CANVAS_BLACK);
  assert.equal(normalizeCanvasColor("#dc2626"), CANVAS_LIGHT_GREY);
  assert.equal(normalizeCanvasColor("#f8fafc"), CANVAS_WHITE);
  assert.equal(normalizeCanvasFillColor("#334155"), CANVAS_BLACK);
  assert.equal(normalizeCanvasFillColor(TRANSPARENT_FILL_COLOR), TRANSPARENT_FILL_COLOR);
  assert.equal(normalizeCanvasFillColor("invalid"), TRANSPARENT_FILL_COLOR);
});

test("graph lines may additionally use red and green", () => {
  assert.equal(DEFAULT_GRID_LINE_COLOR, GRAPH_LINE_RED);
  assert.equal(isCanvasColor(GRAPH_LINE_RED), false);
  assert.equal(isGraphLineColor(GRAPH_LINE_RED), true);
  assert.equal(isGraphLineColor(GRAPH_LINE_GREEN), true);
  assert.equal(normalizeGraphLineColor("#ef4444"), GRAPH_LINE_RED);
  assert.equal(normalizeGraphLineColor("#22c55e"), GRAPH_LINE_GREEN);
});

test("major grid lines default to every cell", () => {
  assert.equal(DEFAULT_MAJOR_GRID_EVERY, 1);
});

test("sketch removal strength is clamped and defaults to off", () => {
  // Zero means off, so existing projects and fresh uploads render unchanged.
  assert.equal(clampVectorizerSketchRemoval(undefined), 0);
  assert.equal(clampVectorizerSketchRemoval(null), 0);
  assert.equal(clampVectorizerSketchRemoval("not a number"), 0);
  assert.equal(clampVectorizerSketchRemoval(0), 0);

  assert.equal(clampVectorizerSketchRemoval(2), 2);
  assert.equal(clampVectorizerSketchRemoval(2.4), 2);

  // Erosion is destructive, so the ceiling is deliberately low.
  assert.equal(clampVectorizerSketchRemoval(-5), 0);
  assert.equal(clampVectorizerSketchRemoval(99), 6);
});

test("vectorizer fidelity includes the opt-in clean and thin profile", () => {
  assert.equal(isGraphVectorizerFidelity("exact"), true);
  assert.equal(isGraphVectorizerFidelity("smooth"), true);
  assert.equal(isGraphVectorizerFidelity("clean-thin"), true);
  assert.equal(isGraphVectorizerFidelity("unknown"), false);
  assert.equal(GRAPH_VECTORIZER_FIDELITY_LABELS["clean-thin"], "Clean & thin");
});
