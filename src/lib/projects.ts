import "server-only";

import { getSupabaseAdmin, tryGetSupabaseAdmin } from "@/lib/supabase/server";
import { ORIGINAL_IMAGES_BUCKET, PROCESSED_IMAGES_BUCKET } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import {
  DEFAULT_CELL_SIZE_CM,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_GRID_LINE_STYLE,
  DEFAULT_GRAPH_LINE_LAYER,
  DEFAULT_GRAPH_HEIGHT_CELLS,
  DEFAULT_GRAPH_WIDTH_CELLS,
  DEFAULT_GRID_PATTERN,
  DEFAULT_IMAGE_AUTO_ENHANCE,
  DEFAULT_IMAGE_COLOR_QUANTIZATION,
  DEFAULT_IMAGE_DENOISE_LEVEL,
  DEFAULT_IMAGE_EDGE_DETECTION,
  DEFAULT_IMAGE_TRACE_ENGINE,
  DEFAULT_IMAGE_HEIGHT_CELLS,
  DEFAULT_IMAGE_LINE_THICKNESS,
  DEFAULT_IMAGE_WIDTH_CELLS,
  DEFAULT_GRID_LINE_COLOR,
  DEFAULT_MAJOR_GRID_EVERY,
  DEFAULT_OUTLINE_COLOR,
  DEFAULT_PRINT_HORIZONTAL_ALIGNMENT,
  DEFAULT_PRINT_ORIENTATION,
  DEFAULT_PRINT_PAPER_SIZE,
  DEFAULT_PRINT_VERTICAL_ALIGNMENT,
  DEFAULT_SOURCE_FILL_MIN_STROKE_PIXELS,
  DEFAULT_SOURCE_FILL_THRESHOLD,
  DEFAULT_STROKE_GAP_CLOSE_PIXELS,
  DEFAULT_VECTORIZER_STROKE_COLOR,
  DEFAULT_VECTORIZER_STROKE_WIDTH,
  DEFAULT_VECTORIZER_LINE_ADJUST,
  DEFAULT_VECTORIZER_INK_THRESHOLD,
  DEFAULT_VECTORIZER_FIDELITY,
  GRAPH_MAJOR_CELL_PIXELS,
  TRANSPARENT_FILL_COLOR,
  isGraphGridLineStyle,
  isGraphGridPattern,
  isGraphImageColorQuantization,
  isGraphImageDenoiseLevel,
  isGraphImageEdgeDetection,
  isGraphVectorizerFidelity,
  isGraphLineLayer,
  normalizeCanvasColor,
  normalizeCanvasFillColor,
  normalizeGraphLineColor,
  isMajorGridEvery,
  isPrintHorizontalAlignment,
  isPrintOrientation,
  isPrintPaperSize,
  isPrintVerticalAlignment,
  isHexColor,
  clampImageLineThickness,
  clampSourceFillMinStrokePixels,
  clampSourceFillThreshold,
  clampStrokeGapClosePixels,
  clampVectorizerInkThreshold,
  clampVectorizerLineAdjust,
  clampVectorizerStrokeWidth,
  normalizeGraphImageTraceEngine,
} from "@/lib/graph-paper";
import { MAX_CANVAS_DIMENSION, clampGraphCellDimensions } from "@/lib/canvas/performance-limits";
import { MAX_SOURCE_IMAGES } from "@/lib/constants";
import { normalizeRotationDegrees } from "@/lib/editor/source-layout";
import {
  normalizeBackgroundRemoval,
  normalizeEraseStrokes,
  normalizeGroupId,
  normalizeLayerGroups,
} from "@/lib/editor/layer-extras";
import type { GraphClipartAsset, GraphClipartImage, GraphSettings, GraphSourceImage, PaletteColor, Project, ProjectSummary } from "@/lib/types";

const MAX_CLIPART_ASSETS = 120;
const MAX_CLIPART_IMAGES = 500;
const CELL_LINE_SIDE_KEYS = ["top", "right", "bottom", "left"] as const;
const MOCK_EDITOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900"><rect width="900" height="900" fill="white"/><path d="M431 95c-62 58-78 131-45 218m30-204c45 71 73 133 56 225m-73-150c-62-42-120-50-173-24 36 91 96 145 178 164m66-7c83-93 161-127 236-91-41 92-113 137-218 134M417 354c-14 111-14 227 0 348m46-348c18 116 22 229 10 341M260 716c-72-66-120-143-143-231 112 11 196 75 251 193m122 5c64-123 149-185 255-188-42 93-111 166-208 219M223 724h382l-33 95H249z" fill="none" stroke="#111" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
type StoredGraphSettings = Partial<GraphSettings> & {
  cellSizeInches?: number;
};
type SignedImageUrlMode = "all" | "original" | "none";

