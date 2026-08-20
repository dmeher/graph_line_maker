import { z } from "zod";
import { MAX_CANVAS_DIMENSION, MAX_CANVAS_PIXELS } from "../canvas/performance-limits.ts";
import { DESIGN_BLEND_MODES, DESIGN_DOCUMENT_VERSION, type DesignDocumentV1 } from "./types.ts";

export const MAX_DESIGN_NODES = 200;
export const MAX_DESIGN_POINTS = 100_000;
export const MAX_DESIGN_DOCUMENT_BYTES = 4 * 1024 * 1024;

const idSchema = z.string().uuid();
const pointSchema = z.object({ x: z.number().finite().min(-4).max(5), y: z.number().finite().min(-4).max(5) });
const absolutePointSchema = z.object({ x: z.number().finite().min(-MAX_CANVAS_DIMENSION * 2).max(MAX_CANVAS_DIMENSION * 2), y: z.number().finite().min(-MAX_CANVAS_DIMENSION * 2).max(MAX_CANVAS_DIMENSION * 2) });
const colorSchema = z.string().min(1).max(64);
const baseShape = {
  id: idSchema,
  name: z.string().trim().min(1).max(160),
  x: z.number().finite().min(-MAX_CANVAS_DIMENSION * 2).max(MAX_CANVAS_DIMENSION * 2),
  y: z.number().finite().min(-MAX_CANVAS_DIMENSION * 2).max(MAX_CANVAS_DIMENSION * 2),
  width: z.number().finite().positive().max(MAX_CANVAS_DIMENSION * 2),
  height: z.number().finite().positive().max(MAX_CANVAS_DIMENSION * 2),
  rotation: z.number().finite().min(-3600).max(3600),
  flipX: z.boolean(),
  flipY: z.boolean(),
  opacity: z.number().min(0).max(1),
  blendMode: z.enum(DESIGN_BLEND_MODES),
  visible: z.boolean(),
  locked: z.boolean(),
  parentId: idSchema.nullable(),
};

const maskSchema = z.discriminatedUnion("kind", [
  z.object({ id: idSchema, kind: z.literal("brush"), mode: z.enum(["erase", "restore"]), radius: z.number().positive().max(0.5), points: z.array(pointSchema).min(1).max(10_000) }),
  z.object({ id: idSchema, kind: z.literal("lasso"), mode: z.enum(["erase", "restore"]), points: z.array(pointSchema).min(3).max(10_000) }),
]);

const imageNodeSchema = z.object({
  ...baseShape,
  type: z.literal("image"),
  fileId: idSchema,
  crop: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).refine((crop) => crop.x + crop.width <= 1.000001 && crop.y + crop.height <= 1.000001, "Crop must stay inside the source."),
  masks: z.array(maskSchema).max(200),
  adjustments: z.object({
    brightness: z.number().min(-1).max(1), contrast: z.number().min(-100).max(100), saturation: z.number().min(-2).max(10), hue: z.number().min(-360).max(360), blur: z.number().min(0).max(100), grayscale: z.boolean(), sepia: z.boolean(), invert: z.boolean(),
  }),
});

const textNodeSchema = z.object({
  ...baseShape,
  type: z.literal("text"), text: z.string().max(20_000), fontFamily: z.string().min(1).max(120), fontSize: z.number().positive().max(2000), fontWeight: z.number().int().min(100).max(900), fontStyle: z.enum(["normal", "italic"]), align: z.enum(["left", "center", "right", "justify"]), lineHeight: z.number().min(0.5).max(5), letterSpacing: z.number().min(-100).max(500), fill: colorSchema, stroke: colorSchema, strokeWidth: z.number().min(0).max(100),
  runs: z.array(z.object({ start: z.number().int().min(0), end: z.number().int().min(0), fill: colorSchema.optional(), fontWeight: z.number().int().min(100).max(900).optional(), fontStyle: z.enum(["normal", "italic"]).optional() })).max(1000),
});

const shapeNodeSchema = z.object({
  ...baseShape,
  type: z.literal("shape"), shape: z.enum(["rectangle", "ellipse", "polygon", "line", "arrow"]), points: z.array(absolutePointSchema).max(10_000), fill: colorSchema, stroke: colorSchema, strokeWidth: z.number().min(0).max(200), dash: z.array(z.number().min(0).max(1000)).max(12), cornerRadius: z.number().min(0).max(2000), shadowColor: colorSchema, shadowBlur: z.number().min(0).max(200), shadowOffsetX: z.number().min(-1000).max(1000), shadowOffsetY: z.number().min(-1000).max(1000),
});

const pathNodeSchema = z.object({
  ...baseShape,
  type: z.literal("path"), points: z.array(absolutePointSchema).min(2).max(100_000), stroke: colorSchema, strokeWidth: z.number().positive().max(500), tool: z.enum(["pencil", "marker"]),
});

const groupNodeSchema = z.object({ ...baseShape, type: z.literal("group"), childIds: z.array(idSchema).min(1).max(MAX_DESIGN_NODES) });
const nodeSchema = z.discriminatedUnion("type", [imageNodeSchema, textNodeSchema, shapeNodeSchema, pathNodeSchema, groupNodeSchema]);

export const designDocumentSchema = z.object({
  version: z.literal(DESIGN_DOCUMENT_VERSION),
  canvas: z.object({ width: z.number().int().min(1).max(MAX_CANVAS_DIMENSION), height: z.number().int().min(1).max(MAX_CANVAS_DIMENSION), background: colorSchema.nullable() }).refine((canvas) => canvas.width * canvas.height <= MAX_CANVAS_PIXELS, `Canvas may contain at most ${MAX_CANVAS_PIXELS.toLocaleString()} pixels.`),
  nodes: z.array(nodeSchema).max(MAX_DESIGN_NODES),
}).superRefine((document, context) => {
  const nodesById = new Map(document.nodes.map((node) => [node.id, node])); const ids = new Set(nodesById.keys());
  let points = 0;
  for (const node of document.nodes) {
    if (node.parentId && nodesById.get(node.parentId)?.type !== "group") context.addIssue({ code: "custom", path: ["nodes"], message: `Missing group parent ${node.parentId}.` });
    if (node.type === "image") points += node.masks.reduce((total, mask) => total + mask.points.length, 0);
    if (node.type === "shape" || node.type === "path") points += node.points.length;
    if (node.type === "group") {
      if (node.childIds.some((id) => !ids.has(id))) context.addIssue({ code: "custom", path: ["nodes"], message: `Group ${node.id} contains a missing child.` });
      if (node.childIds.some((id) => nodesById.get(id)?.parentId !== node.id)) context.addIssue({ code: "custom", path: ["nodes"], message: `Group ${node.id} has inconsistent child ownership.` });
    }
  }
  if (ids.size !== document.nodes.length) context.addIssue({ code: "custom", path: ["nodes"], message: "Node IDs must be unique." });
  if (points > MAX_DESIGN_POINTS) context.addIssue({ code: "custom", path: ["nodes"], message: `A Design may contain at most ${MAX_DESIGN_POINTS.toLocaleString()} geometry points.` });
  if (new TextEncoder().encode(JSON.stringify(document)).byteLength > MAX_DESIGN_DOCUMENT_BYTES) context.addIssue({ code: "custom", message: "The Design document is larger than 4 MB." });
});

export function parseDesignDocument(value: unknown): DesignDocumentV1 {
  return designDocumentSchema.parse(value) as DesignDocumentV1;
}

export function migrateDesignDocument(value: unknown): DesignDocumentV1 {
  return parseDesignDocument(value);
}
