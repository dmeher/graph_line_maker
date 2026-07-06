"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PROCESSED_IMAGES_BUCKET, ORIGINAL_IMAGES_BUCKET } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import {
  GRAPH_LINE_LAYER_KEYS,
  MAX_IMAGE_LINE_THICKNESS,
  MAX_IMAGE_PADDING_PIXELS,
  MAX_SOURCE_FILL_MIN_STROKE_PIXELS,
  MAX_SOURCE_FILL_THRESHOLD,
  MAX_STROKE_GAP_CLOSE_PIXELS,
  MIN_IMAGE_LINE_THICKNESS,
  MIN_SOURCE_FILL_MIN_STROKE_PIXELS,
  MIN_SOURCE_FILL_THRESHOLD,
  MIN_STROKE_GAP_CLOSE_PIXELS,
  PRINT_HORIZONTAL_ALIGNMENT_KEYS,
  PRINT_ORIENTATION_KEYS,
  PRINT_PAPER_SIZE_KEYS,
  PRINT_VERTICAL_ALIGNMENT_KEYS,
  TRANSPARENT_FILL_COLOR,
} from "@/lib/graph-paper";
import { assertProjectOwner, defaultGraphSettings, imagePath, normalizeGraphSettings, replaceProjectPalettes } from "@/lib/projects";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const hexSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const fillColorSchema = z.union([hexSchema, z.literal(TRANSPARENT_FILL_COLOR)]);
const fillRegionsSchema = z
  .record(z.string().regex(/^\d+$/), fillColorSchema)
  .refine((value) => Object.keys(value).length <= 500, "Too many custom fill regions.");

const graphSettingsSchema = z.object({
  graphWidth: z.number().int().min(1).max(1000),
  graphHeight: z.number().int().min(1).max(1000),
  cellWidth: z.number().int().min(1).max(240),
  cellHeight: z.number().int().min(1).max(240),
  cellSizeCm: z.number().min(0.05).max(100),
  printPaperSize: z.enum(PRINT_PAPER_SIZE_KEYS),
  printOrientation: z.enum(PRINT_ORIENTATION_KEYS),
  printHorizontalAlignment: z.enum(PRINT_HORIZONTAL_ALIGNMENT_KEYS),
  printVerticalAlignment: z.enum(PRINT_VERTICAL_ALIGNMENT_KEYS),
  pixelSize: z.number().int().min(1).max(240),
  gridCellSize: z.number().int().min(1).max(240),
  outputWidth: z.number().int().min(1).max(6000),
  outputHeight: z.number().int().min(1).max(6000),
  backgroundColor: hexSchema,
  lineColor: hexSchema,
  outlineColor: hexSchema,
  fillColor: fillColorSchema,
  fillRegions: fillRegionsSchema,
  imageLineThickness: z.number().min(MIN_IMAGE_LINE_THICKNESS).max(MAX_IMAGE_LINE_THICKNESS),
  sourceFillThreshold: z.number().min(MIN_SOURCE_FILL_THRESHOLD).max(MAX_SOURCE_FILL_THRESHOLD),
  sourceFillMinStrokePixels: z.number().int().min(MIN_SOURCE_FILL_MIN_STROKE_PIXELS).max(MAX_SOURCE_FILL_MIN_STROKE_PIXELS),
  strokeGapClosePixels: z.number().int().min(MIN_STROKE_GAP_CLOSE_PIXELS).max(MAX_STROKE_GAP_CLOSE_PIXELS),
  gridLineColor: hexSchema,
  gridLineLayer: z.enum(GRAPH_LINE_LAYER_KEYS),
  gridLineThickness: z.number().int().min(0).max(10),
  showBorder: z.boolean(),
  transparentBackground: z.boolean(),
  showNumbers: z.boolean(),
  majorGridEvery: z.union([z.literal(5), z.literal(10)]),
  imagePadding: z.number().int().min(0).max(MAX_IMAGE_PADDING_PIXELS),
  imageOffsetX: z.number().int().min(-6000).max(6000),
  imageOffsetY: z.number().int().min(-6000).max(6000),
  spotPadding: z.number().int().min(0).max(48),
  spotShape: z.union([z.literal("round"), z.literal("square")]),
  pageMargin: z.number().int().min(0).max(400),
  blackAndWhite: z.boolean(),
  limitedColorMode: z.boolean(),
  maxColors: z.union([z.literal(2), z.literal(4), z.literal(8), z.literal(16)]),
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
  width: z.number().int().min(0).max(6000),
  height: z.number().int().min(0).max(6000),
  colorCount: z.number().int().min(0).max(256),
  palettes: z.array(paletteSchema).max(256),
});

export async function saveProjectState(input: z.infer<typeof saveProjectSchema>) {
  const session = await requireSession();
  const payload = saveProjectSchema.parse(input);
  await assertProjectOwner(payload.projectId);
  const normalizedSettings = normalizeGraphSettings({
    ...payload.settings,
    lineColor: payload.settings.outlineColor,
    pixelSize: payload.settings.cellWidth,
    gridCellSize: payload.settings.cellWidth,
    outputWidth: payload.settings.graphWidth * payload.settings.cellWidth + payload.settings.imagePadding * 2,
    outputHeight: payload.settings.graphHeight * payload.settings.cellHeight + payload.settings.imagePadding * 2,
    spotShape: "round",
  });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("projects")
    .update({
      title: payload.title,
      description: payload.description?.trim() || null,
      settings: normalizedSettings,
      width: normalizedSettings.outputWidth,
      height: normalizedSettings.outputHeight,
      pixel_size: normalizedSettings.cellWidth,
      grid_cell_size: normalizedSettings.cellWidth,
      color_count: payload.colorCount,
    })
    .eq("id", payload.projectId)
    .eq("user_id", session.userId);

  if (error) return { ok: false, message: error.message };

  await replaceProjectPalettes(payload.projectId, payload.palettes);
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

  const removals: Promise<unknown>[] = [];
  if (owner.original_image_path) removals.push(supabase.storage.from(ORIGINAL_IMAGES_BUCKET).remove([owner.original_image_path]));
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

  const { data: source, error: sourceError } = await supabase
    .from("projects")
    .select("title, description, settings, width, height, pixel_size, grid_cell_size, color_count")
    .eq("id", projectId)
    .eq("user_id", session.userId)
    .single();

  if (sourceError) throw new Error(sourceError.message);

  const { data: duplicate, error } = await supabase
    .from("projects")
    .insert({
      user_id: session.userId,
      title: `${source.title} Copy`,
      description: source.description,
      settings: source.settings ?? defaultGraphSettings,
      width: source.width,
      height: source.height,
      pixel_size: source.pixel_size,
      grid_cell_size: source.grid_cell_size,
      color_count: source.color_count,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (project.original_image_path) {
    const extension = project.original_image_path.split(".").pop() || "png";
    const newPath = imagePath(session.userId, duplicate.id, "original", extension);
    const { error: copyError } = await supabase.storage.from(ORIGINAL_IMAGES_BUCKET).copy(project.original_image_path, newPath);
    if (!copyError) {
      await supabase.from("projects").update({ original_image_path: newPath }).eq("id", duplicate.id);
    }
  }

  if (project.processed_image_path) {
    const newPath = imagePath(session.userId, duplicate.id, "processed", "png");
    const { error: copyError } = await supabase.storage.from(PROCESSED_IMAGES_BUCKET).copy(project.processed_image_path, newPath);
    if (!copyError) {
      await supabase.from("projects").update({ processed_image_path: newPath }).eq("id", duplicate.id);
    }
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
