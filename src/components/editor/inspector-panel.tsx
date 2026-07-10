"use client";

import { type ReactNode, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowLeftRight,
  Check,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Grid3X3,
  ImageIcon,
  Loader2,
  Lock,
  MousePointer2,
  Palette,
  PenTool,
  Printer,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Ruler,
  Search,
  Settings2,
  Shapes,
  Unlock,
  Upload,
} from "lucide-react";
import {
  InspectorCheckbox,
  InspectorColorControl,
  InspectorGroup,
  InspectorRow,
  InspectorSelect,
  inspectorControlClass,
} from "./inspector-controls";
import {
  CollapsibleSection,
  ColorPresetField,
  ColorSummary,
  InspectorSegmented,
  NumberField,
  ShapePreviewSvg,
} from "./inspector/inspector-fields";
import { FeatureSuggestions } from "./inspector/feature-suggestions";
import type {
  GraphCellLineSide,
  GraphCellPaint,
  GraphClipartAsset,
  GraphClipartImage,
  GraphSettings,
  GraphShapeDrawing,
  GraphShapeKind,
  GraphSourceImage,
  MeasurementUnit,
} from "@/lib/types";
import type { FillRegion } from "@/lib/canvas/processor";
import {
  DEFAULT_CELL_SIZE_CM,
  DEFAULT_PRINT_PAPER_SIZE,
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
  PRESET_GRAPH_LINE_COLORS,
  PRINT_HORIZONTAL_ALIGNMENT_KEYS,
  PRINT_ORIENTATION_KEYS,
  PRINT_PAPER_SIZE_KEYS,
  PRINT_PAPER_SIZES,
  PRINT_VERTICAL_ALIGNMENT_KEYS,
  TRANSPARENT_FILL_COLOR,
} from "@/lib/graph-paper";
import {
  CELL_LINE_SIDE_KEYS,
  CELL_LINE_SIDE_LABELS,
  CLIPART_ACCEPT,
  GENERATED_SHAPE_FILL_MODE_LABELS,
  GENERATED_SHAPE_KIND_KEYS,
  GRAPH_SHAPE_KIND_LABELS,
  GRAPH_LINE_LAYER_LABELS,
  GRID_NUMBER_PLACEMENT_LABELS,
  MAX_CANVAS_DIMENSION,
  MEASUREMENT_UNIT_LABELS,
  PRINT_HORIZONTAL_ALIGNMENT_LABELS,
  PRINT_ORIENTATION_LABELS,
  PRINT_VERTICAL_ALIGNMENT_LABELS,
  type GeneratedShapeKind,
  type ShapeFillMode,
} from "./inspector/inspector-constants";

type InspectorTab = "graph" | "source" | "draw" | "palette";
type DrawTab = "shape" | "clipart";
type CollapsibleKey = "parameters" | "drawing" | "outline" | "fill" | "selectedFill" | "graphLines";
type SourceStatus = { ready: boolean; previewUrl: string | null; error: string | null };

function paperSizeOptionLabel(key: GraphSettings["printPaperSize"]) {
  const paper = PRINT_PAPER_SIZES[key] ?? PRINT_PAPER_SIZES[DEFAULT_PRINT_PAPER_SIZE];
  return `${paper.label} (${Math.round(paper.widthCm * 10)} x ${Math.round(paper.heightCm * 10)} mm)`;
}

export interface InspectorPanelProps {
  settings: GraphSettings;
  sourceStatus: Record<string, SourceStatus>;
  inspectorTab: InspectorTab;
  setInspectorTab: (tab: InspectorTab) => void;
  drawTab: DrawTab;
  setDrawTab: (tab: DrawTab) => void;
  collapsedSections: Record<CollapsibleKey, boolean>;
  toggleSection: (section: CollapsibleKey) => void;
  isPaletteSectionExpanded: boolean;

  selectedSource: GraphSourceImage | null;
  selectedClipartAsset: GraphClipartAsset | null;
  setSelectedClipartAssetId: (id: string | null) => void;
  selectedShapeLayer: GraphShapeDrawing | null;
  selectedClipartLayer: GraphClipartImage | null;
  selectedCellLayer: GraphCellPaint | null;
  selectedFillRegion: FillRegion | null;
  selectedFillRegionColor: string;

  filteredClipartAssets: GraphClipartAsset[];
  uploadingCliparts: boolean;
  deletingClipartAssetId: string | null;
  clipartSearch: string;
  setClipartSearch: (value: string) => void;
  placingClipartAssetId: string | null;
  placingGeneratedShape: boolean;

  draftShapeKind: GeneratedShapeKind;
  draftShapeWidthCm: number;
  draftShapeHeightCm: number;
  draftShapeFillMode: ShapeFillMode;
  draftShapeSides: GraphCellLineSide[];
  draftShapeStrokeWidth: number;
  draftShapeStrokeColor: string;
  draftShapeFillColor: string;
  draftShapePreviewDimensions: { width: number; height: number };
  setDraftShapeKind: (kind: GeneratedShapeKind) => void;
  setDraftShapeWidthCm: (value: number) => void;
  setDraftShapeHeightCm: (value: number) => void;
  setDraftShapeFillMode: (mode: ShapeFillMode) => void;
  setDraftShapeSide: (side: GraphCellLineSide, checked: boolean) => void;
  setDraftShapeStrokeWidth: (value: number) => void;
  setDraftShapeStrokeColor: (value: string) => void;
  setDraftShapeFillColor: (value: string) => void;
  setPlacingGeneratedShape: (value: boolean | ((prev: boolean) => boolean)) => void;
  setPlacingClipartAssetId: (value: string | null | ((prev: string | null) => string | null)) => void;

