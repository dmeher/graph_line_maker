"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_SOURCE_IMAGES, PROCESSED_IMAGES_BUCKET, ORIGINAL_IMAGES_BUCKET } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import {
  GRAPH_GRID_LINE_STYLE_KEYS,
  GRAPH_GRID_PATTERN_KEYS,
  CANVAS_COLOR_VALUES,
  GRAPH_LINE_COLOR_VALUES,
  GRAPH_IMAGE_DENOISE_LEVEL_KEYS,
  GRAPH_IMAGE_EDGE_DETECTION_KEYS,
  GRAPH_IMAGE_TRACE_ENGINE_KEYS,
  GRAPH_LINE_LAYER_KEYS,
  GRAPH_MAJOR_CELL_PIXELS,
  MAX_IMAGE_LINE_THICKNESS,
  MAX_IMAGE_PADDING_PIXELS,
  MAX_SOURCE_FILL_MIN_STROKE_PIXELS,
  MAX_SOURCE_FILL_THRESHOLD,
  MAX_STROKE_GAP_CLOSE_PIXELS,
  MAX_VECTORIZER_INK_THRESHOLD,
  MAX_VECTORIZER_LINE_ADJUST,
  MAX_VECTORIZER_STROKE_WIDTH,
  MIN_IMAGE_LINE_THICKNESS,
  MIN_SOURCE_FILL_MIN_STROKE_PIXELS,
  MIN_SOURCE_FILL_THRESHOLD,
  MIN_STROKE_GAP_CLOSE_PIXELS,
  MIN_VECTORIZER_INK_THRESHOLD,
  MIN_VECTORIZER_LINE_ADJUST,
  MIN_VECTORIZER_STROKE_WIDTH,
  PRINT_HORIZONTAL_ALIGNMENT_KEYS,
  PRINT_ORIENTATION_KEYS,
  PRINT_PAPER_SIZE_KEYS,
  PRINT_VERTICAL_ALIGNMENT_KEYS,
  TRANSPARENT_FILL_COLOR,
  VECTORIZER_LINE_ADJUST_STEP,
  GRAPH_VECTORIZER_FIDELITY_KEYS,
} from "@/lib/graph-paper";
import { MAX_CANVAS_DIMENSION, MAX_GRAPH_HEIGHT_CELLS, MAX_GRAPH_WIDTH_CELLS, inspectCanvasBudget } from "@/lib/canvas/performance-limits";
import { assertProjectOwner, clipartImagePath, imagePath, normalizeGraphSettings, sourceImagePath } from "@/lib/projects";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { GraphSettings, PaletteColor } from "@/lib/types";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const hexSchema = z.enum(CANVAS_COLOR_VALUES);
const graphLineColorSchema = z.enum(GRAPH_LINE_COLOR_VALUES);
const fillColorSchema = z.union([hexSchema, z.literal(TRANSPARENT_FILL_COLOR)]);
const rotationDegreesSchema = z
  .number()
  .min(0)
  .max(345)
  .refine((value) => Math.abs(value / 15 - Math.round(value / 15)) < 0.000001, "Rotation must use 15 degree steps.");
const fillRegionsSchema = z
  .record(z.string().regex(/^\d+$/), fillColorSchema)
  .refine((value) => Object.keys(value).length <= 500, "Too many custom fill regions.");
const cellLineSideSchema = z.union([z.literal("top"), z.literal("right"), z.literal("bottom"), z.literal("left")]);
const imageColorQuantizationSchema = z.union([
  z.literal("off"),
  z.literal(2),
  z.literal(4),
  z.literal(8),
  z.literal(16),
]);
const vectorizerLineAdjustSchema = z
  .number()
  .min(MIN_VECTORIZER_LINE_ADJUST)
  .max(MAX_VECTORIZER_LINE_ADJUST)
  .refine(
    (value) => Math.abs(value / VECTORIZER_LINE_ADJUST_STEP - Math.round(value / VECTORIZER_LINE_ADJUST_STEP)) < 0.000001,
    "Line adjustment must use 0.5 pixel steps.",
  );
const groupIdSchema = z.string().min(1).max(80).nullable().optional();
const eraseStrokeSchema = z.object({
  // Normalized UV coordinates across the source's working canvas; radius is a fraction of the canvas width.
  points: z
    .array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }))
    .min(1)
    .max(400),
  radius: z.number().min(0.0005).max(0.5),
});
const eraseStrokesSchema = z.array(eraseStrokeSchema).max(80).optional();
const backgroundRemovalSchema = z
  .object({ enabled: z.boolean(), tolerance: z.number().min(0).max(1) })
  .optional();