export const defaultGraphSettings: GraphSettings = {
  graphWidth: DEFAULT_GRAPH_WIDTH_CELLS,
  graphHeight: DEFAULT_GRAPH_HEIGHT_CELLS,
  cellWidth: GRAPH_MAJOR_CELL_PIXELS,
  cellHeight: GRAPH_MAJOR_CELL_PIXELS,
  cellSizeCm: DEFAULT_CELL_SIZE_CM,
  measurementUnit: "in",
  printPaperSize: DEFAULT_PRINT_PAPER_SIZE,
  printOrientation: DEFAULT_PRINT_ORIENTATION,
  printHorizontalAlignment: DEFAULT_PRINT_HORIZONTAL_ALIGNMENT,
  printVerticalAlignment: DEFAULT_PRINT_VERTICAL_ALIGNMENT,
  pixelSize: GRAPH_MAJOR_CELL_PIXELS,
  gridCellSize: GRAPH_MAJOR_CELL_PIXELS,
  outputWidth: DEFAULT_GRAPH_WIDTH_CELLS * GRAPH_MAJOR_CELL_PIXELS,
  outputHeight: DEFAULT_GRAPH_HEIGHT_CELLS * GRAPH_MAJOR_CELL_PIXELS,
  backgroundColor: DEFAULT_BACKGROUND_COLOR,
  lineColor: DEFAULT_OUTLINE_COLOR,
  outlineColor: DEFAULT_OUTLINE_COLOR,
  fillColor: TRANSPARENT_FILL_COLOR,
  fillRegions: {},
  imageLineThickness: DEFAULT_IMAGE_LINE_THICKNESS,
  sourceFillThreshold: DEFAULT_SOURCE_FILL_THRESHOLD,
  sourceFillMinStrokePixels: DEFAULT_SOURCE_FILL_MIN_STROKE_PIXELS,
  strokeGapClosePixels: DEFAULT_STROKE_GAP_CLOSE_PIXELS,
  imageAutoEnhance: DEFAULT_IMAGE_AUTO_ENHANCE,
  imageDenoiseLevel: DEFAULT_IMAGE_DENOISE_LEVEL,
  imageEdgeDetection: DEFAULT_IMAGE_EDGE_DETECTION,
  imageColorQuantization: DEFAULT_IMAGE_COLOR_QUANTIZATION,
  imageTraceEngine: DEFAULT_IMAGE_TRACE_ENGINE,
  vectorizerStrokeWidth: DEFAULT_VECTORIZER_STROKE_WIDTH,
  vectorizerStrokeColor: DEFAULT_VECTORIZER_STROKE_COLOR,
  vectorizerLineAdjust: DEFAULT_VECTORIZER_LINE_ADJUST,
  vectorizerInkThreshold: DEFAULT_VECTORIZER_INK_THRESHOLD,
  vectorizerFidelity: DEFAULT_VECTORIZER_FIDELITY,
  gridLineColor: DEFAULT_GRID_LINE_COLOR,
  gridLineLayer: DEFAULT_GRAPH_LINE_LAYER,
  gridLineStyle: DEFAULT_GRID_LINE_STYLE,
  gridPattern: DEFAULT_GRID_PATTERN,
  gridLineThickness: 1,
  showBorder: true,
  transparentBackground: false,
  showNumbers: true,
  gridNumberPlacement: "outside",
  showPageBreaks: true,
  majorGridEvery: DEFAULT_MAJOR_GRID_EVERY,
  imageWidth: DEFAULT_IMAGE_WIDTH_CELLS,
  imageHeight: DEFAULT_IMAGE_HEIGHT_CELLS,
  sourceImages: [],
  cellPaints: [],
  graphShapes: [],
  clipartAssets: [],
  clipartImages: [],
  imagePadding: 0,
  imageOffsetX: 0,
  imageOffsetY: 0,
  spotPadding: 0,
  spotShape: "round",
  pageMargin: 24,
  blackAndWhite: true,
  limitedColorMode: true,
  maxColors: 4,
};

function dataSvgUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getMockEditorProject(): Project {
  const now = new Date().toISOString();
  const settings = normalizeGraphSettings({
    ...defaultGraphSettings,
    graphWidth: 150,
    graphHeight: 150,
    imageWidth: 118,
    imageHeight: 126,
    gridNumberPlacement: "outside",
    sourceImages: [
      {
        id: "mock-deer",
        name: "deer-line-art.png",
        path: null,
        url: dataSvgUrl(MOCK_EDITOR_SVG),
        width: 118,
        height: 126,
        measurementUnit: "cm",
        imageLineThickness: 3,
        sourceFillThreshold: 0.58,
        sourceFillMinStrokePixels: 7,
        strokeGapClosePixels: 0,
        imageAutoEnhance: DEFAULT_IMAGE_AUTO_ENHANCE,
        imageDenoiseLevel: DEFAULT_IMAGE_DENOISE_LEVEL,
        imageEdgeDetection: DEFAULT_IMAGE_EDGE_DETECTION,
        imageColorQuantization: DEFAULT_IMAGE_COLOR_QUANTIZATION,
        vectorizerLineAdjust: DEFAULT_VECTORIZER_LINE_ADJUST,
        vectorizerInkThreshold: DEFAULT_VECTORIZER_INK_THRESHOLD,
        vectorizerFidelity: DEFAULT_VECTORIZER_FIDELITY,
        x: 16,
        y: 8,
        topPadding: 0,
        bottomPadding: 0,
        locked: false,
        visible: true,
        rotationDegrees: 0,
        flipX: false,
        flipY: false,
      },
    ],
    cellPaints: [
      {
        id: "ground",
        name: "Ground",
        x: 16,
        y: 134,
        width: 104,
        height: 2,
        sides: ["bottom"],
        lineColor: "#111111",
        fillColor: "transparent",
        lineWidth: 3,
        locked: false,
        visible: true,
        rotationDegrees: 0,
        flipX: false,
        flipY: false,
      },
    ],
  });

  return {
    id: "mock-editor",
    userId: "testing",
    title: "Deer Pattern",
    description: "Mock editor project for UI validation.",
    originalImagePath: null,
    processedImagePath: null,
    settings,
    width: settings.outputWidth,
    height: settings.outputHeight,
    pixelSize: settings.pixelSize,
    gridCellSize: settings.gridCellSize,
    colorCount: 2,
    createdAt: now,
    updatedAt: now,
    palettes: [
      { name: "Black", hex: "#000000", locked: true, cellCount: 2200, sortOrder: 0 },
      { name: "White", hex: "#ffffff", locked: false, cellCount: 19000, sortOrder: 1 },
    ],
    originalImageUrl: dataSvgUrl(MOCK_EDITOR_SVG),
    processedImageUrl: null,
  };
}

type DbProject = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  original_image_path: string | null;
  processed_image_path: string | null;
  settings: StoredGraphSettings | null;
  width: number | null;
  height: number | null;
  pixel_size: number | null;
  grid_cell_size: number | null;
  color_count: number | null;
  created_at: string;
  updated_at: string;
};

type DbPalette = {
  id: string;
  color_name: string;
  hex_code: string;
  locked: boolean | null;
  cell_count: number | null;
  sort_order: number | null;
};

