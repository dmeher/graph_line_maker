export const GRAPH_SUBDIVISIONS = 10;
export const GRAPH_MINOR_PIXEL_SIZE = 16;
export const GRAPH_MAJOR_CELL_PIXELS = GRAPH_SUBDIVISIONS * GRAPH_MINOR_PIXEL_SIZE;
export const MAX_IMAGE_PADDING_PIXELS = 1200;
export const DEFAULT_IMAGE_PADDING_CELLS = 2;
export const DEFAULT_IMAGE_PADDING_PIXELS = DEFAULT_IMAGE_PADDING_CELLS * GRAPH_MINOR_PIXEL_SIZE;
export const DEFAULT_CELL_SIZE_CM = 1;
export const DEFAULT_IMAGE_LINE_THICKNESS = 1;
export const MIN_IMAGE_LINE_THICKNESS = 0.01;
export const MAX_IMAGE_LINE_THICKNESS = 8;
export const DEFAULT_OUTLINE_COLOR = "#111827";
export const DEFAULT_GRID_LINE_COLOR = "#dc2626";
export const TRANSPARENT_FILL_COLOR = "transparent";
export const GRAPH_LINE_LAYER_KEYS = ["front", "back"] as const;
export type GraphLineLayer = (typeof GRAPH_LINE_LAYER_KEYS)[number];
export const DEFAULT_GRAPH_LINE_LAYER: GraphLineLayer = "front";
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
  hex: string;
};

export const PRESET_GRAPH_COLORS: PresetColor[] = [
  { name: "White", hex: "#ffffff" },
  { name: "Black", hex: "#111827" },
  { name: "Slate", hex: "#334155" },
  { name: "Gray", hex: "#6b7280" },
  { name: "Zinc", hex: "#71717a" },
  { name: "Red", hex: "#dc2626" },
  { name: "Crimson", hex: "#be123c" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Pink", hex: "#db2777" },
  { name: "Fuchsia", hex: "#c026d3" },
  { name: "Purple", hex: "#9333ea" },
  { name: "Violet", hex: "#7c3aed" },
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Navy", hex: "#1e3a8a" },
  { name: "Sky", hex: "#0284c7" },
  { name: "Cyan", hex: "#0891b2" },
  { name: "Teal", hex: "#0f766e" },
  { name: "Emerald", hex: "#059669" },
  { name: "Green", hex: "#16a34a" },
  { name: "Lime", hex: "#65a30d" },
  { name: "Olive", hex: "#4d7c0f" },
  { name: "Yellow", hex: "#ca8a04" },
  { name: "Gold", hex: "#d97706" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Coral", hex: "#f97316" },
  { name: "Brown", hex: "#92400e" },
  { name: "Maroon", hex: "#7f1d1d" },
  { name: "Mint", hex: "#2dd4bf" },
  { name: "Lavender", hex: "#a78bfa" },
];

export const PRESET_GRAPH_LINE_COLORS: PresetColor[] = [
  { name: "Red", hex: DEFAULT_GRID_LINE_COLOR },
  { name: "Green", hex: "#16a34a" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Purple", hex: "#9333ea" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Black", hex: "#111827" },
  { name: "Gray", hex: "#64748b" },
];

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function isTransparentFillColor(value: unknown): value is typeof TRANSPARENT_FILL_COLOR {
  return value === TRANSPARENT_FILL_COLOR;
}

export function isFillColor(value: unknown): value is string {
  return isHexColor(value) || isTransparentFillColor(value);
}

export function clampImageLineThickness(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_IMAGE_LINE_THICKNESS;
  return Math.round(Math.max(MIN_IMAGE_LINE_THICKNESS, Math.min(MAX_IMAGE_LINE_THICKNESS, numeric)) * 1000) / 1000;
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