const layerGroupSchema = z.object({ id: z.string().min(1).max(80), name: z.string().min(1).max(120) });

const cellPaintSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  x: z.number().min(0).max(1000),
  y: z.number().min(0).max(1000),
  width: z.number().min(0.01).max(1000),
  height: z.number().min(0.01).max(1000),
  sides: z.array(cellLineSideSchema).max(4),
  lineColor: hexSchema,
  fillColor: fillColorSchema,
  lineWidth: z.number().int().min(1).max(24),
  locked: z.boolean(),
  visible: z.boolean(),
  rotationDegrees: rotationDegreesSchema,
  flipX: z.boolean(),
  flipY: z.boolean(),
  groupId: groupIdSchema,
});
const graphShapeSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  kind: z.union([z.literal("square"), z.literal("rectangle"), z.literal("circle"), z.literal("oval"), z.literal("half-circle"), z.literal("line"), z.literal("arrow")]),
  x: z.number().min(-1000).max(1000),
  y: z.number().min(-1000).max(1000),
  width: z.number().min(-1000).max(1000),
  height: z.number().min(-1000).max(1000),
  strokeColor: hexSchema,
  fillColor: fillColorSchema,
  strokeWidth: z.number().int().min(1).max(24),
  sides: z.array(cellLineSideSchema).max(4),
  locked: z.boolean(),
  visible: z.boolean(),
  rotationDegrees: rotationDegreesSchema,
  flipX: z.boolean(),
  flipY: z.boolean(),
  groupId: groupIdSchema,
});
const sourceImageSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  path: z.string().min(1).max(1024).nullable(),
  width: z.number().min(0.01).max(1000),
  height: z.number().min(0.01).max(1000),
  measurementUnit: z.enum(["cm", "in"]),
  imageLineThickness: z.number().min(MIN_IMAGE_LINE_THICKNESS).max(MAX_IMAGE_LINE_THICKNESS),
  sourceFillThreshold: z.number().min(MIN_SOURCE_FILL_THRESHOLD).max(MAX_SOURCE_FILL_THRESHOLD),
  sourceFillMinStrokePixels: z.number().int().min(MIN_SOURCE_FILL_MIN_STROKE_PIXELS).max(MAX_SOURCE_FILL_MIN_STROKE_PIXELS),
  strokeGapClosePixels: z.number().int().min(MIN_STROKE_GAP_CLOSE_PIXELS).max(MAX_STROKE_GAP_CLOSE_PIXELS),
  imageAutoEnhance: z.boolean(),
  imageDenoiseLevel: z.enum(GRAPH_IMAGE_DENOISE_LEVEL_KEYS),
  imageEdgeDetection: z.enum(GRAPH_IMAGE_EDGE_DETECTION_KEYS),
  imageColorQuantization: imageColorQuantizationSchema,
  vectorizerLineAdjust: vectorizerLineAdjustSchema,
  vectorizerInkThreshold: z.number().int().min(MIN_VECTORIZER_INK_THRESHOLD).max(MAX_VECTORIZER_INK_THRESHOLD),
  vectorizerFidelity: z.enum(GRAPH_VECTORIZER_FIDELITY_KEYS),
  x: z.number().min(-1000).max(1000),
  y: z.number().min(-1000).max(1000),
  topPadding: z.number().min(-1000).max(1000),
  bottomPadding: z.number().min(-1000).max(1000),
  locked: z.boolean(),
  visible: z.boolean(),
  rotationDegrees: rotationDegreesSchema,
  flipX: z.boolean(),
  flipY: z.boolean(),
  groupId: groupIdSchema,
  eraseStrokes: eraseStrokesSchema,
  backgroundRemoval: backgroundRemovalSchema,
});
const clipartAssetSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  path: z.string().min(1).max(1024).nullable(),
  mimeType: z.string().min(1).max(100),
  width: z.number().int().min(1).max(12000),
  height: z.number().int().min(1).max(12000),
  createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid created date."),
});
const clipartImageSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  assetId: z.string().min(1).max(80),
  x: z.number().min(-1000).max(1000),
  y: z.number().min(-1000).max(1000),
  width: z.number().min(0.01).max(1000),
  height: z.number().min(0.01).max(1000),
  strokeColor: hexSchema,
  fillColor: fillColorSchema,
  imageLineThickness: z.number().min(MIN_IMAGE_LINE_THICKNESS).max(MAX_IMAGE_LINE_THICKNESS),
  sourceFillThreshold: z.number().min(MIN_SOURCE_FILL_THRESHOLD).max(MAX_SOURCE_FILL_THRESHOLD),
  sourceFillMinStrokePixels: z.number().int().min(MIN_SOURCE_FILL_MIN_STROKE_PIXELS).max(MAX_SOURCE_FILL_MIN_STROKE_PIXELS),
  strokeGapClosePixels: z.number().int().min(MIN_STROKE_GAP_CLOSE_PIXELS).max(MAX_STROKE_GAP_CLOSE_PIXELS),
  imageAutoEnhance: z.boolean(),
  imageDenoiseLevel: z.enum(GRAPH_IMAGE_DENOISE_LEVEL_KEYS),
  imageEdgeDetection: z.enum(GRAPH_IMAGE_EDGE_DETECTION_KEYS),
  imageColorQuantization: imageColorQuantizationSchema,
  vectorizerLineAdjust: vectorizerLineAdjustSchema,
  vectorizerInkThreshold: z.number().int().min(MIN_VECTORIZER_INK_THRESHOLD).max(MAX_VECTORIZER_INK_THRESHOLD),
  vectorizerFidelity: z.enum(GRAPH_VECTORIZER_FIDELITY_KEYS),
  locked: z.boolean(),
  visible: z.boolean(),
  rotationDegrees: rotationDegreesSchema,
  flipX: z.boolean(),
  flipY: z.boolean(),
  groupId: groupIdSchema,
  eraseStrokes: eraseStrokesSchema,
  backgroundRemoval: backgroundRemovalSchema,
});

