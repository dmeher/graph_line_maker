export const GRAPH_SUBDIVISIONS = 10;
export const GRAPH_MINOR_PIXEL_SIZE = 4;
export const GRAPH_MAJOR_CELL_PIXELS = GRAPH_SUBDIVISIONS * GRAPH_MINOR_PIXEL_SIZE;
export { MAX_GRAPH_WIDTH_CELLS, MAX_GRAPH_HEIGHT_CELLS } from "./canvas/performance-limits.ts";
export const MAX_IMAGE_PADDING_PIXELS = 1200;
export const DEFAULT_IMAGE_PADDING_CELLS = 2;
export const DEFAULT_IMAGE_PADDING_PIXELS = DEFAULT_IMAGE_PADDING_CELLS * GRAPH_MINOR_PIXEL_SIZE;
export const DEFAULT_CELL_SIZE_CM = 1;
export const DEFAULT_GRAPH_WIDTH_CELLS = 10;
export const DEFAULT_GRAPH_HEIGHT_CELLS = 112;
export const DEFAULT_IMAGE_WIDTH_CELLS = 8;
export const DEFAULT_IMAGE_HEIGHT_CELLS = 10;
export const DEFAULT_IMAGE_LINE_THICKNESS = 0;
export const MIN_IMAGE_LINE_THICKNESS = 0;
export const MAX_IMAGE_LINE_THICKNESS = 6;
export const DEFAULT_SOURCE_FILL_THRESHOLD = 0.58;
export const MIN_SOURCE_FILL_THRESHOLD = 0.05;
export const MAX_SOURCE_FILL_THRESHOLD = 1;
export const DEFAULT_SOURCE_FILL_MIN_STROKE_PIXELS = 7;
export const MIN_SOURCE_FILL_MIN_STROKE_PIXELS = 2;
export const MAX_SOURCE_FILL_MIN_STROKE_PIXELS = 48;
export const DEFAULT_STROKE_GAP_CLOSE_PIXELS = 0;
export const MIN_STROKE_GAP_CLOSE_PIXELS = 0;
export const MAX_STROKE_GAP_CLOSE_PIXELS = 2;
export const CANVAS_WHITE = "#ffffff";
export const CANVAS_BLACK = "#000000";
export const CANVAS_LIGHT_GREY = "#b0b0b0";
export const CANVAS_COLOR_VALUES = [CANVAS_WHITE, CANVAS_BLACK, CANVAS_LIGHT_GREY] as const;
export type CanvasColor = (typeof CANVAS_COLOR_VALUES)[number];
export const GRAPH_LINE_RED = "#dc2626";
export const GRAPH_LINE_GREEN = "#16a34a";
export const GRAPH_LINE_COLOR_VALUES = [...CANVAS_COLOR_VALUES, GRAPH_LINE_RED, GRAPH_LINE_GREEN] as const;
export type GraphLineColor = (typeof GRAPH_LINE_COLOR_VALUES)[number];
export const DEFAULT_BACKGROUND_COLOR: CanvasColor = CANVAS_WHITE;
export const DEFAULT_OUTLINE_COLOR: CanvasColor = CANVAS_BLACK;
export const DEFAULT_GRID_LINE_COLOR: GraphLineColor = GRAPH_LINE_RED;
export const TRANSPARENT_FILL_COLOR = "transparent";
export type CanvasFillColor = CanvasColor | typeof TRANSPARENT_FILL_COLOR;
export const GRAPH_LINE_LAYER_KEYS = ["front", "back"] as const;
export type GraphLineLayer = (typeof GRAPH_LINE_LAYER_KEYS)[number];
export const DEFAULT_GRAPH_LINE_LAYER: GraphLineLayer = "back";
export const GRAPH_GRID_LINE_STYLE_KEYS = ["solid", "dashed", "dotted"] as const;
export type GraphGridLineStyle = (typeof GRAPH_GRID_LINE_STYLE_KEYS)[number];
export const DEFAULT_GRID_LINE_STYLE: GraphGridLineStyle = "solid";
export const GRAPH_GRID_PATTERN_KEYS = ["square", "dot"] as const;
export type GraphGridPattern = (typeof GRAPH_GRID_PATTERN_KEYS)[number];
export const DEFAULT_GRID_PATTERN: GraphGridPattern = "square";
export const MAJOR_GRID_EVERY_KEYS = [1, 2, 5, 10] as const;
export type MajorGridEvery = (typeof MAJOR_GRID_EVERY_KEYS)[number];
export const DEFAULT_MAJOR_GRID_EVERY: MajorGridEvery = 1;
export const GRAPH_IMAGE_DENOISE_LEVEL_KEYS = ["off", "light", "strong"] as const;
export type GraphImageDenoiseLevel = (typeof GRAPH_IMAGE_DENOISE_LEVEL_KEYS)[number];
export const DEFAULT_IMAGE_DENOISE_LEVEL: GraphImageDenoiseLevel = "off";
export const GRAPH_IMAGE_EDGE_DETECTION_KEYS = ["standard", "enhanced"] as const;
export type GraphImageEdgeDetection = (typeof GRAPH_IMAGE_EDGE_DETECTION_KEYS)[number];
export const DEFAULT_IMAGE_EDGE_DETECTION: GraphImageEdgeDetection = "standard";
export const GRAPH_IMAGE_COLOR_QUANTIZATION_KEYS = ["off", 2, 4, 8, 16] as const;
export type GraphImageColorQuantization = (typeof GRAPH_IMAGE_COLOR_QUANTIZATION_KEYS)[number];
export const DEFAULT_IMAGE_COLOR_QUANTIZATION: GraphImageColorQuantization = "off";
export const DEFAULT_IMAGE_AUTO_ENHANCE = false;
export const GRAPH_IMAGE_TRACE_ENGINE_KEYS = ["default", "image-tracer", "vectorizer"] as const;
export type GraphImageTraceEngine = (typeof GRAPH_IMAGE_TRACE_ENGINE_KEYS)[number];
export const DEFAULT_IMAGE_TRACE_ENGINE: GraphImageTraceEngine = "vectorizer";
export const MIN_VECTORIZER_STROKE_WIDTH = 1;
export const MAX_VECTORIZER_STROKE_WIDTH = 24;
export const DEFAULT_VECTORIZER_STROKE_WIDTH = 3;
export const DEFAULT_VECTORIZER_STROKE_COLOR = DEFAULT_OUTLINE_COLOR;
export const MIN_VECTORIZER_LINE_ADJUST = -8;
export const MAX_VECTORIZER_LINE_ADJUST = 16;
export const VECTORIZER_LINE_ADJUST_STEP = 0.5;
export const DEFAULT_VECTORIZER_LINE_ADJUST = 0;
export const MIN_VECTORIZER_INK_THRESHOLD = 1;
export const MAX_VECTORIZER_INK_THRESHOLD = 254;
export const DEFAULT_VECTORIZER_INK_THRESHOLD = 210;

