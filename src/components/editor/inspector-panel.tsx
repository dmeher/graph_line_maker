"use client";

import { type ReactNode, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Grid3X3,
  GripVertical,
  ImageIcon,
  Loader2,
  Lock,
  MousePointer2,
  Palette,
  Printer,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Ruler,
  Search,
  Settings2,
  Shapes,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import {
  InspectorActionStrip,
  InspectorCheckbox,
  InspectorColorControl,
  InspectorFieldGrid,
  InspectorGroup,
  InspectorMetricGrid,
  InspectorModeRail,
  InspectorRow,
  InspectorSelect,
  inspectorControlClass,
} from "./inspector-controls";
import {
  ColorPresetField,
  InspectorDisclosure,
  InspectorSegmented,
  NumberField,
  ShapePreviewSvg,
} from "./inspector/inspector-fields";
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
  PaletteColor,
} from "@/lib/types";
import type { FillRegion } from "@/lib/canvas/processor";
import {
  DEFAULT_CELL_SIZE_CM,
  DEFAULT_PRINT_PAPER_SIZE,
  GRAPH_GRID_LINE_STYLE_KEYS,
  GRAPH_GRID_PATTERN_KEYS,
  GRAPH_LINE_LAYER_KEYS,
  GRAPH_VECTORIZER_FIDELITY_KEYS,
  MAJOR_GRID_EVERY_KEYS,
  MAX_GRAPH_HEIGHT_CELLS,
  MAX_GRAPH_WIDTH_CELLS,
  MAX_VECTORIZER_INK_THRESHOLD,
  MAX_VECTORIZER_SKETCH_REMOVAL,
  MAX_VECTORIZER_LINE_ADJUST,
  MIN_VECTORIZER_INK_THRESHOLD,
  MIN_VECTORIZER_SKETCH_REMOVAL,
  DEFAULT_VECTORIZER_SKETCH_REMOVAL,
  MIN_VECTORIZER_LINE_ADJUST,
  PRESET_GRAPH_LINE_COLORS,
  PRINT_HORIZONTAL_ALIGNMENT_KEYS,
  PRINT_ORIENTATION_KEYS,
  PRINT_PAPER_SIZE_KEYS,
  PRINT_PAPER_SIZES,
  PRINT_VERTICAL_ALIGNMENT_KEYS,
  TRANSPARENT_FILL_COLOR,
  normalizeGraphLineColor,
} from "@/lib/graph-paper";
import {
  CELL_LINE_SIDE_KEYS,
  CELL_LINE_SIDE_LABELS,
  CLIPART_ACCEPT,
  GENERATED_SHAPE_FILL_MODE_LABELS,
  GRAPH_SHAPE_KIND_LABELS,
  GRAPH_LINE_LAYER_LABELS,
  GRID_NUMBER_PLACEMENT_LABELS,
  MEASUREMENT_UNIT_LABELS,
  PRINT_HORIZONTAL_ALIGNMENT_LABELS,
  PRINT_ORIENTATION_LABELS,
  PRINT_VERTICAL_ALIGNMENT_LABELS,
  type GeneratedShapeKind,
  type ShapeFillMode,
} from "./inspector/inspector-constants";

type InspectorTab = "graph" | "source" | "draw" | "palette";
type DrawTab = "shape" | "clipart";
type DrawingTool = "image" | "cell" | "shape" | "background-remover" | "image-eraser" | "lasso";
type CollapsibleKey = "parameters" | "drawing" | "outline" | "fill" | "selectedFill" | "graphLines";
type SourceStatus = { ready: boolean; previewUrl: string | null; error: string | null };

function paperSizeOptionLabel(key: GraphSettings["printPaperSize"]) {
  const paper = PRINT_PAPER_SIZES[key] ?? PRINT_PAPER_SIZES[DEFAULT_PRINT_PAPER_SIZE];
  return `${paper.label} (${Math.round(paper.widthCm * 10)} x ${Math.round(paper.heightCm * 10)} mm)`;
}

