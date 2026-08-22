import assert from "node:assert/strict";
import test from "node:test";
import {
  CLEAN_THIN_INK_THRESHOLD_DELTA,
  resolveVectorTraceProfile,
} from "./vector-trace-profile.ts";

test("Exact retains the established mask and vectorizer settings", () => {
  assert.deepEqual(resolveVectorTraceProfile("exact", 210, -1.5), {
    fidelity: "exact",
    inkThreshold: 210,
    lineAdjust: -1.5,
    mode: "none",
    filterSpeckle: 0,
    colorPrecision: 6,
    layerDifference: 8,
    cornerThreshold: 60,
    lengthThreshold: 1,
    maxIterations: 0,
    spliceThreshold: 45,
    pathPrecision: 2,
  });
});

test("Smooth retains the established spline settings", () => {
  assert.deepEqual(resolveVectorTraceProfile("smooth", 210, 2), {
    fidelity: "smooth",
    inkThreshold: 210,
    lineAdjust: 2,
    mode: "spline",
    filterSpeckle: 4,
    colorPrecision: 6,
    layerDifference: 8,
    cornerThreshold: 60,
    lengthThreshold: 4,
    maxIterations: 2,
    spliceThreshold: 45,
    pathPrecision: 3,
  });
});

test("Clean & thin traces the darker ink core with Smooth spline settings", () => {
  const result = resolveVectorTraceProfile("clean-thin", 210, -0.5);

  assert.equal(result.inkThreshold, 210 - CLEAN_THIN_INK_THRESHOLD_DELTA);
  assert.equal(result.lineAdjust, -0.5);
  assert.equal(result.mode, "spline");
  assert.equal(result.filterSpeckle, 4);
  assert.equal(result.lengthThreshold, 4);
  assert.equal(result.maxIterations, 2);
  assert.equal(result.pathPrecision, 3);
});

test("Clean & thin clamps its lowered ink threshold to the supported range", () => {
  assert.equal(resolveVectorTraceProfile("clean-thin", 1, 0).inkThreshold, 1);
  assert.equal(resolveVectorTraceProfile("clean-thin", 999, 0).inkThreshold, 254);
});