function mapPalette(row: DbPalette): PaletteColor {
  return {
    id: row.id,
    name: row.color_name,
    hex: normalizeCanvasColor(row.hex_code),
    locked: Boolean(row.locked),
    cellCount: Number(row.cell_count ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function roundCells(value: number) {
  return Math.round(value * 100) / 100;
}

function isMeasurementUnit(value: unknown): value is GraphSettings["measurementUnit"] {
  return value === "cm" || value === "in";
}

function clampImageCells(value: unknown, maxCells: number, fallback: number) {
  const numeric = Number(value);
  const safeFallback = Math.max(0.01, Math.min(maxCells, fallback));
  if (!Number.isFinite(numeric)) return roundCells(safeFallback);
  return roundCells(Math.max(0.01, Math.min(maxCells, numeric)));
}

function clampPaddingCells(value: unknown, maxCells: number, fallback: number) {
  const numeric = Number(value);
  const limit = Math.max(1, maxCells);
  const safeFallback = Math.max(-limit, Math.min(limit, fallback));
  if (!Number.isFinite(numeric)) return roundCells(safeFallback);
  return roundCells(Math.max(-limit, Math.min(limit, numeric)));
}

function defaultSourceX(graphWidth: number, width: number) {
  return roundCells((graphWidth - width) / 2);
}

function clampFreeCellCoordinate(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return roundCells(fallback);
  return roundCells(Math.max(-1000, Math.min(1000, numeric)));
}

function clampSourceX(value: unknown, graphWidth: number, width: number) {
  void graphWidth;
  void width;
  return clampFreeCellCoordinate(value, defaultSourceX(graphWidth, width));
}

function clampSourceSizeCells(value: unknown, fallback: number) {
  const numeric = Number(value);
  const safeFallback = Math.max(0.01, Math.min(1000, fallback));
  if (!Number.isFinite(numeric)) return roundCells(safeFallback);
  return roundCells(Math.max(0.01, Math.min(1000, numeric)));
}

function normalizeFillRegions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value)
    .filter(([regionId]) => /^\d+$/.test(regionId))
    .map(([regionId, color]) => [regionId, normalizeCanvasFillColor(color)] as const)
    .slice(0, 500);
  return Object.fromEntries(entries);
}

function normalizeImageAutoEnhance(value: unknown) {
  return typeof value === "boolean" ? value : DEFAULT_IMAGE_AUTO_ENHANCE;
}

function normalizeImageDenoiseLevel(value: unknown) {
  return isGraphImageDenoiseLevel(value) ? value : DEFAULT_IMAGE_DENOISE_LEVEL;
}

function normalizeImageEdgeDetection(value: unknown) {
  return isGraphImageEdgeDetection(value) ? value : DEFAULT_IMAGE_EDGE_DETECTION;
}

function normalizeImageColorQuantization(value: unknown) {
  if (isGraphImageColorQuantization(value)) return value;
  const numeric = typeof value === "string" ? Number(value) : value;
  return isGraphImageColorQuantization(numeric) ? numeric : DEFAULT_IMAGE_COLOR_QUANTIZATION;
}

function normalizeVectorizerFidelity(value: unknown) {
  return isGraphVectorizerFidelity(value) ? value : DEFAULT_VECTORIZER_FIDELITY;
}

const GRAPH_CELL_LINE_SIDES = ["top", "right", "bottom", "left"] as const;
const GRAPH_SHAPE_KINDS = ["square", "rectangle", "circle", "oval", "half-circle", "line", "arrow"] as const;

function normalizeCellPaints(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((paint, index) => {
      if (!paint || typeof paint !== "object" || Array.isArray(paint)) return [];
      const record = paint as Record<string, unknown>;
      const x = roundCells(Math.max(0, Number(record.x) || 0));
      const y = roundCells(Math.max(0, Number(record.y) || 0));
      const width = Math.max(0.01, Math.min(1000, Number(record.width) || 1));
      const height = Math.max(0.01, Math.min(1000, Number(record.height) || 1));
      const sides = Array.isArray(record.sides)
        ? Array.from(new Set(record.sides.filter((side): side is (typeof GRAPH_CELL_LINE_SIDES)[number] => GRAPH_CELL_LINE_SIDES.includes(side as never))))
        : [];
      const lineColor = normalizeCanvasColor(record.lineColor);
      const fillColor = normalizeCanvasFillColor(record.fillColor);
      const lineWidthValue = Number(record.lineWidth);
      const lineWidth = Math.max(1, Math.min(24, Number.isFinite(lineWidthValue) ? Math.round(lineWidthValue) : 3));
      if (!sides.length && fillColor === TRANSPARENT_FILL_COLOR) return [];
      return [
        {
          id: typeof record.id === "string" && record.id.trim() ? record.id.trim().slice(0, 80) : `cell-paint-${index + 1}`,
          name: typeof record.name === "string" && record.name.trim() ? record.name.trim().slice(0, 160) : `Cell paint ${index + 1}`,
          x,
          y,
          width,
          height,
          sides,
          lineColor,
          fillColor,
          lineWidth,
          locked: Boolean(record.locked),
          visible: typeof record.visible === "boolean" ? record.visible : true,
          rotationDegrees: normalizeRotationDegrees(record.rotationDegrees),
          flipX: Boolean(record.flipX),
          flipY: Boolean(record.flipY),
          groupId: normalizeGroupId(record.groupId),
        },
      ];
    })
    .slice(0, 2000);
}

function normalizeGraphShapes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((shape, index) => {
      if (!shape || typeof shape !== "object" || Array.isArray(shape)) return [];
      const record = shape as Record<string, unknown>;
      const kind = GRAPH_SHAPE_KINDS.includes(record.kind as never) ? (record.kind as (typeof GRAPH_SHAPE_KINDS)[number]) : "rectangle";
      const widthFallback = kind === "line" || kind === "arrow" ? 2 : 1;
      const heightFallback = kind === "line" || kind === "arrow" ? 0 : 1;
      const width = clampFreeCellCoordinate(record.width, widthFallback);
      const height = clampFreeCellCoordinate(record.height, heightFallback);
      const strokeColor = normalizeCanvasColor(record.strokeColor);
      const fillColor = normalizeCanvasFillColor(record.fillColor);
      const strokeWidthValue = Number(record.strokeWidth);
      const strokeWidth = Math.max(1, Math.min(24, Number.isFinite(strokeWidthValue) ? Math.round(strokeWidthValue) : 3));
      const rawSides = Array.isArray(record.sides) ? record.sides : [...CELL_LINE_SIDE_KEYS];
      const sides = Array.from(
        new Set(
          rawSides.filter(
            (side): side is (typeof CELL_LINE_SIDE_KEYS)[number] =>
              typeof side === "string" && (CELL_LINE_SIDE_KEYS as readonly string[]).includes(side),
          ),
        ),
      );
      return [
        {
          id: typeof record.id === "string" && record.id.trim() ? record.id.trim().slice(0, 80) : `shape-${index + 1}`,
          name: typeof record.name === "string" && record.name.trim() ? record.name.trim().slice(0, 160) : `${kind[0].toUpperCase()}${kind.slice(1)} ${index + 1}`,
          kind,
          x: clampFreeCellCoordinate(record.x, 0),
          y: clampFreeCellCoordinate(record.y, 0),
          width,
          height,
          strokeColor,
          fillColor,
          strokeWidth,
          sides: sides.length ? sides : [...CELL_LINE_SIDE_KEYS],
          locked: Boolean(record.locked),
          visible: typeof record.visible === "boolean" ? record.visible : true,
          rotationDegrees: normalizeRotationDegrees(record.rotationDegrees),
          flipX: Boolean(record.flipX),
          flipY: Boolean(record.flipY),
          groupId: normalizeGroupId(record.groupId),
        },
      ];
    })
    .slice(0, 500);
}