export interface InspectorPanelProps {
  settings: GraphSettings;
  palette: PaletteColor[];
  sourceStatus: Record<string, SourceStatus>;
  inspectorTab: InspectorTab;
  setInspectorTab: (tab: InspectorTab) => void;
  drawTab: DrawTab;
  setDrawTab: (tab: DrawTab) => void;
  drawingTool: DrawingTool;
  setDrawingTool: (tool: DrawingTool) => void;
  collapsedSections: Record<CollapsibleKey, boolean>;
  toggleSection: (section: CollapsibleKey) => void;

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
  selectedLayerCount: number;
  selectedLayerBounds: { width: number; height: number } | null;
  selectedLayerLocked: boolean;
  selectedLayerResizeDisabled: boolean;
  selectedLayerHidden: boolean;
  deleteSelectedLayer: () => void;
  toggleSelectedLayerLock: () => void;
  toggleSelectedLayerVisibility: () => void;
  duplicateSelectedLayers: () => void;
  nudgeSelectedLayer: (deltaX: number, deltaY: number) => void;
  resizeSelectedLayerBounds: (size: { width?: number; height?: number }) => void;
  rotateSelectedLayers: (direction: -1 | 1) => void;
  flipSelectedLayers: (axis: "x" | "y") => void;

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
  draftClipartStrokeColor: string;
  draftClipartFillColor: string;
  draftClipartPreviewDimensions: { width: number; height: number };
  setDraftClipartWidthCm: (value: number) => void;
  setDraftClipartHeightCm: (value: number) => void;
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
  applySourceImagePropertiesToAll: (id: string) => void;
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

const inspectorTabs: { id: InspectorTab; label: string; accessibleLabel: string; description: string; icon: ReactNode }[] = [
  { id: "graph", label: "Document", accessibleLabel: "Document", description: "Canvas, grid and print", icon: <Grid3X3 size={18} strokeWidth={2.15} aria-hidden="true" /> },
  { id: "source", label: "Selection", accessibleLabel: "Selection", description: "Selected object properties", icon: <MousePointer2 size={18} strokeWidth={2.15} aria-hidden="true" /> },
  { id: "draw", label: "Create", accessibleLabel: "Create", description: "Shapes and reusable assets", icon: <Shapes size={18} strokeWidth={2.15} aria-hidden="true" /> },
  { id: "palette", label: "Color", accessibleLabel: "Color", description: "Artwork and graph palette", icon: <Palette size={18} strokeWidth={2.15} aria-hidden="true" /> },
];

const drawTabs: { id: DrawTab; label: string }[] = [
  { id: "shape", label: "Shape" },
  { id: "clipart", label: "Clipart" },
];

/**
 * Line and Shape are both the shape tool; they differ only in which kind is
 * armed. Splitting them in the UI keeps open paths (line/arrow) separate from
 * closed shapes, which have Filled mode and per-side toggles that open paths
 * cannot use. Cell remains a first-class drawing choice alongside those
 * object tools, so existing and newly painted cell layers share one context.
 */
type DrawingToolChoice = "image" | "cell" | "line" | "shape" | "lasso";

const drawingToolOptions: { id: DrawingToolChoice; label: string }[] = [
  { id: "image", label: "Select" },
  { id: "cell", label: "Cell" },
  { id: "line", label: "Line" },
  { id: "shape", label: "Shape" },
  { id: "lasso", label: "Lasso" },
];

const OPEN_SHAPE_GENERATOR_KINDS: GeneratedShapeKind[] = ["line", "arrow"];
const CLOSED_SHAPE_GENERATOR_KINDS: GeneratedShapeKind[] = ["square", "rectangle", "circle", "oval", "half-circle"];

function shapeUsesSingleSize(kind: GraphShapeKind) {
  return kind === "square" || kind === "circle";
}

function shapeSupportsSides(kind: GraphShapeKind) {
  return kind === "square" || kind === "rectangle";
}

export function InspectorPanel(props: InspectorPanelProps) {
  const {
    settings,
    palette,
    sourceStatus,
    inspectorTab,
    setInspectorTab,
    drawTab,
    setDrawTab,
    drawingTool,
    setDrawingTool,
    collapsedSections,
    toggleSection,
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
    selectedLayerCount,
    selectedLayerBounds,
    selectedLayerLocked,
    selectedLayerResizeDisabled,
    selectedLayerHidden,
    deleteSelectedLayer,
    toggleSelectedLayerLock,
    toggleSelectedLayerVisibility,
    duplicateSelectedLayers,
    nudgeSelectedLayer,
    resizeSelectedLayerBounds,
    rotateSelectedLayers,
    flipSelectedLayers,
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
    draftClipartStrokeColor,
    draftClipartFillColor,
    draftClipartPreviewDimensions,
    setDraftClipartWidthCm,
    setDraftClipartHeightCm,
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
    applySourceImagePropertiesToAll,
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

  const selectedDrawingName =
    selectedShapeLayer?.name ?? selectedClipartLayer?.name ?? selectedCellLayer?.name ?? null;
  const selectedDrawingKind = selectedShapeLayer
    ? "Shape"
    : selectedClipartLayer
      ? "Clipart"
      : selectedCellLayer
        ? "Cell paint"
        : null;
  const selectedDrawingDimensions = selectedShapeLayer
    ? { width: Math.abs(selectedShapeLayer.width), height: Math.abs(selectedShapeLayer.height) }
    : selectedClipartLayer
      ? { width: Math.abs(selectedClipartLayer.width), height: Math.abs(selectedClipartLayer.height) }
      : selectedCellLayer
        ? { width: Math.abs(selectedCellLayer.width), height: Math.abs(selectedCellLayer.height) }
        : null;

  const selectionInspector = (
    <div
      id="editor-inspector-panel-source"
      role="tabpanel"
      aria-labelledby="editor-inspector-tab-source"
      className={`editor-inspector__tab-panel editor-inspector__tab-panel--selection ${inspectorTab === "source" ? "" : "hidden"}`}
      data-inspector-panel="selection"
    >
      <section
        className="editor-inspector__focus-shelf"
        data-inspector-focus-shelf="selection"
        aria-labelledby="editor-inspector-selection-focus-title"
      >
        {selectedLayerCount > 1 ? (
          <>
            <div className="editor-inspector__selection-identity">
              <div className="min-w-0">
                <span className="editor-inspector__focus-kicker">Multi-selection</span>
                <h3 id="editor-inspector-selection-focus-title">{selectedLayerCount} layers selected</h3>
              </div>
              <InspectorActionStrip label="Selected layer actions">
                <button type="button" onClick={duplicateSelectedLayers} disabled={selectedLayerLocked} className="ui-btn-icon" title="Duplicate selected layers" aria-label="Duplicate selected layers"><Copy size={15} aria-hidden="true" /></button>
                <button type="button" onClick={toggleSelectedLayerVisibility} className="ui-btn-icon" title={selectedLayerHidden ? "Show selected layers" : "Hide selected layers"} aria-label={selectedLayerHidden ? "Show selected layers" : "Hide selected layers"}>{selectedLayerHidden ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}</button>
                <button type="button" onClick={toggleSelectedLayerLock} className="ui-btn-icon" title={selectedLayerLocked ? "Unlock selected layers" : "Lock selected layers"} aria-label={selectedLayerLocked ? "Unlock selected layers" : "Lock selected layers"}>{selectedLayerLocked ? <Unlock size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}</button>
                <button type="button" onClick={deleteSelectedLayer} disabled={selectedLayerLocked} className="ui-btn-icon" title="Delete selected layers" aria-label="Delete selected layers"><Trash2 size={15} aria-hidden="true" /></button>
              </InspectorActionStrip>
            </div>
            {selectedLayerBounds ? (
              <InspectorFieldGrid>
                <NumberField
                  label="Group width"
                  unit="cells"
                  emphasis="primary"
                  value={selectedLayerBounds.width}
                  min={0.25}
                  max={1000}
                  step={0.25}
                  allowDecimalInput
                  disabled={selectedLayerResizeDisabled}
                  onChange={(width) => resizeSelectedLayerBounds({ width })}
                />
                <NumberField
                  label="Group height"
                  unit="cells"
                  emphasis="primary"
                  value={selectedLayerBounds.height}
                  min={0.25}
                  max={1000}
                  step={0.25}
                  allowDecimalInput
                  disabled={selectedLayerResizeDisabled}
                  onChange={(height) => resizeSelectedLayerBounds({ height })}
                />
              </InspectorFieldGrid>
            ) : null}
            <InspectorActionStrip label="Transform selected layers">
              <button type="button" onClick={() => rotateSelectedLayers(-1)} disabled={selectedLayerResizeDisabled} className="ui-btn-icon" title="Rotate selected layers left" aria-label="Rotate selected layers left"><RotateCcw size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => rotateSelectedLayers(1)} disabled={selectedLayerResizeDisabled} className="ui-btn-icon" title="Rotate selected layers right" aria-label="Rotate selected layers right"><RotateCw size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => flipSelectedLayers("x")} disabled={selectedLayerResizeDisabled} className="ui-btn-icon" title="Flip selected layers horizontally" aria-label="Flip selected layers horizontally"><FlipHorizontal size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => flipSelectedLayers("y")} disabled={selectedLayerResizeDisabled} className="ui-btn-icon" title="Flip selected layers vertically" aria-label="Flip selected layers vertically"><FlipVertical size={15} aria-hidden="true" /></button>
            </InspectorActionStrip>
          </>
        ) : selectedSource ? (
          <>
            <div className="editor-inspector__selection-identity">
              <div className="min-w-0">
                <span className="editor-inspector__focus-kicker">Source image</span>
                <h3 id="editor-inspector-selection-focus-title" className="truncate">{selectedSource.name}</h3>
                <p
                  className="editor-inspector__selection-status"
                  data-status={
                    sourceStatus[selectedSource.id]?.ready
                      ? "ready"
                      : sourceStatus[selectedSource.id]?.error
                        ? "error"
                        : "loading"
                  }
                  title={sourceStatus[selectedSource.id]?.error ?? undefined}
                >
                  {sourceStatus[selectedSource.id]?.ready
                    ? "Ready"
                    : sourceStatus[selectedSource.id]?.error
                      ? "Unable to process"
                      : "Processing"}
                </p>
              </div>
              <InspectorActionStrip label="Source actions">
                <button type="button" onClick={duplicateSelectedLayers} disabled={selectedSource.locked} className="ui-btn-icon" title="Duplicate source" aria-label="Duplicate source"><Copy size={15} aria-hidden="true" /></button>
                <button type="button" onClick={() => toggleSourceVisibility(selectedSource.id)} className="ui-btn-icon" title={selectedSource.visible ? "Hide layer" : "Show layer"} aria-label={selectedSource.visible ? "Hide layer" : "Show layer"}>{selectedSource.visible ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}</button>
                <button type="button" onClick={() => toggleSourceLock(selectedSource.id)} className="ui-btn-icon" title={selectedSource.locked ? "Unlock layer" : "Lock layer"} aria-label={selectedSource.locked ? "Unlock layer" : "Lock layer"}>{selectedSource.locked ? <Unlock size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}</button>
                <button type="button" onClick={deleteSelectedLayer} disabled={selectedSource.locked} className="ui-btn-icon" title="Delete source" aria-label="Delete source"><Trash2 size={15} aria-hidden="true" /></button>
              </InspectorActionStrip>
            </div>
            <InspectorFieldGrid className="editor-inspector-primary-grid">
              <NumberField
                label="Width"
                unit="cm"
                emphasis="primary"
                value={sourcePhysicalWidthCm(selectedSource)}
                min={0.01}
                max={1000}
                step={0.1}
                allowDecimalInput
                disabled={selectedSource.locked}
                onChange={(value) => updateSourceImagePhysicalWidthCm(selectedSource.id, value)}
              />
              <NumberField
                label="Height"
                unit={MEASUREMENT_UNIT_LABELS[selectedSource.measurementUnit]}
                emphasis="primary"
                value={sourcePhysicalHeight(selectedSource)}
                min={0.01}
                max={roundMeasure(cmToUnit(1000 * settings.cellSizeCm, selectedSource.measurementUnit))}
                step={0.1}
                allowDecimalInput
                disabled={selectedSource.locked}
                onChange={(value) => updateSourceImagePhysicalHeight(selectedSource.id, value)}
              />
            </InspectorFieldGrid>
            <div className="editor-inspector__focus-footer">
              <InspectorRow label="Height unit" layout="inline">
                <select
                  value={selectedSource.measurementUnit}
                  onChange={(event) =>
                    updateSourceImage(selectedSource.id, {
                      measurementUnit: event.target.value as GraphSettings["measurementUnit"],
                    })
                  }
                  className={inspectorControlClass}
                  aria-label="Source height unit"
                >
                  <option value="cm">Centimeters</option>
                  <option value="in">Inches</option>
                </select>
              </InspectorRow>
              <InspectorActionStrip label="Transform source">
                <button type="button" onClick={() => rotateSourceImage(selectedSource.id, -1)} disabled={selectedSource.locked} className="ui-btn-icon" title="Rotate left" aria-label="Rotate source left"><RotateCcw size={15} aria-hidden="true" /></button>
                <button type="button" onClick={() => rotateSourceImage(selectedSource.id, 1)} disabled={selectedSource.locked} className="ui-btn-icon" title="Rotate right" aria-label="Rotate source right"><RotateCw size={15} aria-hidden="true" /></button>
                <button type="button" onClick={() => flipSourceImage(selectedSource.id, "x")} disabled={selectedSource.locked} className="ui-btn-icon" title="Flip horizontal" aria-label="Flip source horizontally"><FlipHorizontal size={15} aria-hidden="true" /></button>
                <button type="button" onClick={() => flipSourceImage(selectedSource.id, "y")} disabled={selectedSource.locked} className="ui-btn-icon" title="Flip vertical" aria-label="Flip source vertically"><FlipVertical size={15} aria-hidden="true" /></button>
              </InspectorActionStrip>
            </div>
          </>
        ) : selectedDrawingName ? (
          <>
            <div className="editor-inspector__selection-identity">
              <div className="min-w-0">
                <span className="editor-inspector__focus-kicker">{selectedDrawingKind}</span>
                <h3 id="editor-inspector-selection-focus-title" className="truncate">{selectedDrawingName}</h3>
              </div>
              <InspectorActionStrip label="Selected object actions">
                <button type="button" onClick={duplicateSelectedLayers} disabled={selectedLayerLocked} className="ui-btn-icon" title="Duplicate selected object" aria-label="Duplicate selected object"><Copy size={15} aria-hidden="true" /></button>
                <button type="button" onClick={toggleSelectedLayerVisibility} className="ui-btn-icon" title={selectedLayerHidden ? "Show selected object" : "Hide selected object"} aria-label={selectedLayerHidden ? "Show selected object" : "Hide selected object"}>{selectedLayerHidden ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}</button>
                <button type="button" onClick={toggleSelectedLayerLock} className="ui-btn-icon" title={selectedLayerLocked ? "Unlock selected object" : "Lock selected object"} aria-label={selectedLayerLocked ? "Unlock selected object" : "Lock selected object"}>{selectedLayerLocked ? <Unlock size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}</button>
                <button type="button" onClick={deleteSelectedLayer} disabled={selectedLayerLocked} className="ui-btn-icon" title="Delete selected object" aria-label="Delete selected object"><Trash2 size={15} aria-hidden="true" /></button>
              </InspectorActionStrip>
            </div>
            {selectedDrawingDimensions ? (
              <InspectorMetricGrid label="Selected object dimensions">
                <div><dt>Width</dt><dd>{roundMeasure(selectedDrawingDimensions.width)} cells</dd></div>
                <div><dt>Height</dt><dd>{roundMeasure(selectedDrawingDimensions.height)} cells</dd></div>
                <div><dt>State</dt><dd>{selectedLayerHidden ? "Hidden" : "Visible"} / {selectedLayerLocked ? "Locked" : "Editable"}</dd></div>
              </InspectorMetricGrid>
            ) : null}
            <InspectorActionStrip label="Transform selected object">
              <button type="button" onClick={() => rotateSelectedLayers(-1)} disabled={selectedLayerResizeDisabled} className="ui-btn-icon" title="Rotate selected object left" aria-label="Rotate selected object left"><RotateCcw size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => rotateSelectedLayers(1)} disabled={selectedLayerResizeDisabled} className="ui-btn-icon" title="Rotate selected object right" aria-label="Rotate selected object right"><RotateCw size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => flipSelectedLayers("x")} disabled={selectedLayerResizeDisabled} className="ui-btn-icon" title="Flip selected object horizontally" aria-label="Flip selected object horizontally"><FlipHorizontal size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => flipSelectedLayers("y")} disabled={selectedLayerResizeDisabled} className="ui-btn-icon" title="Flip selected object vertically" aria-label="Flip selected object vertically"><FlipVertical size={15} aria-hidden="true" /></button>
            </InspectorActionStrip>
          </>
        ) : (
          <div className="editor-inspector-context-hint">
            <MousePointer2 size={16} aria-hidden="true" />
            <div>
              <h3 id="editor-inspector-selection-focus-title">Nothing selected</h3>
              <p>Select a layer or artwork region to reveal its most useful controls.</p>
            </div>
          </div>
        )}
      </section>

      <div className="editor-inspector__sections">
        {selectedLayerCount > 1 ? (
          <InspectorGroup title="Arrange selection" icon={<Copy size={15} aria-hidden="true" />}>
            <InspectorActionStrip label="Nudge selected layers">
              <button type="button" onClick={() => nudgeSelectedLayer(-1, 0)} aria-label="Nudge selected layers left" className="ui-btn-icon"><ArrowLeft size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => nudgeSelectedLayer(0, -1)} aria-label="Nudge selected layers up" className="ui-btn-icon"><ArrowUp size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => nudgeSelectedLayer(0, 1)} aria-label="Nudge selected layers down" className="ui-btn-icon"><ArrowDown size={15} aria-hidden="true" /></button>
              <button type="button" onClick={() => nudgeSelectedLayer(1, 0)} aria-label="Nudge selected layers right" className="ui-btn-icon"><ArrowRight size={15} aria-hidden="true" /></button>
            </InspectorActionStrip>
            <p className="editor-inspector__hint">Hold Alt while moving to temporarily disable snapping.</p>
          </InspectorGroup>
        ) : selectedSource ? (
          <>
            <InspectorGroup title="Trace" icon={<Settings2 size={15} aria-hidden="true" />}>
              <InspectorFieldGrid>
                <NumberField
                  label="Line adjustment"
                  value={selectedSource.vectorizerLineAdjust}
                  min={MIN_VECTORIZER_LINE_ADJUST}
                  max={MAX_VECTORIZER_LINE_ADJUST}
                  step={0.5}
                  allowDecimalInput
                  disabled={selectedSource.locked}
                  onChange={(value) => updateSourceImage(selectedSource.id, { vectorizerLineAdjust: value })}
                />
                <label className="editor-inspector-field">
                  <span className="editor-inspector-field__label">Fidelity</span>
                  <select
                    value={selectedSource.vectorizerFidelity}
                    disabled={selectedSource.locked}
                    onChange={(event) =>
                      updateSourceImage(selectedSource.id, {
                        vectorizerFidelity: event.target.value as GraphSourceImage["vectorizerFidelity"],
                      })
                    }
                    className={inspectorControlClass}
                  >
                    {GRAPH_VECTORIZER_FIDELITY_KEYS.map((key) => (
                      <option key={key} value={key}>{key === "exact" ? "Exact" : "Smooth"}</option>
                    ))}
                  </select>
                </label>
              </InspectorFieldGrid>
              <InspectorDisclosure title="Trace details" summary={`Ink ${selectedSource.vectorizerInkThreshold}`}>
                <InspectorFieldGrid>
                  <NumberField
                    label="Ink threshold"
                    value={selectedSource.vectorizerInkThreshold}
                    min={MIN_VECTORIZER_INK_THRESHOLD}
                    max={MAX_VECTORIZER_INK_THRESHOLD}
                    step={1}
                    disabled={selectedSource.locked}
                    onChange={(value) => updateSourceImage(selectedSource.id, { vectorizerInkThreshold: Math.round(value) })}
                  />
                  <NumberField
                    label="Remove sketch lines"
                    value={selectedSource.vectorizerSketchRemoval ?? DEFAULT_VECTORIZER_SKETCH_REMOVAL}
                    min={MIN_VECTORIZER_SKETCH_REMOVAL}
                    max={MAX_VECTORIZER_SKETCH_REMOVAL}
                    step={1}
                    disabled={selectedSource.locked}
                    onChange={(value) => updateSourceImage(selectedSource.id, { vectorizerSketchRemoval: Math.round(value) })}
                  />
                </InspectorFieldGrid>
              </InspectorDisclosure>
              <button
                type="button"
                onClick={() => applySourceImagePropertiesToAll(selectedSource.id)}
                className="editor-inspector__wide-action"
                title="Apply this image processing setup to every image"
              >
                <Copy size={14} aria-hidden="true" />
                Apply trace settings to all sources
              </button>
            </InspectorGroup>
            <InspectorGroup title="Placement" icon={<Ruler size={15} aria-hidden="true" />} priority="quiet">
              <InspectorMetricGrid label="Source bounds" className="editor-inspector-bounds">
                <div><dt>Left</dt><dd>{selectedSource.x}</dd></div>
                <div><dt>Top</dt><dd>{selectedSource.y}</dd></div>
                <div><dt>Right</dt><dd>{sourceRightPadding(selectedSource)}</dd></div>
                <div><dt>Bottom</dt><dd>{sourceBottomPadding(selectedSource)}</dd></div>
              </InspectorMetricGrid>
            </InspectorGroup>
          </>
        ) : selectedShapeLayer ? (
          <InspectorGroup title="Shape properties" icon={<Shapes size={15} aria-hidden="true" />}>
            <div className="editor-object-properties">{renderShapeAdvanced(selectedShapeLayer)}</div>
          </InspectorGroup>
        ) : selectedClipartLayer ? (
          <InspectorGroup title="Clipart properties" icon={<ImageIcon size={15} aria-hidden="true" />}>
            <div className="editor-object-properties">{renderClipartAdvanced(selectedClipartLayer)}</div>
          </InspectorGroup>
        ) : selectedCellLayer ? (
          <InspectorGroup title="Cell paint properties" icon={<MousePointer2 size={15} aria-hidden="true" />}>
            <div className="editor-object-properties">{renderCellAdvanced(selectedCellLayer)}</div>
          </InspectorGroup>
        ) : null}
      </div>
    </div>
  );

  const activeInspectorMode = inspectorTabs.find((tab) => tab.id === inspectorTab) ?? inspectorTabs[0];
  const inspectorContextDescription =
    inspectorTab === "source" && selectedLayerCount
      ? `${selectedLayerCount} selected ${selectedLayerCount === 1 ? "layer" : "layers"}`
      : activeInspectorMode.description;

  return (
    <aside
      className="editor-inspector atelier-inspector editor-panel relative space-y-0"
      aria-label="Properties inspector"
      data-editor-region="inspector"
      data-inspector-context={inspectorTab}
    >
      <div className="editor-inspector__content">
        <div className="editor-inspector__layout">
          <InspectorModeRail value={inspectorTab} options={inspectorTabs} onChange={setInspectorTab} />
          <div className="editor-inspector__deck">
            <header className="editor-inspector__context-header" data-inspector-context-heading>
              <div className="editor-inspector__context-copy">
                <span className="editor-inspector__context-kicker">Inspector</span>
                <h2 id="editor-inspector-context-title" className="editor-inspector__context-title">
                  {activeInspectorMode.label}
                </h2>
                <p className="editor-inspector__context-description">{inspectorContextDescription}</p>
              </div>
              {inspectorTab === "graph" ? (
                <div className="editor-inspector__context-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsWithHistory((current) => editorDefaultGraphSettings(current));
                      setSelectedFillRegionId(null);
                      setFloatingPalette(null);
                      setCopiedFillColor(null);
                    }}
                    className="editor-inspector__reset ui-btn-icon"
                    title="Reset document"
                    aria-label="Reset document"
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </header>

            <div className="editor-inspector__body editor-inspector__panel-host">
            {selectionInspector}

          <div
            id="editor-inspector-panel-graph"
            role="tabpanel"
            aria-labelledby="editor-inspector-tab-graph"
            className={`editor-inspector__tab-panel editor-inspector__tab-panel--document ${inspectorTab === "graph" ? "" : "hidden"}`}
            data-inspector-panel="document"
          >
            <section
              className="editor-inspector__focus-shelf"
              data-inspector-focus-shelf="document"
              aria-labelledby="editor-inspector-document-focus-title"
            >
              <div className="editor-inspector__focus-heading">
                <div>
                  <span className="editor-inspector__focus-kicker">Canvas</span>
                  <h3 id="editor-inspector-document-focus-title">Graph dimensions</h3>
                </div>
                <div className="editor-inspector-unit-switch" role="group" aria-label="Measurement units">
                  {(["cm", "in"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      className={settings.measurementUnit === unit ? "is-active" : ""}
                      onClick={() => updateMeasurementUnit(unit)}
                      aria-pressed={settings.measurementUnit === unit}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
              <InspectorFieldGrid className="editor-inspector-primary-grid">
                <NumberField
                  label="Width"
                  unit="cells"
                  emphasis="primary"
                  value={settings.graphWidth}
                  min={1}
                  max={MAX_GRAPH_WIDTH_CELLS}
                  inputClassName={inspectorControlClass}
                  onChange={(value) => updateSetting("graphWidth", value)}
                />
                <NumberField
                  label="Height"
                  unit="cells"
                  emphasis="primary"
                  value={settings.graphHeight}
                  min={1}
                  max={MAX_GRAPH_HEIGHT_CELLS}
                  inputClassName={inspectorControlClass}
                  onChange={(value) => updateSetting("graphHeight", value)}
                />
              </InspectorFieldGrid>
              <InspectorMetricGrid label="Canvas facts" className="editor-inspector-metrics">
                <div className="editor-inspector-metric">
                  <dt>Cell format</dt>
                  <dd>Square</dd>
                </div>
                <div className="editor-inspector-metric">
                  <dt>Scale</dt>
                  <dd>{(settings.cellSizeCm * 10).toFixed(0)} mm / cell</dd>
                </div>
                <div className="editor-inspector-metric">
                  <dt>Graph</dt>
                  <dd>{imageWidthCm} × {imageHeightCm} cm</dd>
                </div>
              </InspectorMetricGrid>
              <p className="editor-inspector-limit-note">
                Maximum {MAX_GRAPH_WIDTH_CELLS} × {MAX_GRAPH_HEIGHT_CELLS} cells
              </p>
            </section>

            <div className="editor-inspector__sections">
            <InspectorGroup title="Physical sizing" icon={<Ruler size={15} aria-hidden="true" />} priority="quiet">
              <InspectorDisclosure
                title="Graph and artwork size"
                summary={`${roundMeasure(cmToUnit(settings.graphHeight * settings.cellSizeCm, settings.measurementUnit))} ${MEASUREMENT_UNIT_LABELS[settings.measurementUnit]} high`}
              >
                <InspectorFieldGrid>
                  <NumberField
                    label="Graph height"
                    unit={MEASUREMENT_UNIT_LABELS[settings.measurementUnit]}
                    value={roundMeasure(cmToUnit(settings.graphHeight * settings.cellSizeCm, settings.measurementUnit))}
                    min={0.01}
                    max={roundMeasure(cmToUnit(MAX_GRAPH_HEIGHT_CELLS * DEFAULT_CELL_SIZE_CM, settings.measurementUnit))}
                    step={0.1}
                    allowDecimalInput
                    inputClassName={inspectorControlClass}
                    onChange={updateGraphPhysicalHeight}
                  />
                  <NumberField
                    label="Artwork width"
                    unit="cm"
                    value={imageWidthCm}
                    min={0.01}
                    max={imageWidthCm}
                    step={0.1}
                    allowDecimalInput
                    inputClassName={inspectorControlClass}
                    onChange={updateImageWidthCm}
                  />
                  <NumberField
                    label="Artwork height"
                    unit={MEASUREMENT_UNIT_LABELS[settings.measurementUnit]}
                    value={roundMeasure(cmToUnit(settings.imageHeight * settings.cellSizeCm, settings.measurementUnit))}
                    min={0.01}
                    max={roundMeasure(cmToUnit(settings.graphHeight * settings.cellSizeCm, settings.measurementUnit))}
                    step={0.1}
                    allowDecimalInput
                    inputClassName={inspectorControlClass}
                    onChange={updateImageHeightPhysical}
                  />
                </InspectorFieldGrid>
              </InspectorDisclosure>
            </InspectorGroup>

            <InspectorGroup title="Grid" icon={<Grid3X3 size={15} aria-hidden="true" />}>
              <InspectorRow label="Line color">
                <InspectorColorControl label="Graph line color" value={settings.gridLineColor} onChange={(value) => updateSetting("gridLineColor", value)} />
              </InspectorRow>
              <InspectorRow label="Major every">
                <InspectorSelect
                  label="Major grid interval"
                  value={String(settings.majorGridEvery)}
                  options={MAJOR_GRID_EVERY_KEYS.map((key) => ({ value: String(key), label: `${key} cells` }))}
                  onChange={(value) => updateSetting("majorGridEvery", Number(value) as GraphSettings["majorGridEvery"])}
                />
              </InspectorRow>
              <div className="editor-inspector-toggle-row grid grid-cols-2 gap-2">
                <InspectorCheckbox label="Show numbers" checked={settings.showNumbers} onChange={(checked) => updateSetting("showNumbers", checked)} />
                <InspectorCheckbox label="Show guides" checked={settings.showPageBreaks} onChange={(checked) => updateSetting("showPageBreaks", checked)} />
              </div>
              <InspectorDisclosure title="Grid details" summary={GRAPH_LINE_LAYER_LABELS[settings.gridLineLayer]}>
                <InspectorRow label="Layer">
                  <InspectorSelect
                    label="Graph lines layer"
                    value={settings.gridLineLayer}
                    options={GRAPH_LINE_LAYER_KEYS.map((key) => ({ value: key, label: GRAPH_LINE_LAYER_LABELS[key] }))}
                    onChange={(value) => updateSetting("gridLineLayer", value as GraphSettings["gridLineLayer"])}
                  />
                </InspectorRow>
                <InspectorFieldGrid>
                  <label className="editor-inspector-field">
                    <span className="editor-inspector-field__label">Line style</span>
                    <InspectorSelect
                      label="Grid line style"
                      value={settings.gridLineStyle}
                      options={GRAPH_GRID_LINE_STYLE_KEYS.map((key) => ({ value: key, label: key[0].toUpperCase() + key.slice(1) }))}
                      onChange={(value) => updateSetting("gridLineStyle", value as GraphSettings["gridLineStyle"])}
                    />
                  </label>
                  <label className="editor-inspector-field">
                    <span className="editor-inspector-field__label">Pattern</span>
                    <InspectorSelect
                      label="Grid pattern"
                      value={settings.gridPattern}
                      options={GRAPH_GRID_PATTERN_KEYS.map((key) => ({ value: key, label: key === "square" ? "Square" : "Dot" }))}
                      onChange={(value) => updateSetting("gridPattern", value as GraphSettings["gridPattern"])}
                    />
                  </label>
                </InspectorFieldGrid>
                {settings.showNumbers ? (
                  <InspectorRow label="Numbers">
                    <InspectorSelect
                      label="Grid number position"
                      value={settings.gridNumberPlacement}
                      options={(["inside", "outside"] as const).map((key) => ({ value: key, label: GRID_NUMBER_PLACEMENT_LABELS[key] }))}
                      onChange={(value) => updateSetting("gridNumberPlacement", value as GraphSettings["gridNumberPlacement"])}
                    />
                  </InspectorRow>
                ) : null}
              </InspectorDisclosure>
            </InspectorGroup>

            <InspectorGroup title="Print" icon={<Printer size={15} aria-hidden="true" />}>
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
              <InspectorDisclosure title="Page placement" summary={`${settings.pageMargin ?? 24}px margin`}>
                <NumberField
                  label="Page margin"
                  unit="px"
                  value={settings.pageMargin ?? 24}
                  min={0}
                  max={400}
                  wholeStep
                  inputClassName={inspectorControlClass}
                  onChange={(value) => updateSetting("pageMargin", Math.round(value))}
                />
                <InspectorRow label="Align">
                  <InspectorFieldGrid>
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
                  </InspectorFieldGrid>
                </InspectorRow>
              </InspectorDisclosure>
            </InspectorGroup>

            <InspectorMetricGrid label="Document output summary" className="editor-inspector-output-summary">
              <div><dt>Graph</dt><dd>{imageWidthCm} × {imageHeightCm} cm</dd></div>
              <div><dt>Print</dt><dd>{printWidthCm} × {printHeightCm} cm</dd></div>
              <div><dt>Grid</dt><dd>{GRAPH_LINE_LAYER_LABELS[settings.gridLineLayer]} / {settings.showNumbers ? GRID_NUMBER_PLACEMENT_LABELS[settings.gridNumberPlacement] : "No numbers"}</dd></div>
            </InspectorMetricGrid>
            </div>
          </div>

          <div
            id="editor-inspector-panel-draw"
            role="tabpanel"
            aria-labelledby="editor-inspector-tab-draw"
            className={`editor-inspector__tab-panel editor-inspector__tab-panel--create ${inspectorTab === "draw" ? "" : "hidden"}`}
            data-inspector-panel="create"
          >
            <section
              className="editor-inspector__focus-shelf"
              data-inspector-focus-shelf="create"
              aria-labelledby="editor-inspector-create-focus-title"
            >
              <div className="editor-inspector__focus-heading">
                <div>
                  <span className="editor-inspector__focus-kicker">Insert</span>
                  <h3 id="editor-inspector-create-focus-title">Create artwork</h3>
                </div>
                <div className="editor-inspector__create-mode">
                  <InspectorSegmented
                    label="Create mode"
                    value={drawTab}
                    options={drawTabs.map((tab) => ({ value: tab.id, label: tab.label }))}
                    onChange={(value) => setDrawTab(value as DrawTab)}
                  />
                </div>
              </div>
              <InspectorSegmented
                label="Canvas tool"
                value={
                  drawingTool === "shape"
                    ? (OPEN_SHAPE_GENERATOR_KINDS.includes(draftShapeKind) ? "line" : "shape")
                    : drawingTool
                }
                options={drawingToolOptions.map((tool) => ({ value: tool.id, label: tool.label }))}
                onChange={(value) => {
                  const choice = value as DrawingToolChoice;
                  if (choice === "image" || choice === "cell" || choice === "lasso") {
                    setDrawingTool(choice);
                    return;
                  }
                  // Both choices arm the shape tool; the kind is what differs.
                  // Only reset the kind when the current one is in the wrong
                  // family, so re-picking a tool never discards a chosen shape.
                  setDrawingTool("shape");
                  if (choice === "line" && !OPEN_SHAPE_GENERATOR_KINDS.includes(draftShapeKind)) {
                    setDraftShapeKind("line");
                  }
                  if (choice === "shape" && OPEN_SHAPE_GENERATOR_KINDS.includes(draftShapeKind)) {
                    setDraftShapeKind("rectangle");
                  }
                }}
              />
              <div className="editor-inspector__focus-primary">
                {drawTab === "shape" && drawingTool !== "shape" ? (
                  <div className="editor-inspector__tool-focus">
                    <span className="editor-inspector__focus-kicker">Active canvas mode</span>
                    <strong>
                      {drawingTool === "cell"
                        ? "Cell brush"
                        : drawingTool === "lasso"
                          ? "Lasso region"
                          : "Selection"}
                    </strong>
                    <span>
                      {drawingTool === "cell"
                        ? "Paint directly into graph cells on the artboard."
                        : drawingTool === "lasso"
                          ? "Click vertices, then close the region near its starting point."
                          : "Choose a shape below or select an existing object."}
                    </span>
                  </div>
                ) : drawTab === "shape" ? (
                  <InspectorFieldGrid columns={shapeUsesSingleSize(draftShapeKind) ? 1 : 2}>
                    <NumberField
                      label={shapeUsesSingleSize(draftShapeKind) ? "Size" : "Width"}
                      unit="cm"
                      emphasis="primary"
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
                    {shapeUsesSingleSize(draftShapeKind) ? null : (
                      <NumberField
                        label="Height"
                        unit="cm"
                        emphasis="primary"
                        value={draftShapeHeightCm}
                        min={0.01}
                        max={1000}
                        step={0.1}
                        allowDecimalInput
                        inputClassName={inspectorControlClass}
                        onChange={setDraftShapeHeightCm}
                      />
                    )}
                  </InspectorFieldGrid>
                ) : (
                  <InspectorFieldGrid>
                    <NumberField
                      label="Width"
                      unit="cm"
                      emphasis="primary"
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
                      label="Height"
                      unit="cm"
                      emphasis="primary"
                      value={draftClipartHeightCm}
                      min={0.01}
                      max={1000}
                      step={0.1}
                      allowDecimalInput
                      inputClassName={inspectorControlClass}
                      onChange={setDraftClipartHeightCm}
                    />
                  </InspectorFieldGrid>
                )}
                {drawTab === "shape" && drawingTool === "shape" ? (
                  <button
                    type="button"
                    onClick={() => setPlacingGeneratedShape((value) => !value)}
                    className="editor-inspector__place-action"
                    data-active={placingGeneratedShape ? "true" : "false"}
                    aria-pressed={placingGeneratedShape}
                  >
                    Place on canvas
                  </button>
                ) : drawTab === "clipart" ? (
                  <button
                    type="button"
                    onClick={() =>
                      selectedClipartAsset &&
                      setPlacingClipartAssetId((value) =>
                        value === selectedClipartAsset.id ? null : selectedClipartAsset.id,
                      )
                    }
                    disabled={!selectedClipartAsset}
                    className="editor-inspector__place-action"
                    data-active={placingClipartAssetId === selectedClipartAsset?.id ? "true" : "false"}
                    aria-pressed={placingClipartAssetId === selectedClipartAsset?.id}
                  >
                    Place clipart
                  </button>
                ) : null}
              </div>
            </section>

            <div className="editor-inspector__sections">
            {drawTab === "shape" ? (
              <InspectorGroup title="Shape Generator" icon={<Shapes size={15} aria-hidden="true" />}>
                <div className="grid grid-cols-2 gap-2">
                  {/* Show only the family the active tool draws, so Shape lists
                      closed shapes and Line lists the open paths. */}
                  {(OPEN_SHAPE_GENERATOR_KINDS.includes(draftShapeKind)
                    ? OPEN_SHAPE_GENERATOR_KINDS
                    : CLOSED_SHAPE_GENERATOR_KINDS
                  ).map((kind) => (
                    <button
                      key={`draft-shape-${kind}`}
                      type="button"
                      onClick={() => {
                        setDraftShapeKind(kind);
                        if (shapeUsesSingleSize(kind)) setDraftShapeHeightCm(draftShapeWidthCm);
                      }}
                      className="editor-inspector__shape-kind"
                      data-active={draftShapeKind === kind ? "true" : "false"}
                      aria-pressed={draftShapeKind === kind}
                    >
                      {GRAPH_SHAPE_KIND_LABELS[kind]}
                    </button>
                  ))}
                </div>

                {/* Line and arrow are open paths: there is no interior to fill,
                    so the Outline/Filled toggle does not apply to them. */}
                {OPEN_SHAPE_GENERATOR_KINDS.includes(draftShapeKind) ? null : (
                  <InspectorSegmented
                    label="Shape type"
                    value={draftShapeFillMode}
                    options={(["outline", "filled"] as ShapeFillMode[]).map((mode) => ({ value: mode, label: GENERATED_SHAPE_FILL_MODE_LABELS[mode] }))}
                    onChange={(value) => setDraftShapeFillMode(value as ShapeFillMode)}
                  />
                )}

                {draftShapeFillMode === "outline" && shapeSupportsSides(draftShapeKind) ? (
                  <div className="grid grid-cols-4 gap-1">
                    {CELL_LINE_SIDE_KEYS.map((side) => (
                      <label key={`draft-side-${side}`} className="editor-object-properties__side">
                        <input
                          type="checkbox"
                          checked={draftShapeSides.includes(side)}
                          onChange={(event) => setDraftShapeSide(side, event.target.checked)}
                          className="h-4 w-4 accent-[var(--editor-accent)]"
                        />
                        {CELL_LINE_SIDE_LABELS[side]}
                      </label>
                    ))}
                  </div>
                ) : null}

                <NumberField label="Stroke width" value={draftShapeStrokeWidth} min={1} max={24} inputClassName={inspectorControlClass} onChange={(value) => setDraftShapeStrokeWidth(Math.round(value))} />
                <ColorPresetField label="Stroke color" value={draftShapeStrokeColor} onChange={setDraftShapeStrokeColor} />
                {draftShapeFillMode === "filled" ? <ColorPresetField label="Fill color" value={draftShapeFillColor} onChange={setDraftShapeFillColor} allowTransparent /> : null}

                <div className="editor-inspector__placement-preview">
                  <div
                    draggable
                    onDragStart={handleGeneratedShapeDragStart}
                    onDragEnd={() => setPlacingGeneratedShape(false)}
                    className="editor-inspector__placement-stage cursor-grab active:cursor-grabbing"
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
                  <div className="border-t border-[var(--editor-line-soft)] p-2">
                    <button type="button" onClick={clearGraphShapes} disabled={!settings.graphShapes.length} className="editor-inspector__secondary-action">
                      Clear generated
                    </button>
                  </div>
                </div>
              </InspectorGroup>
            ) : null}

            {drawTab === "clipart" ? (
              <InspectorGroup title="Clipart Library" icon={<ImageIcon size={15} aria-hidden="true" />}>
                <label className={`editor-inspector__upload-action ${uploadingCliparts ? "opacity-60" : ""}`}>
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
                <label className="editor-inspector-field">
                  <span className="editor-inspector-field__label">Search clipart by name</span>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--editor-muted)]" aria-hidden="true" />
                    <input
                      type="text"
                      value={clipartSearch}
                      onChange={(event) => setClipartSearch(event.target.value)}
                      placeholder="Search clipart"
                      className="editor-inspector-control w-full py-2 pr-3 pl-9"
                    />
                  </div>
                </label>

                {settings.clipartAssets.length ? (
                  filteredClipartAssets.length ? (
                    <div className="editor-inspector__clipart-grid">
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
                            className="editor-inspector__clipart-tile"
                            data-selected={selected ? "true" : "false"}
                          >
                            {previewUrl ? (
                              <img src={previewUrl} alt="" className="h-11 w-11 rounded border border-[var(--editor-line)] bg-[var(--artboard-bg)] object-contain p-1" />
                            ) : (
                              <span className="grid h-11 w-11 place-items-center rounded border border-[var(--editor-line)] bg-[var(--artboard-bg)] text-[var(--editor-muted)]">
                                <ImageIcon size={15} aria-hidden="true" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-semibold text-[var(--editor-text)]">{asset.name}</span>
                              <span className="block truncate text-[11px] text-[var(--editor-muted)]">{asset.width} x {asset.height}</span>
                            </span>
                            {selected ? <Check size={16} aria-hidden="true" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="editor-inspector-context-hint">
                      No cliparts match &quot;{clipartSearch}&quot;
                    </div>
                  )
                ) : (
                  <div className="editor-inspector-context-hint">
                    Upload cliparts to reuse in this project.
                  </div>
                )}

                <ColorPresetField label="Stroke color" value={draftClipartStrokeColor} onChange={setDraftClipartStrokeColor} />
                <ColorPresetField label="Fill color" value={draftClipartFillColor} onChange={setDraftClipartFillColor} allowTransparent />

                <div className="editor-inspector__placement-preview">
                  <div
                    draggable={Boolean(selectedClipartAsset)}
                    onDragStart={selectedClipartAsset ? handleClipartDragStart(selectedClipartAsset.id) : undefined}
                    onDragEnd={() => setPlacingClipartAssetId(null)}
                    className={`editor-inspector__placement-stage ${selectedClipartAsset ? "cursor-grab active:cursor-grabbing" : "text-[var(--editor-muted)]"}`}
                    title={selectedClipartAsset ? "Drag to canvas" : "Upload or select a clipart"}
                  >
                    {selectedClipartAsset?.url || selectedClipartAsset?.dataUrl ? (
                      <div
                        className="grid h-full max-h-28 w-full place-items-center overflow-hidden rounded border bg-[var(--editor-panel-2)] p-2"
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
                  <div className="grid grid-cols-2 gap-2 border-t border-[var(--editor-line-soft)] p-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedClipartAsset) void deleteClipartAsset(selectedClipartAsset.id);
                      }}
                      disabled={!selectedClipartAsset || deletingClipartAssetId !== null}
                      className="editor-inspector__secondary-action is-danger"
                    >
                      {selectedClipartAsset && deletingClipartAssetId === selectedClipartAsset.id ? <Loader2 size={14} className="animate-spin" /> : "Delete clipart"}
                    </button>
                    <button type="button" onClick={() => setGeneratedImagesCollapsed(false)} disabled={!settings.clipartImages.length} className="editor-inspector__secondary-action">
                      Show placed
                    </button>
                  </div>
                </div>
              </InspectorGroup>
            ) : null}
            </div>

          </div>

        <div
          id="editor-inspector-panel-palette"
          role="tabpanel"
          aria-labelledby="editor-inspector-tab-palette"
          className={`editor-inspector__tab-panel editor-inspector__tab-panel--color ${inspectorTab === "palette" ? "" : "hidden"}`}
          data-inspector-panel="color"
        >
          <section
            className="editor-inspector__focus-shelf"
            data-inspector-focus-shelf="color"
            aria-labelledby="editor-inspector-color-focus-title"
          >
            <div className="editor-inspector__focus-heading">
              <div>
                <span className="editor-inspector__focus-kicker">{selectedFillRegion ? "Canvas selection" : "Artwork default"}</span>
                <h3 id="editor-inspector-color-focus-title">{selectedFillRegion ? "Selected fill" : "Default fill"}</h3>
              </div>
              {selectedFillRegion ? (
                <button
                  type="button"
                  onClick={() => resetFillRegionColor(selectedFillRegion.id)}
                  className="editor-inspector-reset-chip"
                  title="Use default fill"
                  aria-label="Use default fill"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {selectedFillRegion ? (
              <ColorPresetField
                label={selectedFillRegion.kind === "source" ? "Source region fill" : "Manual region fill"}
                value={selectedFillRegionColor}
                onChange={(value) => updateFillRegionColor(selectedFillRegion.id, value)}
                allowTransparent
                expanded={!collapsedSections.selectedFill}
                onExpandedChange={() => toggleSection("selectedFill")}
              />
            ) : (
              <ColorPresetField
                label="Default fill"
                value={settings.fillColor}
                onChange={(value) => updateSetting("fillColor", value)}
                allowTransparent
                expanded={!collapsedSections.fill}
                onExpandedChange={() => toggleSection("fill")}
              />
            )}
          </section>

          <div className="editor-inspector__sections">
            {!selectedFillRegion ? (
              <div className="editor-inspector-context-hint">
                <Palette size={15} aria-hidden="true" />
                Select a filled region on the canvas to override it independently.
              </div>
            ) : null}
            <InspectorGroup title="Artwork colors" icon={<Palette size={15} aria-hidden="true" />}>
              <ColorPresetField
                label="Outline"
                value={settings.outlineColor}
                onChange={updateOutlineColor}
                expanded={!collapsedSections.outline}
                onExpandedChange={() => toggleSection("outline")}
              />
              {selectedFillRegion ? (
                <ColorPresetField
                  label="Default fill"
                  value={settings.fillColor}
                  onChange={(value) => updateSetting("fillColor", value)}
                  allowTransparent
                  expanded={!collapsedSections.fill}
                  onExpandedChange={() => toggleSection("fill")}
                />
              ) : null}
            </InspectorGroup>
            <InspectorGroup title="Graph color" icon={<Grid3X3 size={15} aria-hidden="true" />} priority="quiet">
              <ColorPresetField
                label="Graph lines"
                value={settings.gridLineColor}
                colors={PRESET_GRAPH_LINE_COLORS}
                normalizeColor={normalizeGraphLineColor}
                onChange={(value) => updateSetting("gridLineColor", value)}
                expanded={!collapsedSections.graphLines}
                onExpandedChange={() => toggleSection("graphLines")}
              />
            </InspectorGroup>
            <InspectorGroup title="Chart palette" icon={<Palette size={15} aria-hidden="true" />} priority="quiet">
              {palette.length ? (
                <div className="editor-inspector__palette-list" role="list" aria-label="Generated chart palette">
                  {palette.map((color, index) => (
                    <div
                      key={`${color.id ?? color.hex}-${index}`}
                      className="editor-inspector__palette-row"
                      role="listitem"
                    >
                      <span
                        className="editor-inspector__palette-swatch"
                        style={{ backgroundColor: color.hex }}
                        aria-hidden="true"
                      />
                      <span className="editor-inspector__palette-copy">
                        <strong>{color.name}</strong>
                        <span>{color.hex.toUpperCase()}</span>
                      </span>
                      <span className="editor-inspector__palette-count">
                        {color.cellCount.toLocaleString()} cells
                      </span>
                      <span
                        className="editor-inspector__palette-lock"
                        title={color.locked ? "Palette color locked" : "Palette color unlocked"}
                        aria-label={color.locked ? "Palette color locked" : "Palette color unlocked"}
                      >
                        {color.locked ? <Lock size={13} aria-hidden="true" /> : <Unlock size={13} aria-hidden="true" />}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="editor-inspector__hint">Palette counts appear after the canvas finishes processing.</p>
              )}
            </InspectorGroup>
          </div>
        </div>
        </div>
      </div>
      </div>
      </div>

      <button
        type="button"
        aria-label="Resize controls panel"
        title="Resize controls panel"
        onPointerDown={(event) => beginPanelResize(event, "right")}
        onPointerMove={resizePanel}
        onPointerUp={endPanelResize}
        onPointerCancel={endPanelResize}
        className="editor-inspector__resize-handle editor-panel-resizer editor-panel-resizer--right group absolute inset-y-0 left-0 hidden w-4 cursor-col-resize touch-none place-items-center lg:grid"
        data-resizing={resizingPanelSide === "right" ? "true" : "false"}
      >
        <span
          className="editor-panel-resizer__grip"
          aria-hidden="true"
        >
          <GripVertical size={12} strokeWidth={2.2} />
        </span>
      </button>
    </aside>
  );
}
