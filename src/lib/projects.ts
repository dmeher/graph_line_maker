import "server-only";

import { getSupabaseAdmin, tryGetSupabaseAdmin } from "@/lib/supabase/server";
import { ORIGINAL_IMAGES_BUCKET, PROCESSED_IMAGES_BUCKET } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import {
  DEFAULT_CELL_SIZE_CM,
  DEFAULT_GRAPH_LINE_LAYER,
  DEFAULT_GRAPH_HEIGHT_CELLS,
  DEFAULT_GRAPH_WIDTH_CELLS,
  DEFAULT_IMAGE_HEIGHT_CELLS,
  DEFAULT_IMAGE_LINE_THICKNESS,
  DEFAULT_IMAGE_WIDTH_CELLS,
  DEFAULT_GRID_LINE_COLOR,
  DEFAULT_OUTLINE_COLOR,
  DEFAULT_PRINT_HORIZONTAL_ALIGNMENT,
  DEFAULT_PRINT_ORIENTATION,
  DEFAULT_PRINT_PAPER_SIZE,
  DEFAULT_PRINT_VERTICAL_ALIGNMENT,
  DEFAULT_SOURCE_FILL_MIN_STROKE_PIXELS,
  DEFAULT_SOURCE_FILL_THRESHOLD,
  DEFAULT_STROKE_GAP_CLOSE_PIXELS,
  GRAPH_MAJOR_CELL_PIXELS,
  TRANSPARENT_FILL_COLOR,
  isGraphLineLayer,
  isFillColor,
  isPrintHorizontalAlignment,
  isPrintOrientation,
  isPrintPaperSize,
  isPrintVerticalAlignment,
  isHexColor,
  clampImageLineThickness,
  clampSourceFillMinStrokePixels,
  clampSourceFillThreshold,
  clampStrokeGapClosePixels,
} from "@/lib/graph-paper";
import { normalizeRotationDegrees } from "@/lib/editor/source-layout";
import type { GraphSettings, GraphSourceImage, PaletteColor, Project, ProjectSummary } from "@/lib/types";

const MAX_CANVAS_DIMENSION = 24000;
const MAX_SOURCE_IMAGES = 12;
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
  backgroundColor: "#ffffff",
  lineColor: DEFAULT_OUTLINE_COLOR,
  outlineColor: DEFAULT_OUTLINE_COLOR,
  fillColor: TRANSPARENT_FILL_COLOR,
  fillRegions: {},
  imageLineThickness: DEFAULT_IMAGE_LINE_THICKNESS,
  sourceFillThreshold: DEFAULT_SOURCE_FILL_THRESHOLD,
  sourceFillMinStrokePixels: DEFAULT_SOURCE_FILL_MIN_STROKE_PIXELS,
  strokeGapClosePixels: DEFAULT_STROKE_GAP_CLOSE_PIXELS,
  gridLineColor: DEFAULT_GRID_LINE_COLOR,
  gridLineLayer: DEFAULT_GRAPH_LINE_LAYER,
  gridLineThickness: 1,
  showBorder: true,
  transparentBackground: false,
  showNumbers: true,
  gridNumberPlacement: "inside",
  showPageBreaks: true,
  majorGridEvery: 5,
  imageWidth: DEFAULT_IMAGE_WIDTH_CELLS,
  imageHeight: DEFAULT_IMAGE_HEIGHT_CELLS,
  sourceImages: [],
  cellPaints: [],
  graphShapes: [],
  imagePadding: 0,
  imageOffsetX: 0,
  imageOffsetY: 0,
  spotPadding: 0,
  spotShape: "round",
  pageMargin: 24,
  blackAndWhite: false,
  limitedColorMode: true,
  maxColors: 8,
};

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
    hex: row.hex_code,
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
    .filter(([regionId, color]) => /^\d+$/.test(regionId) && isFillColor(color))
    .slice(0, 500);
  return Object.fromEntries(entries);
}

const GRAPH_CELL_LINE_SIDES = ["top", "right", "bottom", "left"] as const;
const GRAPH_SHAPE_KINDS = ["square", "rectangle", "circle", "oval", "line", "arrow"] as const;

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
      const lineColor = isHexColor(record.lineColor) ? record.lineColor : DEFAULT_OUTLINE_COLOR;
      const fillColor = isFillColor(record.fillColor) ? record.fillColor : TRANSPARENT_FILL_COLOR;
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
          rotationDegrees: normalizeRotationDegrees(record.rotationDegrees),
          flipX: Boolean(record.flipX),
          flipY: Boolean(record.flipY),
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
      const strokeColor = isHexColor(record.strokeColor) ? record.strokeColor : DEFAULT_OUTLINE_COLOR;
      const fillColor = isFillColor(record.fillColor) ? record.fillColor : TRANSPARENT_FILL_COLOR;
      const strokeWidthValue = Number(record.strokeWidth);
      const strokeWidth = Math.max(1, Math.min(24, Number.isFinite(strokeWidthValue) ? Math.round(strokeWidthValue) : 3));
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
          locked: Boolean(record.locked),
          rotationDegrees: normalizeRotationDegrees(record.rotationDegrees),
          flipX: Boolean(record.flipX),
          flipY: Boolean(record.flipY),
        },
      ];
    })
    .slice(0, 500);
}

