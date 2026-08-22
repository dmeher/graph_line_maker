import {
  clampVectorizerInkThreshold,
  type GraphVectorizerFidelity,
} from "../graph-paper.ts";

/**
 * Kept independent from the native vectorizer module so the tracing policy can
 * be tested in Node without loading the platform-specific binding.
 */
export type VectorTraceFidelity = GraphVectorizerFidelity;

export type VectorTraceSimplifyMode = "none" | "spline";

export type VectorTraceProfile = {
  fidelity: VectorTraceFidelity;
  inkThreshold: number;
  lineAdjust: number;
  mode: VectorTraceSimplifyMode;
  filterSpeckle: number;
  colorPrecision: number;
  layerDifference: number;
  cornerThreshold: number;
  lengthThreshold: number;
  maxIterations: number;
  spliceThreshold: number;
  pathPrecision: number;
};

export const CLEAN_THIN_INK_THRESHOLD_DELTA = 32;

const EXACT_TRACE_SETTINGS = {
  mode: "none",
  filterSpeckle: 0,
  colorPrecision: 6,
  layerDifference: 8,
  cornerThreshold: 60,
  lengthThreshold: 1,
  maxIterations: 0,
  spliceThreshold: 45,
  pathPrecision: 2,
} as const satisfies Omit<VectorTraceProfile, "fidelity" | "inkThreshold" | "lineAdjust">;

const SMOOTH_TRACE_SETTINGS = {
  mode: "spline",
  filterSpeckle: 4,
  colorPrecision: 6,
  layerDifference: 8,
  cornerThreshold: 60,
  lengthThreshold: 4,
  maxIterations: 2,
  spliceThreshold: 45,
  pathPrecision: 3,
} as const satisfies Omit<VectorTraceProfile, "fidelity" | "inkThreshold" | "lineAdjust">;

/**
 * Resolves the binary-mask threshold and curve fitting policy for one trace.
 *
 * Exact and Smooth intentionally retain their established configuration. Clean
 * & thin traces the darker ink core before using the Smooth spline settings;
 * the caller's line adjustment is deliberately passed through untouched.
 */
export function resolveVectorTraceProfile(
  fidelity: VectorTraceFidelity,
  inkThreshold: number,
  lineAdjust: number,
): VectorTraceProfile {
  const cleanThin = fidelity === "clean-thin";
  const settings = fidelity === "exact" ? EXACT_TRACE_SETTINGS : SMOOTH_TRACE_SETTINGS;

  return {
    fidelity,
    inkThreshold: cleanThin
      ? clampVectorizerInkThreshold(inkThreshold - CLEAN_THIN_INK_THRESHOLD_DELTA)
      : inkThreshold,
    lineAdjust,
    ...settings,
  };
}