/**
 * Strength of interior sketch/hatch removal, in erosion steps.
 *
 * Hand-drawn source art often shades the inside of a shape with thin scattered
 * strokes. A morphological opening of radius N deletes any stroke narrower than
 * roughly 2N pixels while leaving thicker outlines intact, so the shape's
 * interior becomes an empty enclosed region the user can colour.
 *
 * Zero is off, which keeps existing projects rendering exactly as before.
 */
export const MIN_VECTORIZER_SKETCH_REMOVAL = 0;
export const MAX_VECTORIZER_SKETCH_REMOVAL = 6;
export const DEFAULT_VECTORIZER_SKETCH_REMOVAL = 0;
export const GRAPH_VECTORIZER_FIDELITY_KEYS = ["exact", "smooth"] as const;
export type GraphVectorizerFidelity = (typeof GRAPH_VECTORIZER_FIDELITY_KEYS)[number];
export const DEFAULT_VECTORIZER_FIDELITY: GraphVectorizerFidelity = "exact";
export const PRINT_PAPER_SIZE_KEYS = ["a4", "a3", "letter", "legal", "tabloid"] as const;
export type PrintPaperSize = (typeof PRINT_PAPER_SIZE_KEYS)[number];
export const DEFAULT_PRINT_PAPER_SIZE: PrintPaperSize = "a4";
export const PRINT_ORIENTATION_KEYS = ["auto", "portrait", "landscape"] as const;
export type PrintOrientation = (typeof PRINT_ORIENTATION_KEYS)[number];
export const DEFAULT_PRINT_ORIENTATION: PrintOrientation = "auto";
export const PRINT_HORIZONTAL_ALIGNMENT_KEYS = ["left", "center", "right"] as const;
export type PrintHorizontalAlignment = (typeof PRINT_HORIZONTAL_ALIGNMENT_KEYS)[number];
export const DEFAULT_PRINT_HORIZONTAL_ALIGNMENT: PrintHorizontalAlignment = "center";
export const PRINT_VERTICAL_ALIGNMENT_KEYS = ["top", "center", "bottom"] as const;
export type PrintVerticalAlignment = (typeof PRINT_VERTICAL_ALIGNMENT_KEYS)[number];
export const DEFAULT_PRINT_VERTICAL_ALIGNMENT: PrintVerticalAlignment = "center";

export const PRINT_PAPER_SIZES: Record<PrintPaperSize, { label: string; widthCm: number; heightCm: number }> = {
  a4: { label: "A4", widthCm: 21, heightCm: 29.7 },
  a3: { label: "A3", widthCm: 29.7, heightCm: 42 },
  letter: { label: "Letter", widthCm: 21.59, heightCm: 27.94 },
  legal: { label: "Legal", widthCm: 21.59, heightCm: 35.56 },
  tabloid: { label: "Tabloid", widthCm: 27.94, heightCm: 43.18 },
};