  draftClipartWidthCm: number;
  draftClipartHeightCm: number;
  draftClipartStrokeWidth: number;
  draftClipartStrokeColor: string;
  draftClipartFillColor: string;
  draftClipartPreviewDimensions: { width: number; height: number };
  setDraftClipartWidthCm: (value: number) => void;
  setDraftClipartHeightCm: (value: number) => void;
  setDraftClipartStrokeWidth: (value: number) => void;
  setDraftClipartStrokeColor: (value: string) => void;
  setDraftClipartFillColor: (value: string) => void;

  handleGeneratedShapeDragStart: (event: ReactDragEvent<HTMLElement>) => void;
  handleClipartDragStart: (assetId: string) => (event: ReactDragEvent<HTMLElement>) => void;
  clearGraphShapes: () => void;
  uploadClipartAssets: (files: File[] | FileList) => Promise<boolean> | boolean;
  deleteClipartAsset: (id: string) => Promise<boolean> | boolean;
  setGeneratedImagesCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;

  renderShapeAdvanced: (shape: GraphShapeDrawing) => ReactNode;
  renderClipartAdvanced: (clipart: GraphClipartImage) => ReactNode;
  renderCellAdvanced: (cell: GraphCellPaint) => ReactNode;

  updateSourceImage: (id: string, patch: Partial<GraphSourceImage>) => void;
  updateSourceImagePhysicalWidthCm: (id: string, value: number) => void;
  updateSourceImagePhysicalHeight: (id: string, value: number) => void;
  rotateSourceImage: (id: string, direction: 1 | -1) => void;
  flipSourceImage: (id: string, axis: "x" | "y") => void;
  sourcePhysicalWidthCm: (source: GraphSourceImage) => number;
  sourcePhysicalHeight: (source: GraphSourceImage) => number;
  sourceRightPadding: (source: GraphSourceImage) => number;
  sourceBottomPadding: (source: GraphSourceImage) => number;
  toggleSourceLock: (id: string) => void;
  toggleSourceVisibility: (id: string) => void;

  updateSetting: <K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) => void;
  updateMeasurementUnit: (unit: MeasurementUnit) => void;
  updateImageWidthCm: (value: number) => void;
  updateImageHeightPhysical: (value: number) => void;
  updateGraphPhysicalHeight: (value: number) => void;
  updateOutlineColor: (color: string) => void;
  updateFillRegionColor: (id: string, color: string) => void;
  resetFillRegionColor: (id: string) => void;

  setSettingsWithHistory: (updater: GraphSettings | ((current: GraphSettings) => GraphSettings)) => void;
  editorDefaultGraphSettings: (current: GraphSettings) => GraphSettings;
  setSelectedFillRegionId: (id: string | null) => void;
  setFloatingPalette: (value: null) => void;
  setCopiedFillColor: (value: string | null) => void;

  imageWidthCm: number;
  imageHeightCm: number;
  printWidthCm: number;
  printHeightCm: number;
  roundMeasure: (value: number) => number;
  cmToUnit: (value: number, unit: MeasurementUnit) => number;

  clipartAssetAspect: (asset?: GraphClipartAsset | null) => number;

  beginPanelResize: (event: ReactPointerEvent<HTMLElement>, side: "left" | "right") => void;
  resizePanel: (event: ReactPointerEvent<HTMLElement>) => void;
  endPanelResize: (event: ReactPointerEvent<HTMLElement>) => void;
  resizingPanelSide: "left" | "right" | null;
}

const inspectorTabs: { id: InspectorTab; label: string; icon: ReactNode }[] = [
  { id: "graph", label: "Graph", icon: <Grid3X3 size={14} aria-hidden="true" /> },
  { id: "source", label: "Source", icon: <ImageIcon size={14} aria-hidden="true" /> },
  { id: "draw", label: "Draw", icon: <PenTool size={14} aria-hidden="true" /> },
  { id: "palette", label: "Palette", icon: <Palette size={14} aria-hidden="true" /> },
];

const drawTabs: { id: DrawTab; label: string }[] = [
  { id: "shape", label: "Shape" },
  { id: "clipart", label: "Clipart" },
];

function shapeUsesSingleSize(kind: GraphShapeKind) {
  return kind === "square" || kind === "circle";
}

function shapeSupportsSides(kind: GraphShapeKind) {
  return kind === "square" || kind === "rectangle";
}

