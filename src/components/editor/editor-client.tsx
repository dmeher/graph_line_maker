"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Crop,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FileText,
  ImageDown,
  ImageIcon,
  FlipHorizontal,
  FlipVertical,
  Grid3X3,
  Hand,
  Lock,
  Loader2,
  Maximize2,
  Menu,
  MoreVertical,
  MousePointer2,
  Pipette,
  Printer,
  RefreshCw,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Settings2,
  Trash2,
  Unlock,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { saveProjectState } from "@/app/(app)/projects/actions";
import { LogoMark } from "@/components/layout/brand-mark";
import { cropCanvasToFile, fullCrop, type CropPixels } from "@/lib/canvas/crop";
import { createPdfExportPlan } from "@/lib/canvas/pdf-layout";
import { findContentBounds, loadImageToCanvas, pixelateLayeredImagesWithWorker, resizeImage, type FillRegion } from "@/lib/canvas/processor";
import { ALLOWED_IMAGE_LABEL, IMAGE_ACCEPT, MAX_UPLOAD_BYTES, isAllowedImageFile, isPdfFile } from "@/lib/constants";
import {
  createEditorSessionDraft,
  hasEditorSessionDraft,
  readEditorSessionDraft,
  removeEditorSessionDraft,
  writeEditorSessionDraft,
} from "@/lib/editor/session-draft";
import { ROTATION_STEP_DEGREES, sourceLayouts, snapCellToGrid, sourceProcessingCacheKey, stackEndCell, normalizeRotationDegrees, type SourceLayout } from "@/lib/editor/source-layout";
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
  GRAPH_LINE_LAYER_KEYS,
  GRAPH_MAJOR_CELL_PIXELS,
  MAX_IMAGE_LINE_THICKNESS,
  MAX_SOURCE_FILL_MIN_STROKE_PIXELS,
  MAX_SOURCE_FILL_THRESHOLD,
  MAX_STROKE_GAP_CLOSE_PIXELS,
  MIN_IMAGE_LINE_THICKNESS,
  MIN_SOURCE_FILL_MIN_STROKE_PIXELS,
  MIN_SOURCE_FILL_THRESHOLD,
  MIN_STROKE_GAP_CLOSE_PIXELS,
  PRESET_GRAPH_COLORS,
  PRESET_GRAPH_LINE_COLORS,
  PRINT_HORIZONTAL_ALIGNMENT_KEYS,
  PRINT_ORIENTATION_KEYS,
  PRINT_PAPER_SIZES,
  PRINT_PAPER_SIZE_KEYS,
  PRINT_VERTICAL_ALIGNMENT_KEYS,
  TRANSPARENT_FILL_COLOR,
  clampImageLineThickness,
  clampSourceFillMinStrokePixels,
  clampSourceFillThreshold,
  clampStrokeGapClosePixels,
  isGraphLineLayer,
  isFillColor,
  isHexColor,
  isPrintHorizontalAlignment,
  isPrintOrientation,
  isPrintPaperSize,
  isPrintVerticalAlignment,
  isTransparentFillColor,
} from "@/lib/graph-paper";
import type { GraphCellLineSide, GraphCellPaint, GraphSettings, GraphShapeDrawing, GraphShapeKind, GraphSourceImage, PaletteColor, Project } from "@/lib/types";
import { bytesToSize } from "@/lib/utils/format";

type MobileTab = "source" | "canvas" | "controls";
type InspectorTab = "graph" | "source" | "draw" | "palette" | "print";
type Notice = { tone: "ok" | "error" | "info"; text: string };
type CollapsibleKey = "parameters" | "drawing" | "outline" | "fill" | "selectedFill" | "graphLines";
type FloatingPalette = { regionId: string; x: number; y: number } | null;
type DrawingTool = "image" | "cell" | "shape";
type DrawingLayerKey = `cell:${string}` | `shape:${string}`;
type SourceStatus = {
  ready: boolean;
  previewUrl: string | null;
  error: string | null;
};
type SettingsHistory = {
  undo: GraphSettings[];
  redo: GraphSettings[];
};
type PanelResizeState = {
  side: "left" | "right";
  pointerId: number;
  startClientX: number;
  startWidth: number;
};
const SOURCE_RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type SourceResizeHandle = (typeof SOURCE_RESIZE_HANDLES)[number];
type DragState = {
  kind: "viewport" | "source" | "resize-source" | "cell-paint" | "shape-draw";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  sourceId?: string;
  startSourceX?: number;
  startSourceY?: number;
  startSourceBaseY?: number;
  startSourceTopPadding?: number;
  startSourceWidth?: number;
  startSourceHeight?: number;
  resizeCorner?: SourceResizeHandle;
  startScrollLeft?: number;
  startScrollTop?: number;
  canvasWidth: number;
  canvasHeight: number;
  rectWidth: number;
  rectHeight: number;
  moved: boolean;
  historyRecorded: boolean;
  startGraphX?: number;
  startGraphY?: number;
  shapeId?: string;
};
type UploadedSourceImage = {
  id: string;
  name: string;
  path: string;
};
type SourceImagesUploadResponse = {
  images?: unknown;
  message?: unknown;
};

const ManualCropper = dynamic(() => import("@/components/projects/manual-cropper").then((module) => module.ManualCropper), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-64 place-items-center text-sm font-semibold text-slate-500">
      Preparing crop
    </div>
  ),
});

const MAX_CANVAS_DIMENSION = 24000;
const MAX_SETTINGS_HISTORY = 80;
const MIN_SIDE_PANEL_WIDTH = 280;
const MAX_SIDE_PANEL_WIDTH = 560;
const CELL_LINE_SIDE_KEYS: GraphCellLineSide[] = ["top", "right", "bottom", "left"];
const GRAPH_SHAPE_KIND_KEYS: GraphShapeKind[] = ["square", "rectangle", "circle", "oval", "line", "arrow"];
const CELL_LINE_SIDE_LABELS: Record<GraphCellLineSide, string> = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
};
const GRAPH_SHAPE_KIND_LABELS: Record<GraphShapeKind, string> = {
  square: "Square",
  rectangle: "Rectangle",
  circle: "Circle",
  oval: "Oval",
  line: "Line",
  arrow: "Arrow",
};
const PRINT_ORIENTATION_LABELS: Record<GraphSettings["printOrientation"], string> = {
  auto: "Auto",
  portrait: "Portrait",
  landscape: "Landscape",
};
const PRINT_HORIZONTAL_ALIGNMENT_LABELS: Record<GraphSettings["printHorizontalAlignment"], string> = {
  left: "Left",
  center: "Center",
  right: "Right",
};
const PRINT_VERTICAL_ALIGNMENT_LABELS: Record<GraphSettings["printVerticalAlignment"], string> = {
  top: "Top",
  center: "Center",
  bottom: "Bottom",
};
const GRAPH_LINE_LAYER_LABELS: Record<GraphSettings["gridLineLayer"], string> = {
  front: "Front",
  back: "Back",
};
const GRID_NUMBER_PLACEMENT_LABELS: Record<GraphSettings["gridNumberPlacement"], string> = {
  inside: "Inside",
  outside: "Outside",
};
const MEASUREMENT_UNIT_LABELS: Record<GraphSettings["measurementUnit"], string> = {
  cm: "CM",
  in: "IN",
};
const CM_PER_INCH = 2.54;

function slug(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "graph-pixel-chart"
  );
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to export canvas."));
    }, "image/png");
  });
}

function isUploadedSourceImage(value: unknown): value is UploadedSourceImage {
  if (!value || typeof value !== "object") return false;
  const image = value as Record<string, unknown>;
  return typeof image.id === "string" && typeof image.name === "string" && typeof image.path === "string";
}

async function canvasToObjectUrl(canvas: HTMLCanvasElement) {
  return URL.createObjectURL(await canvasToBlob(canvas));
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  async function runNext() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runNext));
  return results;
}

function clampImageOffset(value: number) {
  return Math.max(-MAX_CANVAS_DIMENSION, Math.min(MAX_CANVAS_DIMENSION, Math.round(value)));
}

function clampSidePanelWidth(value: number) {
  const viewportLimit = typeof window === "undefined" ? MAX_SIDE_PANEL_WIDTH : Math.max(MIN_SIDE_PANEL_WIDTH, Math.min(MAX_SIDE_PANEL_WIDTH, window.innerWidth * 0.36));
  return Math.round(Math.max(MIN_SIDE_PANEL_WIDTH, Math.min(viewportLimit, value)));
}

function roundCm(value: number) {
  return Math.round(value * 1000) / 1000;
}

function roundMeasure(value: number) {
  return Math.round(value * 100) / 100;
}

function roundCells(value: number) {
  return Math.round(value * 100) / 100;
}

function isMeasurementUnit(value: unknown): value is GraphSettings["measurementUnit"] {
  return value === "cm" || value === "in";
}

function unitToCm(value: number, unit: GraphSettings["measurementUnit"]) {
  return unit === "in" ? value * CM_PER_INCH : value;
}

function cmToUnit(value: number, unit: GraphSettings["measurementUnit"]) {
  return unit === "in" ? value / CM_PER_INCH : value;
}

function defaultSourceX(graphWidth: number, width: number) {
  return roundCells((graphWidth - width) / 2);
}

function clampFreeCellCoordinate(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return roundCells(fallback);
  return roundCells(Math.max(-1000, Math.min(1000, numeric)));
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

function normalizeSourceImagesForEditor(
  sourceImages: GraphSettings["sourceImages"] | undefined,
  graphWidth: number,
  graphHeight: number,
  fallbackWidth: number,
  fallbackHeight: number,
  defaults: Pick<
    GraphSettings,
    "measurementUnit" | "imageLineThickness" | "sourceFillThreshold" | "sourceFillMinStrokePixels" | "strokeGapClosePixels"
  >,
) {
  if (!Array.isArray(sourceImages)) return [];
  let legacyY = 0;
  return sourceImages
    .flatMap((source, index) => {
      if (!source || typeof source !== "object") return [];
      const id = typeof source.id === "string" && source.id.trim() ? source.id.trim() : `source-${index + 1}`;
      const name = typeof source.name === "string" && source.name.trim() ? source.name.trim() : `Source ${index + 1}`;
      const path = typeof source.path === "string" && source.path.trim() ? source.path : null;
      const url = typeof source.url === "string" && source.url.trim() ? source.url : null;
      const width = clampSourceSizeCells(source.width, fallbackWidth);
      const height = clampSourceSizeCells(source.height, fallbackHeight);
      const measurementUnit = isMeasurementUnit(source.measurementUnit) ? source.measurementUnit : defaults.measurementUnit;
      const imageLineThickness = clampImageLineThickness(source.imageLineThickness ?? defaults.imageLineThickness);
      const sourceFillThreshold = clampSourceFillThreshold(source.sourceFillThreshold ?? defaults.sourceFillThreshold);
      const sourceFillMinStrokePixels = clampSourceFillMinStrokePixels(source.sourceFillMinStrokePixels ?? defaults.sourceFillMinStrokePixels);
      const strokeGapClosePixels = clampStrokeGapClosePixels(source.strokeGapClosePixels ?? defaults.strokeGapClosePixels);
      const x = clampSourceX(source.x, graphWidth, width);
      const topPadding = clampPaddingCells(source.topPadding, graphHeight, 0);
      const bottomPadding = clampPaddingCells(source.bottomPadding, graphHeight, 0);
      const y = clampFreeCellCoordinate(source.y, legacyY + topPadding);
      legacyY = y + height + bottomPadding;
      const locked = Boolean(source.locked);
      const rotationDegrees = normalizeRotationDegrees(source.rotationDegrees);
      const flipX = Boolean(source.flipX);
      const flipY = Boolean(source.flipY);
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
    .slice(0, 12);
}

function normalizeFillRegions(value: GraphSettings["fillRegions"] | undefined) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([regionId, color]) => /^\d+$/.test(regionId) && isFillColor(color)));
}

function normalizeCellPaints(value: GraphSettings["cellPaints"] | undefined): GraphSettings["cellPaints"] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((paint, index) => {
      if (!paint || typeof paint !== "object") return [];
      const x = roundCells(Math.max(0, Number(paint.x) || 0));
      const y = roundCells(Math.max(0, Number(paint.y) || 0));
      const width = Math.max(0.01, Math.min(1000, Number(paint.width) || 1));
      const height = Math.max(0.01, Math.min(1000, Number(paint.height) || 1));
      const sides = Array.from(new Set((Array.isArray(paint.sides) ? paint.sides : []).filter((side): side is GraphCellLineSide => CELL_LINE_SIDE_KEYS.includes(side as GraphCellLineSide))));
      const lineColor = isHexColor(paint.lineColor) ? paint.lineColor : DEFAULT_OUTLINE_COLOR;
      const fillColor = isFillColor(paint.fillColor) ? paint.fillColor : TRANSPARENT_FILL_COLOR;
      const lineWidth = Math.max(1, Math.min(24, Math.round(Number(paint.lineWidth) || 3)));
      if (!sides.length && fillColor === TRANSPARENT_FILL_COLOR) return [];
      return [{
        id: paint.id || `cell-paint-${index + 1}`,
        name: paint.name || `Cell paint ${index + 1}`,
        x,
        y,
        width,
        height,
        sides,
        lineColor,
        fillColor,
        lineWidth,
        locked: Boolean(paint.locked),
        rotationDegrees: normalizeRotationDegrees(paint.rotationDegrees),
        flipX: Boolean(paint.flipX),
        flipY: Boolean(paint.flipY),
      }];
    })
    .slice(0, 2000);
}

function normalizeGraphShapes(value: GraphSettings["graphShapes"] | undefined): GraphSettings["graphShapes"] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((shape, index) => {
      if (!shape || typeof shape !== "object") return [];
      const kind = GRAPH_SHAPE_KIND_KEYS.includes(shape.kind as GraphShapeKind) ? shape.kind : "rectangle";
      return [
        {
          id: shape.id || `shape-${index + 1}`,
          name: shape.name || `${kind[0].toUpperCase()}${kind.slice(1)} ${index + 1}`,
          kind,
          x: clampFreeCellCoordinate(shape.x, 0),
          y: clampFreeCellCoordinate(shape.y, 0),
          width: clampFreeCellCoordinate(shape.width, kind === "line" || kind === "arrow" ? 2 : 1),
          height: clampFreeCellCoordinate(shape.height, kind === "line" || kind === "arrow" ? 0 : 1),
          strokeColor: isHexColor(shape.strokeColor) ? shape.strokeColor : DEFAULT_OUTLINE_COLOR,
          fillColor: isFillColor(shape.fillColor) ? shape.fillColor : TRANSPARENT_FILL_COLOR,
          strokeWidth: Math.max(1, Math.min(24, Math.round(Number(shape.strokeWidth) || 3))),
          locked: Boolean(shape.locked),
          rotationDegrees: normalizeRotationDegrees(shape.rotationDegrees),
          flipX: Boolean(shape.flipX),
          flipY: Boolean(shape.flipY),
        },
      ];
    })
    .slice(0, 500);
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  allowDecimalInput = false,
  wholeStep = false,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  allowDecimalInput?: boolean;
  wholeStep?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(() => String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setDraftValue(String(value));
  }, [isFocused, value]);

  function parseDraft(nextValue: string) {
    const trimmed = nextValue.trim();
    if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-.") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function commitDraft(nextValue = draftValue) {
    const parsed = parseDraft(nextValue);
    if (parsed === null) {
      setDraftValue(String(value));
      return;
    }

    const clamped = Math.max(min, Math.min(max, parsed));
    onChange(clamped);
    setDraftValue(String(clamped));
  }

  function normalizeSteppedValue(parsed: number) {
    if (!wholeStep || step < 1) return parsed;
    const delta = parsed - value;
    if (Math.abs(Math.abs(delta) - step) > 0.000001) return parsed;
    const stepped =
      delta > 0
        ? Number.isInteger(value)
          ? value + step
          : Math.ceil(value)
        : Number.isInteger(value)
          ? value - step
          : Math.floor(value);
    return Math.max(min, Math.min(max, stepped));
  }

  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        type="number"
        inputMode={allowDecimalInput || step < 1 ? "decimal" : "numeric"}
        step={step}
        value={draftValue}
        disabled={disabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          commitDraft();
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          const parsed = parseDraft(nextValue);
          setDraftValue(nextValue);
          if (parsed === null) return;
          const clamped = Math.max(min, Math.min(max, parsed));
          const normalized = normalizeSteppedValue(clamped);
          if (normalized !== parsed) setDraftValue(String(normalized));
          onChange(normalized);
        }}
        className="h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-400"
      />
    </label>
  );
}

function ColorPresetField({
  label,
  value,
  onChange,
  colors = PRESET_GRAPH_COLORS,
  allowTransparent = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colors?: typeof PRESET_GRAPH_COLORS;
  allowTransparent?: boolean;
}) {
  const colorPickerValue = isHexColor(value) ? value : "#ffffff";
  const transparentSelected = isTransparentFillColor(value);

  return (
    <div className="grid min-w-0 gap-2">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(1.75rem,1fr))] gap-1.5">
        {colors.map((color) => {
          const selected = color.hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={`${label}-${color.hex}`}
              type="button"
              onClick={() => onChange(color.hex)}
              className={`h-7 rounded-sm border ${selected ? "border-slate-950 ring-2 ring-slate-300" : "border-slate-200"}`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
              aria-label={`${label}: ${color.name}`}
            />
          );
        })}
        {allowTransparent ? (
          <button
            type="button"
            onClick={() => onChange(TRANSPARENT_FILL_COLOR)}
            className={`h-7 rounded-sm border bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%),linear-gradient(-45deg,#cbd5e1_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#cbd5e1_75%),linear-gradient(-45deg,transparent_75%,#cbd5e1_75%)] bg-[length:10px_10px] bg-[position:0_0,0_5px,5px_-5px,-5px_0] ${transparentSelected ? "border-slate-950 ring-2 ring-slate-300" : "border-slate-200"}`}
            title="Transparent"
            aria-label={`${label}: Transparent`}
          />
        ) : null}
      </div>
      <label className="flex h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-white px-2 text-sm font-semibold text-slate-600">
        <input
          type="color"
          value={colorPickerValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-white p-0"
          aria-label={`${label}: custom color`}
        />
        <span>Custom</span>
      </label>
    </div>
  );
}