function normalizeClipartAssets(value: unknown): GraphClipartAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((asset, index) => {
      if (!asset || typeof asset !== "object" || Array.isArray(asset)) return [];
      const record = asset as Record<string, unknown>;
      const id = typeof record.id === "string" && record.id.trim() ? record.id.trim().slice(0, 80) : `clipart-${index + 1}`;
      const name = typeof record.name === "string" && record.name.trim() ? record.name.trim().slice(0, 160) : `Clipart ${index + 1}`;
      const path = typeof record.path === "string" && record.path.trim() ? record.path.trim().slice(0, 1024) : null;
      const url = typeof record.url === "string" && record.url.trim() ? record.url.trim().slice(0, 4096) : null;
      const dataUrl = typeof record.dataUrl === "string" && record.dataUrl.startsWith("data:image/") ? record.dataUrl.slice(0, 1024 * 1024) : null;
      const mimeType = typeof record.mimeType === "string" && record.mimeType.trim() ? record.mimeType.trim().slice(0, 100) : "image/png";
      const rawWidth = Number(record.width);
      const rawHeight = Number(record.height);
      const width = Math.max(1, Math.min(12000, Number.isFinite(rawWidth) ? Math.round(rawWidth) : 1));
      const height = Math.max(1, Math.min(12000, Number.isFinite(rawHeight) ? Math.round(rawHeight) : 1));
      const createdAt = typeof record.createdAt === "string" && !Number.isNaN(Date.parse(record.createdAt)) ? record.createdAt : new Date(0).toISOString();

      if (!path && !url && !dataUrl) return [];
      return [{ id, name, path, url, dataUrl, mimeType, width, height, createdAt }];
    })
    .slice(0, MAX_CLIPART_ASSETS);
}

function normalizeClipartImages(
  value: unknown,
  defaults: Pick<
    GraphSettings,
    | "imageLineThickness"
    | "sourceFillThreshold"
    | "sourceFillMinStrokePixels"
    | "strokeGapClosePixels"
    | "vectorizerLineAdjust"
    | "vectorizerInkThreshold"
    | "vectorizerFidelity"
  >,
): GraphClipartImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((image, index) => {
      if (!image || typeof image !== "object" || Array.isArray(image)) return [];
      const record = image as Record<string, unknown>;
      const assetId = typeof record.assetId === "string" && record.assetId.trim() ? record.assetId.trim().slice(0, 80) : "";
      if (!assetId) return [];
      const strokeColor = normalizeCanvasColor(record.strokeColor);
      const fillColor = normalizeCanvasFillColor(record.fillColor);
      return [
        {
          id: typeof record.id === "string" && record.id.trim() ? record.id.trim().slice(0, 80) : `clipart-image-${index + 1}`,
          name: typeof record.name === "string" && record.name.trim() ? record.name.trim().slice(0, 160) : `Clipart image ${index + 1}`,
          assetId,
          x: clampFreeCellCoordinate(record.x, 0),
          y: clampFreeCellCoordinate(record.y, 0),
          width: clampSourceSizeCells(record.width, 4),
          height: clampSourceSizeCells(record.height, 4),
          strokeColor,
          fillColor,
          imageLineThickness: clampImageLineThickness(record.imageLineThickness ?? defaults.imageLineThickness),
          sourceFillThreshold: clampSourceFillThreshold(record.sourceFillThreshold ?? defaults.sourceFillThreshold),
          sourceFillMinStrokePixels: clampSourceFillMinStrokePixels(record.sourceFillMinStrokePixels ?? defaults.sourceFillMinStrokePixels),
          strokeGapClosePixels: clampStrokeGapClosePixels(record.strokeGapClosePixels ?? defaults.strokeGapClosePixels),
          imageAutoEnhance: normalizeImageAutoEnhance(record.imageAutoEnhance),
          imageDenoiseLevel: normalizeImageDenoiseLevel(record.imageDenoiseLevel),
          imageEdgeDetection: normalizeImageEdgeDetection(record.imageEdgeDetection),
          imageColorQuantization: normalizeImageColorQuantization(record.imageColorQuantization),
          vectorizerLineAdjust: clampVectorizerLineAdjust(record.vectorizerLineAdjust ?? defaults.vectorizerLineAdjust),
          vectorizerInkThreshold: clampVectorizerInkThreshold(record.vectorizerInkThreshold ?? defaults.vectorizerInkThreshold),
          vectorizerFidelity: normalizeVectorizerFidelity(record.vectorizerFidelity ?? defaults.vectorizerFidelity),
          locked: Boolean(record.locked),
          visible: typeof record.visible === "boolean" ? record.visible : true,
          rotationDegrees: normalizeRotationDegrees(record.rotationDegrees),
          flipX: Boolean(record.flipX),
          flipY: Boolean(record.flipY),
          groupId: normalizeGroupId(record.groupId),
          eraseStrokes: normalizeEraseStrokes(record.eraseStrokes),
          backgroundRemoval: normalizeBackgroundRemoval(record.backgroundRemoval),
        },
      ];
    })
    .slice(0, MAX_CLIPART_IMAGES);
}

