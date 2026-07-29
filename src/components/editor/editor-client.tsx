"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type SVGProps } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileJson,
  FileText,
  Copy,
  Crop,
  Eraser,
  ImageDown,
  ImageIcon,
  FlipHorizontal,
  FlipVertical,
  Group,
  GripVertical,
  Hand,
  Keyboard,
  Layers3,
  Lock,
  Loader2,
  Maximize2,
  MousePointer2,
  MoveDiagonal2,
  MoveHorizontal,
  MoveVertical,
  Pipette,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Scissors,
  Settings2,
  Sparkles,
  SquarePen,
  Trash2,
  Ungroup,
  Unlock,
  X,
} from "lucide-react";
import { saveProjectState } from "@/app/(app)/projects/actions";
import { fullCrop, quickCropWithin, transformedImageSize, type CropPixels, type QuickCropSegment } from "@/lib/canvas/crop";
import { createPdfExportPlan } from "@/lib/canvas/pdf-layout";
import { QuickCropControls } from "@/components/projects/quick-crop-controls";
import {
  copyFillRegionOverrides,
  fillRegionLayerScope,
  isStoredFillRegionId,
  migrateLegacyFillRegionOverrides,
  removeFillRegionOverridesForScopes,
} from "@/lib/canvas/fill-region-identity";
import { reconcileFillRegionOverrides } from "@/lib/canvas/fill-region-reconciliation";
import { MAX_WORKING_SOURCE_PIXELS, clampGraphCellDimensions } from "@/lib/canvas/performance-limits";
import { detectPreviewPolicy, workingImagePixelCap } from "@/lib/canvas/preview-policy";
import { disposeCanvasProcessingWorker, pixelateLayeredImagesWithWorker } from "@/lib/canvas/processor-worker-client";
import { clearCanvasProcessingCaches, findContentBounds, flattenGraphForOutput, loadImageToCanvas, resizeImage, type FillRegion } from "@/lib/canvas/processor";
import { GraphGridOverlay } from "@/components/editor/graph-grid-overlay";
import { removeBackgroundImageData } from "@/lib/canvas/background-removal";
import {
  clipGraphPolygonToPlacedContent,
  graphBrushIntersectsPlacedContent,
  graphPixelToSourcePixel,
  graphPolygonIntersectsPlacedContent,
  isGraphPixelWithinPlacedContent,
  sourcePixelRadiusForGraphBrush,
  type ContentBounds,
  type PlacementTransform,
} from "@/lib/editor/erase-geometry";
import { ALLOWED_IMAGE_LABEL, IMAGE_ACCEPT, MAX_PROJECT_UPLOAD_FILES, MAX_SOURCE_IMAGES, MAX_UPLOAD_BYTES, isAllowedImageFile, isPdfFile } from "@/lib/constants";
import {
  CARD_THUMBNAIL_MAX_EDGE,
  SOURCE_THUMBNAIL_MAX_EDGE,
  createThumbnailBlob,
  uploadWithThumbnail,
  type PresignedUpload,
} from "@/lib/storage/upload-client";
import {
  createEditorSessionDraft,
  hasEditorSessionDraft,
  readEditorSessionDraft,
  removeEditorSessionDraft,
  writeEditorSessionDraft,
} from "@/lib/editor/session-draft";
import {
  applySettingsHistoryCommand,
  boundSettingsHistory,
  createSettingsHistoryCommand,
  type SettingsHistoryCommand,
} from "@/lib/editor/history";
import {
  ROTATION_STEP_DEGREES,
  normalizeRotationDegrees,
  flipLayerBoxInBounds,
  reorderSourceImages,
  rotateLayerBoxInBounds,
  sourceAssetCacheKey,
  sourceLayouts,
  sourceProcessingCacheKey,
  sourceRenderOrder,
  sourceVectorizerCacheKey,
  scaleLayerBoxToBounds,
  snapRectToLayerGuides,
  snapCellToGrid,
  stackEndCell,
  transformLayerOrientation,
  type LayerSnapBox,
  type LayerSnapGuide,
  type SourceLayout,
} from "@/lib/editor/source-layout";
import {
  alignLineEndpointToCellAxis,
  hasIntentionalDrag,
  measureGeneratedOpenPathHit,
  oneCellBoundsAtGraphPoint,
  type GeneratedOpenPathHitResult,
} from "@/lib/editor/drawing-geometry";
import {
  DEFAULT_BACKGROUND_TOLERANCE,
  MAX_BACKGROUND_TOLERANCE,
  MAX_POLYGON_UV_OVERSHOOT,
  MIN_BACKGROUND_TOLERANCE,
  backgroundRemovalSignature,
  clampBackgroundTolerance,
  eraseStrokesSignature,
  normalizeBackgroundRemoval,
  normalizeEraseStrokes,
  normalizeGroupId,
  normalizeLayerGroups,
} from "@/lib/editor/layer-extras";
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
  DEFAULT_VECTORIZER_SKETCH_REMOVAL,
  DEFAULT_VECTORIZER_FIDELITY,
  GRAPH_GRID_LINE_STYLE_KEYS,
  GRAPH_MAJOR_CELL_PIXELS,
  GRAPH_VECTORIZER_FIDELITY_KEYS,
  MAX_VECTORIZER_INK_THRESHOLD,
  MAX_VECTORIZER_SKETCH_REMOVAL,
  MAX_VECTORIZER_LINE_ADJUST,
  MIN_VECTORIZER_INK_THRESHOLD,
  MIN_VECTORIZER_SKETCH_REMOVAL,
  MIN_VECTORIZER_LINE_ADJUST,
  PRESET_GRAPH_COLORS,
  PRINT_PAPER_SIZES,
  TRANSPARENT_FILL_COLOR,
  clampImageLineThickness,
  clampSourceFillMinStrokePixels,
  clampSourceFillThreshold,
  clampStrokeGapClosePixels,
  clampVectorizerInkThreshold,
  clampVectorizerSketchRemoval,
  clampVectorizerLineAdjust,
  clampVectorizerStrokeWidth,
  normalizeGraphImageTraceEngine,
  normalizeCanvasColor,
  normalizeCanvasFillColor,
  normalizeGraphLineColor,
  isGraphGridLineStyle,
  isGraphGridPattern,
  isGraphImageColorQuantization,
  isGraphImageDenoiseLevel,
  isGraphImageEdgeDetection,
  isGraphVectorizerFidelity,
  isGraphLineLayer,
  isFillColor,
  isCanvasColor,
  isHexColor,
  isMajorGridEvery,
  isPrintHorizontalAlignment,
  isPrintOrientation,
  isPrintPaperSize,
  isPrintVerticalAlignment,
  isTransparentFillColor,
} from "@/lib/graph-paper";
import type { CanvasColor, CanvasFillColor, GraphGridLineStyle } from "@/lib/graph-paper";
import type { GraphBackgroundRemoval, GraphCellLineSide, GraphCellPaint, GraphClipartAsset, GraphClipartImage, GraphEraseBrushShape, GraphEraseRegionFill, GraphEraseStroke, GraphLayerGroup, GraphSettings, GraphShapeDrawing, GraphShapeKind, GraphSourceImage, PaletteColor, Project } from "@/lib/types";
import { createDebouncedAction } from "@/lib/utils/debounce";
import { bytesToSize } from "@/lib/utils/format";
import { estimateCanvasBytes, startGraphPerformanceStage } from "@/lib/performance/marks";
import {
  ACTIVE_COMMAND_CANVAS_POD_IDS,
  COMMAND_CANVAS_DESKTOP_SAFE_INSETS,
  COMMAND_CANVAS_LAYOUT_STORAGE_KEY,
  COMMAND_CANVAS_POD_IDS,
  clampCommandCanvasPodPosition,
  clampCommandCanvasPodSize,
  createDefaultCommandCanvasLayout,
  deserializeCommandCanvasLayout,
  detectCommandCanvasDockSnap,
  placeCommandCanvasPod,
  quantizeCommandCanvasCoordinate,
  resolveCommandCanvasPodPlacement,
  serializeCommandCanvasLayout,
  type CommandCanvasCommand,
  type CommandCanvasLayout,
  type CommandCanvasPoint,
  type PodDock,
  type PodId,
} from "@/lib/editor/command-canvas";
import { InspectorPanel, type SelectionConsoleModel } from "./inspector-panel";
import {
  CommandCanvasCommandPalette,
  CommandCanvasCompactViewTrigger,
  CommandCanvasNavigator,
  CommandCanvasPod,
  CommandCanvasSelectionStrip,
  EditorCanvasLoader,
  EditorCommandBar,
  EditorNavigatorStatus,
  EditorStatusBar,
  EditorToolRail,
  type CommandCanvasResizeEdge,
  type EditorToolId,
} from "./editor-chrome";
import { InspectorFieldGrid, InspectorMetricGrid } from "./inspector-controls";
import { ColorPresetField, InspectorDisclosure, NumberField, ShapePreviewSvg } from "./inspector/inspector-fields";
import {
  CELL_LINE_SIDE_KEYS,
  CELL_LINE_SIDE_LABELS,
  CLIPART_ACCEPT,
  GENERATED_SHAPE_KIND_KEYS,
  GRAPH_SHAPE_KIND_KEYS,
  GRAPH_SHAPE_KIND_LABELS,
  MAX_CANVAS_DIMENSION,
  type GeneratedShapeKind,
  type ShapeFillMode,
} from "./inspector/inspector-constants";

type MobileTab = "source" | "tools" | "canvas" | "view" | "controls" | "export";
type EditorLeftPanelTab = "layers" | "library";
type InspectorTab = "graph" | "source" | "draw" | "palette";
type DrawTab = "shape" | "clipart";
type Notice = { tone: "ok" | "error" | "info"; text: string };
type CollapsibleKey = "parameters" | "drawing" | "outline" | "fill" | "selectedFill" | "graphLines";
type FloatingPalette = { regionId: string; x: number; y: number } | null;
type DrawingTool = "image" | "line" | "shape" | "background-remover" | "image-eraser" | "lasso";
type ClosedGeneratedShapeKind = Exclude<GeneratedShapeKind, "line" | "arrow">;

/** A vertex of an in-progress lasso region, in graph cell coordinates. */
type LassoVertex = { x: number; y: number };
type CanvasTool = "pointer" | "hand" | "fill";
type DrawingLayerKey = `cell:${string}` | `shape:${string}` | `clipart:${string}`;
type LayerKind = "source" | "cell" | "shape" | "clipart";
type SelectableLayerKey = `source:${string}` | DrawingLayerKey;
type ResizeHandleTarget = "source" | "shape" | "selection" | null;
type FillRegionPointerEvent = ReactPointerEvent<HTMLCanvasElement> | ReactMouseEvent<HTMLCanvasElement>;
type ImageEraserCursor = { x: number; y: number; radius: number } | null;

type LayerChoice = {
  key: SelectableLayerKey;
  type: "source" | "shape" | "clipart";
  id: string;
  name: string;
  detail: string;
};
type LayerChooser = {
  x: number;
  y: number;
  choices: LayerChoice[];
} | null;
type CommandCanvasPodDrag = {
  podId: PodId;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
  element: HTMLElement;
  point: CommandCanvasPoint;
  snapDock: Exclude<PodDock, "floating"> | null;
};
type CommandCanvasPodResize = {
  podId: PodId;
  edge: Extract<CommandCanvasResizeEdge, "bottom-left" | "bottom-right">;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startWidth: number;
  startHeight: number;
  element: HTMLElement;
  size: {
    width: number;
    height: number;
  };
};
type LayerHit =
  (
    | (LayerChoice & { type: "source"; layout: SourceLayout })
    | (LayerChoice & { type: "shape"; shape: GraphShapeDrawing })
    | (LayerChoice & { type: "clipart"; clipart: GraphClipartImage })
  ) & {
    openPathHit?: GeneratedOpenPathHitResult;
  };
type SourceStatus = {
  ready: boolean;
  previewUrl: string | null;
  error: string | null;
};
type SettingsHistory = {
  undo: SettingsHistoryCommand<GraphSettings>[];
  redo: SettingsHistoryCommand<GraphSettings>[];
};
type CanvasPinchState = {
  distance: number;
  centerX: number;
  centerY: number;
  zoom: number;
  panX: number;
  panY: number;
};
const SOURCE_RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type SourceResizeHandle = (typeof SOURCE_RESIZE_HANDLES)[number];
const CANVAS_SELECTION_BOX_CLASS =
  "command-canvas-selection-frame pointer-events-none absolute z-20 rounded-[2px] border-2 border-cyan-300 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(2,6,23,0.92),0_0_0_3px_rgba(255,255,255,0.82),0_0_14px_rgba(34,211,238,0.48)]";
const SELECT_POINTER_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='24'%20height='24'%20viewBox='0%200%2024%2024'%3E%3Cpath%20d='M5.5%204.8%2018.4%2010.3c.78.34.75%201.46-.04%201.77l-5.32%202.08a1.45%201.45%200%200%200-.81.81l-2.04%205.13c-.32.81-1.47.81-1.78-.01L5.5%204.8Z'%20fill='%23ffffff'%20stroke='%23000000'%20stroke-width='1.4'%20stroke-linecap='round'%20stroke-linejoin='round'/%3E%3C/svg%3E\") 6 5, default";
type ImageEraseTarget = {
  sourceId: string;
  bounds: ContentBounds;
  placement: PlacementTransform;
  canvasWidth: number;
  canvasHeight: number;
  lastPoint?: { x: number; y: number };
  startsNewStroke: boolean;
};
type DragState = {
  kind: "viewport" | "pan" | "source" | "shape" | "clipart" | "resize-source" | "resize-shape" | "resize-selection" | "cell-paint" | "shape-draw" | "image-erase";
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
  startPanX?: number;
  startPanY?: number;
  canvasWidth: number;
  canvasHeight: number;
  rectWidth: number;
  rectHeight: number;
  moved: boolean;
  historyRecorded: boolean;
  interactionStarted?: boolean;
  startGraphX?: number;
  startGraphY?: number;
  shapeId?: string;
  startShapeX?: number;
  startShapeY?: number;
  startShapeWidth?: number;
  startShapeHeight?: number;
  clipartId?: string;
  startClipartX?: number;
  startClipartY?: number;
  layerStarts?: Map<SelectableLayerKey, LayerSnapBox>;
  selectionBounds?: LayerSnapBox;
  eraseTargets?: Map<string, ImageEraseTarget>;
};
type UploadedSourceImage = {
  id: string;
  name: string;
  path: string;
  url?: string | null;
  thumbPath?: string | null;
  thumbUrl?: string | null;
};
type SourceImagesUploadResponse = {
  images?: unknown;
  message?: unknown;
};
type UploadedClipartAsset = {
  id: string;
  name: string;
  path: string;
  url?: string | null;
  thumbPath?: string | null;
  thumbUrl?: string | null;
  mimeType: string;
  createdAt: string;
};
type ClipartUploadResponse = {
  assets?: unknown;
  message?: unknown;
};
const ManualCropper = dynamic(() => import("@/components/projects/manual-cropper").then((module) => module.ManualCropper), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-64 place-items-center text-sm font-semibold text-[var(--editor-text-dim)]">
      Preparing crop
    </div>
  ),
});

const MAX_SETTINGS_HISTORY = 80;
const EDITOR_PREVIEW_POLICY = detectPreviewPolicy();
const MAX_SETTINGS_HISTORY_ESTIMATED_BYTES = EDITOR_PREVIEW_POLICY.historyBytes;
const COMMAND_CANVAS_POD_MIN_SIZES: Record<PodId, { width: number; height: number }> = {
  tools: { width: 56, height: 300 },
  scene: { width: 260, height: 220 },
  selection: { width: 260, height: 176 },
  navigator: { width: 260, height: 88 },
  focus: { width: 340, height: 340 },
};
const COMMAND_CANVAS_POD_DEFAULT_SIZES: Record<PodId, { width: number; height: number }> = {
  tools: { width: 68, height: 500 },
  scene: { width: 400, height: 860 },
  selection: { width: 296, height: 176 },
  navigator: { width: 356, height: 116 },
  focus: { width: 430, height: 730 },
};
const COMMAND_CANVAS_POD_MAX_SIZES: Record<PodId, { width: number; height: number }> = {
  tools: { width: 320, height: 720 },
  scene: { width: 560, height: 760 },
  selection: { width: 560, height: 420 },
  navigator: { width: 560, height: 116 },
  focus: { width: 720, height: 900 },
};
const COMMAND_CANVAS_VIEWPORT_HEIGHT_PODS = new Set<PodId>(["scene", "focus"]);
const ACTIVE_COMMAND_CANVAS_PODS = new Set<PodId>(ACTIVE_COMMAND_CANVAS_POD_IDS);
const PREVIEW_PROCESSING_DEBOUNCE_MS = 250;
const DRAG_PROCESSING_IDLE_DEBOUNCE_MS = 300;
const DRAG_PROCESSING_MAX_WAIT_MS = 1000;
const COPY_OFFSET_CELLS = 0.5;
const MAX_CLIPART_UPLOAD_BYTES = 6 * 1024 * 1024;
const CM_PER_INCH = 2.54;
const EDITOR_TEMPLATE_OPTIONS = [
  { id: "cross-stitch", label: "Cross-stitch" },
  { id: "pixel-art", label: "Pixel art" },
  { id: "dot-grid", label: "Dot grid" },
  { id: "a4-tiled", label: "A4 tiled print" },
] as const;
type EditorTemplateId = (typeof EDITOR_TEMPLATE_OPTIONS)[number]["id"];

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

function logProcessingTiming(label: string, startedAt: number) {
  if (process.env.NODE_ENV !== "development") return;
  const durationMs = performance.now() - startedAt;
  console.info(`[graph-pixel] ${label}: ${durationMs.toFixed(1)}ms`);
}

function buildProcessingSignature(settings: GraphSettings) {
  return [
    settings.graphWidth,
    settings.graphHeight,
    settings.imageWidth,
    settings.imageHeight,
    settings.imageOffsetX ?? 0,
    settings.imageOffsetY ?? 0,
    settings.backgroundColor,
    settings.outlineColor,
    settings.fillColor,
    settings.imageLineThickness,
    settings.sourceFillThreshold,
    settings.sourceFillMinStrokePixels,
    settings.strokeGapClosePixels,
    settings.imageAutoEnhance,
    settings.imageDenoiseLevel,
    settings.imageEdgeDetection,
    settings.imageColorQuantization,
    settings.imageTraceEngine,
    settings.vectorizerStrokeWidth,
    settings.vectorizerStrokeColor,
    settings.vectorizerLineAdjust,
    settings.vectorizerInkThreshold,

    settings.vectorizerSketchRemoval,
    settings.vectorizerFidelity,
    settings.gridLineColor,
    settings.gridLineLayer,
    settings.gridLineStyle,
    settings.gridPattern,
    settings.gridLineThickness,
    settings.showBorder,
    settings.transparentBackground,
    settings.showNumbers,
    settings.gridNumberPlacement,
    settings.majorGridEvery,
    Object.entries(settings.fillRegions)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, color]) => `${id}:${color}`)
      .join("|"),
    settings.sourceImages
      .map(
        (source) =>
          `${source.id}:${source.x}:${source.y}:${source.width}:${source.height}:${source.topPadding}:${source.bottomPadding}:${source.rotationDegrees}:${source.flipX}:${source.flipY}:${source.locked}:${source.visible}:${source.imageLineThickness}:${source.sourceFillThreshold}:${source.sourceFillMinStrokePixels}:${source.strokeGapClosePixels}:${source.imageAutoEnhance}:${source.imageDenoiseLevel}:${source.imageEdgeDetection}:${source.imageColorQuantization}:${source.vectorizerLineAdjust}:${source.vectorizerInkThreshold}:${source.vectorizerSketchRemoval}:${source.vectorizerFidelity}:${eraseStrokesSignature(source.eraseStrokes)}:${backgroundRemovalSignature(source.backgroundRemoval)}`,
      )
      .join("|"),
    settings.cellPaints.map((paint) => `${paint.id}:${paint.x}:${paint.y}:${paint.width}:${paint.height}:${paint.sides.join(",")}:${paint.lineColor}:${paint.fillColor}:${paint.lineWidth}:${paint.rotationDegrees}:${paint.flipX}:${paint.flipY}:${paint.visible}`).join("|"),
    settings.graphShapes.map((shape) => `${shape.id}:${shape.kind}:${shape.x}:${shape.y}:${shape.width}:${shape.height}:${shape.strokeColor}:${shape.fillColor}:${shape.strokeWidth}:${shape.strokeStyle ?? "solid"}:${shape.sides.join(",")}:${shape.rotationDegrees}:${shape.flipX}:${shape.flipY}:${shape.visible}`).join("|"),
    settings.clipartAssets.map((asset) => `${asset.id}:${asset.path ?? ""}:${asset.url ?? ""}:${asset.dataUrl ?? ""}`).join("|"),
    settings.clipartImages.map((clipart) => `${clipart.id}:${clipart.assetId}:${clipart.x}:${clipart.y}:${clipart.width}:${clipart.height}:${clipart.strokeColor}:${clipart.fillColor}:${clipart.imageLineThickness}:${clipart.sourceFillThreshold}:${clipart.sourceFillMinStrokePixels}:${clipart.strokeGapClosePixels}:${clipart.imageAutoEnhance}:${clipart.imageDenoiseLevel}:${clipart.imageEdgeDetection}:${clipart.imageColorQuantization}:${clipart.vectorizerLineAdjust}:${clipart.vectorizerInkThreshold}:${clipart.vectorizerSketchRemoval}:${clipart.vectorizerFidelity}:${clipart.rotationDegrees}:${clipart.flipX}:${clipart.flipY}:${clipart.visible}:${eraseStrokesSignature(clipart.eraseStrokes)}:${backgroundRemovalSignature(clipart.backgroundRemoval)}`).join("|"),
  ].join("|");
}

function isUploadedSourceImage(value: unknown): value is UploadedSourceImage {
  if (!value || typeof value !== "object") return false;
  const image = value as Record<string, unknown>;
  return typeof image.id === "string" && typeof image.name === "string" && typeof image.path === "string";
}

function isUploadedClipartAsset(value: unknown): value is UploadedClipartAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Record<string, unknown>;
  return (
    typeof asset.id === "string" &&
    typeof asset.name === "string" &&
    typeof asset.path === "string" &&
    typeof asset.mimeType === "string" &&
    typeof asset.createdAt === "string"
  );
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

function fitCanvasToWorkingPixelBudget(canvas: HTMLCanvasElement, itemCount: number) {
  // Split the active image-cache budget across all source-layer slots. The cap
  // also leaves headroom for per-layer erase/background-removal derivatives.
  const workingPixelCap = workingImagePixelCap(EDITOR_PREVIEW_POLICY, itemCount, MAX_WORKING_SOURCE_PIXELS);
  const pixels = canvas.width * canvas.height;
  if (pixels <= workingPixelCap) return canvas;
  const scale = Math.sqrt(workingPixelCap / pixels);
  return resizeImage(canvas, Math.max(1, Math.floor(canvas.width * scale)), Math.max(1, Math.floor(canvas.height * scale)));
}

type SourceAssetGroup = {
  key: string;
  sources: GraphSourceImage[];
};

function groupSourcesByAsset(sources: GraphSourceImage[]): SourceAssetGroup[] {
  const groups = new Map<string, SourceAssetGroup>();
  for (const source of sources) {
    const key = sourceAssetCacheKey(source);
    const group = groups.get(key);
    if (group) group.sources.push(source);
    else groups.set(key, { key, sources: [source] });
  }
  return Array.from(groups.values());
}

function revokeObjectUrls(urls: Iterable<string>) {
  for (const url of new Set(urls)) URL.revokeObjectURL(url);
}

function clampImageOffset(value: number) {
  return Math.max(-MAX_CANVAS_DIMENSION, Math.min(MAX_CANVAS_DIMENSION, Math.round(value)));
}

function isDrawableCanvas(canvas: HTMLCanvasElement | null | undefined): canvas is HTMLCanvasElement {
  return Boolean(canvas && Number.isFinite(canvas.width) && Number.isFinite(canvas.height) && canvas.width > 0 && canvas.height > 0);
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
    | "measurementUnit"
    | "imageLineThickness"
    | "sourceFillThreshold"
    | "sourceFillMinStrokePixels"
    | "strokeGapClosePixels"
    | "vectorizerLineAdjust"
    | "vectorizerInkThreshold"

    | "vectorizerSketchRemoval"
    | "vectorizerFidelity"
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
      const imageAutoEnhance = normalizeImageAutoEnhance(source.imageAutoEnhance);
      const imageDenoiseLevel = normalizeImageDenoiseLevel(source.imageDenoiseLevel);
      const imageEdgeDetection = normalizeImageEdgeDetection(source.imageEdgeDetection);
      const imageColorQuantization = normalizeImageColorQuantization(source.imageColorQuantization);
      const vectorizerLineAdjust = clampVectorizerLineAdjust(source.vectorizerLineAdjust ?? defaults.vectorizerLineAdjust);
      const vectorizerInkThreshold = clampVectorizerInkThreshold(source.vectorizerInkThreshold ?? defaults.vectorizerInkThreshold);

      const vectorizerSketchRemoval = clampVectorizerSketchRemoval(source.vectorizerSketchRemoval ?? defaults.vectorizerSketchRemoval);
      const vectorizerFidelity = normalizeVectorizerFidelity(source.vectorizerFidelity ?? defaults.vectorizerFidelity);
      const x = clampSourceX(source.x, graphWidth, width);
      const topPadding = clampPaddingCells(source.topPadding, graphHeight, 0);
      const bottomPadding = clampPaddingCells(source.bottomPadding, graphHeight, 0);
      const y = clampFreeCellCoordinate(source.y, legacyY + topPadding);
      legacyY = y + height + bottomPadding;
      const locked = Boolean(source.locked);
      const visible = typeof source.visible === "boolean" ? source.visible : true;
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
          imageAutoEnhance,
          imageDenoiseLevel,
          imageEdgeDetection,
          imageColorQuantization,
          vectorizerLineAdjust,
          vectorizerInkThreshold,

          vectorizerSketchRemoval,
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
          groupId: normalizeGroupId(source.groupId),
          eraseStrokes: normalizeEraseStrokes(source.eraseStrokes),
          backgroundRemoval: normalizeBackgroundRemoval(source.backgroundRemoval),
        },
      ];
    })
    .slice(0, MAX_SOURCE_IMAGES);
}

function normalizeFillRegions(value: GraphSettings["fillRegions"] | undefined) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([regionId]) => isStoredFillRegionId(regionId))
      .map(([regionId, color]) => [regionId, normalizeCanvasFillColor(color)]),
  );
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
      const lineColor = normalizeCanvasColor(paint.lineColor);
      const fillColor = normalizeCanvasFillColor(paint.fillColor);
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
        visible: typeof paint.visible === "boolean" ? paint.visible : true,
        rotationDegrees: normalizeRotationDegrees(paint.rotationDegrees),
        flipX: Boolean(paint.flipX),
        flipY: Boolean(paint.flipY),
        groupId: normalizeGroupId(paint.groupId),
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
      const sides = Array.from(new Set((Array.isArray(shape.sides) ? shape.sides : CELL_LINE_SIDE_KEYS).filter((side): side is GraphCellLineSide => CELL_LINE_SIDE_KEYS.includes(side as GraphCellLineSide))));
      return [
        {
          id: shape.id || `shape-${index + 1}`,
          name: shape.name || `${kind[0].toUpperCase()}${kind.slice(1)} ${index + 1}`,
          kind,
          x: clampFreeCellCoordinate(shape.x, 0),
          y: clampFreeCellCoordinate(shape.y, 0),
          width: clampFreeCellCoordinate(shape.width, kind === "line" || kind === "arrow" ? 2 : 1),
          height: clampFreeCellCoordinate(shape.height, kind === "line" || kind === "arrow" ? 0 : 1),
          strokeColor: normalizeCanvasColor(shape.strokeColor),
          fillColor: normalizeCanvasFillColor(shape.fillColor),
          strokeWidth: Math.max(1, Math.min(24, Math.round(Number(shape.strokeWidth) || 3))),
          strokeStyle: isGraphGridLineStyle(shape.strokeStyle) ? shape.strokeStyle : DEFAULT_GRID_LINE_STYLE,
          sides: sides.length ? sides : [...CELL_LINE_SIDE_KEYS],
          locked: Boolean(shape.locked),
          visible: typeof shape.visible === "boolean" ? shape.visible : true,
          rotationDegrees: normalizeRotationDegrees(shape.rotationDegrees),
          flipX: Boolean(shape.flipX),
          flipY: Boolean(shape.flipY),
          groupId: normalizeGroupId(shape.groupId),
        },
      ];
    })
    .slice(0, 500);
}

function normalizeClipartAssetsForEditor(value: GraphSettings["clipartAssets"] | undefined): GraphSettings["clipartAssets"] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((asset, index) => {
      if (!asset || typeof asset !== "object") return [];
      const id = typeof asset.id === "string" && asset.id.trim() ? asset.id.trim() : `clipart-${index + 1}`;
      const path = typeof asset.path === "string" && asset.path.trim() ? asset.path : null;
      const url = typeof asset.url === "string" && asset.url.trim() ? asset.url : null;
      const dataUrl = typeof asset.dataUrl === "string" && asset.dataUrl.startsWith("data:image/") ? asset.dataUrl : null;
      if (!path && !url && !dataUrl) return [];
      return [
        {
          id,
          name: typeof asset.name === "string" && asset.name.trim() ? asset.name.trim() : `Clipart ${index + 1}`,
          path,
          url,
          dataUrl,
          mimeType: typeof asset.mimeType === "string" && asset.mimeType.trim() ? asset.mimeType.trim() : "image/png",
          width: Math.max(1, Math.round(Number(asset.width) || 1)),
          height: Math.max(1, Math.round(Number(asset.height) || 1)),
          createdAt: typeof asset.createdAt === "string" && !Number.isNaN(Date.parse(asset.createdAt)) ? asset.createdAt : new Date().toISOString(),
        },
      ];
    })
    .slice(0, 120);
}

function normalizeClipartImagesForEditor(
  value: GraphSettings["clipartImages"] | undefined,
  assetIds: Set<string>,
  defaults: Pick<
    GraphSettings,
    | "imageLineThickness"
    | "sourceFillThreshold"
    | "sourceFillMinStrokePixels"
    | "strokeGapClosePixels"
    | "vectorizerLineAdjust"
    | "vectorizerInkThreshold"

    | "vectorizerSketchRemoval"
    | "vectorizerFidelity"
  >,
): GraphSettings["clipartImages"] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((clipart, index) => {
      if (!clipart || typeof clipart !== "object") return [];
      const assetId = typeof clipart.assetId === "string" && clipart.assetId.trim() ? clipart.assetId.trim() : "";
      if (!assetId || !assetIds.has(assetId)) return [];
      return [
        {
          id: clipart.id || `clipart-image-${index + 1}`,
          name: clipart.name || `Clipart image ${index + 1}`,
          assetId,
          x: clampFreeCellCoordinate(clipart.x, 0),
          y: clampFreeCellCoordinate(clipart.y, 0),
          width: clampSourceSizeCells(clipart.width, 4),
          height: clampSourceSizeCells(clipart.height, 4),
          strokeColor: normalizeCanvasColor(clipart.strokeColor),
          fillColor: normalizeCanvasFillColor(clipart.fillColor),
          imageLineThickness: clampImageLineThickness(clipart.imageLineThickness ?? defaults.imageLineThickness),
          sourceFillThreshold: clampSourceFillThreshold(clipart.sourceFillThreshold ?? defaults.sourceFillThreshold),
          sourceFillMinStrokePixels: clampSourceFillMinStrokePixels(clipart.sourceFillMinStrokePixels ?? defaults.sourceFillMinStrokePixels),
          strokeGapClosePixels: clampStrokeGapClosePixels(clipart.strokeGapClosePixels ?? defaults.strokeGapClosePixels),
          imageAutoEnhance: normalizeImageAutoEnhance(clipart.imageAutoEnhance),
          imageDenoiseLevel: normalizeImageDenoiseLevel(clipart.imageDenoiseLevel),
          imageEdgeDetection: normalizeImageEdgeDetection(clipart.imageEdgeDetection),
          imageColorQuantization: normalizeImageColorQuantization(clipart.imageColorQuantization),
          vectorizerLineAdjust: clampVectorizerLineAdjust(clipart.vectorizerLineAdjust ?? defaults.vectorizerLineAdjust),
          vectorizerInkThreshold: clampVectorizerInkThreshold(clipart.vectorizerInkThreshold ?? defaults.vectorizerInkThreshold),

          vectorizerSketchRemoval: clampVectorizerSketchRemoval(clipart.vectorizerSketchRemoval ?? defaults.vectorizerSketchRemoval),
          vectorizerFidelity: normalizeVectorizerFidelity(clipart.vectorizerFidelity ?? defaults.vectorizerFidelity),
          locked: Boolean(clipart.locked),
          visible: typeof clipart.visible === "boolean" ? clipart.visible : true,
          rotationDegrees: normalizeRotationDegrees(clipart.rotationDegrees),
          flipX: Boolean(clipart.flipX),
          flipY: Boolean(clipart.flipY),
          groupId: normalizeGroupId(clipart.groupId),
          eraseStrokes: normalizeEraseStrokes(clipart.eraseStrokes),
          backgroundRemoval: normalizeBackgroundRemoval(clipart.backgroundRemoval),
        },
      ];
    })
    .slice(0, 500);
}

function sourceResizeHandleClass(handle: SourceResizeHandle, locked: boolean | undefined, visible: boolean) {
  const base = `absolute grid place-items-center text-[var(--editor-text-dim)] transition-[opacity,color] duration-150 ${
    visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
  } ${
    locked ? "opacity-40" : "hover:text-[var(--editor-text)]"
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
  const base = "grid h-5 w-5 place-items-center rounded-md border border-[var(--editor-line)] bg-[var(--editor-panel)] shadow-[0_2px_5px_var(--editor-shadow)] transition-transform hover:scale-110";
  if (handle === "n" || handle === "s") return `${base} h-5 w-7`;
  if (handle === "e" || handle === "w") return `${base} h-7 w-5`;
  return base;
}

function sourceResizeHandleIcon(handle: SourceResizeHandle) {
  if (handle === "n" || handle === "s") return <MoveVertical size={14} strokeWidth={2.25} aria-hidden="true" />;
  if (handle === "e" || handle === "w") return <MoveHorizontal size={14} strokeWidth={2.25} aria-hidden="true" />;
  return <MoveDiagonal2 size={13} strokeWidth={2.25} className={handle === "ne" || handle === "sw" ? "rotate-90" : undefined} aria-hidden="true" />;
}

function SelectPointerIcon({ size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5.5 4.8 18.4 10.3c.78.34.75 1.46-.04 1.77l-5.32 2.08a1.45 1.45 0 0 0-.81.81l-2.04 5.13c-.32.81-1.47.81-1.78-.01L5.5 4.8Z" />
    </svg>
  );
}

function cellNumberLabels(cellCount: number) {
  const count = Math.max(1, Math.round(cellCount || 1));
  return Array.from({ length: count }, (_, index) => index + 1);
}

function deriveGraphSettings(settings: GraphSettings): GraphSettings {
  const safeGraphDimensions = clampGraphCellDimensions(settings.graphWidth, settings.graphHeight, GRAPH_MAJOR_CELL_PIXELS);
  const graphWidth = safeGraphDimensions.width;
  const graphHeight = safeGraphDimensions.height;
  const backgroundColor = normalizeCanvasColor(settings.backgroundColor, DEFAULT_BACKGROUND_COLOR);
  const outlineColor = normalizeCanvasColor(
    isHexColor(settings.outlineColor) ? settings.outlineColor : settings.lineColor,
    DEFAULT_OUTLINE_COLOR,
  );
  const fillColor = normalizeCanvasFillColor(settings.fillColor);
  const imageLineThickness = clampImageLineThickness(settings.imageLineThickness ?? DEFAULT_IMAGE_LINE_THICKNESS);
  const sourceFillThreshold = clampSourceFillThreshold(settings.sourceFillThreshold ?? DEFAULT_SOURCE_FILL_THRESHOLD);
  const sourceFillMinStrokePixels = clampSourceFillMinStrokePixels(settings.sourceFillMinStrokePixels ?? DEFAULT_SOURCE_FILL_MIN_STROKE_PIXELS);
  const strokeGapClosePixels = clampStrokeGapClosePixels(settings.strokeGapClosePixels ?? DEFAULT_STROKE_GAP_CLOSE_PIXELS);
  const imageAutoEnhance = normalizeImageAutoEnhance(settings.imageAutoEnhance);
  const imageDenoiseLevel = normalizeImageDenoiseLevel(settings.imageDenoiseLevel);
  const imageEdgeDetection = normalizeImageEdgeDetection(settings.imageEdgeDetection);
  const imageColorQuantization = normalizeImageColorQuantization(settings.imageColorQuantization);
  const imageTraceEngine = normalizeGraphImageTraceEngine(settings.imageTraceEngine);
  const vectorizerStrokeWidth = clampVectorizerStrokeWidth(settings.vectorizerStrokeWidth);
  const vectorizerStrokeColor = normalizeCanvasColor(settings.vectorizerStrokeColor, outlineColor);
  const vectorizerLineAdjust = clampVectorizerLineAdjust(settings.vectorizerLineAdjust);
  const vectorizerInkThreshold = clampVectorizerInkThreshold(settings.vectorizerInkThreshold);

  const vectorizerSketchRemoval = clampVectorizerSketchRemoval(settings.vectorizerSketchRemoval);
  const vectorizerFidelity = normalizeVectorizerFidelity(settings.vectorizerFidelity);
  const gridLineColor = normalizeGraphLineColor(settings.gridLineColor, DEFAULT_GRID_LINE_COLOR);
  const gridLineLayer = isGraphLineLayer(settings.gridLineLayer) ? settings.gridLineLayer : DEFAULT_GRAPH_LINE_LAYER;
  const gridLineStyle = isGraphGridLineStyle(settings.gridLineStyle) ? settings.gridLineStyle : DEFAULT_GRID_LINE_STYLE;
  const gridPattern = isGraphGridPattern(settings.gridPattern) ? settings.gridPattern : DEFAULT_GRID_PATTERN;
  const showNumbers = typeof settings.showNumbers === "boolean" ? settings.showNumbers : true;
  const gridNumberPlacement = settings.gridNumberPlacement === "inside" ? "inside" : "outside";
  const showPageBreaks = typeof settings.showPageBreaks === "boolean" ? settings.showPageBreaks : true;
  const majorGridEvery = isMajorGridEvery(settings.majorGridEvery) ? settings.majorGridEvery : DEFAULT_MAJOR_GRID_EVERY;
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
    vectorizerLineAdjust,
    vectorizerInkThreshold,

    vectorizerSketchRemoval,
    vectorizerFidelity,
  });
  const imagePadding = 0;
  const outputWidth = graphWidth * GRAPH_MAJOR_CELL_PIXELS;
  const outputHeight = graphHeight * GRAPH_MAJOR_CELL_PIXELS;
  const fillRegions = normalizeFillRegions(settings.fillRegions);
  const cellPaints = normalizeCellPaints(settings.cellPaints);
  const graphShapes = normalizeGraphShapes(settings.graphShapes);
  const clipartAssets = normalizeClipartAssetsForEditor(settings.clipartAssets);
  const clipartImages = normalizeClipartImagesForEditor(settings.clipartImages, new Set(clipartAssets.map((asset) => asset.id)), {
    imageLineThickness,
    sourceFillThreshold,
    sourceFillMinStrokePixels,
    strokeGapClosePixels,
    vectorizerLineAdjust,
    vectorizerInkThreshold,

    vectorizerSketchRemoval,
    vectorizerFidelity,
  });

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
    backgroundColor,
    lineColor: outlineColor,
    outlineColor,
    fillColor,
    fillRegions,
    cellPaints,
    graphShapes,
    clipartAssets,
    clipartImages,
    layerGroups: normalizeLayerGroups(settings.layerGroups),
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

    vectorizerSketchRemoval,
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
    imageOffsetX: clampImageOffset(settings.imageOffsetX ?? 0),
    imageOffsetY: clampImageOffset(settings.imageOffsetY ?? 0),
    spotPadding: 0,
    spotShape: "round",
    blackAndWhite: true,
    limitedColorMode: true,
    maxColors: 4,
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
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    lineColor: DEFAULT_OUTLINE_COLOR,
    outlineColor: DEFAULT_OUTLINE_COLOR,
    fillColor: TRANSPARENT_FILL_COLOR,
    fillRegions: {},
    cellPaints: [],
    graphShapes: [],
    clipartAssets: [],
    clipartImages: [],
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

    vectorizerSketchRemoval: DEFAULT_VECTORIZER_SKETCH_REMOVAL,
    vectorizerFidelity: DEFAULT_VECTORIZER_FIDELITY,
    gridLineColor: DEFAULT_GRID_LINE_COLOR,
    gridLineLayer: DEFAULT_GRAPH_LINE_LAYER,
    gridLineStyle: DEFAULT_GRID_LINE_STYLE,
    gridPattern: DEFAULT_GRID_PATTERN,
    showNumbers: true,
    gridNumberPlacement: "outside",
    showPageBreaks: true,
    majorGridEvery: DEFAULT_MAJOR_GRID_EVERY,
    imageWidth: DEFAULT_IMAGE_WIDTH_CELLS,
    imageHeight: DEFAULT_IMAGE_HEIGHT_CELLS,
    imagePadding: 0,
    imageOffsetX: 0,
    imageOffsetY: 0,
  });
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
        imageAutoEnhance: DEFAULT_IMAGE_AUTO_ENHANCE,
        imageDenoiseLevel: DEFAULT_IMAGE_DENOISE_LEVEL,
        imageEdgeDetection: DEFAULT_IMAGE_EDGE_DETECTION,
        imageColorQuantization: DEFAULT_IMAGE_COLOR_QUANTIZATION,
        vectorizerLineAdjust: DEFAULT_VECTORIZER_LINE_ADJUST,
        vectorizerInkThreshold: DEFAULT_VECTORIZER_INK_THRESHOLD,

        vectorizerSketchRemoval: DEFAULT_VECTORIZER_SKETCH_REMOVAL,
        vectorizerFidelity: DEFAULT_VECTORIZER_FIDELITY,
        x: defaultSourceX(settings.graphWidth, settings.imageWidth),
        y: 0,
        topPadding: 0,
        bottomPadding: 0,
        locked: false,
        visible: true,
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
    imageAutoEnhance: source.imageAutoEnhance,
    imageDenoiseLevel: source.imageDenoiseLevel,
    imageEdgeDetection: source.imageEdgeDetection,
    imageColorQuantization: source.imageColorQuantization,
    vectorizerLineAdjust: source.vectorizerLineAdjust,
    vectorizerInkThreshold: source.vectorizerInkThreshold,

    vectorizerSketchRemoval: source.vectorizerSketchRemoval,
    vectorizerFidelity: source.vectorizerFidelity,
    imageWidth: settings.graphWidth,
    imageHeight: settings.graphHeight,
  });
}

function clipartSettings(settings: GraphSettings, clipart: GraphClipartImage) {
  return deriveGraphSettings({
    ...settings,
    outlineColor: clipart.strokeColor,
    lineColor: clipart.strokeColor,
    fillColor: clipart.fillColor,
    imageLineThickness: clipart.imageLineThickness,
    vectorizerStrokeWidth: clipart.imageLineThickness,
    vectorizerStrokeColor: clipart.strokeColor,
    vectorizerLineAdjust: clipart.vectorizerLineAdjust,
    vectorizerInkThreshold: clipart.vectorizerInkThreshold,

    vectorizerSketchRemoval: clipart.vectorizerSketchRemoval,
    vectorizerFidelity: clipart.vectorizerFidelity,
    sourceFillThreshold: clipart.sourceFillThreshold,
    sourceFillMinStrokePixels: clipart.sourceFillMinStrokePixels,
    strokeGapClosePixels: clipart.strokeGapClosePixels,
    imageAutoEnhance: clipart.imageAutoEnhance,
    imageDenoiseLevel: clipart.imageDenoiseLevel,
    imageEdgeDetection: clipart.imageEdgeDetection,
    imageColorQuantization: clipart.imageColorQuantization,
    imageWidth: settings.graphWidth,
    imageHeight: settings.graphHeight,
  });
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
  const [sourceLoadSettled, setSourceLoadSettled] = useState(false);
  const [clipartReady, setClipartReady] = useState(true);
  const [clipartLoadSettled, setClipartLoadSettled] = useState(false);
  const [initialCanvasReadyProjectId, setInitialCanvasReadyProjectId] = useState<string | null>(null);
  const initialCanvasReady = initialCanvasReadyProjectId === project.id;
  const [sourceStatus, setSourceStatus] = useState<Record<string, SourceStatus>>({});
  const [sourceCropMode, setSourceCropMode] = useState(false);
  const [sourceCropArea, setSourceCropArea] = useState<CropPixels | null>(null);
  const [sourceCropPending, setSourceCropPending] = useState(false);
  const [sourceCropAutoPending, setSourceCropAutoPending] = useState(false);
  const [sourceCropRotation, setSourceCropRotation] = useState(0);
  const [sourceCropStraighten, setSourceCropStraighten] = useState(0);
  const [sourceCropFlipX, setSourceCropFlipX] = useState(false);
  const [sourceCropFlipY, setSourceCropFlipY] = useState(false);
  const [sourceCropZoom, setSourceCropZoom] = useState(1);
  const [sourceCropGuide, setSourceCropGuide] = useState<"none" | "thirds" | "golden" | "center" | "grid">("thirds");
  const [sourceCropInteractionMode, setSourceCropInteractionMode] = useState<"crop" | "pan">("crop");
  const [sourceCropBackgroundRemoval, setSourceCropBackgroundRemoval] = useState<GraphBackgroundRemoval | undefined>(undefined);
  const [processing, setProcessing] = useState(false);
  const [failedProcessingSignature, setFailedProcessingSignature] = useState<string | null>(null);
  const [fillRegions, setFillRegions] = useState<FillRegion[]>([]);
  const [selectedFillRegionId, setSelectedFillRegionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isDraggingGraph, setIsDraggingGraph] = useState(false);
  const [dragPreviewSourceId, setDragPreviewSourceId] = useState<string | null>(null);
  const [resizeHandleTarget, setResizeHandleTarget] = useState<ResizeHandleTarget>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedDrawingLayerId, setSelectedDrawingLayerId] = useState<DrawingLayerKey | null>(null);
  const [selectedLayerKeys, setSelectedLayerKeys] = useState<SelectableLayerKey[]>([]);
  const [layerReorderPreview, setLayerReorderPreview] = useState<{
    type: LayerKind;
    draggedId: string;
    targetId: string | null;
  } | null>(null);
  const [clipboardCount, setClipboardCount] = useState(0);
  const [snapGuides, setSnapGuides] = useState<LayerSnapGuide[]>([]);
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
  const [previewCanvasSize, setPreviewCanvasSize] = useState({ width: 1, height: 1 });
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("image");
  /**
   * Image-eraser radius in graph output pixels. Each touched source converts
   * this to its own working-canvas pixels before a stroke is persisted.
   */
  const [imageEraserRadius, setImageEraserRadius] = useState(16);
  const [imageEraserShape, setImageEraserShape] = useState<GraphEraseBrushShape>("circle");
  // Lasso: committed vertices plus the pointer position, so the preview can
  // rubber-band the pending edge back to the cursor.
  const [lassoVertices, setLassoVertices] = useState<LassoVertex[]>([]);
  const [lassoCursor, setLassoCursor] = useState<LassoVertex | null>(null);
  const [lassoFill, setLassoFill] = useState<GraphEraseRegionFill | "erase">("erase");
  // Pointer handlers are plain functions rebuilt each render, so they close over
  // the vertices of the render that created them. Two clicks landing inside one
  // render window then compared a stale list against the close threshold and
  // dropped a vertex on the region instead of closing it. The ref is the
  // authority for hit-testing and committing; the state drives the overlay.
  const lassoVerticesRef = useRef<LassoVertex[]>([]);
  lassoVerticesRef.current = lassoVertices;
  const imageEraserCursorRef = useRef<ImageEraserCursor>(null);
  const imageEraserCursorNodeRef = useRef<HTMLDivElement | null>(null);
  const imageEraserRadiusRef = useRef(imageEraserRadius);
  imageEraserRadiusRef.current = imageEraserRadius;
  const imageEraserShapeRef = useRef(imageEraserShape);
  imageEraserShapeRef.current = imageEraserShape;
  const [canvasTool, setCanvasTool] = useState<CanvasTool>("pointer");
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [renderKey, setRenderKey] = useState(0);
  const [cellPaintSides, setCellPaintSides] = useState<GraphCellLineSide[]>(CELL_LINE_SIDE_KEYS);
  const [cellPaintFillEnabled, setCellPaintFillEnabled] = useState(false);
  const [cellPaintLineEnabled, setCellPaintLineEnabled] = useState(true);
  // Single source of truth for the shape kind. The Shape Generator panel and
  // the canvas drag-draw tool previously held separate states, so picking Line
  // in the generator left drag-draw still producing rectangles.
  const [draftShapeKind, setDraftShapeKind] = useState<GeneratedShapeKind>("line");
  const [armedShapeKind, setArmedShapeKind] = useState<ClosedGeneratedShapeKind | null>(null);
  const [draftShapeWidthCm, setDraftShapeWidthCm] = useState(4);
  const [draftShapeHeightCm, setDraftShapeHeightCm] = useState(3);
  const [draftShapeFillMode, setDraftShapeFillMode] = useState<ShapeFillMode>("outline");
  const [draftShapeSides, setDraftShapeSides] = useState<GraphCellLineSide[]>(CELL_LINE_SIDE_KEYS);
  const [draftShapeStrokeWidth, setDraftShapeStrokeWidth] = useState(3);
  const [draftShapeStrokeColor, setDraftShapeStrokeColor] = useState(DEFAULT_OUTLINE_COLOR);
  const [draftShapeStrokeStyle, setDraftShapeStrokeStyle] = useState<GraphGridLineStyle>("solid");
  const [draftShapeFillColor, setDraftShapeFillColor] = useState<CanvasFillColor>(DEFAULT_BACKGROUND_COLOR);
  const [placingGeneratedShape, setPlacingGeneratedShape] = useState(false);
  const [selectedClipartAssetId, setSelectedClipartAssetId] = useState<string | null>(null);
  const [placingClipartAssetId, setPlacingClipartAssetId] = useState<string | null>(null);
  const [uploadingCliparts, setUploadingCliparts] = useState(false);
  const [draftClipartWidthCm, setDraftClipartWidthCm] = useState(4);
  const [draftClipartHeightCm, setDraftClipartHeightCm] = useState(4);
  const [draftClipartStrokeColor, setDraftClipartStrokeColor] = useState<CanvasColor>(DEFAULT_OUTLINE_COLOR);
  const [draftClipartFillColor, setDraftClipartFillColor] = useState<CanvasFillColor>(TRANSPARENT_FILL_COLOR);
  const [generatedImagesCollapsed, setGeneratedImagesCollapsed] = useState(true);
  const [layerChooser, setLayerChooser] = useState<LayerChooser>(null);
  const [resizingCommandCanvasPodId, setResizingCommandCanvasPodId] = useState<PodId | null>(null);
  const [uploadingSources, setUploadingSources] = useState(false);
  const [replacingSourceId, setReplacingSourceId] = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [leftPanelTab, setLeftPanelTab] = useState<EditorLeftPanelTab>("layers");
  const [sourcePanelCollapsed, setSourcePanelCollapsed] = useState(false);
  const [settingsPanelCollapsed, setSettingsPanelCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<CollapsibleKey, boolean>>({
    parameters: true,
    drawing: false,
    outline: true,
    fill: true,
    selectedFill: true,
    graphLines: true,
  });
  const [floatingPalette, setFloatingPalette] = useState<FloatingPalette>(null);
  const [copiedFillColor, setCopiedFillColor] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("canvas");
  const [commandCanvasLayout, setCommandCanvasLayout] = useState<CommandCanvasLayout>(createDefaultCommandCanvasLayout);
  const [commandCanvasLayoutHydrated, setCommandCanvasLayoutHydrated] = useState(false);
  const [commandCanvasViewportWidth, setCommandCanvasViewportWidth] = useState(1536);
  const [commandCanvasViewportHeight, setCommandCanvasViewportHeight] = useState(1024);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("graph");
  const [drawTab, setDrawTab] = useState<DrawTab>("shape");
  const [isPending, startTransition] = useTransition();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportMenuStyle, setExportMenuStyle] = useState<CSSProperties | null>(null);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [workspaceMenuStyle, setWorkspaceMenuStyle] = useState<CSSProperties | null>(null);
  const [clipartSearch, setClipartSearch] = useState("");
  const [deletingClipartAssetId, setDeletingClipartAssetId] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  const commandCanvasLayoutRef = useRef(commandCanvasLayout);
  commandCanvasLayoutRef.current = commandCanvasLayout;
  const commandCanvasPodDragRef = useRef<CommandCanvasPodDrag | null>(null);
  const commandCanvasPodResizeRef = useRef<CommandCanvasPodResize | null>(null);
  const commandCanvasDockPreviewRef = useRef<HTMLDivElement | null>(null);
  const processingDebounceRef = useRef<{ run: (...args: unknown[]) => void; cancel: () => void } | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  // Derived working canvases (pristine source -> background removal -> erase strokes), cached by extras signature.
  const sourceWorkingCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const sourceWorkingSigRef = useRef<Map<string, string>>(new Map());
  const clipartCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Transparent artwork-only canvas (no grid/backdrop) used as the preview base;
  // the grid is a crisp SVG overlay. processedCanvasRef stays the flattened image
  // (backdrop + grid + artwork) that export/save/PNG paths consume unchanged.
  const artworkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const graphStageRef = useRef<HTMLDivElement | null>(null);
  const uploadedSourceObjectUrlsRef = useRef<string[]>([]);
  const sourcePreviewObjectUrlsRef = useRef<Map<string, string>>(new Map());
  const dragStateRef = useRef<DragState | null>(null);
  const layerClipboardRef = useRef<{
    sources: GraphSourceImage[];
    cells: GraphCellPaint[];
    shapes: GraphShapeDrawing[];
    cliparts: GraphClipartImage[];
  } | null>(null);
  const exportMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const exportMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const workspaceMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const workspaceMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const noticeDismissTimerRef = useRef<number | NodeJS.Timeout | null>(null);
  const fillRegionMapRef = useRef<Uint16Array | null>(null);
  const fillRegionIdByMapIdRef = useRef<Map<number, string>>(new Map());
  // Draft renders update the visible/hit-test map while a gesture is in
  // progress. Reconciliation must instead compare against the last completed
  // frame, otherwise a long shape drag would overwrite the very topology we
  // need to preserve before its pointer-up render settles.
  const settledFillRegionFrameRef = useRef<{
    fillRegions: FillRegion[];
    fillRegionMap: Uint16Array;
    width: number;
    height: number;
  } | null>(null);
  const settingsHistoryRef = useRef<SettingsHistory>({ undo: [], redo: [] });
  const pendingSettingsHistoryRef = useRef<GraphSettings | null>(null);
  const lastProcessedSignatureRef = useRef<string | null>(null);
  const processedRevisionRef = useRef(0);
  const renderRequestRevisionRef = useRef(0);
  const cropDetectionUsedRef = useRef(false);
  const lastUploadedProcessedRevisionRef = useRef(project.processedImagePath ? 0 : -1);
  const lastDragProcessingAtRef = useRef(0);
  const forceNextProcessingRef = useRef(false);
  const spacePressedRef = useRef(false);
  const canvasPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const canvasPinchRef = useRef<CanvasPinchState | null>(null);

  const beginGraphInteraction = useCallback(() => {
    const now = performance.now();
    lastDragProcessingAtRef.current = now;
    forceNextProcessingRef.current = false;
    setIsDraggingGraph(true);
  }, []);

  useEffect(() => {
    let restored = createDefaultCommandCanvasLayout();
    try {
      restored = deserializeCommandCanvasLayout(window.localStorage.getItem(COMMAND_CANVAS_LAYOUT_STORAGE_KEY));
    } catch {
      // Presentation storage can be unavailable in restricted browsing modes.
    }
    setCommandCanvasLayout(restored);
    setSourcePanelCollapsed(restored.collapsed.includes("scene"));
    setSettingsPanelCollapsed(restored.collapsed.includes("focus"));
    setCommandCanvasLayoutHydrated(true);
  }, []);

  useEffect(() => {
    const syncViewportSize = () => {
      setCommandCanvasViewportWidth(window.innerWidth);
      setCommandCanvasViewportHeight(window.innerHeight);
    };
    syncViewportSize();
    window.addEventListener("resize", syncViewportSize);
    return () => window.removeEventListener("resize", syncViewportSize);
  }, []);

  useEffect(() => {
    if (!commandCanvasLayoutHydrated) return;
    try {
      window.localStorage.setItem(COMMAND_CANVAS_LAYOUT_STORAGE_KEY, serializeCommandCanvasLayout(commandCanvasLayout));
    } catch {
      // The workspace remains fully usable when browser-local storage is unavailable.
    }
  }, [commandCanvasLayout, commandCanvasLayoutHydrated]);

  useEffect(() => {
    if (!commandCanvasLayoutHydrated) return;
    setCommandCanvasLayout((current) => {
      const nextCollapsed = COMMAND_CANVAS_POD_IDS.filter((podId) => {
        if (!ACTIVE_COMMAND_CANVAS_PODS.has(podId)) return current.collapsed.includes(podId);
        if (podId === "scene") return sourcePanelCollapsed;
        if (podId === "focus") return settingsPanelCollapsed;
        return current.collapsed.includes(podId);
      });
      if (
        nextCollapsed.length === current.collapsed.length
        && nextCollapsed.every((podId, index) => current.collapsed[index] === podId)
      ) {
        return current;
      }
      return { ...current, collapsed: nextCollapsed };
    });
  }, [commandCanvasLayoutHydrated, settingsPanelCollapsed, sourcePanelCollapsed]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    setIsExportMenuOpen(false);
    setIsWorkspaceMenuOpen(false);
  }, [commandPaletteOpen]);

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

  useEffect(() => {
    if (!isExportMenuOpen) return;

    function closeMenu(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menuButton = exportMenuButtonRef.current;
      const portalRoot = exportMenuPortalRef.current;
      if (menuButton?.contains(target) || (portalRoot && portalRoot.contains(target))) return;

      setIsExportMenuOpen(false);
    }

    window.addEventListener("pointerdown", closeMenu, { capture: true });
    return () => window.removeEventListener("pointerdown", closeMenu, { capture: true });
  }, [isExportMenuOpen]);

  useEffect(() => {
    if (!isExportMenuOpen) {
      setExportMenuStyle(null);
      return;
    }

    const buttonElement = exportMenuButtonRef.current;
    if (!buttonElement) return;

    const updateMenuStyle = () => {
      const rect = buttonElement.getBoundingClientRect();
      const minimumWidth = 152;
      const menuWidth = Math.max(minimumWidth, Math.ceil(rect.width));
      const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
      const left = Math.max(8, Math.min(rect.right - menuWidth, maxLeft));
      setExportMenuStyle({
        position: "fixed",
        left: `${left}px`,
        top: `${rect.bottom + 6}px`,
        minWidth: `${menuWidth}px`,
      });
    };

    updateMenuStyle();
    window.addEventListener("scroll", updateMenuStyle, true);
    window.addEventListener("resize", updateMenuStyle);
    return () => {
      window.removeEventListener("scroll", updateMenuStyle, true);
      window.removeEventListener("resize", updateMenuStyle);
    };
  }, [isExportMenuOpen]);

  useEffect(() => {
    if (!isWorkspaceMenuOpen) return;

    function closeMenu(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menuButton = workspaceMenuButtonRef.current;
      const portalRoot = workspaceMenuPortalRef.current;
      if (menuButton?.contains(target) || (portalRoot && portalRoot.contains(target))) return;

      setIsWorkspaceMenuOpen(false);
    }

    window.addEventListener("pointerdown", closeMenu, { capture: true });
    return () => window.removeEventListener("pointerdown", closeMenu, { capture: true });
  }, [isWorkspaceMenuOpen]);

  useEffect(() => {
    if (!isWorkspaceMenuOpen) {
      setWorkspaceMenuStyle(null);
      return;
    }

    const buttonElement = workspaceMenuButtonRef.current;
    if (!buttonElement) return;

    const updateMenuStyle = () => {
      const rect = buttonElement.getBoundingClientRect();
      const menuWidth = Math.min(420, Math.max(340, window.innerWidth - 16));
      const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
      const left = Math.max(8, Math.min(rect.left, maxLeft));
      setWorkspaceMenuStyle({
        position: "fixed",
        left: `${left}px`,
        top: `${rect.bottom + 6}px`,
        width: `${menuWidth}px`,
      });
    };

    updateMenuStyle();
    window.addEventListener("scroll", updateMenuStyle, true);
    window.addEventListener("resize", updateMenuStyle);
    return () => {
      window.removeEventListener("scroll", updateMenuStyle, true);
      window.removeEventListener("resize", updateMenuStyle);
    };
  }, [isWorkspaceMenuOpen]);

  useEffect(() => {
    if (!notice) {
      if (noticeDismissTimerRef.current) {
        window.clearTimeout(noticeDismissTimerRef.current);
        noticeDismissTimerRef.current = null;
      }
      return;
    }

    if (noticeDismissTimerRef.current) {
      window.clearTimeout(noticeDismissTimerRef.current);
      noticeDismissTimerRef.current = null;
    }

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 5000);
    noticeDismissTimerRef.current = timer;

    return () => {
      window.clearTimeout(timer);
      if (noticeDismissTimerRef.current === timer) noticeDismissTimerRef.current = null;
    };
  }, [notice]);

  const filename = useMemo(() => slug(title), [title]);
  const primarySource = settings.sourceImages[0] ?? null;
  const sourceName = primarySource?.name ?? "Source image";
  const sourcePreviewUrl = primarySource ? sourceStatus[primarySource.id]?.previewUrl ?? primarySource.url ?? null : null;
  const selectedSource = selectedSourceId ? settings.sourceImages.find((source) => source.id === selectedSourceId) ?? null : null;
  const cropSource = selectedSource ?? primarySource;
  const cropSourcePreviewUrl = cropSource ? sourceStatus[cropSource.id]?.previewUrl ?? cropSource.url ?? null : null;
  const selectedSourceLayout = selectedSourceId ? sourceLayouts(settings.sourceImages).find((layout) => layout.source.id === selectedSourceId) ?? null : null;
  const sourceLoadKey = useMemo(
    () => settings.sourceImages.map((source) => `${source.id}:${source.name}:${source.url ?? source.path ?? ""}`).join("|"),
    [settings.sourceImages],
  );
  const clipartLoadKey = useMemo(
    () => settings.clipartAssets.map((asset) => `${asset.id}:${asset.name}:${asset.url ?? asset.dataUrl ?? asset.path ?? ""}`).join("|"),
    [settings.clipartAssets],
  );
  const clipartUsageKey = useMemo(
    () => [
      ...settings.clipartImages.filter((clipart) => clipart.visible !== false).map((clipart) => clipart.assetId),
      selectedClipartAssetId ?? settings.clipartAssets[0]?.id ?? "",
    ].filter(Boolean).sort().join("|"),
    [selectedClipartAssetId, settings.clipartAssets, settings.clipartImages],
  );
  const selectedClipartAsset = useMemo(
    () => settings.clipartAssets.find((asset) => asset.id === selectedClipartAssetId) ?? settings.clipartAssets[0] ?? null,
    [selectedClipartAssetId, settings.clipartAssets],
  );
  const selectedFillRegion = useMemo(
    () => fillRegions.find((region) => region.id === selectedFillRegionId) ?? null,
    [fillRegions, selectedFillRegionId],
  );
  const fillRegionsById = useMemo(() => new Map(fillRegions.map((region) => [region.id, region] as const)), [fillRegions]);
  const pushUndoSettings = useCallback((before: GraphSettings, after?: GraphSettings) => {
    if (!after) {
      pendingSettingsHistoryRef.current ??= before;
      return true;
    }
    const command = createSettingsHistoryCommand(before, after);
    if (!command) return false;
    const history = settingsHistoryRef.current;
    settingsHistoryRef.current = {
      undo: boundSettingsHistory(
        [...history.undo, command],
        MAX_SETTINGS_HISTORY,
        MAX_SETTINGS_HISTORY_ESTIMATED_BYTES,
      ),
      redo: [],
    };
    return true;
  }, []);
  const setSettingsWithHistory = useCallback(
    (updater: GraphSettings | ((current: GraphSettings) => GraphSettings)) => {
      const current = settingsRef.current;
      const migratedFillRegions = migrateLegacyFillRegionOverrides(current.fillRegions, fillRegions);
      const base = migratedFillRegions === current.fillRegions ? current : { ...current, fillRegions: migratedFillRegions };
      const candidate = typeof updater === "function" ? updater(base) : updater;
      const next = deriveGraphSettings(
        candidate.fillRegions === current.fillRegions && base !== current ? { ...candidate, fillRegions: base.fillRegions } : candidate,
      );
      if (!pushUndoSettings(current, next)) return;
      settingsRef.current = next;
      setSettings(next);
    },
    [fillRegions, pushUndoSettings],
  );
  const updateSetting = useCallback(<K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) => {
    setSettingsWithHistory((current) => ({ ...current, [key]: value }));
  }, [setSettingsWithHistory]);
  const restoreSettingsHistory = useCallback((direction: "undo" | "redo") => {
    const current = settingsRef.current;
    const history = settingsHistoryRef.current;
    const source = direction === "undo" ? history.undo : history.redo;
    const command = source.at(-1);
    if (!command) return;
    const restored = deriveGraphSettings(applySettingsHistoryCommand(current, command, direction));

    if (direction === "undo") {
      settingsHistoryRef.current = {
        undo: history.undo.slice(0, -1),
        redo: boundSettingsHistory(
          [...history.redo, command],
          MAX_SETTINGS_HISTORY,
          MAX_SETTINGS_HISTORY_ESTIMATED_BYTES,
        ),
      };
    } else {
      settingsHistoryRef.current = {
        undo: boundSettingsHistory(
          [...history.undo, command],
          MAX_SETTINGS_HISTORY,
          MAX_SETTINGS_HISTORY_ESTIMATED_BYTES,
        ),
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
    if (region.defaultColor && isFillColor(region.defaultColor)) return region.defaultColor;
    return region.kind === "source" ? current.outlineColor || current.lineColor : current.fillColor;
  }

  function currentFillRegionColor(region: FillRegion) {
    return settings.fillRegions[region.id]
      ?? (region.legacyId ? settings.fillRegions[region.legacyId] : undefined)
      ?? region.fallbackIds?.map((id) => settings.fillRegions[id]).find(Boolean)
      ?? defaultFillRegionColor(region);
  }

  const selectedFillRegionColor = selectedFillRegion ? currentFillRegionColor(selectedFillRegion) : settings.fillColor;

  function updateOutlineColor(color: string) {
    if (!isCanvasColor(color)) return;
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

  function shapePhysicalWidthCm(shape: GraphShapeDrawing) {
    return roundMeasure(shape.width * settings.cellSizeCm);
  }

  function shapePhysicalHeightCm(shape: GraphShapeDrawing) {
    return roundMeasure(shape.height * settings.cellSizeCm);
  }

  function shapeUsesSingleSize(kind: GraphShapeKind) {
    return kind === "square" || kind === "circle";
  }

  function shapeSupportsSides(kind: GraphShapeKind) {
    return kind === "square" || kind === "rectangle";
  }

  function draftShapeDimensionsCells(cellSizeCm = settings.cellSizeCm) {
    const width = clampSourceSizeCells(draftShapeWidthCm / Math.max(0.05, cellSizeCm), 4);
    const height = shapeUsesSingleSize(draftShapeKind)
      ? width
      : clampSourceSizeCells(draftShapeHeightCm / Math.max(0.05, cellSizeCm), 3);
    return { width, height };
  }

  function clipartAssetAspect(asset: GraphClipartAsset | null = selectedClipartAsset) {
    if (!asset?.width || !asset.height) return 1;
    return Math.max(0.01, asset.width / asset.height);
  }

  function draftClipartDimensionsCells(asset: GraphClipartAsset | null = selectedClipartAsset, cellSizeCm = settings.cellSizeCm) {
    const aspect = clipartAssetAspect(asset);
    const widthCm = Math.max(0.01, draftClipartWidthCm);
    const heightCm = Math.max(0.01, draftClipartHeightCm || widthCm / aspect);
    return {
      width: clampSourceSizeCells(widthCm / Math.max(0.05, cellSizeCm), 4),
      height: clampSourceSizeCells(heightCm / Math.max(0.05, cellSizeCm), 4 / aspect),
    };
  }

  function sourceRightPadding(source: GraphSourceImage) {
    return roundCells(settings.graphWidth - source.width - source.x);
  }

  function sourceBottomPadding(source: GraphSourceImage) {
    return roundCells(settings.graphHeight - source.height - source.y);
  }

  function drawingLayerKey(type: "cell" | "shape" | "clipart", id: string): DrawingLayerKey {
    return `${type}:${id}` as DrawingLayerKey;
  }

  function sourceLayerKey(sourceId: string): SelectableLayerKey {
    return `source:${sourceId}` as SelectableLayerKey;
  }

  function parseLayerKey(key: SelectableLayerKey): { type: LayerKind; id: string } {
    const [type, ...idParts] = key.split(":") as [LayerKind, ...string[]];
    return { type, id: idParts.join(":") };
  }

  function layerGroupIdForKey(current: GraphSettings, key: SelectableLayerKey): string | null {
    const { type, id } = parseLayerKey(key);
    if (type === "source") return current.sourceImages.find((source) => source.id === id)?.groupId ?? null;
    if (type === "cell") return current.cellPaints.find((cell) => cell.id === id)?.groupId ?? null;
    if (type === "shape") return current.graphShapes.find((shape) => shape.id === id)?.groupId ?? null;
    if (type === "clipart") return current.clipartImages.find((clipart) => clipart.id === id)?.groupId ?? null;
    return null;
  }

  function keysInGroups(current: GraphSettings, groupIds: Set<string>): SelectableLayerKey[] {
    const keys: SelectableLayerKey[] = [];
    for (const source of current.sourceImages) if (source.groupId && groupIds.has(source.groupId)) keys.push(sourceLayerKey(source.id));
    for (const cell of current.cellPaints) if (cell.groupId && groupIds.has(cell.groupId)) keys.push(drawingLayerKey("cell", cell.id));
    for (const shape of current.graphShapes) if (shape.groupId && groupIds.has(shape.groupId)) keys.push(drawingLayerKey("shape", shape.id));
    for (const clipart of current.clipartImages) if (clipart.groupId && groupIds.has(clipart.groupId)) keys.push(drawingLayerKey("clipart", clipart.id));
    return keys;
  }

  /** Expands a selection so every member of a touched group is included (keeps grouped layers moving/copying together). */
  function expandSelectionForGroups(current: GraphSettings, keys: SelectableLayerKey[]): SelectableLayerKey[] {
    const groupIds = new Set<string>();
    for (const key of keys) {
      const groupId = layerGroupIdForKey(current, key);
      if (groupId) groupIds.add(groupId);
    }
    if (!groupIds.size) return keys;
    const merged = new Set<SelectableLayerKey>(keys);
    for (const key of keysInGroups(current, groupIds)) merged.add(key);
    return Array.from(merged);
  }

  function nextLayerSelection(
    current: GraphSettings,
    selected: SelectableLayerKey[],
    key: SelectableLayerKey,
    additive: boolean,
  ) {
    const base = !additive
      ? [key]
      : selected.includes(key)
        ? selected.filter((item) => item !== key)
        : [...selected, key];
    return expandSelectionForGroups(current, base);
  }

  function setPrimarySelection(key: SelectableLayerKey | null, options: { additive?: boolean } = {}) {
    if (!key) {
      setSelectedSourceId(null);
      setSelectedDrawingLayerId(null);
      setSelectedLayerKeys([]);
      return;
    }
    const { type, id } = parseLayerKey(key);
    if (type === "source") {
      setSelectedSourceId(id);
      setSelectedDrawingLayerId(null);
      setInspectorTab("source");
    } else {
      setSelectedSourceId(null);
      setSelectedDrawingLayerId(key as DrawingLayerKey);
      setInspectorTab("source");
      if (type === "clipart" || type === "shape") setGeneratedImagesCollapsed(false);
    }
    setSettingsPanelCollapsed(false);
    setSelectedLayerKeys((current) => {
      return nextLayerSelection(settingsRef.current, current, key, Boolean(options.additive));
    });
  }

  function selectableLayerKeysFromSettings(current: GraphSettings) {
    return new Set<SelectableLayerKey>([
      ...current.sourceImages.map((source) => sourceLayerKey(source.id)),
      ...current.cellPaints.map((cell) => drawingLayerKey("cell", cell.id)),
      ...current.graphShapes.map((shape) => drawingLayerKey("shape", shape.id)),
      ...current.clipartImages.map((clipart) => drawingLayerKey("clipart", clipart.id)),
    ]);
  }

  function selectedLayerKeysForAction(current: GraphSettings = settingsRef.current) {
    const valid = selectableLayerKeysFromSettings(current);
    const selected = selectedLayerKeys.filter((key) => valid.has(key));
    if (selected.length) return selected;
    if (selectedSourceId) return [sourceLayerKey(selectedSourceId)];
    if (selectedDrawingLayerId) return [selectedDrawingLayerId];
    return [];
  }

  function setLayerCheckboxSelection(key: SelectableLayerKey, checked: boolean) {
    const current = settingsRef.current;
    const selected = selectedLayerKeysForAction(current);
    const groupId = layerGroupIdForKey(current, key);
    const next = checked
      ? expandSelectionForGroups(current, Array.from(new Set([...selected, key])))
      : selected.filter((item) => (groupId ? layerGroupIdForKey(current, item) !== groupId : item !== key));
    setSelectedLayerKeys(next);
    if (next.length) {
      focusPrimarySelection(checked ? key : next[0]);
      return;
    }
    setSelectedSourceId(null);
    setSelectedDrawingLayerId(null);
  }

  function setAllLayerCheckboxes(checked: boolean) {
    const keys = Array.from(selectableLayerKeysFromSettings(settingsRef.current));
    setSelectedLayerKeys(checked ? keys : []);
    if (checked && keys.length) {
      focusPrimarySelection(keys[0]);
      return;
    }
    setSelectedSourceId(null);
    setSelectedDrawingLayerId(null);
  }

  function renderLayerSelectionCheckbox(key: SelectableLayerKey, selected: boolean, name: string) {
    return (
      <input
        type="checkbox"
        checked={selected}
        aria-label={`Select ${name}`}
        onChange={(event) => setLayerCheckboxSelection(key, event.target.checked)}
        className={`editor-layer-row__select h-4 w-4 cursor-pointer ${selected ? "accent-[var(--on-brand)]" : "accent-[var(--editor-accent)]"}`}
      />
    );
  }

  function layerSnapTargets(current: GraphSettings, activeKey: SelectableLayerKey, excludedKeys = new Set<SelectableLayerKey>([activeKey])): LayerSnapBox[] {
    const targets: LayerSnapBox[] = [];
    for (const layout of sourceLayouts(current.sourceImages)) {
      if (excludedKeys.has(sourceLayerKey(layout.source.id))) continue;
      if (layout.source.visible === false) continue;
      targets.push({ id: sourceLayerKey(layout.source.id), x: layout.x, y: layout.y, width: layout.width, height: layout.height });
    }
    for (const shape of current.graphShapes) {
      if (excludedKeys.has(drawingLayerKey("shape", shape.id))) continue;
      if (shape.visible === false) continue;
      targets.push({
        id: drawingLayerKey("shape", shape.id),
        x: Math.min(shape.x, shape.x + shape.width),
        y: Math.min(shape.y, shape.y + shape.height),
        width: Math.max(0.01, Math.abs(shape.width)),
        height: Math.max(0.01, Math.abs(shape.height)),
      });
    }
    for (const clipart of current.clipartImages) {
      if (excludedKeys.has(drawingLayerKey("clipart", clipart.id))) continue;
      if (clipart.visible === false) continue;
      targets.push({
        id: drawingLayerKey("clipart", clipart.id),
        x: Math.min(clipart.x, clipart.x + clipart.width),
        y: Math.min(clipart.y, clipart.y + clipart.height),
        width: Math.max(0.01, Math.abs(clipart.width)),
        height: Math.max(0.01, Math.abs(clipart.height)),
      });
    }
    for (const cell of current.cellPaints) {
      if (excludedKeys.has(drawingLayerKey("cell", cell.id))) continue;
      if (cell.visible === false) continue;
      targets.push({
        id: drawingLayerKey("cell", cell.id),
        x: cell.x,
        y: cell.y,
        width: Math.max(0.01, cell.width),
        height: Math.max(0.01, cell.height),
      });
    }
    return targets;
  }

  function snapLayerRect(current: GraphSettings, activeKey: SelectableLayerKey, rect: LayerSnapBox, altKey: boolean, excludedKeys?: Set<SelectableLayerKey>) {
    return snapRectToLayerGuides(rect, layerSnapTargets(current, activeKey, excludedKeys), {
      disabled: altKey,
      threshold: 0.3,
      gridStep: 0.5,
    });
  }

  function layerStartsForSelection(current: GraphSettings, keys: SelectableLayerKey[]) {
    const starts = new Map<SelectableLayerKey, LayerSnapBox>();
    for (const layout of sourceLayouts(current.sourceImages)) {
      const key = sourceLayerKey(layout.source.id);
      if (keys.includes(key)) starts.set(key, { id: key, x: layout.x, y: layout.y, width: layout.width, height: layout.height });
    }
    for (const shape of current.graphShapes) {
      const key = drawingLayerKey("shape", shape.id);
      if (keys.includes(key)) starts.set(key, { id: key, x: shape.x, y: shape.y, width: Math.abs(shape.width), height: Math.abs(shape.height) });
    }
    for (const clipart of current.clipartImages) {
      const key = drawingLayerKey("clipart", clipart.id);
      if (keys.includes(key)) starts.set(key, { id: key, x: clipart.x, y: clipart.y, width: Math.abs(clipart.width), height: Math.abs(clipart.height) });
    }
    for (const cell of current.cellPaints) {
      const key = drawingLayerKey("cell", cell.id);
      if (keys.includes(key)) starts.set(key, { id: key, x: cell.x, y: cell.y, width: Math.abs(cell.width), height: Math.abs(cell.height) });
    }
    return starts;
  }

  function moveLayerSelection(current: GraphSettings, starts: Map<SelectableLayerKey, LayerSnapBox>, deltaX: number, deltaY: number) {
    let changed = false;
    const moveKeys = new Set(starts.keys());
    const sourceImages = current.sourceImages.map((source) => {
      const start = starts.get(sourceLayerKey(source.id));
      if (!start || source.locked) return source;
      const x = clampSourceX(start.x + deltaX, current.graphWidth, source.width);
      const y = clampFreeCellCoordinate(start.y + deltaY, source.y);
      if (source.x === x && source.y === y) return source;
      changed = true;
      return { ...source, x, y };
    });
    const cellPaints = current.cellPaints.map((cell) => {
      const start = starts.get(drawingLayerKey("cell", cell.id));
      if (!start || cell.locked) return cell;
      const x = roundCells(Math.max(0, start.x + deltaX));
      const y = roundCells(Math.max(0, start.y + deltaY));
      if (cell.x === x && cell.y === y) return cell;
      changed = true;
      return { ...cell, x, y };
    });
    const graphShapes = current.graphShapes.map((shape) => {
      const start = starts.get(drawingLayerKey("shape", shape.id));
      if (!start || shape.locked) return shape;
      const x = clampFreeCellCoordinate(start.x + deltaX, shape.x);
      const y = clampFreeCellCoordinate(start.y + deltaY, shape.y);
      if (shape.x === x && shape.y === y) return shape;
      changed = true;
      return { ...shape, x, y };
    });
    const clipartImages = current.clipartImages.map((clipart) => {
      const start = starts.get(drawingLayerKey("clipart", clipart.id));
      if (!start || clipart.locked) return clipart;
      const x = clampFreeCellCoordinate(start.x + deltaX, clipart.x);
      const y = clampFreeCellCoordinate(start.y + deltaY, clipart.y);
      if (clipart.x === x && clipart.y === y) return clipart;
      changed = true;
      return { ...clipart, x, y };
    });

    return {
      changed,
      next: moveKeys.size ? { ...current, sourceImages, cellPaints, graphShapes, clipartImages } : current,
    };
  }

  function selectionBoundsForLayerStarts(current: GraphSettings, starts: Map<SelectableLayerKey, LayerSnapBox>) {
    const boxes = Array.from(starts.values()).map((box) => {
      const { type } = parseLayerKey(box.id as SelectableLayerKey);
      const offsetX = type === "source" ? current.imageOffsetX / GRAPH_MAJOR_CELL_PIXELS : 0;
      const offsetY = type === "source" ? current.imageOffsetY / GRAPH_MAJOR_CELL_PIXELS : 0;
      return { ...box, x: box.x + offsetX, y: box.y + offsetY };
    });
    if (!boxes.length) return null;
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    return { id: "selection", x: left, y: top, width: Math.max(0.01, right - left), height: Math.max(0.01, bottom - top) };
  }

  function selectionBoundsForOverlay(current: GraphSettings, keys: SelectableLayerKey[]) {
    return selectionBoundsForLayerStarts(current, layerStartsForSelection(current, keys));
  }

  function layerSelectionContainsLocked(current: GraphSettings, keys: SelectableLayerKey[]) {
    return keys.some((key) => {
      const { type, id } = parseLayerKey(key);
      if (type === "source") return Boolean(current.sourceImages.find((source) => source.id === id)?.locked);
      if (type === "cell") return Boolean(current.cellPaints.find((cell) => cell.id === id)?.locked);
      if (type === "shape") return Boolean(current.graphShapes.find((shape) => shape.id === id)?.locked);
      return Boolean(current.clipartImages.find((clipart) => clipart.id === id)?.locked);
    });
  }

  function resizeLayerSelection(
    current: GraphSettings,
    starts: Map<SelectableLayerKey, LayerSnapBox>,
    startBounds: LayerSnapBox,
    nextBounds: LayerSnapBox,
  ) {
    let changed = false;
    const sourceOffsetX = current.imageOffsetX / GRAPH_MAJOR_CELL_PIXELS;
    const sourceOffsetY = current.imageOffsetY / GRAPH_MAJOR_CELL_PIXELS;
    const scaledBoxFor = (key: SelectableLayerKey) => {
      const start = starts.get(key);
      if (!start) return null;
      const { type } = parseLayerKey(key);
      const visualStart = type === "source"
        ? { ...start, x: start.x + sourceOffsetX, y: start.y + sourceOffsetY }
        : start;
      return scaleLayerBoxToBounds(visualStart, startBounds, nextBounds);
    };

    const sourceImages = current.sourceImages.map((source) => {
      const key = sourceLayerKey(source.id);
      const scaled = scaledBoxFor(key);
      if (!scaled || source.locked) return source;
      const width = clampSourceSizeCells(scaled.width, source.width);
      const height = clampSourceSizeCells(scaled.height, source.height);
      const x = clampSourceX(scaled.x - sourceOffsetX, current.graphWidth, width);
      const y = clampFreeCellCoordinate(scaled.y - sourceOffsetY, source.y);
      if (source.x === x && source.y === y && source.width === width && source.height === height) return source;
      changed = true;
      return { ...source, x, y, width, height };
    });
    const cellPaints = current.cellPaints.map((cell) => {
      const scaled = scaledBoxFor(drawingLayerKey("cell", cell.id));
      if (!scaled || cell.locked) return cell;
      const x = roundCells(Math.max(0, scaled.x));
      const y = roundCells(Math.max(0, scaled.y));
      const width = clampSourceSizeCells(scaled.width, cell.width);
      const height = clampSourceSizeCells(scaled.height, cell.height);
      if (cell.x === x && cell.y === y && cell.width === width && cell.height === height) return cell;
      changed = true;
      return { ...cell, x, y, width, height };
    });
    const graphShapes = current.graphShapes.map((shape) => {
      const scaled = scaledBoxFor(drawingLayerKey("shape", shape.id));
      if (!scaled || shape.locked) return shape;
      const x = clampFreeCellCoordinate(scaled.x, shape.x);
      const y = clampFreeCellCoordinate(scaled.y, shape.y);
      const width = clampSourceSizeCells(scaled.width, shape.width);
      const height = clampSourceSizeCells(scaled.height, shape.height);
      if (shape.x === x && shape.y === y && shape.width === width && shape.height === height) return shape;
      changed = true;
      return { ...shape, x, y, width, height };
    });
    const clipartImages = current.clipartImages.map((clipart) => {
      const scaled = scaledBoxFor(drawingLayerKey("clipart", clipart.id));
      if (!scaled || clipart.locked) return clipart;
      const x = clampFreeCellCoordinate(scaled.x, clipart.x);
      const y = clampFreeCellCoordinate(scaled.y, clipart.y);
      const width = clampSourceSizeCells(scaled.width, clipart.width);
      const height = clampSourceSizeCells(scaled.height, clipart.height);
      if (clipart.x === x && clipart.y === y && clipart.width === width && clipart.height === height) return clipart;
      changed = true;
      return { ...clipart, x, y, width, height };
    });

    return {
      changed,
      next: changed
        ? {
            ...current,
            sourceImages,
            cellPaints,
            graphShapes,
            clipartImages,
          }
        : current,
    };
  }

  function transformLayerSelection(
    current: GraphSettings,
    starts: Map<SelectableLayerKey, LayerSnapBox>,
    bounds: LayerSnapBox,
    transform: { type: "flip"; axis: "x" | "y" } | { type: "rotate"; direction: -1 | 1 },
  ) {
    let changed = false;
    const sourceOffsetX = current.imageOffsetX / GRAPH_MAJOR_CELL_PIXELS;
    const sourceOffsetY = current.imageOffsetY / GRAPH_MAJOR_CELL_PIXELS;
    const transformedBoxFor = (key: SelectableLayerKey) => {
      const start = starts.get(key);
      if (!start) return null;
      const { type } = parseLayerKey(key);
      const visualStart = type === "source"
        ? { ...start, x: start.x + sourceOffsetX, y: start.y + sourceOffsetY }
        : start;
      return transform.type === "flip"
        ? flipLayerBoxInBounds(visualStart, bounds, transform.axis)
        : rotateLayerBoxInBounds(visualStart, bounds, transform.direction);
    };
    const rotationDelta = transform.type === "rotate" ? transform.direction * ROTATION_STEP_DEGREES : 0;
    const globalFlipAxis = transform.type === "flip" ? transform.axis : null;
    const localFlipAxis = (rotationDegrees: number) => {
      if (!globalFlipAxis) return null;
      const sideways = normalizeRotationDegrees(rotationDegrees) === 90 || normalizeRotationDegrees(rotationDegrees) === 270;
      return sideways ? (globalFlipAxis === "x" ? "y" : "x") : globalFlipAxis;
    };

    const sourceImages = current.sourceImages.map((source) => {
      const transformed = transformedBoxFor(sourceLayerKey(source.id));
      if (!transformed || source.locked) return source;
      const width = clampSourceSizeCells(transformed.width, source.width);
      const height = clampSourceSizeCells(transformed.height, source.height);
      const x = clampSourceX(transformed.x - sourceOffsetX, current.graphWidth, width);
      const y = clampFreeCellCoordinate(transformed.y - sourceOffsetY, source.y);
      const axis = localFlipAxis(source.rotationDegrees);
      const rotationDegrees = rotationDelta ? normalizeRotationDegrees(source.rotationDegrees + rotationDelta) : source.rotationDegrees;
      const flipX = axis === "x" ? !source.flipX : source.flipX;
      const flipY = axis === "y" ? !source.flipY : source.flipY;
      if (source.x === x && source.y === y && source.width === width && source.height === height && source.rotationDegrees === rotationDegrees && source.flipX === flipX && source.flipY === flipY) return source;
      changed = true;
      return { ...source, x, y, width, height, rotationDegrees, flipX, flipY };
    });
    const cellPaints = current.cellPaints.map((cell) => {
      const transformed = transformedBoxFor(drawingLayerKey("cell", cell.id));
      if (!transformed || cell.locked) return cell;
      const x = roundCells(Math.max(0, transformed.x));
      const y = roundCells(Math.max(0, transformed.y));
      const width = clampSourceSizeCells(transformed.width, cell.width);
      const height = clampSourceSizeCells(transformed.height, cell.height);
      const axis = localFlipAxis(cell.rotationDegrees);
      const rotationDegrees = rotationDelta ? normalizeRotationDegrees(cell.rotationDegrees + rotationDelta) : cell.rotationDegrees;
      const flipX = axis === "x" ? !cell.flipX : cell.flipX;
      const flipY = axis === "y" ? !cell.flipY : cell.flipY;
      if (cell.x === x && cell.y === y && cell.width === width && cell.height === height && cell.rotationDegrees === rotationDegrees && cell.flipX === flipX && cell.flipY === flipY) return cell;
      changed = true;
      return { ...cell, x, y, width, height, rotationDegrees, flipX, flipY };
    });
    const graphShapes = current.graphShapes.map((shape) => {
      const transformed = transformedBoxFor(drawingLayerKey("shape", shape.id));
      if (!transformed || shape.locked) return shape;
      const x = clampFreeCellCoordinate(transformed.x, shape.x);
      const y = clampFreeCellCoordinate(transformed.y, shape.y);
      const width = clampSourceSizeCells(transformed.width, shape.width);
      const height = clampSourceSizeCells(transformed.height, shape.height);
      const axis = localFlipAxis(shape.rotationDegrees);
      const rotationDegrees = rotationDelta ? normalizeRotationDegrees(shape.rotationDegrees + rotationDelta) : shape.rotationDegrees;
      const flipX = axis === "x" ? !shape.flipX : shape.flipX;
      const flipY = axis === "y" ? !shape.flipY : shape.flipY;
      if (shape.x === x && shape.y === y && shape.width === width && shape.height === height && shape.rotationDegrees === rotationDegrees && shape.flipX === flipX && shape.flipY === flipY) return shape;
      changed = true;
      return { ...shape, x, y, width, height, rotationDegrees, flipX, flipY };
    });
    const clipartImages = current.clipartImages.map((clipart) => {
      const transformed = transformedBoxFor(drawingLayerKey("clipart", clipart.id));
      if (!transformed || clipart.locked) return clipart;
      const x = clampFreeCellCoordinate(transformed.x, clipart.x);
      const y = clampFreeCellCoordinate(transformed.y, clipart.y);
      const width = clampSourceSizeCells(transformed.width, clipart.width);
      const height = clampSourceSizeCells(transformed.height, clipart.height);
      const axis = localFlipAxis(clipart.rotationDegrees);
      const rotationDegrees = rotationDelta ? normalizeRotationDegrees(clipart.rotationDegrees + rotationDelta) : clipart.rotationDegrees;
      const flipX = axis === "x" ? !clipart.flipX : clipart.flipX;
      const flipY = axis === "y" ? !clipart.flipY : clipart.flipY;
      if (clipart.x === x && clipart.y === y && clipart.width === width && clipart.height === height && clipart.rotationDegrees === rotationDegrees && clipart.flipX === flipX && clipart.flipY === flipY) return clipart;
      changed = true;
      return { ...clipart, x, y, width, height, rotationDegrees, flipX, flipY };
    });

    return {
      changed,
      next: changed
        ? {
            ...current,
            sourceImages,
            cellPaints,
            graphShapes,
            clipartImages,
          }
        : current,
    };
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
          lineColor: patch.lineColor && isCanvasColor(patch.lineColor) ? patch.lineColor : cell.lineColor,
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
        const sides = patch.sides === undefined ? shape.sides : Array.from(new Set(patch.sides.filter((side) => CELL_LINE_SIDE_KEYS.includes(side))));
        return {
          ...shape,
          ...patch,
          kind,
          x: patch.x === undefined ? shape.x : clampFreeCellCoordinate(patch.x, shape.x),
          y: patch.y === undefined ? shape.y : clampFreeCellCoordinate(patch.y, shape.y),
          width: patch.width === undefined ? shape.width : clampSourceSizeCells(patch.width, shape.width),
          height: patch.height === undefined ? shape.height : clampSourceSizeCells(patch.height, shape.height),
          strokeColor: patch.strokeColor && isCanvasColor(patch.strokeColor) ? patch.strokeColor : shape.strokeColor,
          fillColor: patch.fillColor && isFillColor(patch.fillColor) ? patch.fillColor : shape.fillColor,
          strokeWidth: patch.strokeWidth === undefined ? shape.strokeWidth : Math.max(1, Math.min(24, Math.round(patch.strokeWidth))),
          sides: sides.length ? sides : shape.sides,
          rotationDegrees: patch.rotationDegrees === undefined ? shape.rotationDegrees : normalizeRotationDegrees(patch.rotationDegrees),
        };
      }),
    }));
  }

  function updateClipartImage(clipartId: string, patch: Partial<GraphClipartImage>) {
    setSettingsWithHistory((current) => {
      const retainsFillOverrides = Object.keys(patch).every((key) =>
        ["x", "y", "width", "height", "rotationDegrees", "flipX", "flipY", "locked", "visible", "groupId", "name"].includes(key),
      );
      return {
        ...current,
        fillRegions: retainsFillOverrides
          ? current.fillRegions
          : removeFillRegionOverridesForScopes(current.fillRegions, [fillRegionLayerScope("clipart", clipartId)]),
        clipartImages: current.clipartImages.map((clipart) => {
          if (clipart.id !== clipartId || clipart.locked) return clipart;
          return {
            ...clipart,
            ...patch,
            x: patch.x === undefined ? clipart.x : clampFreeCellCoordinate(patch.x, clipart.x),
            y: patch.y === undefined ? clipart.y : clampFreeCellCoordinate(patch.y, clipart.y),
            width: patch.width === undefined ? clipart.width : clampSourceSizeCells(patch.width, clipart.width),
            height: patch.height === undefined ? clipart.height : clampSourceSizeCells(patch.height, clipart.height),
            strokeColor: patch.strokeColor && isCanvasColor(patch.strokeColor) ? patch.strokeColor : clipart.strokeColor,
            fillColor: patch.fillColor && isFillColor(patch.fillColor) ? patch.fillColor : clipart.fillColor,
            imageLineThickness: patch.imageLineThickness === undefined ? clipart.imageLineThickness : clampImageLineThickness(patch.imageLineThickness),
            sourceFillThreshold: patch.sourceFillThreshold === undefined ? clipart.sourceFillThreshold : clampSourceFillThreshold(patch.sourceFillThreshold),
            sourceFillMinStrokePixels: patch.sourceFillMinStrokePixels === undefined ? clipart.sourceFillMinStrokePixels : clampSourceFillMinStrokePixels(patch.sourceFillMinStrokePixels),
            strokeGapClosePixels: patch.strokeGapClosePixels === undefined ? clipart.strokeGapClosePixels : clampStrokeGapClosePixels(patch.strokeGapClosePixels),
            imageAutoEnhance: patch.imageAutoEnhance === undefined ? clipart.imageAutoEnhance : Boolean(patch.imageAutoEnhance),
            imageDenoiseLevel: patch.imageDenoiseLevel === undefined || !isGraphImageDenoiseLevel(patch.imageDenoiseLevel) ? clipart.imageDenoiseLevel : patch.imageDenoiseLevel,
            imageEdgeDetection: patch.imageEdgeDetection === undefined || !isGraphImageEdgeDetection(patch.imageEdgeDetection) ? clipart.imageEdgeDetection : patch.imageEdgeDetection,
            imageColorQuantization: patch.imageColorQuantization === undefined || !isGraphImageColorQuantization(patch.imageColorQuantization) ? clipart.imageColorQuantization : patch.imageColorQuantization,
            vectorizerLineAdjust: patch.vectorizerLineAdjust === undefined ? clipart.vectorizerLineAdjust : clampVectorizerLineAdjust(patch.vectorizerLineAdjust),
            vectorizerInkThreshold: patch.vectorizerInkThreshold === undefined ? clipart.vectorizerInkThreshold : clampVectorizerInkThreshold(patch.vectorizerInkThreshold),

            vectorizerSketchRemoval: patch.vectorizerSketchRemoval === undefined ? clipart.vectorizerSketchRemoval : clampVectorizerSketchRemoval(patch.vectorizerSketchRemoval),
            vectorizerFidelity: patch.vectorizerFidelity === undefined || !isGraphVectorizerFidelity(patch.vectorizerFidelity) ? clipart.vectorizerFidelity : patch.vectorizerFidelity,
            rotationDegrees: patch.rotationDegrees === undefined ? clipart.rotationDegrees : normalizeRotationDegrees(patch.rotationDegrees),
          };
        }),
      };
    });
  }

  function updateGraphShapePhysicalWidthCm(shapeId: string, value: number) {
    const shape = settingsRef.current.graphShapes.find((item) => item.id === shapeId);
    if (!shape) return;
    const width = value / Math.max(0.05, settingsRef.current.cellSizeCm);
    updateGraphShape(shapeId, shapeUsesSingleSize(shape.kind) ? { width, height: width } : { width });
  }

  function updateGraphShapePhysicalHeightCm(shapeId: string, value: number) {
    const shape = settingsRef.current.graphShapes.find((item) => item.id === shapeId);
    if (!shape) return;
    const height = value / Math.max(0.05, settingsRef.current.cellSizeCm);
    updateGraphShape(shapeId, shapeUsesSingleSize(shape.kind) ? { width: height, height } : { height });
  }

  function updateClipartPhysicalWidthCm(clipartId: string, value: number) {
    const width = value / Math.max(0.05, settingsRef.current.cellSizeCm);
    updateClipartImage(clipartId, { width });
  }

  function updateClipartPhysicalHeightCm(clipartId: string, value: number) {
    const height = value / Math.max(0.05, settingsRef.current.cellSizeCm);
    updateClipartImage(clipartId, { height });
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
        | "imageAutoEnhance"
        | "imageDenoiseLevel"
        | "imageEdgeDetection"
        | "imageColorQuantization"
        | "vectorizerLineAdjust"
        | "vectorizerInkThreshold"

        | "vectorizerSketchRemoval"
        | "vectorizerFidelity"
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
    setSettingsWithHistory((current) => {
      const retainsFillOverrides = Object.keys(patch).every((key) =>
        ["x", "y", "width", "height", "rotationDegrees", "flipX", "flipY", "topPadding", "bottomPadding", "locked", "measurementUnit", "groupId", "name"].includes(key),
      );
      return {
        ...current,
        fillRegions: retainsFillOverrides
          ? current.fillRegions
          : removeFillRegionOverridesForScopes(current.fillRegions, [fillRegionLayerScope("source", sourceId)]),
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
            imageLineThickness: patch.imageLineThickness === undefined ? source.imageLineThickness : clampImageLineThickness(patch.imageLineThickness),
            sourceFillThreshold: patch.sourceFillThreshold === undefined ? source.sourceFillThreshold : clampSourceFillThreshold(patch.sourceFillThreshold),
            sourceFillMinStrokePixels: patch.sourceFillMinStrokePixels === undefined ? source.sourceFillMinStrokePixels : clampSourceFillMinStrokePixels(patch.sourceFillMinStrokePixels),
            strokeGapClosePixels: patch.strokeGapClosePixels === undefined ? source.strokeGapClosePixels : clampStrokeGapClosePixels(patch.strokeGapClosePixels),
            imageAutoEnhance: patch.imageAutoEnhance === undefined ? source.imageAutoEnhance : Boolean(patch.imageAutoEnhance),
            imageDenoiseLevel: patch.imageDenoiseLevel === undefined || !isGraphImageDenoiseLevel(patch.imageDenoiseLevel) ? source.imageDenoiseLevel : patch.imageDenoiseLevel,
            imageEdgeDetection: patch.imageEdgeDetection === undefined || !isGraphImageEdgeDetection(patch.imageEdgeDetection) ? source.imageEdgeDetection : patch.imageEdgeDetection,
            imageColorQuantization: patch.imageColorQuantization === undefined || !isGraphImageColorQuantization(patch.imageColorQuantization) ? source.imageColorQuantization : patch.imageColorQuantization,
            vectorizerLineAdjust: patch.vectorizerLineAdjust === undefined ? source.vectorizerLineAdjust : clampVectorizerLineAdjust(patch.vectorizerLineAdjust),
            vectorizerInkThreshold: patch.vectorizerInkThreshold === undefined ? source.vectorizerInkThreshold : clampVectorizerInkThreshold(patch.vectorizerInkThreshold),

            vectorizerSketchRemoval: patch.vectorizerSketchRemoval === undefined ? source.vectorizerSketchRemoval : clampVectorizerSketchRemoval(patch.vectorizerSketchRemoval),
            vectorizerFidelity: patch.vectorizerFidelity === undefined || !isGraphVectorizerFidelity(patch.vectorizerFidelity) ? source.vectorizerFidelity : patch.vectorizerFidelity,
            rotationDegrees: patch.rotationDegrees === undefined ? source.rotationDegrees : normalizeRotationDegrees(patch.rotationDegrees),
            x: patch.x === undefined ? (patch.width ? clampSourceX(source.x, current.graphWidth, width) : source.x) : clampSourceX(patch.x, current.graphWidth, width),
            y,
            topPadding,
            bottomPadding,
          };
        }),
      };
    });
  }

  function applySourceImagePropertiesToAll(sourceId: string) {
    const source = settingsRef.current.sourceImages.find((candidate) => candidate.id === sourceId);
    if (!source) return;
    const properties = {
      imageLineThickness: source.imageLineThickness,
      sourceFillThreshold: source.sourceFillThreshold,
      sourceFillMinStrokePixels: source.sourceFillMinStrokePixels,
      strokeGapClosePixels: source.strokeGapClosePixels,
      imageAutoEnhance: source.imageAutoEnhance,
      imageDenoiseLevel: source.imageDenoiseLevel,
      imageEdgeDetection: source.imageEdgeDetection,
      imageColorQuantization: source.imageColorQuantization,
      vectorizerLineAdjust: source.vectorizerLineAdjust,
      vectorizerInkThreshold: source.vectorizerInkThreshold,

      vectorizerSketchRemoval: source.vectorizerSketchRemoval,
      vectorizerFidelity: source.vectorizerFidelity,
    };
    setSettingsWithHistory((current) => ({
      ...current,
      ...properties,
      fillRegions: removeFillRegionOverridesForScopes(current.fillRegions, [
        ...current.sourceImages.map((image) => fillRegionLayerScope("source", image.id)),
        ...current.clipartImages.map((image) => fillRegionLayerScope("clipart", image.id)),
      ]),
      sourceImages: current.sourceImages.map((image) => ({ ...image, ...properties })),
      clipartImages: current.clipartImages.map((image) => ({ ...image, ...properties })),
    }));
    setNotice({ tone: "ok", text: "Image properties applied to every image. Individual image edits remain independent." });
  }

  function setSourceBackgroundRemoval(sourceId: string, config: GraphBackgroundRemoval | undefined) {
    setSettingsWithHistory((current) => ({
      ...current,
      fillRegions: removeFillRegionOverridesForScopes(current.fillRegions, [fillRegionLayerScope("source", sourceId)]),
      sourceImages: current.sourceImages.map((source) =>
        source.id === sourceId ? { ...source, backgroundRemoval: config?.enabled ? { enabled: true, tolerance: clampBackgroundTolerance(config.tolerance) } : undefined } : source,
      ),
    }));
  }

  function toggleSourceBackgroundRemoval(sourceId: string) {
    const source = settingsRef.current.sourceImages.find((candidate) => candidate.id === sourceId);
    if (!source) return;
    if (source.backgroundRemoval?.enabled) {
      setSourceBackgroundRemoval(sourceId, undefined);
    } else {
      setSourceBackgroundRemoval(sourceId, { enabled: true, tolerance: source.backgroundRemoval?.tolerance ?? DEFAULT_BACKGROUND_TOLERANCE });
    }
  }

  function clearSourceErasing(sourceId: string) {
    setSettingsWithHistory((current) => ({
      ...current,
      fillRegions: removeFillRegionOverridesForScopes(current.fillRegions, [fillRegionLayerScope("source", sourceId)]),
      sourceImages: current.sourceImages.map((source) =>
        source.id === sourceId ? { ...source, eraseStrokes: [] } : source,
      ),
    }));
    setNotice({ tone: "ok", text: "Erased image lines restored." });
  }

  const nudgeSelectedSource = useCallback((deltaX: number, deltaY: number) => {
    setSettingsWithHistory((current) => {
      const keys = selectedLayerKeysForAction(current);
      if (!keys.length) return current;
      const selected = new Set(keys);
      const nudgeCells = roundCells(0.1 / Math.max(0.05, current.cellSizeCm));
      let changed = false;
      const next = {
        ...current,
        sourceImages: current.sourceImages.map((source) => {
          if (!selected.has(sourceLayerKey(source.id)) || source.locked) return source;
          const x = clampSourceX(source.x + deltaX * nudgeCells, current.graphWidth, source.width);
          const y = clampFreeCellCoordinate(source.y + deltaY * nudgeCells, source.y);
          if (source.x === x && source.y === y) return source;
          changed = true;
          return { ...source, x, y };
        }),
        cellPaints: current.cellPaints.map((cell) => {
          if (!selected.has(drawingLayerKey("cell", cell.id)) || cell.locked) return cell;
          changed = true;
          return {
            ...cell,
            x: roundCells(Math.max(0, cell.x + deltaX * nudgeCells)),
            y: roundCells(Math.max(0, cell.y + deltaY * nudgeCells)),
          };
        }),
        graphShapes: current.graphShapes.map((shape) => {
          if (!selected.has(drawingLayerKey("shape", shape.id)) || shape.locked) return shape;
          changed = true;
          return {
            ...shape,
            x: clampFreeCellCoordinate(shape.x + deltaX * nudgeCells, shape.x),
            y: clampFreeCellCoordinate(shape.y + deltaY * nudgeCells, shape.y),
          };
        }),
        clipartImages: current.clipartImages.map((clipart) => {
          if (!selected.has(drawingLayerKey("clipart", clipart.id)) || clipart.locked) return clipart;
          changed = true;
          return {
            ...clipart,
            x: clampFreeCellCoordinate(clipart.x + deltaX * nudgeCells, clipart.x),
            y: clampFreeCellCoordinate(clipart.y + deltaY * nudgeCells, clipart.y),
          };
        }),
      };
      return changed ? next : current;
    });
  }, [selectedDrawingLayerId, selectedLayerKeys, selectedSourceId, setSettingsWithHistory]);

  function moveSourceImage(sourceId: string, direction: -1 | 1) {
    setSettingsWithHistory((current) => {
      const index = current.sourceImages.findIndex((source) => source.id === sourceId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.sourceImages.length) return current;
      if (current.sourceImages[index]?.locked || current.sourceImages[nextIndex]?.locked) return current;
      const sourceImages = reorderSourceImages(current.sourceImages, index, nextIndex);
      return { ...current, sourceImages };
    });
  }

  function removeSourceImage(sourceId: string, options: { skipConfirm?: boolean } = {}) {
    const source = settingsRef.current.sourceImages.find((image) => image.id === sourceId);
    if (!source || source.locked) return;
    if (!options.skipConfirm && !window.confirm(`Delete "${source.name}" from this project?`)) return;
    setDeletingSourceId(sourceId);
    setSettingsWithHistory((current) => ({
      ...current,
      fillRegions: removeFillRegionOverridesForScopes(current.fillRegions, [fillRegionLayerScope("source", sourceId)]),
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

  function toggleDrawingLock(type: "cell" | "shape" | "clipart", id: string) {
    setSettingsWithHistory((current) => ({
      ...current,
      cellPaints: type === "cell" ? current.cellPaints.map((cell) => (cell.id === id ? { ...cell, locked: !cell.locked } : cell)) : current.cellPaints,
      graphShapes: type === "shape" ? current.graphShapes.map((shape) => (shape.id === id ? { ...shape, locked: !shape.locked } : shape)) : current.graphShapes,
      clipartImages: type === "clipart" ? current.clipartImages.map((clipart) => (clipart.id === id ? { ...clipart, locked: !clipart.locked } : clipart)) : current.clipartImages,
    }));
  }

  function reorderLayer(type: LayerKind, fromId: string, toId: string) {
    if (fromId === toId) return;
    setSettingsWithHistory((current) => {
      const list = type === "source" ? current.sourceImages : type === "cell" ? current.cellPaints : type === "shape" ? current.graphShapes : current.clipartImages;
      const fromIndex = list.findIndex((item) => item.id === fromId);
      const toIndex = list.findIndex((item) => item.id === toId);
      if (fromIndex < 0 || toIndex < 0) return current;
      if (list[fromIndex]?.locked || list[toIndex]?.locked) return current;
      if (type === "source") return { ...current, sourceImages: reorderSourceImages(current.sourceImages, fromIndex, toIndex) };
      const nextList = [...list];
      const [item] = nextList.splice(fromIndex, 1);
      nextList.splice(toIndex, 0, item);
      if (type === "cell") return { ...current, cellPaints: nextList as GraphCellPaint[] };
      if (type === "clipart") return { ...current, clipartImages: nextList as GraphClipartImage[] };
      return { ...current, graphShapes: nextList as GraphShapeDrawing[] };
    });
  }

  function handleLayerDragStart(type: LayerKind, id: string) {
    return (event: ReactDragEvent<HTMLButtonElement>) => {
      const list = type === "source" ? settingsRef.current.sourceImages : type === "cell" ? settingsRef.current.cellPaints : type === "shape" ? settingsRef.current.graphShapes : settingsRef.current.clipartImages;
      const item = list.find((entry) => entry.id === id);
      if (!item || item.locked) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(`application/x-graph-layer-reorder:${type}`, id);
      setLayerReorderPreview({ type, draggedId: id, targetId: null });
    };
  }

  function handleLayerDragOver(type: LayerKind, targetId: string) {
    return (event: ReactDragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes(`application/x-graph-layer-reorder:${type}`)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setLayerReorderPreview((current) => {
        if (!current || current.type !== type || current.targetId === targetId) return current;
        return { ...current, targetId };
      });
    };
  }

  function handleLayerDrop(type: LayerKind, targetId: string) {
    return (event: ReactDragEvent<HTMLDivElement>) => {
      const draggedId = event.dataTransfer.getData(`application/x-graph-layer-reorder:${type}`);
      event.preventDefault();
      setLayerReorderPreview(null);
      if (!draggedId || draggedId === targetId) return;
      reorderLayer(type, draggedId, targetId);
    };
  }

  function handleLayerDragEnd() {
    setLayerReorderPreview(null);
  }

  function removeDrawingLayer(
    type: "cell" | "shape" | "clipart",
    id: string,
    name: string,
    locked: boolean,
    options: { skipConfirm?: boolean } = {},
  ) {
    if (locked) return;
    if (!options.skipConfirm && !window.confirm(`Delete "${name}" from this project?`)) return;
    setSettingsWithHistory((current) => ({
      ...current,
      cellPaints: type === "cell" ? current.cellPaints.filter((cell) => cell.id !== id) : current.cellPaints,
      graphShapes: type === "shape" ? current.graphShapes.filter((shape) => shape.id !== id) : current.graphShapes,
      clipartImages: type === "clipart" ? current.clipartImages.filter((clipart) => clipart.id !== id) : current.clipartImages,
    }));
    setSelectedDrawingLayerId((current) => (current === drawingLayerKey(type, id) ? null : current));
  }

  function moveDrawingLayer(type: "cell" | "shape" | "clipart", id: string, direction: -1 | 1) {
    setSettingsWithHistory((current) => {
      const list = type === "cell" ? current.cellPaints : type === "shape" ? current.graphShapes : current.clipartImages;
      const index = list.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= list.length) return current;
      if (list[index]?.locked || list[nextIndex]?.locked) return current;
      const nextList = [...list];
      const [item] = nextList.splice(index, 1);
      nextList.splice(nextIndex, 0, item);
      if (type === "cell") return { ...current, cellPaints: nextList as GraphCellPaint[] };
      if (type === "clipart") return { ...current, clipartImages: nextList as GraphClipartImage[] };
      return { ...current, graphShapes: nextList as GraphShapeDrawing[] };
    });
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
    setSelectedDrawingLayerId((current) => (current?.startsWith("shape:") ? null : current));
    setLayerChooser(null);
  }

  function updateFillRegionColor(regionId: string, color: string) {
    if (!isFillColor(color)) return;
    setSettingsWithHistory((current) => {
      const fillRegions = { ...current.fillRegions };
      const region = fillRegionsById.get(regionId);
      const defaultColor = region ? defaultFillRegionColor(region, current) : current.fillColor;
      if (color.toLowerCase() === defaultColor.toLowerCase()) delete fillRegions[regionId];
      else fillRegions[regionId] = color;
      if (region?.legacyId) delete fillRegions[region.legacyId];
      for (const fallbackId of region?.fallbackIds ?? []) delete fillRegions[fallbackId];
      return { ...current, fillRegions };
    });
  }

  function resetFillRegionColor(regionId: string) {
    setSettingsWithHistory((current) => {
      const fillRegions = { ...current.fillRegions };
      delete fillRegions[regionId];
      const region = fillRegionsById.get(regionId);
      const legacyId = region?.legacyId;
      if (legacyId) delete fillRegions[legacyId];
      for (const fallbackId of region?.fallbackIds ?? []) delete fillRegions[fallbackId];
      return { ...current, fillRegions };
    });
  }

  function graphPointAtClientPosition(clientX: number, clientY: number) {
    const canvas = previewCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || !canvas.width || !canvas.height) return null;

    const canvasX = ((clientX - rect.left) * canvas.width) / rect.width;
    const canvasY = ((clientY - rect.top) * canvas.height) / rect.height;
    return {
      x: canvasX / GRAPH_MAJOR_CELL_PIXELS,
      y: canvasY / GRAPH_MAJOR_CELL_PIXELS,
    };
  }

  function sourceLayerHitsAtPoint(graphX: number, graphY: number): LayerHit[] {
    const current = settingsRef.current;
    const hits: LayerHit[] = [];
    const layouts = sourceLayouts(current.sourceImages);
    const sourceGraphX = graphX - current.imageOffsetX / GRAPH_MAJOR_CELL_PIXELS;
    const sourceGraphY = graphY - current.imageOffsetY / GRAPH_MAJOR_CELL_PIXELS;

    for (let index = layouts.length - 1; index >= 0; index -= 1) {
      const layout = layouts[index];
      if (!layout || layout.source.visible === false) continue;
      if (sourceGraphX < layout.x || sourceGraphX > layout.x + layout.width || sourceGraphY < layout.y || sourceGraphY > layout.y + layout.height) continue;
      hits.push({
        key: `source:${layout.source.id}`,
        type: "source",
        id: layout.source.id,
        name: layout.source.name,
        detail: "Source image",
        layout,
      });
    }
    return hits;
  }

  /**
   * Precise source hit testing for destructive tools. Selection intentionally
   * keeps its forgiving layout-box hit areas, while erase/lasso operate only
   * on the rendered, transformed source-content frames. The eraser can expand
   * the hit by its graph-space brush radius so an image is affected whenever
   * its visible content sits inside the brush, not just beneath its centre.
   */
  function erasableSourceHitsAtPoint(
    graphX: number,
    graphY: number,
    options: { brushRadius?: number; brushShape?: GraphEraseBrushShape } = {},
  ): LayerHit[] {
    const current = settingsRef.current;
    const hits: LayerHit[] = [];
    const layouts = sourceLayouts(current.sourceImages);
    const graphPixelX = graphX * GRAPH_MAJOR_CELL_PIXELS;
    const graphPixelY = graphY * GRAPH_MAJOR_CELL_PIXELS;

    for (let index = layouts.length - 1; index >= 0; index -= 1) {
      const layout = layouts[index];
      const source = layout?.source;
      if (!source || source.visible === false || source.locked) continue;
      const pristine = sourceCanvasesRef.current.get(source.id);
      if (!pristine) continue;
      const bounds = findContentBounds(pristine);
      const placement: PlacementTransform = {
        drawX: layout.x * GRAPH_MAJOR_CELL_PIXELS + current.imageOffsetX,
        drawY: layout.y * GRAPH_MAJOR_CELL_PIXELS + current.imageOffsetY,
        drawWidth: layout.width * GRAPH_MAJOR_CELL_PIXELS,
        drawHeight: layout.height * GRAPH_MAJOR_CELL_PIXELS,
        rotationDegrees: source.rotationDegrees,
        flipX: source.flipX,
        flipY: source.flipY,
      };
      const brushRadius = options.brushRadius;
      // Lasso uses the shared `GraphEraseBrushShape` union too, but a
      // pointer-driven brush can only render a circle or square footprint.
      const brushShape = options.brushShape === "square" ? "square" : "circle";
      const intersects = brushRadius && brushRadius > 0
        ? graphBrushIntersectsPlacedContent(
            graphPixelX,
            graphPixelY,
            brushRadius,
            brushShape,
            placement,
            bounds,
          )
        : isGraphPixelWithinPlacedContent(graphPixelX, graphPixelY, placement, bounds, 1);
      if (!intersects) continue;
      hits.push({
        key: `source:${source.id}`,
        type: "source",
        id: source.id,
        name: source.name,
        detail: "Source image",
        layout,
      });
    }
    return hits;
  }

  function layerHitsAtPoint(graphX: number, graphY: number): LayerHit[] {
    const current = settingsRef.current;
    const point = { x: graphX, y: graphY };
    const hits: LayerHit[] = [];

    for (let index = current.clipartImages.length - 1; index >= 0; index -= 1) {
      const clipart = current.clipartImages[index];
      if (!clipart || clipart.visible === false) continue;
      const width = Math.max(0.01, Math.abs(clipart.width));
      const height = Math.max(0.01, Math.abs(clipart.height));
      const left = Math.min(clipart.x, clipart.x + clipart.width);
      const top = Math.min(clipart.y, clipart.y + clipart.height);
      if (graphX < left || graphX > left + width || graphY < top || graphY > top + height) continue;
      hits.push({
        key: drawingLayerKey("clipart", clipart.id),
        type: "clipart",
        id: clipart.id,
        name: clipart.name,
        detail: "Clipart image",
        clipart,
      });
    }

    for (let index = current.graphShapes.length - 1; index >= 0; index -= 1) {
      const shape = current.graphShapes[index];
      if (!shape || shape.visible === false) continue;
      const openPathHit =
        shape.kind === "line" || shape.kind === "arrow"
          ? measureGeneratedOpenPathHit(shape, point, {
              cellSizeCm: current.cellSizeCm,
            })
          : null;
      if (shape.kind === "line" || shape.kind === "arrow") {
        if (!openPathHit) continue;
      } else {
        const width = Math.max(0.01, Math.abs(shape.width));
        const height = Math.max(0.01, Math.abs(shape.height));
        const left = Math.min(shape.x, shape.x + shape.width);
        const top = Math.min(shape.y, shape.y + shape.height);
        if (graphX < left || graphX > left + width || graphY < top || graphY > top + height) continue;
      }
      hits.push({
        key: drawingLayerKey("shape", shape.id),
        type: "shape",
        id: shape.id,
        name: shape.name,
        detail: `Generated ${GRAPH_SHAPE_KIND_LABELS[shape.kind]?.toLowerCase() ?? "shape"}`,
        shape,
        openPathHit: openPathHit ?? undefined,
      });
    }

    hits.push(...sourceLayerHitsAtPoint(graphX, graphY));
    return hits;
  }

  function graphPointAtPointer(event: ReactPointerEvent<HTMLElement>) {
    return graphPointAtClientPosition(event.clientX, event.clientY);
  }

  function drawingId(prefix: string) {
    return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;
  }

  function selectSourceLayer(sourceId: string, options: { additive?: boolean } = {}) {
    setPrimarySelection(sourceLayerKey(sourceId), options);
  }

  function selectCellLayer(cellId: string, options: { additive?: boolean } = {}) {
    setPrimarySelection(drawingLayerKey("cell", cellId), options);
  }

  function selectGeneratedShape(shapeId: string, options: { additive?: boolean } = {}) {
    setPrimarySelection(drawingLayerKey("shape", shapeId), options);
  }

  function selectClipartLayer(clipartId: string, options: { additive?: boolean } = {}) {
    setPrimarySelection(drawingLayerKey("clipart", clipartId), options);
  }

  function selectLayerChoice(choice: LayerChoice) {
    if (choice.type === "source") {
      selectSourceLayer(choice.id);
    } else if (choice.type === "clipart") {
      selectClipartLayer(choice.id);
    } else {
      selectGeneratedShape(choice.id);
    }
    setLayerChooser(null);
    setFloatingPalette(null);
  }

  function setDraftShapeSide(side: GraphCellLineSide, checked: boolean) {
    setDraftShapeSides((current) => {
      const next = checked ? Array.from(new Set([...current, side])) : current.filter((item) => item !== side);
      return next.length ? next : current;
    });
  }

  function addGeneratedShapeAtPoint(point: { x: number; y: number }) {
    const id = drawingId("shape");
    const { width, height } = draftShapeDimensionsCells(settingsRef.current.cellSizeCm);
    const kind = draftShapeKind;
    const x = clampFreeCellCoordinate(snapCellToGrid(point.x - width / 2), 0);
    const y = clampFreeCellCoordinate(snapCellToGrid(point.y - height / 2), 0);
    const fillColor = draftShapeFillMode === "filled" ? draftShapeFillColor : TRANSPARENT_FILL_COLOR;
    const sides = shapeSupportsSides(kind) ? [...draftShapeSides] : [...CELL_LINE_SIDE_KEYS];
    setSettingsWithHistory((current) => ({
      ...current,
      graphShapes: [
        ...current.graphShapes,
        {
          id,
          name: `${GRAPH_SHAPE_KIND_LABELS[kind]} ${current.graphShapes.length + 1}`,
          kind,
          x,
          y,
          width,
          height,
          strokeColor: draftShapeStrokeColor,
          fillColor,
          strokeWidth: Math.max(1, Math.min(24, Math.round(draftShapeStrokeWidth))),
          strokeStyle: draftShapeStrokeStyle,
          sides,
          locked: false,
          visible: true,
          rotationDegrees: 0,
          flipX: false,
          flipY: false,
        },
      ],
    }));
    // Creating another shape should not move the editor into Selection mode.
    setLayerChooser(null);
    setFloatingPalette(null);
    return id;
  }

  function addGeneratedShapeInCell(
    kind: ClosedGeneratedShapeKind,
    point: { x: number; y: number },
  ) {
    const bounds = oneCellBoundsAtGraphPoint(point, {
      width: settingsRef.current.graphWidth,
      height: settingsRef.current.graphHeight,
    });
    if (!bounds) return null;

    const id = drawingId("shape");
    const fillColor =
      draftShapeFillMode === "filled"
        ? draftShapeFillColor
        : TRANSPARENT_FILL_COLOR;
    const sides = shapeSupportsSides(kind)
      ? [...draftShapeSides]
      : [...CELL_LINE_SIDE_KEYS];

    setSettingsWithHistory((current) => ({
      ...current,
      graphShapes: [
        ...current.graphShapes,
        {
          id,
          name: `${GRAPH_SHAPE_KIND_LABELS[kind]} ${current.graphShapes.length + 1}`,
          kind,
          ...bounds,
          strokeColor: draftShapeStrokeColor,
          fillColor,
          strokeWidth: Math.max(1, Math.min(24, Math.round(draftShapeStrokeWidth))),
          strokeStyle: "solid",
          sides,
          locked: false,
          visible: true,
          rotationDegrees: 0,
          flipX: false,
          flipY: false,
        },
      ],
    }));
    // Keep the creation tool active; the new shape is selected only when the
    // user explicitly chooses it from the canvas or Scene.
    setLayerChooser(null);
    setFloatingPalette(null);
    return id;
  }

  function addClipartAtPoint(assetId: string, point: { x: number; y: number }) {
    const asset = settingsRef.current.clipartAssets.find((item) => item.id === assetId);
    if (!asset) return null;
    const id = drawingId("clipart");
    const { width, height } = draftClipartDimensionsCells(asset, settingsRef.current.cellSizeCm);
    const x = clampFreeCellCoordinate(snapCellToGrid(point.x - width / 2), 0);
    const y = clampFreeCellCoordinate(snapCellToGrid(point.y - height / 2), 0);
    setSettingsWithHistory((current) => ({
      ...current,
      clipartImages: [
        ...current.clipartImages,
        {
          id,
          name: `${asset.name.replace(/\.[^.]+$/, "") || "Clipart"} ${current.clipartImages.length + 1}`,
          assetId,
          x,
          y,
          width,
          height,
          strokeColor: draftClipartStrokeColor,
          fillColor: draftClipartFillColor,
          imageLineThickness: current.imageLineThickness,
          sourceFillThreshold: current.sourceFillThreshold,
          sourceFillMinStrokePixels: current.sourceFillMinStrokePixels,
          strokeGapClosePixels: current.strokeGapClosePixels,
          imageAutoEnhance: current.imageAutoEnhance,
          imageDenoiseLevel: current.imageDenoiseLevel,
          imageEdgeDetection: current.imageEdgeDetection,
          imageColorQuantization: current.imageColorQuantization,
          vectorizerLineAdjust: current.vectorizerLineAdjust,
          vectorizerInkThreshold: current.vectorizerInkThreshold,

          vectorizerSketchRemoval: current.vectorizerSketchRemoval,
          vectorizerFidelity: current.vectorizerFidelity,
          locked: false,
          visible: true,
          rotationDegrees: 0,
          flipX: false,
          flipY: false,
        },
      ],
    }));
    selectClipartLayer(id);
    setLayerChooser(null);
    setFloatingPalette(null);
    return id;
  }

  function placeGeneratedShapeFromClientPoint(clientX: number, clientY: number) {
    const point = graphPointAtClientPosition(clientX, clientY);
    if (!point) return false;
    addGeneratedShapeAtPoint(point);
    setPlacingGeneratedShape(false);
    return true;
  }

  function placeClipartFromClientPoint(assetId: string, clientX: number, clientY: number) {
    const point = graphPointAtClientPosition(clientX, clientY);
    if (!point) return false;
    addClipartAtPoint(assetId, point);
    setPlacingClipartAssetId(null);
    return true;
  }

  function handleGeneratedShapeDragStart(event: ReactDragEvent<HTMLElement>) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-graph-generated-shape", draftShapeKind);
    setPlacingGeneratedShape(true);
  }

  function handleClipartDragStart(assetId: string) {
    return (event: ReactDragEvent<HTMLElement>) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("application/x-graph-clipart", assetId);
      setPlacingClipartAssetId(assetId);
    };
  }

  function hasGeneratedShapeTransfer(types: readonly string[] | DOMStringList) {
    return Array.from(types as ArrayLike<string>).includes("application/x-graph-generated-shape");
  }

  function clipartTransferId(dataTransfer: DataTransfer) {
    if (!Array.from(dataTransfer.types as ArrayLike<string>).includes("application/x-graph-clipart")) return "";
    return dataTransfer.getData("application/x-graph-clipart");
  }

  function handleGeneratedShapeDrop(event: ReactDragEvent<HTMLElement>) {
    const droppedClipartId = clipartTransferId(event.dataTransfer);
    if (droppedClipartId) {
      event.preventDefault();
      event.stopPropagation();
      placeClipartFromClientPoint(droppedClipartId, event.clientX, event.clientY);
      return;
    }
    if (!placingGeneratedShape && !hasGeneratedShapeTransfer(event.dataTransfer.types)) return;
    event.preventDefault();
    event.stopPropagation();
    placeGeneratedShapeFromClientPoint(event.clientX, event.clientY);
  }

  function handleGeneratedShapeDragOver(event: ReactDragEvent<HTMLElement>) {
    if (!placingGeneratedShape && !placingClipartAssetId && !hasGeneratedShapeTransfer(event.dataTransfer.types) && !clipartTransferId(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
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
    selectCellLayer(selectedPaintId);

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
        visible: existing?.visible ?? true,
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

  function placementForSource(source: GraphSourceImage): { placement: PlacementTransform; bounds: ContentBounds } | null {
    const layout = sourceLayouts(settingsRef.current.sourceImages).find((entry) => entry.source.id === source.id);
    const pristine = sourceCanvasesRef.current.get(source.id);
    if (!layout || !pristine) return null;
    const bounds = findContentBounds(pristine);
    const placement: PlacementTransform = {
      drawX: layout.x * GRAPH_MAJOR_CELL_PIXELS + settingsRef.current.imageOffsetX,
      drawY: layout.y * GRAPH_MAJOR_CELL_PIXELS + settingsRef.current.imageOffsetY,
      drawWidth: layout.width * GRAPH_MAJOR_CELL_PIXELS,
      drawHeight: layout.height * GRAPH_MAJOR_CELL_PIXELS,
      rotationDegrees: source.rotationDegrees,
      flipX: source.flipX,
      flipY: source.flipY,
    };
    return { placement, bounds };
  }

  function updateLassoCursor(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (drawingTool !== "lasso" || !lassoVertices.length) {
      if (lassoCursor) setLassoCursor(null);
      return;
    }
    const point = graphPointAtPointer(event);
    setLassoCursor(point ? { x: point.x, y: point.y } : null);
  }

  function clearImageEraserCursor() {
    imageEraserCursorRef.current = null;
    const cursor = imageEraserCursorNodeRef.current;
    if (cursor) cursor.style.display = "none";
  }

  function paintImageEraserCursor(next: Exclude<ImageEraserCursor, null>) {
    imageEraserCursorRef.current = next;
    const cursor = imageEraserCursorNodeRef.current;
    if (!cursor) return;
    cursor.style.display = "block";
    cursor.style.left = `${next.x - next.radius}px`;
    cursor.style.top = `${next.y - next.radius}px`;
    cursor.style.width = `${next.radius * 2}px`;
    cursor.style.height = `${next.radius * 2}px`;
  }

  function updateImageEraserCursor(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (drawingTool !== "image-eraser" || showOriginal) {
      clearImageEraserCursor();
      return;
    }
    const point = graphPointAtPointer(event);
    if (!point) {
      clearImageEraserCursor();
      return;
    }

    // The brush stays visible anywhere inside the graph, not only over an
    // image. It intentionally has no selected-layer affinity: every unlocked
    // source whose content intersects the footprint is eligible for the same
    // erase gesture. Its on-canvas ring deliberately comes straight from the
    // graph-space size, never from a hovered source image's intrinsic scale.
    const radius = Math.max(4, imageEraserRadiusRef.current * zoom);
    const next = {
      x: outsideNumberMargin + point.x * GRAPH_MAJOR_CELL_PIXELS * zoom,
      y: outsideNumberMargin + point.y * GRAPH_MAJOR_CELL_PIXELS * zoom,
      radius,
    };
    if (!Number.isFinite(next.x) || !Number.isFinite(next.y) || !Number.isFinite(next.radius)) {
      clearImageEraserCursor();
      return;
    }
    const current = imageEraserCursorRef.current;
    if (
      current
      && Math.abs(current.x - next.x) < 0.5
      && Math.abs(current.y - next.y) < 0.5
      && Math.abs(current.radius - next.radius) < 0.5
    ) return;
    paintImageEraserCursor(next);
  }

  /**
   * Resolves every rendered source currently touched by the brush. A target
   * keeps only its own source-local path state, so one drag stays a single
   * undo step without joining strokes across unrelated images when the brush
   * leaves and re-enters an overlap.
   */
  function collectEraseTargetsAtPoint(
    dragState: DragState,
    point: { x: number; y: number },
  ): ImageEraseTarget[] {
    const targets = dragState.eraseTargets ?? new Map<string, ImageEraseTarget>();
    dragState.eraseTargets = targets;
    const activeIds = new Set<string>();
    const activeTargets: ImageEraseTarget[] = [];

    for (const hit of erasableSourceHitsAtPoint(point.x, point.y, {
      brushRadius: imageEraserRadiusRef.current,
      brushShape: imageEraserShapeRef.current,
    })) {
      if (hit.type !== "source") continue;
      const source = hit.layout.source;
      const details = placementForSource(source);
      const pristine = sourceCanvasesRef.current.get(source.id);
      if (!details || !pristine?.width || !pristine.height) continue;

      let target = targets.get(source.id);
      if (!target) {
        target = {
          sourceId: source.id,
          bounds: details.bounds,
          placement: details.placement,
          canvasWidth: pristine.width,
          canvasHeight: pristine.height,
          startsNewStroke: true,
        };
        targets.set(source.id, target);
      } else {
        target.bounds = details.bounds;
        target.placement = details.placement;
        target.canvasWidth = pristine.width;
        target.canvasHeight = pristine.height;
      }
      activeIds.add(source.id);
      activeTargets.push(target);
    }

    // A later re-entry must start a new stroke for that source, otherwise a
    // gap between images would be bridged by a line of erased pixels.
    for (const [sourceId, target] of targets) {
      if (!activeIds.has(sourceId)) target.startsNewStroke = true;
    }
    return activeTargets;
  }

  function startImageEraseAtPointer(event: ReactPointerEvent<HTMLElement>, dragState: DragState) {
    const point = graphPointAtPointer(event);
    if (!point || !collectEraseTargetsAtPoint(dragState, point).length) {
      setNotice({ tone: "info", text: "Start the brush on an unlocked image to erase." });
      return;
    }
    eraseImageAtPointer(event, dragState);
  }

  /**
   * How near the first vertex a click must land to close the region, expressed
   * in centimetres and converted to cells, since a cell is only 1 cm at the
   * default cell size. The floor keeps it clickable on a very fine grid.
   */
  const LASSO_CLOSE_DISTANCE_CM = 0.3;
  const lassoCloseDistanceCells = Math.max(0.5, LASSO_CLOSE_DISTANCE_CM / Math.max(0.01, settings.cellSizeCm || 1));

  function cancelLasso() {
    lassoVerticesRef.current = [];
    setLassoVertices([]);
    setLassoCursor(null);
  }

  /**
   * Resolves every unlocked source touched or enclosed by a lasso. The lasso
   * has no selected/topmost affinity: intersecting artwork is the only target
   * rule, which makes overlapping source edits deterministic.
   */
  function resolveLassoTargetSources(vertices: LassoVertex[]): GraphSourceImage[] {
    const graphPoints = vertices.map((vertex) => ({
      x: vertex.x * GRAPH_MAJOR_CELL_PIXELS,
      y: vertex.y * GRAPH_MAJOR_CELL_PIXELS,
    }));
    return sourceRenderOrder(settingsRef.current.sourceImages).flatMap((layout) => {
      const source = layout.source;
      if (source.visible === false || source.locked) return [];
      const details = placementForSource(source);
      return details && graphPolygonIntersectsPlacedContent(graphPoints, details.placement, details.bounds, 1)
        ? [source]
        : [];
    });
  }

  /**
   * Commits one traced region to every intersected source. The polygon is
   * clipped in each source's own coordinate system before it is converted to
   * normalized UV, so a large lasso can safely cover a smaller overlapping
   * image without producing invalid coordinates or selecting a single layer.
   */
  function commitLassoRegion(vertices: LassoVertex[]) {
    if (vertices.length < 3) {
      setNotice({ tone: "info", text: "Place at least three points before closing." });
      return;
    }
    const targets = resolveLassoTargetSources(vertices);
    if (!targets.length) {
      setNotice({ tone: "info", text: "Trace a region that intersects an unlocked image." });
      return;
    }
    const graphPoints = vertices.map((vertex) => ({
      x: vertex.x * GRAPH_MAJOR_CELL_PIXELS,
      y: vertex.y * GRAPH_MAJOR_CELL_PIXELS,
    }));
    const targetPolygons = new Map<string, LassoVertex[]>();
    let hasLoadingTarget = false;
    for (const target of targets) {
      const details = placementForSource(target);
      const pristine = sourceCanvasesRef.current.get(target.id);
      if (!details || !pristine?.width || !pristine.height) {
        hasLoadingTarget = true;
        continue;
      }
      const sourcePolygon = clipGraphPolygonToPlacedContent(graphPoints, details.placement, details.bounds);
      if (sourcePolygon.length < 3) continue;
      const points = sourcePolygon.map((point) => ({ x: point.x / pristine.width, y: point.y / pristine.height }));
      const outOfRange = points.some((point) => (
        point.x < -MAX_POLYGON_UV_OVERSHOOT
        || point.x > 1 + MAX_POLYGON_UV_OVERSHOOT
        || point.y < -MAX_POLYGON_UV_OVERSHOOT
        || point.y > 1 + MAX_POLYGON_UV_OVERSHOOT
      ));
      if (!outOfRange) targetPolygons.set(target.id, points);
    }
    if (!targetPolygons.size) {
      setNotice({
        tone: hasLoadingTarget ? "error" : "info",
        text: hasLoadingTarget
          ? "The intersected images are still loading. Try again in a moment."
          : "Trace a region that overlaps image content.",
      });
      return;
    }

    // Source-local clipping keeps every polygon within the normalized-UV
    // contract before it reaches `normalizeEraseStrokes`.
    const fill = lassoFill === "erase" ? undefined : lassoFill;
    setSettingsWithHistory((current) => {
      let changed = false;
      const sourceImages = current.sourceImages.map((source) => {
        const points = targetPolygons.get(source.id);
        if (!points) return source;
        changed = true;
        const nextStroke = fill
          ? { points, radius: 0.01, shape: "polygon" as const, fill }
          : { points, radius: 0.01, shape: "polygon" as const };
        return {
          ...source,
          eraseStrokes: normalizeEraseStrokes([...(source.eraseStrokes ?? []), nextStroke]),
        };
      });
      return changed ? deriveGraphSettings({ ...current, sourceImages }) : current;
    });
    cancelLasso();
  }

  function handleLassoPointerDown(event: ReactPointerEvent<HTMLElement>) {
    const point = graphPointAtPointer(event);
    if (!point) return;
    const placed = lassoVerticesRef.current;
    const first = placed[0];
    // Clicking back on the first vertex encloses the region.
    if (first && placed.length >= 3 && Math.hypot(point.x - first.x, point.y - first.y) <= lassoCloseDistanceCells) {
      commitLassoRegion(placed);
      return;
    }
    const next = [...placed, { x: point.x, y: point.y }];
    lassoVerticesRef.current = next;
    setLassoVertices(next);
  }

  /**
   * Paints the same source-local brush footprint into the visible preview while
   * the expensive vector pass is deferred. The clip is essential: it keeps a
   * target's temporary cut inside that image's transformed pristine content
   * frame instead of blanking neighbouring graph content outside the image.
   */
  function paintEraseFootprintPreview(
    target: ImageEraseTarget,
    sourcePoint: { x: number; y: number },
    previousSourcePoint: { x: number; y: number } | undefined,
  ) {
    const preview = previewCanvasRef.current;
    const { placement, bounds } = target;
    if (!preview || !bounds.width || !bounds.height) return;
    const context = preview.getContext("2d");
    if (!context) return;

    const rotation = ((placement.rotationDegrees % 360) + 360) % 360;
    const rotatedSideways = rotation === 90 || rotation === 270;
    const fittedWidth = rotatedSideways ? placement.drawHeight : placement.drawWidth;
    const fittedHeight = rotatedSideways ? placement.drawWidth : placement.drawHeight;
    const centerX = placement.drawX + placement.drawWidth / 2;
    const centerY = placement.drawY + placement.drawHeight / 2;
    const sourceCenterX = bounds.x + bounds.width / 2;
    const sourceCenterY = bounds.y + bounds.height / 2;
    const radius = sourcePixelRadiusForGraphBrush(
      imageEraserRadiusRef.current,
      placement,
      bounds,
    );

    context.save();
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = "rgba(0,0,0,1)";
    context.strokeStyle = "rgba(0,0,0,1)";
    context.translate(centerX, centerY);
    context.rotate((rotation * Math.PI) / 180);
    context.scale(placement.flipX ? -1 : 1, placement.flipY ? -1 : 1);
    context.scale(fittedWidth / bounds.width, fittedHeight / bounds.height);
    context.translate(-sourceCenterX, -sourceCenterY);
    context.beginPath();
    context.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.clip();

    if (imageEraserShapeRef.current === "square") {
      const size = radius * 2;
      const stamp = (x: number, y: number) => context.fillRect(x - radius, y - radius, size, size);
      if (previousSourcePoint) {
        const distance = Math.hypot(sourcePoint.x - previousSourcePoint.x, sourcePoint.y - previousSourcePoint.y);
        const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius / 2)));
        for (let step = 1; step <= steps; step += 1) {
          stamp(
            previousSourcePoint.x + ((sourcePoint.x - previousSourcePoint.x) * step) / steps,
            previousSourcePoint.y + ((sourcePoint.y - previousSourcePoint.y) * step) / steps,
          );
        }
      }
      stamp(sourcePoint.x, sourcePoint.y);
    } else {
      if (previousSourcePoint) {
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = radius * 2;
        context.beginPath();
        context.moveTo(previousSourcePoint.x, previousSourcePoint.y);
        context.lineTo(sourcePoint.x, sourcePoint.y);
        context.stroke();
      }
      context.beginPath();
      context.arc(sourcePoint.x, sourcePoint.y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function eraseImageAtPointer(event: ReactPointerEvent<HTMLElement>, dragState: DragState) {
    const point = graphPointAtPointer(event);
    if (!point) return;
    const mutations = new Map<string, {
      point: { x: number; y: number };
      radius: number;
      startNewStroke: boolean;
      target: ImageEraseTarget;
      sourcePoint: { x: number; y: number };
      previousSourcePoint?: { x: number; y: number };
    }>();

    for (const target of collectEraseTargetsAtPoint(dragState, point)) {
      if (!target.canvasWidth || !target.canvasHeight) continue;
      const sourceRadiusPx = sourcePixelRadiusForGraphBrush(
        imageEraserRadiusRef.current,
        target.placement,
        target.bounds,
      );
      const minStep = Math.max(1, sourceRadiusPx * 0.6);
      const mappedPoint = graphPixelToSourcePixel(
        point.x * GRAPH_MAJOR_CELL_PIXELS,
        point.y * GRAPH_MAJOR_CELL_PIXELS,
        target.placement,
        target.bounds,
      );
      // A brush can meet an image at its content edge while its centre is just
      // outside the source canvas. Store the nearest valid UV centre; canvas
      // clipping preserves only the portion that actually overlaps the image.
      const sourcePoint = {
        x: Math.min(target.canvasWidth, Math.max(0, mappedPoint.x)),
        y: Math.min(target.canvasHeight, Math.max(0, mappedPoint.y)),
      };
      const last = target.lastPoint;
      if (last && Math.hypot(sourcePoint.x - last.x, sourcePoint.y - last.y) < minStep) continue;
      target.lastPoint = sourcePoint;
      const startNewStroke = target.startsNewStroke;
      target.startsNewStroke = false;
      mutations.set(target.sourceId, {
        point: { x: sourcePoint.x / target.canvasWidth, y: sourcePoint.y / target.canvasHeight },
        radius: Math.max(0.001, Math.min(0.5, sourceRadiusPx / target.canvasWidth)),
        startNewStroke,
        target,
        sourcePoint,
        previousSourcePoint: startNewStroke ? undefined : last,
      });
    }
    if (!mutations.size) return;

    // Fast feedback is a preview only; every target still receives its own
    // persisted UV stroke below and the settled render remains authoritative.
    for (const mutation of mutations.values()) {
      paintEraseFootprintPreview(
        mutation.target,
        mutation.sourcePoint,
        mutation.previousSourcePoint,
      );
    }

    const current = settingsRef.current;
    if (!dragState.historyRecorded) {
      pushUndoSettings(current);
      dragState.historyRecorded = true;
    }
    const sourceImages = current.sourceImages.map((source) => {
      const mutation = mutations.get(source.id);
      if (!mutation) return source;
      const strokes = source.eraseStrokes
        ? source.eraseStrokes.map((stroke) => ({ ...stroke, points: [...stroke.points] }))
        : [];
      if (strokes.length && !mutation.startNewStroke) {
        const activeStroke = strokes[strokes.length - 1];
        strokes[strokes.length - 1] = { ...activeStroke, points: [...activeStroke.points, mutation.point] };
      } else {
        strokes.push({
          points: [mutation.point],
          radius: mutation.radius,
          shape: imageEraserShapeRef.current,
        });
      }
      return { ...source, eraseStrokes: normalizeEraseStrokes(strokes) };
    });
    const next = deriveGraphSettings({ ...current, sourceImages });
    settingsRef.current = next;
    setSettings(next);
  }

  function startLineAtPointer(event: ReactPointerEvent<HTMLElement>, dragState: DragState) {
    const point = graphPointAtPointer(event);
    if (!point) return;
    dragState.startGraphX = point.x;
    dragState.startGraphY = point.y;
  }

  function updateLineAtPointer(event: ReactPointerEvent<HTMLElement>, dragState: DragState) {
    if (!dragState.moved || dragState.startGraphX === undefined || dragState.startGraphY === undefined) return;
    const point = graphPointAtPointer(event);
    if (!point) return;
    const start = { x: dragState.startGraphX, y: dragState.startGraphY };
    const end = alignLineEndpointToCellAxis(start, point, { bypass: event.altKey });
    const width = roundCells(end.x - start.x);
    const height = roundCells(end.y - start.y);
    if (width === 0 && height === 0) {
      if (dragState.shapeId) {
        const shapeId = dragState.shapeId;
        const current = settingsRef.current;
        if (current.graphShapes.some((shape) => shape.id === shapeId)) {
          const next = deriveGraphSettings({
            ...current,
            graphShapes: current.graphShapes.filter((shape) => shape.id !== shapeId),
          });
          settingsRef.current = next;
          setSettings(next);
        }
        dragState.shapeId = undefined;
        dragState.historyRecorded = false;
      }
      return;
    }

    const current = settingsRef.current;
    const shapeId = dragState.shapeId ?? drawingId("shape");
    const existing = current.graphShapes.find((shape) => shape.id === shapeId);
    const lineKind = draftShapeKind === "arrow" ? "arrow" : "line";
    let graphShapes: GraphShapeDrawing[];

    if (existing) {
      if (
        existing.x === start.x &&
        existing.y === start.y &&
        existing.width === width &&
        existing.height === height
      ) {
        return;
      }
      graphShapes = current.graphShapes.map((shape) =>
        shape.id === shapeId
          ? { ...shape, x: start.x, y: start.y, width, height }
          : shape,
      );
    } else {
      dragState.shapeId = shapeId;
      graphShapes = [
        ...current.graphShapes,
        {
          id: shapeId,
          name: `${GRAPH_SHAPE_KIND_LABELS[lineKind]} ${current.graphShapes.length + 1}`,
          kind: lineKind,
          x: start.x,
          y: start.y,
          width,
          height,
          strokeColor: draftShapeStrokeColor,
          fillColor: TRANSPARENT_FILL_COLOR,
          strokeWidth: Math.max(1, Math.min(24, Math.round(draftShapeStrokeWidth))),
          strokeStyle: draftShapeStrokeStyle,
          sides: [...CELL_LINE_SIDE_KEYS],
          locked: false,
          visible: true,
          rotationDegrees: 0,
          flipX: false,
          flipY: false,
        },
      ];
    }

    if (!dragState.historyRecorded) {
      pushUndoSettings(current);
      dragState.historyRecorded = true;
    }
    const next = deriveGraphSettings({ ...current, graphShapes });
    settingsRef.current = next;
    setSettings(next);
  }

  function fillRegionIdAtPointer(event: FillRegionPointerEvent) {
    const canvas = event.currentTarget;
    const regionMap = fillRegionMapRef.current;
    if (!regionMap || !canvas.width || !canvas.height) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = Math.floor(((event.clientX - rect.left) * canvas.width) / rect.width);
    const y = Math.floor(((event.clientY - rect.top) * canvas.height) / rect.height);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;

    const regionNumber = regionMap[y * canvas.width + x];
    return regionNumber ? fillRegionIdByMapIdRef.current.get(regionNumber) ?? null : null;
  }

  function floatingPalettePosition(event: FillRegionPointerEvent) {
    const width = 244;
    const height = 216;
    const margin = 12;
    return {
      x: Math.max(margin, Math.min(window.innerWidth - width - margin, event.clientX + margin)),
      y: Math.max(margin, Math.min(window.innerHeight - height - margin, event.clientY + margin)),
    };
  }

  function selectFillRegionFromPointer(event: FillRegionPointerEvent, showPalette = false) {
    if (dragPreviewSourceId) return false;
    const regionId = fillRegionIdAtPointer(event);
    if (!regionId) {
      if (showPalette) setFloatingPalette(null);
      return false;
    }
    setSelectedFillRegionId(regionId);
    revealCommandCanvasInspector("palette");
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

  function openFillPaletteFromDoubleClick(event: ReactMouseEvent<HTMLCanvasElement>) {
    if (showOriginal) return;
    event.preventDefault();
    selectFillRegionFromPointer(event, true);
  }

  function beginGraphDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (showOriginal || event.button !== 0) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const viewportDrag = event.ctrlKey || spacePressedRef.current;

    if (canvasTool === "hand") {
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        kind: "pan",
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetX: settings.imageOffsetX,
        startOffsetY: settings.imageOffsetY,
        startPanX: canvasPan.x,
        startPanY: canvasPan.y,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        rectWidth: rect.width,
        rectHeight: rect.height,
        moved: false,
        historyRecorded: false,
      };
      beginGraphInteraction();
      return;
    }

    if (canvasTool === "fill") {
      event.preventDefault();
      setSelectedSourceId(null);
      setSelectedDrawingLayerId(null);
      setSelectedLayerKeys([]);
      selectFillRegionFromPointer(event, true);
      return;
    }

    if (!viewportDrag && placingClipartAssetId) {
      event.preventDefault();
      placeClipartFromClientPoint(placingClipartAssetId, event.clientX, event.clientY);
      return;
    }

    if (!viewportDrag && placingGeneratedShape) {
      event.preventDefault();
      placeGeneratedShapeFromClientPoint(event.clientX, event.clientY);
      return;
    }

    // The lasso places discrete vertices on click rather than starting a drag,
    // so it returns before any drag state is set up.
    if (!viewportDrag && canvasTool === "pointer" && drawingTool === "lasso") {
      event.preventDefault();
      handleLassoPointerDown(event);
      return;
    }

    if (!viewportDrag && canvasTool === "pointer" && drawingTool === "shape") {
      event.preventDefault();
      if (!armedShapeKind) return;
      const point = graphPointAtPointer(event);
      if (point) addGeneratedShapeInCell(armedShapeKind, point);
      return;
    }

    if (
      !viewportDrag &&
      canvasTool === "pointer" &&
      (drawingTool === "line" || drawingTool === "image-eraser")
    ) {
      event.preventDefault();
      const isImageErase = drawingTool === "image-eraser";
      setFloatingPalette(null);
      canvas.setPointerCapture(event.pointerId);
      const dragState: DragState = {
        kind: isImageErase ? "image-erase" : "shape-draw",
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
      if (isImageErase) {
        startImageEraseAtPointer(event, dragState);
        beginGraphInteraction();
      } else {
        startLineAtPointer(event, dragState);
      }
      return;
    }

    const point = graphPointAtPointer(event);
    const layerHits = point ? layerHitsAtPoint(point.x, point.y) : [];
    const currentSelection = new Set(selectedLayerKeysForAction(settingsRef.current));
    const selectedHit = layerHits.find((hit) => currentSelection.has(hit.key));
    const nearestOpenPathHit = layerHits.reduce<LayerHit | null>((closest, hit) => {
      if (!hit.openPathHit) return closest;
      if (!closest?.openPathHit) return hit;
      if (hit.openPathHit.visibleDistanceCells < closest.openPathHit.visibleDistanceCells) return hit;
      if (
        hit.openPathHit.visibleDistanceCells === closest.openPathHit.visibleDistanceCells &&
        hit.openPathHit.centerlineDistanceCells < closest.openPathHit.centerlineDistanceCells
      ) {
        return hit;
      }
      return closest;
    }, null);
    // Open paths are precision targets over broad image rectangles. Selecting
    // the nearest buffered line directly keeps an underlying selected image
    // from swallowing the click.
    const activeHit = nearestOpenPathHit ?? selectedHit ?? (layerHits.length === 1 ? layerHits[0] : null);

    if (!viewportDrag && layerHits.length > 1 && !selectedHit && !nearestOpenPathHit) {
      event.preventDefault();
      setLayerChooser({
        x: event.clientX,
        y: event.clientY,
        choices: layerHits.map((hit) => ({
          key: hit.key,
          type: hit.type,
          id: hit.id,
          name: hit.name,
          detail: hit.detail,
        })),
      });
      setFloatingPalette(null);
      return;
    }

    const additiveSelection = event.shiftKey || event.ctrlKey || event.metaKey;
    const dragLayerKeys = activeHit && !viewportDrag
      ? nextLayerSelection(settingsRef.current, selectedLayerKeysForAction(settingsRef.current), activeHit.key, additiveSelection)
      : [];
    if (activeHit?.type === "source") {
      selectSourceLayer(activeHit.layout.source.id, { additive: additiveSelection });
      setLayerChooser(null);
    } else if (activeHit?.type === "shape") {
      selectGeneratedShape(activeHit.shape.id, { additive: additiveSelection });
      setLayerChooser(null);
    } else if (activeHit?.type === "clipart") {
      selectClipartLayer(activeHit.clipart.id, { additive: additiveSelection });
      setLayerChooser(null);
    }
    if (!activeHit && !viewportDrag) {
      setSelectedSourceId(null);
      setSelectedDrawingLayerId(null);
      setSelectedLayerKeys([]);
      setLayerChooser(null);
      selectFillRegionFromPointer(event);
      if (canvasTool === "pointer") return;
    }

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      kind: viewportDrag || !activeHit ? "viewport" : activeHit.type,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: settings.imageOffsetX,
      startOffsetY: settings.imageOffsetY,
      sourceId: activeHit?.type === "source" ? activeHit.layout.source.id : undefined,
      startSourceX: activeHit?.type === "source" ? activeHit.layout.source.x : undefined,
      startSourceY: activeHit?.type === "source" ? activeHit.layout.y : undefined,
      startSourceWidth: activeHit?.type === "source" ? activeHit.layout.source.width : undefined,
      startSourceHeight: activeHit?.type === "source" ? activeHit.layout.source.height : undefined,
      shapeId: activeHit?.type === "shape" ? activeHit.shape.id : undefined,
      startShapeX: activeHit?.type === "shape" ? activeHit.shape.x : undefined,
      startShapeY: activeHit?.type === "shape" ? activeHit.shape.y : undefined,
      clipartId: activeHit?.type === "clipart" ? activeHit.clipart.id : undefined,
      startClipartX: activeHit?.type === "clipart" ? activeHit.clipart.x : undefined,
      startClipartY: activeHit?.type === "clipart" ? activeHit.clipart.y : undefined,
      startScrollLeft: canvasScrollRef.current?.scrollLeft ?? 0,
      startScrollTop: canvasScrollRef.current?.scrollTop ?? 0,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      rectWidth: rect.width,
      rectHeight: rect.height,
      layerStarts: dragLayerKeys.length ? layerStartsForSelection(settingsRef.current, dragLayerKeys) : undefined,
      moved: false,
      historyRecorded: false,
    };
    beginGraphInteraction();
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
    setResizeHandleTarget("source");
    setSelectedSourceId(layout.source.id);
    setSelectedDrawingLayerId(null);
    setSelectedLayerKeys([sourceLayerKey(layout.source.id)]);
    setInspectorTab("source");
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
    beginGraphInteraction();
  }

  function beginShapeResize(event: ReactPointerEvent<HTMLElement>, shape: GraphShapeDrawing, resizeCorner: SourceResizeHandle) {
    if (showOriginal || event.button !== 0 || shape.locked) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizeHandleTarget("shape");
    setSelectedSourceId(null);
    setSelectedDrawingLayerId(drawingLayerKey("shape", shape.id));
    setSelectedLayerKeys([drawingLayerKey("shape", shape.id)]);
    setInspectorTab("source");
    dragStateRef.current = {
      kind: "resize-shape",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: settings.imageOffsetX,
      startOffsetY: settings.imageOffsetY,
      shapeId: shape.id,
      startShapeX: shape.x,
      startShapeY: shape.y,
      startShapeWidth: shape.width,
      startShapeHeight: shape.height,
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
    beginGraphInteraction();
  }

  function beginSelectionResize(event: ReactPointerEvent<HTMLElement>, resizeCorner: SourceResizeHandle) {
    const current = settingsRef.current;
    const keys = selectedLayerKeysForAction(current);
    if (showOriginal || event.button !== 0 || keys.length < 2 || layerSelectionContainsLocked(current, keys)) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const layerStarts = layerStartsForSelection(current, keys);
    const selectionBounds = selectionBoundsForLayerStarts(current, layerStarts);
    if (!selectionBounds) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizeHandleTarget("selection");
    dragStateRef.current = {
      kind: "resize-selection",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: current.imageOffsetX,
      startOffsetY: current.imageOffsetY,
      resizeCorner,
      startScrollLeft: canvasScrollRef.current?.scrollLeft ?? 0,
      startScrollTop: canvasScrollRef.current?.scrollTop ?? 0,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      rectWidth: rect.width,
      rectHeight: rect.height,
      layerStarts,
      selectionBounds,
      moved: false,
      historyRecorded: false,
    };
    beginGraphInteraction();
  }

  function dragGraph(event: ReactPointerEvent<HTMLElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      if (
        !showOriginal &&
        event.buttons === 1 &&
        event.currentTarget === previewCanvasRef.current &&
        canvasTool === "pointer" &&
        drawingTool === "image"
      ) {
        selectFillRegionFromPointer(event as ReactPointerEvent<HTMLCanvasElement>);
      }
      return;
    }
    event.preventDefault();

    const deltaX = ((event.clientX - dragState.startClientX) * dragState.canvasWidth) / dragState.rectWidth;
    const deltaY = ((event.clientY - dragState.startClientY) * dragState.canvasHeight) / dragState.rectHeight;
    const imageOffsetX = clampImageOffset(dragState.startOffsetX + deltaX);
    const imageOffsetY = clampImageOffset(dragState.startOffsetY + deltaY);
    dragState.moved =
      dragState.moved ||
      hasIntentionalDrag(
        { x: dragState.startClientX, y: dragState.startClientY },
        { x: event.clientX, y: event.clientY },
      );
    if (dragState.kind === "source" && dragState.sourceId && dragState.moved) {
      const sourceId = dragState.sourceId;
      setDragPreviewSourceId((current) => (current === sourceId ? current : sourceId));
      setSelectedFillRegionId(null);
      setFloatingPalette(null);
    }

    if (dragState.kind === "viewport") {
      const scroller = canvasScrollRef.current;
      if (scroller) {
        scroller.scrollLeft = (dragState.startScrollLeft ?? 0) - (event.clientX - dragState.startClientX);
        scroller.scrollTop = (dragState.startScrollTop ?? 0) - (event.clientY - dragState.startClientY);
      }
      return;
    }

    if (dragState.kind === "pan") {
      setCanvasPan({
        x: (dragState.startPanX ?? 0) + (event.clientX - dragState.startClientX),
        y: (dragState.startPanY ?? 0) + (event.clientY - dragState.startClientY),
      });
      return;
    }

    if (dragState.kind === "cell-paint") {
      paintCellAtPointer(event, dragState);
      return;
    }

    if (dragState.kind === "image-erase") {
      eraseImageAtPointer(event, dragState);
      return;
    }

    if (dragState.kind === "shape-draw") {
      if (dragState.moved && !dragState.interactionStarted) {
        dragState.interactionStarted = true;
        beginGraphInteraction();
      }
      updateLineAtPointer(event, dragState);
      return;
    }

    if (
      dragState.layerStarts?.size &&
      (dragState.kind === "source" || dragState.kind === "shape" || dragState.kind === "clipart")
    ) {
      const activeKey =
        dragState.kind === "source" && dragState.sourceId
          ? sourceLayerKey(dragState.sourceId)
          : dragState.kind === "shape" && dragState.shapeId
            ? drawingLayerKey("shape", dragState.shapeId)
            : dragState.kind === "clipart" && dragState.clipartId
              ? drawingLayerKey("clipart", dragState.clipartId)
              : null;
      const activeStart = activeKey ? dragState.layerStarts.get(activeKey) : null;
      if (!activeKey || !activeStart) return;
      const deltaCellsX = deltaX / GRAPH_MAJOR_CELL_PIXELS;
      const deltaCellsY = deltaY / GRAPH_MAJOR_CELL_PIXELS;
      setSettings((current) => {
        const { type, id } = parseLayerKey(activeKey);
        const activeLocked =
          type === "source"
            ? Boolean(current.sourceImages.find((source) => source.id === id)?.locked)
            : type === "shape"
              ? Boolean(current.graphShapes.find((shape) => shape.id === id)?.locked)
              : Boolean(current.clipartImages.find((clipart) => clipart.id === id)?.locked);
        if (activeLocked) return current;
        const snap = snapLayerRect(
          current,
          activeKey,
          {
            id: activeKey,
            x: activeStart.x + deltaCellsX,
            y: activeStart.y + deltaCellsY,
            width: activeStart.width,
            height: activeStart.height,
          },
          event.altKey,
          new Set(dragState.layerStarts!.keys()),
        );
        setSnapGuides(snap.guides);
        const translated = moveLayerSelection(
          current,
          dragState.layerStarts!,
          snap.x - activeStart.x,
          snap.y - activeStart.y,
        );
        if (!translated.changed) return current;
        if (!dragState.historyRecorded) {
          pushUndoSettings(current);
          dragState.historyRecorded = true;
        }
        const next = deriveGraphSettings(translated.next);
        settingsRef.current = next;
        return next;
      });
      return;
    }

    if (dragState.kind === "shape" && dragState.shapeId && dragState.startShapeX !== undefined && dragState.startShapeY !== undefined) {
      const deltaCellsX = deltaX / GRAPH_MAJOR_CELL_PIXELS;
      const deltaCellsY = deltaY / GRAPH_MAJOR_CELL_PIXELS;
      setSettings((current) => {
        const shape = current.graphShapes.find((item) => item.id === dragState.shapeId);
        if (!shape || shape.locked) return current;
        const activeKey = drawingLayerKey("shape", shape.id);
        const snap = snapLayerRect(
          current,
          activeKey,
          {
            id: activeKey,
            x: dragState.startShapeX! + deltaCellsX,
            y: dragState.startShapeY! + deltaCellsY,
            width: Math.max(0.01, Math.abs(shape.width)),
            height: Math.max(0.01, Math.abs(shape.height)),
          },
          event.altKey,
        );
        setSnapGuides(snap.guides);
        const x = clampFreeCellCoordinate(snap.x, shape.x);
        const y = clampFreeCellCoordinate(snap.y, shape.y);
        if (shape.x === x && shape.y === y) return current;
        if (!dragState.historyRecorded) {
          pushUndoSettings(current);
          dragState.historyRecorded = true;
        }
        const next = deriveGraphSettings({
          ...current,
          graphShapes: current.graphShapes.map((item) => (item.id === dragState.shapeId ? { ...item, x, y } : item)),
        });
        settingsRef.current = next;
        return next;
      });
      return;
    }

    if (dragState.kind === "clipart" && dragState.clipartId && dragState.startClipartX !== undefined && dragState.startClipartY !== undefined) {
      const deltaCellsX = deltaX / GRAPH_MAJOR_CELL_PIXELS;
      const deltaCellsY = deltaY / GRAPH_MAJOR_CELL_PIXELS;
      setSettings((current) => {
        const clipart = current.clipartImages.find((item) => item.id === dragState.clipartId);
        if (!clipart || clipart.locked) return current;
        const activeKey = drawingLayerKey("clipart", clipart.id);
        const snap = snapLayerRect(
          current,
          activeKey,
          {
            id: activeKey,
            x: dragState.startClipartX! + deltaCellsX,
            y: dragState.startClipartY! + deltaCellsY,
            width: Math.max(0.01, Math.abs(clipart.width)),
            height: Math.max(0.01, Math.abs(clipart.height)),
          },
          event.altKey,
        );
        setSnapGuides(snap.guides);
        const x = clampFreeCellCoordinate(snap.x, clipart.x);
        const y = clampFreeCellCoordinate(snap.y, clipart.y);
        if (clipart.x === x && clipart.y === y) return current;
        if (!dragState.historyRecorded) {
          pushUndoSettings(current);
          dragState.historyRecorded = true;
        }
        const next = deriveGraphSettings({
          ...current,
          clipartImages: current.clipartImages.map((item) => (item.id === dragState.clipartId ? { ...item, x, y } : item)),
        });
        settingsRef.current = next;
        return next;
      });
      return;
    }

    if (dragState.kind === "resize-selection" && dragState.layerStarts?.size && dragState.selectionBounds) {
      const deltaCellsX = deltaX / GRAPH_MAJOR_CELL_PIXELS;
      const deltaCellsY = deltaY / GRAPH_MAJOR_CELL_PIXELS;
      setSettings((current) => {
        if (layerSelectionContainsLocked(current, Array.from(dragState.layerStarts!.keys()))) return current;
        let left = dragState.selectionBounds!.x;
        let right = dragState.selectionBounds!.x + dragState.selectionBounds!.width;
        let top = dragState.selectionBounds!.y;
        let bottom = dragState.selectionBounds!.y + dragState.selectionBounds!.height;
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

        const resized = resizeLayerSelection(current, dragState.layerStarts!, dragState.selectionBounds!, {
          id: "selection",
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        });
        if (!resized.changed) return current;
        if (!dragState.historyRecorded) {
          pushUndoSettings(current);
          dragState.historyRecorded = true;
        }
        const next = deriveGraphSettings(resized.next);
        settingsRef.current = next;
        return next;
      });
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
          sourceImages: current.sourceImages.map((image) =>
            image.id === dragState.sourceId ? { ...image, x, y, width, height } : image,
          ),
        });
        settingsRef.current = next;
        return next;
      });
      return;
    }

    if (
      dragState.kind === "resize-shape" &&
      dragState.shapeId &&
      dragState.startShapeX !== undefined &&
      dragState.startShapeY !== undefined &&
      dragState.startShapeWidth !== undefined &&
      dragState.startShapeHeight !== undefined
    ) {
      const deltaCellsX = deltaX / GRAPH_MAJOR_CELL_PIXELS;
      const deltaCellsY = deltaY / GRAPH_MAJOR_CELL_PIXELS;
      setSettings((current) => {
        const shape = current.graphShapes.find((item) => item.id === dragState.shapeId);
        if (!shape || shape.locked) return current;

        let left = dragState.startShapeX!;
        let right = dragState.startShapeX! + dragState.startShapeWidth!;
        let top = dragState.startShapeY!;
        let bottom = dragState.startShapeY! + dragState.startShapeHeight!;
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

        const width = clampFreeCellCoordinate(right - left, shape.width);
        const height = clampFreeCellCoordinate(bottom - top, shape.height);
        const x = clampFreeCellCoordinate(left, shape.x);
        const y = clampFreeCellCoordinate(top, shape.y);
        if (shape.x === x && shape.y === y && shape.width === width && shape.height === height) return current;
        if (!dragState.historyRecorded) {
          pushUndoSettings(current);
          dragState.historyRecorded = true;
        }
        const next = deriveGraphSettings({
          ...current,
          graphShapes: current.graphShapes.map((item) => (item.id === dragState.shapeId ? { ...item, x, y, width, height } : item)),
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
        const activeKey = sourceLayerKey(source.id);
        const snap = snapLayerRect(
          current,
          activeKey,
          {
            id: activeKey,
            x: dragState.startSourceX! + deltaCellsX,
            y: (dragState.startSourceY ?? 0) + deltaCellsY,
            width: source.width,
            height: source.height,
          },
          event.altKey,
        );
        setSnapGuides(snap.guides);
        const x = clampSourceX(snap.x, current.graphWidth, source.width);
        const y = clampFreeCellCoordinate(snap.y, source.y);
        if (source.x === x && source.y === y) return current;
        if (!dragState.historyRecorded) {
          pushUndoSettings(current);
          dragState.historyRecorded = true;
        }
        const next = deriveGraphSettings({
          ...current,
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

  function commitPendingGestureHistory() {
    if (pendingSettingsHistoryRef.current) {
      pushUndoSettings(pendingSettingsHistoryRef.current, settingsRef.current);
      pendingSettingsHistoryRef.current = null;
    }
  }

  function endGraphDrag(event: ReactPointerEvent<HTMLElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragState.moved =
      dragState.moved ||
      hasIntentionalDrag(
        { x: dragState.startClientX, y: dragState.startClientY },
        { x: event.clientX, y: event.clientY },
      );
    if (dragState.kind === "shape-draw" && dragState.moved) {
      updateLineAtPointer(event, dragState);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (dragState.moved && (dragState.kind !== "shape-draw" || dragState.historyRecorded)) {
      forceNextProcessingRef.current = true;
    }
    if (dragState.historyRecorded) commitPendingGestureHistory();
    else pendingSettingsHistoryRef.current = null;
    dragStateRef.current = null;
    setIsDraggingGraph(false);
    setSnapGuides([]);
  }

  function canvasPointerDistance(points: Array<{ x: number; y: number }>) {
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function canvasPointerCenter(points: Array<{ x: number; y: number }>) {
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }

  function beginCanvasPointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (showOriginal || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    canvasPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (canvasPointersRef.current.size < 2) {
      beginGraphDrag(event);
      return;
    }

    event.preventDefault();
    if (dragStateRef.current?.historyRecorded) commitPendingGestureHistory();
    else pendingSettingsHistoryRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    const points = Array.from(canvasPointersRef.current.values()).slice(0, 2);
    const center = canvasPointerCenter(points);
    canvasPinchRef.current = {
      distance: Math.max(1, canvasPointerDistance(points)),
      centerX: center.x,
      centerY: center.y,
      zoom,
      panX: canvasPan.x,
      panY: canvasPan.y,
    };
    dragStateRef.current = null;
    setIsDraggingGraph(false);
    setSnapGuides([]);
  }

  function moveCanvasPointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    updateImageEraserCursor(event);
    updateLassoCursor(event);
    if (canvasPointersRef.current.has(event.pointerId)) {
      canvasPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    const pinch = canvasPinchRef.current;
    if (!pinch || canvasPointersRef.current.size < 2) {
      dragGraph(event);
      return;
    }

    event.preventDefault();
    const points = Array.from(canvasPointersRef.current.values()).slice(0, 2);
    const center = canvasPointerCenter(points);
    const nextZoom = Math.max(0.35, Math.min(2.5, pinch.zoom * (canvasPointerDistance(points) / pinch.distance)));
    setZoom(Math.round(nextZoom * 100) / 100);
    setCanvasPan({
      x: pinch.panX + center.x - pinch.centerX,
      y: pinch.panY + center.y - pinch.centerY,
    });
  }

  function endCanvasPointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    canvasPointersRef.current.delete(event.pointerId);
    if (dragStateRef.current?.pointerId === event.pointerId) endGraphDrag(event);
    else if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (canvasPointersRef.current.size < 2) canvasPinchRef.current = null;
  }

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const validKeys = selectableLayerKeysFromSettings(settings);
      setSelectedLayerKeys((current) => {
        const next = current.filter((key) => validKeys.has(key));
        return next.length === current.length ? current : next;
      });
      if (selectedSourceId && !settings.sourceImages.some((source) => source.id === selectedSourceId)) setSelectedSourceId(null);
      if (selectedDrawingLayerId && !validKeys.has(selectedDrawingLayerId)) setSelectedDrawingLayerId(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedDrawingLayerId, selectedSourceId, settings]);

  const drawPreview = useCallback((canvas: HTMLCanvasElement) => {
    if (!isDrawableCanvas(canvas)) return;
    const finishPaint = startGraphPerformanceStage("paint", { width: canvas.width, height: canvas.height });
    const preview = previewCanvasRef.current;
    setPreviewCanvasSize({ width: canvas.width, height: canvas.height });
    if (!preview) return;
    preview.width = canvas.width;
    preview.height = canvas.height;
    const context = preview.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, preview.width, preview.height);
    context.drawImage(canvas, 0, 0);
    finishPaint({ outputBytes: preview.width * preview.height * 4 });
  }, []);

  useEffect(() => {
    if (!dragPreviewSourceId) return;
    const source = settingsRef.current.sourceImages.find((item) => item.id === dragPreviewSourceId);
    const sourceCanvas = sourceWorkingCanvasesRef.current.get(dragPreviewSourceId) ?? sourceCanvasesRef.current.get(dragPreviewSourceId);
    const preview = dragPreviewCanvasRef.current;
    if (!source || !sourceCanvas || !preview) return;

    const bounds = findContentBounds(sourceCanvas);
    preview.width = Math.max(1, Math.round(bounds.width));
    preview.height = Math.max(1, Math.round(bounds.height));
    const context = preview.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, preview.width, preview.height);
    context.drawImage(sourceCanvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, preview.width, preview.height);
  }, [dragPreviewSourceId]);

  useEffect(() => {
    if (!draftChecked) return;
    const sources = settingsRef.current.sourceImages;
    let cancelled = false;
    setSourceReady(false);
    setSourceLoadSettled(false);
    setSourceCropMode(false);
    setSourceCropArea(null);
    setFillRegions([]);
    setSelectedFillRegionId(null);
    setFloatingPalette(null);
    setCopiedFillColor(null);
    fillRegionMapRef.current = null;
    fillRegionIdByMapIdRef.current = new Map();
    settledFillRegionFrameRef.current = null;
    sourceCanvasRef.current = null;
    sourceCanvasesRef.current = new Map();
    sourceWorkingCanvasesRef.current = new Map();
    sourceWorkingSigRef.current = new Map();
    processedCanvasRef.current = null;
    artworkCanvasRef.current = null;
    setProcessing(false);
    setFailedProcessingSignature(null);
    revokeObjectUrls(sourcePreviewObjectUrlsRef.current.values());
    sourcePreviewObjectUrlsRef.current = new Map();
    setSourceStatus({});

    if (!sources.length) {
      const preview = previewCanvasRef.current;
      const context = preview?.getContext("2d");
      if (preview && context) context.clearRect(0, 0, preview.width, preview.height);
      setSourceLoadSettled(true);
      setNotice(null);
      return () => {
        cancelled = true;
      };
    }

    const hasPdf = sources.some((source) => isPdfFile({ name: source.name }));
    setNotice({ tone: "info", text: hasPdf ? "Rendering source files..." : "Loading source files..." });
    const sourceAssets = groupSourcesByAsset(sources);

    void mapWithConcurrency(
      sourceAssets,
      EDITOR_PREVIEW_POLICY.taskConcurrency,
      async (asset) => {
        const source = asset.sources.find((candidate) => candidate.url) ?? asset.sources[0];
        try {
          if (!source.url) throw new Error(`${source.name} is not available. Save and reopen the project, then try again.`);
          const canvas = fitCanvasToWorkingPixelBudget(await loadImageToCanvas(source.url, source.name), sources.length);
          const previewUrl = await canvasToObjectUrl(canvas);
          return { asset, canvas, previewUrl, error: null };
        } catch (error) {
          return {
            asset,
            canvas: null,
            previewUrl: null,
            error: error instanceof Error ? error.message : "Unable to load this source image.",
          };
        }
      },
    )
      .then((loadedAssets) => {
        if (cancelled) {
          revokeObjectUrls(loadedAssets.flatMap((loaded) => (loaded.previewUrl ? [loaded.previewUrl] : [])));
          return;
        }

        const canvases = new Map<string, HTMLCanvasElement>();
        const previewUrls = new Map<string, string>();
        const nextStatus: Record<string, SourceStatus> = {};
        const previousPreviewUrls = sourcePreviewObjectUrlsRef.current;
        let readyCount = 0;
        for (const { asset, canvas, previewUrl, error } of loadedAssets) {
          if (!canvas || !previewUrl) {
            for (const source of asset.sources) nextStatus[source.id] = { ready: false, previewUrl: null, error };
            continue;
          }
          for (const source of asset.sources) {
            canvases.set(source.id, canvas);
            previewUrls.set(source.id, previewUrl);
            nextStatus[source.id] = { ready: true, previewUrl, error: null };
            readyCount += 1;
          }
        }
        revokeObjectUrls(Array.from(previousPreviewUrls.entries()).filter(([id]) => !previewUrls.has(id)).map(([, url]) => url));
        sourceCanvasesRef.current = canvases;
        sourceWorkingCanvasesRef.current = new Map();
        sourceWorkingSigRef.current = new Map();
        sourceCanvasRef.current = canvases.get(sources[0]?.id ?? "") ?? null;
        sourcePreviewObjectUrlsRef.current = previewUrls;
        setSourceStatus(nextStatus);
        setSourceReady(readyCount > 0);
        setSourceLoadSettled(true);
        setNotice(readyCount ? null : { tone: "error", text: "Unable to load any source images." });
      })
      .catch((error) => {
        if (!cancelled) {
          setSourceLoadSettled(true);
          setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load source files." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [draftChecked, project.id, sourceLoadKey]);

  function buildWorkingSourceCanvas(source: GraphSourceImage, pristine: HTMLCanvasElement): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = pristine.width;
    canvas.height = pristine.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return pristine;
    context.drawImage(pristine, 0, 0);
    if (source.backgroundRemoval?.enabled) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const cleaned = removeBackgroundImageData(imageData, source.backgroundRemoval.tolerance);
      imageData.data.set(cleaned.data);
      context.putImageData(imageData, 0, 0);
    }
    const strokes = source.eraseStrokes ?? [];
    if (strokes.length) {
      // Strokes are stored as normalized UV coordinates; scale to this canvas's resolution.
      const scaleX = canvas.width;
      const scaleY = canvas.height;
      context.save();
      context.globalCompositeOperation = "destination-out";
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "rgba(0,0,0,1)";
      context.fillStyle = "rgba(0,0,0,1)";
      for (const stroke of strokes) {
        if (!stroke.points.length) continue;
        const radiusPx = Math.max(0.5, stroke.radius * scaleX);

        if (stroke.shape === "polygon") {
          // Vertices of a closed region, not a path to stamp along. Erasing is
          // the destination-out default; a fill paints over the artwork
          // instead, so it needs source-over restored for this stroke only.
          context.save();
          if (stroke.fill) {
            context.globalCompositeOperation = "source-over";
            context.fillStyle = stroke.fill;
          }
          context.beginPath();
          context.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
          for (let index = 1; index < stroke.points.length; index += 1) {
            context.lineTo(stroke.points[index].x * scaleX, stroke.points[index].y * scaleY);
          }
          context.closePath();
          context.fill();
          context.restore();
          continue;
        }

        if (stroke.shape === "square") {
          // Canvas strokes only offer round/butt/square *caps*, not a square
          // brush footprint along a path, so stamp axis-aligned squares densely
          // enough that consecutive stamps overlap and leave no gaps.
          const size = radiusPx * 2;
          const stamp = (x: number, y: number) => context.fillRect(x - radiusPx, y - radiusPx, size, size);
          const step = Math.max(1, radiusPx / 2);

          stamp(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
          for (let index = 1; index < stroke.points.length; index += 1) {
            const fromX = stroke.points[index - 1].x * scaleX;
            const fromY = stroke.points[index - 1].y * scaleY;
            const toX = stroke.points[index].x * scaleX;
            const toY = stroke.points[index].y * scaleY;
            const distance = Math.hypot(toX - fromX, toY - fromY);
            const steps = Math.max(1, Math.ceil(distance / step));
            for (let s = 1; s <= steps; s += 1) {
              stamp(fromX + ((toX - fromX) * s) / steps, fromY + ((toY - fromY) * s) / steps);
            }
          }
          continue;
        }

        if (stroke.points.length === 1) {
          context.beginPath();
          context.arc(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY, radiusPx, 0, Math.PI * 2);
          context.fill();
        } else {
          context.lineWidth = radiusPx * 2;
          context.beginPath();
          context.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
          for (let index = 1; index < stroke.points.length; index += 1) {
            context.lineTo(stroke.points[index].x * scaleX, stroke.points[index].y * scaleY);
          }
          context.stroke();
        }
      }
      context.restore();
    }
    return canvas;
  }

  /** Returns the source's working canvas (pristine if it has no erase/background extras), rebuilding + caching when the extras change. */
  function ensureWorkingSourceCanvas(source: GraphSourceImage): HTMLCanvasElement | null {
    const pristine = sourceCanvasesRef.current.get(source.id);
    if (!pristine) return null;
    const sig = `${eraseStrokesSignature(source.eraseStrokes)}|${backgroundRemovalSignature(source.backgroundRemoval)}`;
    if (sig === "0|0") {
      sourceWorkingCanvasesRef.current.delete(source.id);
      sourceWorkingSigRef.current.set(source.id, sig);
      return pristine;
    }
    const cached = sourceWorkingCanvasesRef.current.get(source.id);
    if (cached && sourceWorkingSigRef.current.get(source.id) === sig) return cached;
    const derived = buildWorkingSourceCanvas(source, pristine);
    sourceWorkingCanvasesRef.current.set(source.id, derived);
    sourceWorkingSigRef.current.set(source.id, sig);
    return derived;
  }

  const currentProcessingSignature = useMemo(
    () => buildProcessingSignature(settings),
    [settings],
  );

  useEffect(() => {
    if (!draftChecked) return;
    const currentSettings = settingsRef.current;
    const requiredAssetIds = new Set(
      currentSettings.clipartImages.filter((clipart) => clipart.visible !== false).map((clipart) => clipart.assetId),
    );
    if (selectedClipartAssetId) requiredAssetIds.add(selectedClipartAssetId);
    else if (currentSettings.clipartAssets[0]) requiredAssetIds.add(currentSettings.clipartAssets[0].id);
    const assets = currentSettings.clipartAssets.filter((asset) => requiredAssetIds.has(asset.id));
    let cancelled = false;
    setClipartLoadSettled(false);
    const liveAssetIds = new Set(currentSettings.clipartAssets.map((asset) => asset.id));
    for (const assetId of clipartCanvasesRef.current.keys()) {
      if (!liveAssetIds.has(assetId)) clipartCanvasesRef.current.delete(assetId);
    }
    const assetsToLoad = assets.filter((asset) => !clipartCanvasesRef.current.has(asset.id));
    setClipartReady(
      currentSettings.clipartImages
        .filter((clipart) => clipart.visible !== false)
        .every((clipart) => clipartCanvasesRef.current.has(clipart.assetId)),
    );

    if (!assetsToLoad.length) {
      setClipartLoadSettled(true);
      if (!currentSettings.clipartAssets.length) {
        setPlacingClipartAssetId(null);
        setSelectedClipartAssetId(null);
      }
      return () => {
        cancelled = true;
      };
    }

    void mapWithConcurrency(
      assetsToLoad,
      EDITOR_PREVIEW_POLICY.taskConcurrency,
      async (asset) => {
        const url = asset.url ?? asset.dataUrl ?? null;
        if (!url) return { asset, canvas: null };
        try {
          const canvas = fitCanvasToWorkingPixelBudget(
            await loadImageToCanvas(url, asset.name),
            currentSettings.clipartAssets.length,
          );
          return { asset, canvas };
        } catch {
          return { asset, canvas: null };
        }
      },
    ).then((loadedAssets) => {
      if (cancelled) return;
      const canvases = new Map(clipartCanvasesRef.current);
      for (const { asset, canvas } of loadedAssets) {
        if (canvas) canvases.set(asset.id, canvas);
      }
      clipartCanvasesRef.current = canvases;
      setClipartReady(
        currentSettings.clipartImages
          .filter((clipart) => clipart.visible !== false)
          .every((clipart) => canvases.has(clipart.assetId)),
      );
      setClipartLoadSettled(true);
      setSelectedClipartAssetId((current) =>
        current && currentSettings.clipartAssets.some((asset) => asset.id === current)
          ? current
          : currentSettings.clipartAssets[0]?.id ?? null,
      );
    }).catch((error) => {
      if (!cancelled) {
        setClipartReady(false);
        setClipartLoadSettled(true);
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load clipart assets." });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [clipartLoadKey, clipartUsageKey, draftChecked, project.id, selectedClipartAssetId]);

  useEffect(() => {
    if (!draftChecked) return;
    if (settings.sourceImages.length && (!sourceLoadSettled || !sourceReady)) return;
    if (settings.clipartImages.length && (!clipartLoadSettled || !clipartReady)) return;
    let cancelled = false;
    const controller = new AbortController();
    const dragActive = isDraggingGraph && dragStateRef.current !== null;
    const dragKind = dragStateRef.current?.kind;
    // Source moves have a DOM overlay, while erasing paints a clipped
    // source-local footprint into the preview canvas; both defer the real
    // pipeline to pointer-up. An erase belongs here because every stroke point
    // changes `eraseStrokesSignature`, which is part of the vectorizer cache
    // key, and re-running it mid-drag re-vectorizes sources through /api/vectorize
    // per coalesced batch.
    const previewOnlyDragActive = dragActive && (dragKind === "source" || dragKind === "image-erase");

    // A selected source gets a lightweight DOM preview while it is moved. The
    // authoritative masks are rebuilt once on pointer-up instead of on every move.
    if (previewOnlyDragActive) {
      setProcessing(false);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const processingSignature = currentProcessingSignature;

    if (lastProcessedSignatureRef.current === processingSignature && processedCanvasRef.current) {
      if (!dragActive) forceNextProcessingRef.current = false;
      setProcessing(false);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const forceImmediateProcessing = !dragActive && forceNextProcessingRef.current;
    if (!dragActive) {
      forceNextProcessingRef.current = false;
    }

    const elapsedSinceLastDragProcessing = dragActive ? Math.max(0, performance.now() - lastDragProcessingAtRef.current) : 0;
    const processingDelayMs = forceImmediateProcessing
      ? 0
      : dragActive
        ? Math.max(0, Math.min(DRAG_PROCESSING_IDLE_DEBOUNCE_MS, DRAG_PROCESSING_MAX_WAIT_MS - elapsedSinceLastDragProcessing))
        : PREVIEW_PROCESSING_DEBOUNCE_MS;

    if (!processingDebounceRef.current) {
      processingDebounceRef.current = createDebouncedAction(() => undefined, PREVIEW_PROCESSING_DEBOUNCE_MS);
    }
    processingDebounceRef.current.cancel();
    setFailedProcessingSignature((current) => (
      current === processingSignature ? null : current
    ));
    processingDebounceRef.current = createDebouncedAction(() => {
      if (dragActive) {
        lastDragProcessingAtRef.current = performance.now();
      }
      setProcessing(true);
      const startAt = performance.now();
      const layouts = sourceRenderOrder(settings.sourceImages);
      const sourceLayers = layouts
        .filter((layout) => layout.source.visible !== false && sourceCanvasesRef.current.has(layout.source.id))
        .map((layout) => {
          const pristineSourceCanvas = sourceCanvasesRef.current.get(layout.source.id);
          const sourceCanvas = ensureWorkingSourceCanvas(layout.source);
          if (!sourceCanvas || !pristineSourceCanvas) throw new Error(`${layout.source.name} is not available.`);
          return {
            id: fillRegionLayerScope("source", layout.source.id),
            canvas: sourceCanvas,
            settings: sourceSettings(settings, layout.source),
            vectorizerSource: {
              canvas: sourceCanvas,
              // Erasing/background removal changes pixels, not the physical
              // source frame. Keep this pristine frame for placement so a cut
              // at an artwork edge cannot re-crop and re-scale the layer.
              contentBounds: findContentBounds(pristineSourceCanvas),
              placement: {
                x: layout.x,
                y: layout.y,
                width: layout.width,
                height: layout.height,
                rotationDegrees: layout.source.rotationDegrees,
                flipX: layout.source.flipX,
                flipY: layout.source.flipY,
                offsetX: settings.imageOffsetX,
                offsetY: settings.imageOffsetY,
              },
            },
            vectorizerCacheKey: sourceVectorizerCacheKey(layout.source),
            processingCacheKey: [
              sourceProcessingCacheKey(layout.source, layout),
              settings.imageOffsetX,
              settings.imageOffsetY,
              settings.graphWidth,
              settings.graphHeight,
            ].join("|"),
          };
        });
      const clipartLayers = settings.clipartImages
        .filter((clipart) => clipart.visible !== false && clipartCanvasesRef.current.has(clipart.assetId))
        .map((clipart) => {
          const sourceCanvas = clipartCanvasesRef.current.get(clipart.assetId);
          if (!sourceCanvas) throw new Error(`${clipart.name} is not available.`);
          const asset = settings.clipartAssets.find((candidate) => candidate.id === clipart.assetId);
          return {
            id: fillRegionLayerScope("clipart", clipart.id),
            canvas: sourceCanvas,
            settings: clipartSettings(settings, clipart),
            vectorizerSource: {
              canvas: sourceCanvas,
              placement: {
                x: clipart.x,
                y: clipart.y,
                width: clipart.width,
                height: clipart.height,
                rotationDegrees: clipart.rotationDegrees,
                flipX: clipart.flipX,
                flipY: clipart.flipY,
              },
            },
            vectorizerCacheKey: ["clipart", clipart.assetId, asset?.path ?? "", asset?.url ?? "", asset?.dataUrl ?? ""].join("|"),
          };
        });
      const layers = [...sourceLayers, ...clipartLayers];
      const finishComposition = startGraphPerformanceStage("composition", {
        layers: layers.length,
        tier: EDITOR_PREVIEW_POLICY.tier,
      });
      const renderSettings = deriveGraphSettings({
        ...settings,
        imageWidth: settings.graphWidth,
        imageHeight: settings.graphHeight,
      });
      const documentRevision = ++renderRequestRevisionRef.current;
      void pixelateLayeredImagesWithWorker(layers, renderSettings, {
        signal: controller.signal,
        documentRevision,
        mode: dragActive ? "draft" : "full",
      })
        .then((result) => {
          // Async vectorization can outlive an abort. Never let that older
          // graph frame replace the current document after a newer request
          // has started.
          if (
            cancelled
            || documentRevision !== renderRequestRevisionRef.current
            || buildProcessingSignature(settingsRef.current) !== processingSignature
          ) {
            return;
          }

          // Region IDs normally follow the artwork, but re-vectorization and
          // generated line/shape topology can relabel a connected component.
          // Reconcile the rendered pixels before committing this frame so a
          // pre-existing colour follows the actual enclosed area rather than
          // falling back to its default on duplicate/undo/redo.
          const currentSettings = settingsRef.current;
          const previousFillFrame = settledFillRegionFrameRef.current;
          const reconciledFillOverrides = !dragActive
            ? reconcileFillRegionOverrides({
                overrides: currentSettings.fillRegions,
                previous: previousFillFrame
                  ? previousFillFrame
                  : {
                      fillRegions: result.fillRegions,
                      fillRegionMap: result.fillRegionMap,
                      width: result.canvas.width,
                      height: result.canvas.height,
                    },
                next: {
                  fillRegions: result.fillRegions,
                  fillRegionMap: result.fillRegionMap,
                  width: result.canvas.width,
                  height: result.canvas.height,
                },
              })
            : null;

          if (reconciledFillOverrides && reconciledFillOverrides.fillRegions !== currentSettings.fillRegions) {
            const nextSettings = deriveGraphSettings({
              ...currentSettings,
              fillRegions: reconciledFillOverrides.fillRegions,
            });
            const reconciledIds = new Map<string, string>();
            for (const match of reconciledFillOverrides.matches) {
              if (match.fromId !== match.toId && !reconciledIds.has(match.fromId)) {
                reconciledIds.set(match.fromId, match.toId);
              }
            }
            settingsRef.current = nextSettings;
            forceNextProcessingRef.current = true;
            setSettings(nextSettings);
            if (reconciledIds.size) {
              setSelectedFillRegionId((current) => (current ? reconciledIds.get(current) ?? current : null));
              setFloatingPalette((current) => (
                current && reconciledIds.has(current.regionId)
                  ? { ...current, regionId: reconciledIds.get(current.regionId)! }
                  : current
              ));
            }
            setFailedProcessingSignature(null);
            finishComposition({
              retainedBytes: estimateCanvasBytes([
                ...sourceCanvasesRef.current.values(),
                ...clipartCanvasesRef.current.values(),
                result.canvas,
              ]),
            });
            logProcessingTiming("preview-processing", startAt);
            return;
          }

          artworkCanvasRef.current = result.canvas;
          // Rebuild the flattened image (backdrop + grid + artwork) so export/save
          // and the processed-PNG upload keep the exact output they had before the
          // grid became a live SVG overlay. Skip during drag drafts; export/save
          // wait for the settled full render, which flattens.
          if (!dragActive) {
            processedCanvasRef.current = flattenGraphForOutput(result.canvas, renderSettings);
            lastProcessedSignatureRef.current = processingSignature;
            processedRevisionRef.current += 1;
            setInitialCanvasReadyProjectId(project.id);
          }
          fillRegionMapRef.current = result.fillRegionMap;
          fillRegionIdByMapIdRef.current = new Map(result.fillRegions.map((region) => [region.mapId, region.id] as const));
          if (!dragActive) {
            settledFillRegionFrameRef.current = {
              fillRegions: result.fillRegions,
              fillRegionMap: result.fillRegionMap,
              width: result.canvas.width,
              height: result.canvas.height,
            };
          }
          drawPreview(result.canvas);
          setFillRegions(result.fillRegions);
          setSelectedFillRegionId((current) => (current && result.fillRegions.some((region) => region.id === current) ? current : null));
          setFloatingPalette((current) => (current && result.fillRegions.some((region) => region.id === current.regionId) ? current : null));
          setPalette(result.palette);
          setFailedProcessingSignature(null);
          setProcessing(false);
          setDragPreviewSourceId(null);
          finishComposition({
            retainedBytes: estimateCanvasBytes([
              ...sourceCanvasesRef.current.values(),
              ...clipartCanvasesRef.current.values(),
              result.canvas,
            ]),
          });
          logProcessingTiming("preview-processing", startAt);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          if (!cancelled) {
            setFailedProcessingSignature(processingSignature);
            setProcessing(false);
            setDragPreviewSourceId(null);
            finishComposition();
            setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to process image." });
          }
        });
    }, processingDelayMs);
    processingDebounceRef.current.run();

    return () => {
      cancelled = true;
      controller.abort();
      processingDebounceRef.current?.cancel();
    };
  }, [
    clipartLoadSettled,
    clipartReady,
    currentProcessingSignature,
    draftChecked,
    drawPreview,
    isDraggingGraph,
    project.id,
    renderKey,
    settings,
    sourceLoadSettled,
    sourceReady,
  ]);

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
      if ((event.key === "Delete" || event.key === "Backspace") && (selectedSourceId || selectedDrawingLayerId) && !isFormControlTarget(event.target)) {
        event.preventDefault();
        deleteSelectedLayer({ skipConfirm: true });
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if ((key === "z" || key === "y") && !isTextEditingTarget(event.target)) {
        event.preventDefault();
        restoreSettingsHistory(key === "y" || event.shiftKey ? "redo" : "undo");
        return;
      }
      if (key === "g" && !isFormControlTarget(event.target)) {
        event.preventDefault();
        if (event.shiftKey) ungroupSelectedLayers();
        else groupSelectedLayers();
        return;
      }
      if ((key === "c" || key === "v") && !isFormControlTarget(event.target)) {
        if (key === "c" && copySelectedLayers()) {
          event.preventDefault();
          return;
        }
        if (key === "v" && pasteLayers()) {
          event.preventDefault();
          return;
        }
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
  }, [clipboardCount, nudgeSelectedSource, restoreSettingsHistory, selectedDrawingLayerId, selectedFillRegion, selectedFillRegionColor, selectedSourceId]);

  useEffect(() => {
    return () => {
      for (const url of uploadedSourceObjectUrlsRef.current) URL.revokeObjectURL(url);
      sourcePreviewObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      clearCanvasProcessingCaches();
      disposeCanvasProcessingWorker();
      if (cropDetectionUsedRef.current) {
        void import("@/lib/canvas/crop-detection-client").then((module) => module.disposeCropDetectionWorker());
      }
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
    const remainingSourceCapacity = Math.max(0, MAX_SOURCE_IMAGES - settingsRef.current.sourceImages.length);
    if (!replaceSourceId && files.length > remainingSourceCapacity) {
      setNotice({ tone: "error", text: `This project can add ${remainingSourceCapacity} more source image${remainingSourceCapacity === 1 ? "" : "s"}.` });
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
          imageAutoEnhance: replacedSource?.imageAutoEnhance ?? current.imageAutoEnhance,
          imageDenoiseLevel: replacedSource?.imageDenoiseLevel ?? current.imageDenoiseLevel,
          imageEdgeDetection: replacedSource?.imageEdgeDetection ?? current.imageEdgeDetection,
          imageColorQuantization: replacedSource?.imageColorQuantization ?? current.imageColorQuantization,
          vectorizerLineAdjust: replacedSource?.vectorizerLineAdjust ?? current.vectorizerLineAdjust,
          vectorizerInkThreshold: replacedSource?.vectorizerInkThreshold ?? current.vectorizerInkThreshold,

          vectorizerSketchRemoval: replacedSource?.vectorizerSketchRemoval ?? current.vectorizerSketchRemoval,
          vectorizerFidelity: replacedSource?.vectorizerFidelity ?? current.vectorizerFidelity,
          x: replacedSource ? replacedSource.x : defaultSourceX(current.graphWidth, width),
          y,
          topPadding: replacedSource?.topPadding ?? 0,
          bottomPadding: replacedSource?.bottomPadding ?? 0,
          locked: replacedSource?.locked ?? false,
          visible: replacedSource?.visible ?? true,
          rotationDegrees: replacedSource?.rotationDegrees ?? 0,
          flipX: replacedSource?.flipX ?? false,
          flipY: replacedSource?.flipY ?? false,
        };
      });

      return {
        ...current,
        fillRegions: replacedSource
          ? removeFillRegionOverridesForScopes(current.fillRegions, [fillRegionLayerScope("source", replacedSource.id)])
          : current.fillRegions,
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
      for (const item of uploadItems) URL.revokeObjectURL(item.url);
      uploadedSourceObjectUrlsRef.current = uploadedSourceObjectUrlsRef.current.filter(
        (url) => !uploadItems.some((item) => item.url === url),
      );
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

      setSettings((current) => {
        const next = deriveGraphSettings({
          ...current,
          sourceImages: current.sourceImages.filter((source) => !optimisticIds.has(source.id)),
        });
        settingsRef.current = next;
        return next;
      });
      setNotice({ tone: "error", text: message });
      setUploadingSources(false);
      setReplacingSourceId(null);
      return false;
    }

    let pendingPaths: string[] = [];
    let response: Response;
    try {
      const prepareResponse = await fetch(`/api/projects/${project.id}/source-images`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: uploadItems.map((item) => ({ id: item.id, name: item.file.name, type: item.file.type, size: item.file.size })),
        }),
      });
      const prepared = await prepareResponse.json().catch(() => ({}));
      if (!prepareResponse.ok || !Array.isArray(prepared.uploads)) {
        return handleUploadFailure(prepared.message || "Unable to prepare source uploads.");
      }
      pendingPaths = prepared.uploads.map((upload: { path: string }) => upload.path);
      // Direct browser-to-R2 PUTs, plus a bounded WebP derivative for the
      // library grid so it stops pulling full-resolution originals.
      const thumbUploads = await mapWithConcurrency(prepared.uploads, 2, async (upload: PresignedUpload, index) => {
        const result = await uploadWithThumbnail(upload, uploadItems[index].file, SOURCE_THUMBNAIL_MAX_EDGE);
        return result.thumbUploaded;
      });
      response = await fetch(`/api/projects/${project.id}/source-images`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          uploads: prepared.uploads.map((upload: { id: string; name: string; path: string }, index: number) => ({
            id: upload.id,
            name: upload.name,
            path: upload.path,
            thumbUploaded: thumbUploads[index] === true,
          })),
        }),
      });
    } catch (error) {
      if (pendingPaths.length) {
        await fetch(`/api/projects/${project.id}/source-images`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paths: pendingPaths }),
        }).catch(() => {});
      }
      return handleUploadFailure(error instanceof Error ? error.message : "Unable to upload source images.");
    }

    const payload = (await response.json().catch(() => ({}))) as SourceImagesUploadResponse;
    if (!response.ok) {
      if (pendingPaths.length) {
        await fetch(`/api/projects/${project.id}/source-images`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paths: pendingPaths }),
        }).catch(() => {});
      }
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
        return uploaded
          ? {
            ...source,
            name: uploaded.name || source.name,
            path: uploaded.path || source.path,
            url: uploaded.url || source.url,
            thumbPath: uploaded.thumbPath ?? source.thumbPath ?? null,
            thumbUrl: uploaded.thumbUrl ?? source.thumbUrl ?? null,
          }
          : source;
      }),
    });
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    const durableSourceIds = new Set(uploadedImages.filter((image) => Boolean(image.url)).map((image) => image.id));
    const releasableSourceUrls = uploadItems.filter((item) => durableSourceIds.has(item.id)).map((item) => item.url);
    for (const url of releasableSourceUrls) URL.revokeObjectURL(url);
    uploadedSourceObjectUrlsRef.current = uploadedSourceObjectUrlsRef.current.filter((url) => !releasableSourceUrls.includes(url));

    const result = await saveProjectSnapshot(nextSettings, {
      uploadProcessedImage: true,
      fallbackMessage: "Unable to save source images to the project.",
    });

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

  function getDefaultClipartName(file: File) {
    const trimmedName = file.name.trim();
    const withoutExtension = trimmedName.replace(/\.[^.]+$/i, "");
    return normalizeClipartName(withoutExtension || trimmedName, "Clipart");
  }

  function normalizeClipartName(name: string, fallback: string) {
    const trimmed = name.trim();
    return trimmed || fallback;
  }

  function promptClipartName(file: File) {
    const fallback = getDefaultClipartName(file);
    const nextName = window.prompt("Name this clipart to save it for reuse", fallback);
    return normalizeClipartName(nextName ?? "", fallback);
  }

  async function uploadClipartAssets(filesInput: File[] | FileList) {
    setNotice(null);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setNotice({ tone: "error", text: "Uploading reusable cliparts needs a connection." });
      return false;
    }
    const files = Array.from(filesInput);
    if (!files.length) return false;
    const remainingClipartCapacity = Math.max(0, 120 - settingsRef.current.clipartAssets.length);
    if (files.length > remainingClipartCapacity) {
      setNotice({ tone: "error", text: `This project can add ${remainingClipartCapacity} more clipart asset${remainingClipartCapacity === 1 ? "" : "s"}.` });
      return false;
    }
    for (const file of files) {
      if (!isAllowedImageFile(file) || isPdfFile(file)) {
        setNotice({ tone: "error", text: "Use PNG, JPG, WEBP, or SVG cliparts only." });
        return false;
      }
      if (file.size > MAX_CLIPART_UPLOAD_BYTES) {
        setNotice({ tone: "error", text: `Each clipart must be ${bytesToSize(MAX_CLIPART_UPLOAD_BYTES)} or smaller.` });
        return false;
      }
    }

    setUploadingCliparts(true);
    setNotice({ tone: "info", text: "Uploading cliparts..." });
    let pendingClipartPaths: string[] = [];
    let pendingClipartObjectUrls: string[] = [];
    try {
      const namedFiles = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        name: promptClipartName(file),
      }));
      const prepared = await mapWithConcurrency(namedFiles, EDITOR_PREVIEW_POLICY.taskConcurrency, async (item) => {
        const canvas = await loadImageToCanvas(item.file, item.file.name);
        return {
          id: item.id,
          file: item.file,
          name: item.name,
          width: Math.max(1, canvas.width),
          height: Math.max(1, canvas.height),
          url: URL.createObjectURL(item.file),
        };
      });
      pendingClipartObjectUrls = prepared.map((item) => item.url);
      uploadedSourceObjectUrlsRef.current.push(...prepared.map((item) => item.url));

      let uploadedAssets: UploadedClipartAsset[];
      if (isPersistableProjectId(project.id)) {
        const prepareResponse = await fetch(`/api/projects/${project.id}/cliparts`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            files: prepared.map((item) => ({
              id: item.id,
              name: item.name,
              fileName: item.file.name,
              type: item.file.type,
              size: item.file.size,
            })),
          }),
        });
        const signedPayload = await prepareResponse.json().catch(() => ({}));
        if (!prepareResponse.ok || !Array.isArray(signedPayload.uploads)) {
          throw new Error(signedPayload.message || "Unable to prepare clipart uploads.");
        }
        pendingClipartPaths = signedPayload.uploads.map((upload: { path: string }) => upload.path);
        // Direct browser-to-R2 PUTs. The 256px derivative is what the library
        // grid renders, instead of the full-resolution original it used to pull.
        const thumbUploads = await mapWithConcurrency(signedPayload.uploads, 2, async (upload: PresignedUpload, index) => {
          const result = await uploadWithThumbnail(upload, prepared[index].file, SOURCE_THUMBNAIL_MAX_EDGE);
          return result.thumbUploaded;
        });
        const response = await fetch(`/api/projects/${project.id}/cliparts`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            uploads: signedPayload.uploads.map((upload: { id: string; name: string; path: string; mimeType: string }, index: number) => ({
              id: upload.id,
              name: upload.name,
              path: upload.path,
              mimeType: upload.mimeType,
              thumbUploaded: thumbUploads[index] === true,
            })),
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as ClipartUploadResponse;
        if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : "Unable to finalize cliparts.");
        uploadedAssets = Array.isArray(payload.assets) ? payload.assets.filter(isUploadedClipartAsset) : [];
        if (uploadedAssets.length !== prepared.length) throw new Error("Unable to read uploaded clipart details.");
        pendingClipartPaths = [];
      } else {
        uploadedAssets = prepared.map((item) => ({
          id: item.id,
          name: item.name,
          path: "",
          url: item.url,
          mimeType: item.file.type || "image/png",
          createdAt: new Date().toISOString(),
        }));
      }

      const preparedById = new Map(prepared.map((item) => [item.id, item] as const));
      const addedAssets: GraphClipartAsset[] = uploadedAssets.map((asset) => {
        const preparedItem = preparedById.get(asset.id);
        return {
          id: asset.id,
          name: normalizeClipartName(asset.name, preparedItem?.name || "Clipart"),
          path: asset.path || null,
          url: asset.url || preparedItem?.url || null,
          thumbPath: asset.thumbPath ?? null,
          // Before finalize completes the local object URL is the only preview
          // available, so fall back to it rather than showing nothing.
          thumbUrl: asset.thumbUrl ?? preparedItem?.url ?? null,
          dataUrl: null,
          mimeType: asset.mimeType || preparedItem?.file.type || "image/png",
          width: preparedItem?.width ?? 1,
          height: preparedItem?.height ?? 1,
          createdAt: asset.createdAt,
        };
      });
      const nextSettings = deriveGraphSettings({
        ...settingsRef.current,
        clipartAssets: [...settingsRef.current.clipartAssets, ...addedAssets],
      });
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      const durableAssetIds = new Set(uploadedAssets.filter((asset) => Boolean(asset.url)).map((asset) => asset.id));
      const releasableUrls = prepared.filter((item) => durableAssetIds.has(item.id)).map((item) => item.url);
      for (const url of releasableUrls) URL.revokeObjectURL(url);
      uploadedSourceObjectUrlsRef.current = uploadedSourceObjectUrlsRef.current.filter((url) => !releasableUrls.includes(url));
      pendingClipartObjectUrls = pendingClipartObjectUrls.filter((url) => !releasableUrls.includes(url));
      setSelectedClipartAssetId(addedAssets[0]?.id ?? selectedClipartAssetId);
      setInspectorTab("draw");
      setDrawTab("clipart");
      setGeneratedImagesCollapsed(false);

      if (isPersistableProjectId(project.id)) {
        const result = await saveProjectSnapshot(nextSettings, {
          uploadProcessedImage: true,
          fallbackMessage: "Unable to save cliparts to the project.",
        });
        if (!result.ok) {
          setNotice({ tone: "error", text: result.message });
          setUploadingCliparts(false);
          return false;
        }
      }

      setNotice({ tone: "ok", text: `${addedAssets.length} clipart${addedAssets.length === 1 ? "" : "s"} uploaded.` });
      setUploadingCliparts(false);
      return true;
    } catch (error) {
      if (pendingClipartPaths.length && isPersistableProjectId(project.id)) {
        await fetch(`/api/projects/${project.id}/cliparts`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paths: pendingClipartPaths }),
        }).catch(() => {});
      }
      for (const url of pendingClipartObjectUrls) URL.revokeObjectURL(url);
      uploadedSourceObjectUrlsRef.current = uploadedSourceObjectUrlsRef.current.filter(
        (url) => !pendingClipartObjectUrls.includes(url),
      );
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to upload cliparts." });
      setUploadingCliparts(false);
      return false;
    }
  }

  async function deleteClipartAsset(assetId: string) {
    const current = settingsRef.current;
    const asset = current.clipartAssets.find((item) => item.id === assetId);
    if (!asset) return false;
    if (deletingClipartAssetId) return false;

    const nextSettings = deriveGraphSettings({
      ...current,
      clipartAssets: current.clipartAssets.filter((item) => item.id !== assetId),
      clipartImages: current.clipartImages.filter((clipart) => clipart.assetId !== assetId),
    });

    setDeletingClipartAssetId(assetId);
    setSettingsWithHistory(nextSettings);
    setSelectedClipartAssetId((currentId) => (currentId === assetId ? null : currentId));
    if (placingClipartAssetId === assetId) setPlacingClipartAssetId(null);
    setSelectedDrawingLayerId((currentId) => {
      if (!currentId?.startsWith("clipart:")) return currentId;
      const selectedId = currentId.split(":")[1] ?? "";
      return nextSettings.clipartImages.some((clipart) => clipart.id === selectedId) ? currentId : null;
    });

    if (isPersistableProjectId(project.id)) {
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
        message: error instanceof Error ? error.message : "Unable to delete clipart from the project.",
      }));

      if (!result.ok) {
        setNotice({ tone: "error", text: result.message });
        setDeletingClipartAssetId(null);
        return false;
      }

      removeEditorSessionDraft(project.id);
      setHasSessionDraft(false);
      setNotice({ tone: "ok", text: `"${asset.name}" deleted.` });
      setDeletingClipartAssetId(null);
      return true;
    }

    setNotice({ tone: "ok", text: `"${asset.name}" removed from this editor.` });
    setDeletingClipartAssetId(null);
    return true;
  }

  function selectFullSourceCrop(sourceId = cropSource?.id) {
    const sourceCanvas = sourceId ? sourceCanvasesRef.current.get(sourceId) ?? null : sourceCanvasRef.current;
    if (!sourceCanvas) return;
    const transformed = transformedImageSize(sourceCanvas.width, sourceCanvas.height, sourceCropRotation, sourceCropStraighten);
    setSourceCropArea(fullCrop(transformed.width, transformed.height));
  }

  function applyQuickSourceCrop(segment: QuickCropSegment) {
    const sourceCanvas = cropSource ? sourceCanvasesRef.current.get(cropSource.id) ?? null : sourceCanvasRef.current;
    if (!sourceCanvas) return;
    const transformed = transformedImageSize(sourceCanvas.width, sourceCanvas.height, sourceCropRotation, sourceCropStraighten);
    setSourceCropArea(quickCropWithin(sourceCropArea ?? fullCrop(transformed.width, transformed.height), segment));
  }

  function openSourceCrop(sourceId = cropSource?.id) {
    if (!sourceId) return;
    setCommandPaletteOpen(false);
    setSelectedSourceId(sourceId);
    setSelectedDrawingLayerId(null);
    setSelectedLayerKeys([sourceLayerKey(sourceId)]);
    setInspectorTab("source");
    setSourceCropMode(true);
    setLeftPanelTab("library");
    setSourceCropRotation(0);
    setSourceCropStraighten(0);
    setSourceCropFlipX(false);
    setSourceCropFlipY(false);
    setSourceCropZoom(1);
    setSourceCropInteractionMode("crop");
    setSourceCropBackgroundRemoval(undefined);
    const sourceCanvas = sourceCanvasesRef.current.get(sourceId);
    if (sourceCanvas) setSourceCropArea(fullCrop(sourceCanvas.width, sourceCanvas.height));
  }

  function closeSourceCrop() {
    setSourceCropMode(false);
    setSourceCropArea(null);
    setSourceCropBackgroundRemoval(undefined);
  }

  useEffect(() => {
    if (!sourceCropMode) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSourceCrop();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sourceCropMode]);

  // Escape abandons the in-progress region; Backspace steps back one vertex so
  // a misplaced point does not force starting over.
  useEffect(() => {
    if (drawingTool !== "lasso" || !lassoVertices.length) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.key === "Escape") {
        event.preventDefault();
        cancelLasso();
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        const next = lassoVerticesRef.current.slice(0, -1);
        lassoVerticesRef.current = next;
        setLassoVertices(next);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        commitLassoRegion(lassoVerticesRef.current);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawingTool, lassoVertices.length]);

  async function autoTrimSourceCrop() {
    if (!cropSourcePreviewUrl) return;
    cropDetectionUsedRef.current = true;
    setSourceCropAutoPending(true);
    try {
      const { detectContentCropResult } = await import("@/lib/canvas/crop");
      const detection = await detectContentCropResult({
        imageUrl: cropSourcePreviewUrl,
        rotationDegrees: sourceCropRotation,
        straightenDegrees: sourceCropStraighten,
        flipX: sourceCropFlipX,
        flipY: sourceCropFlipY,
      });
      if (!detection.crop || detection.reason === "edge-to-edge") {
        throw new Error(
          detection.reason === "edge-to-edge"
            ? "Artwork already reaches every image edge. The current crop was kept."
            : "Artwork detection was not confident enough to change this crop.",
        );
      }
      setSourceCropArea(detection.crop);
      setNotice({ tone: "info", text: `Artwork detected at ${Math.round(detection.confidence * 100)}% confidence. Review it before applying.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to detect source edges." });
    } finally {
      setSourceCropAutoPending(false);
    }
  }

  async function applySourceCrop() {
    if (!cropSource || !sourceCropArea) return;
    if (!cropSourcePreviewUrl) return;

    setSourceCropPending(true);
    try {
      const { transformImageUrlToFile } = await import("@/lib/canvas/crop");
      const croppedFile = await transformImageUrlToFile({
        imageUrl: cropSourcePreviewUrl,
        crop: sourceCropArea,
        rotationDegrees: sourceCropRotation,
        straightenDegrees: sourceCropStraighten,
        flipX: sourceCropFlipX,
        flipY: sourceCropFlipY,
        backgroundRemoval: sourceCropBackgroundRemoval,
        fileName: cropSource.name,
        type: "image/png",
      });
      const ok = await uploadSourceImages([croppedFile], "Source crop applied.", cropSource.id);
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

  async function uploadProcessedCanvasImage(canvas: HTMLCanvasElement | null) {
    if (!canvas || !isPersistableProjectId(project.id)) return { ok: true as const };
    const revision = processedRevisionRef.current;
    if (revision === lastUploadedProcessedRevisionRef.current) return { ok: true as const };
    const blob = await canvasToBlob(canvas);
    const response = await fetch(`/api/projects/${project.id}/processed-image`, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: blob,
    });
    if (response.ok) {
      lastUploadedProcessedRevisionRef.current = revision;
      // Dashboard cards render this derivative instead of the full canvas PNG.
      // Best effort: a failure just leaves the card falling back to full size.
      try {
        const thumbnail = await createThumbnailBlob(blob, CARD_THUMBNAIL_MAX_EDGE);
        if (thumbnail) {
          await fetch(`/api/projects/${project.id}/processed-image?variant=thumbnail`, {
            method: "PUT",
            headers: { "Content-Type": "image/webp" },
            body: thumbnail,
          });
        }
      } catch {
        // Ignored: the processed image itself is already saved.
      }
      return { ok: true as const };
    }
    const payload = await response.json().catch(() => ({}));
    return {
      ok: false as const,
      message: typeof payload.message === "string" ? payload.message : "Unable to save processed image.",
    };
  }

  async function saveProjectSnapshot(
    nextSettings: GraphSettings,
    options: { uploadProcessedImage?: boolean; fallbackMessage?: string } = {},
  ) {
    const canvas = processedCanvasRef.current;
    const result = await saveProjectState({
      projectId: project.id,
      title: title.trim(),
      description: description.trim(),
      settings: nextSettings,
      width: canvas?.width ?? nextSettings.outputWidth,
      height: canvas?.height ?? nextSettings.outputHeight,
      colorCount: palette.length,
      palettes: palette.map((color, index) => ({ ...color, sortOrder: index })),
    }).catch((error) => ({
      ok: false as const,
      message: error instanceof Error ? error.message : options.fallbackMessage || "Unable to save project.",
    }));

    if (!result.ok) return result;

    if (options.uploadProcessedImage) {
      const imageResult = await uploadProcessedCanvasImage(canvas).catch((error) => ({
        ok: false as const,
        message: error instanceof Error ? error.message : "Unable to save processed image.",
      }));
      if (!imageResult.ok) {
        return {
          ok: false as const,
          message: `Project settings were saved, but the processed image was not uploaded. ${imageResult.message}`,
        };
      }
    }

    removeEditorSessionDraft(project.id);
    setHasSessionDraft(false);
    return result;
  }

  function saveProject() {
    if (processing || dragPreviewSourceId) {
      setNotice({ tone: "info", text: "Finishing the canvas update before saving." });
      return;
    }
    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    if (!online) {
      setIsOnline(false);
      saveSessionDraft("Offline draft saved in this browser session.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveProjectSnapshot(settingsRef.current, { uploadProcessedImage: true });
        if (!result.ok) {
          saveSessionDraft(`Save did not fully complete. A session draft was saved instead. ${result.message}`, "info");
          return;
        }
        setNotice({ tone: "ok", text: "Project saved." });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unable to save project.";
        saveSessionDraft(`Could not reach the database. Offline draft saved in this browser session. ${detail}`, "info");
      }
    });
  }

  function applyEditorTemplate(templateId: EditorTemplateId) {
    setSettingsWithHistory((current) => {
      if (templateId === "cross-stitch") {
        return {
          ...current,
          gridPattern: "square",
          gridLineStyle: "solid",
          majorGridEvery: 10,
          gridLineThickness: Math.max(1, current.gridLineThickness),
          showNumbers: true,
          gridNumberPlacement: "outside",
          sourceFillThreshold: 0.62,
          sourceFillMinStrokePixels: Math.max(7, current.sourceFillMinStrokePixels),
          imageColorQuantization: 16,
          sourceImages: current.sourceImages.map((source) => ({ ...source, imageColorQuantization: 16 })),
          clipartImages: current.clipartImages.map((clipart) => ({ ...clipart, imageColorQuantization: 16 })),
        };
      }
      if (templateId === "pixel-art") {
        return {
          ...current,
          gridPattern: "square",
          gridLineStyle: "solid",
          majorGridEvery: 5,
          gridLineThickness: 1,
          showNumbers: true,
          sourceFillThreshold: 0.5,
          imageDenoiseLevel: "off",
          imageEdgeDetection: "standard",
          imageColorQuantization: 8,
          sourceImages: current.sourceImages.map((source) => ({
            ...source,
            imageDenoiseLevel: "off",
            imageEdgeDetection: "standard",
            imageColorQuantization: 8,
          })),
          clipartImages: current.clipartImages.map((clipart) => ({
            ...clipart,
            imageDenoiseLevel: "off",
            imageEdgeDetection: "standard",
            imageColorQuantization: 8,
          })),
        };
      }
      if (templateId === "dot-grid") {
        return {
          ...current,
          gridPattern: "dot",
          gridLineStyle: "dotted",
          majorGridEvery: 5,
          gridLineThickness: 2,
          showNumbers: false,
        };
      }
      return {
        ...current,
        printPaperSize: "a4",
        printOrientation: "portrait",
        printHorizontalAlignment: "center",
        printVerticalAlignment: "center",
        pageMargin: 24,
        showPageBreaks: true,
      };
    });
    setNotice({ tone: "ok", text: `${EDITOR_TEMPLATE_OPTIONS.find((option) => option.id === templateId)?.label ?? "Template"} applied.` });
  }

  function exportPNG() {
    if (processing || dragPreviewSourceId) {
      setNotice({ tone: "info", text: "Finishing the canvas update before exporting." });
      return;
    }
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    const finishExport = startGraphPerformanceStage("export", { format: "png", width: canvas.width, height: canvas.height });
    void import("@/lib/canvas/exports")
      .then(({ exportCanvasAsPNG }) => exportCanvasAsPNG(canvas, `${filename}.png`))
      .then(() => finishExport({ completed: true }))
      .catch((error) => {
        finishExport({ failed: true });
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to export PNG." });
      });
  }

  function exportPDF() {
    if (processing || dragPreviewSourceId) {
      setNotice({ tone: "info", text: "Finishing the canvas update before exporting." });
      return;
    }
    // PDF/print draw the grid as crisp vectors over the transparent artwork,
    // so they take the artwork-only canvas (not the flattened, grid-baked one).
    const canvas = artworkCanvasRef.current;
    if (!canvas) return;
    const finishExport = startGraphPerformanceStage("export", { format: "pdf", width: canvas.width, height: canvas.height });
    void import("@/lib/canvas/exports")
      .then(({ exportCanvasAsPDF }) => exportCanvasAsPDF(canvas, `${filename}.pdf`, settings))
      .then(() => finishExport({ completed: true }))
      .catch((error) => {
        finishExport({ failed: true });
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to export PDF." });
      });
  }

  function printGraph() {
    if (processing || dragPreviewSourceId) {
      setNotice({ tone: "info", text: "Finishing the canvas update before printing." });
      return;
    }
    // Print draws a crisp vector grid over the transparent artwork.
    const canvas = artworkCanvasRef.current;
    if (!canvas) return;
    const finishExport = startGraphPerformanceStage("export", { format: "print", width: canvas.width, height: canvas.height });
    void import("@/lib/canvas/exports")
      .then(({ printCanvas }) => printCanvas(canvas, settings, title || "Graph pixel chart"))
      .then(() => finishExport({ completed: true }))
      .catch((error) => {
        finishExport({ failed: true });
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to open print view." });
      });
  }

  function exportJSON() {
    if (processing || dragPreviewSourceId) {
      setNotice({ tone: "info", text: "Finishing the canvas update before exporting." });
      return;
    }
    const finishExport = startGraphPerformanceStage("export", { format: "json" });
    void import("@/lib/canvas/exports")
      .then(({ exportSettingsAsJSON }) => {
        exportSettingsAsJSON(`${filename}.json`, settings, palette, {
          projectId: project.id,
          title,
          description,
          sourceName,
          exportedAt: new Date().toISOString(),
        });
        finishExport({ completed: true });
      })
      .catch((error) => {
        finishExport({ failed: true });
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to export JSON." });
      });
  }

  const selectedCellLayer =
    selectedDrawingLayerId?.startsWith("cell:")
      ? settings.cellPaints.find((cell) => selectedDrawingLayerId === drawingLayerKey("cell", cell.id)) ?? null
      : null;
  const selectedShapeLayer =
    selectedDrawingLayerId?.startsWith("shape:")
      ? settings.graphShapes.find((shape) => selectedDrawingLayerId === drawingLayerKey("shape", shape.id)) ?? null
      : null;
  const selectedClipartLayer =
    selectedDrawingLayerId?.startsWith("clipart:")
      ? settings.clipartImages.find((clipart) => selectedDrawingLayerId === drawingLayerKey("clipart", clipart.id)) ?? null
      : null;
  const selectedSourceIndex = selectedSource ? settings.sourceImages.findIndex((source) => source.id === selectedSource.id) : -1;
  const selectedCellIndex = selectedCellLayer ? settings.cellPaints.findIndex((cell) => cell.id === selectedCellLayer.id) : -1;
  const selectedShapeIndex = selectedShapeLayer ? settings.graphShapes.findIndex((shape) => shape.id === selectedShapeLayer.id) : -1;
  const selectedClipartIndex = selectedClipartLayer ? settings.clipartImages.findIndex((clipart) => clipart.id === selectedClipartLayer.id) : -1;
  const selectedActionKeys = selectedLayerKeysForAction(settings);
  const selectableLayerKeys = Array.from(selectableLayerKeysFromSettings(settings));
  const selectedLayerCount = selectedActionKeys.length;
  const allLayersSelected = selectableLayerKeys.length > 0 && selectedLayerCount === selectableLayerKeys.length;
  const someLayersSelected = selectedLayerCount > 0 && !allLayersSelected;
  const selectedLayerLocked = selectedActionKeys.length
    ? selectedActionKeys.every((key) => {
        const { type, id } = parseLayerKey(key);
        if (type === "source") return Boolean(settings.sourceImages.find((source) => source.id === id)?.locked);
        if (type === "cell") return Boolean(settings.cellPaints.find((cell) => cell.id === id)?.locked);
        if (type === "shape") return Boolean(settings.graphShapes.find((shape) => shape.id === id)?.locked);
        return Boolean(settings.clipartImages.find((clipart) => clipart.id === id)?.locked);
      })
    : Boolean(selectedSource?.locked || selectedCellLayer?.locked || selectedShapeLayer?.locked || selectedClipartLayer?.locked);
  const selectedLayerHidden = selectedActionKeys.length
    ? selectedActionKeys.every((key) => {
        const { type, id } = parseLayerKey(key);
        if (type === "source") return settings.sourceImages.find((source) => source.id === id)?.visible === false;
        if (type === "cell") return settings.cellPaints.find((cell) => cell.id === id)?.visible === false;
        if (type === "shape") return settings.graphShapes.find((shape) => shape.id === id)?.visible === false;
        return settings.clipartImages.find((clipart) => clipart.id === id)?.visible === false;
      })
    : Boolean(selectedSource?.visible === false || selectedCellLayer?.visible === false || selectedShapeLayer?.visible === false || selectedClipartLayer?.visible === false);
  const selectedLayerContainsHidden = selectedActionKeys.some((key) => {
    const { type, id } = parseLayerKey(key);
    if (type === "source") return settings.sourceImages.find((source) => source.id === id)?.visible === false;
    if (type === "cell") return settings.cellPaints.find((cell) => cell.id === id)?.visible === false;
    if (type === "shape") return settings.graphShapes.find((shape) => shape.id === id)?.visible === false;
    return settings.clipartImages.find((clipart) => clipart.id === id)?.visible === false;
  });
  const hasSelectedLayer = selectedLayerCount > 0;
  const selectionHasGroup = selectedActionKeys.some((key) => Boolean(layerGroupIdForKey(settings, key)));
  const canGroupSelection = selectedLayerCount > 1;
  const selectedLayerContainsLocked = selectedLayerCount > 0 && layerSelectionContainsLocked(settings, selectedActionKeys);
  const selectedLayerStateMixed =
    selectedLayerCount > 1
    && (
      (selectedLayerContainsLocked && !selectedLayerLocked)
      || (selectedLayerContainsHidden && !selectedLayerHidden)
    );
  const selectedLayerBounds = selectedLayerCount > 1 ? selectionBoundsForOverlay(settings, selectedActionKeys) : null;
  const sourceErrorCount = Object.values(sourceStatus).filter((status) => status.error).length;
  const visibleLayerCount = settings.sourceImages.length + settings.cellPaints.length + settings.graphShapes.length + settings.clipartImages.length;
  const generatedLayerCount = settings.graphShapes.length + settings.clipartImages.length;
  const projectAssetCount = settings.sourceImages.length + settings.clipartImages.length;
  const projectAssetsSettled =
    (!settings.sourceImages.length || sourceLoadSettled)
    && (!settings.clipartImages.length || clipartLoadSettled);
  const projectAssetsReady =
    (!settings.sourceImages.length || (sourceLoadSettled && sourceReady))
    && (!settings.clipartImages.length || (clipartLoadSettled && clipartReady));
  const workspaceBootPending = !draftChecked;
  const projectAssetsPending = draftChecked && !projectAssetsSettled;
  const projectAssetLoadFailed =
    draftChecked
    && projectAssetsSettled
    && !projectAssetsReady;
  const initialAssetLoadFailed =
    !initialCanvasReady
    && projectAssetLoadFailed;
  const currentGraphRenderFailed =
    failedProcessingSignature === currentProcessingSignature;
  const initialGraphRenderFailed =
    !initialCanvasReady
    && currentGraphRenderFailed;
  const initialCanvasFailed = initialAssetLoadFailed || initialGraphRenderFailed;
  // This mask is deliberately a one-time bootstrap surface. Once the first
  // settled graph frame has painted, edits continue in-place without bringing
  // the project loader back over the working canvas.
  const canvasBootstrapPending = !initialCanvasReady && !initialCanvasFailed;
  const canvasLoaderVisible = !initialCanvasReady;
  const canvasLoaderPhase = initialCanvasFailed
    ? "error"
    : workspaceBootPending || projectAssetsPending
      ? "assets"
      : "render";
  const canvasLoaderLabel = workspaceBootPending
    ? "Preparing project workspace"
    : initialAssetLoadFailed
      ? "Unable to load project assets"
      : initialGraphRenderFailed
        ? "Unable to render graph"
        : projectAssetsPending
          ? `Loading ${projectAssetCount} project asset${projectAssetCount === 1 ? "" : "s"}`
          : "Rendering graph";
  const graphFrameOutdated =
    draftChecked
    && projectAssetsReady
    && (
      lastProcessedSignatureRef.current !== currentProcessingSignature
      || !processedCanvasRef.current
    );
  const graphUpdatePending = graphFrameOutdated && !currentGraphRenderFailed;
  const canvasUpdatePending =
    canvasBootstrapPending
    || projectAssetsPending
    || graphUpdatePending
    || processing
    || Boolean(dragPreviewSourceId);
  const canvasUpdateLabel = dragPreviewSourceId
    ? isDraggingGraph
      ? "Positioning layer"
      : "Finalizing layer"
    : workspaceBootPending
      ? "Preparing project"
      : projectAssetsPending
        ? "Loading project assets"
        : "Processing graph";
  const statusLabel = initialAssetLoadFailed
    ? "Project assets unavailable"
    : initialGraphRenderFailed
      ? "Graph render failed"
      : projectAssetLoadFailed
        ? "Project assets unavailable"
        : currentGraphRenderFailed
          ? "Graph update failed"
          : canvasUpdatePending
            ? canvasUpdateLabel
            : sourceErrorCount
              ? "Source needs attention"
              : "Ready";
  const navigatorStatusTone: "attention" | "positive" =
    initialCanvasFailed
    || projectAssetLoadFailed
    || currentGraphRenderFailed
    || sourceErrorCount > 0
      ? "attention"
      : "positive";
  const draftShapePreviewDimensions = draftShapeDimensionsCells();
  const draftClipartPreviewDimensions = draftClipartDimensionsCells(selectedClipartAsset);
  const filteredClipartAssets = useMemo(() => {
    const search = clipartSearch.trim().toLowerCase();
    if (!search) return settings.clipartAssets;
    return settings.clipartAssets.filter((asset) => asset.name.toLowerCase().includes(search));
  }, [clipartSearch, settings.clipartAssets]);

  function selectedLayerTitle(action: string) {
    return selectedLayerCount > 1 ? `${action} ${selectedLayerCount} selected layers` : `${action} selected layer`;
  }

  function selectedLayerCanMove(direction: -1 | 1) {
    if (selectedSource) {
      const next = selectedSourceIndex + direction;
      return selectedSourceIndex >= 0 && next >= 0 && next < settings.sourceImages.length && !selectedSource.locked && !settings.sourceImages[next]?.locked;
    }
    if (selectedCellLayer) {
      const next = selectedCellIndex + direction;
      return selectedCellIndex >= 0 && next >= 0 && next < settings.cellPaints.length && !selectedCellLayer.locked && !settings.cellPaints[next]?.locked;
    }
    if (selectedShapeLayer) {
      const next = selectedShapeIndex + direction;
      return selectedShapeIndex >= 0 && next >= 0 && next < settings.graphShapes.length && !selectedShapeLayer.locked && !settings.graphShapes[next]?.locked;
    }
    if (selectedClipartLayer) {
      const next = selectedClipartIndex + direction;
      return selectedClipartIndex >= 0 && next >= 0 && next < settings.clipartImages.length && !selectedClipartLayer.locked && !settings.clipartImages[next]?.locked;
    }
    return false;
  }

  function moveSelectedLayer(direction: -1 | 1) {
    if (selectedSource) moveSourceImage(selectedSource.id, direction);
    else if (selectedCellLayer) moveDrawingLayer("cell", selectedCellLayer.id, direction);
    else if (selectedShapeLayer) moveDrawingLayer("shape", selectedShapeLayer.id, direction);
    else if (selectedClipartLayer) moveDrawingLayer("clipart", selectedClipartLayer.id, direction);
  }

  function toggleSelectedLayerLock() {
    const keys = selectedLayerKeysForAction();
    if (!keys.length) return;
    setSettingsWithHistory((current) => {
      const selected = new Set(keys);
      const allLocked = keys.every((key) => {
        const { type, id } = parseLayerKey(key);
        if (type === "source") return Boolean(current.sourceImages.find((source) => source.id === id)?.locked);
        if (type === "cell") return Boolean(current.cellPaints.find((cell) => cell.id === id)?.locked);
        if (type === "shape") return Boolean(current.graphShapes.find((shape) => shape.id === id)?.locked);
        return Boolean(current.clipartImages.find((clipart) => clipart.id === id)?.locked);
      });
      const locked = !allLocked;
      return {
        ...current,
        sourceImages: current.sourceImages.map((source) => (selected.has(sourceLayerKey(source.id)) ? { ...source, locked } : source)),
        cellPaints: current.cellPaints.map((cell) => (selected.has(drawingLayerKey("cell", cell.id)) ? { ...cell, locked } : cell)),
        graphShapes: current.graphShapes.map((shape) => (selected.has(drawingLayerKey("shape", shape.id)) ? { ...shape, locked } : shape)),
        clipartImages: current.clipartImages.map((clipart) => (selected.has(drawingLayerKey("clipart", clipart.id)) ? { ...clipart, locked } : clipart)),
      };
    });
  }

  function toggleSelectedLayerVisibility() {
    const keys = selectedLayerKeysForAction();
    if (!keys.length) return;
    setSettingsWithHistory((current) => {
      const selected = new Set(keys);
      const allHidden = keys.every((key) => {
        const { type, id } = parseLayerKey(key);
        if (type === "source") return current.sourceImages.find((source) => source.id === id)?.visible === false;
        if (type === "cell") return current.cellPaints.find((cell) => cell.id === id)?.visible === false;
        if (type === "shape") return current.graphShapes.find((shape) => shape.id === id)?.visible === false;
        return current.clipartImages.find((clipart) => clipart.id === id)?.visible === false;
      });
      const visible = allHidden;
      return {
        ...current,
        sourceImages: current.sourceImages.map((source) => (selected.has(sourceLayerKey(source.id)) ? { ...source, visible } : source)),
        cellPaints: current.cellPaints.map((cell) => (selected.has(drawingLayerKey("cell", cell.id)) ? { ...cell, visible } : cell)),
        graphShapes: current.graphShapes.map((shape) => (selected.has(drawingLayerKey("shape", shape.id)) ? { ...shape, visible } : shape)),
        clipartImages: current.clipartImages.map((clipart) => (selected.has(drawingLayerKey("clipart", clipart.id)) ? { ...clipart, visible } : clipart)),
      };
    });
  }

  function duplicateSelectedLayers() {
    const keys = selectedLayerKeysForAction();
    if (!keys.length) return;
    let nextPrimary: SelectableLayerKey | null = null;
    const duplicatedKeys: SelectableLayerKey[] = [];
    setSettingsWithHistory((current) => {
      const selected = new Set(keys);
      const fillRegionScopeRemaps: { from: string; to: string }[] = [];
      const sourceCopies = current.sourceImages
        .filter((source) => selected.has(sourceLayerKey(source.id)) && !source.locked)
        .map((source) => {
          const id = drawingId("source");
          const key = sourceLayerKey(id);
          fillRegionScopeRemaps.push({ from: fillRegionLayerScope("source", source.id), to: fillRegionLayerScope("source", id) });
          duplicatedKeys.push(key);
          nextPrimary = key;
          return {
            ...source,
            id,
            name: `${source.name.replace(/\s+copy$/i, "")} copy`,
            x: clampSourceX(source.x + COPY_OFFSET_CELLS, current.graphWidth, source.width),
            y: clampFreeCellCoordinate(source.y + COPY_OFFSET_CELLS, source.y),
            locked: false,
            visible: true,
          };
        });
      const cellCopies = current.cellPaints
        .filter((cell) => selected.has(drawingLayerKey("cell", cell.id)) && !cell.locked)
        .map((cell) => {
          const id = drawingId("cell");
          const key = drawingLayerKey("cell", id);
          duplicatedKeys.push(key);
          nextPrimary = key;
          return {
            ...cell,
            id,
            name: `${cell.name.replace(/\s+copy$/i, "")} copy`,
            x: roundCells(Math.max(0, cell.x + COPY_OFFSET_CELLS)),
            y: roundCells(Math.max(0, cell.y + COPY_OFFSET_CELLS)),
            locked: false,
            visible: true,
          };
        });
      const shapeCopies = current.graphShapes
        .filter((shape) => selected.has(drawingLayerKey("shape", shape.id)) && !shape.locked)
        .map((shape) => {
          const id = drawingId("shape");
          const key = drawingLayerKey("shape", id);
          duplicatedKeys.push(key);
          nextPrimary = key;
          return {
            ...shape,
            id,
            name: `${shape.name.replace(/\s+copy$/i, "")} copy`,
            x: clampFreeCellCoordinate(shape.x + COPY_OFFSET_CELLS, shape.x),
            y: clampFreeCellCoordinate(shape.y + COPY_OFFSET_CELLS, shape.y),
            locked: false,
            visible: true,
          };
        });
      const clipartCopies = current.clipartImages
        .filter((clipart) => selected.has(drawingLayerKey("clipart", clipart.id)) && !clipart.locked)
        .map((clipart) => {
          const id = drawingId("clipart");
          const key = drawingLayerKey("clipart", id);
          fillRegionScopeRemaps.push({ from: fillRegionLayerScope("clipart", clipart.id), to: fillRegionLayerScope("clipart", id) });
          duplicatedKeys.push(key);
          nextPrimary = key;
          return {
            ...clipart,
            id,
            name: `${clipart.name.replace(/\s+copy$/i, "")} copy`,
            x: clampFreeCellCoordinate(clipart.x + COPY_OFFSET_CELLS, clipart.x),
            y: clampFreeCellCoordinate(clipart.y + COPY_OFFSET_CELLS, clipart.y),
            locked: false,
            visible: true,
          };
        });
      if (!sourceCopies.length && !cellCopies.length && !shapeCopies.length && !clipartCopies.length) return current;
      return {
        ...current,
        fillRegions: copyFillRegionOverrides(current.fillRegions, fillRegionScopeRemaps),
        sourceImages: [...current.sourceImages, ...sourceCopies],
        cellPaints: [...current.cellPaints, ...cellCopies],
        graphShapes: [...current.graphShapes, ...shapeCopies],
        clipartImages: [...current.clipartImages, ...clipartCopies],
      };
    });
    if (duplicatedKeys.length) setSelectedLayerKeys(duplicatedKeys);
    if (nextPrimary) {
      const { type, id } = parseLayerKey(nextPrimary);
      if (type === "source") {
        setSelectedSourceId(id);
        setSelectedDrawingLayerId(null);
        setInspectorTab("source");
      } else {
        setSelectedSourceId(null);
        setSelectedDrawingLayerId(nextPrimary as DrawingLayerKey);
        setInspectorTab("source");
        if (type === "shape" || type === "clipart") setGeneratedImagesCollapsed(false);
      }
      setSettingsPanelCollapsed(false);
    }
    setNotice({ tone: "ok", text: `${duplicatedKeys.length} layer${duplicatedKeys.length === 1 ? "" : "s"} duplicated.` });
  }

  function focusPrimarySelection(key: SelectableLayerKey | null) {
    if (!key) return;
    const { type, id } = parseLayerKey(key);
    if (type === "source") {
      setSelectedSourceId(id);
      setSelectedDrawingLayerId(null);
      setInspectorTab("source");
    } else {
      setSelectedSourceId(null);
      setSelectedDrawingLayerId(key as DrawingLayerKey);
      setInspectorTab("source");
      if (type === "shape" || type === "clipart") setGeneratedImagesCollapsed(false);
    }
    setSettingsPanelCollapsed(false);
  }

  function groupSelectedLayers() {
    const keys = selectedLayerKeysForAction();
    if (keys.length < 2) {
      setNotice({ tone: "info", text: "Select at least two layers to group." });
      return;
    }
    const groupId = drawingId("group");
    const selected = new Set(keys);
    setSettingsWithHistory((current) => {
      const nextIndex = (current.layerGroups?.length ?? 0) + 1;
      const assign = <T extends { id: string; groupId?: string | null }>(layer: T, key: SelectableLayerKey): T =>
        selected.has(key) ? { ...layer, groupId } : layer;
      return {
        ...current,
        sourceImages: current.sourceImages.map((source) => assign(source, sourceLayerKey(source.id))),
        cellPaints: current.cellPaints.map((cell) => assign(cell, drawingLayerKey("cell", cell.id))),
        graphShapes: current.graphShapes.map((shape) => assign(shape, drawingLayerKey("shape", shape.id))),
        clipartImages: current.clipartImages.map((clipart) => assign(clipart, drawingLayerKey("clipart", clipart.id))),
        layerGroups: [...(current.layerGroups ?? []), { id: groupId, name: `Group ${nextIndex}` }],
      };
    });
    setNotice({ tone: "ok", text: `Grouped ${keys.length} layers.` });
  }

  function ungroupSelectedLayers() {
    const keys = selectedLayerKeysForAction();
    if (!keys.length) return;
    const groupIds = new Set<string>();
    for (const key of keys) {
      const groupId = layerGroupIdForKey(settingsRef.current, key);
      if (groupId) groupIds.add(groupId);
    }
    if (!groupIds.size) {
      setNotice({ tone: "info", text: "No grouped layers are selected." });
      return;
    }
    const clearIfGrouped = <T extends { groupId?: string | null }>(layer: T): T =>
      layer.groupId && groupIds.has(layer.groupId) ? { ...layer, groupId: null } : layer;
    setSettingsWithHistory((current) => ({
      ...current,
      sourceImages: current.sourceImages.map(clearIfGrouped),
      cellPaints: current.cellPaints.map(clearIfGrouped),
      graphShapes: current.graphShapes.map(clearIfGrouped),
      clipartImages: current.clipartImages.map(clearIfGrouped),
      layerGroups: (current.layerGroups ?? []).filter((group) => !groupIds.has(group.id)),
    }));
    setNotice({ tone: "ok", text: "Ungrouped selected layers." });
  }

  function resizeSelectedLayerBounds(size: { width?: number; height?: number }) {
    const keys = selectedLayerKeysForAction();
    if (keys.length < 2) return;
    setSettingsWithHistory((current) => {
      if (layerSelectionContainsLocked(current, keys)) return current;
      const starts = layerStartsForSelection(current, keys);
      const bounds = selectionBoundsForLayerStarts(current, starts);
      if (!bounds) return current;
      const nextBounds = {
        ...bounds,
        width: size.width === undefined ? bounds.width : Math.max(0.25, size.width),
        height: size.height === undefined ? bounds.height : Math.max(0.25, size.height),
      };
      const resized = resizeLayerSelection(current, starts, bounds, nextBounds);
      return resized.changed ? deriveGraphSettings(resized.next) : current;
    });
  }

  function transformSelectedLayers(transform: { type: "flip"; axis: "x" | "y" } | { type: "rotate"; direction: -1 | 1 }) {
    const keys = selectedLayerKeysForAction();
    if (!keys.length) return;
    if (keys.length === 1) {
      const selectedKey = keys[0];
      setSettingsWithHistory((current) => {
        if (layerSelectionContainsLocked(current, keys)) return current;
        return {
          ...current,
          sourceImages: current.sourceImages.map((source) =>
            sourceLayerKey(source.id) === selectedKey ? transformLayerOrientation(source, transform) : source,
          ),
          cellPaints: current.cellPaints.map((cell) =>
            drawingLayerKey("cell", cell.id) === selectedKey ? transformLayerOrientation(cell, transform) : cell,
          ),
          graphShapes: current.graphShapes.map((shape) =>
            drawingLayerKey("shape", shape.id) === selectedKey ? transformLayerOrientation(shape, transform) : shape,
          ),
          clipartImages: current.clipartImages.map((clipart) =>
            drawingLayerKey("clipart", clipart.id) === selectedKey ? transformLayerOrientation(clipart, transform) : clipart,
          ),
        };
      });
      return;
    }
    setSettingsWithHistory((current) => {
      if (layerSelectionContainsLocked(current, keys)) return current;
      const starts = layerStartsForSelection(current, keys);
      const bounds = selectionBoundsForLayerStarts(current, starts);
      if (!bounds) return current;
      const transformed = transformLayerSelection(current, starts, bounds, transform);
      return transformed.changed ? deriveGraphSettings(transformed.next) : current;
    });
  }

  function rotateSelectedLayers(direction: -1 | 1) {
    transformSelectedLayers({ type: "rotate", direction });
  }

  function flipSelectedLayers(axis: "x" | "y") {
    transformSelectedLayers({ type: "flip", axis });
  }

  function copySelectedLayers(): boolean {
    const keys = selectedLayerKeysForAction();
    if (!keys.length) return false;
    const selected = new Set(keys);
    const current = settingsRef.current;
    const clip = {
      sources: current.sourceImages.filter((source) => selected.has(sourceLayerKey(source.id))).map((source) => ({ ...source })),
      cells: current.cellPaints.filter((cell) => selected.has(drawingLayerKey("cell", cell.id))).map((cell) => ({ ...cell })),
      shapes: current.graphShapes.filter((shape) => selected.has(drawingLayerKey("shape", shape.id))).map((shape) => ({ ...shape })),
      cliparts: current.clipartImages.filter((clipart) => selected.has(drawingLayerKey("clipart", clipart.id))).map((clipart) => ({ ...clipart })),
    };
    const total = clip.sources.length + clip.cells.length + clip.shapes.length + clip.cliparts.length;
    if (!total) return false;
    layerClipboardRef.current = clip;
    setClipboardCount(total);
    setCopiedFillColor(null);
    setNotice({ tone: "ok", text: `Copied ${total} layer${total === 1 ? "" : "s"}.` });
    return true;
  }

  function pasteLayers(): boolean {
    const clip = layerClipboardRef.current;
    if (!clip) return false;
    const total = clip.sources.length + clip.cells.length + clip.shapes.length + clip.cliparts.length;
    if (!total) return false;
    const groupRemap = new Map<string, string>();
    const remapGroup = (groupId?: string | null): string | null => {
      if (!groupId) return null;
      let next = groupRemap.get(groupId);
      if (!next) {
        next = drawingId("group");
        groupRemap.set(groupId, next);
      }
      return next;
    };
    const copyName = (name: string) => `${name.replace(/\s+copy$/i, "")} copy`;
    const pastedKeys: SelectableLayerKey[] = [];
    let nextPrimary: SelectableLayerKey | null = null;
    setSettingsWithHistory((current) => {
      const fillRegionScopeRemaps: { from: string; to: string }[] = [];
      const sourceCopies = clip.sources.map((source) => {
        const id = drawingId("source");
        const key = sourceLayerKey(id);
        fillRegionScopeRemaps.push({ from: fillRegionLayerScope("source", source.id), to: fillRegionLayerScope("source", id) });
        pastedKeys.push(key);
        nextPrimary = key;
        return {
          ...source,
          id,
          name: copyName(source.name),
          x: clampSourceX(source.x + COPY_OFFSET_CELLS, current.graphWidth, source.width),
          y: clampFreeCellCoordinate(source.y + COPY_OFFSET_CELLS, source.y),
          locked: false,
          visible: true,
          groupId: remapGroup(source.groupId),
        };
      });
      const cellCopies = clip.cells.map((cell) => {
        const id = drawingId("cell");
        const key = drawingLayerKey("cell", id);
        pastedKeys.push(key);
        nextPrimary = key;
        return {
          ...cell,
          id,
          name: copyName(cell.name),
          x: roundCells(Math.max(0, cell.x + COPY_OFFSET_CELLS)),
          y: roundCells(Math.max(0, cell.y + COPY_OFFSET_CELLS)),
          locked: false,
          visible: true,
          groupId: remapGroup(cell.groupId),
        };
      });
      const shapeCopies = clip.shapes.map((shape) => {
        const id = drawingId("shape");
        const key = drawingLayerKey("shape", id);
        pastedKeys.push(key);
        nextPrimary = key;
        return {
          ...shape,
          id,
          name: copyName(shape.name),
          x: clampFreeCellCoordinate(shape.x + COPY_OFFSET_CELLS, shape.x),
          y: clampFreeCellCoordinate(shape.y + COPY_OFFSET_CELLS, shape.y),
          locked: false,
          visible: true,
          groupId: remapGroup(shape.groupId),
        };
      });
      const clipartCopies = clip.cliparts.map((clipart) => {
        const id = drawingId("clipart");
        const key = drawingLayerKey("clipart", id);
        fillRegionScopeRemaps.push({ from: fillRegionLayerScope("clipart", clipart.id), to: fillRegionLayerScope("clipart", id) });
        pastedKeys.push(key);
        nextPrimary = key;
        return {
          ...clipart,
          id,
          name: copyName(clipart.name),
          x: clampFreeCellCoordinate(clipart.x + COPY_OFFSET_CELLS, clipart.x),
          y: clampFreeCellCoordinate(clipart.y + COPY_OFFSET_CELLS, clipart.y),
          locked: false,
          visible: true,
          groupId: remapGroup(clipart.groupId),
        };
      });
      const newGroups = Array.from(groupRemap.entries()).map(([oldId, newId]) => ({
        id: newId,
        name: copyName(current.layerGroups?.find((group) => group.id === oldId)?.name ?? "Group"),
      }));
      return {
        ...current,
        fillRegions: copyFillRegionOverrides(current.fillRegions, fillRegionScopeRemaps),
        sourceImages: [...current.sourceImages, ...sourceCopies],
        cellPaints: [...current.cellPaints, ...cellCopies],
        graphShapes: [...current.graphShapes, ...shapeCopies],
        clipartImages: [...current.clipartImages, ...clipartCopies],
        layerGroups: [...(current.layerGroups ?? []), ...newGroups],
      };
    });
    if (pastedKeys.length) setSelectedLayerKeys(pastedKeys);
    focusPrimarySelection(nextPrimary);
    setNotice({ tone: "ok", text: `Pasted ${total} layer${total === 1 ? "" : "s"}.` });
    return true;
  }

  function deleteSelectedLayer(options: { skipConfirm?: boolean } = {}) {
    const keys = selectedLayerKeysForAction();
    if (!keys.length) return;
    if (!options.skipConfirm && !window.confirm(`Delete ${keys.length} selected layer${keys.length === 1 ? "" : "s"} from this project?`)) return;
    const selected = new Set(keys);
    setSettingsWithHistory((current) => {
      const removedScopes = [
        ...current.sourceImages
          .filter((source) => selected.has(sourceLayerKey(source.id)) && !source.locked)
          .map((source) => fillRegionLayerScope("source", source.id)),
        ...current.clipartImages
          .filter((clipart) => selected.has(drawingLayerKey("clipart", clipart.id)) && !clipart.locked)
          .map((clipart) => fillRegionLayerScope("clipart", clipart.id)),
      ];
      return {
        ...current,
        fillRegions: removeFillRegionOverridesForScopes(current.fillRegions, removedScopes),
        sourceImages: current.sourceImages.filter((source) => !selected.has(sourceLayerKey(source.id)) || source.locked),
        cellPaints: current.cellPaints.filter((cell) => !selected.has(drawingLayerKey("cell", cell.id)) || cell.locked),
        graphShapes: current.graphShapes.filter((shape) => !selected.has(drawingLayerKey("shape", shape.id)) || shape.locked),
        clipartImages: current.clipartImages.filter((clipart) => !selected.has(drawingLayerKey("clipart", clipart.id)) || clipart.locked),
      };
    });
    setSelectedSourceId(null);
    setSelectedDrawingLayerId(null);
    setSelectedLayerKeys([]);
  }

  function renderLayerListActionToolbar() {
    return (
      <div className="editor-layer-list-actions" role="toolbar" aria-label="Layer list actions" data-layer-list-actions>
        <button type="button" onClick={groupSelectedLayers} disabled={!canGroupSelection} className="editor-layer-action editor-layer-action--group" title="Group selected layers (Ctrl/Cmd+G)" aria-label="Group selected layers">
          <Group size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={ungroupSelectedLayers} disabled={!selectionHasGroup} className="editor-layer-action editor-layer-action--ungroup" title="Ungroup selected layers (Ctrl/Cmd+Shift+G)" aria-label="Ungroup selected layers">
          <Ungroup size={14} aria-hidden="true" />
        </button>
        <label
          className={`editor-layer-action editor-layer-action--replace ${!selectedSource || selectedSource.locked || uploadingSources ? "is-disabled" : ""}`}
          title="Replace selected source"
          aria-disabled={!selectedSource || selectedSource.locked || uploadingSources}
        >
          {replacingSourceId ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
          <span className="sr-only">Replace selected source</span>
          <input type="file" accept={IMAGE_ACCEPT} disabled={!selectedSource || selectedSource.locked || uploadingSources} aria-label="Replace selected source" className="sr-only" onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = "";
            if (file && selectedSource) void uploadSourceImages([file], `"${selectedSource.name}" replaced.`, selectedSource.id);
          }} />
        </label>
        <button type="button" onClick={toggleSelectedLayerVisibility} disabled={!hasSelectedLayer} className="editor-layer-action editor-layer-action--visibility" title={selectedLayerTitle(selectedLayerHidden ? "Show" : "Hide")} aria-label={selectedLayerTitle(selectedLayerHidden ? "Show" : "Hide")}>
          {selectedLayerHidden ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
        </button>
        <button type="button" onClick={() => moveSelectedLayer(-1)} disabled={!selectedLayerCanMove(-1)} className="editor-layer-action editor-layer-action--up" title="Move selected layer up" aria-label="Move selected layer up"><ArrowUp size={15} aria-hidden="true" /></button>
        <button type="button" onClick={() => moveSelectedLayer(1)} disabled={!selectedLayerCanMove(1)} className="editor-layer-action editor-layer-action--down" title="Move selected layer down" aria-label="Move selected layer down"><ArrowDown size={15} aria-hidden="true" /></button>
        <button type="button" onClick={() => deleteSelectedLayer()} disabled={!hasSelectedLayer || selectedLayerLocked} className="editor-layer-action editor-layer-action--delete" title={selectedLayerTitle("Delete")} aria-label={selectedLayerTitle("Delete")}>
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  function renderSourceThumbnail(source: GraphSourceImage, className = "h-12 w-12") {
    const previewUrl = sourceStatus[source.id]?.previewUrl;
    return previewUrl ? (
      <img src={previewUrl} alt="" className={`${className} shrink-0 rounded border border-[var(--editor-line)] bg-[var(--artboard-bg)] object-contain p-1`} />
    ) : (
      <span className={`${className} grid shrink-0 place-items-center rounded border border-[var(--editor-line)] bg-[var(--artboard-bg)] text-[var(--editor-muted)]`}>
        <ImageIcon size={16} aria-hidden="true" />
      </span>
    );
  }

  function renderCellThumbnail(cell: GraphCellPaint, className = "h-12 w-12") {
    return (
      <span className={`${className} grid shrink-0 place-items-center rounded border border-[var(--editor-line)] bg-[var(--artboard-bg)] p-1`}>
        <span className="h-[70%] w-[70%] border-2" style={{ borderColor: cell.lineColor, backgroundColor: isTransparentFillColor(cell.fillColor) ? "transparent" : cell.fillColor }} />
      </span>
    );
  }

  function renderShapeThumbnail(shape: GraphShapeDrawing, className = "h-12 w-12") {
    return (
      <span className={`${className} grid shrink-0 place-items-center rounded border border-[var(--editor-line)] bg-[var(--artboard-bg)] p-1`}>
        <ShapePreviewSvg kind={shape.kind} sides={shape.sides} fillColor={shape.fillColor} strokeColor={shape.strokeColor} strokeWidth={shape.strokeWidth} strokeStyle={shape.strokeStyle} widthCells={shape.width} heightCells={shape.height} />
        <span className="sr-only">{GRAPH_SHAPE_KIND_LABELS[shape.kind]}</span>
      </span>
    );
  }

  function renderClipartThumbnail(clipart: GraphClipartImage, className = "h-12 w-12") {
    const asset = settings.clipartAssets.find((item) => item.id === clipart.assetId);
    const previewUrl = asset?.url ?? asset?.dataUrl ?? null;
    return previewUrl ? (
      <img src={previewUrl} alt="" className={`${className} shrink-0 rounded border border-[var(--editor-line)] bg-[var(--artboard-bg)] object-contain p-1`} />
    ) : (
      <span className={`${className} grid shrink-0 place-items-center rounded border border-[var(--editor-line)] bg-[var(--artboard-bg)] text-[var(--editor-muted)]`}>
        <ImageIcon size={16} aria-hidden="true" />
      </span>
    );
  }

  function renderClipartAdvanced(clipart: GraphClipartImage) {
    return (
      <div className="editor-object-properties">
        <InspectorFieldGrid className="editor-object-properties__primary">
          <NumberField label="Width" unit="cm" emphasis="primary" value={roundMeasure(clipart.width * settings.cellSizeCm)} min={0.01} max={1000} step={0.1} allowDecimalInput disabled={clipart.locked} onChange={(value) => updateClipartPhysicalWidthCm(clipart.id, value)} />
          <NumberField label="Height" unit="cm" emphasis="primary" value={roundMeasure(clipart.height * settings.cellSizeCm)} min={0.01} max={1000} step={0.1} allowDecimalInput disabled={clipart.locked} onChange={(value) => updateClipartPhysicalHeightCm(clipart.id, value)} />
        </InspectorFieldGrid>
        <InspectorFieldGrid>
          <ColorPresetField label="Stroke" value={clipart.strokeColor} onChange={(value) => updateClipartImage(clipart.id, { strokeColor: value })} />
          <ColorPresetField label="Fill" value={clipart.fillColor} onChange={(value) => updateClipartImage(clipart.id, { fillColor: value })} allowTransparent />
        </InspectorFieldGrid>
        <InspectorDisclosure title="Trace details" summary={clipart.vectorizerFidelity === "exact" ? "Exact" : "Smooth"}>
          <InspectorFieldGrid>
            <NumberField label="Line adjustment" value={clipart.vectorizerLineAdjust} min={MIN_VECTORIZER_LINE_ADJUST} max={MAX_VECTORIZER_LINE_ADJUST} step={0.5} allowDecimalInput disabled={clipart.locked} onChange={(value) => updateClipartImage(clipart.id, { vectorizerLineAdjust: value })} />
            <label className="editor-inspector-field">
              <span className="editor-inspector-field__label">Fidelity</span>
              <select value={clipart.vectorizerFidelity} disabled={clipart.locked} onChange={(event) => updateClipartImage(clipart.id, { vectorizerFidelity: event.target.value as GraphClipartImage["vectorizerFidelity"] })} className="editor-inspector-control">
                {GRAPH_VECTORIZER_FIDELITY_KEYS.map((key) => (
                  <option key={key} value={key}>{key === "exact" ? "Exact" : "Smooth"}</option>
                ))}
              </select>
            </label>
            <NumberField label="Ink threshold" value={clipart.vectorizerInkThreshold} min={MIN_VECTORIZER_INK_THRESHOLD} max={MAX_VECTORIZER_INK_THRESHOLD} step={1} disabled={clipart.locked} onChange={(value) => updateClipartImage(clipart.id, { vectorizerInkThreshold: Math.round(value) })} />
            <NumberField label="Remove sketch lines" value={clipart.vectorizerSketchRemoval ?? DEFAULT_VECTORIZER_SKETCH_REMOVAL} min={MIN_VECTORIZER_SKETCH_REMOVAL} max={MAX_VECTORIZER_SKETCH_REMOVAL} step={1} disabled={clipart.locked} onChange={(value) => updateClipartImage(clipart.id, { vectorizerSketchRemoval: Math.round(value) })} />
          </InspectorFieldGrid>
        </InspectorDisclosure>
      </div>
    );
  }

  function renderShapeAdvanced(shape: GraphShapeDrawing) {
    const supportsSides = shapeSupportsSides(shape.kind);
    const openPath = shape.kind === "line" || shape.kind === "arrow";
    return (
      <div className="editor-object-properties">
        <InspectorFieldGrid columns={1} className="editor-object-properties__primary">
          <label className="editor-inspector-field">
            <span className="editor-inspector-field__label">Shape</span>
            <select value={shape.kind} disabled={shape.locked} onChange={(event) => updateGraphShape(shape.id, { kind: event.target.value as GraphShapeKind })} className="editor-inspector-control">
              {GENERATED_SHAPE_KIND_KEYS.includes(shape.kind as GeneratedShapeKind) ? null : <option value={shape.kind}>Legacy {GRAPH_SHAPE_KIND_LABELS[shape.kind]}</option>}
              {GENERATED_SHAPE_KIND_KEYS.map((kind) => <option key={kind} value={kind}>{GRAPH_SHAPE_KIND_LABELS[kind]}</option>)}
            </select>
          </label>
        </InspectorFieldGrid>
        <InspectorFieldGrid columns={shapeUsesSingleSize(shape.kind) ? 1 : 2}>
          <NumberField label={shapeUsesSingleSize(shape.kind) ? "Size" : "Width"} unit="cm" emphasis="primary" value={shapePhysicalWidthCm(shape)} min={0.01} max={1000} step={0.1} allowDecimalInput disabled={shape.locked} onChange={(value) => updateGraphShapePhysicalWidthCm(shape.id, value)} />
          {shapeUsesSingleSize(shape.kind) ? null : <NumberField label="Height" unit="cm" emphasis="primary" value={shapePhysicalHeightCm(shape)} min={0.01} max={1000} step={0.1} allowDecimalInput disabled={shape.locked} onChange={(value) => updateGraphShapePhysicalHeightCm(shape.id, value)} />}
        </InspectorFieldGrid>
        <InspectorFieldGrid columns={openPath ? 2 : 1}>
          <NumberField label="Stroke width" value={shape.strokeWidth} min={1} max={24} disabled={shape.locked} onChange={(value) => updateGraphShape(shape.id, { strokeWidth: value })} />
          {openPath ? (
            <label className="editor-inspector-field">
              <span className="editor-inspector-field__label">Line style</span>
              <select
                value={shape.strokeStyle ?? "solid"}
                disabled={shape.locked}
                onChange={(event) => updateGraphShape(shape.id, { strokeStyle: event.target.value as GraphGridLineStyle })}
                className="editor-inspector-control"
              >
                {GRAPH_GRID_LINE_STYLE_KEYS.map((style) => (
                  <option key={style} value={style}>
                    {style[0].toUpperCase()}{style.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </InspectorFieldGrid>
        <ColorPresetField label="Line color" value={shape.strokeColor} onChange={(value) => updateGraphShape(shape.id, { strokeColor: value })} />
        {openPath ? null : <ColorPresetField label="Shape interior" value={shape.fillColor} onChange={(value) => updateGraphShape(shape.id, { fillColor: value })} allowTransparent />}
        {supportsSides ? (
          <InspectorDisclosure title="Visible sides" summary={`${shape.sides.length} of 4`}>
            <div className="editor-object-properties__sides">
              {CELL_LINE_SIDE_KEYS.map((side) => (
                <label key={`shape-${shape.id}-${side}`} className="editor-object-properties__side">
                  <input
                    type="checkbox"
                    checked={shape.sides.includes(side)}
                    disabled={shape.locked}
                    onChange={(event) => {
                      const nextSides = event.target.checked ? [...shape.sides, side] : shape.sides.filter((item) => item !== side);
                      updateGraphShape(shape.id, { sides: nextSides.length ? nextSides : shape.sides });
                    }}
                  />
                  {CELL_LINE_SIDE_LABELS[side]}
                </label>
              ))}
            </div>
          </InspectorDisclosure>
        ) : null}
      </div>
    );
  }

  function renderCellAdvanced(cell: GraphCellPaint) {
    return (
      <div className="editor-object-properties">
        <InspectorFieldGrid className="editor-object-properties__primary">
          <NumberField label="Width" unit="cells" emphasis="primary" value={cell.width} min={0.01} max={1000} step={1} allowDecimalInput wholeStep disabled={cell.locked} onChange={(value) => updateCellPaint(cell.id, { width: value })} />
          <NumberField label="Height" unit="cells" emphasis="primary" value={cell.height} min={0.01} max={1000} step={1} allowDecimalInput wholeStep disabled={cell.locked} onChange={(value) => updateCellPaint(cell.id, { height: value })} />
        </InspectorFieldGrid>
        <InspectorFieldGrid>
          <NumberField label="Line size" value={cell.lineWidth} min={1} max={24} disabled={cell.locked} onChange={(value) => updateCellPaint(cell.id, { lineWidth: value })} />
          <ColorPresetField label="Line" value={cell.lineColor} onChange={(value) => updateCellPaint(cell.id, { lineColor: value })} />
        </InspectorFieldGrid>
        <ColorPresetField label="Fill" value={cell.fillColor} onChange={(value) => updateCellPaint(cell.id, { fillColor: value })} allowTransparent />
        <InspectorDisclosure title="Visible sides" summary={`${cell.sides.length} of 4`}>
          <div className="editor-object-properties__sides">
          {CELL_LINE_SIDE_KEYS.map((side) => (
            <label key={side} className="editor-object-properties__side">
              <input type="checkbox" checked={cell.sides.includes(side)} disabled={cell.locked} onChange={() => updateCellPaint(cell.id, { sides: cell.sides.includes(side) ? cell.sides.filter((item) => item !== side) : [...cell.sides, side] })} />
              {CELL_LINE_SIDE_LABELS[side]}
            </label>
          ))}
          </div>
        </InspectorDisclosure>
      </div>
    );
  }

  const leftPanelTabs: { id: EditorLeftPanelTab; label: string; count: number; icon: typeof ImageIcon }[] = [
    { id: "layers", label: "Layers", count: visibleLayerCount, icon: Layers3 },
    { id: "library", label: "Assets", count: settings.sourceImages.length + settings.clipartAssets.length, icon: Sparkles },
  ];

  const sourcePanel = (
    <aside
      className="editor-panel editor-assets-panel editor-document-panel atelier-document-panel relative flex min-h-0 flex-col"
      aria-label="Document layers and assets"
      data-editor-region="document-panel"
    >
      <div className="editor-document-panel__header border-b border-[var(--editor-line)] bg-[var(--editor-panel)] p-3">
        <div className="editor-document-panel__masthead mb-3">
          <div className="min-w-0">
            <span className="editor-document-panel__eyebrow">Document</span>
            <p className="truncate text-[13px] font-bold uppercase tracking-wide text-[var(--editor-text)]">Scene</p>
            <p className="editor-document-panel__summary mt-1 truncate text-xs text-[var(--editor-text-dim)]">{visibleLayerCount} layer{visibleLayerCount === 1 ? "" : "s"} / {settings.sourceImages.length} source{settings.sourceImages.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="editor-document-panel__tabs grid grid-cols-2 gap-1 rounded-xl border border-[var(--editor-line)] bg-[var(--editor-panel-2)] p-1" role="tablist" aria-label="Layers and assets">
          {leftPanelTabs.map((tab) => {
            const Icon = tab.icon;
            const active = leftPanelTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`editor-document-tab-${tab.id}`}
                aria-selected={active}
                aria-controls={`editor-document-panel-${tab.id}`}
                tabIndex={active ? 0 : -1}
                data-panel-tab={tab.id}
                data-count={tab.count}
                onClick={() => setLeftPanelTab(tab.id)}
                onKeyDown={(event) => {
                  const currentIndex = leftPanelTabs.findIndex((item) => item.id === tab.id);
                  const lastIndex = leftPanelTabs.length - 1;
                  const nextIndex =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? lastIndex
                        : event.key === "ArrowRight" || event.key === "ArrowDown"
                          ? (currentIndex + 1) % leftPanelTabs.length
                          : event.key === "ArrowLeft" || event.key === "ArrowUp"
                            ? (currentIndex - 1 + leftPanelTabs.length) % leftPanelTabs.length
                            : null;
                  if (nextIndex === null) return;
                  event.preventDefault();
                  const nextTab = leftPanelTabs[nextIndex];
                  setLeftPanelTab(nextTab.id);
                  requestAnimationFrame(() => document.getElementById(`editor-document-tab-${nextTab.id}`)?.focus());
                }}
                className={`editor-document-panel__tab grid min-h-12 place-items-center rounded-lg border px-1 text-[11px] font-bold transition-colors ${
                  active
                    ? "border-[var(--editor-accent)] bg-[var(--editor-accent-soft)] text-[var(--editor-accent)] shadow-sm"
                    : "border-transparent text-[var(--editor-text-dim)] hover:bg-[var(--editor-control-hover-bg)] hover:text-[var(--editor-text)]"
                }`}
              >
                <Icon size={17} strokeWidth={2.1} aria-hidden="true" />
                <span className="mt-0.5 inline-flex items-center gap-1">
                  {tab.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-[var(--editor-accent-soft)] text-[var(--editor-accent)]" : "bg-[var(--editor-panel)] text-[var(--editor-text-dim)]"}`}>{tab.count}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div
        id="editor-document-panel-body"
        className="editor-document-panel__body flex min-h-0 flex-1 flex-col"
      >
        <section
          id="editor-document-panel-layers"
          role="tabpanel"
          aria-labelledby="editor-document-tab-layers"
          data-panel-tabpanel="layers"
          hidden={leftPanelTab !== "layers"}
          className="editor-document-panel__layers editor-document-panel__tab-panel editor-document-panel__tab-panel--layers flex min-h-0 flex-1 flex-col overflow-hidden border-b border-[var(--editor-line)] bg-[var(--editor-panel)]"
        >
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--editor-line)] px-3">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-[var(--editor-text)]">Layers</h2>
            <div className="flex items-center gap-1">
              <label className="inline-flex h-8 items-center gap-1 rounded px-1.5 text-[11px] font-semibold text-[var(--editor-text-dim)] hover:bg-[var(--editor-control-hover-bg)]" title="Select or clear every layer">
                <input
                  type="checkbox"
                  checked={allLayersSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = someLayersSelected;
                  }}
                  onChange={(event) => setAllLayerCheckboxes(event.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-[var(--editor-accent)]"
                />
                <span>All</span>
              </label>
            </div>
          </div>
          {visibleLayerCount ? (
            <div className="editor-document-panel__layer-list min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin divide-y divide-[var(--editor-line-soft)]">
              {renderLayerListActionToolbar()}
              {settings.sourceImages.length > 0 ? (
                <div className="editor-document-panel__source-layer-list contents">
                  {settings.sourceImages.map((source) => {
                    const key = sourceLayerKey(source.id);
                    const selected = selectedSourceId === source.id || selectedLayerKeys.includes(key);
                    const hidden = source.visible === false;
                    return (
                      <div
                        key={`layer-source-${source.id}`}
                        onDragOver={handleLayerDragOver("source", source.id)}
                        onDrop={handleLayerDrop("source", source.id)}
                        className={`editor-layer-virtual-row ${selected ? "bg-[var(--editor-accent)] text-[var(--on-brand)]" : hidden ? "bg-[var(--editor-panel)] text-[var(--editor-text)] opacity-60" : "bg-[var(--editor-panel)] text-[var(--editor-text)]"}`}
                        data-layer-kind="source"
                        data-selected={selected}
                        data-dragging={layerReorderPreview?.type === "source" && layerReorderPreview.draggedId === source.id}
                        data-drop-target={layerReorderPreview?.type === "source" && layerReorderPreview.targetId === source.id && layerReorderPreview.draggedId !== source.id}
                      >
                        <div className="editor-layer-row__layout grid h-[62px] grid-cols-[20px_minmax(0,1fr)_28px_28px] items-center gap-2 px-3">
                          {renderLayerSelectionCheckbox(key, selected, source.name)}
                          <button type="button" onClick={(event) => selectSourceLayer(source.id, { additive: event.shiftKey || event.ctrlKey || event.metaKey })} className="editor-layer-row__select-target" title={source.name} aria-label={`Select ${source.name}`}>
                            <span className="editor-layer-row__preview">{renderSourceThumbnail(source, "h-full w-full")}</span>
                            <span className="editor-layer-row__identity min-w-0">
                              <span className="editor-layer-row__name block truncate text-[13px] font-semibold">{source.name}</span>
                              <span className={`editor-layer-row__meta mt-0.5 block text-[12px] ${selected ? "text-[var(--on-brand)]" : "text-[var(--editor-text-dim)]"}`}>{hidden ? "Hidden" : "Visible"} <i aria-hidden="true">{"\u00b7"}</i> 100%</span>
                            </span>
                          </button>
                          <button type="button" onClick={() => toggleSourceLock(source.id)} className={`editor-layer-row__action ${selected ? "text-[var(--on-brand)]" : "text-[var(--editor-text-dim)]"}`} title={source.locked ? "Unlock layer" : "Lock layer"} aria-label={`${source.locked ? "Unlock" : "Lock"} ${source.name}`}>{source.locked ? <Lock size={15} aria-hidden="true" /> : <Unlock size={15} aria-hidden="true" />}</button>
                          <button type="button" draggable onDragStart={handleLayerDragStart("source", source.id)} onDragEnd={handleLayerDragEnd} className={`editor-layer-row__grip cursor-grab active:cursor-grabbing ${selected ? "text-[var(--on-brand)]" : "text-[var(--editor-text-dim)]"}`} title="Drag to reorder" aria-label={`Drag ${source.name} to reorder`}><GripVertical size={16} aria-hidden="true" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {generatedLayerCount ? (
                <div className="bg-[var(--editor-panel)] text-[var(--editor-text)]">
                  <button
                    type="button"
                    onClick={() => setGeneratedImagesCollapsed((value) => !value)}
                    className="flex h-10 w-full items-center justify-between gap-3 border-y border-[var(--editor-line-soft)] bg-[var(--editor-panel-2)] px-3 text-left"
                    aria-expanded={!generatedImagesCollapsed}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      {generatedImagesCollapsed ? <ChevronRight size={15} className="shrink-0 text-[var(--editor-text-dim)]" aria-hidden="true" /> : <ChevronDown size={15} className="shrink-0 text-[var(--editor-text-dim)]" aria-hidden="true" />}
                      <span className="truncate text-[12px] font-bold uppercase tracking-wide text-[var(--editor-text-dim)]">Generated images</span>
                    </span>
                    <span className="rounded bg-[var(--editor-panel)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--editor-text-dim)]">{generatedLayerCount}</span>
                  </button>
                  {!generatedImagesCollapsed ? (
                    <>
                      <div className="editor-document-panel__generated-layer-list contents">
                        {settings.clipartImages.map((clipart) => {
                        const key = drawingLayerKey("clipart", clipart.id);
                        const selected = selectedDrawingLayerId === key || selectedLayerKeys.includes(key);
                        const hidden = clipart.visible === false;
                        return (
                          <div
                            key={`layer-clipart-${clipart.id}`}
                            onDragOver={handleLayerDragOver("clipart", clipart.id)}
                            onDrop={handleLayerDrop("clipart", clipart.id)}
                            className={`editor-layer-virtual-row ${selected ? "bg-[var(--editor-accent)] text-[var(--on-brand)]" : hidden ? "bg-[var(--editor-panel)] text-[var(--editor-text)] opacity-60" : "bg-[var(--editor-panel)] text-[var(--editor-text)]"}`}
                            data-layer-kind="clipart"
                            data-selected={selected}
                            data-dragging={layerReorderPreview?.type === "clipart" && layerReorderPreview.draggedId === clipart.id}
                            data-drop-target={layerReorderPreview?.type === "clipart" && layerReorderPreview.targetId === clipart.id && layerReorderPreview.draggedId !== clipart.id}
                          >
                            <div className="editor-layer-row__layout grid h-[62px] grid-cols-[20px_minmax(0,1fr)_28px_28px] items-center gap-2 px-3">
                              {renderLayerSelectionCheckbox(key, selected, clipart.name)}
                              <button type="button" onClick={(event) => selectClipartLayer(clipart.id, { additive: event.shiftKey || event.ctrlKey || event.metaKey })} className="editor-layer-row__select-target" title={clipart.name} aria-label={`Select ${clipart.name}`}>
                                <span className="editor-layer-row__preview">{renderClipartThumbnail(clipart, "h-full w-full")}</span>
                                <span className="editor-layer-row__identity min-w-0">
                                  <span className="editor-layer-row__name block truncate text-[13px] font-semibold">{clipart.name}</span>
                                  <span className={`editor-layer-row__meta mt-0.5 block text-[12px] ${selected ? "text-[var(--on-brand)]" : "text-[var(--editor-text-dim)]"}`}>{hidden ? "Hidden" : "Visible"} <i aria-hidden="true">{"\u00b7"}</i> 100%</span>
                                </span>
                              </button>
                              <button type="button" onClick={() => toggleDrawingLock("clipart", clipart.id)} className={`editor-layer-row__action ${selected ? "text-[var(--on-brand)]" : "text-[var(--editor-text-dim)]"}`} title={clipart.locked ? "Unlock clipart" : "Lock clipart"} aria-label={`${clipart.locked ? "Unlock" : "Lock"} ${clipart.name}`}>{clipart.locked ? <Lock size={15} aria-hidden="true" /> : <Unlock size={15} aria-hidden="true" />}</button>
                              <button type="button" draggable onDragStart={handleLayerDragStart("clipart", clipart.id)} onDragEnd={handleLayerDragEnd} className={`editor-layer-row__grip cursor-grab active:cursor-grabbing ${selected ? "text-[var(--on-brand)]" : "text-[var(--editor-text-dim)]"}`} title="Drag to reorder" aria-label={`Drag ${clipart.name} to reorder`}><GripVertical size={16} aria-hidden="true" /></button>
                            </div>
                          </div>
                        );
                      })}
                      {settings.graphShapes.map((shape) => {
                        const key = drawingLayerKey("shape", shape.id);
                        const selected = selectedDrawingLayerId === key || selectedLayerKeys.includes(key);
                        const hidden = shape.visible === false;
                        return (
                          <div
                            key={`layer-shape-${shape.id}`}
                            onDragOver={handleLayerDragOver("shape", shape.id)}
                            onDrop={handleLayerDrop("shape", shape.id)}
                            className={`editor-layer-virtual-row ${selected ? "bg-[var(--editor-accent)] text-[var(--on-brand)]" : hidden ? "bg-[var(--editor-panel)] text-[var(--editor-text)] opacity-60" : "bg-[var(--editor-panel)] text-[var(--editor-text)]"}`}
                            data-layer-kind="shape"
                            data-selected={selected}
                            data-dragging={layerReorderPreview?.type === "shape" && layerReorderPreview.draggedId === shape.id}
                            data-drop-target={layerReorderPreview?.type === "shape" && layerReorderPreview.targetId === shape.id && layerReorderPreview.draggedId !== shape.id}
                          >
                            <div className="editor-layer-row__layout grid h-[62px] grid-cols-[20px_minmax(0,1fr)_28px_28px] items-center gap-2 px-3">
                              {renderLayerSelectionCheckbox(key, selected, shape.name)}
                              <button type="button" onClick={(event) => selectGeneratedShape(shape.id, { additive: event.shiftKey || event.ctrlKey || event.metaKey })} className="editor-layer-row__select-target" title={shape.name} aria-label={`Select ${shape.name}`}>
                                <span className="editor-layer-row__preview">{renderShapeThumbnail(shape, "h-full w-full")}</span>
                                <span className="editor-layer-row__identity min-w-0">
                                  <span className="editor-layer-row__name block truncate text-[13px] font-semibold">{shape.name}</span>
                                  <span className={`editor-layer-row__meta mt-0.5 block text-[12px] ${selected ? "text-[var(--on-brand)]" : "text-[var(--editor-text-dim)]"}`}>{hidden ? "Hidden" : "Visible"} <i aria-hidden="true">{"\u00b7"}</i> 100%</span>
                                </span>
                              </button>
                              <button type="button" onClick={() => toggleDrawingLock("shape", shape.id)} className={`editor-layer-row__action ${selected ? "text-[var(--on-brand)]" : "text-[var(--editor-text-dim)]"}`} title={shape.locked ? "Unlock generated image" : "Lock generated image"} aria-label={`${shape.locked ? "Unlock" : "Lock"} ${shape.name}`}>{shape.locked ? <Lock size={15} aria-hidden="true" /> : <Unlock size={15} aria-hidden="true" />}</button>
                              <button type="button" draggable onDragStart={handleLayerDragStart("shape", shape.id)} onDragEnd={handleLayerDragEnd} className={`editor-layer-row__grip cursor-grab active:cursor-grabbing ${selected ? "text-[var(--on-brand)]" : "text-[var(--editor-text-dim)]"}`} title="Drag to reorder" aria-label={`Drag ${shape.name} to reorder`}><GripVertical size={16} aria-hidden="true" /></button>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
              {settings.cellPaints.map((cell) => {
                const key = drawingLayerKey("cell", cell.id);
                const selected = selectedDrawingLayerId === key || selectedLayerKeys.includes(key);
                const hidden = cell.visible === false;
                return (
                  <div
                    key={`layer-cell-${cell.id}`}
                    onDragOver={handleLayerDragOver("cell", cell.id)}
                    onDrop={handleLayerDrop("cell", cell.id)}
                    className={`editor-layer-virtual-row ${selected ? "bg-[var(--editor-accent)] text-[var(--on-brand)]" : hidden ? "bg-[var(--editor-panel)] text-[var(--editor-text)] opacity-60" : "bg-[var(--editor-panel)] text-[var(--editor-text)]"}`}
                    data-layer-kind="cell"
                    data-selected={selected}
                    data-dragging={layerReorderPreview?.type === "cell" && layerReorderPreview.draggedId === cell.id}
                    data-drop-target={layerReorderPreview?.type === "cell" && layerReorderPreview.targetId === cell.id && layerReorderPreview.draggedId !== cell.id}
                  >
                    <div className="editor-layer-row__layout grid h-[62px] grid-cols-[20px_minmax(0,1fr)_28px_28px] items-center gap-2 px-3">
                      {renderLayerSelectionCheckbox(key, selected, cell.name)}
                      <button type="button" onClick={(event) => selectCellLayer(cell.id, { additive: event.shiftKey || event.ctrlKey || event.metaKey })} className="editor-layer-row__select-target" title={cell.name} aria-label={`Select ${cell.name}`}>
                        <span className="editor-layer-row__preview">{renderCellThumbnail(cell, "h-full w-full")}</span>
                        <span className="editor-layer-row__identity min-w-0">
                          <span className="editor-layer-row__name block truncate text-[13px] font-semibold">{cell.name}</span>
                          <span className={`editor-layer-row__meta mt-0.5 block text-[12px] ${selected ? "text-[var(--on-brand)]" : "text-[var(--editor-text-dim)]"}`}>{hidden ? "Hidden" : "Visible"} <i aria-hidden="true">{"\u00b7"}</i> 100%</span>
                        </span>
                      </button>
                      <button type="button" onClick={() => toggleDrawingLock("cell", cell.id)} className={`editor-layer-row__action ${selected ? "text-[var(--on-brand)]" : "text-[var(--editor-text-dim)]"}`} title={cell.locked ? "Unlock layer" : "Lock layer"} aria-label={`${cell.locked ? "Unlock" : "Lock"} ${cell.name}`}>{cell.locked ? <Lock size={15} aria-hidden="true" /> : <Unlock size={15} aria-hidden="true" />}</button>
                      <button type="button" draggable onDragStart={handleLayerDragStart("cell", cell.id)} onDragEnd={handleLayerDragEnd} className={`editor-layer-row__grip cursor-grab active:cursor-grabbing ${selected ? "text-[var(--on-brand)]" : "text-[var(--editor-text-dim)]"}`} title="Drag to reorder" aria-label={`Drag ${cell.name} to reorder`}><GripVertical size={16} aria-hidden="true" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 place-items-center px-4 py-6 text-center text-sm text-[var(--editor-text-dim)]">No layers yet</div>
          )}
        </section>

        <section
          id="editor-document-panel-library"
          role="tabpanel"
          aria-labelledby="editor-document-tab-library"
          data-panel-tabpanel="library"
          hidden={leftPanelTab !== "library"}
          className="editor-document-panel__assets-tab editor-document-panel__tab-panel editor-document-panel__tab-panel--assets grid min-h-0 flex-1 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] overflow-hidden"
        >
          <section className="editor-document-panel__sources editor-document-panel__asset-pane flex min-h-0 flex-col overflow-hidden border-b border-[var(--editor-line)] bg-[var(--editor-panel)]" data-assets-pane="sources">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--editor-line)] px-3">
              <div className="inline-flex min-w-0 items-center gap-2 text-left">
                <ImageIcon size={15} className="shrink-0 text-[var(--editor-text-dim)]" aria-hidden="true" />
                <h2 className="text-[13px] font-bold uppercase tracking-wide text-[var(--editor-text)]">Sources</h2>
                <span className="rounded bg-[var(--editor-panel-2)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--editor-text-dim)]">{settings.sourceImages.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <label className={`grid h-8 w-8 place-items-center rounded text-[var(--editor-text-dim)] hover:bg-[var(--editor-control-hover-bg)] ${uploadingSources ? "cursor-wait opacity-60" : "cursor-pointer"}`} title="Add source images">
                  {uploadingSources ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                  <input type="file" accept={IMAGE_ACCEPT} multiple disabled={uploadingSources} aria-label="Add source images" className="sr-only" onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    if (files.length) void uploadSourceImages(files);
                  }} />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!cropSourcePreviewUrl || !cropSource) return;
                    if (sourceCropMode) {
                      setSourceCropMode(false);
                      setSourceCropArea(null);
                    } else {
                      openSourceCrop(cropSource.id);
                    }
                  }}
                  disabled={!cropSourcePreviewUrl || !cropSource}
                  className="grid h-8 w-8 place-items-center rounded text-[var(--editor-text-dim)] hover:bg-[var(--editor-control-hover-bg)] disabled:opacity-35"
                  title={sourceCropMode ? "Close source crop tools" : "Crop source images"}
                  aria-label={sourceCropMode ? "Close source crop tools" : "Crop source images"}
                >
                  <Crop size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
            {settings.sourceImages.length ? (
              <div className="editor-document-panel__source-list min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin divide-y divide-[var(--editor-line-soft)]">
                {settings.sourceImages.map((source) => {
                  const status = sourceStatus[source.id];
                  const key = sourceLayerKey(source.id);
                  const selected = selectedSourceId === source.id || selectedLayerKeys.includes(key);
                  const ready = Boolean(status?.ready);
                  const pending = !ready && !status?.error;
                  return (
                    <button
                      key={`source-list-${source.id}`}
                      type="button"
                      onClick={(event) => selectSourceLayer(source.id, { additive: event.shiftKey || event.ctrlKey || event.metaKey })}
                      className={`editor-source-card grid w-full grid-cols-[64px_minmax(0,1fr)_32px] items-center gap-3 px-3 py-2 text-left ${selected ? "bg-[var(--editor-accent-soft)]" : "bg-[var(--editor-panel)] hover:bg-[var(--editor-panel-2)]"}`}
                      data-selected={selected}
                      data-source-state={status?.error ? "error" : pending ? "loading" : "ready"}
                    >
                      {renderSourceThumbnail(source, "h-16 w-16")}
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-[var(--editor-text)]">{source.name}</span>
                        <span className="mt-1 block text-[12px] text-[var(--editor-text-dim)]">{roundCells(source.width)} x {roundCells(source.height)}</span>
                      </span>
                      <span className={`grid h-6 w-6 place-items-center rounded-full border ${status?.error ? "border-[var(--danger)] text-[var(--danger)]" : selected && ready ? "border-[var(--green)] text-[var(--green)]" : "border-[var(--editor-line)] text-[var(--editor-muted)]"}`}>
                        {status?.error ? <X size={14} aria-hidden="true" /> : pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : selected ? <Check size={15} aria-hidden="true" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 place-items-center px-4 py-6 text-center text-sm text-[var(--editor-text-dim)]">Upload source files</div>
            )}
          </section>

          <section className="editor-document-panel__library editor-document-panel__asset-pane flex min-h-0 flex-col overflow-hidden border-b border-[var(--editor-line)] bg-[var(--editor-panel)]" data-assets-pane="clipart">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--editor-line)] px-3">
              <div className="inline-flex min-w-0 items-center gap-2 text-left">
                <Sparkles size={15} className="shrink-0 text-[var(--editor-text-dim)]" aria-hidden="true" />
                <h2 className="truncate text-[13px] font-bold uppercase tracking-wide text-[var(--editor-text)]">Reusable clipart</h2>
                <span className="rounded bg-[var(--editor-panel-2)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--editor-text-dim)]">{settings.clipartAssets.length}</span>
              </div>
              <label
                className={`grid h-8 w-8 place-items-center rounded text-[var(--editor-text-dim)] hover:bg-[var(--editor-control-hover-bg)] ${uploadingCliparts ? "cursor-wait opacity-60" : "cursor-pointer"}`}
                title="Upload clipart"
                aria-label="Upload clipart"
              >
                {uploadingCliparts ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                <input
                  type="file"
                  accept={CLIPART_ACCEPT}
                  multiple
                  disabled={uploadingCliparts}
                  aria-label="Upload clipart"
                  className="sr-only"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    if (files.length) void uploadClipartAssets(files);
                  }}
                />
              </label>
            </div>
            <div className="editor-document-panel__library-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {settings.clipartAssets.length ? (
                <div className="editor-document-panel__clipart-list">
                  {settings.clipartAssets.map((asset) => {
                    // A 40x40 box: prefer the bounded WebP derivative. This grid
                    // renders up to MAX_CLIPART_ASSETS entries and used to pull
                    // the full-resolution original for every one of them.
                    const previewUrl = asset.thumbUrl ?? asset.url ?? asset.dataUrl ?? null;
                    const selected = selectedClipartAsset?.id === asset.id;
                    return (
                      <button
                        key={`asset-library-${asset.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedClipartAssetId(asset.id);
                          setInspectorTab("draw");
                          setDrawTab("clipart");
                          setSettingsPanelCollapsed(false);
                        }}
                        className={`grid w-full grid-cols-[40px_minmax(0,1fr)_22px] items-center gap-2 px-3 py-1.5 text-left ${selected ? "bg-[var(--editor-accent-soft)]" : "hover:bg-[var(--editor-panel-2)]"}`}
                        data-selected={selected}
                      >
                        {previewUrl ? (
                          <img src={previewUrl} alt="" className="h-10 w-10 rounded border border-[var(--editor-line)] bg-[var(--artboard-bg)] object-contain p-1" />
                        ) : (
                          <span className="grid h-10 w-10 place-items-center rounded border border-[var(--editor-line)] bg-[var(--artboard-bg)] text-[var(--editor-muted)]">
                            <ImageIcon size={15} aria-hidden="true" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold text-[var(--editor-text)]">{asset.name}</span>
                          <span className="block truncate text-[11px] text-[var(--editor-text-dim)]">{asset.width} x {asset.height}</span>
                        </span>
                        {selected ? <Check size={15} className="text-[var(--editor-accent)]" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid min-h-full place-items-center px-4 py-5 text-center text-xs font-medium text-[var(--editor-text-dim)]">
                  Upload clipart to reuse it from Create.
                </div>
              )}
            </div>
          </section>
        </section>

      </div>
    </aside>
  );

  const selectionConsole: SelectionConsoleModel = {
    kind:
      selectedLayerCount > 1
        ? "multi"
        : selectedSource
          ? "source"
          : selectedShapeLayer
            ? "shape"
            : selectedClipartLayer
              ? "clipart"
              : selectedCellLayer
                ? "cell"
                : "none",
    count: selectedLayerCount,
    status:
      selectedLayerStateMixed
        ? "mixed"
        : selectedLayerLocked
          ? "locked"
          : selectedLayerHidden
            ? "hidden"
            : "ready",
    preview: selectedSource
      ? renderSourceThumbnail(selectedSource, "h-full w-full")
      : selectedShapeLayer
        ? renderShapeThumbnail(selectedShapeLayer, "h-full w-full")
        : selectedClipartLayer
          ? renderClipartThumbnail(selectedClipartLayer, "h-full w-full")
          : selectedCellLayer
            ? renderCellThumbnail(selectedCellLayer, "h-full w-full")
            : null,
    actions: {
      nudgeLeft: {
        disabled: !hasSelectedLayer || selectedLayerLocked,
        onAction: () => nudgeSelectedSource(-1, 0),
      },
      nudgeUp: {
        disabled: !hasSelectedLayer || selectedLayerLocked,
        onAction: () => nudgeSelectedSource(0, -1),
      },
      nudgeDown: {
        disabled: !hasSelectedLayer || selectedLayerLocked,
        onAction: () => nudgeSelectedSource(0, 1),
      },
      nudgeRight: {
        disabled: !hasSelectedLayer || selectedLayerLocked,
        onAction: () => nudgeSelectedSource(1, 0),
      },
    },
  };

  const imageWidthCm = roundCm(settings.graphWidth * settings.cellSizeCm);
  const imageHeightCm = roundCm(settings.graphHeight * settings.cellSizeCm);
  const printWidthCm = imageWidthCm;
  const printHeightCm = imageHeightCm;
  const graphPreviewWidth = Math.max(1, previewCanvasSize.width * zoom);
  const graphPreviewHeight = Math.max(1, previewCanvasSize.height * zoom);
  // The artwork canvas is smoothly scaled at every zoom so the artwork stays
  // high-resolution-looking (not blocky). Grid crispness is handled separately by
  // the vector SVG overlay, so the old zoom>1 "pixelated" mode is no longer needed.
  const previewImageRendering: "auto" | "pixelated" = "auto";
  const outsideNumberMargin = settings.showNumbers && settings.gridNumberPlacement === "outside" ? 34 : 0;
  const outsideHorizontalLabels = settings.showNumbers && settings.gridNumberPlacement === "outside" ? cellNumberLabels(settings.graphWidth) : [];
  const outsideVerticalLabels = settings.showNumbers && settings.gridNumberPlacement === "outside" ? cellNumberLabels(settings.graphHeight) : [];
  const { pageBreakGuideX, pageBreakGuideY } = useMemo(() => {
    if (!settings.showPageBreaks) return { pageBreakGuideX: [], pageBreakGuideY: [] };
    const paperForPreview = PRINT_PAPER_SIZES[settings.printPaperSize] ?? PRINT_PAPER_SIZES[DEFAULT_PRINT_PAPER_SIZE];
    const printPreviewPlan = createPdfExportPlan({
      settings,
      paper: paperForPreview,
      canvasWidth: previewCanvasSize.width,
      canvasHeight: previewCanvasSize.height,
    });
    return {
      pageBreakGuideY: Array.from(new Set(printPreviewPlan.tiles.filter((tile) => tile.tileX === 0 && tile.tileY > 0).map((tile) => tile.sourceY))).sort((a, b) => a - b),
      pageBreakGuideX: Array.from(new Set(printPreviewPlan.tiles.filter((tile) => tile.tileY === 0 && tile.tileX > 0).map((tile) => tile.sourceX))).sort((a, b) => a - b),
    };
  }, [
    previewCanvasSize.height,
    previewCanvasSize.width,
    settings.cellSizeCm,
    settings.graphHeight,
    settings.graphWidth,
    settings.pageMargin,
    settings.printHorizontalAlignment,
    settings.printOrientation,
    settings.printPaperSize,
    settings.printVerticalAlignment,
    settings.showPageBreaks,
  ]);

  const floatingFillRegion = floatingPalette ? fillRegionsById.get(floatingPalette.regionId) ?? null : null;
  const floatingFillRegionColor = floatingFillRegion ? currentFillRegionColor(floatingFillRegion) : settings.fillColor;
  const floatingPaletteNode =
    floatingPalette && floatingFillRegion ? (
      <div
        className="fixed z-[72] w-[244px] rounded-md border border-[var(--editor-line)] bg-[var(--editor-panel)] p-3 shadow-[0_20px_55px_var(--editor-shadow)]"
        style={{ left: floatingPalette.x, top: floatingPalette.y }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-[var(--editor-text-dim)]">
            <Pipette size={14} aria-hidden="true" />
            Region fill
          </span>
          <button
            type="button"
            onClick={() => setFloatingPalette(null)}
            className="grid h-7 w-7 place-items-center rounded-md border border-[var(--editor-line)] text-[var(--editor-text-dim)] hover:bg-[var(--editor-control-hover-bg)]"
            title="Close"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
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
                className={`h-7 rounded-sm border ${selected ? "border-[var(--editor-text)] ring-2 ring-[var(--editor-accent)]" : "border-[var(--editor-line)]"}`}
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
            className={`h-7 rounded-sm border bg-[linear-gradient(45deg,var(--checker-mark)_25%,transparent_25%),linear-gradient(-45deg,var(--checker-mark)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--checker-mark)_75%),linear-gradient(-45deg,transparent_75%,var(--checker-mark)_75%)] bg-[length:10px_10px] bg-[position:0_0,0_5px,5px_-5px,-5px_0] ${isTransparentFillColor(floatingFillRegionColor) ? "border-[var(--editor-text)] ring-2 ring-[var(--editor-accent)]" : "border-[var(--editor-line)]"}`}
            title="Transparent"
            aria-label="Apply transparent"
          />
        </div>
      </div>
    ) : null;
  const shortcutsPanelNode = showShortcutsPanel ? (
    <div className="fixed right-6 bottom-16 z-50 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-4 text-sm shadow-[0_20px_55px_var(--editor-shadow)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-[var(--editor-text)]">Keyboard shortcuts</h3>
        <button type="button" onClick={() => setShowShortcutsPanel(false)} className="grid h-7 w-7 place-items-center rounded-md border border-[var(--editor-line)] text-[var(--editor-text-dim)] hover:bg-[var(--editor-control-hover-bg)]" title="Close">
          <X size={13} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[12px] text-[var(--editor-text-dim)]">
        <span>Undo / redo</span><kbd className="rounded bg-[var(--editor-panel-2)] px-1.5 py-0.5 font-mono text-[var(--editor-text)]">Ctrl Z / Y</kbd>
        <span>Copy / paste layer</span><kbd className="rounded bg-[var(--editor-panel-2)] px-1.5 py-0.5 font-mono text-[var(--editor-text)]">Ctrl C / V</kbd>
        <span>Delete layer</span><kbd className="rounded bg-[var(--editor-panel-2)] px-1.5 py-0.5 font-mono text-[var(--editor-text)]">Del</kbd>
        <span>Nudge selected layer(s)</span><kbd className="rounded bg-[var(--editor-panel-2)] px-1.5 py-0.5 font-mono text-[var(--editor-text)]">Arrow keys</kbd>
        <span>Pan canvas while selecting</span><kbd className="rounded bg-[var(--editor-panel-2)] px-1.5 py-0.5 font-mono text-[var(--editor-text)]">Space drag</kbd>
        <span>Disable snapping during drag</span><kbd className="rounded bg-[var(--editor-panel-2)] px-1.5 py-0.5 font-mono text-[var(--editor-text)]">Alt</kbd>
        <span>Add to layer selection</span><kbd className="rounded bg-[var(--editor-panel-2)] px-1.5 py-0.5 font-mono text-[var(--editor-text)]">Shift/Ctrl click</kbd>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-[var(--editor-text-dim)]">
        Shortcut help is browser-local for this v1.
      </p>
    </div>
  ) : null;

  const selectedGroupBounds = selectedLayerBounds;
  const selectedGroupBox =
    selectedGroupBounds && !showOriginal
      ? {
          left: Math.round(outsideNumberMargin + selectedGroupBounds.x * GRAPH_MAJOR_CELL_PIXELS * zoom),
          top: Math.round(outsideNumberMargin + selectedGroupBounds.y * GRAPH_MAJOR_CELL_PIXELS * zoom),
          width: Math.max(1, Math.round(selectedGroupBounds.width * GRAPH_MAJOR_CELL_PIXELS * zoom)),
          height: Math.max(1, Math.round(selectedGroupBounds.height * GRAPH_MAJOR_CELL_PIXELS * zoom)),
        }
      : null;
  const selectedSourceBox =
    selectedSourceLayout && !showOriginal
      ? {
          left: Math.round(outsideNumberMargin + (selectedSourceLayout.x * GRAPH_MAJOR_CELL_PIXELS + settings.imageOffsetX) * zoom),
          top: Math.round(outsideNumberMargin + (selectedSourceLayout.y * GRAPH_MAJOR_CELL_PIXELS + settings.imageOffsetY) * zoom),
          width: Math.max(1, Math.round(selectedSourceLayout.width * GRAPH_MAJOR_CELL_PIXELS * zoom)),
          height: Math.max(1, Math.round(selectedSourceLayout.height * GRAPH_MAJOR_CELL_PIXELS * zoom)),
        }
      : null;
  const dragPreviewSource = dragPreviewSourceId ? settings.sourceImages.find((source) => source.id === dragPreviewSourceId) ?? null : null;
  const dragPreviewLayout = dragPreviewSource ? sourceLayouts(settings.sourceImages).find((layout) => layout.source.id === dragPreviewSource.id) ?? null : null;
  const dragPreviewStyle: CSSProperties | null =
    dragPreviewSource && dragPreviewLayout && !showOriginal
      ? (() => {
          const baseWidth = Math.max(1, Math.round(dragPreviewLayout.width * GRAPH_MAJOR_CELL_PIXELS * zoom));
          const baseHeight = Math.max(1, Math.round(dragPreviewLayout.height * GRAPH_MAJOR_CELL_PIXELS * zoom));
          const rotation = normalizeRotationDegrees(dragPreviewSource.rotationDegrees);
          const sideways = rotation === 90 || rotation === 270;
          const width = sideways ? baseHeight : baseWidth;
          const height = sideways ? baseWidth : baseHeight;
          const centerX = outsideNumberMargin + (dragPreviewLayout.x * GRAPH_MAJOR_CELL_PIXELS + settings.imageOffsetX) * zoom + baseWidth / 2;
          const centerY = outsideNumberMargin + (dragPreviewLayout.y * GRAPH_MAJOR_CELL_PIXELS + settings.imageOffsetY) * zoom + baseHeight / 2;
          return {
            left: Math.round(centerX - width / 2),
            top: Math.round(centerY - height / 2),
            width,
            height,
            transform: `rotate(${rotation}deg) scale(${dragPreviewSource.flipX ? -1 : 1}, ${dragPreviewSource.flipY ? -1 : 1})`,
          };
        })()
      : null;
  const selectedShapeBox =
    selectedShapeLayer && !showOriginal
      ? {
          left: Math.round(outsideNumberMargin + Math.min(selectedShapeLayer.x, selectedShapeLayer.x + selectedShapeLayer.width) * GRAPH_MAJOR_CELL_PIXELS * zoom),
          top: Math.round(outsideNumberMargin + Math.min(selectedShapeLayer.y, selectedShapeLayer.y + selectedShapeLayer.height) * GRAPH_MAJOR_CELL_PIXELS * zoom),
          width: Math.max(1, Math.round(Math.abs(selectedShapeLayer.width) * GRAPH_MAJOR_CELL_PIXELS * zoom)),
          height: Math.max(1, Math.round(Math.abs(selectedShapeLayer.height) * GRAPH_MAJOR_CELL_PIXELS * zoom)),
        }
      : null;
  const selectedClipartBox =
    selectedClipartLayer && !showOriginal
      ? {
          left: Math.round(outsideNumberMargin + Math.min(selectedClipartLayer.x, selectedClipartLayer.x + selectedClipartLayer.width) * GRAPH_MAJOR_CELL_PIXELS * zoom),
          top: Math.round(outsideNumberMargin + Math.min(selectedClipartLayer.y, selectedClipartLayer.y + selectedClipartLayer.height) * GRAPH_MAJOR_CELL_PIXELS * zoom),
          width: Math.max(1, Math.round(Math.abs(selectedClipartLayer.width) * GRAPH_MAJOR_CELL_PIXELS * zoom)),
          height: Math.max(1, Math.round(Math.abs(selectedClipartLayer.height) * GRAPH_MAJOR_CELL_PIXELS * zoom)),
        }
      : null;
  const selectionTransformBox = selectedGroupBox ?? selectedSourceBox ?? selectedShapeBox ?? selectedClipartBox;
  // Keep the current selection for inspector/context actions, but render
  // canvas selection chrome only while the Select tool is active. Destructive
  // tools must never look like they are targeting one particular image.
  const showCanvasSelectionOverlay = Boolean(
    !showOriginal
    && hasSelectedLayer
    && canvasTool === "pointer"
    && drawingTool === "image",
  );
  const selectionTransformStyle = selectionTransformBox
    ? {
        left: selectionTransformBox.left + selectionTransformBox.width / 2,
        top: Math.max(6, selectionTransformBox.top - 46),
      }
    : undefined;
  const selectionTransformLabel =
    selectedLayerCount > 1
      ? `${selectedLayerCount} selected layers`
      : selectedSource?.name
        ?? selectedShapeLayer?.name
        ?? selectedClipartLayer?.name
        ?? selectedCellLayer?.name
        ?? "Selected artwork";
  const showSelectionResizeHandles = resizeHandleTarget === "selection" || dragStateRef.current?.kind === "resize-selection";
  const showSourceSideResizeHandles = resizeHandleTarget === "source" || dragStateRef.current?.kind === "resize-source";
  const showShapeSideResizeHandles = resizeHandleTarget === "shape" || dragStateRef.current?.kind === "resize-shape";
  const sourceResizeHandleVisible = (_handle: SourceResizeHandle, showSideHandles: boolean) => showSideHandles;
  const previewCanvasCursor =
    isDraggingGraph
      ? drawingTool === "line"
        ? "crosshair"
        : "grabbing"
      : drawingTool === "image-eraser"
        ? "none"
        : drawingTool === "lasso" || drawingTool === "line" || drawingTool === "shape"
          ? "crosshair"
          : canvasTool === "hand"
            ? "grab"
            : canvasTool === "fill"
              ? "crosshair"
              : SELECT_POINTER_CURSOR;
  const selectedLayerStatusLabel = selectedLayerCount
    ? `${selectedLayerCount} layer${selectedLayerCount === 1 ? "" : "s"} selected`
    : selectedFillRegion
      ? "Fill region selected"
      : "No layer selected";
  const activeEditorTool: EditorToolId = canvasTool === "hand"
    ? "pan"
    : canvasTool === "fill"
      ? "fill"
      : drawingTool === "line"
        ? "draw"
      : drawingTool === "shape"
          ? "shape"
          : drawingTool === "background-remover"
            ? "background-remover"
            : drawingTool === "image-eraser"
              ? "image-eraser"
              : drawingTool === "lasso"
                ? "lasso"
              : "select";

  const selectEditorTool = useCallback((tool: EditorToolId) => {
    setMobileTab("canvas");
    setPlacingGeneratedShape(false);
    setPlacingClipartAssetId(null);
    if (tool === "pan") {
      setCanvasTool("hand");
      setInspectorTab("source");
      return;
    }
    if (tool === "fill") {
      setDrawingTool("image");
      setCanvasTool("fill");
      setInspectorTab("palette");
      setSettingsPanelCollapsed(false);
      return;
    }
    setCanvasTool("pointer");
    const nextDrawingTool: DrawingTool =
      tool === "draw"
        ? "line"
        : tool === "shape"
          ? "shape"
          : tool === "lasso"
            ? "lasso"
            : tool === "background-remover"
              ? "background-remover"
              : tool === "image-eraser"
                ? "image-eraser"
                : "image";
    setDrawingTool(nextDrawingTool);
    if (nextDrawingTool === "line") {
      setDraftShapeKind("line");
      setArmedShapeKind(null);
      setDrawTab("shape");
    } else if (nextDrawingTool === "shape") {
      setArmedShapeKind(null);
      setDrawTab("shape");
    } else if (nextDrawingTool === "lasso") {
      setDrawTab("shape");
    }
    if (nextDrawingTool !== "image-eraser") {
      clearImageEraserCursor();
    }
    if (nextDrawingTool !== "lasso") {
      lassoVerticesRef.current = [];
      setLassoVertices([]);
      setLassoCursor(null);
    }
    if (nextDrawingTool === "line" || nextDrawingTool === "shape" || nextDrawingTool === "lasso") {
      setInspectorTab("draw");
    } else {
      setInspectorTab("source");
    }
    setSettingsPanelCollapsed(false);
  }, []);

  function setCommandCanvasPodCollapsed(podId: PodId, collapsed: boolean) {
    if (!ACTIVE_COMMAND_CANVAS_PODS.has(podId)) return;
    setCommandCanvasLayout((current) => ({
      ...current,
      collapsed: COMMAND_CANVAS_POD_IDS.filter((candidate) =>
        candidate === podId ? collapsed : current.collapsed.includes(candidate),
      ),
    }));
    if (podId === "scene") setSourcePanelCollapsed(collapsed);
    if (podId === "focus") setSettingsPanelCollapsed(collapsed);
  }

  function toggleCommandCanvasPod(podId: PodId) {
    const usesResponsiveSheet =
      (commandCanvasViewportWidth < 768 && podId === "tools")
      || (commandCanvasViewportWidth < 1024 && (podId === "scene" || podId === "focus"));
    if (usesResponsiveSheet) {
      const targetTab: MobileTab = podId === "tools" ? "tools" : podId === "scene" ? "source" : "controls";
      if (mobileTab === targetTab) {
        setMobileTab("canvas");
        return;
      }
      setCommandCanvasPodCollapsed(podId, false);
      setMobileTab(targetTab);
      return;
    }
    const collapsed =
      podId === "scene"
        ? sourcePanelCollapsed
        : podId === "focus"
          ? settingsPanelCollapsed
          : commandCanvasLayoutRef.current.collapsed.includes(podId);
    setCommandCanvasPodCollapsed(podId, !collapsed);
  }

  function dockCommandCanvasPod(podId: PodId, dock?: Exclude<PodDock, "floating">) {
    const defaultDock = createDefaultCommandCanvasLayout().modules[podId].dock as Exclude<PodDock, "floating">;
    setCommandCanvasLayout((current) => ({
      ...current,
      modules: {
        ...current.modules,
        [podId]: {
          dock: dock ?? defaultDock,
          ...(current.modules[podId].width === undefined ? {} : { width: current.modules[podId].width }),
          ...(current.modules[podId].height === undefined ? {} : { height: current.modules[podId].height }),
        },
      },
    }));
    setCommandCanvasPodCollapsed(podId, false);
  }

  function floatCommandCanvasPod(podId: PodId) {
    const element = document.querySelector<HTMLElement>(`[data-editor-pod="${podId}"]`);
    const rect = element?.getBoundingClientRect();
    const point = rect
      ? clampCommandCanvasPodPosition(
          { x: rect.left, y: rect.top },
          { width: rect.width, height: rect.height },
          { width: window.innerWidth, height: window.innerHeight },
          COMMAND_CANVAS_DESKTOP_SAFE_INSETS,
        )
      : { x: 24, y: 112 };
    setCommandCanvasLayout((current) => ({
      ...current,
      modules: {
        ...current.modules,
        [podId]: {
          ...current.modules[podId],
          dock: "floating",
          x: point.x,
          y: point.y,
          ...(rect && current.modules[podId].width === undefined
            ? { width: quantizeCommandCanvasCoordinate(rect.width) }
            : {}),
          ...(rect && current.modules[podId].height === undefined
            ? { height: quantizeCommandCanvasCoordinate(rect.height) }
            : {}),
        },
      },
    }));
    setCommandCanvasPodCollapsed(podId, false);
  }

  function resetCommandCanvasPod(podId: PodId) {
    const defaults = createDefaultCommandCanvasLayout();
    setCommandCanvasLayout((current) => ({
      ...current,
      modules: {
        ...current.modules,
        [podId]: { ...defaults.modules[podId] },
      },
      collapsed: current.collapsed.filter((candidate) => candidate !== podId),
    }));
    if (podId === "scene") setSourcePanelCollapsed(false);
    if (podId === "focus") setSettingsPanelCollapsed(false);
  }

  function nudgeCommandCanvasPod(podId: PodId, deltaX: number, deltaY: number) {
    if (window.innerWidth < 1280) return;
    const element = document.querySelector<HTMLElement>(`[data-editor-pod="${podId}"]`);
    const rect = element?.getBoundingClientRect();
    if (!rect) return;
    const point = placeCommandCanvasPod(
      { x: rect.left + deltaX, y: rect.top + deltaY },
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
      COMMAND_CANVAS_DESKTOP_SAFE_INSETS,
    );
    setCommandCanvasLayout((current) => ({
      ...current,
      modules: {
        ...current.modules,
        [podId]: {
          ...current.modules[podId],
          dock: "floating",
          x: point.x,
          y: point.y,
        },
      },
    }));
  }

  function resetCommandCanvasLayout() {
    setCommandCanvasLayout(createDefaultCommandCanvasLayout());
    setSourcePanelCollapsed(false);
    setSettingsPanelCollapsed(false);
    setMobileTab("canvas");
    document.querySelectorAll<HTMLElement>("[data-editor-pod]").forEach((element) => {
      element.removeAttribute("data-dragging");
      element.removeAttribute("data-resizing");
      element.style.removeProperty("--cc-live-x");
      element.style.removeProperty("--cc-live-y");
      element.style.removeProperty("--cc-live-width");
      element.style.removeProperty("--cc-live-height");
    });
    commandCanvasPodDragRef.current = null;
    commandCanvasPodResizeRef.current = null;
    setResizingCommandCanvasPodId(null);
    clearCommandCanvasDockPreview();
    setNotice({ tone: "ok", text: "Workspace layout reset." });
  }

  function commandCanvasPodCollapsed(podId: PodId) {
    if (commandCanvasViewportWidth < 1024) {
      if (commandCanvasViewportWidth < 768 && podId === "tools") {
        return commandCanvasLayout.collapsed.includes(podId) || mobileTab !== "tools";
      }
      if (podId === "scene") return sourcePanelCollapsed || mobileTab !== "source";
      if (podId === "focus") return settingsPanelCollapsed || mobileTab !== "controls";
      if (podId === "navigator") return commandCanvasLayout.collapsed.includes(podId) || mobileTab !== "view";
    }
    if (podId === "scene") return sourcePanelCollapsed;
    if (podId === "focus") return settingsPanelCollapsed;
    return commandCanvasLayout.collapsed.includes(podId);
  }

  function commandCanvasPodStyle(podId: PodId) {
    const placement = resolveCommandCanvasPodPlacement(commandCanvasLayout, podId, commandCanvasViewportWidth);
    const minimumSize = COMMAND_CANVAS_POD_MIN_SIZES[podId];
    const configuredMaximum = COMMAND_CANVAS_POD_MAX_SIZES[podId];
    const maximumSize = {
      width: configuredMaximum.width,
      height: COMMAND_CANVAS_VIEWPORT_HEIGHT_PODS.has(podId)
        ? Math.max(
            minimumSize.height,
            commandCanvasViewportHeight
              - COMMAND_CANVAS_DESKTOP_SAFE_INSETS.top
              - COMMAND_CANVAS_DESKTOP_SAFE_INSETS.bottom,
          )
        : configuredMaximum.height,
    };
    const storedSize = clampCommandCanvasPodSize(
      {
        width: placement.width ?? COMMAND_CANVAS_POD_DEFAULT_SIZES[podId].width,
        height: placement.height ?? COMMAND_CANVAS_POD_DEFAULT_SIZES[podId].height,
      },
      minimumSize,
      maximumSize,
    );
    const applyStoredSize = commandCanvasViewportWidth >= 1280 && podId !== "navigator";
    const floatingPoint =
      placement.dock === "floating" && placement.x !== undefined && placement.y !== undefined
        ? clampCommandCanvasPodPosition(
            { x: placement.x, y: placement.y },
            storedSize,
            { width: commandCanvasViewportWidth, height: commandCanvasViewportHeight },
            COMMAND_CANVAS_DESKTOP_SAFE_INSETS,
          )
        : null;
    return {
      ...(applyStoredSize && placement.width !== undefined ? { "--cc-pod-width": `${storedSize.width}px` } : {}),
      ...(applyStoredSize && placement.height !== undefined ? { "--cc-pod-height": `${storedSize.height}px` } : {}),
      ...(floatingPoint
        ? {
            "--cc-pod-x": `${floatingPoint.x}px`,
            "--cc-pod-y": `${floatingPoint.y}px`,
          }
        : {}),
    } as CSSProperties;
  }

  function commandCanvasPodResizeEdge(podId: PodId): Extract<CommandCanvasResizeEdge, "bottom-left" | "bottom-right"> {
    const dock = resolveCommandCanvasPodPlacement(commandCanvasLayout, podId, commandCanvasViewportWidth).dock;
    return dock === "right-top" || dock === "right-main" ? "bottom-left" : "bottom-right";
  }

  function commandCanvasResizeMaximum(
    podId: PodId,
    rect: Pick<DOMRect, "left" | "right" | "top">,
    edge: Extract<CommandCanvasResizeEdge, "bottom-left" | "bottom-right">,
  ) {
    const insets = COMMAND_CANVAS_DESKTOP_SAFE_INSETS;
    const availableWidth = edge === "bottom-left"
      ? rect.right - insets.left
      : window.innerWidth - insets.right - rect.left;
    const availableHeight = window.innerHeight - insets.bottom - rect.top;
    const configuredMaximum = COMMAND_CANVAS_POD_MAX_SIZES[podId];
    const minimum = COMMAND_CANVAS_POD_MIN_SIZES[podId];
    return {
      width: Math.max(minimum.width, Math.min(configuredMaximum.width, availableWidth)),
      height: Math.max(
        minimum.height,
        COMMAND_CANVAS_VIEWPORT_HEIGHT_PODS.has(podId)
          ? availableHeight
          : Math.min(configuredMaximum.height, availableHeight),
      ),
    };
  }

  function clearCommandCanvasDockPreview() {
    const preview = commandCanvasDockPreviewRef.current;
    if (!preview) return;
    preview.removeAttribute("data-active-dock");
    preview.style.removeProperty("--cc-preview-width");
    preview.style.removeProperty("--cc-preview-height");
  }

  function beginCommandCanvasPodResize(
    event: ReactPointerEvent<HTMLButtonElement>,
    podId: PodId,
    edge: Extract<CommandCanvasResizeEdge, "bottom-left" | "bottom-right">,
  ) {
    if (window.innerWidth < 1280 || event.button !== 0) return;
    const podElement = event.currentTarget.closest<HTMLElement>("[data-editor-pod]");
    if (!podElement) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = podElement.getBoundingClientRect();
    const initialSize = clampCommandCanvasPodSize(
      { width: rect.width, height: rect.height },
      COMMAND_CANVAS_POD_MIN_SIZES[podId],
      commandCanvasResizeMaximum(podId, rect, edge),
    );
    commandCanvasPodResizeRef.current = {
      podId,
      edge,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: initialSize.width,
      startHeight: initialSize.height,
      element: podElement,
      size: initialSize,
    };
    podElement.dataset.resizing = "true";
    podElement.style.setProperty("--cc-live-width", `${initialSize.width}px`);
    podElement.style.setProperty("--cc-live-height", `${initialSize.height}px`);
    setResizingCommandCanvasPodId(podId);
  }

  function resizeCommandCanvasPod(event: ReactPointerEvent<HTMLButtonElement>) {
    const resize = commandCanvasPodResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const rect = resize.element.getBoundingClientRect();
    const deltaX = event.clientX - resize.startClientX;
    const deltaY = event.clientY - resize.startClientY;
    const size = clampCommandCanvasPodSize(
      {
        width: resize.startWidth + (resize.edge === "bottom-left" ? -deltaX : deltaX),
        height: resize.startHeight + deltaY,
      },
      COMMAND_CANVAS_POD_MIN_SIZES[resize.podId],
      commandCanvasResizeMaximum(resize.podId, rect, resize.edge),
    );
    resize.size = size;
    resize.element.style.setProperty("--cc-live-width", `${size.width}px`);
    resize.element.style.setProperty("--cc-live-height", `${size.height}px`);
  }

  function finishCommandCanvasPodResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const resize = commandCanvasPodResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const rect = resize.element.getBoundingClientRect();
    const quantizedSize = clampCommandCanvasPodSize(
      {
        width: quantizeCommandCanvasCoordinate(resize.size.width),
        height: quantizeCommandCanvasCoordinate(resize.size.height),
      },
      COMMAND_CANVAS_POD_MIN_SIZES[resize.podId],
      commandCanvasResizeMaximum(resize.podId, rect, resize.edge),
    );
    setCommandCanvasLayout((current) => ({
      ...current,
      modules: {
        ...current.modules,
        [resize.podId]: {
          ...current.modules[resize.podId],
          width: quantizedSize.width,
          height: quantizedSize.height,
        },
      },
    }));
    resize.element.removeAttribute("data-resizing");
    resize.element.style.removeProperty("--cc-live-width");
    resize.element.style.removeProperty("--cc-live-height");
    commandCanvasPodResizeRef.current = null;
    setResizingCommandCanvasPodId(null);
  }

  function nudgeCommandCanvasPodSize(podId: PodId, deltaWidth: number, deltaHeight: number) {
    if (window.innerWidth < 1280) return;
    const element = document.querySelector<HTMLElement>(`[data-editor-pod="${podId}"]`);
    const rect = element?.getBoundingClientRect();
    if (!rect) return;
    const edge = commandCanvasPodResizeEdge(podId);
    const size = clampCommandCanvasPodSize(
      { width: rect.width + deltaWidth, height: rect.height + deltaHeight },
      COMMAND_CANVAS_POD_MIN_SIZES[podId],
      commandCanvasResizeMaximum(podId, rect, edge),
    );
    setCommandCanvasLayout((current) => ({
      ...current,
      modules: {
        ...current.modules,
        [podId]: {
          ...current.modules[podId],
          width: quantizeCommandCanvasCoordinate(size.width),
          height: quantizeCommandCanvasCoordinate(size.height),
        },
      },
    }));
  }

  function beginCommandCanvasPodDrag(event: ReactPointerEvent<HTMLElement>, podId: PodId) {
    if (
      window.innerWidth < 1280
      || commandCanvasPodResizeRef.current
      || event.button !== 0
      || (event.target as Element).closest("button, input, select, textarea, a")
    ) return;
    const podElement = event.currentTarget.closest<HTMLElement>("[data-editor-pod]");
    if (!podElement) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = podElement.getBoundingClientRect();
    commandCanvasPodDragRef.current = {
      podId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: rect.left,
      startY: rect.top,
      width: rect.width,
      height: rect.height,
      element: podElement,
      point: { x: rect.left, y: rect.top },
      snapDock: null,
    };
    podElement.dataset.dragging = "true";
    podElement.style.setProperty("--cc-live-x", `${rect.left}px`);
    podElement.style.setProperty("--cc-live-y", `${rect.top}px`);
    const preview = commandCanvasDockPreviewRef.current;
    preview?.style.setProperty("--cc-preview-width", `${rect.width}px`);
    preview?.style.setProperty("--cc-preview-height", `${rect.height}px`);
  }

  function moveCommandCanvasPod(event: ReactPointerEvent<HTMLElement>) {
    const drag = commandCanvasPodDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = placeCommandCanvasPod(
      {
        x: drag.startX + event.clientX - drag.startClientX,
        y: drag.startY + event.clientY - drag.startClientY,
      },
      { width: drag.width, height: drag.height },
      { width: window.innerWidth, height: window.innerHeight },
      COMMAND_CANVAS_DESKTOP_SAFE_INSETS,
    );
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-command-canvas-dock-target]"))
      .map((element) => {
        const dock = element.dataset.commandCanvasDockTarget as Exclude<PodDock, "floating"> | undefined;
        const rect = element.getBoundingClientRect();
        return dock ? { dock, x: rect.left, y: rect.top } : null;
      })
      .filter((target): target is { dock: Exclude<PodDock, "floating">; x: number; y: number } => Boolean(target));
    const snap = detectCommandCanvasDockSnap(point, targets);
    drag.point = snap ? { x: snap.x, y: snap.y } : point;
    drag.snapDock = snap?.dock ?? null;
    drag.element.style.setProperty("--cc-live-x", `${drag.point.x}px`);
    drag.element.style.setProperty("--cc-live-y", `${drag.point.y}px`);
    const preview = commandCanvasDockPreviewRef.current;
    if (preview) {
      if (snap) preview.dataset.activeDock = snap.dock;
      else preview.removeAttribute("data-active-dock");
    }
  }

  function endCommandCanvasPodDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = commandCanvasPodDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const placement = drag.snapDock
      ? { dock: drag.snapDock }
      : { dock: "floating" as const, x: drag.point.x, y: drag.point.y };
    setCommandCanvasLayout((current) => {
      const currentPlacement = current.modules[drag.podId];
      const width = currentPlacement.width ?? (drag.snapDock ? undefined : drag.width);
      const height = currentPlacement.height ?? (drag.snapDock ? undefined : drag.height);
      return {
        ...current,
        modules: {
          ...current.modules,
          [drag.podId]: {
            ...placement,
            ...(width === undefined ? {} : { width }),
            ...(height === undefined ? {} : { height }),
          },
        },
      };
    });
    drag.element.removeAttribute("data-dragging");
    drag.element.style.removeProperty("--cc-live-x");
    drag.element.style.removeProperty("--cc-live-y");
    commandCanvasPodDragRef.current = null;
    clearCommandCanvasDockPreview();
  }

  function revealCommandCanvasTools() {
    setCommandCanvasPodCollapsed("tools", false);
    if (window.innerWidth < 768) setMobileTab("tools");
  }

  function revealCommandCanvasScene(tab: EditorLeftPanelTab) {
    setLeftPanelTab(tab);
    setSourcePanelCollapsed(false);
    setCommandCanvasPodCollapsed("scene", false);
    if (window.innerWidth < 768) setMobileTab("source");
  }

  function revealCommandCanvasInspector(tab: InspectorTab) {
    setInspectorTab(tab);
    setSettingsPanelCollapsed(false);
    setCommandCanvasPodCollapsed("focus", false);
    if (window.innerWidth < 768) setMobileTab("controls");
  }

  function fitCommandCanvasView() {
    const scroller = canvasScrollRef.current;
    if (!scroller) {
      setZoom(1);
      setCanvasPan({ x: 0, y: 0 });
      return;
    }
    const numberGutter = settings.showNumbers && settings.gridNumberPlacement === "outside" ? 68 : 0;
    const availableWidth = Math.max(160, scroller.clientWidth - (window.innerWidth >= 1280 ? 780 : 96));
    const availableHeight = Math.max(160, scroller.clientHeight - 112);
    const nextZoom = Math.min(
      availableWidth / Math.max(1, previewCanvasSize.width + numberGutter),
      availableHeight / Math.max(1, previewCanvasSize.height + numberGutter),
    );
    setZoom(Math.max(0.35, Math.min(2.5, Math.round(nextZoom * 100) / 100)));
    setCanvasPan({ x: 0, y: 0 });
    requestAnimationFrame(() => {
      scroller.scrollTo({
        left: Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2),
        top: Math.max(0, (scroller.scrollHeight - scroller.clientHeight) / 2),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
  }

  const commandCanvasCommands: CommandCanvasCommand[] = [
    { id: "tool-select", label: "Select tool", group: "Tools", keywords: ["pointer", "move", "object"], shortcut: "V", run: () => selectEditorTool("select") },
    { id: "tool-pan", label: "Pan canvas", group: "Tools", keywords: ["hand", "navigate"], shortcut: "H", run: () => selectEditorTool("pan") },
    { id: "tool-line", label: "Draw Line", group: "Tools", keywords: ["line", "arrow", "stroke", "pencil"], run: () => selectEditorTool("draw") },
    { id: "tool-shape", label: "Draw Shape", group: "Tools", keywords: ["rectangle", "circle", "oval"], run: () => selectEditorTool("shape") },
    { id: "create-clear-shapes", label: "Clear generated shapes", group: "Tools", keywords: ["remove", "delete", "all shapes"], disabled: !settings.graphShapes.length, run: clearGraphShapes },
    { id: "tool-lasso", label: "Lasso artwork", group: "Tools", keywords: ["polygon", "region", "erase"], run: () => selectEditorTool("lasso") },
    { id: "tool-fill", label: "Fill region", group: "Tools", keywords: ["bucket", "color"], run: () => selectEditorTool("fill") },
    { id: "tool-background", label: "Remove background", group: "Tools", keywords: ["transparent", "tolerance"], run: () => selectEditorTool("background-remover") },
    { id: "tool-eraser", label: "Erase image lines", group: "Tools", keywords: ["brush", "restore"], run: () => selectEditorTool("image-eraser") },
    { id: "panel-tools", label: "Open Tools dock", group: "Panels", keywords: ["toolbar", "palette", "dock"], run: revealCommandCanvasTools },
    { id: "scene-layers", label: "Open Layers", group: "Panels", keywords: ["scene", "objects"], run: () => revealCommandCanvasScene("layers") },
    { id: "scene-assets", label: "Open Assets", group: "Panels", keywords: ["sources", "clipart", "uploads"], run: () => revealCommandCanvasScene("library") },
    { id: "inspector-document", label: "Inspect Document", group: "Panels", keywords: ["canvas", "grid", "print"], run: () => revealCommandCanvasInspector("graph") },
    { id: "inspector-selection", label: "Inspect Selection", group: "Panels", keywords: ["object", "properties", "trace"], run: () => revealCommandCanvasInspector("source") },
    { id: "inspector-create", label: "Open Create tools", group: "Panels", keywords: ["shape", "clipart", "cell"], run: () => revealCommandCanvasInspector("draw") },
    { id: "inspector-color", label: "Open Color controls", group: "Panels", keywords: ["palette", "fill", "outline"], run: () => revealCommandCanvasInspector("palette") },
    { id: "view-source", label: showOriginal ? "Show processed artwork" : "Show source artwork", group: "View", keywords: ["original", "preview"], run: () => setShowOriginal((value) => !value) },
    { id: "view-numbers", label: settings.showNumbers ? "Hide graph numbers" : "Show graph numbers", group: "View", keywords: ["grid", "labels"], run: () => updateSetting("showNumbers", !settings.showNumbers) },
    { id: "view-zoom-in", label: "Zoom in", group: "View", shortcut: "+", run: () => setZoom((value) => Math.min(2.5, value + 0.15)) },
    { id: "view-zoom-out", label: "Zoom out", group: "View", shortcut: "-", run: () => setZoom((value) => Math.max(0.35, value - 0.15)) },
    { id: "view-fit", label: "Fit canvas view", group: "View", keywords: ["reset", "center"], run: fitCommandCanvasView },
    { id: "history-undo", label: "Undo", group: "History", shortcut: "Ctrl Z", run: () => restoreSettingsHistory("undo") },
    { id: "history-redo", label: "Redo", group: "History", shortcut: "Ctrl Shift Z", run: () => restoreSettingsHistory("redo") },
    { id: "project-save", label: "Save project", group: "Project", shortcut: "Ctrl S", disabled: isPending || processing || Boolean(dragPreviewSourceId) || !title.trim(), run: () => saveProject() },
    { id: "export-png", label: "Export PNG", group: "Export", keywords: ["image", "download"], disabled: processing, run: exportPNG },
    { id: "export-pdf", label: "Export tiled PDF", group: "Export", keywords: ["print", "pages"], disabled: processing, run: exportPDF },
    { id: "export-json", label: "Export project JSON", group: "Export", keywords: ["settings", "backup"], run: exportJSON },
    { id: "export-print", label: "Print graph", group: "Export", keywords: ["browser", "paper"], disabled: processing, run: printGraph },
    { id: "workspace-settings", label: "Open Workspace settings", group: "Workspace", keywords: ["description", "templates"], run: () => setIsWorkspaceMenuOpen(true) },
    { id: "workspace-theme", label: "Toggle editor theme", group: "Workspace", keywords: ["dark", "light", "appearance"], run: () => document.querySelector<HTMLButtonElement>(".theme-toggle--editor")?.click() },
    ...EDITOR_TEMPLATE_OPTIONS.map<CommandCanvasCommand>((template) => ({
      id: `template-${template.id}`,
      label: `Apply ${template.label} template`,
      group: "Templates",
      keywords: ["workspace", "starter"],
      run: () => applyEditorTemplate(template.id),
    })),
    { id: "selection-duplicate", label: "Duplicate selection", group: "Selection", keywords: ["copy", "layer"], disabled: !hasSelectedLayer || selectedLayerLocked, run: duplicateSelectedLayers },
    { id: "selection-copy", label: "Copy selection", group: "Selection", shortcut: "Ctrl C", disabled: !hasSelectedLayer, run: copySelectedLayers },
    { id: "selection-paste", label: "Paste copied layers", group: "Selection", shortcut: "Ctrl V", disabled: !clipboardCount, run: pasteLayers },
    { id: "selection-group", label: "Group selected layers", group: "Selection", shortcut: "Ctrl G", disabled: !canGroupSelection, run: groupSelectedLayers },
    { id: "selection-ungroup", label: "Ungroup selected layers", group: "Selection", shortcut: "Ctrl Shift G", disabled: !selectionHasGroup, run: ungroupSelectedLayers },
    { id: "selection-lock", label: selectedLayerLocked ? "Unlock selection" : "Lock selection", group: "Selection", disabled: !hasSelectedLayer, run: toggleSelectedLayerLock },
    { id: "selection-visibility", label: selectedLayerHidden ? "Show selection" : "Hide selection", group: "Selection", disabled: !hasSelectedLayer, run: toggleSelectedLayerVisibility },
    { id: "selection-rotate-left", label: "Rotate selection left", group: "Selection", disabled: !hasSelectedLayer || selectedLayerLocked, run: () => rotateSelectedLayers(-1) },
    { id: "selection-rotate-right", label: "Rotate selection right", group: "Selection", disabled: !hasSelectedLayer || selectedLayerLocked, run: () => rotateSelectedLayers(1) },
    { id: "selection-flip-horizontal", label: "Flip selection horizontally", group: "Selection", disabled: !hasSelectedLayer || selectedLayerLocked, run: () => flipSelectedLayers("x") },
    { id: "selection-flip-vertical", label: "Flip selection vertically", group: "Selection", disabled: !hasSelectedLayer || selectedLayerLocked, run: () => flipSelectedLayers("y") },
    { id: "selection-move-up", label: "Move selected layer up", group: "Selection", keywords: ["order", "forward"], disabled: !selectedLayerCanMove(-1), run: () => moveSelectedLayer(-1) },
    { id: "selection-move-down", label: "Move selected layer down", group: "Selection", keywords: ["order", "backward"], disabled: !selectedLayerCanMove(1), run: () => moveSelectedLayer(1) },
    {
      id: "selection-replace",
      label: "Replace selected source",
      group: "Selection",
      keywords: ["upload", "swap", "image"],
      disabled: !selectedSource || selectedSource.locked || uploadingSources,
      run: () => document.querySelector<HTMLInputElement>('input[type="file"][aria-label="Replace selected source"]')?.click(),
    },
    { id: "selection-delete", label: "Delete selection", group: "Selection", disabled: !hasSelectedLayer || selectedLayerLocked, run: () => deleteSelectedLayer() },
    { id: "selection-crop", label: "Crop selected source", group: "Selection", keywords: ["image", "frame"], disabled: !selectedSource || !cropSourcePreviewUrl, run: () => selectedSource && openSourceCrop(selectedSource.id) },
    { id: "help-shortcuts", label: "Show keyboard shortcuts", group: "Help", shortcut: "?", run: () => setShowShortcutsPanel(true) },
    { id: "workspace-reset-layout", label: "Reset Workspace Layout", group: "Workspace", keywords: ["pods", "dock", "positions"], run: resetCommandCanvasLayout },
  ];

  function selectDraftShapeKind(kind: GeneratedShapeKind) {
    setPlacingGeneratedShape(false);
    setPlacingClipartAssetId(null);
    setDraftShapeKind(kind);
    setCanvasTool("pointer");
    setDrawTab("shape");
    setInspectorTab("draw");
    setSettingsPanelCollapsed(false);
    if (kind === "line" || kind === "arrow") {
      setArmedShapeKind(null);
      setDrawingTool("line");
      return;
    }
    setArmedShapeKind(kind);
    setDrawingTool("shape");
  }

  function updateResizeHandleHover(event: ReactPointerEvent<HTMLElement>) {
    const stage = graphStageRef.current;
    // Resize/crop handles belong to the select tool only. Showing them while
    // erasing, drawing lines, drawing shapes, or removing a background put
    // crop-looking guides under the pointer in modes where they do nothing.
    const inSelectMode = canvasTool === "pointer" && drawingTool === "image";
    if (!stage || showOriginal || !inSelectMode) {
      setResizeHandleTarget((current) => (current ? null : current));
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const pointerX = event.clientX - stageRect.left;
    const pointerY = event.clientY - stageRect.top;
    const boundarySize = 12;
    const isAtBoundary = (box: { left: number; top: number; width: number; height: number } | null) => {
      if (!box) return false;
      const right = box.left + box.width;
      const bottom = box.top + box.height;
      const withinExpandedBox =
        pointerX >= box.left - boundarySize &&
        pointerX <= right + boundarySize &&
        pointerY >= box.top - boundarySize &&
        pointerY <= bottom + boundarySize;
      if (!withinExpandedBox) return false;
      return Math.min(Math.abs(pointerX - box.left), Math.abs(pointerX - right), Math.abs(pointerY - box.top), Math.abs(pointerY - bottom)) <= boundarySize;
    };

    const nextTarget: ResizeHandleTarget = isAtBoundary(selectedGroupBox) && !selectedLayerContainsLocked
      ? "selection"
      : isAtBoundary(selectedSourceBox)
        ? "source"
        : isAtBoundary(selectedShapeBox)
          ? "shape"
          : null;
    setResizeHandleTarget((current) => (current === nextTarget ? current : nextTarget));
  }

  const canvasPanel = (
    <section
      className="editor-canvas-panel atelier-canvas-panel relative min-h-0"
      aria-label="Canvas workspace"
      aria-busy={canvasBootstrapPending}
      data-canvas-loading={canvasBootstrapPending ? "true" : "false"}
      data-canvas-state={initialCanvasFailed ? "error" : canvasLoaderVisible ? "loading" : "ready"}
    >
        <h1 className="sr-only">Canvas</h1>
        <div
          ref={canvasScrollRef}
          aria-hidden={canvasLoaderVisible ? true : undefined}
          inert={canvasLoaderVisible ? true : undefined}
          onDragOver={handleGeneratedShapeDragOver}
          onDrop={handleGeneratedShapeDrop}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedSourceId(null);
              setSelectedDrawingLayerId(null);
              setSelectedLayerKeys([]);
              setLayerChooser(null);
            }
          }}
          className="editor-canvas-panel__stage ui-canvas-bg relative min-h-0 overflow-auto p-8"
        >
          {(drawingTool === "image-eraser" || drawingTool === "background-remover") && !showOriginal ? (
            <div className="editor-context-toolbar-wrap pointer-events-none sticky top-0 z-30 -mx-8 -mt-8 mb-4 flex justify-center px-8 pt-2">
              <div className="editor-context-toolbar pointer-events-auto">
                {drawingTool === "image-eraser" ? (
                  <>
                    <span className="editor-context-toolbar__title"><Eraser size={14} aria-hidden="true" />Erase image lines</span>
                    <label className="editor-context-toolbar__field">
                      Brush
                      <input type="range" min={2} max={80} step={1} value={imageEraserRadius} onChange={(event) => setImageEraserRadius(Number(event.target.value))} />
                      <output>{imageEraserRadius}px</output>
                    </label>
                    <label className="editor-context-toolbar__field">
                      Shape
                      <select
                        value={imageEraserShape}
                        onChange={(event) => setImageEraserShape(event.target.value as GraphEraseBrushShape)}
                      >
                        <option value="circle">Circle</option>
                        <option value="square">Square</option>
                      </select>
                    </label>
                    <button type="button" className="editor-context-toolbar__btn" onClick={() => { const target = selectedSource ?? primarySource; if (target) clearSourceErasing(target.id); }} disabled={!(selectedSource ?? primarySource)?.eraseStrokes?.length}>
                      <RotateCcw size={13} aria-hidden="true" />Restore
                    </button>
                    <button type="button" className="editor-context-toolbar__btn editor-context-toolbar__btn--primary" onClick={() => selectEditorTool("select")}>
                      <Check size={13} aria-hidden="true" />Done
                    </button>
                  </>
                ) : drawingTool === "background-remover" ? (
                  selectedSource ? (
                    <>
                      <span className="editor-context-toolbar__title truncate">{selectedSource.name}</span>
                      <button type="button" className={`editor-context-toolbar__btn ${selectedSource.backgroundRemoval?.enabled ? "editor-context-toolbar__btn--active" : ""}`} onClick={() => toggleSourceBackgroundRemoval(selectedSource.id)} title="Remove the image background">
                        <Scissors size={13} aria-hidden="true" />
                        {selectedSource.backgroundRemoval?.enabled ? "Background removed" : "Remove background"}
                      </button>
                      {selectedSource.backgroundRemoval?.enabled ? (
                        <label className="editor-context-toolbar__field">
                          Tolerance
                          <input
                            type="range"
                            min={Math.round(MIN_BACKGROUND_TOLERANCE * 100)}
                            max={Math.round(MAX_BACKGROUND_TOLERANCE * 100)}
                            step={1}
                            value={Math.round((selectedSource.backgroundRemoval?.tolerance ?? DEFAULT_BACKGROUND_TOLERANCE) * 100)}
                            onChange={(event) => setSourceBackgroundRemoval(selectedSource.id, { enabled: true, tolerance: Number(event.target.value) / 100 })}
                          />
                          <output>{Math.round((selectedSource.backgroundRemoval?.tolerance ?? DEFAULT_BACKGROUND_TOLERANCE) * 100)}%</output>
                        </label>
                      ) : null}
                    </>
                  ) : (
                    <span className="editor-context-toolbar__title"><Scissors size={14} aria-hidden="true" />Select an image to remove its background</span>
                  )
                ) : null}
              </div>
            </div>
          ) : null}
          {notice ? (
            <div className={`editor-canvas-notice absolute left-24 top-3 z-20 flex min-h-8 w-[min(560px,calc(100%-8rem))] items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-sm ${
              notice.tone === "error"
                ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
                : notice.tone === "ok"
                  ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--green)]"
                  : "border-[var(--editor-line)] bg-[var(--editor-panel)] text-[var(--editor-text-dim)]"
            }`}>
              <span className="min-w-0 flex-1 leading-5">{notice.text}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="rounded-sm p-0.5 text-current transition hover:opacity-70"
                title="Close"
                aria-label="Close notification"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ) : null}
          {layerChooser ? (
            <div
              className="fixed z-[72] w-64 overflow-hidden rounded-md border border-[var(--editor-line)] bg-[var(--editor-panel)] text-sm shadow-xl"
              style={{ left: layerChooser.x + 8, top: layerChooser.y + 8 }}
            >
              <div className="border-b border-[var(--editor-line-soft)] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--editor-text-dim)]">Select layer</div>
              <div className="max-h-64 overflow-y-auto">
                {layerChooser.choices.map((choice) => (
                  <button
                    key={choice.key}
                    type="button"
                    onClick={() => selectLayerChoice(choice)}
                    className="grid w-full grid-cols-[24px_minmax(0,1fr)] items-center gap-2 border-b border-[var(--editor-line-soft)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--editor-panel-2)]"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded border border-[var(--editor-line)] bg-[var(--editor-panel-2)] text-[var(--editor-text-dim)]">
                      {choice.type === "source" || choice.type === "clipart" ? <ImageIcon size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-semibold text-[var(--editor-text)]">{choice.name}</span>
                      <span className="block truncate text-[11px] text-[var(--editor-text-dim)]">{choice.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {showOriginal && sourcePreviewUrl ? (
            <img src={sourcePreviewUrl} alt="" className="block rounded bg-[var(--artboard-bg)] object-contain shadow-sm" style={{ width: `${graphPreviewWidth}px`, height: "auto" }} />
          ) : (
            <div
              ref={graphStageRef}
              className="relative mx-auto"
              onDragOver={handleGeneratedShapeDragOver}
              onDrop={handleGeneratedShapeDrop}
              onPointerMove={updateResizeHandleHover}
              onPointerLeave={() => {
                setResizeHandleTarget(null);
              }}
              style={{
                width: `${graphPreviewWidth + outsideNumberMargin * 2}px`,
                height: `${graphPreviewHeight + outsideNumberMargin * 2}px`,
                transform: `translate(${canvasPan.x}px, ${canvasPan.y}px)`,
              }}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedSourceId(null);
                  setSelectedDrawingLayerId(null);
                  setSelectedLayerKeys([]);
                }
              }}
            >
              {/* Paper backdrop, then (for "back" grid) the crisp SVG grid below the
                  transparent artwork canvas. DOM order = paint order for these
                  z-auto layers, so later overlays (labels, guides, drag, selection)
                  keep stacking above without z-index juggling. */}
              <div
                className="pointer-events-none absolute rounded bg-[var(--artboard-bg)] shadow-sm"
                aria-hidden="true"
                style={{
                  left: `${outsideNumberMargin}px`,
                  top: `${outsideNumberMargin}px`,
                  width: `${graphPreviewWidth}px`,
                  height: `${graphPreviewHeight}px`,
                }}
              />
              {settings.gridLineLayer === "back" ? (
                <GraphGridOverlay
                  graphPixelWidth={previewCanvasSize.width}
                  graphPixelHeight={previewCanvasSize.height}
                  displayWidth={graphPreviewWidth}
                  displayHeight={graphPreviewHeight}
                  gridLineColor={settings.gridLineColor}
                  gridLineThickness={settings.gridLineThickness}
                  majorGridEvery={settings.majorGridEvery}
                  gridLineStyle={settings.gridLineStyle}
                  gridPattern={settings.gridPattern}
                  style={{ left: `${outsideNumberMargin}px`, top: `${outsideNumberMargin}px` }}
                />
              ) : null}
              <canvas
                ref={previewCanvasRef}
                onPointerDown={beginCanvasPointer}
                onPointerMove={moveCanvasPointer}
                onPointerLeave={clearImageEraserCursor}
                onPointerUp={endCanvasPointer}
                onPointerCancel={endCanvasPointer}
                onDoubleClick={openFillPaletteFromDoubleClick}
                onDragOver={handleGeneratedShapeDragOver}
                onDrop={handleGeneratedShapeDrop}
                title="Drag image to move it; double-click a fill area to choose its color; arrow keys move selected image by 0.1cm; Space or Ctrl plus drag pans the view"
                className="absolute left-0 top-0 rounded"
                style={{
                  left: `${outsideNumberMargin}px`,
                  top: `${outsideNumberMargin}px`,
                  width: `${graphPreviewWidth}px`,
                  height: `${graphPreviewHeight}px`,
                  cursor: previewCanvasCursor,
                  imageRendering: previewImageRendering,
                  touchAction: "none",
                }}
              />
              {settings.gridLineLayer !== "back" ? (
                <GraphGridOverlay
                  graphPixelWidth={previewCanvasSize.width}
                  graphPixelHeight={previewCanvasSize.height}
                  displayWidth={graphPreviewWidth}
                  displayHeight={graphPreviewHeight}
                  gridLineColor={settings.gridLineColor}
                  gridLineThickness={settings.gridLineThickness}
                  majorGridEvery={settings.majorGridEvery}
                  gridLineStyle={settings.gridLineStyle}
                  gridPattern={settings.gridPattern}
                  style={{ left: `${outsideNumberMargin}px`, top: `${outsideNumberMargin}px` }}
                />
              ) : null}
              {dragPreviewStyle ? (
                <canvas
                  ref={dragPreviewCanvasRef}
                  className="pointer-events-none absolute z-10 opacity-70 drop-shadow-[0_0_7px_rgba(34,211,238,0.72)]"
                  aria-hidden="true"
                  style={{
                    ...dragPreviewStyle,
                    transformOrigin: "center",
                    imageRendering: previewImageRendering,
                  }}
                />
              ) : null}
              {drawingTool === "lasso" && lassoVertices.length ? (
                (() => {
                  // Graph cells -> stage pixels, matching the eraser ring's mapping.
                  const toStage = (vertex: LassoVertex) => ({
                    x: outsideNumberMargin + vertex.x * GRAPH_MAJOR_CELL_PIXELS * zoom,
                    y: outsideNumberMargin + vertex.y * GRAPH_MAJOR_CELL_PIXELS * zoom,
                  });
                  const placed = lassoVertices.map(toStage);
                  // The pending edge follows the cursor until the region closes.
                  const rubberBand = lassoCursor ? [...placed, toStage(lassoCursor)] : placed;
                  const first = placed[0];
                  return (
                    <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible" aria-hidden="true">
                      <polyline
                        points={rubberBand.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="rgba(34,211,238,0.12)"
                        stroke="rgb(103,232,249)"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                      />
                      {placed.map((p, index) => (
                        <circle
                          key={`lasso-vertex-${index}`}
                          cx={p.x}
                          cy={p.y}
                          r={index === 0 ? 6 : 4}
                          fill={index === 0 ? "rgb(34,211,238)" : "rgb(15,23,42)"}
                          stroke="rgb(103,232,249)"
                          strokeWidth={2}
                        />
                      ))}
                      {/* Halo on the first vertex once closing is possible. */}
                      {/* Halo drawn at the true close radius, so the target
                          area is exactly what the click test accepts. */}
                      {first && placed.length >= 3 ? (
                        <circle
                          cx={first.x}
                          cy={first.y}
                          r={Math.max(10, lassoCloseDistanceCells * GRAPH_MAJOR_CELL_PIXELS * zoom)}
                          fill="rgba(34,211,238,0.12)"
                          stroke="rgba(34,211,238,0.6)"
                          strokeWidth={2}
                          strokeDasharray="4 3"
                        />
                      ) : null}
                    </svg>
                  );
                })()
              ) : null}
              {drawingTool === "image-eraser" ? (
                <div
                  ref={imageEraserCursorNodeRef}
                  className={`pointer-events-none absolute z-30 border-2 border-cyan-300 bg-cyan-300/15 shadow-[0_0_0_1px_rgba(2,6,23,0.92),0_0_12px_rgba(34,211,238,0.65)] ${
                    imageEraserShape === "square" ? "rounded-[2px]" : "rounded-full"
                  }`}
                  aria-hidden="true"
                  style={{ display: "none" }}
                />
              ) : null}
              {settings.showNumbers && settings.gridNumberPlacement === "outside" ? (
                <div className="pointer-events-none absolute inset-0 text-[11px] font-semibold text-[var(--editor-text-dim)]">
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
                      className="absolute border-t-2 border-dotted border-[var(--editor-muted)]"
                      style={{
                        left: outsideNumberMargin,
                        top: outsideNumberMargin + sourceY * zoom,
                        width: graphPreviewWidth,
                      }}
                    >
                      <span className="absolute right-2 -top-5 rounded bg-[var(--editor-panel)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--editor-text-dim)] shadow-sm">
                        Page {index + 2}
                      </span>
                    </div>
                  ))}
                  {pageBreakGuideX.map((sourceX, index) => (
                    <div
                      key={`page-x-${sourceX}`}
                      className="absolute border-l-2 border-dotted border-[var(--editor-muted)]"
                      style={{
                        height: graphPreviewHeight,
                        left: outsideNumberMargin + sourceX * zoom,
                        top: outsideNumberMargin,
                      }}
                    >
                      <span className="absolute left-1 top-2 rounded bg-[var(--editor-panel)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--editor-text-dim)] shadow-sm">
                        Page {index + 2}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {snapGuides.length ? (
                <div className="pointer-events-none absolute inset-0">
                  {snapGuides.map((guide, index) =>
                    guide.axis === "x" ? (
                      <div
                        key={`snap-x-${guide.value}-${index}`}
                        className="absolute border-l-2 border-[var(--editor-accent)] shadow-[0_0_8px_var(--editor-accent-soft)]"
                        style={{
                          left: outsideNumberMargin + guide.value * GRAPH_MAJOR_CELL_PIXELS * zoom,
                          top: outsideNumberMargin,
                          height: graphPreviewHeight,
                        }}
                      />
                    ) : (
                      <div
                        key={`snap-y-${guide.value}-${index}`}
                        className="absolute border-t-2 border-[var(--editor-accent)] shadow-[0_0_8px_var(--editor-accent-soft)]"
                        style={{
                          left: outsideNumberMargin,
                          top: outsideNumberMargin + guide.value * GRAPH_MAJOR_CELL_PIXELS * zoom,
                          width: graphPreviewWidth,
                        }}
                      />
                    ),
                  )}
                </div>
              ) : null}
              <CommandCanvasSelectionStrip
                visible={Boolean(
                  selectionTransformBox
                  && hasSelectedLayer
                  && canvasTool === "pointer"
                  && drawingTool === "image"
                  && !isDraggingGraph
                  && !resizingCommandCanvasPodId,
                )}
                selectionLabel={selectionTransformLabel}
                style={selectionTransformStyle}
                disabled={selectedLayerContainsLocked}
                cropAvailable={Boolean(selectedSource && cropSourcePreviewUrl)}
                onRotateLeft={() => rotateSelectedLayers(-1)}
                onRotateRight={() => rotateSelectedLayers(1)}
                onFlipHorizontal={() => flipSelectedLayers("x")}
                onFlipVertical={() => flipSelectedLayers("y")}
                onCrop={selectedSource ? () => openSourceCrop(selectedSource.id) : undefined}
                onDuplicate={duplicateSelectedLayers}
                extraActions={[
                  {
                    id: "selection-visibility",
                    label: selectedLayerHidden ? "Show selection" : "Hide selection",
                    icon: selectedLayerHidden ? Eye : EyeOff,
                    run: toggleSelectedLayerVisibility,
                  },
                  {
                    id: "selection-lock",
                    label: selectedLayerLocked ? "Unlock selection" : "Lock selection",
                    icon: selectedLayerLocked ? Unlock : Lock,
                    run: toggleSelectedLayerLock,
                  },
                  {
                    id: "selection-delete",
                    label: "Delete selection",
                    icon: Trash2,
                    disabled: selectedLayerContainsLocked,
                    run: () => deleteSelectedLayer(),
                  },
                ]}
              />
              {showCanvasSelectionOverlay && selectedGroupBox ? (
                <div className={CANVAS_SELECTION_BOX_CLASS} style={selectedGroupBox} data-selection-hidden={selectedLayerHidden}>
                  {SOURCE_RESIZE_HANDLES.map((handle) => {
                    const handleVisible = sourceResizeHandleVisible(handle, showSelectionResizeHandles);
                    return (
                      <button
                        key={handle}
                        type="button"
                        aria-label={`Resize selected layers ${handle}`}
                        disabled={selectedLayerContainsLocked}
                        onPointerDown={(event) => beginSelectionResize(event, handle)}
                        onPointerMove={dragGraph}
                        onPointerUp={endGraphDrag}
                        onPointerCancel={endGraphDrag}
                        tabIndex={handleVisible ? 0 : -1}
                        className={sourceResizeHandleClass(handle, selectedLayerContainsLocked, handleVisible)}
                      >
                        <span className={sourceResizeHandleIconClass(handle)}>{sourceResizeHandleIcon(handle)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {showCanvasSelectionOverlay && !selectedGroupBox && selectedShapeBox && selectedShapeLayer ? (
                <div
                  className={CANVAS_SELECTION_BOX_CLASS}
                  style={selectedShapeBox}
                  data-selection-hidden={selectedLayerHidden}
                >
                  {SOURCE_RESIZE_HANDLES.map((handle) => {
                    const handleVisible = sourceResizeHandleVisible(handle, showShapeSideResizeHandles);
                    return (
                      <button
                        key={handle}
                        type="button"
                        aria-label={`Resize ${handle}`}
                        disabled={selectedShapeLayer.locked}
                        onPointerDown={(event) => beginShapeResize(event, selectedShapeLayer, handle)}
                        onPointerMove={dragGraph}
                        onPointerUp={endGraphDrag}
                        onPointerCancel={endGraphDrag}
                        tabIndex={handleVisible ? 0 : -1}
                        className={sourceResizeHandleClass(handle, selectedShapeLayer.locked, handleVisible)}
                      >
                        <span className={sourceResizeHandleIconClass(handle)}>{sourceResizeHandleIcon(handle)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {showCanvasSelectionOverlay && !selectedGroupBox && selectedClipartBox ? (
                <div
                  className={CANVAS_SELECTION_BOX_CLASS}
                  style={selectedClipartBox}
                  data-selection-hidden={selectedLayerHidden}
                />
              ) : null}
              {showCanvasSelectionOverlay && !selectedGroupBox && selectedSourceBox && selectedSourceLayout ? (
                <div
                  className={CANVAS_SELECTION_BOX_CLASS}
                  style={selectedSourceBox}
                  data-selection-hidden={selectedLayerHidden}
                >
                  {SOURCE_RESIZE_HANDLES.map((handle) => {
                    const handleVisible = sourceResizeHandleVisible(handle, showSourceSideResizeHandles);
                    return (
                      <button
                        key={handle}
                        type="button"
                        aria-label={`Resize ${handle}`}
                        disabled={selectedSource?.locked}
                        onPointerDown={(event) => beginSourceResize(event, selectedSourceLayout, handle)}
                        onPointerMove={dragGraph}
                        onPointerUp={endGraphDrag}
                        onPointerCancel={endGraphDrag}
                        tabIndex={handleVisible ? 0 : -1}
                        className={sourceResizeHandleClass(handle, selectedSource?.locked, handleVisible)}
                      >
                        <span className={sourceResizeHandleIconClass(handle)}>{sourceResizeHandleIcon(handle)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </div>
        <EditorCanvasLoader
          visible={canvasLoaderVisible}
          phase={canvasLoaderPhase}
          label={canvasLoaderLabel}
        />
        <EditorStatusBar
          status={statusLabel}
          processing={canvasUpdatePending}
          dimensions={`${settings.graphWidth} x ${settings.graphHeight} cells`}
          selection={selectedLayerStatusLabel}
          zoom={zoom}
          online={isOnline}
        />
    </section>
  );

  return (
    <div
      className="editor-dark-shell atelier-editor command-canvas"
      data-editor-layout="atelier"
      data-editor-design="floating-studio"
      data-editor-generation="command-canvas"
    >
      <EditorCommandBar
        title={title}
        onTitleChange={setTitle}
        onUndo={() => restoreSettingsHistory("undo")}
        onRedo={() => restoreSettingsHistory("redo")}
        onSave={() => saveProject()}
        savePending={isPending}
        saveDisabled={isPending || processing || Boolean(dragPreviewSourceId) || !title.trim()}
        sourcePanelCollapsed={commandCanvasPodCollapsed("scene")}
        onToggleSourcePanel={() => toggleCommandCanvasPod("scene")}
        inspectorCollapsed={commandCanvasPodCollapsed("focus")}
        onToggleInspector={() => toggleCommandCanvasPod("focus")}
        onToggleWorkspace={() => setIsWorkspaceMenuOpen((open) => !open)}
        workspaceOpen={isWorkspaceMenuOpen}
        workspaceButtonRef={workspaceMenuButtonRef}
        onToggleExport={() => setIsExportMenuOpen((open) => !open)}
        exportOpen={isExportMenuOpen}
        exportButtonRef={exportMenuButtonRef}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <CommandCanvasCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        commands={commandCanvasCommands}
      />

      {isWorkspaceMenuOpen && workspaceMenuStyle
        ? createPortal(
            <div
              ref={workspaceMenuPortalRef}
              className="editor-workspace-menu editor-workspace-menu--portal"
              role="menu"
              aria-label="Workspace settings"
              style={workspaceMenuStyle}
            >
              <div className="editor-workspace-menu__section">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3>Workspace</h3>
                    <p>Project metadata and productivity controls.</p>
                  </div>
                  <SquarePen size={18} className="text-[var(--editor-accent)]" aria-hidden="true" />
                </div>
                <label className="mt-3 grid gap-1.5">
                  <span>Project description</span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional project notes" />
                </label>
              </div>

              <div className="editor-workspace-menu__section">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3>Templates</h3>
                    <p>Apply a starter layout to the current project.</p>
                  </div>
                  <Sparkles size={18} className="text-[var(--editor-accent)]" aria-hidden="true" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {EDITOR_TEMPLATE_OPTIONS.map((template) => (
                    <button key={template.id} type="button" onClick={() => applyEditorTemplate(template.id)}>
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="editor-workspace-menu__section">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3>Productivity</h3>
                    <p>Keyboard shortcuts for the editor.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowShortcutsPanel((value) => !value)} className="mt-3">
                  <Keyboard size={15} aria-hidden="true" />
                  {showShortcutsPanel ? "Hide shortcuts" : "Show shortcuts"}
                </button>
              </div>

            </div>,
            document.body,
          )
        : null}

      {isExportMenuOpen && exportMenuStyle
        ? createPortal(
            <div
              ref={exportMenuPortalRef}
              className="editor-export-menu editor-export-menu--portal"
              role="menu"
              aria-label="Export format"
              style={exportMenuStyle}
            >
              <button
                type="button"
                onClick={() => {
                  setIsExportMenuOpen(false);
                  exportPNG();
                }}
                className="editor-export-option"
                role="menuitem"
              >
                <ImageDown size={16} aria-hidden="true" />
                PNG
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExportMenuOpen(false);
                  exportPDF();
                }}
                className="editor-export-option"
                role="menuitem"
              >
                <FileText size={16} aria-hidden="true" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExportMenuOpen(false);
                  exportJSON();
                }}
                className="editor-export-option"
                role="menuitem"
              >
                <FileJson size={16} aria-hidden="true" />
                JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExportMenuOpen(false);
                  printGraph();
                }}
                className="editor-export-option"
                role="menuitem"
              >
                <Printer size={16} aria-hidden="true" />
                Print
              </button>
            </div>,
            document.body,
          )
        : null}

      {mobileTab !== "canvas" ? <button type="button" className="editor-mobile-sheet-backdrop" aria-label="Close panel" onClick={() => setMobileTab("canvas")} /> : null}
      <div
        className="editor-workspace atelier-editor__workspace command-canvas__workspace"
        data-document-panel={sourcePanelCollapsed ? "closed" : "open"}
        data-inspector-panel={settingsPanelCollapsed ? "closed" : "open"}
      >
        <div className="editor-canvas-host atelier-editor__canvas-host command-canvas__canvas" data-editor-region="canvas-host">
          {canvasPanel}
        </div>

        <CommandCanvasPod
          id="tools"
          title="Tools"
          eyebrow="Workspace"
          icon={MousePointer2}
          meta={<span>{activeEditorTool}</span>}
          dock={resolveCommandCanvasPodPlacement(commandCanvasLayout, "tools", commandCanvasViewportWidth).dock}
          collapsed={false}
          style={commandCanvasPodStyle("tools")}
          className={`command-canvas__tools editor-mobile-sheet editor-mobile-sheet--tools ${mobileTab === "tools" ? "editor-mobile-sheet--open" : ""}`}
          onHeaderPointerDown={(event) => beginCommandCanvasPodDrag(event, "tools")}
          onHeaderPointerMove={moveCommandCanvasPod}
          onHeaderPointerUp={endCommandCanvasPodDrag}
          onHeaderPointerCancel={endCommandCanvasPodDrag}
          onNudge={(deltaX, deltaY) => nudgeCommandCanvasPod("tools", deltaX, deltaY)}
          resizeEdge={commandCanvasPodResizeEdge("tools")}
          resizeActive={resizingCommandCanvasPodId === "tools"}
          onResizePointerDown={(event) => beginCommandCanvasPodResize(event, "tools", commandCanvasPodResizeEdge("tools"))}
          onResizePointerMove={resizeCommandCanvasPod}
          onResizePointerUp={finishCommandCanvasPodResize}
          onResizePointerCancel={finishCommandCanvasPodResize}
          onResizeNudge={(deltaWidth, deltaHeight) => nudgeCommandCanvasPodSize("tools", deltaWidth, deltaHeight)}
        >
          <EditorToolRail activeTool={activeEditorTool} onSelectTool={selectEditorTool} />
        </CommandCanvasPod>

        <CommandCanvasPod
          id="scene"
          title="Scene"
          eyebrow="Document"
          icon={Layers3}
          meta={<span>{visibleLayerCount}</span>}
          dock={resolveCommandCanvasPodPlacement(commandCanvasLayout, "scene", commandCanvasViewportWidth).dock}
          collapsed={commandCanvasPodCollapsed("scene")}
          style={commandCanvasPodStyle("scene")}
          className={`editor-side-column editor-side-column--document editor-mobile-sheet editor-mobile-sheet--left ${mobileTab === "source" ? "editor-mobile-sheet--open" : ""} ${sourcePanelCollapsed ? "editor-side-column--collapsed" : ""}`}
          onHeaderPointerDown={(event) => beginCommandCanvasPodDrag(event, "scene")}
          onHeaderPointerMove={moveCommandCanvasPod}
          onHeaderPointerUp={endCommandCanvasPodDrag}
          onHeaderPointerCancel={endCommandCanvasPodDrag}
          onNudge={(deltaX, deltaY) => nudgeCommandCanvasPod("scene", deltaX, deltaY)}
          onRequestDock={() => dockCommandCanvasPod("scene")}
          onRequestFloat={() => floatCommandCanvasPod("scene")}
          onRequestCollapse={() => toggleCommandCanvasPod("scene")}
          onRequestReset={() => resetCommandCanvasPod("scene")}
          resizeEdge={commandCanvasPodResizeEdge("scene")}
          resizeActive={resizingCommandCanvasPodId === "scene"}
          onResizePointerDown={(event) => beginCommandCanvasPodResize(event, "scene", commandCanvasPodResizeEdge("scene"))}
          onResizePointerMove={resizeCommandCanvasPod}
          onResizePointerUp={finishCommandCanvasPodResize}
          onResizePointerCancel={finishCommandCanvasPodResize}
          onResizeNudge={(deltaWidth, deltaHeight) => nudgeCommandCanvasPodSize("scene", deltaWidth, deltaHeight)}
        >
          {sourcePanel}
        </CommandCanvasPod>

        <CommandCanvasPod
          id="navigator"
          title="Navigator"
          eyebrow="View"
          icon={Maximize2}
          headerContent={(
            <EditorNavigatorStatus
              status={statusLabel}
              processing={canvasUpdatePending}
              online={isOnline}
              tone={navigatorStatusTone}
            />
          )}
          dock="right-top"
          collapsed={false}
          className={`editor-mobile-sheet editor-mobile-sheet--view ${mobileTab === "view" ? "editor-mobile-sheet--open" : ""}`}
        >
          <CommandCanvasNavigator
            showOriginal={showOriginal}
            showNumbers={settings.showNumbers}
            zoom={zoom}
            onToggleOriginal={() => setShowOriginal((value) => !value)}
            onToggleNumbers={() => updateSetting("showNumbers", !settings.showNumbers)}
            onZoomOut={() => setZoom((value) => Math.max(0.35, value - 0.15))}
            onZoomIn={() => setZoom((value) => Math.min(2.5, value + 0.15))}
            onFitView={fitCommandCanvasView}
          />
        </CommandCanvasPod>

        <CommandCanvasCompactViewTrigger
          open={mobileTab === "view"}
          onClick={() => {
            if (mobileTab === "view") setMobileTab("canvas");
            else {
              setMobileTab("view");
            }
          }}
        />

        <CommandCanvasPod
          id="focus"
          title="Focus Console"
          eyebrow="Inspector"
          icon={Settings2}
          meta={<span>{inspectorTab === "graph" ? "Document" : inspectorTab === "source" ? "Selection" : inspectorTab === "draw" ? "Create" : "Color"}</span>}
          dock={resolveCommandCanvasPodPlacement(commandCanvasLayout, "focus", commandCanvasViewportWidth).dock}
          collapsed={commandCanvasPodCollapsed("focus")}
          style={commandCanvasPodStyle("focus")}
          className={`editor-side-column editor-side-column--inspector editor-mobile-sheet editor-mobile-sheet--right ${mobileTab === "controls" ? "editor-mobile-sheet--open" : ""} ${settingsPanelCollapsed ? "editor-side-column--collapsed" : ""}`}
          onHeaderPointerDown={(event) => beginCommandCanvasPodDrag(event, "focus")}
          onHeaderPointerMove={moveCommandCanvasPod}
          onHeaderPointerUp={endCommandCanvasPodDrag}
          onHeaderPointerCancel={endCommandCanvasPodDrag}
          onNudge={(deltaX, deltaY) => nudgeCommandCanvasPod("focus", deltaX, deltaY)}
          onRequestDock={() => dockCommandCanvasPod("focus")}
          onRequestFloat={() => floatCommandCanvasPod("focus")}
          onRequestCollapse={() => toggleCommandCanvasPod("focus")}
          onRequestReset={() => resetCommandCanvasPod("focus")}
          resizeEdge={commandCanvasPodResizeEdge("focus")}
          resizeActive={resizingCommandCanvasPodId === "focus"}
          onResizePointerDown={(event) => beginCommandCanvasPodResize(event, "focus", commandCanvasPodResizeEdge("focus"))}
          onResizePointerMove={resizeCommandCanvasPod}
          onResizePointerUp={finishCommandCanvasPodResize}
          onResizePointerCancel={finishCommandCanvasPodResize}
          onResizeNudge={(deltaWidth, deltaHeight) => nudgeCommandCanvasPodSize("focus", deltaWidth, deltaHeight)}
        >
          <InspectorPanel
            selectionConsole={selectionConsole}
            settings={settings}
            palette={palette}
            inspectorTab={inspectorTab}
            setInspectorTab={setInspectorTab}
            drawTab={drawTab}
            setDrawTab={setDrawTab}
            drawingTool={drawingTool}
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
            selectedSource={selectedSource}
            selectedClipartAsset={selectedClipartAsset}
            selectedShapeLayer={selectedShapeLayer}
            selectedClipartLayer={selectedClipartLayer}
            selectedCellLayer={selectedCellLayer}
            selectedFillRegion={selectedFillRegion}
            selectedFillRegionColor={selectedFillRegionColor}
            filteredClipartAssets={filteredClipartAssets}
            uploadingCliparts={uploadingCliparts}
            deletingClipartAssetId={deletingClipartAssetId}
            clipartSearch={clipartSearch}
            setClipartSearch={setClipartSearch}
            setSelectedClipartAssetId={setSelectedClipartAssetId}
            placingClipartAssetId={placingClipartAssetId}
            selectedLayerCount={selectedLayerCount}
            selectedLayerBounds={selectedLayerBounds ? { width: selectedLayerBounds.width, height: selectedLayerBounds.height } : null}
            selectedLayerLocked={selectedLayerLocked}
            selectedLayerResizeDisabled={selectedLayerContainsLocked}
            selectedLayerHidden={selectedLayerHidden}
            resizeSelectedLayerBounds={resizeSelectedLayerBounds}
            draftShapeKind={draftShapeKind}
            armedShapeKind={armedShapeKind}
            draftShapeFillMode={draftShapeFillMode}
            draftShapeStrokeWidth={draftShapeStrokeWidth}
            draftShapeStrokeColor={draftShapeStrokeColor}
            draftShapeStrokeStyle={draftShapeStrokeStyle}
            draftShapeFillColor={draftShapeFillColor}
            setDraftShapeKind={selectDraftShapeKind}
            setDraftShapeFillMode={setDraftShapeFillMode}
            setDraftShapeStrokeWidth={setDraftShapeStrokeWidth}
            setDraftShapeStrokeColor={(value) => setDraftShapeStrokeColor(normalizeCanvasColor(value))}
            setDraftShapeStrokeStyle={setDraftShapeStrokeStyle}
            setDraftShapeFillColor={(value) => setDraftShapeFillColor(normalizeCanvasFillColor(value))}
            setPlacingClipartAssetId={setPlacingClipartAssetId}
            lassoFill={lassoFill}
            setLassoFill={setLassoFill}
            lassoVertexCount={lassoVertices.length}
            commitLasso={() => commitLassoRegion(lassoVerticesRef.current)}
            cancelLasso={cancelLasso}
            draftClipartWidthCm={draftClipartWidthCm}
            draftClipartHeightCm={draftClipartHeightCm}
            draftClipartStrokeColor={draftClipartStrokeColor}
            draftClipartFillColor={draftClipartFillColor}
            draftClipartPreviewDimensions={draftClipartPreviewDimensions}
            setDraftClipartWidthCm={setDraftClipartWidthCm}
            setDraftClipartHeightCm={setDraftClipartHeightCm}
            setDraftClipartStrokeColor={(value) => setDraftClipartStrokeColor(normalizeCanvasColor(value))}
            setDraftClipartFillColor={(value) => setDraftClipartFillColor(normalizeCanvasFillColor(value))}
            handleClipartDragStart={handleClipartDragStart}
            uploadClipartAssets={uploadClipartAssets}
            deleteClipartAsset={deleteClipartAsset}
            setGeneratedImagesCollapsed={setGeneratedImagesCollapsed}
            renderShapeAdvanced={renderShapeAdvanced}
            renderClipartAdvanced={renderClipartAdvanced}
            renderCellAdvanced={renderCellAdvanced}
            updateSourceImage={updateSourceImage}
            applySourceImagePropertiesToAll={applySourceImagePropertiesToAll}
            updateSourceImagePhysicalWidthCm={updateSourceImagePhysicalWidthCm}
            updateSourceImagePhysicalHeight={updateSourceImagePhysicalHeight}
            sourcePhysicalWidthCm={sourcePhysicalWidthCm}
            sourcePhysicalHeight={sourcePhysicalHeight}
            sourceRightPadding={sourceRightPadding}
            sourceBottomPadding={sourceBottomPadding}
            updateSetting={updateSetting}
            updateMeasurementUnit={updateMeasurementUnit}
            updateImageWidthCm={updateImageWidthCm}
            updateImageHeightPhysical={updateImageHeightPhysical}
            updateGraphPhysicalHeight={updateGraphPhysicalHeight}
            updateOutlineColor={updateOutlineColor}
            updateFillRegionColor={updateFillRegionColor}
            resetFillRegionColor={resetFillRegionColor}
            setSettingsWithHistory={setSettingsWithHistory}
            editorDefaultGraphSettings={editorDefaultGraphSettings}
            setSelectedFillRegionId={setSelectedFillRegionId}
            setFloatingPalette={setFloatingPalette}
            setCopiedFillColor={setCopiedFillColor}
            imageWidthCm={imageWidthCm}
            imageHeightCm={imageHeightCm}
            printWidthCm={printWidthCm}
            printHeightCm={printHeightCm}
            roundMeasure={roundMeasure}
            cmToUnit={cmToUnit}
            unitToCm={unitToCm}
            clipartAssetAspect={clipartAssetAspect}
          />
        </CommandCanvasPod>

        <div className="command-canvas__dock-target" data-command-canvas-dock-target="tool-spine" aria-hidden="true" />
        <div className="command-canvas__dock-target" data-command-canvas-dock-target="left-main" aria-hidden="true" />
        <div className="command-canvas__dock-target" data-command-canvas-dock-target="left-lower" aria-hidden="true" />
        <div className="command-canvas__dock-target" data-command-canvas-dock-target="right-top" aria-hidden="true" />
        <div className="command-canvas__dock-target" data-command-canvas-dock-target="right-main" aria-hidden="true" />
        <div ref={commandCanvasDockPreviewRef} className="command-canvas__dock-preview" aria-hidden="true" />
      </div>

      <section
        className={`editor-mobile-export-sheet editor-mobile-sheet ${mobileTab === "export" ? "editor-mobile-sheet--open" : ""}`}
        aria-label="Export formats"
        aria-hidden={mobileTab !== "export"}
      >
        <header>
          <div>
            <span>Output</span>
            <h2>Export graph</h2>
          </div>
          <button type="button" onClick={() => setMobileTab("canvas")} aria-label="Close export formats"><X size={17} aria-hidden="true" /></button>
        </header>
        <div>
          <button type="button" onClick={() => { setMobileTab("canvas"); exportPNG(); }} disabled={processing}><ImageDown size={18} aria-hidden="true" /><span><strong>PNG image</strong><small>Flattened graph artwork</small></span></button>
          <button type="button" onClick={() => { setMobileTab("canvas"); exportPDF(); }} disabled={processing}><FileText size={18} aria-hidden="true" /><span><strong>Tiled PDF</strong><small>Print-ready pages</small></span></button>
          <button type="button" onClick={() => { setMobileTab("canvas"); exportJSON(); }}><FileJson size={18} aria-hidden="true" /><span><strong>Project JSON</strong><small>Portable settings backup</small></span></button>
          <button type="button" onClick={() => { setMobileTab("canvas"); printGraph(); }} disabled={processing}><Printer size={18} aria-hidden="true" /><span><strong>Print</strong><small>Open browser print view</small></span></button>
        </div>
      </section>

      <nav className="editor-mobile-dock atelier-editor__mobile-dock" aria-label="Mobile editor controls">
        <button type="button" onClick={() => {
          if (mobileTab === "source") setMobileTab("canvas");
          else revealCommandCanvasScene(leftPanelTab);
        }} className={mobileTab === "source" ? "is-active" : ""}>
          <Layers3 size={19} aria-hidden="true" />
          Layers
        </button>
        <button type="button" onClick={() => {
          if (mobileTab === "tools") setMobileTab("canvas");
          else revealCommandCanvasTools();
        }} className={mobileTab === "tools" ? "is-active" : ""}>
          <Scissors size={19} aria-hidden="true" />
          Tools
        </button>
        <button type="button" onClick={() => {
          if (mobileTab === "view") setMobileTab("canvas");
          else {
            setMobileTab("view");
          }
        }} className={mobileTab === "view" ? "is-active" : ""}>
          <Maximize2 size={19} aria-hidden="true" />
          Canvas
        </button>
        <button type="button" onClick={() => {
          if (mobileTab === "controls") setMobileTab("canvas");
          else revealCommandCanvasInspector(inspectorTab);
        }} className={mobileTab === "controls" ? "is-active" : ""}>
          <Settings2 size={19} aria-hidden="true" />
          Properties
        </button>
        <button type="button" onClick={() => setMobileTab((tab) => tab === "export" ? "canvas" : "export")} className={mobileTab === "export" ? "is-active" : ""}>
          <ImageDown size={19} aria-hidden="true" />
          Export
        </button>
      </nav>
      {floatingPaletteNode}
      {shortcutsPanelNode}
      {sourceCropMode
        ? createPortal(
            <div className="editor-crop-modal" role="dialog" aria-modal="true" aria-label="Crop source image">
              <button type="button" className="editor-crop-modal__backdrop" aria-label="Close crop window" onClick={closeSourceCrop} />
              <div className="editor-crop-modal__panel">
                <header className="editor-crop-modal__header">
                  <div className="min-w-0">
                    <h2>Crop image</h2>
                    <p className="truncate">{cropSource?.name ?? "Select an image to crop"}</p>
                  </div>
                  <button type="button" onClick={closeSourceCrop} className="editor-crop-modal__close" aria-label="Close crop window">
                    <X size={18} aria-hidden="true" />
                  </button>
                </header>
                <div className="editor-crop-modal__body">
                  {settings.sourceImages.length > 1 ? (
                    <aside className="editor-crop-modal__filmstrip">
                      {settings.sourceImages.map((source) => {
                        const active = cropSource?.id === source.id;
                        return (
                          <button
                            key={`crop-modal-source-${source.id}`}
                            type="button"
                            onClick={() => openSourceCrop(source.id)}
                            className={`editor-crop-modal__thumb ${active ? "is-active" : ""}`}
                            title={source.name}
                          >
                            {renderSourceThumbnail(source, "h-12 w-12")}
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-semibold">{source.name}</span>
                              <span className="block text-[11px] opacity-70">{roundCells(source.width)} x {roundCells(source.height)}</span>
                            </span>
                          </button>
                        );
                      })}
                    </aside>
                  ) : null}
                  <div className="editor-crop-modal__stage">
                    {cropSourcePreviewUrl ? (
                      <ManualCropper
                        imageUrl={cropSourcePreviewUrl}
                        crop={sourceCropArea}
                        onCropChange={setSourceCropArea}
                        zoom={sourceCropZoom}
                        onZoomChange={setSourceCropZoom}
                        rotationDegrees={sourceCropRotation}
                        straightenDegrees={sourceCropStraighten}
                        flipX={sourceCropFlipX}
                        flipY={sourceCropFlipY}
                        backgroundRemoval={sourceCropBackgroundRemoval}
                        guide={sourceCropGuide}
                        interactionMode={sourceCropInteractionMode}
                        className="h-full w-full"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-sm font-semibold text-[var(--editor-text-dim)]">Select a loaded source image to crop.</div>
                    )}
                  </div>
                </div>
                <footer className="editor-crop-modal__footer">
                  <div className="editor-crop-modal__tools">
                    <button type="button" onClick={() => setSourceCropInteractionMode("crop")} className={`editor-crop-modal__tool ${sourceCropInteractionMode === "crop" ? "is-active" : ""}`} title="Crop"><Crop size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => setSourceCropInteractionMode("pan")} className={`editor-crop-modal__tool ${sourceCropInteractionMode === "pan" ? "is-active" : ""}`} title="Pan"><Hand size={15} aria-hidden="true" /></button>
                    <span className="editor-crop-modal__tool-divider" aria-hidden="true" />
                    <button type="button" onClick={() => { setSourceCropRotation((value) => (value + 270) % 360); setSourceCropArea(null); }} className="editor-crop-modal__tool" title="Rotate left"><RotateCcw size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => { setSourceCropRotation((value) => (value + 90) % 360); setSourceCropArea(null); }} className="editor-crop-modal__tool" title="Rotate right"><RotateCw size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => setSourceCropFlipX((value) => !value)} className={`editor-crop-modal__tool ${sourceCropFlipX ? "is-active" : ""}`} title="Flip horizontally"><FlipHorizontal size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => setSourceCropFlipY((value) => !value)} className={`editor-crop-modal__tool ${sourceCropFlipY ? "is-active" : ""}`} title="Flip vertically"><FlipVertical size={15} aria-hidden="true" /></button>
                    <button
                      type="button"
                      onClick={() => setSourceCropBackgroundRemoval((current) => current?.enabled ? undefined : { enabled: true, tolerance: DEFAULT_BACKGROUND_TOLERANCE })}
                      className={`editor-crop-modal__tool ${sourceCropBackgroundRemoval?.enabled ? "is-active" : ""}`}
                      title="Remove background"
                      aria-label="Remove background"
                    ><Scissors size={15} aria-hidden="true" /></button>
                    <label className="editor-crop-modal__slider">
                      Straighten
                      <input type="range" min={-15} max={15} step={0.25} value={sourceCropStraighten} onChange={(event) => { setSourceCropStraighten(Number(event.target.value)); setSourceCropArea(null); }} />
                      <span>{sourceCropStraighten}°</span>
                    </label>
                    {sourceCropBackgroundRemoval?.enabled ? (
                      <label className="editor-crop-modal__slider">
                        Background
                        <input
                          type="range"
                          min={Math.round(MIN_BACKGROUND_TOLERANCE * 100)}
                          max={Math.round(MAX_BACKGROUND_TOLERANCE * 100)}
                          step={1}
                          value={Math.round(sourceCropBackgroundRemoval.tolerance * 100)}
                          onChange={(event) => setSourceCropBackgroundRemoval({ enabled: true, tolerance: clampBackgroundTolerance(Number(event.target.value) / 100) })}
                        />
                        <span>{Math.round(sourceCropBackgroundRemoval.tolerance * 100)}%</span>
                      </label>
                    ) : null}
                    <label className="editor-crop-modal__guides">
                      Guides
                      <select value={sourceCropGuide} onChange={(event) => setSourceCropGuide(event.target.value as typeof sourceCropGuide)}>
                        <option value="thirds">Thirds</option><option value="golden">Golden ratio</option><option value="center">Center</option><option value="grid">Grid</option><option value="none">None</option>
                      </select>
                    </label>
                    <QuickCropControls variant="toolbar" disabled={!cropSourcePreviewUrl || sourceCropAutoPending || sourceCropPending} onSelect={applyQuickSourceCrop} />
                  </div>
                  <div className="editor-crop-modal__actions">
                    <button type="button" onClick={() => void autoTrimSourceCrop()} disabled={!cropSourcePreviewUrl || sourceCropAutoPending || sourceCropPending} className="editor-crop-modal__btn">
                      {sourceCropAutoPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
                      Detect
                    </button>
                    <button type="button" onClick={() => selectFullSourceCrop()} disabled={!cropSourcePreviewUrl} className="editor-crop-modal__btn"><Maximize2 size={15} aria-hidden="true" />Full</button>
                    <button type="button" onClick={closeSourceCrop} className="editor-crop-modal__btn">Cancel</button>
                    <button type="button" onClick={applySourceCrop} disabled={!sourceCropArea || sourceCropPending} className="editor-crop-modal__btn editor-crop-modal__btn--primary">
                      {sourceCropPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                      Apply crop
                    </button>
                  </div>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