function CollapsibleSection({
  title,
  summary,
  open,
  onToggle,
  children,
  className = "",
}: {
  title: string;
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-t border-[var(--line)] pt-3 first:border-t-0 first:pt-0 ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-slate-950"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">{title}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {!open ? summary : null}
          {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </span>
      </button>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </section>
  );
}

function ColorSummary({ value }: { value: string }) {
  const transparent = isTransparentFillColor(value);
  return (
    <span
      className={`h-5 w-5 rounded-sm border border-slate-200 ${
        transparent
          ? "bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%),linear-gradient(-45deg,#cbd5e1_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#cbd5e1_75%),linear-gradient(-45deg,transparent_75%,#cbd5e1_75%)] bg-[length:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0]"
          : ""
      }`}
      style={transparent ? undefined : { backgroundColor: value }}
      aria-hidden="true"
    />
  );
}

function sourceResizeHandleClass(handle: SourceResizeHandle, locked: boolean | undefined) {
  const base = `pointer-events-auto absolute grid place-items-center text-slate-700 transition-colors ${
    locked ? "opacity-40" : "hover:text-slate-950"
  }`;
  switch (handle) {
    case "n":
      return `${base} -top-3 left-8 right-8 h-6 cursor-ns-resize`;
    case "s":
      return `${base} -bottom-3 left-8 right-8 h-6 cursor-ns-resize`;
    case "w":
      return `${base} -left-3 bottom-8 top-8 w-6 cursor-ew-resize`;
    case "e":
      return `${base} -right-3 bottom-8 top-8 w-6 cursor-ew-resize`;
    case "nw":
      return `${base} -left-3 -top-3 h-6 w-6 cursor-nwse-resize`;
    case "ne":
      return `${base} -right-3 -top-3 h-6 w-6 cursor-nesw-resize`;
    case "sw":
      return `${base} -bottom-3 -left-3 h-6 w-6 cursor-nesw-resize`;
    case "se":
      return `${base} -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize`;
  }
  return base;
}

function sourceResizeHandleIconClass(handle: SourceResizeHandle) {
  const base = "grid h-5 w-5 place-items-center rounded border border-slate-400 bg-white/95 shadow-sm";
  if (handle === "n" || handle === "s") return `${base} h-5 w-7`;
  if (handle === "e" || handle === "w") return `${base} h-7 w-5`;
  return base;
}

function sourceResizeHandleIcon(handle: SourceResizeHandle) {
  if (handle === "n" || handle === "s") return <ArrowUpDown size={13} aria-hidden="true" />;
  if (handle === "e" || handle === "w") return <ArrowLeftRight size={13} aria-hidden="true" />;
  return <Maximize2 size={12} aria-hidden="true" />;
}

function cellNumberLabels(cellCount: number) {
  const count = Math.max(1, Math.round(cellCount || 1));
  return Array.from({ length: count }, (_, index) => index + 1);
}

function deriveGraphSettings(settings: GraphSettings): GraphSettings {
  const graphWidthLimit = Math.max(1, Math.floor(MAX_CANVAS_DIMENSION / GRAPH_MAJOR_CELL_PIXELS));
  const graphHeightLimit = Math.max(1, Math.floor(MAX_CANVAS_DIMENSION / GRAPH_MAJOR_CELL_PIXELS));
  const graphWidth = Math.max(1, Math.min(graphWidthLimit, Math.round(settings.graphWidth || 1)));
  const graphHeight = Math.max(1, Math.min(graphHeightLimit, Math.round(settings.graphHeight || 1)));
  const outlineColor = isHexColor(settings.outlineColor) ? settings.outlineColor : isHexColor(settings.lineColor) ? settings.lineColor : DEFAULT_OUTLINE_COLOR;
  const fillColor = isFillColor(settings.fillColor) ? settings.fillColor : TRANSPARENT_FILL_COLOR;
  const imageLineThickness = clampImageLineThickness(settings.imageLineThickness ?? DEFAULT_IMAGE_LINE_THICKNESS);
  const sourceFillThreshold = clampSourceFillThreshold(settings.sourceFillThreshold ?? DEFAULT_SOURCE_FILL_THRESHOLD);
  const sourceFillMinStrokePixels = clampSourceFillMinStrokePixels(settings.sourceFillMinStrokePixels ?? DEFAULT_SOURCE_FILL_MIN_STROKE_PIXELS);
  const strokeGapClosePixels = clampStrokeGapClosePixels(settings.strokeGapClosePixels ?? DEFAULT_STROKE_GAP_CLOSE_PIXELS);
  const gridLineColor = isHexColor(settings.gridLineColor) && settings.gridLineColor.toLowerCase() !== "#cbd5e1" ? settings.gridLineColor : DEFAULT_GRID_LINE_COLOR;
  const gridLineLayer = isGraphLineLayer(settings.gridLineLayer) ? settings.gridLineLayer : DEFAULT_GRAPH_LINE_LAYER;
  const showNumbers = typeof settings.showNumbers === "boolean" ? settings.showNumbers : true;
  const gridNumberPlacement = settings.gridNumberPlacement === "outside" ? "outside" : "inside";
  const showPageBreaks = typeof settings.showPageBreaks === "boolean" ? settings.showPageBreaks : true;
  const cellSizeCm = DEFAULT_CELL_SIZE_CM;
  const measurementUnit = isMeasurementUnit(settings.measurementUnit) ? settings.measurementUnit : "in";
  const printPaperSize = isPrintPaperSize(settings.printPaperSize) ? settings.printPaperSize : DEFAULT_PRINT_PAPER_SIZE;
  const printOrientation = isPrintOrientation(settings.printOrientation) ? settings.printOrientation : DEFAULT_PRINT_ORIENTATION;
  const printHorizontalAlignment = isPrintHorizontalAlignment(settings.printHorizontalAlignment)
    ? settings.printHorizontalAlignment
    : DEFAULT_PRINT_HORIZONTAL_ALIGNMENT;
  const printVerticalAlignment = isPrintVerticalAlignment(settings.printVerticalAlignment)
    ? settings.printVerticalAlignment
    : DEFAULT_PRINT_VERTICAL_ALIGNMENT;
  const imageWidth = clampImageCells(settings.imageWidth, graphWidth, Math.min(DEFAULT_IMAGE_WIDTH_CELLS, graphWidth));
  const imageHeight = clampImageCells(settings.imageHeight, graphHeight, Math.min(DEFAULT_IMAGE_HEIGHT_CELLS, graphHeight));
  const sourceImages = normalizeSourceImagesForEditor(settings.sourceImages, graphWidth, graphHeight, imageWidth, imageHeight, {
    measurementUnit,
    imageLineThickness,
    sourceFillThreshold,
    sourceFillMinStrokePixels,
    strokeGapClosePixels,
  });
  const imagePadding = 0;
  const outputWidth = graphWidth * GRAPH_MAJOR_CELL_PIXELS;
  const outputHeight = graphHeight * GRAPH_MAJOR_CELL_PIXELS;
  const fillRegions = normalizeFillRegions(settings.fillRegions);
  const cellPaints = normalizeCellPaints(settings.cellPaints);
  const graphShapes = normalizeGraphShapes(settings.graphShapes);

  return {
    ...settings,
    graphWidth,
    graphHeight,
    cellWidth: GRAPH_MAJOR_CELL_PIXELS,
    cellHeight: GRAPH_MAJOR_CELL_PIXELS,
    cellSizeCm,
    measurementUnit,
    printPaperSize,
    printOrientation,
    printHorizontalAlignment,
    printVerticalAlignment,
    pixelSize: GRAPH_MAJOR_CELL_PIXELS,
    gridCellSize: GRAPH_MAJOR_CELL_PIXELS,
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
    imageOffsetX: clampImageOffset(settings.imageOffsetX ?? 0),
    imageOffsetY: clampImageOffset(settings.imageOffsetY ?? 0),
    spotPadding: 0,
    spotShape: "round",
    blackAndWhite: false,
    limitedColorMode: false,
  };
}

function editorDefaultGraphSettings(current: GraphSettings): GraphSettings {
  return deriveGraphSettings({
    ...current,
    graphWidth: DEFAULT_GRAPH_WIDTH_CELLS,
    graphHeight: DEFAULT_GRAPH_HEIGHT_CELLS,
    cellSizeCm: DEFAULT_CELL_SIZE_CM,
    measurementUnit: "in",
    printPaperSize: DEFAULT_PRINT_PAPER_SIZE,
    printOrientation: DEFAULT_PRINT_ORIENTATION,
    printHorizontalAlignment: DEFAULT_PRINT_HORIZONTAL_ALIGNMENT,
    printVerticalAlignment: DEFAULT_PRINT_VERTICAL_ALIGNMENT,
    lineColor: DEFAULT_OUTLINE_COLOR,
    outlineColor: DEFAULT_OUTLINE_COLOR,
    fillColor: TRANSPARENT_FILL_COLOR,
    fillRegions: {},
    cellPaints: [],
    graphShapes: [],
    imageLineThickness: DEFAULT_IMAGE_LINE_THICKNESS,
    sourceFillThreshold: DEFAULT_SOURCE_FILL_THRESHOLD,
    sourceFillMinStrokePixels: DEFAULT_SOURCE_FILL_MIN_STROKE_PIXELS,
    strokeGapClosePixels: DEFAULT_STROKE_GAP_CLOSE_PIXELS,
    gridLineColor: DEFAULT_GRID_LINE_COLOR,
    gridLineLayer: DEFAULT_GRAPH_LINE_LAYER,
    showNumbers: true,
    gridNumberPlacement: "inside",
    showPageBreaks: true,
    imageWidth: DEFAULT_IMAGE_WIDTH_CELLS,
    imageHeight: DEFAULT_IMAGE_HEIGHT_CELLS,
    imagePadding: 0,
    imageOffsetX: 0,
    imageOffsetY: 0,
  });
}

function areSettingsEqual(a: GraphSettings, b: GraphSettings) {
  return a === b;
}

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return ["", "email", "password", "search", "tel", "text", "url"].includes(target.type);
}

function isFormControlTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function sourceNameFromPath(path: string | null) {
  return path?.split("/").pop() || "Original image";
}

function isPersistableProjectId(projectId: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);
}

function initialEditorSettings(project: Project) {
  const settings = deriveGraphSettings(project.settings);
  if (settings.sourceImages.length || !project.originalImageUrl) return settings;
  return deriveGraphSettings({
    ...settings,
    sourceImages: [
      {
        id: "original",
        name: sourceNameFromPath(project.originalImagePath),
        path: project.originalImagePath,
        url: project.originalImageUrl,
        width: settings.imageWidth,
        height: settings.imageHeight,
        measurementUnit: settings.measurementUnit,
        imageLineThickness: settings.imageLineThickness,
        sourceFillThreshold: settings.sourceFillThreshold,
        sourceFillMinStrokePixels: settings.sourceFillMinStrokePixels,
        strokeGapClosePixels: settings.strokeGapClosePixels,
        x: defaultSourceX(settings.graphWidth, settings.imageWidth),
        y: 0,
        topPadding: 0,
        bottomPadding: 0,
        locked: false,
        rotationDegrees: 0 as const,
        flipX: false,
        flipY: false,
      },
    ],
  });
}

function sourceSettings(settings: GraphSettings, source: GraphSourceImage) {
  return deriveGraphSettings({
    ...settings,
    imageLineThickness: source.imageLineThickness,
    sourceFillThreshold: source.sourceFillThreshold,
    sourceFillMinStrokePixels: source.sourceFillMinStrokePixels,
    strokeGapClosePixels: source.strokeGapClosePixels,
    imageWidth: settings.graphWidth,
    imageHeight: settings.graphHeight,
  });
}

function composeSourceLayerCanvas(
  layout: SourceLayout,
  sourceCanvases: Map<string, HTMLCanvasElement>,
  settings: GraphSettings,
) {
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(settings.graphWidth * GRAPH_MAJOR_CELL_PIXELS));
  output.height = Math.max(1, Math.round(settings.graphHeight * GRAPH_MAJOR_CELL_PIXELS));
  const context = output.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is not available.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, output.width, output.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const sourceCanvas = sourceCanvases.get(layout.source.id);
  if (!sourceCanvas) return output;

  const bounds = findContentBounds(sourceCanvas);
  const drawX = Math.round(layout.x * GRAPH_MAJOR_CELL_PIXELS + settings.imageOffsetX);
  const drawY = Math.round(layout.y * GRAPH_MAJOR_CELL_PIXELS + settings.imageOffsetY);
  const drawWidth = Math.round(layout.width * GRAPH_MAJOR_CELL_PIXELS);
  const drawHeight = Math.round(layout.height * GRAPH_MAJOR_CELL_PIXELS);
  const rotation = normalizeRotationDegrees(layout.source.rotationDegrees);
  const rotatedSideways = rotation === 90 || rotation === 270;
  const fittedWidth = rotatedSideways ? drawHeight : drawWidth;
  const fittedHeight = rotatedSideways ? drawWidth : drawHeight;

  context.save();
  context.translate(drawX + drawWidth / 2, drawY + drawHeight / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(layout.source.flipX ? -1 : 1, layout.source.flipY ? -1 : 1);
  context.drawImage(
    sourceCanvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    -fittedWidth / 2,
    -fittedHeight / 2,
    fittedWidth,
    fittedHeight,
  );
  context.restore();

  return output;
}