const graphSettingsSchema = z.object({
  graphWidth: z.number().int().min(1).max(MAX_GRAPH_WIDTH_CELLS),
  graphHeight: z.number().int().min(1).max(MAX_GRAPH_HEIGHT_CELLS),
  cellWidth: z.number().int().min(1).max(240),
  cellHeight: z.number().int().min(1).max(240),
  cellSizeCm: z.number().min(0.05).max(100),
  measurementUnit: z.enum(["cm", "in"]),
  printPaperSize: z.enum(PRINT_PAPER_SIZE_KEYS),
  printOrientation: z.enum(PRINT_ORIENTATION_KEYS),
  printHorizontalAlignment: z.enum(PRINT_HORIZONTAL_ALIGNMENT_KEYS),
  printVerticalAlignment: z.enum(PRINT_VERTICAL_ALIGNMENT_KEYS),
  pixelSize: z.number().int().min(1).max(240),
  gridCellSize: z.number().int().min(1).max(240),
  outputWidth: z.number().int().min(1).max(MAX_CANVAS_DIMENSION),
  outputHeight: z.number().int().min(1).max(MAX_CANVAS_DIMENSION),
  backgroundColor: hexSchema,
  lineColor: hexSchema,
  outlineColor: hexSchema,
  fillColor: fillColorSchema,
  fillRegions: fillRegionsSchema,
  imageLineThickness: z.number().min(MIN_IMAGE_LINE_THICKNESS).max(MAX_IMAGE_LINE_THICKNESS),
  sourceFillThreshold: z.number().min(MIN_SOURCE_FILL_THRESHOLD).max(MAX_SOURCE_FILL_THRESHOLD),
  sourceFillMinStrokePixels: z.number().int().min(MIN_SOURCE_FILL_MIN_STROKE_PIXELS).max(MAX_SOURCE_FILL_MIN_STROKE_PIXELS),
  strokeGapClosePixels: z.number().int().min(MIN_STROKE_GAP_CLOSE_PIXELS).max(MAX_STROKE_GAP_CLOSE_PIXELS),
  imageAutoEnhance: z.boolean(),
  imageDenoiseLevel: z.enum(GRAPH_IMAGE_DENOISE_LEVEL_KEYS),
  imageEdgeDetection: z.enum(GRAPH_IMAGE_EDGE_DETECTION_KEYS),
  imageColorQuantization: imageColorQuantizationSchema,
  imageTraceEngine: z.enum(GRAPH_IMAGE_TRACE_ENGINE_KEYS),
  vectorizerStrokeWidth: z.number().int().min(MIN_VECTORIZER_STROKE_WIDTH).max(MAX_VECTORIZER_STROKE_WIDTH),
  vectorizerStrokeColor: hexSchema,
  vectorizerLineAdjust: vectorizerLineAdjustSchema,
  vectorizerInkThreshold: z.number().int().min(MIN_VECTORIZER_INK_THRESHOLD).max(MAX_VECTORIZER_INK_THRESHOLD),
  vectorizerFidelity: z.enum(GRAPH_VECTORIZER_FIDELITY_KEYS),
  gridLineColor: graphLineColorSchema,
  gridLineLayer: z.enum(GRAPH_LINE_LAYER_KEYS),
  gridLineStyle: z.enum(GRAPH_GRID_LINE_STYLE_KEYS),
  gridPattern: z.enum(GRAPH_GRID_PATTERN_KEYS),
  gridLineThickness: z.number().int().min(0).max(10),
  showBorder: z.boolean(),
  transparentBackground: z.boolean(),
  showNumbers: z.boolean(),
  gridNumberPlacement: z.union([z.literal("inside"), z.literal("outside")]),
  showPageBreaks: z.boolean(),
  majorGridEvery: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
  imageWidth: z.number().min(0.01).max(MAX_GRAPH_HEIGHT_CELLS),
  imageHeight: z.number().min(0.01).max(MAX_GRAPH_HEIGHT_CELLS),
  sourceImages: z.array(sourceImageSchema).max(MAX_SOURCE_IMAGES),
  cellPaints: z.array(cellPaintSchema).max(2000),
  graphShapes: z.array(graphShapeSchema).max(500),
  clipartAssets: z.array(clipartAssetSchema).max(120),
  clipartImages: z.array(clipartImageSchema).max(500),
  layerGroups: z.array(layerGroupSchema).max(200).optional(),
  imagePadding: z.number().int().min(0).max(MAX_IMAGE_PADDING_PIXELS),
  imageOffsetX: z.number().int().min(-MAX_CANVAS_DIMENSION).max(MAX_CANVAS_DIMENSION),
  imageOffsetY: z.number().int().min(-MAX_CANVAS_DIMENSION).max(MAX_CANVAS_DIMENSION),
  spotPadding: z.number().int().min(0).max(48),
  spotShape: z.union([z.literal("round"), z.literal("square")]),
  pageMargin: z.number().int().min(0).max(400),
  blackAndWhite: z.boolean(),
  limitedColorMode: z.boolean(),
  maxColors: z.union([z.literal(2), z.literal(4), z.literal(8), z.literal(16)]),
}).superRefine((settings, context) => {
  const visibleLayers =
    settings.sourceImages.filter((source) => source.visible).length +
    settings.clipartImages.filter((clipart) => clipart.visible).length;
  const budget = inspectCanvasBudget(
    settings.graphWidth * GRAPH_MAJOR_CELL_PIXELS,
    settings.graphHeight * GRAPH_MAJOR_CELL_PIXELS,
    Math.max(1, visibleLayers),
  );
  if (!budget.allowed) {
    context.addIssue({ code: "custom", path: ["graphWidth"], message: budget.reason || "Canvas exceeds the safe processing budget." });
  }
});