function normalizeSourceImages(
  value: unknown,
  graphWidth: number,
  graphHeight: number,
  defaults: Pick<
    GraphSettings,
    | "measurementUnit"
    | "imageLineThickness"
    | "sourceFillThreshold"
    | "sourceFillMinStrokePixels"
    | "strokeGapClosePixels"
    | "vectorizerLineAdjust"
    | "vectorizerInkThreshold"
    | "vectorizerFidelity"
  >,
): GraphSourceImage[] {
  if (!Array.isArray(value)) return [];
  let legacyY = 0;
  return value
    .flatMap((source, index) => {
      if (!source || typeof source !== "object" || Array.isArray(source)) return [];
      const record = source as Partial<GraphSourceImage>;
      const id = typeof record.id === "string" && record.id.trim() ? record.id.trim().slice(0, 80) : `source-${index + 1}`;
      const name = typeof record.name === "string" && record.name.trim() ? record.name.trim().slice(0, 160) : `Source ${index + 1}`;
      const path = typeof record.path === "string" && record.path.trim() ? record.path.trim().slice(0, 1024) : null;
      const url = typeof record.url === "string" && record.url.trim() ? record.url.trim().slice(0, 4096) : null;
      const width = clampSourceSizeCells(record.width, defaultGraphSettings.imageWidth);
      const height = clampSourceSizeCells(record.height, defaultGraphSettings.imageHeight);
      const measurementUnit = isMeasurementUnit(record.measurementUnit) ? record.measurementUnit : defaults.measurementUnit;
      const imageLineThickness = clampImageLineThickness(record.imageLineThickness ?? defaults.imageLineThickness);
      const sourceFillThreshold = clampSourceFillThreshold(record.sourceFillThreshold ?? defaults.sourceFillThreshold);
      const sourceFillMinStrokePixels = clampSourceFillMinStrokePixels(record.sourceFillMinStrokePixels ?? defaults.sourceFillMinStrokePixels);
      const strokeGapClosePixels = clampStrokeGapClosePixels(record.strokeGapClosePixels ?? defaults.strokeGapClosePixels);
      const imageAutoEnhance = normalizeImageAutoEnhance(record.imageAutoEnhance);
      const imageDenoiseLevel = normalizeImageDenoiseLevel(record.imageDenoiseLevel);
      const imageEdgeDetection = normalizeImageEdgeDetection(record.imageEdgeDetection);
      const imageColorQuantization = normalizeImageColorQuantization(record.imageColorQuantization);
      const vectorizerLineAdjust = clampVectorizerLineAdjust(record.vectorizerLineAdjust ?? defaults.vectorizerLineAdjust);
      const vectorizerInkThreshold = clampVectorizerInkThreshold(record.vectorizerInkThreshold ?? defaults.vectorizerInkThreshold);
      const vectorizerFidelity = normalizeVectorizerFidelity(record.vectorizerFidelity ?? defaults.vectorizerFidelity);
      const x = clampSourceX(record.x, graphWidth, width);
      const topPadding = clampPaddingCells(record.topPadding, graphHeight, 0);
      const bottomPadding = clampPaddingCells(record.bottomPadding, graphHeight, 0);
      const y = clampFreeCellCoordinate(record.y, legacyY + topPadding);
      legacyY = y + height + bottomPadding;
      const locked = Boolean(record.locked);
      const visible = typeof record.visible === "boolean" ? record.visible : true;
      const rotationDegrees = normalizeRotationDegrees(record.rotationDegrees);
      const flipX = Boolean(record.flipX);
      const flipY = Boolean(record.flipY);
      return [
        {
          id,
          name,
          path,
          url,
          width,
          height,
          measurementUnit,
          imageLineThickness,
          sourceFillThreshold,
          sourceFillMinStrokePixels,
          strokeGapClosePixels,
          imageAutoEnhance,
          imageDenoiseLevel,
          imageEdgeDetection,
          imageColorQuantization,
          vectorizerLineAdjust,
          vectorizerInkThreshold,
          vectorizerFidelity,
          x,
          y,
          topPadding,
          bottomPadding,
          locked,
          visible,
          rotationDegrees,
          flipX,
          flipY,
          groupId: normalizeGroupId(record.groupId),
          eraseStrokes: normalizeEraseStrokes(record.eraseStrokes),
          backgroundRemoval: normalizeBackgroundRemoval(record.backgroundRemoval),
        },
      ];
    })
    .slice(0, MAX_SOURCE_IMAGES);
}

function sourceNameFromPath(path: string | null) {
  return path?.split("/").pop() || "Original image";
}