export function isPrintPaperSize(value: unknown): value is PrintPaperSize {
  return typeof value === "string" && PRINT_PAPER_SIZE_KEYS.includes(value as PrintPaperSize);
}

export function isGraphLineLayer(value: unknown): value is GraphLineLayer {
  return typeof value === "string" && GRAPH_LINE_LAYER_KEYS.includes(value as GraphLineLayer);
}

export function isGraphGridLineStyle(value: unknown): value is GraphGridLineStyle {
  return typeof value === "string" && GRAPH_GRID_LINE_STYLE_KEYS.includes(value as GraphGridLineStyle);
}

export function isGraphGridPattern(value: unknown): value is GraphGridPattern {
  return typeof value === "string" && GRAPH_GRID_PATTERN_KEYS.includes(value as GraphGridPattern);
}

export function isMajorGridEvery(value: unknown): value is MajorGridEvery {
  return typeof value === "number" && MAJOR_GRID_EVERY_KEYS.includes(value as MajorGridEvery);
}

export function isGraphImageDenoiseLevel(value: unknown): value is GraphImageDenoiseLevel {
  return typeof value === "string" && GRAPH_IMAGE_DENOISE_LEVEL_KEYS.includes(value as GraphImageDenoiseLevel);
}

export function isGraphImageEdgeDetection(value: unknown): value is GraphImageEdgeDetection {
  return typeof value === "string" && GRAPH_IMAGE_EDGE_DETECTION_KEYS.includes(value as GraphImageEdgeDetection);
}

export function isGraphImageColorQuantization(value: unknown): value is GraphImageColorQuantization {
  return value === "off" || (typeof value === "number" && GRAPH_IMAGE_COLOR_QUANTIZATION_KEYS.includes(value as GraphImageColorQuantization));
}

export function isGraphImageTraceEngine(value: unknown): value is GraphImageTraceEngine {
  return typeof value === "string" && GRAPH_IMAGE_TRACE_ENGINE_KEYS.includes(value as GraphImageTraceEngine);
}

export function normalizeGraphImageTraceEngine(value: unknown): GraphImageTraceEngine {
  void value;
  return DEFAULT_IMAGE_TRACE_ENGINE;
}

export function clampVectorizerStrokeWidth(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_VECTORIZER_STROKE_WIDTH;
  return Math.max(MIN_VECTORIZER_STROKE_WIDTH, Math.min(MAX_VECTORIZER_STROKE_WIDTH, Math.round(numeric)));
}

export function clampVectorizerLineAdjust(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_VECTORIZER_LINE_ADJUST;
  const rounded = Math.round(numeric / VECTORIZER_LINE_ADJUST_STEP) * VECTORIZER_LINE_ADJUST_STEP;
  const clamped = Math.max(MIN_VECTORIZER_LINE_ADJUST, Math.min(MAX_VECTORIZER_LINE_ADJUST, rounded));
  return Object.is(clamped, -0) ? 0 : clamped;
}

export function clampVectorizerInkThreshold(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_VECTORIZER_INK_THRESHOLD;
  return Math.max(MIN_VECTORIZER_INK_THRESHOLD, Math.min(MAX_VECTORIZER_INK_THRESHOLD, Math.round(numeric)));
}

export function clampVectorizerSketchRemoval(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_VECTORIZER_SKETCH_REMOVAL;
  return Math.max(MIN_VECTORIZER_SKETCH_REMOVAL, Math.min(MAX_VECTORIZER_SKETCH_REMOVAL, Math.round(numeric)));
}

export function isGraphVectorizerFidelity(value: unknown): value is GraphVectorizerFidelity {
  return typeof value === "string" && GRAPH_VECTORIZER_FIDELITY_KEYS.includes(value as GraphVectorizerFidelity);
}

export function isPrintOrientation(value: unknown): value is PrintOrientation {
  return typeof value === "string" && PRINT_ORIENTATION_KEYS.includes(value as PrintOrientation);
}

export function isPrintHorizontalAlignment(value: unknown): value is PrintHorizontalAlignment {
  return typeof value === "string" && PRINT_HORIZONTAL_ALIGNMENT_KEYS.includes(value as PrintHorizontalAlignment);
}

export function isPrintVerticalAlignment(value: unknown): value is PrintVerticalAlignment {
  return typeof value === "string" && PRINT_VERTICAL_ALIGNMENT_KEYS.includes(value as PrintVerticalAlignment);
}

export type PresetColor = {
  name: string;
  hex: CanvasColor;
};

