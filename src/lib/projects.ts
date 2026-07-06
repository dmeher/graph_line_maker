import "server-only";

import { getSupabaseAdmin, tryGetSupabaseAdmin } from "@/lib/supabase/server";
import { ORIGINAL_IMAGES_BUCKET, PROCESSED_IMAGES_BUCKET } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import {
  DEFAULT_CELL_SIZE_CM,
  DEFAULT_GRAPH_LINE_LAYER,
  DEFAULT_IMAGE_LINE_THICKNESS,
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
  MAX_IMAGE_PADDING_PIXELS,
  isGraphLineLayer,
  isFillColor,
  isPrintHorizontalAlignment,
  isPrintOrientation,
  isPrintPaperSize,
  isPrintVerticalAlignment,
  lightenColor,
  isHexColor,
  clampImageLineThickness,
  clampSourceFillMinStrokePixels,
  clampSourceFillThreshold,
  clampStrokeGapClosePixels,
} from "@/lib/graph-paper";
import type { GraphSettings, PaletteColor, Project, ProjectSummary } from "@/lib/types";

const MAX_CANVAS_DIMENSION = 6000;
type StoredGraphSettings = Partial<GraphSettings> & {
  cellSizeInches?: number;
};

export const defaultGraphSettings: GraphSettings = {
  graphWidth: 12,
  graphHeight: 12,
  cellWidth: GRAPH_MAJOR_CELL_PIXELS,
  cellHeight: GRAPH_MAJOR_CELL_PIXELS,
  cellSizeCm: DEFAULT_CELL_SIZE_CM,
  printPaperSize: DEFAULT_PRINT_PAPER_SIZE,
  printOrientation: DEFAULT_PRINT_ORIENTATION,
  printHorizontalAlignment: DEFAULT_PRINT_HORIZONTAL_ALIGNMENT,
  printVerticalAlignment: DEFAULT_PRINT_VERTICAL_ALIGNMENT,
  pixelSize: GRAPH_MAJOR_CELL_PIXELS,
  gridCellSize: GRAPH_MAJOR_CELL_PIXELS,
  outputWidth: 1920,
  outputHeight: 1920,
  backgroundColor: "#ffffff",
  lineColor: DEFAULT_OUTLINE_COLOR,
  outlineColor: DEFAULT_OUTLINE_COLOR,
  fillColor: lightenColor(DEFAULT_OUTLINE_COLOR),
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
  showNumbers: false,
  majorGridEvery: 5,
  imageWidth: 12,
  imageHeight: 12,
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

function roundCm(value: number) {
  return Math.round(value * 1000) / 1000;
}

function roundCells(value: number) {
  return Math.round(value * 100) / 100;
}

function clampImageCells(value: unknown, maxCells: number, fallback: number) {
  const numeric = Number(value);
  const safeFallback = Math.max(0.01, Math.min(maxCells, fallback));
  if (!Number.isFinite(numeric)) return roundCells(safeFallback);
  return roundCells(Math.max(0.01, Math.min(maxCells, numeric)));
}

function normalizeFillRegions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value)
    .filter(([regionId, color]) => /^\d+$/.test(regionId) && isFillColor(color))
    .slice(0, 500);
  return Object.fromEntries(entries);
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
  const graphWidth = Math.max(1, Math.min(graphWidthLimit, Math.round(merged.graphWidth || Math.round((merged.outputWidth || defaultGraphSettings.outputWidth) / cellWidth))));
  const graphHeight = Math.max(1, Math.min(graphHeightLimit, Math.round(merged.graphHeight || Math.round((merged.outputHeight || defaultGraphSettings.outputHeight) / cellHeight))));
  const imageAreaWidth = graphWidth * cellWidth;
  const imageAreaHeight = graphHeight * cellHeight;
  const maxImagePadding = Math.max(0, Math.min(MAX_IMAGE_PADDING_PIXELS, Math.floor((Math.min(imageAreaWidth, imageAreaHeight) - 1) / 2)));
  const legacyImagePadding = Math.max(0, Math.min(MAX_IMAGE_PADDING_PIXELS, maxImagePadding, Math.round(cleanMerged.imagePadding ?? 0)));
  const legacyPaddingCells = legacyImagePadding / GRAPH_MAJOR_CELL_PIXELS;
  const legacyPixelSizedImageWidth =
    Number(cleanMerged.imageWidth) > graphWidth && Number(cleanMerged.imageWidth) <= imageAreaWidth
      ? Number(cleanMerged.imageWidth) / GRAPH_MAJOR_CELL_PIXELS
      : cleanMerged.imageWidth;
  const legacyPixelSizedImageHeight =
    Number(cleanMerged.imageHeight) > graphHeight && Number(cleanMerged.imageHeight) <= imageAreaHeight
      ? Number(cleanMerged.imageHeight) / GRAPH_MAJOR_CELL_PIXELS
      : cleanMerged.imageHeight;
  const imageWidth = clampImageCells(legacyPixelSizedImageWidth, graphWidth, Math.max(0.01, graphWidth - legacyPaddingCells * 2));
  const imageHeight = clampImageCells(legacyPixelSizedImageHeight, graphHeight, Math.max(0.01, graphHeight - legacyPaddingCells * 2));
  const imagePadding = 0;
  const outputWidth = imageAreaWidth;
  const outputHeight = imageAreaHeight;
  const imageOffsetX = Math.max(-MAX_CANVAS_DIMENSION, Math.min(MAX_CANVAS_DIMENSION, Math.round(merged.imageOffsetX ?? 0)));
  const imageOffsetY = Math.max(-MAX_CANVAS_DIMENSION, Math.min(MAX_CANVAS_DIMENSION, Math.round(merged.imageOffsetY ?? 0)));
  const outlineColor = isHexColor(cleanMerged.outlineColor) ? cleanMerged.outlineColor : isHexColor(cleanMerged.lineColor) ? cleanMerged.lineColor : DEFAULT_OUTLINE_COLOR;
  const fillColor = isFillColor(cleanMerged.fillColor) ? cleanMerged.fillColor : lightenColor(outlineColor);
  const fillRegions = normalizeFillRegions(cleanMerged.fillRegions);
  const imageLineThickness = clampImageLineThickness(cleanMerged.imageLineThickness);
  const sourceFillThreshold = clampSourceFillThreshold(cleanMerged.sourceFillThreshold);
  const sourceFillMinStrokePixels = clampSourceFillMinStrokePixels(cleanMerged.sourceFillMinStrokePixels);
  const strokeGapClosePixels = clampStrokeGapClosePixels(cleanMerged.strokeGapClosePixels);
  const gridLineColor = isHexColor(cleanMerged.gridLineColor) && cleanMerged.gridLineColor.toLowerCase() !== "#cbd5e1" ? cleanMerged.gridLineColor : DEFAULT_GRID_LINE_COLOR;
  const gridLineLayer = isGraphLineLayer(cleanMerged.gridLineLayer) ? cleanMerged.gridLineLayer : DEFAULT_GRAPH_LINE_LAYER;
  const cellSizeCm = roundCm(Math.max(0.05, Math.min(100, Number(cleanMerged.cellSizeCm || legacyCellSizeInches || DEFAULT_CELL_SIZE_CM))));
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
    imageLineThickness,
    sourceFillThreshold,
    sourceFillMinStrokePixels,
    strokeGapClosePixels,
    gridLineColor,
    gridLineLayer,
    imageWidth,
    imageHeight,
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

