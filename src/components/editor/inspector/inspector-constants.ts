import type { GraphCellLineSide, GraphSettings, GraphShapeKind, MeasurementUnit } from "@/lib/types";

export type ShapeFillMode = "outline" | "filled";
export type GeneratedShapeKind = Extract<GraphShapeKind, "square" | "rectangle" | "circle" | "oval" | "half-circle">;

export { MAX_CANVAS_DIMENSION } from "@/lib/canvas/performance-limits";
export const CLIPART_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,.svg";

export const CELL_LINE_SIDE_KEYS: GraphCellLineSide[] = ["top", "right", "bottom", "left"];

export const CELL_LINE_SIDE_LABELS: Record<GraphCellLineSide, string> = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
};

export const GENERATED_SHAPE_KIND_KEYS: GeneratedShapeKind[] = ["square", "rectangle", "circle", "oval", "half-circle"];

export const GRAPH_SHAPE_KIND_KEYS: GraphShapeKind[] = ["square", "rectangle", "circle", "oval", "half-circle", "line", "arrow"];

export const GENERATED_SHAPE_FILL_MODE_LABELS: Record<ShapeFillMode, string> = {
  outline: "Outline",
  filled: "Filled",
};

export const GRAPH_SHAPE_KIND_LABELS: Record<GraphShapeKind, string> = {
  square: "Square",
  rectangle: "Rectangle",
  circle: "Circle",
  oval: "Oval",
  "half-circle": "Half circle",
  line: "Line",
  arrow: "Arrow",
};

export const PRINT_ORIENTATION_LABELS: Record<GraphSettings["printOrientation"], string> = {
  auto: "Auto",
  portrait: "Portrait",
  landscape: "Landscape",
};

export const PRINT_HORIZONTAL_ALIGNMENT_LABELS: Record<GraphSettings["printHorizontalAlignment"], string> = {
  left: "Left",
  center: "Center",
  right: "Right",
};

export const PRINT_VERTICAL_ALIGNMENT_LABELS: Record<GraphSettings["printVerticalAlignment"], string> = {
  top: "Top",
  center: "Center",
  bottom: "Bottom",
};

export const GRAPH_LINE_LAYER_LABELS: Record<GraphSettings["gridLineLayer"], string> = {
  front: "Front",
  back: "Back",
};

export const GRID_NUMBER_PLACEMENT_LABELS: Record<GraphSettings["gridNumberPlacement"], string> = {
  inside: "Inside",
  outside: "Outside",
};

export const MEASUREMENT_UNIT_LABELS: Record<MeasurementUnit, string> = {
  cm: "CM",
  in: "IN",
};