export const PRESET_GRAPH_COLORS: PresetColor[] = [
  { name: "White", hex: CANVAS_WHITE },
  { name: "Black", hex: CANVAS_BLACK },
  { name: "Light grey", hex: CANVAS_LIGHT_GREY },
];

export const PRESET_GRAPH_LINE_COLORS: { name: string; hex: GraphLineColor }[] = [
  ...PRESET_GRAPH_COLORS,
  { name: "Red", hex: GRAPH_LINE_RED },
  { name: "Green", hex: GRAPH_LINE_GREEN },
];

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function isCanvasColor(value: unknown): value is CanvasColor {
  return typeof value === "string" && CANVAS_COLOR_VALUES.includes(value.toLowerCase() as CanvasColor);
}

export function isGraphLineColor(value: unknown): value is GraphLineColor {
  return typeof value === "string" && GRAPH_LINE_COLOR_VALUES.includes(value.toLowerCase() as GraphLineColor);
}

function rgbChannels(value: string) {
  const normalized = value.slice(1);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ] as const;
}

/** Maps legacy hex colors to the closest approved opaque canvas color. */
function nearestColor<T extends string>(value: string, colors: readonly T[]): T {
  const [red, green, blue] = rgbChannels(value);
  return colors.reduce((closest, candidate) => {
    const [candidateRed, candidateGreen, candidateBlue] = rgbChannels(candidate);
    const candidateDistance = (red - candidateRed) ** 2 + (green - candidateGreen) ** 2 + (blue - candidateBlue) ** 2;
    const [closestRed, closestGreen, closestBlue] = rgbChannels(closest);
    const closestDistance = (red - closestRed) ** 2 + (green - closestGreen) ** 2 + (blue - closestBlue) ** 2;
    return candidateDistance < closestDistance ? candidate : closest;
  }, colors[0]);
}

export function normalizeCanvasColor(value: unknown, fallback: CanvasColor = DEFAULT_OUTLINE_COLOR): CanvasColor {
  if (isCanvasColor(value)) return value.toLowerCase() as CanvasColor;
  if (!isHexColor(value)) return fallback;

  return nearestColor(value, CANVAS_COLOR_VALUES);
}

export function normalizeGraphLineColor(value: unknown, fallback: GraphLineColor = DEFAULT_GRID_LINE_COLOR): GraphLineColor {
  if (isGraphLineColor(value)) return value.toLowerCase() as GraphLineColor;
  if (!isHexColor(value)) return fallback;

  return nearestColor(value, GRAPH_LINE_COLOR_VALUES);
}

export function isTransparentFillColor(value: unknown): value is typeof TRANSPARENT_FILL_COLOR {
  return value === TRANSPARENT_FILL_COLOR;
}

export function isFillColor(value: unknown): value is CanvasFillColor {
  return isCanvasColor(value) || isTransparentFillColor(value);
}

export function normalizeCanvasFillColor(
  value: unknown,
  fallback: CanvasFillColor = TRANSPARENT_FILL_COLOR,
): CanvasFillColor {
  if (isTransparentFillColor(value)) return TRANSPARENT_FILL_COLOR;
  if (isHexColor(value)) return normalizeCanvasColor(value);
  return fallback;
}

export function clampImageLineThickness(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_IMAGE_LINE_THICKNESS;
  return Math.round(Math.max(MIN_IMAGE_LINE_THICKNESS, Math.min(MAX_IMAGE_LINE_THICKNESS, numeric)) * 1000) / 1000;
}

export function clampSourceFillThreshold(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SOURCE_FILL_THRESHOLD;
  return Math.round(Math.max(MIN_SOURCE_FILL_THRESHOLD, Math.min(MAX_SOURCE_FILL_THRESHOLD, numeric)) * 1000) / 1000;
}

export function clampSourceFillMinStrokePixels(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SOURCE_FILL_MIN_STROKE_PIXELS;
  return Math.round(Math.max(MIN_SOURCE_FILL_MIN_STROKE_PIXELS, Math.min(MAX_SOURCE_FILL_MIN_STROKE_PIXELS, numeric)));
}

export function clampStrokeGapClosePixels(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_STROKE_GAP_CLOSE_PIXELS;
  return Math.round(Math.max(MIN_STROKE_GAP_CLOSE_PIXELS, Math.min(MAX_STROKE_GAP_CLOSE_PIXELS, numeric)));
}

export function lightenColor(hex: string, amount = 0.72) {
  const clean = isHexColor(hex) ? hex.slice(1) : DEFAULT_OUTLINE_COLOR.slice(1);
  const channels = [clean.slice(0, 2), clean.slice(2, 4), clean.slice(4, 6)].map((channel) =>
    Number.parseInt(channel, 16),
  );
  const value = channels
    .map((channel) => Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, "0"))
    .join("");
  return `#${value}`;
}
