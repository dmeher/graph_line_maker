"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import {
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
  Loader2,
  Maximize2,
  Pipette,
  Printer,
  RefreshCw,
  Save,
  Settings2,
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
import { ManualCropper } from "@/components/projects/manual-cropper";
import { cropCanvasToFile, fullCrop, type CropPixels } from "@/lib/canvas/crop";
import { exportCanvasAsPDF, exportCanvasAsPNG, exportSettingsAsJSON, printCanvas } from "@/lib/canvas/exports";
import { loadImageToCanvas, pixelateImageWithWorker, resizeImage, type FillRegion } from "@/lib/canvas/processor";
import { ALLOWED_IMAGE_LABEL, IMAGE_ACCEPT, MAX_UPLOAD_BYTES, isAllowedImageFile, isPdfFile } from "@/lib/constants";
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
import type { GraphSettings, PaletteColor, Project } from "@/lib/types";
import { bytesToSize } from "@/lib/utils/format";

type MobileTab = "source" | "canvas" | "controls";
type Notice = { tone: "ok" | "error" | "info"; text: string };
type CollapsibleKey = "parameters" | "outline" | "fill" | "selectedFill" | "graphLines";
type FloatingPalette = { regionId: string; x: number; y: number } | null;
type SettingsHistory = {
  undo: GraphSettings[];
  redo: GraphSettings[];
};
type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  canvasWidth: number;
  canvasHeight: number;
  rectWidth: number;
  rectHeight: number;
  historyRecorded: boolean;
};

const MAX_CANVAS_DIMENSION = 6000;
const MAX_SETTINGS_HISTORY = 80;
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

async function canvasToObjectUrl(canvas: HTMLCanvasElement) {
  return URL.createObjectURL(await canvasToBlob(canvas));
}

function clampImageOffset(value: number) {
  return Math.max(-MAX_CANVAS_DIMENSION, Math.min(MAX_CANVAS_DIMENSION, Math.round(value)));
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

function normalizeFillRegions(value: GraphSettings["fillRegions"] | undefined) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([regionId, color]) => /^\d+$/.test(regionId) && isFillColor(color)));
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  inputMin,
  allowDecimalInput = false,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  inputMin?: number;
  allowDecimalInput?: boolean;
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

    if (disabled) {
      setDraftValue(String(value));
      return;
    }

    const clamped = Math.max(min, Math.min(max, parsed));
    onChange(clamped);
    setDraftValue(String(clamped));
  }

  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        type="number"
        inputMode={allowDecimalInput || step < 1 ? "decimal" : "numeric"}
        min={inputMin ?? min}
        max={max}
        step={step}
        disabled={disabled}
        value={draftValue}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          commitDraft();
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          const parsed = parseDraft(nextValue);
          setDraftValue(nextValue);
          if (disabled) return;
          if (parsed === null || parsed < min || parsed > max) return;
          onChange(parsed);
        }}
        className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
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
    <div className="grid gap-2">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className={`grid gap-1.5 ${colors.length <= 7 ? "grid-cols-7" : "grid-cols-10"}`}>
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
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[var(--line)] pt-3 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-slate-950"
        aria-expanded={open}
      >
        <span>{title}</span>
        {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
      </button>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </section>
  );
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
  const cellSizeCm = Math.max(0.05, Math.min(100, Number(settings.cellSizeCm || DEFAULT_CELL_SIZE_CM)));
  const printPaperSize = isPrintPaperSize(settings.printPaperSize) ? settings.printPaperSize : DEFAULT_PRINT_PAPER_SIZE;
  const printOrientation = isPrintOrientation(settings.printOrientation) ? settings.printOrientation : DEFAULT_PRINT_ORIENTATION;
  const printHorizontalAlignment = isPrintHorizontalAlignment(settings.printHorizontalAlignment)
    ? settings.printHorizontalAlignment
    : DEFAULT_PRINT_HORIZONTAL_ALIGNMENT;
  const printVerticalAlignment = isPrintVerticalAlignment(settings.printVerticalAlignment)
    ? settings.printVerticalAlignment
    : DEFAULT_PRINT_VERTICAL_ALIGNMENT;
  const legacyPaddingCells = Math.max(0, Number(settings.imagePadding ?? 0) / GRAPH_MAJOR_CELL_PIXELS);
  const imageWidth = clampImageCells(settings.imageWidth, graphWidth, Math.max(0.01, graphWidth - legacyPaddingCells * 2));
  const imageHeight = clampImageCells(settings.imageHeight, graphHeight, Math.max(0.01, graphHeight - legacyPaddingCells * 2));
  const imagePadding = 0;
  const outputWidth = graphWidth * GRAPH_MAJOR_CELL_PIXELS;
  const outputHeight = graphHeight * GRAPH_MAJOR_CELL_PIXELS;
  const fillRegions = normalizeFillRegions(settings.fillRegions);

  return {
    ...settings,
    graphWidth,
    graphHeight,
    cellWidth: GRAPH_MAJOR_CELL_PIXELS,
    cellHeight: GRAPH_MAJOR_CELL_PIXELS,
    cellSizeCm,
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
    imageLineThickness,
    sourceFillThreshold,
    sourceFillMinStrokePixels,
    strokeGapClosePixels,
    gridLineColor,
    gridLineLayer,
    imageWidth,
    imageHeight,
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
    printPaperSize: DEFAULT_PRINT_PAPER_SIZE,
    printOrientation: DEFAULT_PRINT_ORIENTATION,
    printHorizontalAlignment: DEFAULT_PRINT_HORIZONTAL_ALIGNMENT,
    printVerticalAlignment: DEFAULT_PRINT_VERTICAL_ALIGNMENT,
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
    imageWidth: DEFAULT_IMAGE_WIDTH_CELLS,
    imageHeight: DEFAULT_IMAGE_HEIGHT_CELLS,
    imagePadding: 0,
    imageOffsetX: 0,
    imageOffsetY: 0,
  });
}