export function normalizeGraphSettings(settings?: StoredGraphSettings | null): GraphSettings {
  const merged = {
    ...defaultGraphSettings,
    ...(settings ?? {}),
  };
  const { cellSizeInches: legacyCellSizeInches, ...cleanMerged } = merged;
  const cellWidth = GRAPH_MAJOR_CELL_PIXELS;
  const cellHeight = GRAPH_MAJOR_CELL_PIXELS;
  const requestedGraphWidth = Math.round(merged.graphWidth || Math.round((merged.outputWidth || defaultGraphSettings.outputWidth) / cellWidth));
  const requestedGraphHeight = Math.round(merged.graphHeight || Math.round((merged.outputHeight || defaultGraphSettings.outputHeight) / cellHeight));
  const safeGraphDimensions = clampGraphCellDimensions(requestedGraphWidth, requestedGraphHeight, GRAPH_MAJOR_CELL_PIXELS);
  const rawGraphWidth = safeGraphDimensions.width;
  const rawGraphHeight = safeGraphDimensions.height;
  const hasBrokenLegacyArtworkWidth = Number(cleanMerged.imageWidth) > 0 && Number(cleanMerged.imageWidth) <= 0.05;
  const graphWidth = hasBrokenLegacyArtworkWidth ? defaultGraphSettings.graphWidth : rawGraphWidth;
  const graphHeight = hasBrokenLegacyArtworkWidth ? defaultGraphSettings.graphHeight : rawGraphHeight;
  const imageAreaWidth = graphWidth * cellWidth;
  const imageAreaHeight = graphHeight * cellHeight;
  const legacyPixelSizedImageWidth =
    Number(cleanMerged.imageWidth) > graphWidth && Number(cleanMerged.imageWidth) <= imageAreaWidth
      ? Number(cleanMerged.imageWidth) / GRAPH_MAJOR_CELL_PIXELS
      : cleanMerged.imageWidth;
  const legacyPixelSizedImageHeight =
    Number(cleanMerged.imageHeight) > graphHeight && Number(cleanMerged.imageHeight) <= imageAreaHeight
      ? Number(cleanMerged.imageHeight) / GRAPH_MAJOR_CELL_PIXELS
      : cleanMerged.imageHeight;
  const defaultImageWidth = Math.min(defaultGraphSettings.imageWidth, graphWidth);
  const defaultImageHeight = Math.min(defaultGraphSettings.imageHeight, graphHeight);
  const imageWidth = hasBrokenLegacyArtworkWidth
    ? clampImageCells(defaultImageWidth, graphWidth, defaultImageWidth)
    : clampImageCells(legacyPixelSizedImageWidth, graphWidth, defaultImageWidth);
  const imageHeight = hasBrokenLegacyArtworkWidth
    ? clampImageCells(defaultImageHeight, graphHeight, defaultImageHeight)
    : clampImageCells(legacyPixelSizedImageHeight, graphHeight, defaultImageHeight);
  const imagePadding = 0;
  const outputWidth = imageAreaWidth;
  const outputHeight = imageAreaHeight;
  const imageOffsetX = Math.max(-MAX_CANVAS_DIMENSION, Math.min(MAX_CANVAS_DIMENSION, Math.round(merged.imageOffsetX ?? 0)));
  const imageOffsetY = Math.max(-MAX_CANVAS_DIMENSION, Math.min(MAX_CANVAS_DIMENSION, Math.round(merged.imageOffsetY ?? 0)));
  const backgroundColor = normalizeCanvasColor(cleanMerged.backgroundColor, DEFAULT_BACKGROUND_COLOR);
  const outlineColor = normalizeCanvasColor(
    isHexColor(cleanMerged.outlineColor) ? cleanMerged.outlineColor : cleanMerged.lineColor,
    DEFAULT_OUTLINE_COLOR,
  );
  const fillColor = normalizeCanvasFillColor(cleanMerged.fillColor);
  const fillRegions = normalizeFillRegions(cleanMerged.fillRegions);
  const cellPaints = normalizeCellPaints(cleanMerged.cellPaints);
  const graphShapes = normalizeGraphShapes(cleanMerged.graphShapes);
  const imageLineThickness = clampImageLineThickness(cleanMerged.imageLineThickness);
  const sourceFillThreshold = clampSourceFillThreshold(cleanMerged.sourceFillThreshold);
  const sourceFillMinStrokePixels = clampSourceFillMinStrokePixels(cleanMerged.sourceFillMinStrokePixels);
  const strokeGapClosePixels = clampStrokeGapClosePixels(cleanMerged.strokeGapClosePixels);
  const imageAutoEnhance = normalizeImageAutoEnhance(cleanMerged.imageAutoEnhance);
  const imageDenoiseLevel = normalizeImageDenoiseLevel(cleanMerged.imageDenoiseLevel);
  const imageEdgeDetection = normalizeImageEdgeDetection(cleanMerged.imageEdgeDetection);
  const imageColorQuantization = normalizeImageColorQuantization(cleanMerged.imageColorQuantization);
  const imageTraceEngine = normalizeGraphImageTraceEngine(cleanMerged.imageTraceEngine);
  const vectorizerStrokeWidth = clampVectorizerStrokeWidth(cleanMerged.vectorizerStrokeWidth);
  const vectorizerStrokeColor = normalizeCanvasColor(cleanMerged.vectorizerStrokeColor, outlineColor);
  const vectorizerLineAdjust = clampVectorizerLineAdjust(cleanMerged.vectorizerLineAdjust);
  const vectorizerInkThreshold = clampVectorizerInkThreshold(cleanMerged.vectorizerInkThreshold);
  const vectorizerFidelity = normalizeVectorizerFidelity(cleanMerged.vectorizerFidelity);
  const clipartAssets = normalizeClipartAssets(cleanMerged.clipartAssets);
  const clipartImages = normalizeClipartImages(cleanMerged.clipartImages, {
    imageLineThickness,
    sourceFillThreshold,
    sourceFillMinStrokePixels,
    strokeGapClosePixels,
    vectorizerLineAdjust,
    vectorizerInkThreshold,
    vectorizerFidelity,
  }).filter((image) => clipartAssets.some((asset) => asset.id === image.assetId));
  const gridLineColor = normalizeGraphLineColor(cleanMerged.gridLineColor, DEFAULT_GRID_LINE_COLOR);
  const gridLineLayer = hasBrokenLegacyArtworkWidth
    ? DEFAULT_GRAPH_LINE_LAYER
    : isGraphLineLayer(cleanMerged.gridLineLayer)
      ? cleanMerged.gridLineLayer
      : DEFAULT_GRAPH_LINE_LAYER;
  const gridLineStyle = isGraphGridLineStyle(cleanMerged.gridLineStyle) ? cleanMerged.gridLineStyle : DEFAULT_GRID_LINE_STYLE;
  const gridPattern = isGraphGridPattern(cleanMerged.gridPattern) ? cleanMerged.gridPattern : DEFAULT_GRID_PATTERN;
  const showNumbers = typeof cleanMerged.showNumbers === "boolean" ? cleanMerged.showNumbers : true;
  const gridNumberPlacement =
    cleanMerged.gridNumberPlacement === "outside" ? "outside" : defaultGraphSettings.gridNumberPlacement;
  const showPageBreaks = typeof cleanMerged.showPageBreaks === "boolean" ? cleanMerged.showPageBreaks : true;
  const majorGridEvery = isMajorGridEvery(cleanMerged.majorGridEvery) ? cleanMerged.majorGridEvery : DEFAULT_MAJOR_GRID_EVERY;
  void legacyCellSizeInches;
  const cellSizeCm = DEFAULT_CELL_SIZE_CM;
  const measurementUnit = isMeasurementUnit(cleanMerged.measurementUnit) ? cleanMerged.measurementUnit : defaultGraphSettings.measurementUnit;
  const sourceImages = normalizeSourceImages(cleanMerged.sourceImages, graphWidth, graphHeight, {
    measurementUnit,
    imageLineThickness,
    sourceFillThreshold,
    sourceFillMinStrokePixels,
    strokeGapClosePixels,
    vectorizerLineAdjust,
    vectorizerInkThreshold,
    vectorizerFidelity,
  });
  const printPaperSize = isPrintPaperSize(cleanMerged.printPaperSize) ? cleanMerged.printPaperSize : DEFAULT_PRINT_PAPER_SIZE;
  const printOrientation = isPrintOrientation(cleanMerged.printOrientation) ? cleanMerged.printOrientation : DEFAULT_PRINT_ORIENTATION;
  const printHorizontalAlignment = isPrintHorizontalAlignment(cleanMerged.printHorizontalAlignment)
    ? cleanMerged.printHorizontalAlignment
    : DEFAULT_PRINT_HORIZONTAL_ALIGNMENT;
  const printVerticalAlignment = isPrintVerticalAlignment(cleanMerged.printVerticalAlignment)
    ? cleanMerged.printVerticalAlignment
    : DEFAULT_PRINT_VERTICAL_ALIGNMENT;

  return {
    ...cleanMerged,
    graphWidth,
    graphHeight,
    cellWidth,
    cellHeight,
    cellSizeCm,
    measurementUnit,
    printPaperSize,
    printOrientation,
    printHorizontalAlignment,
    printVerticalAlignment,
    pixelSize: cellWidth,
    gridCellSize: cellWidth,
    outputWidth,
    outputHeight,
    backgroundColor,
    lineColor: outlineColor,
    outlineColor,
    fillColor,
    fillRegions,
    cellPaints,
    graphShapes,
    clipartAssets,
    clipartImages,
    layerGroups: normalizeLayerGroups((cleanMerged as { layerGroups?: unknown }).layerGroups),
    imageLineThickness,
    sourceFillThreshold,
    sourceFillMinStrokePixels,
    strokeGapClosePixels,
    imageAutoEnhance,
    imageDenoiseLevel,
    imageEdgeDetection,
    imageColorQuantization,
    imageTraceEngine,
    vectorizerStrokeWidth,
    vectorizerStrokeColor,
    vectorizerLineAdjust,
    vectorizerInkThreshold,
    vectorizerFidelity,
    gridLineColor,
    gridLineLayer,
    gridLineStyle,
    gridPattern,
    showNumbers,
    gridNumberPlacement,
    showPageBreaks,
    majorGridEvery,
    imageWidth,
    imageHeight,
    sourceImages,
    imagePadding,
    imageOffsetX,
    imageOffsetY,
    spotShape: "round",
    blackAndWhite: true,
    limitedColorMode: true,
    maxColors: 4,
  };
}