async function mapProject(row: DbProject, palettes: DbPalette[] = []): Promise<Project> {
  const settings = normalizeGraphSettings(row.settings);

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
    originalImageUrl: await signedImageUrl(ORIGINAL_IMAGES_BUCKET, row.original_image_path),
    processedImageUrl: await signedImageUrl(PROCESSED_IMAGES_BUCKET, row.processed_image_path),
  };
}

export async function getProjectSummaries(query?: string): Promise<ProjectSummary[]> {
  const session = await requireSession();
  const supabase = tryGetSupabaseAdmin();
  if (!supabase) return [];

  let request = supabase
    .from("projects")
    .select(
      "id, user_id, title, description, original_image_path, processed_image_path, settings, width, height, pixel_size, grid_cell_size, color_count, created_at, updated_at",
    )
    .eq("user_id", session.userId)
    .order("updated_at", { ascending: false });

  const normalizedQuery = query?.trim();
  if (normalizedQuery) {
    request = request.ilike("title", `%${normalizedQuery}%`);
  }

  const { data, error } = await request;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DbProject[];
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

  return Promise.all(
    rows.map(async (row) => {
      const project = await mapProject(row, paletteByProject.get(row.id) ?? []);
      const { settings: _settings, palettes, ...summary } = project;
      void _settings;
      return {
        ...summary,
        palettePreview: palettes.slice(0, 6),
      };
    }),
  );
}

export async function getProjectForCurrentUser(projectId: string) {
  const session = await requireSession();
  const supabase = getSupabaseAdmin();

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, user_id, title, description, original_image_path, processed_image_path, settings, width, height, pixel_size, grid_cell_size, color_count, created_at, updated_at",
    )
    .eq("id", projectId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!project) return null;

  const { data: palettes, error: paletteError } = await supabase
    .from("project_palettes")
    .select("id, color_name, hex_code, locked, cell_count, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (paletteError) throw new Error(paletteError.message);
  return mapProject(project as DbProject, (palettes ?? []) as DbPalette[]);
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