function areSettingsEqual(a: GraphSettings, b: GraphSettings) {
  return JSON.stringify(a) === JSON.stringify(b);
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

export function EditorClient({ project }: { project: Project }) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [settings, setSettings] = useState<GraphSettings>(() => deriveGraphSettings(project.settings));
  const [palette, setPalette] = useState<PaletteColor[]>(project.palettes);
  const [sourceUrl, setSourceUrl] = useState(project.originalImageUrl ?? null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState(project.originalImagePath?.split("/").pop() ?? "Original image");
  const [sourceReady, setSourceReady] = useState(false);
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
  const [sourcePanelCollapsed, setSourcePanelCollapsed] = useState(false);
  const [settingsPanelCollapsed, setSettingsPanelCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<CollapsibleKey, boolean>>({
    parameters: false,
    outline: false,
    fill: false,
    selectedFill: false,
    graphLines: false,
  });
  const [floatingPalette, setFloatingPalette] = useState<FloatingPalette>(null);
  const [copiedFillColor, setCopiedFillColor] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("canvas");
  const [isPending, startTransition] = useTransition();
  const settingsRef = useRef(settings);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const sourcePreviewObjectUrlRef = useRef<string | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const fillRegionMapRef = useRef<Uint16Array | null>(null);
  const settingsHistoryRef = useRef<SettingsHistory>({ undo: [], redo: [] });

  const filename = useMemo(() => slug(title), [title]);
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

  function updateOneCellWidth(value: number) {
    updateSetting("cellSizeCm", roundCm(value));
  }

  function updateTenCellWidth(value: number) {
    updateSetting("cellSizeCm", roundCm(value / 10));
  }

  function updateImageWidthCells(value: number) {
    updateSetting("imageWidth", value);
  }

  function updateImageHeightCells(value: number) {
    updateSetting("imageHeight", value);
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
    selectFillRegionFromPointer(event, true);

    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: settings.imageOffsetX,
      startOffsetY: settings.imageOffsetY,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      rectWidth: rect.width,
      rectHeight: rect.height,
      historyRecorded: false,
    };
    setIsDraggingGraph(true);
  }

  function dragGraph(event: ReactPointerEvent<HTMLCanvasElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      if (!showOriginal && event.buttons === 1) selectFillRegionFromPointer(event);
      return;
    }
    event.preventDefault();

    const deltaX = ((event.clientX - dragState.startClientX) * dragState.canvasWidth) / dragState.rectWidth;
    const deltaY = ((event.clientY - dragState.startClientY) * dragState.canvasHeight) / dragState.rectHeight;
    const imageOffsetX = clampImageOffset(dragState.startOffsetX + deltaX);
    const imageOffsetY = clampImageOffset(dragState.startOffsetY + deltaY);

    setSettings((current) => {
      if (current.imageOffsetX === imageOffsetX && current.imageOffsetY === imageOffsetY) return current;
      if (!dragState.historyRecorded) {
        pushUndoSettings(current);
        dragState.historyRecorded = true;
      }
      const next = deriveGraphSettings({
        ...current,
        imageOffsetX,
        imageOffsetY,
      });
      settingsRef.current = next;
      return next;
    });
  }

  function endGraphDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
    setIsDraggingGraph(false);
  }

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const drawPreview = useCallback((canvas: HTMLCanvasElement) => {
    const preview = previewCanvasRef.current;
    if (!preview) return;
    preview.width = canvas.width;
    preview.height = canvas.height;
    const context = preview.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, preview.width, preview.height);
    context.drawImage(canvas, 0, 0);
  }, []);

  useEffect(() => {
    if (!sourceUrl) return;
    let cancelled = false;
    const sourceIsPdf = isPdfFile({ name: sourceName });
    setSourceReady(false);
    setSourceCropMode(false);
    setSourceCropArea(null);
    setFillRegions([]);
    setSelectedFillRegionId(null);
    setFloatingPalette(null);
    setCopiedFillColor(null);
    fillRegionMapRef.current = null;
    if (sourcePreviewObjectUrlRef.current) {
      URL.revokeObjectURL(sourcePreviewObjectUrlRef.current);
      sourcePreviewObjectUrlRef.current = null;
    }
    setSourcePreviewUrl(null);
    setNotice({ tone: "info", text: sourceIsPdf ? "Rendering PDF source..." : "Loading source file..." });

    void loadImageToCanvas(sourceUrl, sourceName)
      .then((canvas) => resizeImage(canvas, 2200, 2200))
      .then(async (canvas) => {
        const previewUrl = await canvasToObjectUrl(canvas);
        if (cancelled) {
          URL.revokeObjectURL(previewUrl);
          return;
        }
        sourcePreviewObjectUrlRef.current = previewUrl;
        sourceCanvasRef.current = canvas;
        setSourcePreviewUrl(previewUrl);
        settingsHistoryRef.current = { undo: [], redo: [] };
        setSettings((current) => {
          const next = deriveGraphSettings(current);
          settingsRef.current = next;
          return next;
        });
        setSourceReady(true);
        setNotice(null);
      })
      .catch(() => {
        if (!cancelled) setNotice({ tone: "error", text: "Unable to load the source file." });
      });

    return () => {
      cancelled = true;
    };
  }, [sourceName, sourceUrl]);

  useEffect(() => {
    if (!sourceReady || !sourceCanvasRef.current) return;
    let cancelled = false;
    setProcessing(true);

    const timer = window.setTimeout(() => {
      void pixelateImageWithWorker(sourceCanvasRef.current as HTMLCanvasElement, settings, [])
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
          if (!cancelled) {
            setProcessing(false);
            setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to process image." });
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [drawPreview, settings, sourceReady]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [restoreSettingsHistory, selectedFillRegion, selectedFillRegionColor]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (sourcePreviewObjectUrlRef.current) URL.revokeObjectURL(sourcePreviewObjectUrlRef.current);
    };
  }, []);

  async function uploadOriginal(file: File, successText = "Source file updated.") {
    setNotice(null);
    if (!isAllowedImageFile(file)) {
      setNotice({ tone: "error", text: `Use ${ALLOWED_IMAGE_LABEL} files only.` });
      return false;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setNotice({ tone: "error", text: `File must be ${bytesToSize(MAX_UPLOAD_BYTES)} or smaller.` });
      return false;
    }

    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(`/api/projects/${project.id}/original-image`, {
      method: "PUT",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice({ tone: "error", text: payload.message || "Unable to upload source file." });
      return false;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setSourceUrl(objectUrlRef.current);
    setSourceName(file.name);
    settingsHistoryRef.current = { undo: [], redo: [] };
    setSettings((current) => {
      const next = deriveGraphSettings({
        ...current,
        fillRegions: {},
        imageOffsetX: 0,
        imageOffsetY: 0,
      });
      settingsRef.current = next;
      return next;
    });
    setNotice({ tone: "ok", text: successText });
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
      const ok = await uploadOriginal(croppedFile, "Source crop applied.");
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

  function saveProject() {
    const canvas = processedCanvasRef.current;
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
          setNotice({ tone: "error", text: result.message });
          return;
        }

        await saveProcessedImage();
        setNotice({ tone: "ok", text: "Project saved." });
      } catch (error) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to save project." });
      }
    });
  }

  function exportPNG() {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    exportCanvasAsPNG(canvas, `${filename}.png`);
  }

  function exportPDF() {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    void exportCanvasAsPDF(canvas, `${filename}.pdf`, settings);
  }

  function printGraph() {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    try {
      printCanvas(canvas, settings, title || "Graph pixel chart");
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to open print view." });
    }
  }

  function exportJSON() {
    exportSettingsAsJSON(`${filename}.json`, settings, palette, {
      projectId: project.id,
      title,
      description,
      sourceName,
      exportedAt: new Date().toISOString(),
    });
  }

  const sourcePanel = (
    <aside className="space-y-4 rounded-md border border-[var(--line)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
          <ImageIcon size={16} aria-hidden="true" />
          Source
        </h2>
        <div className="flex gap-2">
          {sourcePreviewUrl ? (
            sourceCropMode ? (
              <>
                <button
                  type="button"
                  onClick={applySourceCrop}
                  disabled={!sourceCropArea || sourceCropPending}
                  className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  title="Apply crop"
                >
                  {sourceCropPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={selectFullSourceCrop}
                  className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50"
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
                  className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50"
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
                className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50"
                title="Crop source"
              >
                <Crop size={15} aria-hidden="true" />
              </button>
            )
          ) : null}
          <label className="grid h-9 w-9 cursor-pointer place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50" title="Upload source file">
            <Upload size={15} aria-hidden="true" />
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadOriginal(file);
              }}
            />
          </label>
        </div>
      </div>

      <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3">
        <p className="truncate text-sm font-semibold text-slate-950">{sourceName}</p>
        <p className="mt-1 text-xs text-slate-500">{sourceReady ? "Ready for conversion" : "Waiting for source file"}</p>
      </div>

      {sourcePreviewUrl ? (
        <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--panel)]">
          {sourceCropMode ? (
            <ManualCropper imageUrl={sourcePreviewUrl} crop={sourceCropArea} onCropChange={setSourceCropArea} className="h-[min(75vh,42rem)] p-3" />
          ) : (
            <img src={sourcePreviewUrl} alt="" className="max-h-72 w-full object-contain p-3" />
          )}
        </div>
      ) : (
        <div className="grid min-h-48 place-items-center rounded-md border border-dashed border-slate-300 bg-[var(--panel)] text-center text-sm text-slate-500">
          Upload a source file
        </div>
      )}

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
    </aside>
  );

  const imageWidthCm = roundCm(settings.graphWidth * settings.cellSizeCm);
  const imageHeightCm = roundCm(settings.graphHeight * settings.cellSizeCm);
  const printWidthCm = imageWidthCm;
  const printHeightCm = imageHeightCm;
  const desktopGridColumns =
    sourcePanelCollapsed && settingsPanelCollapsed
      ? "lg:grid-cols-[minmax(0,1fr)]"
      : sourcePanelCollapsed
        ? "lg:grid-cols-[minmax(0,1fr)_360px]"
        : settingsPanelCollapsed
          ? "lg:grid-cols-[320px_minmax(0,1fr)]"
          : "lg:grid-cols-[320px_minmax(0,1fr)_360px]";
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

  const settingsPanel = (
    <aside className="space-y-4 rounded-md border border-[var(--line)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Settings2 size={16} aria-hidden="true" />
          Controls
        </h2>
        <button
          type="button"
          onClick={() => {
            setSettingsWithHistory((current) => editorDefaultGraphSettings(current));
            setSelectedFillRegionId(null);
            setFloatingPalette(null);
            setCopiedFillColor(null);
          }}
          className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] text-slate-600 hover:bg-slate-50"
          title="Reset settings"
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-4">
        <CollapsibleSection title="Parameters" open={!collapsedSections.parameters} onToggle={() => toggleSection("parameters")}>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Width (cells)" value={settings.graphWidth} min={1} max={Math.floor(MAX_CANVAS_DIMENSION / GRAPH_MAJOR_CELL_PIXELS)} onChange={(value) => updateSetting("graphWidth", value)} />
            <NumberField label="Height (cells)" value={settings.graphHeight} min={1} max={Math.floor(MAX_CANVAS_DIMENSION / GRAPH_MAJOR_CELL_PIXELS)} onChange={(value) => updateSetting("graphHeight", value)} />
            <NumberField label="1 cell width (cm)" value={settings.cellSizeCm} min={0.05} max={100} step={0.01} onChange={updateOneCellWidth} />
            <NumberField label="10 cells width (cm)" value={roundCm(settings.cellSizeCm * 10)} min={0.5} max={1000} step={0.01} onChange={updateTenCellWidth} />
            <NumberField label="Image width (cells)" value={settings.imageWidth} min={0.01} inputMin={0} max={settings.graphWidth} step={1} allowDecimalInput onChange={updateImageWidthCells} />
            <NumberField label="Image height (cells)" value={settings.imageHeight} min={0.01} inputMin={0} max={settings.graphHeight} step={1} allowDecimalInput onChange={updateImageHeightCells} />
            <NumberField label="Image line size" value={settings.imageLineThickness} min={MIN_IMAGE_LINE_THICKNESS} max={MAX_IMAGE_LINE_THICKNESS} step={0.01} onChange={(value) => updateSetting("imageLineThickness", value)} />
            <NumberField label="Fill detection" value={settings.sourceFillThreshold} min={MIN_SOURCE_FILL_THRESHOLD} max={MAX_SOURCE_FILL_THRESHOLD} step={0.01} onChange={(value) => updateSetting("sourceFillThreshold", value)} />
            <NumberField label="Fill width" value={settings.sourceFillMinStrokePixels} min={MIN_SOURCE_FILL_MIN_STROKE_PIXELS} max={MAX_SOURCE_FILL_MIN_STROKE_PIXELS} onChange={(value) => updateSetting("sourceFillMinStrokePixels", value)} />
            <NumberField label="Gap closing" value={settings.strokeGapClosePixels} min={MIN_STROKE_GAP_CLOSE_PIXELS} max={MAX_STROKE_GAP_CLOSE_PIXELS} onChange={(value) => updateSetting("strokeGapClosePixels", value)} />
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Print paper</span>
              <select
                value={settings.printPaperSize}
                onChange={(event) => updateSetting("printPaperSize", event.target.value as GraphSettings["printPaperSize"])}
                className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                {PRINT_PAPER_SIZE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PRINT_PAPER_SIZES[key].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Orientation</span>
              <select
                value={settings.printOrientation}
                onChange={(event) => updateSetting("printOrientation", event.target.value as GraphSettings["printOrientation"])}
                className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                {PRINT_ORIENTATION_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PRINT_ORIENTATION_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Horizontal align</span>
              <select
                value={settings.printHorizontalAlignment}
                onChange={(event) => updateSetting("printHorizontalAlignment", event.target.value as GraphSettings["printHorizontalAlignment"])}
                className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                {PRINT_HORIZONTAL_ALIGNMENT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PRINT_HORIZONTAL_ALIGNMENT_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Vertical align</span>
              <select
                value={settings.printVerticalAlignment}
                onChange={(event) => updateSetting("printVerticalAlignment", event.target.value as GraphSettings["printVerticalAlignment"])}
                className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              >
                {PRINT_VERTICAL_ALIGNMENT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PRINT_VERTICAL_ALIGNMENT_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="font-mono text-xs text-slate-600">
              Image {imageWidthCm} x {imageHeightCm} cm / Print {printWidthCm} x {printHeightCm} cm / 1 cell {settings.cellSizeCm} cm / 10 cells {roundCm(settings.cellSizeCm * 10)} cm / artwork {settings.imageWidth} x {settings.imageHeight} cells / line {settings.imageLineThickness}x / fill {settings.sourceFillThreshold} / fill width {settings.sourceFillMinStrokePixels}px / gap {settings.strokeGapClosePixels}px / {PRINT_HORIZONTAL_ALIGNMENT_LABELS[settings.printHorizontalAlignment].toLowerCase()} {PRINT_VERTICAL_ALIGNMENT_LABELS[settings.printVerticalAlignment].toLowerCase()}
            </p>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Outline" open={!collapsedSections.outline} onToggle={() => toggleSection("outline")}>
          <ColorPresetField label="Outline" value={settings.outlineColor} onChange={updateOutlineColor} />
        </CollapsibleSection>

        <CollapsibleSection title="Default fill" open={!collapsedSections.fill} onToggle={() => toggleSection("fill")}>
          <ColorPresetField label="Default fill" value={settings.fillColor} onChange={(value) => updateSetting("fillColor", value)} allowTransparent />
        </CollapsibleSection>

        {selectedFillRegion ? (
          <CollapsibleSection title={`Selected fill ${selectedFillRegion.id}`} open={!collapsedSections.selectedFill} onToggle={() => toggleSection("selectedFill")}>
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

        <CollapsibleSection title="Graph lines" open={!collapsedSections.graphLines} onToggle={() => toggleSection("graphLines")}>
          <ColorPresetField
            label="Graph lines"
            value={settings.gridLineColor}
            colors={PRESET_GRAPH_LINE_COLORS}
            onChange={(value) => updateSetting("gridLineColor", value)}
          />
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Graph lines layer</span>
            <select
              value={settings.gridLineLayer}
              onChange={(event) => updateSetting("gridLineLayer", event.target.value as GraphSettings["gridLineLayer"])}
              className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
            >
              {GRAPH_LINE_LAYER_KEYS.map((key) => (
                <option key={key} value={key}>
                  {GRAPH_LINE_LAYER_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
        </CollapsibleSection>
      </div>
    </aside>
  );

  const exportPanel = (
    <div className="rounded-md border border-[var(--line)] bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Download size={16} aria-hidden="true" />
          Export
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportPNG} className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] px-3 text-sm font-semibold text-slate-700">
            <ImageDown size={16} aria-hidden="true" />
            PNG
          </button>
          <button type="button" onClick={exportPDF} className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] px-3 text-sm font-semibold text-slate-700">
            <FileText size={16} aria-hidden="true" />
            PDF
          </button>
          <button type="button" onClick={printGraph} className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] px-3 text-sm font-semibold text-slate-700">
            <Printer size={16} aria-hidden="true" />
            Print
          </button>
          <button type="button" onClick={exportJSON} className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] px-3 text-sm font-semibold text-slate-700">
            <FileJson size={16} aria-hidden="true" />
            JSON
          </button>
        </div>
      </div>
    </div>
  );

  const canvasPanel = (
    <section className="min-w-0 space-y-4">
      {exportPanel}

      <div className="rounded-md border border-[var(--line)] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-slate-950">{title || "Untitled project"}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {settings.graphWidth} x {settings.graphHeight} cells
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSourcePanelCollapsed((value) => !value)}
              className="hidden h-10 w-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 lg:grid"
              title={sourcePanelCollapsed ? "Show source panel" : "Hide source panel"}
            >
              {sourcePanelCollapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => setSettingsPanelCollapsed((value) => !value)}
              className="hidden h-10 w-10 place-items-center rounded-md border border-[var(--line)] text-slate-600 lg:grid"
              title={settingsPanelCollapsed ? "Show controls panel" : "Hide controls panel"}
            >
              {settingsPanelCollapsed ? <PanelRightOpen size={16} aria-hidden="true" /> : <PanelRightClose size={16} aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => setShowOriginal((value) => !value)} className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)] text-slate-600" title={showOriginal ? "Show processed" : "Show original"}>
              {showOriginal ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => setZoom((value) => Math.max(0.35, value - 0.15))} className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)] text-slate-600" title="Zoom out">
              <ZoomOut size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setZoom((value) => Math.min(2.5, value + 0.15))} className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)] text-slate-600" title="Zoom in">
              <ZoomIn size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={saveProject} disabled={isPending || processing || !title.trim()} className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white disabled:opacity-60">
              {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              Save
            </button>
          </div>
        </div>

        {notice ? (
          <p className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            notice.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : notice.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-600"
          }`}>
            {notice.text}
          </p>
        ) : null}

        <div className="relative mt-3 grid min-h-[520px] place-items-center overflow-auto rounded-md border border-[var(--line)] bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8fafc_75%),linear-gradient(-45deg,transparent_75%,#f8fafc_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] p-4">
          {processing ? (
            <div className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Processing
            </div>
          ) : null}
          {showOriginal && sourcePreviewUrl ? (
            <img src={sourcePreviewUrl} alt="" className="max-h-full max-w-full object-contain" style={{ transform: `scale(${zoom})` }} />
          ) : (
            <canvas
              ref={previewCanvasRef}
              onPointerDown={beginGraphDrag}
              onPointerMove={dragGraph}
              onPointerUp={endGraphDrag}
              onPointerCancel={endGraphDrag}
              title="Drag to move graph"
              className="max-h-full max-w-full rounded bg-white shadow-sm"
              style={{
                cursor: isDraggingGraph ? "move" : copiedFillColor ? "copy" : "crosshair",
                imageRendering: "auto",
                transform: `scale(${zoom})`,
                transformOrigin: "center",
                touchAction: "none",
              }}
            />
          )}
        </div>
      </div>

    </section>
  );

  return (
    <div className="p-3 sm:p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="text-sm font-semibold text-slate-600 hover:text-[var(--teal)]">
          Back to dashboard
        </Link>
        <span className="hidden text-xs font-semibold text-slate-500 sm:inline">Brevo OTP private workspace</span>
      </div>

      <div className="mb-3 grid grid-cols-3 rounded-md border border-[var(--line)] bg-white p-1 lg:hidden">
        {[
          ["source", "Source"],
          ["canvas", "Canvas"],
          ["controls", "Controls"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMobileTab(value as MobileTab)}
            className={`h-10 rounded text-sm font-semibold ${mobileTab === value ? "bg-teal-50 text-[var(--teal)]" : "text-slate-600"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`grid gap-4 ${desktopGridColumns}`}>
        <div className={`${mobileTab === "source" ? "block" : "hidden"} ${sourcePanelCollapsed ? "lg:hidden" : "lg:block"}`}>{sourcePanel}</div>
        <div className={mobileTab === "canvas" ? "block" : "hidden lg:block"}>{canvasPanel}</div>
        <div className={`${mobileTab === "controls" ? "block" : "hidden"} ${settingsPanelCollapsed ? "lg:hidden" : "lg:block"}`}>{settingsPanel}</div>
      </div>
      {floatingPaletteNode}
    </div>
  );
}