async function signedUrlsForBucket(bucket: string, paths: Array<string | null | undefined>) {
  const uniquePaths = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  const signedByPath = new Map<string, string | null>();
  if (!uniquePaths.length) return signedByPath;
  const supabase = tryGetSupabaseAdmin();
  if (!supabase) return signedByPath;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(uniquePaths, 60 * 60);
  if (error) return signedByPath;
  for (const item of data ?? []) {
    if (item.path) signedByPath.set(item.path, item.signedUrl ?? null);
  }
  return signedByPath;
}

async function mapProject(row: DbProject, palettes: DbPalette[] = [], signedImageUrlMode: SignedImageUrlMode = "all"): Promise<Project> {
  const baseSettings = normalizeGraphSettings(row.settings);
  const fallbackSourceImages = row.original_image_path
    ? [
        {
          id: "original",
          name: sourceNameFromPath(row.original_image_path),
          path: row.original_image_path,
          url: null,
          width: baseSettings.imageWidth,
          height: baseSettings.imageHeight,
          measurementUnit: baseSettings.measurementUnit,
          imageLineThickness: baseSettings.imageLineThickness,
          sourceFillThreshold: baseSettings.sourceFillThreshold,
          sourceFillMinStrokePixels: baseSettings.sourceFillMinStrokePixels,
          strokeGapClosePixels: baseSettings.strokeGapClosePixels,
          imageAutoEnhance: DEFAULT_IMAGE_AUTO_ENHANCE,
          imageDenoiseLevel: DEFAULT_IMAGE_DENOISE_LEVEL,
          imageEdgeDetection: DEFAULT_IMAGE_EDGE_DETECTION,
          imageColorQuantization: DEFAULT_IMAGE_COLOR_QUANTIZATION,
          vectorizerLineAdjust: DEFAULT_VECTORIZER_LINE_ADJUST,
          vectorizerInkThreshold: DEFAULT_VECTORIZER_INK_THRESHOLD,
          vectorizerFidelity: DEFAULT_VECTORIZER_FIDELITY,
          x: defaultSourceX(baseSettings.graphWidth, baseSettings.imageWidth),
          y: 0,
          topPadding: 0,
          bottomPadding: 0,
          locked: false,
          visible: true,
          rotationDegrees: 0 as const,
          flipX: false,
          flipY: false,
        },
      ]
    : [];
  const unsignedSourceImages = baseSettings.sourceImages.length ? baseSettings.sourceImages : fallbackSourceImages;
  const unsignedClipartAssets = baseSettings.clipartAssets ?? [];
  const [originalSignedUrls, processedSignedUrls] = await Promise.all([
    signedImageUrlMode === "none"
      ? Promise.resolve(new Map<string, string | null>())
      : signedUrlsForBucket(ORIGINAL_IMAGES_BUCKET, [
          row.original_image_path,
          ...unsignedSourceImages.map((source) => source.path),
          ...unsignedClipartAssets.map((asset) => asset.path),
        ]),
    signedImageUrlMode === "all"
      ? signedUrlsForBucket(PROCESSED_IMAGES_BUCKET, [row.processed_image_path])
      : Promise.resolve(new Map<string, string | null>()),
  ]);
  const originalImageUrl = row.original_image_path ? originalSignedUrls.get(row.original_image_path) ?? null : null;
  const processedImageUrl = row.processed_image_path ? processedSignedUrls.get(row.processed_image_path) ?? null : null;
  const sourceImages = unsignedSourceImages.map(({ url: _url, ...source }) => ({
    ...source,
    url: source.path ? originalSignedUrls.get(source.path) ?? null : null,
  }));
  const clipartAssets = unsignedClipartAssets.map(({ url: _url, dataUrl: _dataUrl, ...asset }) => ({
    ...asset,
    url: asset.path ? originalSignedUrls.get(asset.path) ?? null : null,
    dataUrl: null,
  }));
  const settings = {
    ...baseSettings,
    sourceImages,
    clipartAssets,
  };

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    originalImagePath: row.original_image_path,
    processedImagePath: row.processed_image_path,
    settings,
    width: Number(row.width ?? settings.outputWidth),
    height: Number(row.height ?? settings.outputHeight),
    pixelSize: Number(row.pixel_size ?? settings.pixelSize),
    gridCellSize: Number(row.grid_cell_size ?? settings.gridCellSize),
    colorCount: Number(row.color_count ?? palettes.length),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    palettes: palettes.map(mapPalette).sort((a, b) => a.sortOrder - b.sortOrder),
    originalImageUrl,
    processedImageUrl,
  };
}