export function EditorClient({ project }: { project: Project }) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [settings, setSettings] = useState<GraphSettings>(() => initialEditorSettings(project));
  const [palette, setPalette] = useState<PaletteColor[]>(project.palettes);
  const [draftChecked, setDraftChecked] = useState(false);
  const [hasSessionDraft, setHasSessionDraft] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [sourceReady, setSourceReady] = useState(false);
  const [sourceStatus, setSourceStatus] = useState<Record<string, SourceStatus>>({});
  const [sourceCropMode, setSourceCropMode] = useState(false);
  const [sourceCropArea, setSourceCropArea] = useState<CropPixels | null>(null);
  const [sourceCropPending, setSourceCropPending] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [fillRegions, setFillRegions] = useState<FillRegion[]>([]);
  const [selectedFillRegionId, setSelectedFillRegionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isDraggingGraph, setIsDraggingGraph] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedDrawingLayerId, setSelectedDrawingLayerId] = useState<DrawingLayerKey | null>(null);
  const [expandedSourceIds, setExpandedSourceIds] = useState<Record<string, boolean>>({});
  const [expandedDrawingLayerIds, setExpandedDrawingLayerIds] = useState<Record<string, boolean>>({});
  const [previewCanvasSize, setPreviewCanvasSize] = useState({ width: 1, height: 1 });
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("image");
  const [cellPaintSides, setCellPaintSides] = useState<GraphCellLineSide[]>(CELL_LINE_SIDE_KEYS);
  const [cellPaintFillEnabled, setCellPaintFillEnabled] = useState(false);
  const [cellPaintLineEnabled, setCellPaintLineEnabled] = useState(true);
  const [shapeKind, setShapeKind] = useState<GraphShapeKind>("rectangle");
  const [canvasViewportGuide, setCanvasViewportGuide] = useState({ left: 0, top: 0, width: 1, height: 1 });
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(360);
  const [resizingPanelSide, setResizingPanelSide] = useState<"left" | "right" | null>(null);
  const [uploadingSources, setUploadingSources] = useState(false);
  const [replacingSourceId, setReplacingSourceId] = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [sourcePanelCollapsed, setSourcePanelCollapsed] = useState(false);
  const [settingsPanelCollapsed, setSettingsPanelCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<CollapsibleKey, boolean>>({
    parameters: false,
    drawing: false,
    outline: true,
    fill: true,
    selectedFill: true,
    graphLines: true,
  });
  const [floatingPalette, setFloatingPalette] = useState<FloatingPalette>(null);
  const [copiedFillColor, setCopiedFillColor] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("canvas");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("graph");
  const [isPending, startTransition] = useTransition();
  const settingsRef = useRef(settings);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const graphStageRef = useRef<HTMLDivElement | null>(null);
  const uploadedSourceObjectUrlsRef = useRef<string[]>([]);
  const sourcePreviewObjectUrlsRef = useRef<Map<string, string>>(new Map());
  const sourceLayerCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const dragStateRef = useRef<DragState | null>(null);
  const panelResizeStateRef = useRef<PanelResizeState | null>(null);
  const fillRegionMapRef = useRef<Uint16Array | null>(null);
  const settingsHistoryRef = useRef<SettingsHistory>({ undo: [], redo: [] });
  const spacePressedRef = useRef(false);

  useEffect(() => {
    const baseSettings = initialEditorSettings(project);
    const draft = readEditorSessionDraft(project.id, project.updatedAt, baseSettings);
    if (draft) {
      const nextSettings = deriveGraphSettings(draft.settings);
      settingsRef.current = nextSettings;
      setTitle(draft.title);
      setDescription(draft.description);
      setSettings(nextSettings);
      setPalette(draft.palette);
      setHasSessionDraft(true);
      setNotice({ tone: "info", text: "Restored an offline draft from this browser session. Press Save while online to sync it." });
    } else {
      setHasSessionDraft(hasEditorSessionDraft(project.id));
    }
    setDraftChecked(true);
  }, [project]);

  useEffect(() => {
    function syncOnlineState() {
      const nextOnline = typeof navigator === "undefined" ? true : navigator.onLine;
      setIsOnline(nextOnline);
      if (!nextOnline) {
        setNotice({ tone: "info", text: "You are offline. Save will store a draft in this browser session." });
        return;
      }
      if (readEditorSessionDraft(project.id, project.updatedAt, initialEditorSettings(project))) {
        setHasSessionDraft(true);
        setNotice({ tone: "info", text: "Back online. Press Save to sync the session draft to the database." });
      }
    }

    syncOnlineState();
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);
    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, [project]);

  const filename = useMemo(() => slug(title), [title]);
  const primarySource = settings.sourceImages[0] ?? null;
  const sourceName = primarySource?.name ?? "Source image";
  const sourcePreviewUrl = primarySource ? sourceStatus[primarySource.id]?.previewUrl ?? primarySource.url ?? null : null;
  const selectedSource = selectedSourceId ? settings.sourceImages.find((source) => source.id === selectedSourceId) ?? null : null;
  const selectedSourceLayout = selectedSourceId ? sourceLayouts(settings.sourceImages).find((layout) => layout.source.id === selectedSourceId) ?? null : null;
  const sourceLoadKey = useMemo(
    () => settings.sourceImages.map((source) => `${source.id}:${source.name}:${source.url ?? source.path ?? ""}`).join("|"),
    [settings.sourceImages],
  );
  const selectedFillRegion = useMemo(
    () => fillRegions.find((region) => region.id === selectedFillRegionId) ?? null,
    [fillRegions, selectedFillRegionId],
  );
  const fillRegionsById = useMemo(() => new Map(fillRegions.map((region) => [region.id, region] as const)), [fillRegions]);
  const pushUndoSettings = useCallback((snapshot: GraphSettings) => {
    const history = settingsHistoryRef.current;
    const previous = history.undo.at(-1);
    if (previous && areSettingsEqual(previous, snapshot)) return;
    settingsHistoryRef.current = {
      undo: [...history.undo, snapshot].slice(-MAX_SETTINGS_HISTORY),
      redo: [],
    };
  }, []);
  const setSettingsWithHistory = useCallback(
    (updater: GraphSettings | ((current: GraphSettings) => GraphSettings)) => {
      const current = settingsRef.current;
      const next = deriveGraphSettings(typeof updater === "function" ? updater(current) : updater);
      if (areSettingsEqual(current, next)) return;
      pushUndoSettings(current);
      settingsRef.current = next;
      setSettings(next);
    },
    [pushUndoSettings],
  );
  const updateSetting = useCallback(<K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) => {
    setSettingsWithHistory((current) => ({ ...current, [key]: value }));
  }, [setSettingsWithHistory]);
  const restoreSettingsHistory = useCallback((direction: "undo" | "redo") => {
    const current = settingsRef.current;
    const history = settingsHistoryRef.current;
    const source = direction === "undo" ? history.undo : history.redo;
    const restored = source.at(-1);
    if (!restored) return;

    if (direction === "undo") {
      settingsHistoryRef.current = {
        undo: history.undo.slice(0, -1),
        redo: [...history.redo, current].slice(-MAX_SETTINGS_HISTORY),
      };
    } else {
      settingsHistoryRef.current = {
        undo: [...history.undo, current].slice(-MAX_SETTINGS_HISTORY),
        redo: history.redo.slice(0, -1),
      };
    }
    settingsRef.current = restored;
    setSettings(restored);
    setFloatingPalette(null);
    setCopiedFillColor(null);
  }, []);
  const toggleSection = useCallback((section: CollapsibleKey) => {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  }, []);

  function defaultFillRegionColor(region: FillRegion, current: GraphSettings = settings) {
    return region.kind === "source" ? current.outlineColor || current.lineColor : current.fillColor;
  }

  function currentFillRegionColor(region: FillRegion) {
    return settings.fillRegions[region.id] ?? defaultFillRegionColor(region);
  }

  const selectedFillRegionColor = selectedFillRegion ? currentFillRegionColor(selectedFillRegion) : settings.fillColor;

  function updateOutlineColor(color: string) {
    setSettingsWithHistory((current) => ({
      ...current,
      outlineColor: color,
      lineColor: color,
    }));
  }

  function updateImageWidthCells(value: number) {
    setSettingsWithHistory((current) => ({
      ...current,
      imageWidth: value,
      sourceImages:
        current.sourceImages.length === 1
          ? current.sourceImages.map((source) => ({
              ...source,
              width: value,
              x: clampSourceX(source.x, current.graphWidth, value),
            }))
          : current.sourceImages,
    }));
  }

  function updateImageWidthCm(value: number) {
    const widthCells = value / Math.max(0.05, settings.cellSizeCm);
    updateImageWidthCells(widthCells);
  }

  function updateImageHeightCells(value: number) {
    setSettingsWithHistory((current) => ({
      ...current,
      imageHeight: value,
      sourceImages:
        current.sourceImages.length === 1
          ? current.sourceImages.map((source) => ({
              ...source,
              height: value,
            }))
          : current.sourceImages,
    }));
  }

  function updateImageHeightPhysical(value: number) {
    const heightCells = unitToCm(value, settings.measurementUnit) / Math.max(0.05, settings.cellSizeCm);
    updateImageHeightCells(heightCells);
  }

  function updateMeasurementUnit(value: GraphSettings["measurementUnit"]) {
    updateSetting("measurementUnit", value);
  }

  function updateGraphPhysicalHeight(value: number) {
    setSettingsWithHistory((current) => {
      const physicalCm = unitToCm(value, current.measurementUnit);
      const graphHeight = Math.max(1, Math.min(Math.floor(MAX_CANVAS_DIMENSION / GRAPH_MAJOR_CELL_PIXELS), Math.ceil(physicalCm / DEFAULT_CELL_SIZE_CM)));
      return { ...current, graphHeight };
    });
  }

  function sourcePhysicalHeight(source: GraphSourceImage) {
    return roundMeasure(cmToUnit(source.height * settings.cellSizeCm, source.measurementUnit));
  }

  function sourcePhysicalWidthCm(source: GraphSourceImage) {
    return roundMeasure(source.width * settings.cellSizeCm);
  }

  function sourceRightPadding(source: GraphSourceImage) {
    return roundCells(settings.graphWidth - source.width - source.x);
  }

  function sourceBottomPadding(source: GraphSourceImage) {
    return roundCells(settings.graphHeight - source.height - source.y);
  }

  function drawingLayerKey(type: "cell" | "shape", id: string): DrawingLayerKey {
    return `${type}:${id}` as DrawingLayerKey;
  }

  function drawingRightPadding(layer: { x: number; width: number }) {
    return roundCells(settings.graphWidth - layer.width - layer.x);
  }

  function drawingBottomPadding(layer: { y: number; height: number }) {
    return roundCells(settings.graphHeight - layer.height - layer.y);
  }

  function updateCellPaint(cellId: string, patch: Partial<GraphCellPaint>) {
    setSettingsWithHistory((current) => ({
      ...current,
      cellPaints: current.cellPaints.map((cell) => {
        if (cell.id !== cellId || cell.locked) return cell;
        const width = patch.width === undefined ? cell.width : clampSourceSizeCells(patch.width, cell.width);
        const height = patch.height === undefined ? cell.height : clampSourceSizeCells(patch.height, cell.height);
        return {
          ...cell,
          ...patch,
          x: patch.x === undefined ? cell.x : roundCells(Math.max(0, patch.x)),
          y: patch.y === undefined ? cell.y : roundCells(Math.max(0, patch.y)),
          width,
          height,
          sides: patch.sides === undefined ? cell.sides : Array.from(new Set(patch.sides.filter((side) => CELL_LINE_SIDE_KEYS.includes(side)))),
          lineColor: patch.lineColor && isHexColor(patch.lineColor) ? patch.lineColor : cell.lineColor,
          fillColor: patch.fillColor && isFillColor(patch.fillColor) ? patch.fillColor : cell.fillColor,
          lineWidth: patch.lineWidth === undefined ? cell.lineWidth : Math.max(1, Math.min(24, Math.round(patch.lineWidth))),
          rotationDegrees: patch.rotationDegrees === undefined ? cell.rotationDegrees : normalizeRotationDegrees(patch.rotationDegrees),
        };
      }),
    }));
  }

  function updateGraphShape(shapeId: string, patch: Partial<GraphShapeDrawing>) {
    setSettingsWithHistory((current) => ({
      ...current,
      graphShapes: current.graphShapes.map((shape) => {
        if (shape.id !== shapeId || shape.locked) return shape;
        const kind = patch.kind && GRAPH_SHAPE_KIND_KEYS.includes(patch.kind) ? patch.kind : shape.kind;
        return {
          ...shape,
          ...patch,
          kind,
          x: patch.x === undefined ? shape.x : clampFreeCellCoordinate(patch.x, shape.x),
          y: patch.y === undefined ? shape.y : clampFreeCellCoordinate(patch.y, shape.y),
          width: patch.width === undefined ? shape.width : clampSourceSizeCells(patch.width, shape.width),
          height: patch.height === undefined ? shape.height : clampSourceSizeCells(patch.height, shape.height),
          strokeColor: patch.strokeColor && isHexColor(patch.strokeColor) ? patch.strokeColor : shape.strokeColor,
          fillColor: patch.fillColor && isFillColor(patch.fillColor) ? patch.fillColor : shape.fillColor,
          strokeWidth: patch.strokeWidth === undefined ? shape.strokeWidth : Math.max(1, Math.min(24, Math.round(patch.strokeWidth))),
          rotationDegrees: patch.rotationDegrees === undefined ? shape.rotationDegrees : normalizeRotationDegrees(patch.rotationDegrees),
        };
      }),
    }));
  }

  function updateSourceImagePhysicalWidthCm(sourceId: string, value: number) {
    const widthCells = value / Math.max(0.05, settings.cellSizeCm);
    updateSourceImage(sourceId, { width: widthCells });
  }

  function updateSourceImagePhysicalHeight(sourceId: string, value: number) {
    const source = settings.sourceImages.find((image) => image.id === sourceId);
    const unit = source?.measurementUnit ?? settings.measurementUnit;
    const heightCells = unitToCm(value, unit) / Math.max(0.05, settings.cellSizeCm);
    updateSourceImage(sourceId, { height: heightCells });
  }

  function updateSourceImage(
    sourceId: string,
    patch: Partial<
      Pick<
        GraphSourceImage,
        | "width"
        | "height"
        | "measurementUnit"
        | "imageLineThickness"
        | "sourceFillThreshold"
        | "sourceFillMinStrokePixels"
        | "strokeGapClosePixels"
        | "x"
        | "y"
        | "topPadding"
        | "bottomPadding"
        | "locked"
        | "rotationDegrees"
        | "flipX"
        | "flipY"
      >
    >,
  ) {
    setSettingsWithHistory((current) => ({
      ...current,
      fillRegions: {},
      sourceImages: current.sourceImages.map((source) => {
        if (source.id !== sourceId) return source;
        const changesLockedGeometry =
          patch.width !== undefined ||
          patch.height !== undefined ||
          patch.x !== undefined ||
          patch.y !== undefined ||
          patch.topPadding !== undefined ||
          patch.bottomPadding !== undefined ||
          patch.rotationDegrees !== undefined ||
          patch.flipX !== undefined ||
          patch.flipY !== undefined;
        if (source.locked && changesLockedGeometry) return source;
        const width = patch.width === undefined ? source.width : clampSourceSizeCells(patch.width, source.width);
        const height = patch.height === undefined ? source.height : clampSourceSizeCells(patch.height, source.height);
        const topPadding = patch.topPadding === undefined ? source.topPadding : clampPaddingCells(patch.topPadding, current.graphHeight, source.topPadding);
        const bottomPadding = patch.bottomPadding === undefined ? source.bottomPadding : clampPaddingCells(patch.bottomPadding, current.graphHeight, source.bottomPadding);
        const y = patch.y === undefined ? source.y : clampFreeCellCoordinate(patch.y, source.y);
        return {
          ...source,
          ...patch,
          width,
          height,
          rotationDegrees: patch.rotationDegrees === undefined ? source.rotationDegrees : normalizeRotationDegrees(patch.rotationDegrees),
          x: patch.x === undefined ? (patch.width ? clampSourceX(source.x, current.graphWidth, width) : source.x) : clampSourceX(patch.x, current.graphWidth, width),
          y,
          topPadding,
          bottomPadding,
        };
      }),
    }));
  }

  const nudgeSelectedSource = useCallback((deltaX: number, deltaY: number) => {
    const sourceId = selectedSourceId;
    const drawingId = selectedDrawingLayerId;
    if (!sourceId && !drawingId) return;
    setSettingsWithHistory((current) => {
      if (!sourceId && drawingId) {
        const [type, id] = drawingId.split(":") as ["cell" | "shape", string];
        const nudgeCells = roundCells(0.1 / Math.max(0.05, current.cellSizeCm));
        if (type === "cell") {
          const cell = current.cellPaints.find((item) => item.id === id);
          if (!cell || cell.locked) return current;
          return {
            ...current,
            cellPaints: current.cellPaints.map((item) =>
              item.id === id ? { ...item, x: roundCells(Math.max(0, item.x + deltaX * nudgeCells)), y: roundCells(Math.max(0, item.y + deltaY * nudgeCells)) } : item,
            ),
          };
        }
        const shape = current.graphShapes.find((item) => item.id === id);
        if (!shape || shape.locked) return current;
        return {
          ...current,
          graphShapes: current.graphShapes.map((item) =>
            item.id === id ? { ...item, x: clampFreeCellCoordinate(item.x + deltaX * nudgeCells, item.x), y: clampFreeCellCoordinate(item.y + deltaY * nudgeCells, item.y) } : item,
          ),
        };
      }
      const source = current.sourceImages.find((image) => image.id === sourceId);
      if (!source || source.locked) return current;
      const nudgeCells = roundCells(0.1 / Math.max(0.05, current.cellSizeCm));
      const x = clampSourceX(source.x + deltaX * nudgeCells, current.graphWidth, source.width);
      const y = clampFreeCellCoordinate(source.y + deltaY * nudgeCells, source.y);
      if (source.x === x && source.y === y) return current;
      return {
        ...current,
        fillRegions: {},
        sourceImages: current.sourceImages.map((image) => (image.id === sourceId ? { ...image, x, y } : image)),
      };
    });
  }, [selectedDrawingLayerId, selectedSourceId, setSettingsWithHistory]);

  function moveSourceImage(sourceId: string, direction: -1 | 1) {
    setSettingsWithHistory((current) => {
      const index = current.sourceImages.findIndex((source) => source.id === sourceId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.sourceImages.length) return current;
      if (current.sourceImages[index]?.locked || current.sourceImages[nextIndex]?.locked) return current;
      const sourceImages = [...current.sourceImages];
      const [source] = sourceImages.splice(index, 1);
      sourceImages.splice(nextIndex, 0, source);
      return { ...current, fillRegions: {}, sourceImages };
    });
  }

  function removeSourceImage(sourceId: string, options: { skipConfirm?: boolean } = {}) {
    const source = settingsRef.current.sourceImages.find((image) => image.id === sourceId);
    if (!source || source.locked) return;
    if (!options.skipConfirm && !window.confirm(`Delete "${source.name}" from this project?`)) return;
    setDeletingSourceId(sourceId);
    setSettingsWithHistory((current) => ({
      ...current,
      fillRegions: {},
      sourceImages: current.sourceImages.filter((source) => source.id !== sourceId || source.locked),
    }));
    window.setTimeout(() => setDeletingSourceId((current) => (current === sourceId ? null : current)), 180);
  }

  function toggleSourceLock(sourceId: string) {
    setSettingsWithHistory((current) => ({
      ...current,
      sourceImages: current.sourceImages.map((source) => (source.id === sourceId ? { ...source, locked: !source.locked } : source)),
    }));
  }

  function rotateSourceImage(sourceId: string, direction: -1 | 1) {
    const source = settingsRef.current.sourceImages.find((image) => image.id === sourceId);
    if (!source || source.locked) return;
    updateSourceImage(sourceId, { rotationDegrees: normalizeRotationDegrees(source.rotationDegrees + direction * ROTATION_STEP_DEGREES) });
  }

  function flipSourceImage(sourceId: string, axis: "x" | "y") {
    const source = settingsRef.current.sourceImages.find((image) => image.id === sourceId);
    if (!source || source.locked) return;
    updateSourceImage(sourceId, axis === "x" ? { flipX: !source.flipX } : { flipY: !source.flipY });
  }

  function toggleDrawingLayerCard(key: DrawingLayerKey) {
    setExpandedDrawingLayerIds((current) => ({ ...current, [key]: !current[key] }));
  }

  function toggleDrawingLock(type: "cell" | "shape", id: string) {
    setSettingsWithHistory((current) => ({
      ...current,
      cellPaints: type === "cell" ? current.cellPaints.map((cell) => (cell.id === id ? { ...cell, locked: !cell.locked } : cell)) : current.cellPaints,
      graphShapes: type === "shape" ? current.graphShapes.map((shape) => (shape.id === id ? { ...shape, locked: !shape.locked } : shape)) : current.graphShapes,
    }));
  }

  function removeDrawingLayer(type: "cell" | "shape", id: string, name: string, locked: boolean) {
    if (locked) return;
    if (!window.confirm(`Delete "${name}" from this project?`)) return;
    setSettingsWithHistory((current) => ({
      ...current,
      cellPaints: type === "cell" ? current.cellPaints.filter((cell) => cell.id !== id) : current.cellPaints,
      graphShapes: type === "shape" ? current.graphShapes.filter((shape) => shape.id !== id) : current.graphShapes,
    }));
    setSelectedDrawingLayerId((current) => (current === drawingLayerKey(type, id) ? null : current));
  }

  function moveDrawingLayer(type: "cell" | "shape", id: string, direction: -1 | 1) {
    setSettingsWithHistory((current) => {
      const list = type === "cell" ? current.cellPaints : current.graphShapes;
      const index = list.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= list.length) return current;
      if (list[index]?.locked || list[nextIndex]?.locked) return current;
      const nextList = [...list];
      const [item] = nextList.splice(index, 1);
      nextList.splice(nextIndex, 0, item);
      return type === "cell" ? { ...current, cellPaints: nextList as GraphCellPaint[] } : { ...current, graphShapes: nextList as GraphShapeDrawing[] };
    });
  }

  function rotateDrawingLayer(type: "cell" | "shape", id: string, direction: -1 | 1) {
    if (type === "cell") {
      const cell = settingsRef.current.cellPaints.find((item) => item.id === id);
      if (!cell || cell.locked) return;
      updateCellPaint(id, { rotationDegrees: normalizeRotationDegrees(cell.rotationDegrees + direction * ROTATION_STEP_DEGREES) });
      return;
    }
    const shape = settingsRef.current.graphShapes.find((item) => item.id === id);
    if (!shape || shape.locked) return;
    updateGraphShape(id, { rotationDegrees: normalizeRotationDegrees(shape.rotationDegrees + direction * ROTATION_STEP_DEGREES) });
  }

  function flipDrawingLayer(type: "cell" | "shape", id: string, axis: "x" | "y") {
    if (type === "cell") {
      const cell = settingsRef.current.cellPaints.find((item) => item.id === id);
      if (!cell || cell.locked) return;
      updateCellPaint(id, axis === "x" ? { flipX: !cell.flipX } : { flipY: !cell.flipY });
      return;
    }
    const shape = settingsRef.current.graphShapes.find((item) => item.id === id);
    if (!shape || shape.locked) return;
    updateGraphShape(id, axis === "x" ? { flipX: !shape.flipX } : { flipY: !shape.flipY });
  }

  function toggleCellPaintSide(side: GraphCellLineSide) {
    setCellPaintSides((current) => (current.includes(side) ? current.filter((item) => item !== side) : [...current, side]));
  }

  function setAllCellPaintSides() {
    setCellPaintSides(CELL_LINE_SIDE_KEYS);
    setCellPaintLineEnabled(true);
  }

  function clearCellPaints() {
    setSettingsWithHistory((current) => ({ ...current, cellPaints: [] }));
  }

  function clearGraphShapes() {
    setSettingsWithHistory((current) => ({ ...current, graphShapes: [] }));
  }

  function toggleSourceCard(sourceId: string) {
    setExpandedSourceIds((current) => ({ ...current, [sourceId]: !current[sourceId] }));
  }

  function beginPanelResize(event: ReactPointerEvent<HTMLElement>, side: "left" | "right") {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    panelResizeStateRef.current = {
      side,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startWidth: side === "left" ? leftPanelWidth : rightPanelWidth,
    };
    setResizingPanelSide(side);
  }

  function resizePanel(event: ReactPointerEvent<HTMLElement>) {
    const resizeState = panelResizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    const delta = event.clientX - resizeState.startClientX;
    const width = resizeState.side === "left" ? resizeState.startWidth + delta : resizeState.startWidth - delta;
    if (resizeState.side === "left") setLeftPanelWidth(clampSidePanelWidth(width));
    else setRightPanelWidth(clampSidePanelWidth(width));
  }

  function endPanelResize(event: ReactPointerEvent<HTMLElement>) {
    const resizeState = panelResizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    panelResizeStateRef.current = null;
    setResizingPanelSide(null);
  }

  function updateFillRegionColor(regionId: string, color: string) {
    if (!isFillColor(color)) return;
    setSettingsWithHistory((current) => {
      const fillRegions = { ...current.fillRegions };
      const region = fillRegionsById.get(regionId);
      const defaultColor = region ? defaultFillRegionColor(region, current) : current.fillColor;
      if (color.toLowerCase() === defaultColor.toLowerCase()) delete fillRegions[regionId];
      else fillRegions[regionId] = color;
      return { ...current, fillRegions };
    });
  }

  function resetFillRegionColor(regionId: string) {
    setSettingsWithHistory((current) => {
      const fillRegions = { ...current.fillRegions };
      delete fillRegions[regionId];
      return { ...current, fillRegions };
    });
  }

  function sourceLayoutAtPointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || !canvas.width || !canvas.height) return null;

    const canvasX = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const canvasY = ((event.clientY - rect.top) * canvas.height) / rect.height;
    const graphX = (canvasX - settings.imageOffsetX) / GRAPH_MAJOR_CELL_PIXELS;
    const graphY = (canvasY - settings.imageOffsetY) / GRAPH_MAJOR_CELL_PIXELS;
    const layouts = sourceLayouts(settings.sourceImages);

    for (let index = layouts.length - 1; index >= 0; index -= 1) {
      const layout = layouts[index];
      if (graphX < layout.x || graphX > layout.x + layout.width || graphY < layout.y || graphY > layout.y + layout.height) continue;
      return layout;
    }

    return null;
  }

  function graphPointAtPointer(event: ReactPointerEvent<HTMLElement>) {
    const canvas = previewCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || !canvas.width || !canvas.height) return null;
    const canvasX = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const canvasY = ((event.clientY - rect.top) * canvas.height) / rect.height;
    return {
      x: canvasX / GRAPH_MAJOR_CELL_PIXELS,
      y: canvasY / GRAPH_MAJOR_CELL_PIXELS,
    };
  }

  function drawingId(prefix: string) {
    return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;
  }

  function paintCellAtPointer(event: ReactPointerEvent<HTMLElement>, dragState: DragState) {
    const point = graphPointAtPointer(event);
    if (!point) return;
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    if (x < 0 || y < 0 || x >= settingsRef.current.graphWidth || y >= settingsRef.current.graphHeight) return;
    const sides = cellPaintLineEnabled ? cellPaintSides : [];
    const fillColor = cellPaintFillEnabled ? settingsRef.current.fillColor : TRANSPARENT_FILL_COLOR;
    if (!sides.length && fillColor === TRANSPARENT_FILL_COLOR) return;
    const currentPaints = settingsRef.current.cellPaints;
    const existingBefore = currentPaints.find((paint) => paint.x === x && paint.y === y);
    const selectedPaintId = existingBefore?.id ?? drawingId("cell");
    setSelectedSourceId(null);
    setSelectedDrawingLayerId(drawingLayerKey("cell", selectedPaintId));

    setSettings((current) => {
      const existingIndex = current.cellPaints.findIndex((paint) => paint.x === x && paint.y === y);
      const existing = existingIndex >= 0 ? current.cellPaints[existingIndex] : null;
      const nextPaint = {
        id: existing?.id ?? selectedPaintId,
        name: existing?.name ?? `Cell paint ${current.cellPaints.length + 1}`,
        x,
        y,
        width: existing?.width ?? 1,
        height: existing?.height ?? 1,
        sides: Array.from(new Set([...(existing?.sides ?? []), ...sides])),
        lineColor: settingsRef.current.outlineColor,
        fillColor: fillColor === TRANSPARENT_FILL_COLOR ? existing?.fillColor ?? TRANSPARENT_FILL_COLOR : fillColor,
        lineWidth: Math.max(1, Math.round(settingsRef.current.imageLineThickness || 3)),
        locked: existing?.locked ?? false,
        rotationDegrees: existing?.rotationDegrees ?? 0,
        flipX: existing?.flipX ?? false,
        flipY: existing?.flipY ?? false,
      };
      if (
        existing &&
        existing.fillColor === nextPaint.fillColor &&
        existing.lineColor === nextPaint.lineColor &&
        existing.lineWidth === nextPaint.lineWidth &&
        existing.sides.length === nextPaint.sides.length &&
        existing.sides.every((side) => nextPaint.sides.includes(side))
      ) {
        return current;
      }
      if (!dragState.historyRecorded) {
        pushUndoSettings(current);
        dragState.historyRecorded = true;
      }
      const cellPaints = [...current.cellPaints];
      if (existingIndex >= 0) cellPaints[existingIndex] = nextPaint;
      else cellPaints.push(nextPaint);
      const next = deriveGraphSettings({ ...current, cellPaints });
      settingsRef.current = next;
      return next;
    });
  }

  function startShapeAtPointer(event: ReactPointerEvent<HTMLElement>, dragState: DragState) {
    const point = graphPointAtPointer(event);
    if (!point) return;
    const id = drawingId("shape");
    const cellX = Math.max(0, Math.floor(point.x));
    const cellY = Math.max(0, Math.floor(point.y));
    dragState.shapeId = id;
    dragState.startGraphX = cellX;
    dragState.startGraphY = cellY;
    setSelectedSourceId(null);
    setSelectedDrawingLayerId(drawingLayerKey("shape", id));
    setSettings((current) => {
      if (!dragState.historyRecorded) {
        pushUndoSettings(current);
        dragState.historyRecorded = true;
      }
      const next = deriveGraphSettings({
        ...current,
        graphShapes: [
          ...current.graphShapes,
          {
            id,
            name: `${GRAPH_SHAPE_KIND_LABELS[shapeKind]} ${current.graphShapes.length + 1}`,
            kind: shapeKind,
            x: cellX,
            y: cellY,
            width: 1,
            height: 1,
            strokeColor: current.outlineColor,
            fillColor: cellPaintFillEnabled ? current.fillColor : TRANSPARENT_FILL_COLOR,
            strokeWidth: Math.max(1, Math.round(current.imageLineThickness || 3)),
            locked: false,
            rotationDegrees: 0,
            flipX: false,
            flipY: false,
          },
        ],
      });
      settingsRef.current = next;
      return next;
    });
  }

  function updateShapeAtPointer(event: ReactPointerEvent<HTMLElement>, dragState: DragState) {
    if (!dragState.shapeId || dragState.startGraphX === undefined || dragState.startGraphY === undefined) return;
    const point = graphPointAtPointer(event);
    if (!point) return;
    const startX = dragState.startGraphX;
    const startY = dragState.startGraphY;
    const rawWidth = point.x - startX;
    const rawHeight = point.y - startY;
    setSettings((current) => {
      const shape = current.graphShapes.find((item) => item.id === dragState.shapeId);
      if (!shape) return current;
      let x = startX;
      let y = startY;
      let width = rawWidth;
      let height = rawHeight;
      if (shape.kind !== "line" && shape.kind !== "arrow") {
        x = Math.min(startX, point.x);
        y = Math.min(startY, point.y);
        width = Math.max(0.1, Math.abs(rawWidth));
        height = Math.max(0.1, Math.abs(rawHeight));
        if (shape.kind === "square" || shape.kind === "circle") {
          const size = Math.max(width, height);
          width = size;
          height = size;
        }
      }
      const next = deriveGraphSettings({
        ...current,
        graphShapes: current.graphShapes.map((item) =>
          item.id === dragState.shapeId ? { ...item, x, y, width, height } : item,
        ),
      });
      settingsRef.current = next;
      return next;
    });
  }

  function fillRegionIdAtPointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const regionMap = fillRegionMapRef.current;
    if (!regionMap || !canvas.width || !canvas.height) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = Math.floor(((event.clientX - rect.left) * canvas.width) / rect.width);
    const y = Math.floor(((event.clientY - rect.top) * canvas.height) / rect.height);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;

    const regionNumber = regionMap[y * canvas.width + x];
    return regionNumber ? String(regionNumber) : null;
  }

  function floatingPalettePosition(event: ReactPointerEvent<HTMLCanvasElement>) {
    const width = 244;
    const height = 216;
    const margin = 12;
    return {
      x: Math.max(margin, Math.min(window.innerWidth - width - margin, event.clientX + margin)),
      y: Math.max(margin, Math.min(window.innerHeight - height - margin, event.clientY + margin)),
    };
  }

  function selectFillRegionFromPointer(event: ReactPointerEvent<HTMLCanvasElement>, showPalette = false) {
    const regionId = fillRegionIdAtPointer(event);
    if (!regionId) {
      if (showPalette) setFloatingPalette(null);
      return false;
    }
    setSelectedFillRegionId(regionId);
    if (copiedFillColor) {
      updateFillRegionColor(regionId, copiedFillColor);
      setCopiedFillColor(null);
      setFloatingPalette(null);
      setNotice({ tone: "ok", text: "Fill color applied." });
      return true;
    }
    if (showPalette) {
      const position = floatingPalettePosition(event);
      setFloatingPalette({ regionId, ...position });
    }
    return true;
  }

  function beginGraphDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (showOriginal || event.button !== 0) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const viewportDrag = event.ctrlKey || spacePressedRef.current;
    if (!viewportDrag && drawingTool !== "image") {
      event.preventDefault();
      setSelectedSourceId(null);
      setFloatingPalette(null);
      canvas.setPointerCapture(event.pointerId);
      const dragState: DragState = {
        kind: drawingTool === "cell" ? "cell-paint" : "shape-draw",
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetX: settings.imageOffsetX,
        startOffsetY: settings.imageOffsetY,
        startScrollLeft: canvasScrollRef.current?.scrollLeft ?? 0,
        startScrollTop: canvasScrollRef.current?.scrollTop ?? 0,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        rectWidth: rect.width,
        rectHeight: rect.height,
        moved: false,
        historyRecorded: false,
      };
      dragStateRef.current = dragState;
      if (drawingTool === "cell") paintCellAtPointer(event, dragState);
      else startShapeAtPointer(event, dragState);
      setIsDraggingGraph(true);
      return;
    }

    const sourceHit = sourceLayoutAtPointer(event);
    if (sourceHit) {
      setSelectedSourceId(sourceHit.source.id);
      setSelectedDrawingLayerId(null);
    }
    if (!sourceHit && !viewportDrag) {
      setSelectedSourceId(null);
      setSelectedDrawingLayerId(null);
      selectFillRegionFromPointer(event, true);
    }

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      kind: viewportDrag || !sourceHit ? "viewport" : "source",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: settings.imageOffsetX,
      startOffsetY: settings.imageOffsetY,
      sourceId: sourceHit?.source.id,
      startSourceX: sourceHit?.source.x,
      startSourceY: sourceHit?.y,
      startSourceWidth: sourceHit?.source.width,
      startSourceHeight: sourceHit?.source.height,
      startScrollLeft: canvasScrollRef.current?.scrollLeft ?? 0,
      startScrollTop: canvasScrollRef.current?.scrollTop ?? 0,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      rectWidth: rect.width,
      rectHeight: rect.height,
      moved: false,
      historyRecorded: false,
    };
    setIsDraggingGraph(true);
  }

  function beginSourceResize(event: ReactPointerEvent<HTMLElement>, layout: SourceLayout, resizeCorner: SourceResizeHandle) {
    if (showOriginal || event.button !== 0 || layout.source.locked) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedSourceId(layout.source.id);
    setSelectedDrawingLayerId(null);
    dragStateRef.current = {
      kind: "resize-source",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: settings.imageOffsetX,
      startOffsetY: settings.imageOffsetY,
      sourceId: layout.source.id,
      startSourceX: layout.x,
      startSourceY: layout.y,
      startSourceWidth: layout.width,
      startSourceHeight: layout.height,
      resizeCorner,
      startScrollLeft: canvasScrollRef.current?.scrollLeft ?? 0,
      startScrollTop: canvasScrollRef.current?.scrollTop ?? 0,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      rectWidth: rect.width,
      rectHeight: rect.height,
      moved: false,
      historyRecorded: false,
    };
    setIsDraggingGraph(true);
  }

  function dragGraph(event: ReactPointerEvent<HTMLElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      if (!showOriginal && event.buttons === 1 && event.currentTarget === previewCanvasRef.current) {
        selectFillRegionFromPointer(event as ReactPointerEvent<HTMLCanvasElement>);
      }
      return;
    }
    event.preventDefault();

    const deltaX = ((event.clientX - dragState.startClientX) * dragState.canvasWidth) / dragState.rectWidth;
    const deltaY = ((event.clientY - dragState.startClientY) * dragState.canvasHeight) / dragState.rectHeight;
    const imageOffsetX = clampImageOffset(dragState.startOffsetX + deltaX);
    const imageOffsetY = clampImageOffset(dragState.startOffsetY + deltaY);
    dragState.moved = dragState.moved || Math.abs(event.clientX - dragState.startClientX) > 3 || Math.abs(event.clientY - dragState.startClientY) > 3;

    if (dragState.kind === "viewport") {
      const scroller = canvasScrollRef.current;
      if (scroller) {
        scroller.scrollLeft = (dragState.startScrollLeft ?? 0) - (event.clientX - dragState.startClientX);
        scroller.scrollTop = (dragState.startScrollTop ?? 0) - (event.clientY - dragState.startClientY);
      }
      return;
    }

    if (dragState.kind === "cell-paint") {
      paintCellAtPointer(event, dragState);
      return;
    }

    if (dragState.kind === "shape-draw") {
      updateShapeAtPointer(event, dragState);
      return;
    }

    if (
      dragState.kind === "resize-source" &&
      dragState.sourceId &&
      dragState.startSourceX !== undefined &&
      dragState.startSourceY !== undefined &&
      dragState.startSourceWidth !== undefined &&
      dragState.startSourceHeight !== undefined
    ) {
      const deltaCellsX = deltaX / GRAPH_MAJOR_CELL_PIXELS;
      const deltaCellsY = deltaY / GRAPH_MAJOR_CELL_PIXELS;
      setSettings((current) => {
        const source = current.sourceImages.find((image) => image.id === dragState.sourceId);
        if (!source || source.locked) return current;

        let left = dragState.startSourceX!;
        let right = dragState.startSourceX! + dragState.startSourceWidth!;
        let top = dragState.startSourceY!;
        let bottom = dragState.startSourceY! + dragState.startSourceHeight!;
        if (dragState.resizeCorner?.includes("w")) left = snapCellToGrid(left + deltaCellsX);
        if (dragState.resizeCorner?.includes("e")) right = snapCellToGrid(right + deltaCellsX);
        if (dragState.resizeCorner?.includes("n")) top = snapCellToGrid(top + deltaCellsY);
        if (dragState.resizeCorner?.includes("s")) bottom = snapCellToGrid(bottom + deltaCellsY);

        const minSize = 0.25;
        if (right - left < minSize) {
          if (dragState.resizeCorner?.includes("w")) left = right - minSize;
          else right = left + minSize;
        }
        if (bottom - top < minSize) {
          if (dragState.resizeCorner?.includes("n")) top = bottom - minSize;
          else bottom = top + minSize;
        }

        const width = clampSourceSizeCells(right - left, source.width);
        const height = clampSourceSizeCells(bottom - top, source.height);
        const x = clampSourceX(left, current.graphWidth, width);
        const y = clampFreeCellCoordinate(top, source.y);
        if (source.x === x && source.y === y && source.width === width && source.height === height) return current;
        if (!dragState.historyRecorded) {
          pushUndoSettings(current);
          dragState.historyRecorded = true;
        }
        const next = deriveGraphSettings({
          ...current,
          fillRegions: {},
          sourceImages: current.sourceImages.map((image) =>
            image.id === dragState.sourceId ? { ...image, x, y, width, height } : image,
          ),
        });
        settingsRef.current = next;
        return next;
      });
      return;
    }

    if (dragState.kind === "source" && dragState.sourceId && dragState.startSourceX !== undefined && dragState.startSourceY !== undefined) {
      const deltaCellsX = deltaX / GRAPH_MAJOR_CELL_PIXELS;
      const deltaCellsY = deltaY / GRAPH_MAJOR_CELL_PIXELS;
      setSettings((current) => {
        const source = current.sourceImages.find((image) => image.id === dragState.sourceId);
        if (!source || source.locked) return current;
        const x = clampSourceX(snapCellToGrid(dragState.startSourceX! + deltaCellsX), current.graphWidth, source.width);
        const y = clampFreeCellCoordinate(snapCellToGrid((dragState.startSourceY ?? 0) + deltaCellsY), source.y);
        if (source.x === x && source.y === y) return current;
        if (!dragState.historyRecorded) {
          pushUndoSettings(current);
          dragState.historyRecorded = true;
        }
        const next = deriveGraphSettings({
          ...current,
          fillRegions: {},
          sourceImages: current.sourceImages.map((image) => (image.id === dragState.sourceId ? { ...image, x, y } : image)),
        });
        settingsRef.current = next;
        return next;
      });
      return;
    }

    void imageOffsetX;
    void imageOffsetY;
  }

  function endGraphDrag(event: ReactPointerEvent<HTMLElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const shouldSelectFill = dragState.kind === "source" && !dragState.moved && !showOriginal;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
    setIsDraggingGraph(false);
    if (shouldSelectFill && event.currentTarget === previewCanvasRef.current) {
      selectFillRegionFromPointer(event as ReactPointerEvent<HTMLCanvasElement>, true);
    }
  }

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const drawPreview = useCallback((canvas: HTMLCanvasElement) => {
    const preview = previewCanvasRef.current;
    const overview = overviewCanvasRef.current;
    setPreviewCanvasSize({ width: canvas.width, height: canvas.height });
    if (!preview) return;
    preview.width = canvas.width;
    preview.height = canvas.height;
    const context = preview.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, preview.width, preview.height);
    context.drawImage(canvas, 0, 0);
    if (overview) {
      overview.width = canvas.width;
      overview.height = canvas.height;
      const overviewContext = overview.getContext("2d");
      if (overviewContext) {
        overviewContext.clearRect(0, 0, overview.width, overview.height);
        overviewContext.drawImage(canvas, 0, 0);
      }
    }
  }, []);

  useEffect(() => {
    if (!draftChecked) return;
    const sources = settingsRef.current.sourceImages;
    let cancelled = false;
    setSourceReady(false);
    setSourceCropMode(false);
    setSourceCropArea(null);
    setFillRegions([]);
    setSelectedFillRegionId(null);
    setFloatingPalette(null);
    setCopiedFillColor(null);
    fillRegionMapRef.current = null;
    sourceCanvasRef.current = null;
    sourceCanvasesRef.current = new Map();
    sourceLayerCacheRef.current = new Map();
    processedCanvasRef.current = null;
    setProcessing(false);
    sourcePreviewObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    sourcePreviewObjectUrlsRef.current = new Map();
    setSourceStatus({});

    if (!sources.length) {
      const preview = previewCanvasRef.current;
      const overview = overviewCanvasRef.current;
      const context = preview?.getContext("2d");
      const overviewContext = overview?.getContext("2d");
      if (preview && context) context.clearRect(0, 0, preview.width, preview.height);
      if (overview && overviewContext) overviewContext.clearRect(0, 0, overview.width, overview.height);
      setNotice(null);
      return () => {
        cancelled = true;
      };
    }

    const hasPdf = sources.some((source) => isPdfFile({ name: source.name }));
    setNotice({ tone: "info", text: hasPdf ? "Rendering source files..." : "Loading source files..." });

    void mapWithConcurrency(
      sources,
      2,
      async (source) => {
        try {
          if (!source.url) throw new Error(`${source.name} is not available. Save and reopen the project, then try again.`);
          const canvas = resizeImage(await loadImageToCanvas(source.url, source.name), 2200, 2200);
          const previewUrl = await canvasToObjectUrl(canvas);
          return { source, canvas, previewUrl, error: null };
        } catch (error) {
          return {
            source,
            canvas: null,
            previewUrl: null,
            error: error instanceof Error ? error.message : "Unable to load this source image.",
          };
        }
      },
    )
      .then((loadedSources) => {
        if (cancelled) {
          for (const loaded of loadedSources) {
            if (loaded.previewUrl) URL.revokeObjectURL(loaded.previewUrl);
          }
          return;
        }

        const canvases = new Map<string, HTMLCanvasElement>();
        const previewUrls = new Map<string, string>();
        const nextStatus: Record<string, SourceStatus> = {};
        let readyCount = 0;
        for (const { source, canvas, previewUrl, error } of loadedSources) {
          if (!canvas || !previewUrl) {
            nextStatus[source.id] = { ready: false, previewUrl: null, error };
            continue;
          }
          canvases.set(source.id, canvas);
          previewUrls.set(source.id, previewUrl);
          nextStatus[source.id] = { ready: true, previewUrl, error: null };
          readyCount += 1;
        }
        sourceCanvasesRef.current = canvases;
        sourceCanvasRef.current = canvases.get(sources[0]?.id ?? "") ?? null;
        sourcePreviewObjectUrlsRef.current = previewUrls;
        setSourceStatus(nextStatus);
        setSourceReady(readyCount > 0);
        setNotice(readyCount ? null : { tone: "error", text: "Unable to load any source images." });
      })
      .catch((error) => {
        if (!cancelled) setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load source files." });
      });

    return () => {
      cancelled = true;
    };
  }, [draftChecked, sourceLoadKey]);

  useEffect(() => {
    if (!draftChecked) return;
    if (settings.sourceImages.length && !sourceReady) return;
    let cancelled = false;
    const controller = new AbortController();
    setProcessing(true);

    const timer = window.setTimeout(() => {
      const layouts = sourceLayouts(settings.sourceImages);
      const layers = layouts
        .filter((layout) => sourceCanvasesRef.current.has(layout.source.id))
        .map((layout) => {
          const cacheKey = `${settings.graphWidth}x${settings.graphHeight}:${settings.imageOffsetX},${settings.imageOffsetY}:${sourceProcessingCacheKey(layout.source, layout)}`;
          let canvas = sourceLayerCacheRef.current.get(cacheKey);
          if (!canvas) {
            canvas = composeSourceLayerCanvas(layout, sourceCanvasesRef.current, settings);
            sourceLayerCacheRef.current.set(cacheKey, canvas);
          }
          return {
            canvas,
            settings: sourceSettings(settings, layout.source),
          };
        });
      if (sourceLayerCacheRef.current.size > settings.sourceImages.length * 4) {
        const liveKeys = new Set(layouts.map((layout) => `${settings.graphWidth}x${settings.graphHeight}:${settings.imageOffsetX},${settings.imageOffsetY}:${sourceProcessingCacheKey(layout.source, layout)}`));
        for (const key of sourceLayerCacheRef.current.keys()) {
          if (!liveKeys.has(key)) sourceLayerCacheRef.current.delete(key);
        }
      }
      const renderSettings = deriveGraphSettings({
        ...settings,
        imageWidth: settings.graphWidth,
        imageHeight: settings.graphHeight,
      });
      void pixelateLayeredImagesWithWorker(layers, renderSettings, { signal: controller.signal })
        .then((result) => {
          if (cancelled) return;
          processedCanvasRef.current = result.canvas;
          fillRegionMapRef.current = result.fillRegionMap;
          drawPreview(result.canvas);
          setFillRegions(result.fillRegions);
          setSelectedFillRegionId((current) => (current && result.fillRegions.some((region) => region.id === current) ? current : null));
          setFloatingPalette((current) => (current && result.fillRegions.some((region) => region.id === current.regionId) ? current : null));
          setPalette(result.palette);
          setProcessing(false);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          if (!cancelled) {
            setProcessing(false);
            setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to process image." });
          }
        });
    }, 60);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [draftChecked, drawPreview, settings, sourceReady]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === "Space" && !isFormControlTarget(event.target)) {
        spacePressedRef.current = true;
      }
      const arrowNudge: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const nudge = arrowNudge[event.key];
      if (nudge && (selectedSourceId || selectedDrawingLayerId) && !isFormControlTarget(event.target)) {
        event.preventDefault();
        nudgeSelectedSource(nudge[0], nudge[1]);
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if ((key === "z" || key === "y") && !isTextEditingTarget(event.target)) {
        event.preventDefault();
        restoreSettingsHistory(key === "y" || event.shiftKey ? "redo" : "undo");
        return;
      }
      if (key !== "c" || !selectedFillRegion || isFormControlTarget(event.target)) return;

      event.preventDefault();
      setCopiedFillColor(selectedFillRegionColor);
      setFloatingPalette(null);
      setNotice({ tone: "info", text: "Fill color copied." });
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") spacePressedRef.current = false;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [nudgeSelectedSource, restoreSettingsHistory, selectedDrawingLayerId, selectedFillRegion, selectedFillRegionColor, selectedSourceId]);

  useEffect(() => {
    return () => {
      for (const url of uploadedSourceObjectUrlsRef.current) URL.revokeObjectURL(url);
      sourcePreviewObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function uploadSourceImages(filesInput: File[] | FileList, successText = "Source images added.", replaceSourceId?: string) {
    setNotice(null);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setNotice({
        tone: "error",
        text: "Adding, replacing, or cropping source images needs a connection. You can keep editing loaded images and save an offline draft.",
      });
      return false;
    }
    const files = Array.from(filesInput);
    if (!files.length) return false;
    if (replaceSourceId && files.length !== 1) {
      setNotice({ tone: "error", text: "Choose one image to replace this source." });
      return false;
    }
    for (const file of files) {
      if (!isAllowedImageFile(file)) {
        setNotice({ tone: "error", text: `Use ${ALLOWED_IMAGE_LABEL} files only.` });
        return false;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setNotice({ tone: "error", text: `Each file must be ${bytesToSize(MAX_UPLOAD_BYTES)} or smaller.` });
        return false;
      }
    }
    const previousSource = replaceSourceId ? settingsRef.current.sourceImages.find((source) => source.id === replaceSourceId) ?? null : null;
    if (replaceSourceId && !previousSource) {
      setNotice({ tone: "error", text: "Unable to find the image to replace." });
      return false;
    }
    setUploadingSources(true);
    setReplacingSourceId(replaceSourceId ?? null);

    const uploadItems = files.map((file) => ({
      file,
      id: replaceSourceId && files.length === 1 ? replaceSourceId : crypto.randomUUID(),
      url: URL.createObjectURL(file),
    }));
    const optimisticIds = new Set(uploadItems.map((item) => item.id));
    uploadedSourceObjectUrlsRef.current.push(...uploadItems.map((item) => item.url));
    setSettingsWithHistory((current) => {
      const replacedSource = replaceSourceId ? current.sourceImages.find((source) => source.id === replaceSourceId) : null;
      let nextY = stackEndCell(current.sourceImages);
      const addedSources = uploadItems.map((item, index) => {
        const width = replacedSource?.width ?? current.imageWidth;
        const height = replacedSource?.height ?? current.imageHeight;
        const y = replacedSource ? replacedSource.y : nextY;
        if (!replacedSource) nextY += height;
        return {
          id: item.id,
          name: item.file.name || `Source ${current.sourceImages.length + index + 1}`,
          path: null,
          url: item.url,
          width,
          height,
          measurementUnit: replacedSource?.measurementUnit ?? current.measurementUnit,
          imageLineThickness: replacedSource?.imageLineThickness ?? current.imageLineThickness,
          sourceFillThreshold: replacedSource?.sourceFillThreshold ?? current.sourceFillThreshold,
          sourceFillMinStrokePixels: replacedSource?.sourceFillMinStrokePixels ?? current.sourceFillMinStrokePixels,
          strokeGapClosePixels: replacedSource?.strokeGapClosePixels ?? current.strokeGapClosePixels,
          x: replacedSource ? replacedSource.x : defaultSourceX(current.graphWidth, width),
          y,
          topPadding: replacedSource?.topPadding ?? 0,
          bottomPadding: replacedSource?.bottomPadding ?? 0,
          locked: replacedSource?.locked ?? false,
          rotationDegrees: replacedSource?.rotationDegrees ?? 0,
          flipX: replacedSource?.flipX ?? false,
          flipY: replacedSource?.flipY ?? false,
        };
      });

      return {
        ...current,
        fillRegions: {},
        sourceImages:
          replaceSourceId && addedSources[0]
            ? current.sourceImages.map((source) => (source.id === replaceSourceId ? addedSources[0] : source))
            : [...current.sourceImages, ...addedSources],
      };
    });
    setNotice({ tone: "info", text: replaceSourceId ? "Updating image..." : "Adding images..." });

    if (!isPersistableProjectId(project.id)) {
      setNotice({ tone: "ok", text: successText });
      setUploadingSources(false);
      setReplacingSourceId(null);
      return true;
    }

    function handleUploadFailure(message: string) {
      if (replaceSourceId) {
        setSettings((current) => {
          const sourceImages = previousSource
            ? current.sourceImages.map((source) => (source.id === replaceSourceId ? previousSource : source))
            : current.sourceImages.filter((source) => !optimisticIds.has(source.id));
          const next = deriveGraphSettings({ ...current, sourceImages });
          settingsRef.current = next;
          return next;
        });
        setNotice({ tone: "error", text: message });
        setUploadingSources(false);
        setReplacingSourceId(null);
        return false;
      }

      setNotice({ tone: "error", text: `${message} The selected image is still available in this editor until refresh.` });
      setUploadingSources(false);
      setReplacingSourceId(null);
      return false;
    }

    const formData = new FormData();
    for (const item of uploadItems) {
      formData.append("files", item.file);
      formData.append("ids", item.id);
    }
    let response: Response;
    try {
      response = await fetch(`/api/projects/${project.id}/source-images`, {
        method: "POST",
        body: formData,
      });
    } catch (error) {
      return handleUploadFailure(error instanceof Error ? error.message : "Unable to upload source images.");
    }

    const payload = (await response.json().catch(() => ({}))) as SourceImagesUploadResponse;
    if (!response.ok) {
      return handleUploadFailure(typeof payload.message === "string" ? payload.message : "Unable to upload source images.");
    }

    const uploadedImages = Array.isArray(payload.images) ? payload.images.filter(isUploadedSourceImage) : [];
    if (uploadedImages.length !== files.length) {
      return handleUploadFailure("Unable to read uploaded source image details.");
    }

    const uploadedById = new Map<string, UploadedSourceImage>(uploadedImages.map((image) => [image.id, image]));
    const nextSettings = deriveGraphSettings({
      ...settingsRef.current,
      sourceImages: settingsRef.current.sourceImages.map((source) => {
        const uploaded = uploadedById.get(source.id);
        return uploaded ? { ...source, name: uploaded.name || source.name, path: uploaded.path || source.path } : source;
      }),
    });
    settingsRef.current = nextSettings;
    setSettings(nextSettings);

    const result = await saveProjectState({
      projectId: project.id,
      title: title.trim(),
      description: description.trim(),
      settings: nextSettings,
      width: processedCanvasRef.current?.width ?? nextSettings.outputWidth,
      height: processedCanvasRef.current?.height ?? nextSettings.outputHeight,
      colorCount: palette.length,
      palettes: palette.map((color, index) => ({ ...color, sortOrder: index })),
    }).catch((error) => ({
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to save source images to the project.",
    }));

    if (result.ok) {
      removeEditorSessionDraft(project.id);
      setHasSessionDraft(false);
      setNotice({ tone: "ok", text: successText });
    } else {
      setNotice({ tone: "error", text: result.message });
    }
    setUploadingSources(false);
    setReplacingSourceId(null);
    return true;
  }

  function selectFullSourceCrop() {
    const sourceCanvas = sourceCanvasRef.current;
    if (!sourceCanvas) return;
    setSourceCropArea(fullCrop(sourceCanvas.width, sourceCanvas.height));
  }

  async function applySourceCrop() {
    const sourceCanvas = sourceCanvasRef.current;
    if (!sourceCanvas || !sourceCropArea) return;

    setSourceCropPending(true);
    try {
      const croppedFile = await cropCanvasToFile(sourceCanvas, sourceCropArea, sourceName, "image/png");
      const ok = primarySource ? await uploadSourceImages([croppedFile], "Source crop applied.", primarySource.id) : false;
      if (ok) {
        setSourceCropMode(false);
        setSourceCropArea(null);
      }
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to crop source file." });
    } finally {
      setSourceCropPending(false);
    }
  }

  async function saveProcessedImage() {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    const blob = await canvasToBlob(canvas);
    const response = await fetch(`/api/projects/${project.id}/processed-image`, {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: blob,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || "Unable to save processed image.");
    }
  }

  function saveSessionDraft(message: string, tone: Notice["tone"] = "ok") {
    try {
      const canvas = processedCanvasRef.current;
      const currentSettings = settingsRef.current;
      const draft = createEditorSessionDraft({
        projectId: project.id,
        title,
        description,
        settings: currentSettings,
        palette,
        width: canvas?.width ?? currentSettings.outputWidth,
        height: canvas?.height ?? currentSettings.outputHeight,
        colorCount: palette.length,
      });
      writeEditorSessionDraft(draft);
      setHasSessionDraft(true);
      setNotice({ tone, text: message });
      return true;
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to save offline draft." });
      return false;
    }
  }

  function saveProject() {
    const canvas = processedCanvasRef.current;
    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    if (!online) {
      setIsOnline(false);
      saveSessionDraft("Offline draft saved in this browser session.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveProjectState({
          projectId: project.id,
          title: title.trim(),
          description: description.trim(),
          settings,
          width: canvas?.width ?? settings.outputWidth,
          height: canvas?.height ?? settings.outputHeight,
          colorCount: palette.length,
          palettes: palette.map((color, index) => ({ ...color, sortOrder: index })),
        });

        if (!result.ok) {
          saveSessionDraft(`Database save failed. A session draft was saved instead. ${result.message}`, "info");
          return;
        }

        await saveProcessedImage();
        removeEditorSessionDraft(project.id);
        setHasSessionDraft(false);
        setNotice({ tone: "ok", text: "Project saved." });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unable to save project.";
        saveSessionDraft(`Could not reach the database. Offline draft saved in this browser session. ${detail}`, "info");
      }
    });
  }

  function exportPNG() {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    void import("@/lib/canvas/exports")
      .then(({ exportCanvasAsPNG }) => exportCanvasAsPNG(canvas, `${filename}.png`))
      .catch((error) => {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to export PNG." });
      });
  }

  function exportPDF() {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    void import("@/lib/canvas/exports")
      .then(({ exportCanvasAsPDF }) => exportCanvasAsPDF(canvas, `${filename}.pdf`, settings))
      .catch((error) => {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to export PDF." });
      });
  }

  function printGraph() {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    void import("@/lib/canvas/exports")
      .then(({ printCanvas }) => {
        printCanvas(canvas, settings, title || "Graph pixel chart");
      })
      .catch((error) => {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to open print view." });
      });
  }

  function exportJSON() {
    void import("@/lib/canvas/exports")
      .then(({ exportSettingsAsJSON }) => {
        exportSettingsAsJSON(`${filename}.json`, settings, palette, {
          projectId: project.id,
          title,
          description,
          sourceName,
          exportedAt: new Date().toISOString(),
        });
      })
      .catch((error) => {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to export JSON." });
      });
  }

  const sourcePanel = (
    <aside className="editor-panel relative space-y-0">
      <div className="flex h-11 items-center justify-between border-b border-[#d7dde5] px-3">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#101828]">
          Sources
        </h2>
        <div className="flex gap-2">
          {sourcePreviewUrl ? (
            sourceCropMode ? (
              <>
                <button
                  type="button"
                  onClick={applySourceCrop}
                  disabled={!sourceCropArea || sourceCropPending}
                  className="ui-btn-icon disabled:opacity-50"
                  title="Apply crop"
                >
                  {sourceCropPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={selectFullSourceCrop}
                  className="ui-btn-icon"
                  title="Full image"
                >
                  <Maximize2 size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceCropMode(false);
                    setSourceCropArea(null);
                  }}
                  className="ui-btn-icon"
                  title="Cancel crop"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSourceCropMode(true);
                  selectFullSourceCrop();
                }}
                className="ui-btn-icon"
                title="Crop source"
              >
                <Crop size={15} aria-hidden="true" />
              </button>
            )
          ) : null}
          <label className={`ui-btn-icon ${uploadingSources ? "cursor-wait opacity-70" : "cursor-pointer"}`} title="Add images">
            {uploadingSources ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              disabled={uploadingSources}
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length) void uploadSourceImages(files);
              }}
            />
          </label>
        </div>
      </div>

      <div className="border-b border-[#d7dde5] bg-white p-3">
        <p className="truncate text-sm font-semibold text-slate-950">{title || "Graph preview"}</p>
        <p className="mt-1 text-xs text-slate-500">
          {settings.sourceImages.length
            ? sourceReady
              ? `${settings.sourceImages.length} source${settings.sourceImages.length === 1 ? "" : "s"} ready`
              : "Loading source files"
            : settings.cellPaints.length || settings.graphShapes.length
              ? `${settings.cellPaints.length + settings.graphShapes.length} drawing layer${settings.cellPaints.length + settings.graphShapes.length === 1 ? "" : "s"}`
              : "Waiting for source files"}
        </p>
      </div>

      {sourceCropMode && sourcePreviewUrl ? (
        <div className="m-3 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--panel)]">
          <ManualCropper imageUrl={sourcePreviewUrl} crop={sourceCropArea} onCropChange={setSourceCropArea} className="h-[min(75vh,42rem)] p-3" />
        </div>
      ) : settings.sourceImages.length || settings.cellPaints.length || settings.graphShapes.length ? (
        <div className="m-3 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--panel)] p-3">
          <canvas ref={overviewCanvasRef} className="max-h-72 w-full rounded bg-white object-contain shadow-sm" style={{ height: "auto" }} />
        </div>
      ) : (
        <div className="m-3 grid min-h-40 place-items-center rounded-md border border-dashed border-slate-300 bg-[var(--panel)] text-center text-sm text-slate-500">
          Upload source files
        </div>
      )}

      {settings.sourceImages.length || settings.cellPaints.length || settings.graphShapes.length ? (
        <div className="space-y-0 border-t border-[#d7dde5]">
          {settings.sourceImages.map((source, index) => {
            const status = sourceStatus[source.id];
            const expanded = Boolean(expandedSourceIds[source.id]);
            const selected = selectedSourceId === source.id;
            const replacing = replacingSourceId === source.id;
            const previousLocked = Boolean(settings.sourceImages[index - 1]?.locked);
            const nextLocked = Boolean(settings.sourceImages[index + 1]?.locked);
            return (
              <div key={source.id} className={`space-y-3 overflow-hidden rounded-md border bg-white p-3 ${selected ? "border-[var(--teal)] ring-2 ring-teal-100" : "border-[var(--line)]"}`}>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSourceId(source.id);
                      setSelectedDrawingLayerId(null);
                      toggleSourceCard(source.id);
                    }}
                    className="grid w-full min-w-0 grid-cols-[1.75rem_3rem_minmax(0,1fr)_auto] items-center gap-2 text-left"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--teal)] text-xs font-bold text-white">{index + 1}</span>
                    {status?.previewUrl ? (
                      <img src={status.previewUrl} alt="" className="h-12 w-12 shrink-0 rounded border border-[var(--line)] bg-[var(--panel)] object-contain p-1" />
                    ) : (
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded border border-[var(--line)] bg-[var(--panel)] text-slate-400">
                        <ImageIcon size={16} aria-hidden="true" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-950">{source.name}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                        {source.locked ? <Lock size={12} aria-hidden="true" /> : <Unlock size={12} aria-hidden="true" />}
                        {status?.ready ? "Ready" : status?.error || "Loading"}
                      </span>
                    </span>
                    {expanded ? <ChevronDown size={15} className="ml-auto shrink-0 text-slate-500" aria-hidden="true" /> : <ChevronRight size={15} className="ml-auto shrink-0 text-slate-500" aria-hidden="true" />}
                  </button>
                  <div className="grid grid-cols-5 gap-1">
                    <button
                      type="button"
                      onClick={() => moveSourceImage(source.id, -1)}
                      disabled={source.locked || previousLocked || index === 0}
                      className="grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      title="Move up"
                    >
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSourceImage(source.id, 1)}
                      disabled={source.locked || nextLocked || index === settings.sourceImages.length - 1}
                      className="grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      title="Move down"
                    >
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSourceLock(source.id)}
                      className="grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50"
                      title={source.locked ? "Unlock image" : "Lock image"}
                    >
                      {source.locked ? <Lock size={14} aria-hidden="true" /> : <Unlock size={14} aria-hidden="true" />}
                    </button>
                    <label
                      className={`grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 ${
                        uploadingSources ? "cursor-wait opacity-40" : "cursor-pointer"
                      }`}
                      title="Replace image and keep current position, size, and transform"
                    >
                      {replacing ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
                      <input
                        type="file"
                        accept={IMAGE_ACCEPT}
                        disabled={uploadingSources}
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          event.target.value = "";
                          if (file) void uploadSourceImages([file], `"${source.name}" replaced.`, source.id);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeSourceImage(source.id)}
                      disabled={source.locked}
                      className="grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      title="Remove source"
                    >
                      {deletingSourceId === source.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                {expanded ? (
                <div className="grid min-w-0 grid-cols-2 gap-2">
                  <NumberField
                    label="Width (CM)"
                    value={sourcePhysicalWidthCm(source)}
                    min={0.01}
                    max={1000}
                    step={0.1}
                    allowDecimalInput
                    disabled={source.locked}
                    onChange={(value) => updateSourceImagePhysicalWidthCm(source.id, value)}
                  />
                  <NumberField
                    label={`Height (${MEASUREMENT_UNIT_LABELS[source.measurementUnit]})`}
                    value={sourcePhysicalHeight(source)}
                    min={0.01}
                    max={roundMeasure(cmToUnit(1000 * settings.cellSizeCm, source.measurementUnit))}
                    step={0.1}
                    allowDecimalInput
                    disabled={source.locked}
                    onChange={(value) => updateSourceImagePhysicalHeight(source.id, value)}
                  />
                  <label className="grid min-w-0 gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">Size unit</span>
                    <select
                      value={source.measurementUnit}
                      onChange={(event) => updateSourceImage(source.id, { measurementUnit: event.target.value as GraphSettings["measurementUnit"] })}
                      className="h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
                    >
                      <option value="cm">CM</option>
                      <option value="in">IN</option>
                    </select>
                  </label>
                  <NumberField
                    label="Line size"
                    value={source.imageLineThickness}
                    min={MIN_IMAGE_LINE_THICKNESS}
                    max={MAX_IMAGE_LINE_THICKNESS}
                    step={0.01}
                    allowDecimalInput
                    onChange={(value) => updateSourceImage(source.id, { imageLineThickness: value })}
                  />
                  <NumberField
                    label="Left padding (cells)"
                    value={source.x}
                    min={-1000}
                    max={1000}
                    step={1}
                    allowDecimalInput
                    wholeStep
                    disabled={source.locked}
                    onChange={(value) => updateSourceImage(source.id, { x: value })}
                  />
                  <NumberField
                    label="Right padding (cells)"
                    value={sourceRightPadding(source)}
                    min={-1000}
                    max={1000}
                    step={1}
                    allowDecimalInput
                    wholeStep
                    disabled={source.locked}
                    onChange={(value) => updateSourceImage(source.id, { x: settings.graphWidth - source.width - value })}
                  />
                  <NumberField
                    label="Top padding (cells)"
                    value={source.y}
                    min={-1000}
                    max={1000}
                    step={1}
                    allowDecimalInput
                    wholeStep
                    disabled={source.locked}
                    onChange={(value) => updateSourceImage(source.id, { y: value })}
                  />
                  <NumberField
                    label="Bottom padding (cells)"
                    value={sourceBottomPadding(source)}
                    min={-1000}
                    max={1000}
                    step={1}
                    allowDecimalInput
                    wholeStep
                    disabled={source.locked}
                    onChange={(value) => updateSourceImage(source.id, { y: settings.graphHeight - source.height - value })}
                  />
                  <NumberField
                    label="Fill detection"
                    value={source.sourceFillThreshold}
                    min={MIN_SOURCE_FILL_THRESHOLD}
                    max={MAX_SOURCE_FILL_THRESHOLD}
                    step={0.01}
                    allowDecimalInput
                    onChange={(value) => updateSourceImage(source.id, { sourceFillThreshold: value })}
                  />
                  <NumberField
                    label="Fill width"
                    value={source.sourceFillMinStrokePixels}
                    min={MIN_SOURCE_FILL_MIN_STROKE_PIXELS}
                    max={MAX_SOURCE_FILL_MIN_STROKE_PIXELS}
                    onChange={(value) => updateSourceImage(source.id, { sourceFillMinStrokePixels: value })}
                  />
                  <NumberField
                    label="Gap closing"
                    value={source.strokeGapClosePixels}
                    min={MIN_STROKE_GAP_CLOSE_PIXELS}
                    max={MAX_STROKE_GAP_CLOSE_PIXELS}
                    onChange={(value) => updateSourceImage(source.id, { strokeGapClosePixels: value })}
                  />
                  <button type="button" onClick={() => rotateSourceImage(source.id, -1)} disabled={source.locked} className="grid h-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Rotate left">
                    <RotateCcw size={15} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => rotateSourceImage(source.id, 1)} disabled={source.locked} className="grid h-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Rotate right">
                    <RotateCw size={15} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => flipSourceImage(source.id, "x")} disabled={source.locked} className="grid h-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Flip horizontal">
                    <FlipHorizontal size={15} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => flipSourceImage(source.id, "y")} disabled={source.locked} className="grid h-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Flip vertical">
                    <FlipVertical size={15} aria-hidden="true" />
                  </button>
                </div>
                ) : null}
              </div>
            );
          })}
          {settings.cellPaints.map((cell, index) => {
            const key = drawingLayerKey("cell", cell.id);
            const expanded = Boolean(expandedDrawingLayerIds[key]);
            const selected = selectedDrawingLayerId === key;
            const previousLocked = Boolean(settings.cellPaints[index - 1]?.locked);
            const nextLocked = Boolean(settings.cellPaints[index + 1]?.locked);
            return (
              <div key={key} className={`space-y-3 overflow-hidden rounded-md border bg-white p-3 ${selected ? "border-[var(--teal)] ring-2 ring-teal-100" : "border-[var(--line)]"}`}>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSourceId(null);
                      setSelectedDrawingLayerId(key);
                      toggleDrawingLayerCard(key);
                    }}
                    className="grid w-full min-w-0 grid-cols-[1.75rem_3rem_minmax(0,1fr)_auto] items-center gap-2 text-left"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-700 text-xs font-bold text-white">{settings.sourceImages.length + index + 1}</span>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded border border-[var(--line)] bg-[var(--panel)] p-1">
                      <span className="h-8 w-8 border-2" style={{ borderColor: cell.lineColor, backgroundColor: isTransparentFillColor(cell.fillColor) ? "transparent" : cell.fillColor }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-950">{cell.name}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                        {cell.locked ? <Lock size={12} aria-hidden="true" /> : <Unlock size={12} aria-hidden="true" />}
                        Painted cell
                      </span>
                    </span>
                    {expanded ? <ChevronDown size={15} className="ml-auto shrink-0 text-slate-500" aria-hidden="true" /> : <ChevronRight size={15} className="ml-auto shrink-0 text-slate-500" aria-hidden="true" />}
                  </button>
                  <div className="grid grid-cols-4 gap-1">
                    <button type="button" onClick={() => moveDrawingLayer("cell", cell.id, -1)} disabled={cell.locked || previousLocked || index === 0} className="grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Move up">
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => moveDrawingLayer("cell", cell.id, 1)} disabled={cell.locked || nextLocked || index === settings.cellPaints.length - 1} className="grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Move down">
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => toggleDrawingLock("cell", cell.id)} className="grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50" title={cell.locked ? "Unlock drawing" : "Lock drawing"}>
                      {cell.locked ? <Lock size={14} aria-hidden="true" /> : <Unlock size={14} aria-hidden="true" />}
                    </button>
                    <button type="button" onClick={() => removeDrawingLayer("cell", cell.id, cell.name, cell.locked)} disabled={cell.locked} className="grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Remove drawing">
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {expanded ? (
                  <div className="grid min-w-0 grid-cols-2 gap-2">
                    <NumberField label="Width (cells)" value={cell.width} min={0.01} max={1000} step={1} allowDecimalInput wholeStep disabled={cell.locked} onChange={(value) => updateCellPaint(cell.id, { width: value })} />
                    <NumberField label="Height (cells)" value={cell.height} min={0.01} max={1000} step={1} allowDecimalInput wholeStep disabled={cell.locked} onChange={(value) => updateCellPaint(cell.id, { height: value })} />
                    <NumberField label="Left padding (cells)" value={cell.x} min={0} max={1000} step={1} allowDecimalInput wholeStep disabled={cell.locked} onChange={(value) => updateCellPaint(cell.id, { x: value })} />
                    <NumberField label="Right padding (cells)" value={drawingRightPadding(cell)} min={-1000} max={1000} step={1} allowDecimalInput wholeStep disabled={cell.locked} onChange={(value) => updateCellPaint(cell.id, { x: settings.graphWidth - cell.width - value })} />
                    <NumberField label="Top padding (cells)" value={cell.y} min={0} max={1000} step={1} allowDecimalInput wholeStep disabled={cell.locked} onChange={(value) => updateCellPaint(cell.id, { y: value })} />
                    <NumberField label="Bottom padding (cells)" value={drawingBottomPadding(cell)} min={-1000} max={1000} step={1} allowDecimalInput wholeStep disabled={cell.locked} onChange={(value) => updateCellPaint(cell.id, { y: settings.graphHeight - cell.height - value })} />
                    <NumberField label="Line size" value={cell.lineWidth} min={1} max={24} disabled={cell.locked} onChange={(value) => updateCellPaint(cell.id, { lineWidth: value })} />
                    <ColorPresetField label="Line" value={cell.lineColor} onChange={(value) => updateCellPaint(cell.id, { lineColor: value })} />
                    <ColorPresetField label="Fill" value={cell.fillColor} onChange={(value) => updateCellPaint(cell.id, { fillColor: value })} allowTransparent />
                    <div className="grid grid-cols-2 gap-1">
                      {CELL_LINE_SIDE_KEYS.map((side) => (
                        <label key={side} className="flex h-9 items-center gap-2 rounded-md border border-[var(--line)] px-2 text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={cell.sides.includes(side)}
                            disabled={cell.locked}
                            onChange={() => updateCellPaint(cell.id, { sides: cell.sides.includes(side) ? cell.sides.filter((item) => item !== side) : [...cell.sides, side] })}
                            className="h-4 w-4 accent-[var(--teal)]"
                          />
                          {CELL_LINE_SIDE_LABELS[side]}
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={() => rotateDrawingLayer("cell", cell.id, -1)} disabled={cell.locked} className="grid h-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Rotate left">
                      <RotateCcw size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => rotateDrawingLayer("cell", cell.id, 1)} disabled={cell.locked} className="grid h-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Rotate right">
                      <RotateCw size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => flipDrawingLayer("cell", cell.id, "x")} disabled={cell.locked} className="grid h-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Flip horizontal">
                      <FlipHorizontal size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => flipDrawingLayer("cell", cell.id, "y")} disabled={cell.locked} className="grid h-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Flip vertical">
                      <FlipVertical size={15} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {settings.graphShapes.map((shape, index) => {
            const key = drawingLayerKey("shape", shape.id);
            const expanded = Boolean(expandedDrawingLayerIds[key]);
            const selected = selectedDrawingLayerId === key;
            const previousLocked = Boolean(settings.graphShapes[index - 1]?.locked);
            const nextLocked = Boolean(settings.graphShapes[index + 1]?.locked);
            return (
              <div key={key} className={`space-y-3 overflow-hidden rounded-md border bg-white p-3 ${selected ? "border-[var(--teal)] ring-2 ring-teal-100" : "border-[var(--line)]"}`}>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSourceId(null);
                      setSelectedDrawingLayerId(key);
                      toggleDrawingLayerCard(key);
                    }}
                    className="grid w-full min-w-0 grid-cols-[1.75rem_3rem_minmax(0,1fr)_auto] items-center gap-2 text-left"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-700 text-xs font-bold text-white">{settings.sourceImages.length + settings.cellPaints.length + index + 1}</span>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded border border-[var(--line)] bg-[var(--panel)] p-1 text-slate-500">
                      <Maximize2 size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-950">{shape.name}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                        {shape.locked ? <Lock size={12} aria-hidden="true" /> : <Unlock size={12} aria-hidden="true" />}
                        {GRAPH_SHAPE_KIND_LABELS[shape.kind]}
                      </span>
                    </span>
                    {expanded ? <ChevronDown size={15} className="ml-auto shrink-0 text-slate-500" aria-hidden="true" /> : <ChevronRight size={15} className="ml-auto shrink-0 text-slate-500" aria-hidden="true" />}
                  </button>
                  <div className="grid grid-cols-4 gap-1">
                    <button type="button" onClick={() => moveDrawingLayer("shape", shape.id, -1)} disabled={shape.locked || previousLocked || index === 0} className="grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Move up">
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => moveDrawingLayer("shape", shape.id, 1)} disabled={shape.locked || nextLocked || index === settings.graphShapes.length - 1} className="grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Move down">
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => toggleDrawingLock("shape", shape.id)} className="grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50" title={shape.locked ? "Unlock drawing" : "Lock drawing"}>
                      {shape.locked ? <Lock size={14} aria-hidden="true" /> : <Unlock size={14} aria-hidden="true" />}
                    </button>
                    <button type="button" onClick={() => removeDrawingLayer("shape", shape.id, shape.name, shape.locked)} disabled={shape.locked} className="grid h-8 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Remove drawing">
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {expanded ? (
                  <div className="grid min-w-0 grid-cols-2 gap-2">
                    <label className="grid min-w-0 gap-1.5">
                      <span className="text-xs font-semibold text-slate-500">Shape</span>
                      <select value={shape.kind} disabled={shape.locked} onChange={(event) => updateGraphShape(shape.id, { kind: event.target.value as GraphShapeKind })} className="h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100 disabled:opacity-60">
                        {GRAPH_SHAPE_KIND_KEYS.map((kind) => (
                          <option key={kind} value={kind}>{GRAPH_SHAPE_KIND_LABELS[kind]}</option>
                        ))}
                      </select>
                    </label>
                    <NumberField label="Line size" value={shape.strokeWidth} min={1} max={24} disabled={shape.locked} onChange={(value) => updateGraphShape(shape.id, { strokeWidth: value })} />
                    <NumberField label="Width (cells)" value={shape.width} min={0.01} max={1000} step={1} allowDecimalInput wholeStep disabled={shape.locked} onChange={(value) => updateGraphShape(shape.id, { width: value })} />
                    <NumberField label="Height (cells)" value={shape.height} min={0.01} max={1000} step={1} allowDecimalInput wholeStep disabled={shape.locked} onChange={(value) => updateGraphShape(shape.id, { height: value })} />
                    <NumberField label="Left padding (cells)" value={shape.x} min={-1000} max={1000} step={1} allowDecimalInput wholeStep disabled={shape.locked} onChange={(value) => updateGraphShape(shape.id, { x: value })} />
                    <NumberField label="Right padding (cells)" value={drawingRightPadding(shape)} min={-1000} max={1000} step={1} allowDecimalInput wholeStep disabled={shape.locked} onChange={(value) => updateGraphShape(shape.id, { x: settings.graphWidth - shape.width - value })} />
                    <NumberField label="Top padding (cells)" value={shape.y} min={-1000} max={1000} step={1} allowDecimalInput wholeStep disabled={shape.locked} onChange={(value) => updateGraphShape(shape.id, { y: value })} />
                    <NumberField label="Bottom padding (cells)" value={drawingBottomPadding(shape)} min={-1000} max={1000} step={1} allowDecimalInput wholeStep disabled={shape.locked} onChange={(value) => updateGraphShape(shape.id, { y: settings.graphHeight - shape.height - value })} />
                    <ColorPresetField label="Line" value={shape.strokeColor} onChange={(value) => updateGraphShape(shape.id, { strokeColor: value })} />
                    <ColorPresetField label="Fill" value={shape.fillColor} onChange={(value) => updateGraphShape(shape.id, { fillColor: value })} allowTransparent />
                    <button type="button" onClick={() => rotateDrawingLayer("shape", shape.id, -1)} disabled={shape.locked} className="grid h-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Rotate left">
                      <RotateCcw size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => rotateDrawingLayer("shape", shape.id, 1)} disabled={shape.locked} className="grid h-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Rotate right">
                      <RotateCw size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => flipDrawingLayer("shape", shape.id, "x")} disabled={shape.locked} className="grid h-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Flip horizontal">
                      <FlipHorizontal size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => flipDrawingLayer("shape", shape.id, "y")} disabled={shape.locked} className="grid h-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-40" title="Flip vertical">
                      <FlipVertical size={15} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <label className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-[var(--panel)] px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 ${uploadingSources ? "cursor-wait opacity-70" : "cursor-pointer"}`}>
        {uploadingSources ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
        {uploadingSources ? "Adding..." : "Add images"}
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          disabled={uploadingSources}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) void uploadSourceImages(files, "Images added to the end.");
          }}
        />
      </label>

      <div className="space-y-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Project name</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-24 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
          />
        </label>
      </div>
      <button
        type="button"
        aria-label="Resize source panel"
        title="Resize source panel"
        onPointerDown={(event) => beginPanelResize(event, "left")}
        onPointerMove={resizePanel}
        onPointerUp={endPanelResize}
        onPointerCancel={endPanelResize}
        className="group absolute inset-y-0 right-0 hidden w-3 cursor-col-resize touch-none place-items-center lg:grid"
      >
        <span className="absolute inset-y-0 right-1.5 w-px bg-slate-200 transition-colors group-hover:bg-[var(--teal)]" aria-hidden="true" />
        <span
          className={`grid h-6 w-6 place-items-center rounded-full border border-[var(--line)] bg-white text-slate-500 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
            resizingPanelSide === "left" ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        >
          <ArrowLeftRight size={13} />
        </span>
      </button>
    </aside>
  );

  const imageWidthCm = roundCm(settings.graphWidth * settings.cellSizeCm);
  const imageHeightCm = roundCm(settings.graphHeight * settings.cellSizeCm);
  const printWidthCm = imageWidthCm;
  const printHeightCm = imageHeightCm;
  const desktopGridColumns =
    sourcePanelCollapsed && settingsPanelCollapsed
      ? "minmax(0,1fr)"
      : sourcePanelCollapsed
        ? `minmax(0,1fr) minmax(${MIN_SIDE_PANEL_WIDTH}px, ${rightPanelWidth}px)`
        : settingsPanelCollapsed
          ? `minmax(${MIN_SIDE_PANEL_WIDTH}px, ${leftPanelWidth}px) minmax(0,1fr)`
          : `minmax(${MIN_SIDE_PANEL_WIDTH}px, ${leftPanelWidth}px) minmax(0,1fr) minmax(${MIN_SIDE_PANEL_WIDTH}px, ${rightPanelWidth}px)`;
  const editorGridStyle = { "--editor-grid-columns": desktopGridColumns } as CSSProperties;
  const floatingFillRegion = floatingPalette ? fillRegionsById.get(floatingPalette.regionId) ?? null : null;
  const floatingFillRegionColor = floatingFillRegion ? currentFillRegionColor(floatingFillRegion) : settings.fillColor;
  const floatingPaletteNode =
    floatingPalette && floatingFillRegion ? (
      <div
        className="fixed z-50 w-[244px] rounded-md border border-[var(--line)] bg-white p-3 shadow-lg"
        style={{ left: floatingPalette.x, top: floatingPalette.y }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-600">
            <Pipette size={14} aria-hidden="true" />
            Fill {floatingFillRegion.id}
          </span>
          <button
            type="button"
            onClick={() => setFloatingPalette(null)}
            className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50"
            title="Close"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {PRESET_GRAPH_COLORS.map((color) => {
            const selected = color.hex.toLowerCase() === floatingFillRegionColor.toLowerCase();
            return (
              <button
                key={`floating-${color.hex}`}
                type="button"
                onClick={() => {
                  updateFillRegionColor(floatingFillRegion.id, color.hex);
                  setFloatingPalette(null);
                }}
                className={`h-7 rounded-sm border ${selected ? "border-slate-950 ring-2 ring-slate-300" : "border-slate-200"}`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
                aria-label={`Apply ${color.name}`}
              />
            );
          })}
          <button
            type="button"
            onClick={() => {
              updateFillRegionColor(floatingFillRegion.id, TRANSPARENT_FILL_COLOR);
              setFloatingPalette(null);
            }}
            className={`h-7 rounded-sm border bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%),linear-gradient(-45deg,#cbd5e1_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#cbd5e1_75%),linear-gradient(-45deg,transparent_75%,#cbd5e1_75%)] bg-[length:10px_10px] bg-[position:0_0,0_5px,5px_-5px,-5px_0] ${isTransparentFillColor(floatingFillRegionColor) ? "border-slate-950 ring-2 ring-slate-300" : "border-slate-200"}`}
            title="Transparent"
            aria-label="Apply transparent"
          />
        </div>
        <label className="mt-3 flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-white px-2 text-xs font-semibold text-slate-600">
          <input
            type="color"
            value={isHexColor(floatingFillRegionColor) ? floatingFillRegionColor : "#ffffff"}
            onChange={(event) => updateFillRegionColor(floatingFillRegion.id, event.target.value)}
            className="h-6 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0"
            aria-label="Custom fill color"
          />
          <span>Custom</span>
        </label>
      </div>
    ) : null;

  const inspectorTabs: { id: InspectorTab; label: string }[] = [
    { id: "graph", label: "Graph" },
    { id: "source", label: "Source" },
    { id: "draw", label: "Draw" },
    { id: "palette", label: "Palette" },
    { id: "print", label: "Print" },
  ];

  const selectedSourceInspector = (
    <div className={inspectorTab === "source" ? "space-y-3" : "hidden"}>
      {selectedSource ? (
        <>
          <div className="ui-panel-subtle p-3">
            <p className="truncate text-sm font-semibold text-slate-950">{selectedSource.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedSource.locked ? "Locked" : "Editable"} / {sourceStatus[selectedSource.id]?.ready ? "Ready" : sourceStatus[selectedSource.id]?.error || "Loading"}
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <NumberField
              label="Width (CM)"
              value={sourcePhysicalWidthCm(selectedSource)}
              min={0.01}
              max={1000}
              step={0.1}
              allowDecimalInput
              disabled={selectedSource.locked}
              onChange={(value) => updateSourceImagePhysicalWidthCm(selectedSource.id, value)}
            />
            <NumberField
              label={`Height (${MEASUREMENT_UNIT_LABELS[selectedSource.measurementUnit]})`}
              value={sourcePhysicalHeight(selectedSource)}
              min={0.01}
              max={roundMeasure(cmToUnit(1000 * settings.cellSizeCm, selectedSource.measurementUnit))}
              step={0.1}
              allowDecimalInput
              disabled={selectedSource.locked}
              onChange={(value) => updateSourceImagePhysicalHeight(selectedSource.id, value)}
            />
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Size unit</span>
              <select
                value={selectedSource.measurementUnit}
                onChange={(event) => updateSourceImage(selectedSource.id, { measurementUnit: event.target.value as GraphSettings["measurementUnit"] })}
                className="h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                <option value="cm">CM</option>
                <option value="in">IN</option>
              </select>
            </label>
            <NumberField
              label="Line size"
              value={selectedSource.imageLineThickness}
              min={MIN_IMAGE_LINE_THICKNESS}
              max={MAX_IMAGE_LINE_THICKNESS}
              step={0.01}
              allowDecimalInput
              onChange={(value) => updateSourceImage(selectedSource.id, { imageLineThickness: value })}
            />
            <NumberField label="Left padding" value={selectedSource.x} min={-1000} max={1000} wholeStep disabled={selectedSource.locked} onChange={(value) => updateSourceImage(selectedSource.id, { x: value })} />
            <NumberField label="Right padding" value={sourceRightPadding(selectedSource)} min={-1000} max={1000} wholeStep disabled={selectedSource.locked} onChange={(value) => updateSourceImage(selectedSource.id, { x: settings.graphWidth - selectedSource.width - value })} />
            <NumberField label="Top padding" value={selectedSource.y} min={-1000} max={1000} wholeStep disabled={selectedSource.locked} onChange={(value) => updateSourceImage(selectedSource.id, { y: value })} />
            <NumberField label="Bottom padding" value={sourceBottomPadding(selectedSource)} min={-1000} max={1000} wholeStep disabled={selectedSource.locked} onChange={(value) => updateSourceImage(selectedSource.id, { y: settings.graphHeight - selectedSource.height - value })} />
            <NumberField label="Fill detection" value={selectedSource.sourceFillThreshold} min={MIN_SOURCE_FILL_THRESHOLD} max={MAX_SOURCE_FILL_THRESHOLD} step={0.01} allowDecimalInput onChange={(value) => updateSourceImage(selectedSource.id, { sourceFillThreshold: value })} />
            <NumberField label="Fill width" value={selectedSource.sourceFillMinStrokePixels} min={MIN_SOURCE_FILL_MIN_STROKE_PIXELS} max={MAX_SOURCE_FILL_MIN_STROKE_PIXELS} onChange={(value) => updateSourceImage(selectedSource.id, { sourceFillMinStrokePixels: value })} />
            <NumberField label="Gap closing" value={selectedSource.strokeGapClosePixels} min={MIN_STROKE_GAP_CLOSE_PIXELS} max={MAX_STROKE_GAP_CLOSE_PIXELS} onChange={(value) => updateSourceImage(selectedSource.id, { strokeGapClosePixels: value })} />
          </div>
          <div className="grid grid-cols-4 gap-1">
            <button type="button" onClick={() => rotateSourceImage(selectedSource.id, -1)} disabled={selectedSource.locked} className="ui-btn-icon w-full" title="Rotate left">
              <RotateCcw size={15} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => rotateSourceImage(selectedSource.id, 1)} disabled={selectedSource.locked} className="ui-btn-icon w-full" title="Rotate right">
              <RotateCw size={15} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => flipSourceImage(selectedSource.id, "x")} disabled={selectedSource.locked} className="ui-btn-icon w-full" title="Flip horizontal">
              <FlipHorizontal size={15} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => flipSourceImage(selectedSource.id, "y")} disabled={selectedSource.locked} className="ui-btn-icon w-full" title="Flip vertical">
              <FlipVertical size={15} aria-hidden="true" />
            </button>
          </div>
        </>
      ) : (
        <div className="ui-panel-subtle grid min-h-32 place-items-center p-4 text-center text-sm text-slate-500">
          Select a source layer to edit its size, padding, transform, and detection settings.
        </div>
      )}
    </div>
  );

  const settingsPanel = (
    <aside className="editor-panel relative space-y-0">
      <div className="flex h-11 items-center justify-between border-b border-[#d7dde5] px-3">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#101828]">
          Inspector
        </h2>
        <button
          type="button"
          onClick={() => {
            setSettingsWithHistory((current) => editorDefaultGraphSettings(current));
            setSelectedFillRegionId(null);
            setFloatingPalette(null);
            setCopiedFillColor(null);
          }}
          className="ui-btn-icon"
          title="Reset settings"
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-5 border-b border-[#d7dde5] bg-white text-[12px]">
        {inspectorTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setInspectorTab(tab.id)}
            className={`h-9 border-r border-[#d7dde5] font-medium ${inspectorTab === tab.id ? "bg-[#008c8f] text-white" : "text-[#344054]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 p-3">
        {selectedSourceInspector}
        <CollapsibleSection
          title={inspectorTab === "print" ? "Print setup" : "Parameters"}
          open={!collapsedSections.parameters}
          onToggle={() => toggleSection("parameters")}
          className={inspectorTab === "graph" || inspectorTab === "print" ? "" : "hidden"}
        >
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <NumberField label="Width (cells)" value={settings.graphWidth} min={1} max={Math.floor(MAX_CANVAS_DIMENSION / GRAPH_MAJOR_CELL_PIXELS)} onChange={(value) => updateSetting("graphWidth", value)} />
            <NumberField label="Height (cells)" value={settings.graphHeight} min={1} max={Math.floor(MAX_CANVAS_DIMENSION / GRAPH_MAJOR_CELL_PIXELS)} onChange={(value) => updateSetting("graphHeight", value)} />
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Size unit</span>
              <select
                value={settings.measurementUnit}
                onChange={(event) => updateMeasurementUnit(event.target.value as GraphSettings["measurementUnit"])}
                className="h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                <option value="cm">CM</option>
                <option value="in">IN</option>
              </select>
            </label>
            <NumberField
              label={`Graph height (${MEASUREMENT_UNIT_LABELS[settings.measurementUnit]})`}
              value={roundMeasure(cmToUnit(settings.graphHeight * settings.cellSizeCm, settings.measurementUnit))}
              min={0.01}
              max={roundMeasure(cmToUnit(Math.floor(MAX_CANVAS_DIMENSION / GRAPH_MAJOR_CELL_PIXELS) * DEFAULT_CELL_SIZE_CM, settings.measurementUnit))}
              step={0.1}
              allowDecimalInput
              onChange={updateGraphPhysicalHeight}
            />
            <NumberField
              label="Image width (CM)"
              value={roundMeasure(settings.imageWidth * settings.cellSizeCm)}
              min={0.01}
              max={roundMeasure(settings.graphWidth * settings.cellSizeCm)}
              step={0.1}
              allowDecimalInput
              onChange={updateImageWidthCm}
            />
            <NumberField
              label={`Image height (${MEASUREMENT_UNIT_LABELS[settings.measurementUnit]})`}
              value={roundMeasure(cmToUnit(settings.imageHeight * settings.cellSizeCm, settings.measurementUnit))}
              min={0.01}
              max={roundMeasure(cmToUnit(settings.graphHeight * settings.cellSizeCm, settings.measurementUnit))}
              step={0.1}
              allowDecimalInput
              onChange={updateImageHeightPhysical}
            />
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Graph lines layer</span>
              <select
                value={settings.gridLineLayer}
                onChange={(event) => updateSetting("gridLineLayer", event.target.value as GraphSettings["gridLineLayer"])}
                className="h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                {GRAPH_LINE_LAYER_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {GRAPH_LINE_LAYER_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-10 min-w-0 items-center gap-2 self-end rounded-md border border-[var(--line)] bg-white px-3 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={settings.showNumbers}
                onChange={(event) => updateSetting("showNumbers", event.target.checked)}
                className="h-4 w-4 accent-[var(--teal)]"
              />
              <span>Show grid numbers</span>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Grid number position</span>
              <select
                value={settings.gridNumberPlacement}
                onChange={(event) => updateSetting("gridNumberPlacement", event.target.value as GraphSettings["gridNumberPlacement"])}
                className="h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                {(["inside", "outside"] as const).map((key) => (
                  <option key={key} value={key}>
                    {GRID_NUMBER_PLACEMENT_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-10 min-w-0 items-center gap-2 self-end rounded-md border border-[var(--line)] bg-white px-3 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={settings.showPageBreaks}
                onChange={(event) => updateSetting("showPageBreaks", event.target.checked)}
                className="h-4 w-4 accent-[var(--teal)]"
              />
              <span>Show page breaks</span>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Print paper</span>
              <select
                value={settings.printPaperSize}
                onChange={(event) => updateSetting("printPaperSize", event.target.value as GraphSettings["printPaperSize"])}
                className="h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                {PRINT_PAPER_SIZE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PRINT_PAPER_SIZES[key].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Orientation</span>
              <select
                value={settings.printOrientation}
                onChange={(event) => updateSetting("printOrientation", event.target.value as GraphSettings["printOrientation"])}
                className="h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                {PRINT_ORIENTATION_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PRINT_ORIENTATION_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Horizontal align</span>
              <select
                value={settings.printHorizontalAlignment}
                onChange={(event) => updateSetting("printHorizontalAlignment", event.target.value as GraphSettings["printHorizontalAlignment"])}
                className="h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                {PRINT_HORIZONTAL_ALIGNMENT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PRINT_HORIZONTAL_ALIGNMENT_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Vertical align</span>
              <select
                value={settings.printVerticalAlignment}
                onChange={(event) => updateSetting("printVerticalAlignment", event.target.value as GraphSettings["printVerticalAlignment"])}
                className="h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                {PRINT_VERTICAL_ALIGNMENT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PRINT_VERTICAL_ALIGNMENT_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="min-w-0 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="break-words font-mono text-xs text-slate-600">
              Graph {imageWidthCm} x {imageHeightCm} cm / Print {printWidthCm} x {printHeightCm} cm / 1 cell {settings.cellSizeCm} cm / artwork {settings.imageWidth} x {settings.imageHeight} cells / {GRAPH_LINE_LAYER_LABELS[settings.gridLineLayer].toLowerCase()} grid / {settings.showNumbers ? `${GRID_NUMBER_PLACEMENT_LABELS[settings.gridNumberPlacement].toLowerCase()} numbers` : "numbers off"} / {settings.showPageBreaks ? "page breaks on" : "page breaks off"} / {PRINT_HORIZONTAL_ALIGNMENT_LABELS[settings.printHorizontalAlignment].toLowerCase()} {PRINT_VERTICAL_ALIGNMENT_LABELS[settings.printVerticalAlignment].toLowerCase()}
            </p>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Drawing"
          summary={<span className="text-xs font-semibold text-slate-500">{settings.cellPaints.length + settings.graphShapes.length}</span>}
          open={!collapsedSections.drawing}
          onToggle={() => toggleSection("drawing")}
          className={inspectorTab === "draw" ? "" : "hidden"}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(["image", "cell", "shape"] as DrawingTool[]).map((tool) => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => setDrawingTool(tool)}
                  className={`h-9 rounded-md border text-xs font-semibold capitalize ${
                    drawingTool === tool ? "border-[var(--teal)] bg-teal-50 text-[var(--teal)]" : "border-[var(--line)] text-slate-600"
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>

            <div className="rounded-md border border-[var(--line)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Cell borders</span>
                <button type="button" onClick={setAllCellPaintSides} className="h-8 rounded-md border border-[var(--line)] px-2 text-xs font-semibold text-slate-600">
                  All
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CELL_LINE_SIDE_KEYS.map((side) => (
                  <label key={side} className="flex h-9 items-center gap-2 rounded-md border border-[var(--line)] px-2 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={cellPaintSides.includes(side)}
                      onChange={() => toggleCellPaintSide(side)}
                      className="h-4 w-4 accent-[var(--teal)]"
                    />
                    {CELL_LINE_SIDE_LABELS[side]}
                  </label>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="flex h-9 items-center gap-2 rounded-md border border-[var(--line)] px-2 text-xs font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={cellPaintLineEnabled}
                    onChange={(event) => setCellPaintLineEnabled(event.target.checked)}
                    className="h-4 w-4 accent-[var(--teal)]"
                  />
                  Line
                </label>
                <label className="flex h-9 items-center gap-2 rounded-md border border-[var(--line)] px-2 text-xs font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={cellPaintFillEnabled}
                    onChange={(event) => setCellPaintFillEnabled(event.target.checked)}
                    className="h-4 w-4 accent-[var(--teal)]"
                  />
                  Fill
                </label>
              </div>
            </div>

            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Shape</span>
              <select
                value={shapeKind}
                onChange={(event) => {
                  setShapeKind(event.target.value as GraphShapeKind);
                  setDrawingTool("shape");
                }}
                className="h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                {GRAPH_SHAPE_KIND_KEYS.map((kind) => (
                  <option key={kind} value={kind}>
                    {GRAPH_SHAPE_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={clearCellPaints} className="h-9 rounded-md border border-[var(--line)] text-xs font-semibold text-slate-600">
                Clear cells
              </button>
              <button type="button" onClick={clearGraphShapes} className="h-9 rounded-md border border-[var(--line)] text-xs font-semibold text-slate-600">
                Clear shapes
              </button>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Outline" summary={<ColorSummary value={settings.outlineColor} />} open={!collapsedSections.outline} onToggle={() => toggleSection("outline")} className={inspectorTab === "palette" ? "" : "hidden"}>
          <ColorPresetField label="Outline" value={settings.outlineColor} onChange={updateOutlineColor} />
        </CollapsibleSection>

        <CollapsibleSection title="Default fill" summary={<ColorSummary value={settings.fillColor} />} open={!collapsedSections.fill} onToggle={() => toggleSection("fill")} className={inspectorTab === "palette" ? "" : "hidden"}>
          <ColorPresetField label="Default fill" value={settings.fillColor} onChange={(value) => updateSetting("fillColor", value)} allowTransparent />
        </CollapsibleSection>

        {selectedFillRegion ? (
          <CollapsibleSection title={`Selected fill ${selectedFillRegion.id}`} summary={<ColorSummary value={selectedFillRegionColor} />} open={!collapsedSections.selectedFill} onToggle={() => toggleSection("selectedFill")} className={inspectorTab === "palette" ? "" : "hidden"}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500">{selectedFillRegion.kind === "source" ? "Source fill" : "Manual fill"}</span>
              <button
                type="button"
                onClick={() => resetFillRegionColor(selectedFillRegion.id)}
                className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] bg-white text-slate-600 hover:bg-slate-50"
                title="Use default fill"
              >
                <RefreshCw size={14} aria-hidden="true" />
              </button>
            </div>
            <ColorPresetField
              label="Section fill"
              value={selectedFillRegionColor}
              onChange={(value) => updateFillRegionColor(selectedFillRegion.id, value)}
              allowTransparent
            />
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection title="Graph lines" summary={<ColorSummary value={settings.gridLineColor} />} open={!collapsedSections.graphLines} onToggle={() => toggleSection("graphLines")} className={inspectorTab === "palette" ? "" : "hidden"}>
          <ColorPresetField
            label="Graph lines"
            value={settings.gridLineColor}
            colors={PRESET_GRAPH_LINE_COLORS}
            onChange={(value) => updateSetting("gridLineColor", value)}
          />
        </CollapsibleSection>
      </div>
      <button
        type="button"
        aria-label="Resize controls panel"
        title="Resize controls panel"
        onPointerDown={(event) => beginPanelResize(event, "right")}
        onPointerMove={resizePanel}
        onPointerUp={endPanelResize}
        onPointerCancel={endPanelResize}
        className="group absolute inset-y-0 left-0 hidden w-3 cursor-col-resize touch-none place-items-center lg:grid"
      >
        <span className="absolute inset-y-0 left-1.5 w-px bg-slate-200 transition-colors group-hover:bg-[var(--teal)]" aria-hidden="true" />
        <span
          className={`grid h-6 w-6 place-items-center rounded-full border border-[var(--line)] bg-white text-slate-500 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
            resizingPanelSide === "right" ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        >
          <ArrowLeftRight size={13} />
        </span>
      </button>
    </aside>
  );

  const graphPreviewWidth = Math.max(1, previewCanvasSize.width * zoom);
  const graphPreviewHeight = Math.max(1, previewCanvasSize.height * zoom);
  const outsideNumberMargin = settings.showNumbers && settings.gridNumberPlacement === "outside" ? 34 : 0;
  const outsideHorizontalLabels = settings.showNumbers && settings.gridNumberPlacement === "outside" ? cellNumberLabels(settings.graphWidth) : [];
  const outsideVerticalLabels = settings.showNumbers && settings.gridNumberPlacement === "outside" ? cellNumberLabels(settings.graphHeight) : [];
  const paperForPreview = PRINT_PAPER_SIZES[settings.printPaperSize] ?? PRINT_PAPER_SIZES[DEFAULT_PRINT_PAPER_SIZE];
  const printPreviewPlan = createPdfExportPlan({
    settings,
    paper: paperForPreview,
    canvasWidth: previewCanvasSize.width,
    canvasHeight: previewCanvasSize.height,
  });
  const pageBreakGuideY = settings.showPageBreaks
    ? Array.from(new Set(printPreviewPlan.tiles.filter((tile) => tile.tileX === 0 && tile.tileY > 0).map((tile) => tile.sourceY))).sort((a, b) => a - b)
    : [];
  const pageBreakGuideX = settings.showPageBreaks
    ? Array.from(new Set(printPreviewPlan.tiles.filter((tile) => tile.tileY === 0 && tile.tileX > 0).map((tile) => tile.sourceX))).sort((a, b) => a - b)
    : [];
  useEffect(() => {
    const scroller = canvasScrollRef.current;
    const stage = graphStageRef.current;
    if (!scroller || !stage) return;

    let frame = 0;
    const updateGuide = () => {
      frame = 0;
      const nextGuide = {
        left: scroller.scrollLeft - stage.offsetLeft,
        top: scroller.scrollTop - stage.offsetTop,
        width: Math.max(1, scroller.clientWidth),
        height: Math.max(1, scroller.clientHeight),
      };
      setCanvasViewportGuide((current) =>
        current.left === nextGuide.left &&
        current.top === nextGuide.top &&
        current.width === nextGuide.width &&
        current.height === nextGuide.height
          ? current
          : nextGuide,
      );
    };
    const scheduleGuideUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateGuide);
    };

    updateGuide();
    scroller.addEventListener("scroll", scheduleGuideUpdate, { passive: true });
    window.addEventListener("resize", scheduleGuideUpdate);
    const resizeObserver = new ResizeObserver(scheduleGuideUpdate);
    resizeObserver.observe(scroller);
    resizeObserver.observe(stage);

    return () => {
      scroller.removeEventListener("scroll", scheduleGuideUpdate);
      window.removeEventListener("resize", scheduleGuideUpdate);
      resizeObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [
    graphPreviewHeight,
    graphPreviewWidth,
    leftPanelWidth,
    outsideNumberMargin,
    rightPanelWidth,
    settingsPanelCollapsed,
    sourcePanelCollapsed,
    zoom,
  ]);
  const pageBreakGuideWidth = Math.max(1, canvasViewportGuide.width);
  const pageBreakGuideHeight = Math.max(1, canvasViewportGuide.height);
  const selectedSourceBox =
    selectedSourceLayout && !showOriginal
      ? {
          left: Math.round(outsideNumberMargin + (selectedSourceLayout.x * GRAPH_MAJOR_CELL_PIXELS + settings.imageOffsetX) * zoom),
          top: Math.round(outsideNumberMargin + (selectedSourceLayout.y * GRAPH_MAJOR_CELL_PIXELS + settings.imageOffsetY) * zoom),
          width: Math.max(1, Math.round(selectedSourceLayout.width * GRAPH_MAJOR_CELL_PIXELS * zoom)),
          height: Math.max(1, Math.round(selectedSourceLayout.height * GRAPH_MAJOR_CELL_PIXELS * zoom)),
        }
      : null;
  const canvasToolItems = [
    { label: "Select", Icon: MousePointer2 },
    { label: "Pan", Icon: Hand },
    { label: "Pencil", Icon: Pipette },
    { label: "Fill", Icon: Crop },
    { label: "Zoom", Icon: ZoomIn },
  ];

  const canvasPanel = (
    <section className="editor-canvas-panel grid min-h-0 grid-rows-[40px_minmax(0,1fr)_36px]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d7dde5] bg-white px-3">
          <div className="min-w-0">
            <h1 className="text-[13px] font-bold uppercase tracking-wide text-[#101828]">Canvas</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSourcePanelCollapsed((value) => !value)}
              className="hidden h-9 w-9 place-items-center rounded-md border border-[var(--line)] bg-white text-slate-600 hover:bg-slate-50 lg:grid"
              title={sourcePanelCollapsed ? "Show source panel" : "Hide source panel"}
            >
              {sourcePanelCollapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => setSettingsPanelCollapsed((value) => !value)}
              className="hidden h-9 w-9 place-items-center rounded-md border border-[var(--line)] bg-white text-slate-600 hover:bg-slate-50 lg:grid"
              title={settingsPanelCollapsed ? "Show controls panel" : "Hide controls panel"}
            >
              {settingsPanelCollapsed ? <PanelRightOpen size={16} aria-hidden="true" /> : <PanelRightClose size={16} aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => setShowOriginal((value) => !value)} className="ui-btn-icon" title={showOriginal ? "Show processed" : "Show original"}>
              {showOriginal ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => setZoom((value) => Math.max(0.35, value - 0.15))} className="ui-btn-icon" title="Zoom out">
              <ZoomOut size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setZoom((value) => Math.min(2.5, value + 0.15))} className="ui-btn-icon" title="Zoom in">
              <ZoomIn size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={saveProject}
              disabled={isPending || processing || !title.trim()}
              title={!isOnline ? "Save an offline session draft" : hasSessionDraft ? "Sync session draft to the database" : "Save project"}
              className="hidden"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              Save
            </button>
          </div>
        </div>

        <div
          ref={canvasScrollRef}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedSourceId(null);
              setSelectedDrawingLayerId(null);
            }
          }}
          className="ui-canvas-bg relative min-h-0 overflow-auto p-8"
        >
          {notice ? (
            <p className={`absolute left-24 top-3 z-20 max-w-[min(560px,calc(100%-8rem))] rounded-md border px-3 py-2 text-sm shadow-sm ${
              notice.tone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : notice.tone === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600"
            }`}>
              {notice.text}
            </p>
          ) : null}
          <div className="absolute left-2 top-12 z-10 hidden w-16 overflow-hidden rounded-md border border-[#d7dde5] bg-white shadow-sm lg:block">
            {canvasToolItems.map(({ label, Icon }, index) => (
              <button key={label} type="button" className={`flex h-16 w-full flex-col items-center justify-center gap-1 border-b border-[#e8edf2] text-[12px] ${index === 0 ? "bg-[#e6f7f7] text-[#008c8f]" : "text-[#344054]"}`}>
                <Icon size={20} strokeWidth={1.8} />
                {label}
              </button>
            ))}
          </div>
          {processing ? (
            <div className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Processing
            </div>
          ) : null}
          {showOriginal && sourcePreviewUrl ? (
            <img src={sourcePreviewUrl} alt="" className="block rounded bg-white object-contain shadow-sm" style={{ width: `${graphPreviewWidth}px`, height: "auto" }} />
          ) : (
            <div
              ref={graphStageRef}
              className="relative mx-auto"
              style={{
                width: `${graphPreviewWidth + outsideNumberMargin * 2}px`,
                height: `${graphPreviewHeight + outsideNumberMargin * 2}px`,
              }}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedSourceId(null);
                  setSelectedDrawingLayerId(null);
                }
              }}
            >
              <canvas
                ref={previewCanvasRef}
                onPointerDown={beginGraphDrag}
                onPointerMove={dragGraph}
                onPointerUp={endGraphDrag}
                onPointerCancel={endGraphDrag}
                title="Drag image to move it; arrow keys move selected image by 0.1cm; Space or Ctrl plus drag pans the view"
                className="absolute left-0 top-0 rounded bg-white shadow-sm"
                style={{
                  left: `${outsideNumberMargin}px`,
                  top: `${outsideNumberMargin}px`,
                  width: `${graphPreviewWidth}px`,
                  height: `${graphPreviewHeight}px`,
                  cursor: isDraggingGraph ? "grabbing" : copiedFillColor ? "copy" : "crosshair",
                  imageRendering: "auto",
                  touchAction: "none",
                }}
              />
              {settings.showNumbers && settings.gridNumberPlacement === "outside" ? (
                <div className="pointer-events-none absolute inset-0 text-[11px] font-semibold text-slate-500">
                  {outsideHorizontalLabels.map((value) => {
                    const x = outsideNumberMargin + (value - 0.5) * GRAPH_MAJOR_CELL_PIXELS * zoom;
                    return (
                      <span key={`top-${value}`} className="absolute -translate-x-1/2" style={{ left: x, top: 6 }}>
                        {value}
                      </span>
                    );
                  })}
                  {outsideHorizontalLabels.map((value) => {
                    const x = outsideNumberMargin + (value - 0.5) * GRAPH_MAJOR_CELL_PIXELS * zoom;
                    return (
                      <span key={`bottom-${value}`} className="absolute -translate-x-1/2" style={{ left: x, top: outsideNumberMargin + graphPreviewHeight + 8 }}>
                        {value}
                      </span>
                    );
                  })}
                  {outsideVerticalLabels.map((value) => {
                    const y = outsideNumberMargin + (value - 0.45) * GRAPH_MAJOR_CELL_PIXELS * zoom;
                    return (
                      <span key={`left-${value}`} className="absolute -translate-y-1/2" style={{ left: 8, top: y }}>
                        {value}
                      </span>
                    );
                  })}
                  {outsideVerticalLabels.map((value) => {
                    const y = outsideNumberMargin + (value - 0.45) * GRAPH_MAJOR_CELL_PIXELS * zoom;
                    return (
                      <span key={`right-${value}`} className="absolute -translate-y-1/2" style={{ left: outsideNumberMargin + graphPreviewWidth + 10, top: y }}>
                        {value}
                      </span>
                    );
                  })}
                </div>
              ) : null}
              {settings.showPageBreaks ? (
                <div className="pointer-events-none absolute inset-0">
                  {pageBreakGuideY.map((sourceY, index) => (
                    <div
                      key={`page-y-${sourceY}`}
                      className="absolute border-t-2 border-dotted border-slate-700/70"
                      style={{
                        left: canvasViewportGuide.left,
                        top: outsideNumberMargin + sourceY * zoom,
                        width: pageBreakGuideWidth,
                      }}
                    >
                      <span className="absolute right-2 -top-5 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm">
                        Page {index + 2}
                      </span>
                    </div>
                  ))}
                  {pageBreakGuideX.map((sourceX, index) => (
                    <div
                      key={`page-x-${sourceX}`}
                      className="absolute border-l-2 border-dotted border-slate-700/70"
                      style={{
                        height: pageBreakGuideHeight,
                        left: outsideNumberMargin + sourceX * zoom,
                        top: canvasViewportGuide.top,
                      }}
                    >
                      <span className="absolute left-1 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm">
                        Page {index + 2}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {selectedSourceBox && selectedSourceLayout ? (
                <div
                  className="pointer-events-none absolute border border-teal-700/75 bg-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
                  style={selectedSourceBox}
                >
                  {SOURCE_RESIZE_HANDLES.map((handle) => (
                    <button
                      key={handle}
                      type="button"
                      aria-label={`Resize ${handle}`}
                      disabled={selectedSource?.locked}
                      onPointerDown={(event) => beginSourceResize(event, selectedSourceLayout, handle)}
                      onPointerMove={dragGraph}
                      onPointerUp={endGraphDrag}
                      onPointerCancel={endGraphDrag}
                      className={sourceResizeHandleClass(handle, selectedSource?.locked)}
                    >
                      <span className={sourceResizeHandleIconClass(handle)}>{sourceResizeHandleIcon(handle)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      <div className="flex items-center gap-8 border-t border-[#d7dde5] bg-white px-4 text-xs text-[#475467]">
        <span>X: 37</span>
        <span>Y: 112</span>
        <span>Cell: 0,0</span>
        <span className="flex items-center gap-2">Color: #000000 <span className="h-4 w-4 bg-black" /></span>
        <span className="ml-auto rounded bg-[#008c8f] px-3 py-2 text-white">Snap: On</span>
      </div>
    </section>
  );

  return (
    <div className="editor-dark-shell">
      <header className="editor-dark-toolbar">
        <div className="flex min-w-max items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-3 pr-3 text-white" aria-label="Back to dashboard">
            <LogoMark className="h-9 w-9 shrink-0" />
            <span className="text-lg font-semibold">Graph Pixel Maker</span>
          </Link>
          <span className="h-8 w-px bg-white/16" aria-hidden="true" />
          <button type="button" className="editor-dark-btn w-10 px-0" title="Menu">
            <Menu size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => restoreSettingsHistory("undo")} className="editor-dark-btn w-10 px-0" title="Undo">
            <Undo2 size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => restoreSettingsHistory("redo")} className="editor-dark-btn w-10 px-0" title="Redo">
            <Redo2 size={18} aria-hidden="true" />
          </button>
          <button type="button" className="editor-dark-btn border-[#008c8f] bg-[#10242d] text-[#6fe7ea]" title="Pan">
            <Hand size={18} aria-hidden="true" />
          </button>
          <button type="button" className="editor-dark-btn border-[#008c8f] bg-[#10242d] text-[#6fe7ea]" title="Select">
            <MousePointer2 size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setShowOriginal((value) => !value)} className="editor-dark-btn" title={showOriginal ? "Show processed" : "Show original"}>
            {showOriginal ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            <span>Show Original</span>
          </button>
          <button type="button" onClick={() => updateSetting("showNumbers", !settings.showNumbers)} className="editor-dark-btn" title="Toggle graph numbers">
            <Grid3X3 size={17} aria-hidden="true" />
            <span>Grid</span>
          </button>
          <div className="flex h-9 items-center overflow-hidden rounded-[5px] border border-[#334152] bg-[#141d27]">
            <button type="button" onClick={() => setZoom((value) => Math.max(0.35, value - 0.15))} className="grid h-9 w-10 place-items-center text-white/80" title="Zoom out">
              <ZoomOut size={16} aria-hidden="true" />
            </button>
            <span className="border-x border-[#334152] px-4 text-sm font-semibold">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(2.5, value + 0.15))} className="grid h-9 w-10 place-items-center text-white/80" title="Zoom in">
              <ZoomIn size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex min-w-max items-center gap-2">
          <button
            type="button"
            onClick={saveProject}
            disabled={isPending || processing || !title.trim()}
            className="editor-dark-btn border-[#00a3a7] bg-[#00969a] text-white disabled:opacity-60"
            title={!isOnline ? "Save an offline session draft" : hasSessionDraft ? "Sync session draft to the database" : "Save project"}
          >
            {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            Save
          </button>
          <button type="button" onClick={exportPNG} className="editor-dark-btn" title="Export menu">
            <Download size={16} aria-hidden="true" />
            Export
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          <button type="button" onClick={exportPNG} className="editor-dark-btn" title="Export PNG">
            <ImageDown size={16} aria-hidden="true" />
            PNG
          </button>
          <button type="button" onClick={exportPDF} className="editor-dark-btn" title="Export PDF">
            <FileText size={16} aria-hidden="true" />
            PDF
          </button>
          <button type="button" onClick={printGraph} className="editor-dark-btn" title="Print">
            <Printer size={16} aria-hidden="true" />
            Print
          </button>
          <button type="button" onClick={exportJSON} className="editor-dark-btn" title="Export JSON">
            <FileJson size={16} aria-hidden="true" />
            JSON
          </button>
          <button type="button" className="editor-dark-btn w-10 px-0" title="More">
            <MoreVertical size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="editor-workspace" style={editorGridStyle}>
        <div className={`${mobileTab === "source" ? "block" : "hidden"} ${sourcePanelCollapsed ? "lg:hidden" : "lg:block"}`}>{sourcePanel}</div>
        <div className={mobileTab === "canvas" ? "block" : "hidden lg:block"}>{canvasPanel}</div>
        <div className={`${mobileTab === "controls" ? "block" : "hidden"} ${settingsPanelCollapsed ? "lg:hidden" : "lg:block"}`}>{settingsPanel}</div>
      </div>

      <div className="grid h-16 grid-cols-3 border-t border-[#d7dde5] bg-white lg:hidden">
        {[
          ["source", "Source"],
          ["canvas", "Canvas"],
          ["controls", "Controls"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMobileTab(value as MobileTab)}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-semibold ${mobileTab === value ? "text-[#008c8f]" : "text-[#344054]"}`}
          >
            {value === "source" ? <ImageIcon size={20} aria-hidden="true" /> : value === "canvas" ? <Grid3X3 size={20} aria-hidden="true" /> : <Settings2 size={20} aria-hidden="true" />}
            {label}
          </button>
        ))}
      </div>

      <div className={`flex h-9 shrink-0 items-center gap-3 px-4 text-xs text-white ${isOnline ? "bg-[#008c8f]" : "bg-[#594407]"}`}>
        <span className="font-semibold">{isOnline ? "Online save" : "Offline draft"}</span>
        <span className="ml-auto">{hasSessionDraft ? "Changes saved locally" : isOnline ? "Database sync ready" : "Changes will sync when online."}</span>
        <Check size={16} aria-hidden="true" />
      </div>
      {floatingPaletteNode}
    </div>
  );
}