const paletteSchema = z.object({
  name: z.string().min(1).max(80),
  hex: hexSchema,
  locked: z.boolean(),
  cellCount: z.number().int().min(0).max(100000000),
  sortOrder: z.number().int().min(0).max(1000),
});

const saveProjectSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  settings: graphSettingsSchema,
  width: z.number().int().min(0).max(MAX_CANVAS_DIMENSION),
  height: z.number().int().min(0).max(MAX_CANVAS_DIMENSION),
  colorCount: z.number().int().min(0).max(256),
  palettes: z.array(paletteSchema).max(256),
});

type SaveProjectStateInput = {
  projectId: string;
  title: string;
  description?: string;
  settings: GraphSettings;
  width: number;
  height: number;
  colorCount: number;
  palettes: PaletteColor[];
};

export async function saveProjectState(input: SaveProjectStateInput) {
  const session = await requireSession();
  const payload = saveProjectSchema.parse(input);
  const normalizedSettings = normalizeGraphSettings({
    ...payload.settings,
    lineColor: payload.settings.outlineColor,
    pixelSize: payload.settings.cellWidth,
    gridCellSize: payload.settings.cellWidth,
    outputWidth: payload.settings.graphWidth * payload.settings.cellWidth,
    outputHeight: payload.settings.graphHeight * payload.settings.cellHeight,
    spotShape: "round",
  });

  const supabase = getSupabaseAdmin();
  const { data: saved, error } = await supabase.rpc("save_project_state", {
    p_project_id: payload.projectId,
    p_user_id: session.userId,
    p_title: payload.title,
    p_description: payload.description?.trim() || "",
    p_settings: normalizedSettings,
    p_width: normalizedSettings.outputWidth,
    p_height: normalizedSettings.outputHeight,
    p_pixel_size: normalizedSettings.cellWidth,
    p_grid_cell_size: normalizedSettings.cellWidth,
    p_color_count: payload.colorCount,
    p_palettes: payload.palettes.map((color, index) => ({
      name: color.name || `Color ${index + 1}`,
      hex: color.hex,
      locked: color.locked,
      cell_count: color.cellCount,
      sort_order: index,
    })),
  });

  if (error) return { ok: false, message: error.message };
  if (!saved) return { ok: false, message: "Project not found." };
  revalidatePath(`/projects/${payload.projectId}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Project saved." };
}

export async function deleteProject(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  if (!projectId) throw new Error("Project id is required.");

  const owner = await assertProjectOwner(projectId);
  const supabase = getSupabaseAdmin();
  const settings = normalizeGraphSettings(owner.settings);

  const removals: Promise<unknown>[] = [];
  const originalPaths = Array.from(
    new Set(
      [
        owner.original_image_path,
        ...settings.sourceImages.map((source) => source.path),
        ...settings.clipartAssets.map((asset) => asset.path),
      ].filter((path): path is string => Boolean(path)),
    ),
  );
  if (originalPaths.length) removals.push(supabase.storage.from(ORIGINAL_IMAGES_BUCKET).remove(originalPaths));
  if (owner.processed_image_path) removals.push(supabase.storage.from(PROCESSED_IMAGES_BUCKET).remove([owner.processed_image_path]));
  await Promise.all(removals);

  const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("user_id", session.userId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function duplicateProject(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  if (!projectId) throw new Error("Project id is required.");

  const project = await assertProjectOwner(projectId);
  const supabase = getSupabaseAdmin();

  const { data: duplicate, error } = await supabase
    .from("projects")
    .insert({
      user_id: session.userId,
      title: `${project.title} Copy`,
      description: project.description,
      settings: project.settings,
      width: project.width,
      height: project.height,
      pixel_size: project.pixel_size,
      grid_cell_size: project.grid_cell_size,
      color_count: project.color_count,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const settings = normalizeGraphSettings(project.settings);
  const copyTargets = new Map<string, string>();
  if (project.original_image_path) {
    copyTargets.set(
      project.original_image_path,
      imagePath(session.userId, duplicate.id, "original", project.original_image_path.split(".").pop() || "png"),
    );
  }
  for (const source of settings.sourceImages) {
    if (!source.path || copyTargets.has(source.path)) continue;
    copyTargets.set(
      source.path,
      sourceImagePath(session.userId, duplicate.id, source.id, source.path.split(".").pop() || "png"),
    );
  }
  for (const asset of settings.clipartAssets) {
    if (!asset.path || copyTargets.has(asset.path)) continue;
    copyTargets.set(
      asset.path,
      clipartImagePath(session.userId, duplicate.id, asset.id, asset.path.split(".").pop() || "png"),
    );
  }

  const copiedPaths: string[] = [];
  try {
    await mapWithConcurrency(Array.from(copyTargets.entries()), 2, async ([sourcePath, targetPath]) => {
      const { error: copyError } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).copy(sourcePath, targetPath);
      if (copyError) throw new Error(copyError.message);
      copiedPaths.push(targetPath);
    });
    const duplicateSettings = normalizeGraphSettings({
      ...settings,
      sourceImages: settings.sourceImages.map(({ url: _url, ...source }) => ({
        ...source,
        path: source.path ? copyTargets.get(source.path) ?? null : null,
        url: null,
      })),
      clipartAssets: settings.clipartAssets.map(({ url: _url, dataUrl: _dataUrl, ...asset }) => ({
        ...asset,
        path: asset.path ? copyTargets.get(asset.path) ?? null : null,
        url: null,
        dataUrl: null,
      })),
    });
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        original_image_path: project.original_image_path ? copyTargets.get(project.original_image_path) ?? null : null,
        processed_image_path: null,
        settings: duplicateSettings,
      })
      .eq("id", duplicate.id)
      .eq("user_id", session.userId);
    if (updateError) throw new Error(updateError.message);
  } catch (copyError) {
    if (copiedPaths.length) await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).remove(copiedPaths);
    await supabase.from("projects").delete().eq("id", duplicate.id).eq("user_id", session.userId);
    throw copyError;
  }

  const { data: palettes, error: paletteError } = await supabase
    .from("project_palettes")
    .select("color_name, hex_code, locked, cell_count, sort_order")
    .eq("project_id", projectId);

  if (paletteError) throw new Error(paletteError.message);
  if (palettes?.length) {
    const { error: insertError } = await supabase.from("project_palettes").insert(
      palettes.map((palette) => ({
        ...palette,
        project_id: duplicate.id,
      })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/dashboard");
}