function InspectorTabBar({
  value,
  onChange,
}: {
  value: InspectorTab;
  onChange: (tab: InspectorTab) => void;
}) {
  return (
    <div
      className="inline-flex w-full rounded-full border border-[#d7dde5] bg-[#f8fafc] p-1"
      role="tablist"
      aria-label="Inspector tabs"
    >
      {inspectorTabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] font-bold transition-colors ${
              active
                ? "bg-[#008c8f] text-white shadow-sm"
                : "text-[#475467] hover:bg-white hover:text-[#101828]"
            }`}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function InspectorPanel(props: InspectorPanelProps) {
  const {
    settings,
    sourceStatus,
    inspectorTab,
    setInspectorTab,
    drawTab,
    setDrawTab,
    collapsedSections,
    toggleSection,
    isPaletteSectionExpanded,
    selectedSource,
    selectedClipartAsset,
    setSelectedClipartAssetId,
    selectedShapeLayer,
    selectedClipartLayer,
    selectedCellLayer,
    selectedFillRegion,
    selectedFillRegionColor,
    filteredClipartAssets,
    uploadingCliparts,
    deletingClipartAssetId,
    clipartSearch,
    setClipartSearch,
    placingClipartAssetId,
    placingGeneratedShape,
    draftShapeKind,
    draftShapeWidthCm,
    draftShapeHeightCm,
    draftShapeFillMode,
    draftShapeSides,
    draftShapeStrokeWidth,
    draftShapeStrokeColor,
    draftShapeFillColor,
    draftShapePreviewDimensions,
    setDraftShapeKind,
    setDraftShapeWidthCm,
    setDraftShapeHeightCm,
    setDraftShapeFillMode,
    setDraftShapeSide,
    setDraftShapeStrokeWidth,
    setDraftShapeStrokeColor,
    setDraftShapeFillColor,
    setPlacingGeneratedShape,
    setPlacingClipartAssetId,
    draftClipartWidthCm,
    draftClipartHeightCm,
    draftClipartStrokeWidth,
    draftClipartStrokeColor,
    draftClipartFillColor,
    draftClipartPreviewDimensions,
    setDraftClipartWidthCm,
    setDraftClipartHeightCm,
    setDraftClipartStrokeWidth,
    setDraftClipartStrokeColor,
    setDraftClipartFillColor,
    handleGeneratedShapeDragStart,
    handleClipartDragStart,
    clearGraphShapes,
    uploadClipartAssets,
    deleteClipartAsset,
    setGeneratedImagesCollapsed,
    renderShapeAdvanced,
    renderClipartAdvanced,
    renderCellAdvanced,
    updateSourceImage,
    updateSourceImagePhysicalWidthCm,
    updateSourceImagePhysicalHeight,
    rotateSourceImage,
    flipSourceImage,
    sourcePhysicalWidthCm,
    sourcePhysicalHeight,
    sourceRightPadding,
    sourceBottomPadding,
    toggleSourceLock,
    toggleSourceVisibility,
    updateSetting,
    updateMeasurementUnit,
    updateImageWidthCm,
    updateImageHeightPhysical,
    updateGraphPhysicalHeight,
    updateOutlineColor,
    updateFillRegionColor,
    resetFillRegionColor,
    setSettingsWithHistory,
    editorDefaultGraphSettings,
    setSelectedFillRegionId,
    setFloatingPalette,
    setCopiedFillColor,
    imageWidthCm,
    imageHeightCm,
    printWidthCm,
    printHeightCm,
    roundMeasure,
    cmToUnit,
    clipartAssetAspect,
    beginPanelResize,
    resizePanel,
    endPanelResize,
    resizingPanelSide,
  } = props;

  const selectedSourceInspector = (
    <div className={inspectorTab === "source" ? "space-y-4" : "hidden"}>
      {selectedSource ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#d7dde5] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#101828]">{selectedSource.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      selectedSource.locked
                        ? "bg-amber-50 text-amber-700"
                        : "bg-teal-50 text-[#007174]"
                    }`}
                  >
                    {selectedSource.locked ? "Locked" : "Editable"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      sourceStatus[selectedSource.id]?.ready
                        ? "bg-green-50 text-green-700"
                        : sourceStatus[selectedSource.id]?.error
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {sourceStatus[selectedSource.id]?.ready
                      ? "Ready"
                      : sourceStatus[selectedSource.id]?.error || "Loading"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleSourceLock(selectedSource.id)}
                  className="ui-btn-icon"
                  title={selectedSource.locked ? "Unlock layer" : "Lock layer"}
                >
                  {selectedSource.locked ? <Unlock size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSourceVisibility(selectedSource.id)}
                  className="ui-btn-icon"
                  title={selectedSource.visible ? "Hide layer" : "Show layer"}
                >
                  {selectedSource.visible ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#d7dde5] bg-white p-4 shadow-sm">
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
                  onChange={(event) =>
                    updateSourceImage(selectedSource.id, {
                      measurementUnit: event.target.value as GraphSettings["measurementUnit"],
                    })
                  }
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
          </div>

          <div className="grid grid-cols-4 gap-2">
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
        </div>
      ) : (
        <div className="grid min-h-32 place-items-center rounded-xl border border-[#d7dde5] bg-white p-4 text-center shadow-sm">
          <div className="space-y-2 text-slate-500">
            <MousePointer2 size={28} className="mx-auto text-[#98a2b3]" aria-hidden="true" />
            <p className="text-sm">Select a source layer to edit its size, padding, transform, and detection settings.</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <aside
      className="editor-panel relative space-y-0"
      style={{
        overflowY: inspectorTab === "palette" && !isPaletteSectionExpanded ? "hidden" : "auto",
        overflowX: "hidden",
      }}
    >
      <div className="space-y-4 p-3">
        <div className="rounded-xl border border-[#d7dde5] bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[#008c8f]">
                <Settings2 size={16} aria-hidden="true" />
              </span>
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#101828]">Inspector</h2>
            </div>
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
          <InspectorTabBar value={inspectorTab} onChange={setInspectorTab} />
        </div>

        {selectedSourceInspector}

        {inspectorTab === "graph" ? (
          <div className="space-y-4">
            <InspectorGroup title="Dimensions" icon={<Ruler size={15} aria-hidden="true" />}>
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <NumberField
                  label="Width (cells)"
                  value={settings.graphWidth}
                  min={1}
                  max={Math.floor(MAX_CANVAS_DIMENSION / GRAPH_MAJOR_CELL_PIXELS)}
                  inputClassName={inspectorControlClass}
                  onChange={(value) => updateSetting("graphWidth", value)}
                />
                <NumberField
                  label="Height (cells)"
                  value={settings.graphHeight}
                  min={1}
                  max={Math.floor(MAX_CANVAS_DIMENSION / GRAPH_MAJOR_CELL_PIXELS)}
                  inputClassName={inspectorControlClass}
                  onChange={(value) => updateSetting("graphHeight", value)}
                />
              </div>
              <InspectorCheckbox label="Square cells" checked disabled />
            </InspectorGroup>

            <InspectorGroup title="Measurements" icon={<Ruler size={15} aria-hidden="true" />}>
              <InspectorRow label="Units">
                <InspectorSelect
                  label="Measurement units"
                  value={settings.measurementUnit}
                  options={[
                    { value: "cm", label: "Centimeters" },
                    { value: "in", label: "Inches" },
                  ]}
                  onChange={(value) => updateMeasurementUnit(value as GraphSettings["measurementUnit"])}
                />
              </InspectorRow>
              <InspectorRow label="Cell size">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_58px] gap-2">
                  <input value={(settings.cellSizeCm * 10).toFixed(2)} readOnly className={inspectorControlClass} aria-label="Cell size millimeters" />
                  <span className="grid h-9 place-items-center rounded-md border border-[#d7dde5] bg-[#f8fafc] text-[12px] font-semibold text-[#475467]">mm</span>
                </div>
              </InspectorRow>
              <p className="text-[12px] leading-5 text-[#667085]">
                {settings.graphWidth.toFixed(0)} x {settings.graphHeight.toFixed(0)} cells = {imageWidthCm} x {imageHeightCm} cm
              </p>
              <InspectorRow label={`Graph height`}>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_58px] gap-2">
                  <NumberField
                    label={`Graph height (${MEASUREMENT_UNIT_LABELS[settings.measurementUnit]})`}
                    value={roundMeasure(cmToUnit(settings.graphHeight * settings.cellSizeCm, settings.measurementUnit))}
                    min={0.01}
                    max={roundMeasure(cmToUnit(Math.floor(MAX_CANVAS_DIMENSION / GRAPH_MAJOR_CELL_PIXELS) * DEFAULT_CELL_SIZE_CM, settings.measurementUnit))}
                    step={0.1}
                    allowDecimalInput
                    hideLabel
                    inputClassName={inspectorControlClass}
                    onChange={updateGraphPhysicalHeight}
                  />
                  <span className="grid h-9 place-items-center rounded-md border border-[#d7dde5] bg-[#f8fafc] text-[12px] font-semibold text-[#475467]">
                    {MEASUREMENT_UNIT_LABELS[settings.measurementUnit]}
                  </span>
                </div>
              </InspectorRow>
              <InspectorRow label="Artwork">
                <div className="grid min-w-0 grid-cols-2 gap-2">
                  <NumberField
                    label="Artwork width (CM)"
                    value={imageWidthCm}
                    min={0.01}
                    max={imageWidthCm}
                    step={0.1}
                    allowDecimalInput
                    inputClassName={inspectorControlClass}
                    onChange={updateImageWidthCm}
                  />
                  <NumberField
                    label={`Artwork height (${MEASUREMENT_UNIT_LABELS[settings.measurementUnit]})`}
                    value={roundMeasure(cmToUnit(settings.imageHeight * settings.cellSizeCm, settings.measurementUnit))}
                    min={0.01}
                    max={roundMeasure(cmToUnit(settings.graphHeight * settings.cellSizeCm, settings.measurementUnit))}
                    step={0.1}
                    allowDecimalInput
                    inputClassName={inspectorControlClass}
                    onChange={updateImageHeightPhysical}
                  />
                </div>
              </InspectorRow>
            </InspectorGroup>

            <InspectorGroup title="Grid Lines" icon={<Grid3X3 size={15} aria-hidden="true" />}>
              <InspectorRow label="Line color">
                <InspectorColorControl label="Graph line color" value={settings.gridLineColor} onChange={(value) => updateSetting("gridLineColor", value)} />
              </InspectorRow>
              <InspectorRow label="Layer">
                <InspectorSelect
                  label="Graph lines layer"
                  value={settings.gridLineLayer}
                  options={GRAPH_LINE_LAYER_KEYS.map((key) => ({ value: key, label: GRAPH_LINE_LAYER_LABELS[key] }))}
                  onChange={(value) => updateSetting("gridLineLayer", value as GraphSettings["gridLineLayer"])}
                />
              </InspectorRow>
              <div className="grid grid-cols-2 gap-2">
                <InspectorCheckbox label="Show numbers" checked={settings.showNumbers} onChange={(checked) => updateSetting("showNumbers", checked)} />
                <InspectorCheckbox label="Show guides" checked={settings.showPageBreaks} onChange={(checked) => updateSetting("showPageBreaks", checked)} />
              </div>
              <InspectorRow label="Numbers">
                <InspectorSelect
                  label="Grid number position"
                  value={settings.gridNumberPlacement}
                  options={(["inside", "outside"] as const).map((key) => ({ value: key, label: GRID_NUMBER_PLACEMENT_LABELS[key] }))}
                  onChange={(value) => updateSetting("gridNumberPlacement", value as GraphSettings["gridNumberPlacement"])}
                />
              </InspectorRow>
            </InspectorGroup>

            <InspectorGroup title="Print Settings" icon={<Printer size={15} aria-hidden="true" />}>
              <InspectorRow label="Paper size">
                <InspectorSelect
                  label="Print paper size"
                  value={settings.printPaperSize}
                  options={PRINT_PAPER_SIZE_KEYS.map((key) => ({ value: key, label: paperSizeOptionLabel(key) }))}
                  onChange={(value) => updateSetting("printPaperSize", value as GraphSettings["printPaperSize"])}
                />
              </InspectorRow>
              <InspectorRow label="Orientation">
                <InspectorSegmented
                  label="Print orientation"
                  value={settings.printOrientation}
                  options={PRINT_ORIENTATION_KEYS.map((key) => ({ value: key, label: PRINT_ORIENTATION_LABELS[key] }))}
                  onChange={(value) => updateSetting("printOrientation", value as GraphSettings["printOrientation"])}
                />
              </InspectorRow>
              <InspectorRow label="Margin">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_58px] gap-2">
                  <NumberField
                    label="Page margin"
                    value={settings.pageMargin ?? 24}
                    min={0}
                    max={400}
                    wholeStep
                    hideLabel
                    inputClassName={inspectorControlClass}
                    onChange={(value) => updateSetting("pageMargin", Math.round(value))}
                  />
                  <span className="grid h-9 place-items-center rounded-md border border-[#d7dde5] bg-[#f8fafc] text-[12px] font-semibold text-[#475467]">px</span>
                </div>
              </InspectorRow>
              <InspectorRow label="Align">
                <div className="grid min-w-0 grid-cols-2 gap-2">
                  <InspectorSelect
                    label="Horizontal print alignment"
                    value={settings.printHorizontalAlignment}
                    options={PRINT_HORIZONTAL_ALIGNMENT_KEYS.map((key) => ({ value: key, label: PRINT_HORIZONTAL_ALIGNMENT_LABELS[key] }))}
                    onChange={(value) => updateSetting("printHorizontalAlignment", value as GraphSettings["printHorizontalAlignment"])}
                  />
                  <InspectorSelect
                    label="Vertical print alignment"
                    value={settings.printVerticalAlignment}
                    options={PRINT_VERTICAL_ALIGNMENT_KEYS.map((key) => ({ value: key, label: PRINT_VERTICAL_ALIGNMENT_LABELS[key] }))}
                    onChange={(value) => updateSetting("printVerticalAlignment", value as GraphSettings["printVerticalAlignment"])}
                  />
                </div>
              </InspectorRow>
            </InspectorGroup>

            <div className="min-w-0 overflow-hidden rounded-xl border border-[#d7dde5] bg-[#f8fafc] p-3 shadow-sm">
              <p className="break-words font-mono text-[11px] leading-5 text-[#667085]">
                Graph {imageWidthCm} x {imageHeightCm} cm / Print {printWidthCm} x {printHeightCm} cm / 1 cell {settings.cellSizeCm} cm / artwork {settings.imageWidth} x {settings.imageHeight} cells / {GRAPH_LINE_LAYER_LABELS[settings.gridLineLayer].toLowerCase()} grid / {settings.showNumbers ? `${GRID_NUMBER_PLACEMENT_LABELS[settings.gridNumberPlacement].toLowerCase()} numbers` : "numbers off"} / {settings.showPageBreaks ? "page guides on" : "page guides off"} / {PRINT_HORIZONTAL_ALIGNMENT_LABELS[settings.printHorizontalAlignment].toLowerCase()} {PRINT_VERTICAL_ALIGNMENT_LABELS[settings.printVerticalAlignment].toLowerCase()}
              </p>
            </div>
          </div>
        ) : null}

        {inspectorTab === "draw" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#d7dde5] bg-white p-1.5 shadow-sm">
              <InspectorSegmented
                label="Draw mode"
                value={drawTab}
                options={drawTabs.map((tab) => ({ value: tab.id, label: tab.label }))}
                onChange={(value) => setDrawTab(value as DrawTab)}
              />
            </div>

            {drawTab === "shape" ? (
              <InspectorGroup title="Shape Generator" icon={<Shapes size={15} aria-hidden="true" />}>
                <div className="grid grid-cols-2 gap-2">
                  {GENERATED_SHAPE_KIND_KEYS.map((kind) => (
                    <button
                      key={`draft-shape-${kind}`}
                      type="button"
                      onClick={() => {
                        setDraftShapeKind(kind);
                        if (shapeUsesSingleSize(kind)) setDraftShapeHeightCm(draftShapeWidthCm);
                      }}
                      className={`h-9 rounded-md border text-xs font-semibold ${draftShapeKind === kind ? "border-[#008c8f] bg-teal-50 text-[#007174]" : "border-[#d7dde5] bg-white text-[#344054]"}`}
                    >
                      {GRAPH_SHAPE_KIND_LABELS[kind]}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label={shapeUsesSingleSize(draftShapeKind) ? "Size (CM)" : "Width (CM)"}
                    value={draftShapeWidthCm}
                    min={0.01}
                    max={1000}
                    step={0.1}
                    allowDecimalInput
                    inputClassName={inspectorControlClass}
                    onChange={(value) => {
                      setDraftShapeWidthCm(value);
                      if (shapeUsesSingleSize(draftShapeKind)) setDraftShapeHeightCm(value);
                    }}
                  />
                  <NumberField
                    label={shapeUsesSingleSize(draftShapeKind) ? "Size (CM)" : "Height (CM)"}
                    value={shapeUsesSingleSize(draftShapeKind) ? draftShapeWidthCm : draftShapeHeightCm}
                    min={0.01}
                    max={1000}
                    step={0.1}
                    allowDecimalInput
                    inputClassName={inspectorControlClass}
                    disabled={shapeUsesSingleSize(draftShapeKind)}
                    onChange={setDraftShapeHeightCm}
                  />
                </div>

                <InspectorSegmented
                  label="Shape type"
                  value={draftShapeFillMode}
                  options={(["outline", "filled"] as ShapeFillMode[]).map((mode) => ({ value: mode, label: GENERATED_SHAPE_FILL_MODE_LABELS[mode] }))}
                  onChange={(value) => setDraftShapeFillMode(value as ShapeFillMode)}
                />

                {draftShapeFillMode === "outline" && shapeSupportsSides(draftShapeKind) ? (
                  <div className="grid grid-cols-4 gap-1">
                    {CELL_LINE_SIDE_KEYS.map((side) => (
                      <label key={`draft-side-${side}`} className="flex h-9 items-center gap-1.5 rounded-md border border-[#d7dde5] bg-white px-2 text-[11px] font-semibold text-[#344054]">
                        <input
                          type="checkbox"
                          checked={draftShapeSides.includes(side)}
                          onChange={(event) => setDraftShapeSide(side, event.target.checked)}
                          className="h-4 w-4 accent-[#008c8f]"
                        />
                        {CELL_LINE_SIDE_LABELS[side]}
                      </label>
                    ))}
                  </div>
                ) : null}

                <NumberField label="Stroke width" value={draftShapeStrokeWidth} min={1} max={24} inputClassName={inspectorControlClass} onChange={(value) => setDraftShapeStrokeWidth(Math.round(value))} />
                <ColorPresetField label="Stroke color" value={draftShapeStrokeColor} onChange={setDraftShapeStrokeColor} />
                {draftShapeFillMode === "filled" ? <ColorPresetField label="Fill color" value={draftShapeFillColor} onChange={setDraftShapeFillColor} allowTransparent /> : null}

                <div className="overflow-hidden rounded-xl border border-[#d7dde5] bg-[#f8fafc] shadow-sm">
                  <div
                    draggable
                    onDragStart={handleGeneratedShapeDragStart}
                    onDragEnd={() => setPlacingGeneratedShape(false)}
                    className="grid h-36 cursor-grab place-items-center bg-white p-3 active:cursor-grabbing"
                    title="Drag to canvas"
                  >
                    <ShapePreviewSvg
                      kind={draftShapeKind}
                      sides={shapeSupportsSides(draftShapeKind) ? draftShapeSides : CELL_LINE_SIDE_KEYS}
                      fillColor={draftShapeFillMode === "filled" ? draftShapeFillColor : TRANSPARENT_FILL_COLOR}
                      strokeColor={draftShapeStrokeColor}
                      strokeWidth={draftShapeStrokeWidth}
                      widthCells={draftShapePreviewDimensions.width}
                      heightCells={draftShapePreviewDimensions.height}
                      className="h-full max-h-28 w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-[#e8edf2] p-2">
                    <button
                      type="button"
                      onClick={() => setPlacingGeneratedShape((value) => !value)}
                      className={`h-9 rounded-md border text-xs font-semibold ${placingGeneratedShape ? "border-[#008c8f] bg-[#008c8f] text-white" : "border-[#d7dde5] bg-white text-[#344054]"}`}
                    >
                      Place on canvas
                    </button>
                    <button type="button" onClick={clearGraphShapes} disabled={!settings.graphShapes.length} className="h-9 rounded-md border border-[#d7dde5] bg-white text-xs font-semibold text-[#344054] disabled:opacity-45">
                      Clear generated
                    </button>
                  </div>
                </div>
              </InspectorGroup>
            ) : null}

            {drawTab === "clipart" ? (
              <InspectorGroup title="Clipart Library" icon={<ImageIcon size={15} aria-hidden="true" />}>
                <label className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#d7dde5] bg-white text-sm font-semibold text-[#344054] hover:bg-[#f8fafc] ${uploadingCliparts ? "opacity-60" : ""}`}>
                  {uploadingCliparts ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
                  Upload cliparts
                  <input
                    type="file"
                    accept={CLIPART_ACCEPT}
                    multiple
                    disabled={uploadingCliparts}
                    className="sr-only"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      if (files.length) void uploadClipartAssets(files);
                    }}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-slate-500">Search clipart by name</span>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a2b3]" aria-hidden="true" />
                    <input
                      type="text"
                      value={clipartSearch}
                      onChange={(event) => setClipartSearch(event.target.value)}
                      placeholder="Search clipart"
                      className="h-10 w-full rounded-md border border-[var(--line)] bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-[#008c8f] focus:ring-2 focus:ring-teal-100"
                    />
                  </div>
                </label>

                {settings.clipartAssets.length ? (
                  filteredClipartAssets.length ? (
                    <div className="grid max-h-44 gap-1 overflow-y-auto rounded-md border border-[#d7dde5] bg-white p-1">
                      {filteredClipartAssets.map((asset) => {
                        const selected = selectedClipartAsset?.id === asset.id;
                        const previewUrl = asset.url ?? asset.dataUrl ?? null;
                        return (
                          <button
                            key={`clipart-asset-${asset.id}`}
                            type="button"
                            onClick={() => {
                              setSelectedClipartAssetId(asset.id);
                              const aspect = clipartAssetAspect(asset);
                              if (draftClipartHeightCm === draftClipartWidthCm) setDraftClipartHeightCm(roundMeasure(draftClipartWidthCm / aspect));
                            }}
                            className={`grid min-h-14 grid-cols-[44px_minmax(0,1fr)_24px] items-center gap-2 rounded px-2 py-1.5 text-left ${selected ? "bg-[#ecfeff] text-[#0f766e]" : "hover:bg-[#f8fafc]"}`}
                          >
                            {previewUrl ? (
                              <img src={previewUrl} alt="" className="h-11 w-11 rounded border border-[#d7dde5] bg-white object-contain p-1" />
                            ) : (
                              <span className="grid h-11 w-11 place-items-center rounded border border-[#d7dde5] bg-[#f8fafc] text-[#98a2b3]">
                                <ImageIcon size={15} aria-hidden="true" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-semibold text-[#101828]">{asset.name}</span>
                              <span className="block truncate text-[11px] text-[#667085]">{asset.width} x {asset.height}</span>
                            </span>
                            {selected ? <Check size={16} aria-hidden="true" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-[#cfd7df] bg-[#f8fafc] px-3 py-5 text-center text-xs font-medium text-[#667085]">
                      No cliparts match &quot;{clipartSearch}&quot;
                    </div>
                  )
                ) : (
                  <div className="rounded-md border border-dashed border-[#cfd7df] bg-[#f8fafc] px-3 py-5 text-center text-xs font-medium text-[#667085]">
                    Upload cliparts to reuse in this project.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Width (CM)"
                    value={draftClipartWidthCm}
                    min={0.01}
                    max={1000}
                    step={0.1}
                    allowDecimalInput
                    inputClassName={inspectorControlClass}
                    onChange={(value) => {
                      const aspect = clipartAssetAspect();
                      setDraftClipartWidthCm(value);
                      setDraftClipartHeightCm(roundMeasure(value / aspect));
                    }}
                  />
                  <NumberField
                    label="Height (CM)"
                    value={draftClipartHeightCm}
                    min={0.01}
                    max={1000}
                    step={0.1}
                    allowDecimalInput
                    inputClassName={inspectorControlClass}
                    onChange={setDraftClipartHeightCm}
                  />
                </div>
                <NumberField label="Line size" value={draftClipartStrokeWidth} min={1} max={24} inputClassName={inspectorControlClass} onChange={(value) => setDraftClipartStrokeWidth(Math.round(value))} />
                <ColorPresetField label="Stroke color" value={draftClipartStrokeColor} onChange={setDraftClipartStrokeColor} />
                <ColorPresetField label="Fill color" value={draftClipartFillColor} onChange={setDraftClipartFillColor} allowTransparent />

                <div className="overflow-hidden rounded-xl border border-[#d7dde5] bg-[#f8fafc] shadow-sm">
                  <div
                    draggable={Boolean(selectedClipartAsset)}
                    onDragStart={selectedClipartAsset ? handleClipartDragStart(selectedClipartAsset.id) : undefined}
                    onDragEnd={() => setPlacingClipartAssetId(null)}
                    className={`grid h-36 place-items-center bg-white p-3 ${selectedClipartAsset ? "cursor-grab active:cursor-grabbing" : "text-[#98a2b3]"}`}
                    title={selectedClipartAsset ? "Drag to canvas" : "Upload or select a clipart"}
                  >
                    {selectedClipartAsset?.url || selectedClipartAsset?.dataUrl ? (
                      <div
                        className="grid h-full max-h-28 w-full place-items-center overflow-hidden rounded border bg-[#f8fafc] p-2"
                        style={{ borderColor: draftClipartStrokeColor }}
                      >
                        <img
                          src={selectedClipartAsset.url ?? selectedClipartAsset.dataUrl ?? ""}
                          alt=""
                          className="h-full w-full max-h-24 max-w-full object-contain"
                          style={{
                            aspectRatio: `${Math.max(0.01, draftClipartPreviewDimensions.width)} / ${Math.max(0.01, draftClipartPreviewDimensions.height)}`,
                          }}
                        />
                      </div>
                    ) : (
                      <ImageIcon size={28} aria-hidden="true" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-[#e8edf2] p-2">
                    <button
                      type="button"
                      onClick={() => selectedClipartAsset && setPlacingClipartAssetId((value) => (value === selectedClipartAsset.id ? null : selectedClipartAsset.id))}
                      disabled={!selectedClipartAsset}
                      className={`h-9 rounded-md border text-xs font-semibold disabled:opacity-45 ${placingClipartAssetId === selectedClipartAsset?.id ? "border-[#008c8f] bg-[#008c8f] text-white" : "border-[#d7dde5] bg-white text-[#344054]"}`}
                    >
                      Place clipart
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedClipartAsset) void deleteClipartAsset(selectedClipartAsset.id);
                      }}
                      disabled={!selectedClipartAsset || deletingClipartAssetId !== null}
                      className="h-9 rounded-md border border-[#d7dde5] bg-white text-xs font-semibold text-[#b42318] disabled:opacity-45"
                    >
                      {selectedClipartAsset && deletingClipartAssetId === selectedClipartAsset.id ? <Loader2 size={14} className="animate-spin" /> : "Delete clipart"}
                    </button>
                    <button type="button" onClick={() => setGeneratedImagesCollapsed(false)} disabled={!settings.clipartImages.length} className="h-9 rounded-md border border-[#d7dde5] bg-white text-xs font-semibold text-[#344054] disabled:opacity-45">
                      Show placed
                    </button>
                  </div>
                </div>
              </InspectorGroup>
            ) : null}

            {drawTab === "shape" && selectedShapeLayer ? (
              <InspectorGroup title="Selected Generated Image" icon={<MousePointer2 size={15} aria-hidden="true" />}>
                <div className="rounded-md border border-[#d7dde5] bg-white">{renderShapeAdvanced(selectedShapeLayer)}</div>
              </InspectorGroup>
            ) : null}
            {drawTab === "clipart" && selectedClipartLayer ? (
              <InspectorGroup title="Selected Clipart Image" icon={<MousePointer2 size={15} aria-hidden="true" />}>
                <div className="rounded-md border border-[#d7dde5] bg-white">{renderClipartAdvanced(selectedClipartLayer)}</div>
              </InspectorGroup>
            ) : null}
            {selectedCellLayer ? (
              <InspectorGroup title="Selected Cell Paint" icon={<MousePointer2 size={15} aria-hidden="true" />}>
                <div className="rounded-md border border-[#d7dde5] bg-white">{renderCellAdvanced(selectedCellLayer)}</div>
              </InspectorGroup>
            ) : null}
          </div>
        ) : null}

        <div className={inspectorTab === "palette" ? "space-y-4" : "hidden"}>
          <InspectorGroup title="Palette" icon={<Palette size={15} aria-hidden="true" />}>
            <CollapsibleSection title="Outline" summary={<ColorSummary value={settings.outlineColor} />} open={!collapsedSections.outline} onToggle={() => toggleSection("outline")}>
              <ColorPresetField label="Outline" value={settings.outlineColor} onChange={updateOutlineColor} />
            </CollapsibleSection>

            <CollapsibleSection title="Default fill" summary={<ColorSummary value={settings.fillColor} />} open={!collapsedSections.fill} onToggle={() => toggleSection("fill")}>
              <ColorPresetField label="Default fill" value={settings.fillColor} onChange={(value) => updateSetting("fillColor", value)} allowTransparent />
            </CollapsibleSection>

            {selectedFillRegion ? (
              <CollapsibleSection title={`Selected fill ${selectedFillRegion.id}`} summary={<ColorSummary value={selectedFillRegionColor} />} open={!collapsedSections.selectedFill} onToggle={() => toggleSection("selectedFill")}>
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
                <ColorPresetField label="Section fill" value={selectedFillRegionColor} onChange={(value) => updateFillRegionColor(selectedFillRegion.id, value)} allowTransparent />
              </CollapsibleSection>
            ) : null}

            <CollapsibleSection title="Graph lines" summary={<ColorSummary value={settings.gridLineColor} />} open={!collapsedSections.graphLines} onToggle={() => toggleSection("graphLines")}>
              <ColorPresetField label="Graph lines" value={settings.gridLineColor} colors={PRESET_GRAPH_LINE_COLORS} onChange={(value) => updateSetting("gridLineColor", value)} />
            </CollapsibleSection>
          </InspectorGroup>
        </div>

        <FeatureSuggestions />
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
        <span
          className="absolute top-1/2 left-1.5 h-[50vh] w-px -translate-y-1/2 bg-slate-200 opacity-0 transition-colors transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-hover:bg-[var(--teal)]"
          aria-hidden="true"
        />
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
}