type ProjectSummaryPageOptions = {
  query?: string;
  cursor?: string;
  pageSize?: number;
};

type ProjectSummaryCursor = {
  updatedAt: string;
  id: string;
};

function decodeProjectCursor(cursor?: string): ProjectSummaryCursor | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<ProjectSummaryCursor>;
    if (typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt))) return null;
    if (typeof value.id !== "string" || !/^[0-9a-f-]{36}$/i.test(value.id)) return null;
    return { updatedAt: value.updatedAt, id: value.id };
  } catch {
    return null;
  }
}

function encodeProjectCursor(cursor: ProjectSummaryCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export async function getProjectSummaries(options: ProjectSummaryPageOptions = {}) {
  const session = await requireSession();
  const supabase = tryGetSupabaseAdmin();
  if (!supabase) return { projects: [] as ProjectSummary[], nextCursor: null };
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 25));

  const normalizedQuery = options.query?.trim();
  const cursor = decodeProjectCursor(options.cursor);
  const { data, error } = await supabase.rpc("get_project_summaries", {
    p_user_id: session.userId,
    p_query: normalizedQuery || null,
    p_cursor_updated_at: cursor?.updatedAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: pageSize + 1,
  });
  if (error) throw new Error(error.message);

  const allRows = (data ?? []) as Array<Omit<DbProject, "settings"> & { palette_preview: unknown }>;
  const hasMore = allRows.length > pageSize;
  const rows = allRows.slice(0, pageSize);

  const [processedSignedUrls, originalSignedUrls] = await Promise.all([
    signedUrlsForBucket(PROCESSED_IMAGES_BUCKET, rows.map((row) => row.processed_image_path)),
    signedUrlsForBucket(ORIGINAL_IMAGES_BUCKET, rows.map((row) => row.original_image_path)),
  ]);

  const projects = rows.map((row) => {
    const paletteRows = Array.isArray(row.palette_preview)
      ? row.palette_preview.filter((palette): palette is DbPalette => Boolean(palette && typeof palette === "object"))
      : [];
    const palettes = paletteRows.map(mapPalette).sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      originalImagePath: row.original_image_path,
      processedImagePath: row.processed_image_path,
      width: Number(row.width ?? defaultGraphSettings.outputWidth),
      height: Number(row.height ?? defaultGraphSettings.outputHeight),
      pixelSize: Number(row.pixel_size ?? defaultGraphSettings.pixelSize),
      gridCellSize: Number(row.grid_cell_size ?? defaultGraphSettings.gridCellSize),
      colorCount: Number(row.color_count ?? palettes.length),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      originalImageUrl: row.original_image_path ? originalSignedUrls.get(row.original_image_path) ?? null : null,
      processedImageUrl: row.processed_image_path ? processedSignedUrls.get(row.processed_image_path) ?? null : null,
      palettePreview: palettes.slice(0, 6),
    };
  });
  const lastRow = rows.at(-1);
  return {
    projects,
    nextCursor: hasMore && lastRow ? encodeProjectCursor({ updatedAt: lastRow.updated_at, id: lastRow.id }) : null,
  };
}

export async function getProjectForCurrentUser(projectId: string) {
  const session = await requireSession();
  const supabase = getSupabaseAdmin();

  const [projectResult, paletteResult] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, user_id, title, description, original_image_path, processed_image_path, settings, width, height, pixel_size, grid_cell_size, color_count, created_at, updated_at",
      )
      .eq("id", projectId)
      .eq("user_id", session.userId)
      .maybeSingle(),
    supabase
      .from("project_palettes")
      .select("id, color_name, hex_code, locked, cell_count, sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
  ]);

  const { data: project, error } = projectResult;
  if (error) throw new Error(error.message);
  if (!project) return null;

  const { data: palettes, error: paletteError } = paletteResult;
  if (paletteError) throw new Error(paletteError.message);
  return mapProject(project as DbProject, (palettes ?? []) as DbPalette[], "original");
}

export async function assertProjectOwner(projectId: string) {
  const session = await requireSession();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id, title, description, original_image_path, processed_image_path, settings, width, height, pixel_size, grid_cell_size, color_count")
    .eq("id", projectId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project not found.");
  return data as {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    original_image_path: string | null;
    processed_image_path: string | null;
    settings: StoredGraphSettings | null;
    width: number;
    height: number;
    pixel_size: number;
    grid_cell_size: number;
    color_count: number;
  };
}

export function imagePath(userId: string, projectId: string, kind: "original" | "processed", extension: string) {
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  return `${userId}/${projectId}/${kind}.${safeExtension}`;
}

export function sourceImagePath(userId: string, projectId: string, imageId: string, extension: string) {
  const safeImageId = imageId.toLowerCase().replace(/[^a-z0-9-]/g, "") || crypto.randomUUID();
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  return `${userId}/${projectId}/sources/${safeImageId}.${safeExtension}`;
}

export function clipartImagePath(userId: string, projectId: string, clipartId: string, extension: string) {
  const safeClipartId = clipartId.toLowerCase().replace(/[^a-z0-9-]/g, "") || crypto.randomUUID();
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  return `${userId}/${projectId}/cliparts/${safeClipartId}.${safeExtension}`;
}

export async function replaceProjectPalettes(projectId: string, palettes: PaletteColor[]) {
  const supabase = getSupabaseAdmin();
  const owner = await assertProjectOwner(projectId);

  const { error: deleteError } = await supabase.from("project_palettes").delete().eq("project_id", owner.id);
  if (deleteError) throw new Error(deleteError.message);

  if (!palettes.length) return;

  const { error } = await supabase.from("project_palettes").insert(
    palettes.map((color, index) => ({
      project_id: projectId,
      color_name: color.name || `Color ${index + 1}`,
      hex_code: color.hex,
      locked: color.locked,
      cell_count: color.cellCount,
      sort_order: index,
    })),
  );

  if (error) throw new Error(error.message);
}