function normalizeSourceImages(
  value: unknown,
  graphWidth: number,
  graphHeight: number,
  defaults: Pick<
    GraphSettings,
    "measurementUnit" | "imageLineThickness" | "sourceFillThreshold" | "sourceFillMinStrokePixels" | "strokeGapClosePixels"
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
      const x = clampSourceX(record.x, graphWidth, width);
      const topPadding = clampPaddingCells(record.topPadding, graphHeight, 0);
      const bottomPadding = clampPaddingCells(record.bottomPadding, graphHeight, 0);
      const y = clampFreeCellCoordinate(record.y, legacyY + topPadding);
      legacyY = y + height + bottomPadding;
      const locked = Boolean(record.locked);
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
          x,
          y,
          topPadding,
          bottomPadding,
          locked,
          rotationDegrees,
          flipX,
          flipY,
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
  const graphWidthLimit = Math.max(1, Math.floor(MAX_CANVAS_DIMENSION / cellWidth));
  const graphHeightLimit = Math.max(1, Math.floor(MAX_CANVAS_DIMENSION / cellHeight));
  const rawGraphWidth = Math.max(1, Math.min(graphWidthLimit, Math.round(merged.graphWidth || Math.round((merged.outputWidth || defaultGraphSettings.outputWidth) / cellWidth))));
  const rawGraphHeight = Math.max(1, Math.min(graphHeightLimit, Math.round(merged.graphHeight || Math.round((merged.outputHeight || defaultGraphSettings.outputHeight) / cellHeight))));
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
  const outlineColor = isHexColor(cleanMerged.outlineColor) ? cleanMerged.outlineColor : isHexColor(cleanMerged.lineColor) ? cleanMerged.lineColor : DEFAULT_OUTLINE_COLOR;
  const fillColor = isFillColor(cleanMerged.fillColor) ? cleanMerged.fillColor : TRANSPARENT_FILL_COLOR;
  const fillRegions = normalizeFillRegions(cleanMerged.fillRegions);
  const cellPaints = normalizeCellPaints(cleanMerged.cellPaints);
  const graphShapes = normalizeGraphShapes(cleanMerged.graphShapes);
  const imageLineThickness = clampImageLineThickness(cleanMerged.imageLineThickness);
  const sourceFillThreshold = clampSourceFillThreshold(cleanMerged.sourceFillThreshold);
  const sourceFillMinStrokePixels = clampSourceFillMinStrokePixels(cleanMerged.sourceFillMinStrokePixels);
  const strokeGapClosePixels = clampStrokeGapClosePixels(cleanMerged.strokeGapClosePixels);
  const gridLineColor = isHexColor(cleanMerged.gridLineColor) && cleanMerged.gridLineColor.toLowerCase() !== "#cbd5e1" ? cleanMerged.gridLineColor : DEFAULT_GRID_LINE_COLOR;
  const gridLineLayer = hasBrokenLegacyArtworkWidth
    ? DEFAULT_GRAPH_LINE_LAYER
    : isGraphLineLayer(cleanMerged.gridLineLayer)
      ? cleanMerged.gridLineLayer
      : DEFAULT_GRAPH_LINE_LAYER;
  const showNumbers = typeof cleanMerged.showNumbers === "boolean" ? cleanMerged.showNumbers : true;
  const gridNumberPlacement = cleanMerged.gridNumberPlacement === "outside" ? "outside" : "inside";
  const showPageBreaks = typeof cleanMerged.showPageBreaks === "boolean" ? cleanMerged.showPageBreaks : true;
  void legacyCellSizeInches;
  const cellSizeCm = DEFAULT_CELL_SIZE_CM;
  const measurementUnit = isMeasurementUnit(cleanMerged.measurementUnit) ? cleanMerged.measurementUnit : defaultGraphSettings.measurementUnit;
  const sourceImages = normalizeSourceImages(cleanMerged.sourceImages, graphWidth, graphHeight, {
    measurementUnit,
    imageLineThickness,
    sourceFillThreshold,
    sourceFillMinStrokePixels,
    strokeGapClosePixels,
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
    lineColor: outlineColor,
    outlineColor,
    fillColor,
    fillRegions,
    cellPaints,
    graphShapes,
    imageLineThickness,
    sourceFillThreshold,
    sourceFillMinStrokePixels,
    strokeGapClosePixels,
    gridLineColor,
    gridLineLayer,
    showNumbers,
    gridNumberPlacement,
    showPageBreaks,
    imageWidth,
    imageHeight,
    sourceImages,
    imagePadding,
    imageOffsetX,
    imageOffsetY,
    spotShape: "round",
  };
}

async function signedImageUrl(bucket: string, path?: string | null) {
  if (!path) return null;
  const supabase = tryGetSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

async function signedSourceImages(
  sourceImages: GraphSourceImage[],
  signedImageUrlMode: SignedImageUrlMode,
  originalImagePath: string | null,
  originalImageUrl: string | null,
) {
  if (signedImageUrlMode === "none") {
    return sourceImages.map(({ url: _url, ...source }) => ({ ...source, url: null }));
  }

  return Promise.all(
    sourceImages.map(async (source) => ({
      ...source,
      url: source.path === originalImagePath ? originalImageUrl : await signedImageUrl(ORIGINAL_IMAGES_BUCKET, source.path),
    })),
  );
}

async function mapProject(row: DbProject, palettes: DbPalette[] = [], signedImageUrlMode: SignedImageUrlMode = "all"): Promise<Project> {
  const baseSettings = normalizeGraphSettings(row.settings);
  const [originalImageUrl, processedImageUrl] = await Promise.all([
    signedImageUrlMode === "none" ? Promise.resolve(null) : signedImageUrl(ORIGINAL_IMAGES_BUCKET, row.original_image_path),
    signedImageUrlMode === "all" ? signedImageUrl(PROCESSED_IMAGES_BUCKET, row.processed_image_path) : Promise.resolve(null),
  ]);
  const fallbackSourceImages = row.original_image_path
    ? [
        {
          id: "original",
          name: sourceNameFromPath(row.original_image_path),
          path: row.original_image_path,
          url: originalImageUrl,
          width: baseSettings.imageWidth,
          height: baseSettings.imageHeight,
          measurementUnit: baseSettings.measurementUnit,
          imageLineThickness: baseSettings.imageLineThickness,
          sourceFillThreshold: baseSettings.sourceFillThreshold,
          sourceFillMinStrokePixels: baseSettings.sourceFillMinStrokePixels,
          strokeGapClosePixels: baseSettings.strokeGapClosePixels,
          x: defaultSourceX(baseSettings.graphWidth, baseSettings.imageWidth),
          y: 0,
          topPadding: 0,
          bottomPadding: 0,
          locked: false,
          rotationDegrees: 0 as const,
          flipX: false,
          flipY: false,
        },
      ]
    : [];
  const sourceImages = await signedSourceImages(
    baseSettings.sourceImages.length ? baseSettings.sourceImages : fallbackSourceImages,
    signedImageUrlMode,
    row.original_image_path,
    originalImageUrl,
  );
  const settings = {
    ...baseSettings,
    sourceImages,
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

export async function getProjectSummaries(query?: string): Promise<ProjectSummary[]> {
  const session = await requireSession();
  const supabase = tryGetSupabaseAdmin();
  if (!supabase) return [];

  let request = supabase
    .from("projects")
    .select(
      "id, user_id, title, description, original_image_path, processed_image_path, width, height, pixel_size, grid_cell_size, color_count, created_at, updated_at",
    )
    .eq("user_id", session.userId)
    .order("updated_at", { ascending: false });

  const normalizedQuery = query?.trim();
  if (normalizedQuery) {
    request = request.ilike("title", `%${normalizedQuery}%`);
  }

  const { data, error } = await request;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<Omit<DbProject, "settings">>;
  const ids = rows.map((row) => row.id);
  const paletteByProject = new Map<string, DbPalette[]>();

  if (ids.length) {
    const { data: palettes, error: paletteError } = await supabase
      .from("project_palettes")
      .select("id, project_id, color_name, hex_code, locked, cell_count, sort_order")
      .in("project_id", ids)
      .order("sort_order", { ascending: true });

    if (paletteError) throw new Error(paletteError.message);
    for (const palette of (palettes ?? []) as (DbPalette & { project_id: string })[]) {
      const list = paletteByProject.get(palette.project_id) ?? [];
      list.push(palette);
      paletteByProject.set(palette.project_id, list);
    }
  }

  return rows.map((row) => {
    const palettes = (paletteByProject.get(row.id) ?? []).map(mapPalette).sort((a, b) => a.sortOrder - b.sortOrder);
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
      originalImageUrl: null,
      processedImageUrl: null,
      palettePreview: palettes.slice(0, 6),
    };
  });
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
    .select("id, user_id, original_image_path, processed_image_path")
    .eq("id", projectId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project not found.");
  return data as {
    id: string;
    user_id: string;
    original_image_path: string | null;
    processed_image_path: string | null;
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
