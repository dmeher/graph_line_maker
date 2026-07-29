"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
  type DragEvent as ReactDragEvent,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Copy,
  Grid3X3,
  ImageIcon,
  Loader2,
  Lock,
  MousePointer2,
  Palette,
  Printer,
  RefreshCw,
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
  InspectorFieldGrid,
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
} from "./inspector/inspector-fields";
import type {
  GraphCellPaint,
  GraphClipartAsset,
  GraphClipartImage,
  GraphEraseRegionFill,
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
  type GraphGridLineStyle,
  normalizeGraphLineColor,
} from "@/lib/graph-paper";
import {
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
type DrawingTool = "image" | "line" | "shape" | "background-remover" | "image-eraser" | "lasso";
type ClosedGeneratedShapeKind = Exclude<GeneratedShapeKind, "line" | "arrow">;
type CollapsibleKey = "parameters" | "drawing" | "outline" | "fill" | "selectedFill" | "graphLines";
function paperSizeOptionLabel(key: GraphSettings["printPaperSize"]) {
  const paper = PRINT_PAPER_SIZES[key] ?? PRINT_PAPER_SIZES[DEFAULT_PRINT_PAPER_SIZE];
  return `${paper.label} (${Math.round(paper.widthCm * 10)} x ${Math.round(paper.heightCm * 10)} mm)`;
}

export interface InspectorPanelProps {
  settings: GraphSettings;
  palette: PaletteColor[];
  inspectorTab: InspectorTab;
  setInspectorTab: (tab: InspectorTab) => void;
  drawTab: DrawTab;
  setDrawTab: (tab: DrawTab) => void;
  drawingTool: DrawingTool;
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
  selectionConsole: SelectionConsoleModel;
  selectedLayerCount: number;
  selectedLayerBounds: { width: number; height: number } | null;
  selectedLayerLocked: boolean;
  selectedLayerResizeDisabled: boolean;
  selectedLayerHidden: boolean;
  resizeSelectedLayerBounds: (size: { width?: number; height?: number }) => void;

  draftShapeKind: GeneratedShapeKind;
  armedShapeKind: ClosedGeneratedShapeKind | null;
  draftShapeFillMode: ShapeFillMode;
  draftShapeStrokeWidth: number;
  draftShapeStrokeColor: string;
  draftShapeStrokeStyle: GraphGridLineStyle;
  draftShapeFillColor: string;
  setDraftShapeKind: (kind: GeneratedShapeKind) => void;
  setDraftShapeFillMode: (mode: ShapeFillMode) => void;
  setDraftShapeStrokeWidth: (value: number) => void;
  setDraftShapeStrokeColor: (value: string) => void;
  setDraftShapeStrokeStyle: (value: GraphGridLineStyle) => void;
  setDraftShapeFillColor: (value: string) => void;
  setPlacingClipartAssetId: (value: string | null | ((prev: string | null) => string | null)) => void;

  lassoFill: GraphEraseRegionFill | "erase";
  setLassoFill: (value: GraphEraseRegionFill | "erase") => void;
  lassoVertexCount: number;
  commitLasso: () => void;
  cancelLasso: () => void;

  draftClipartWidthCm: number;
  draftClipartHeightCm: number;
  draftClipartStrokeColor: string;
  draftClipartFillColor: string;
  draftClipartPreviewDimensions: { width: number; height: number };
  setDraftClipartWidthCm: (value: number) => void;
  setDraftClipartHeightCm: (value: number) => void;
  setDraftClipartStrokeColor: (value: string) => void;
  setDraftClipartFillColor: (value: string) => void;

  handleClipartDragStart: (assetId: string) => (event: ReactDragEvent<HTMLElement>) => void;
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
  sourcePhysicalWidthCm: (source: GraphSourceImage) => number;
  sourcePhysicalHeight: (source: GraphSourceImage) => number;
  sourceRightPadding: (source: GraphSourceImage) => number;
  sourceBottomPadding: (source: GraphSourceImage) => number;

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
  unitToCm: (value: number, unit: MeasurementUnit) => number;

  clipartAssetAspect: (asset?: GraphClipartAsset | null) => number;

}

export type SelectionConsoleKind =
  | "none"
  | "source"
  | "shape"
  | "clipart"
  | "cell"
  | "multi";

export type SelectionConsoleStatus = "ready" | "hidden" | "locked" | "mixed";

export type SelectionConsoleAction = {
  disabled: boolean;
  onAction: () => void;
};

export interface SelectionConsoleModel {
  kind: SelectionConsoleKind;
  count: number;
  status: SelectionConsoleStatus;
  preview: ReactNode;
  actions: {
    nudgeLeft: SelectionConsoleAction;
    nudgeUp: SelectionConsoleAction;
    nudgeDown: SelectionConsoleAction;
    nudgeRight: SelectionConsoleAction;
  };
}

const inspectorTabs: { id: InspectorTab; label: string; accessibleLabel: string; icon: ReactNode }[] = [
  { id: "graph", label: "Document", accessibleLabel: "Document", icon: <Grid3X3 size={18} strokeWidth={2.15} aria-hidden="true" /> },
  { id: "source", label: "Selection", accessibleLabel: "Selection", icon: <MousePointer2 size={18} strokeWidth={2.15} aria-hidden="true" /> },
  { id: "draw", label: "Create", accessibleLabel: "Create", icon: <Shapes size={18} strokeWidth={2.15} aria-hidden="true" /> },
  { id: "palette", label: "Color", accessibleLabel: "Color", icon: <Palette size={18} strokeWidth={2.15} aria-hidden="true" /> },
];

const drawTabs: { id: DrawTab; label: string }[] = [
  { id: "shape", label: "Shape" },
  { id: "clipart", label: "Clipart" },
];

const OPEN_SHAPE_GENERATOR_KINDS: GeneratedShapeKind[] = ["line", "arrow"];
const CLOSED_SHAPE_GENERATOR_KINDS: GeneratedShapeKind[] = ["square", "rectangle", "circle", "oval", "half-circle"];

const selectionKindLabels: Record<SelectionConsoleKind, string> = {
  none: "No selection",
  source: "Source image",
  shape: "Shape",
  clipart: "Clipart",
  cell: "Cell paint",
  multi: "Layer selection",
};

const selectionStatusLabels: Record<SelectionConsoleStatus, string> = {
  ready: "Ready",
  hidden: "Hidden",
  locked: "Locked",
  mixed: "Mixed state",
};

function FocusConsoleShelfPanel({
  mode,
  active,
  label,
  children,
}: {
  mode: InspectorTab;
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <section
      className="focus-console__shelf-panel"
      data-focus-console-shelf={mode}
      aria-label={label}
      hidden={!active}
    >
      {children}
    </section>
  );
}

function FocusConsoleActionButton({
  action,
  label,
  title,
  icon,
  direction,
}: {
  action: SelectionConsoleAction;
  label: string;
  title?: string;
  icon: ReactNode;
  direction?: "up" | "right" | "down" | "left";
}) {
  return (
    <button
      type="button"
      className="focus-console__command"
      data-direction={direction}
      disabled={action.disabled}
      onClick={action.onAction}
      aria-label={label}
      title={title ?? label}
    >
      {icon}
    </button>
  );
}

function SelectionCommandShelf({ model }: { model: SelectionConsoleModel }) {
  const kindLabel = selectionKindLabels[model.kind];
  const statusLabel = selectionStatusLabels[model.status];
  const selectionLabel =
    model.count === 0
      ? kindLabel
      : `${model.count} ${model.count === 1 ? kindLabel.toLocaleLowerCase("en") : "layers"}`;

  return (
    <div
      className="focus-console__selection-shelf"
      data-focus-command-shelf="selection"
      data-selection-kind={model.kind}
      data-selection-status={model.status}
    >
      <div
        className="focus-console__selection-identity"
        data-has-preview={Boolean(model.preview)}
      >
        {model.preview ? (
          <span className="focus-console__selection-preview" aria-hidden="true">
            {model.preview}
            {model.count > 1 ? (
              <span className="focus-console__selection-preview-count">{model.count}</span>
            ) : null}
          </span>
        ) : null}
        <div className="focus-console__selection-summary">
          <span className="focus-console__shelf-kicker">Selection</span>
          <strong>{selectionLabel}</strong>
          <span className="focus-console__status" data-status={model.status}>
            <i aria-hidden="true" />
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="focus-console__selection-toolbar" role="toolbar" aria-label="Selection commands">
        <div className="focus-console__nudge-pad" role="group" aria-label="Nudge selection">
          <FocusConsoleActionButton
            action={model.actions.nudgeUp}
            label="Nudge selection up"
            direction="up"
            icon={<ArrowUp size={15} aria-hidden="true" />}
          />
          <FocusConsoleActionButton
            action={model.actions.nudgeLeft}
            label="Nudge selection left"
            direction="left"
            icon={<ArrowLeft size={15} aria-hidden="true" />}
          />
          <span className="focus-console__nudge-center" aria-hidden="true" />
          <FocusConsoleActionButton
            action={model.actions.nudgeRight}
            label="Nudge selection right"
            direction="right"
            icon={<ArrowRight size={15} aria-hidden="true" />}
          />
          <FocusConsoleActionButton
            action={model.actions.nudgeDown}
            label="Nudge selection down"
            direction="down"
            icon={<ArrowDown size={15} aria-hidden="true" />}
          />
        </div>
      </div>
    </div>
  );
}

type InspectorGroupProps = {
  title: string;
  tabLabel?: string;
  icon?: ReactNode;
  description?: string;
  action?: ReactNode;
  priority?: "primary" | "secondary" | "quiet";
  layout?: "card" | "flush";
  children: ReactNode;
};

function InspectorGroup({
  title,
  description,
  action,
  priority = "secondary",
  layout = "card",
  children,
}: InspectorGroupProps) {
  return (
    <section
      className="editor-inspector-group"
      data-priority={priority}
      data-layout={layout}
    >
      {description || action ? (
        <header className="editor-inspector-group__panel-header">
          <span>{description ?? title}</span>
          {action ? <span className="editor-inspector-group__action">{action}</span> : null}
        </header>
      ) : null}
      <div className="editor-inspector-group__body">{children}</div>
    </section>
  );
}

type InspectorGroupElement = ReactElement<InspectorGroupProps, typeof InspectorGroup>;

function collectInspectorGroups(children: ReactNode, result: InspectorGroupElement[] = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      collectInspectorGroups((child.props as { children?: ReactNode }).children, result);
      return;
    }
    if (child.type === InspectorGroup) result.push(child as InspectorGroupElement);
  });
  return result;
}

function inspectorLensId(title: string, index: number) {
  const slug = title
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "view"}-${index}`;
}

/**
 * Focus Lens keeps every settings panel mounted while presenting one compact
 * view at a time. This avoids the clipping and long stacked scroll that the
 * previous card/accordion treatment caused in a floating inspector.
 */
function InspectorSections({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const baseId = useId();
  const groups = collectInspectorGroups(children);
  const entries = groups.map((group, index) => ({
    id: inspectorLensId(group.props.title, index),
    group,
  }));
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const activeId = entries.some((entry) => entry.id === requestedId)
    ? requestedId
    : entries[0]?.id ?? null;
  const activeEntry = entries.find((entry) => entry.id === activeId);
  const singleView = entries.length === 1;

  if (!entries.length) return null;

  function activate(index: number, focus = false) {
    const entry = entries[index];
    if (!entry) return;
    setRequestedId(entry.id);
    if (focus) {
      requestAnimationFrame(() => {
        document.getElementById(`${baseId}-tab-${entry.id}`)?.focus();
      });
    }
  }

  return (
    <div
      className="editor-inspector__sections"
      data-focus-lens={label}
      data-has-focus-shelf="false"
    >
      <div
        className="editor-inspector__lens-workspace"
        data-has-inline-shelf="false"
        data-single-view={singleView ? "true" : "false"}
      >
        {singleView ? null : (
          <div
            className="editor-inspector__lens-tabs"
            role="tablist"
            aria-label={`${label} views`}
            aria-orientation="horizontal"
          >
            {entries.map(({ id, group }, index) => {
              const active = id === activeId;
              return (
                <button
                  key={id}
                  type="button"
                  id={`${baseId}-tab-${id}`}
                  className="editor-inspector__lens-tab"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`${baseId}-panel-${id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => activate(index)}
                  onKeyDown={(event) => {
                    const lastIndex = entries.length - 1;
                    const nextIndex =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? lastIndex
                          : event.key === "ArrowRight" || event.key === "ArrowDown"
                            ? (index + 1) % entries.length
                            : event.key === "ArrowLeft" || event.key === "ArrowUp"
                              ? (index - 1 + entries.length) % entries.length
                              : null;
                    if (nextIndex === null) return;
                    event.preventDefault();
                    activate(nextIndex, true);
                  }}
                >
                  {group.props.icon ? (
                    <span className="editor-inspector__lens-tab-icon" aria-hidden="true">
                      {group.props.icon}
                    </span>
                  ) : null}
                  <span>{group.props.tabLabel ?? group.props.title}</span>
                  <i aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}

        <div
          className="editor-inspector__lens-deck"
          data-active-layout={activeEntry?.group.props.layout ?? "card"}
        >
          {entries.map(({ id, group }) => {
            const active = id === activeId;
            return (
              <section
                key={id}
                id={`${baseId}-panel-${id}`}
                className="editor-inspector-group"
                role={singleView ? "region" : "tabpanel"}
                aria-label={singleView ? group.props.title : undefined}
                aria-labelledby={singleView ? undefined : `${baseId}-tab-${id}`}
                data-priority={group.props.priority ?? "secondary"}
                data-layout={group.props.layout ?? "card"}
                hidden={!active}
              >
                {group.props.description || group.props.action ? (
                  <header className="editor-inspector-group__panel-header">
                    <span>{group.props.description ?? group.props.title}</span>
                    {group.props.action ? (
                      <span className="editor-inspector-group__action">{group.props.action}</span>
                    ) : null}
                  </header>
                ) : null}
                <div className="editor-inspector-group__body">{group.props.children}</div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function shapeUsesSingleSize(kind: GraphShapeKind) {
  return kind === "square" || kind === "circle";
}

export function InspectorPanel(props: InspectorPanelProps) {
  const {
    settings,
    palette,
    inspectorTab,
    setInspectorTab,
    drawTab,
    setDrawTab,
    drawingTool,
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
    selectionConsole,
    selectedLayerCount,
    selectedLayerBounds,
    selectedLayerLocked,
    selectedLayerResizeDisabled,
    selectedLayerHidden,
    resizeSelectedLayerBounds,
    draftShapeKind,
    armedShapeKind,
    draftShapeFillMode,
    draftShapeStrokeWidth,
    draftShapeStrokeColor,
    draftShapeStrokeStyle,
    draftShapeFillColor,
    setDraftShapeKind,
    setDraftShapeFillMode,
    setDraftShapeStrokeWidth,
    setDraftShapeStrokeColor,
    setDraftShapeStrokeStyle,
    setDraftShapeFillColor,
    setPlacingClipartAssetId,
    lassoFill,
    setLassoFill,
    lassoVertexCount,
    commitLasso,
    cancelLasso,
    draftClipartWidthCm,
    draftClipartHeightCm,
    draftClipartStrokeColor,
    draftClipartFillColor,
    draftClipartPreviewDimensions,
    setDraftClipartWidthCm,
    setDraftClipartHeightCm,
    setDraftClipartStrokeColor,
    setDraftClipartFillColor,
    handleClipartDragStart,
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
    sourcePhysicalWidthCm,
    sourcePhysicalHeight,
    sourceRightPadding,
    sourceBottomPadding,
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
    unitToCm,
    clipartAssetAspect,
  } = props;

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
      <InspectorSections label="Selection">
        {selectedLayerCount > 1 ? (
          <>
          <InspectorGroup title="Transform selection" tabLabel="Transform" icon={<Copy size={15} aria-hidden="true" />}>
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
            <p className="editor-inspector__hint">Hold Alt while moving to temporarily disable snapping.</p>
          </InspectorGroup>
          <InspectorGroup title="Selection metrics" tabLabel="Metrics" icon={<Ruler size={15} aria-hidden="true" />} priority="quiet">
            <InspectorMetricGrid label="Selected layer metrics">
              <div><dt>Layers</dt><dd>{selectedLayerCount}</dd></div>
              <div><dt>State</dt><dd>{selectedLayerLocked ? "Locked" : "Editable"}</dd></div>
              {selectedLayerBounds ? (
                <>
                  <div><dt>Width</dt><dd>{roundMeasure(selectedLayerBounds.width)} cells</dd></div>
                  <div><dt>Height</dt><dd>{roundMeasure(selectedLayerBounds.height)} cells</dd></div>
                </>
              ) : null}
            </InspectorMetricGrid>
          </InspectorGroup>
          </>
        ) : selectedSource ? (
          <>
            <InspectorGroup title="Source size" tabLabel="Size" icon={<Ruler size={15} aria-hidden="true" />}>
              <div className="editor-inspector__dimension-toolbar">
                <span>Dimension units</span>
                <div
                  className="editor-inspector-unit-switch"
                  role="group"
                  aria-label="Source dimension unit"
                >
                  {(["cm", "in"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      className={selectedSource.measurementUnit === unit ? "is-active" : ""}
                      aria-pressed={selectedSource.measurementUnit === unit}
                      aria-label={`Show source width and height in ${unit === "cm" ? "centimeters" : "inches"}`}
                      onClick={() =>
                        updateSourceImage(selectedSource.id, {
                          measurementUnit: unit,
                        })
                      }
                    >
                      {unit.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <InspectorFieldGrid className="editor-inspector-primary-grid">
                <NumberField
                  label="Width"
                  unit={MEASUREMENT_UNIT_LABELS[selectedSource.measurementUnit]}
                  emphasis="primary"
                  value={roundMeasure(cmToUnit(sourcePhysicalWidthCm(selectedSource), selectedSource.measurementUnit))}
                  min={0.01}
                  max={roundMeasure(cmToUnit(1000, selectedSource.measurementUnit))}
                  step={0.1}
                  allowDecimalInput
                  disabled={selectedSource.locked}
                  onChange={(value) =>
                    updateSourceImagePhysicalWidthCm(
                      selectedSource.id,
                      unitToCm(value, selectedSource.measurementUnit),
                    )
                  }
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
            </InspectorGroup>
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
        ) : selectedDrawingDimensions ? (
          <>
            <InspectorGroup title="Object geometry" tabLabel="Geometry" icon={<Ruler size={15} aria-hidden="true" />}>
              <InspectorMetricGrid label="Selected object dimensions">
                <div><dt>Width</dt><dd>{roundMeasure(selectedDrawingDimensions.width)} cells</dd></div>
                <div><dt>Height</dt><dd>{roundMeasure(selectedDrawingDimensions.height)} cells</dd></div>
                <div><dt>State</dt><dd>{selectedLayerHidden ? "Hidden" : "Visible"} / {selectedLayerLocked ? "Locked" : "Editable"}</dd></div>
              </InspectorMetricGrid>
            </InspectorGroup>
            {selectedShapeLayer ? (
              <InspectorGroup title="Shape appearance" tabLabel="Appearance" icon={<Shapes size={15} aria-hidden="true" />}>
                {renderShapeAdvanced(selectedShapeLayer)}
              </InspectorGroup>
            ) : selectedClipartLayer ? (
              <InspectorGroup title="Clipart appearance" tabLabel="Appearance" icon={<ImageIcon size={15} aria-hidden="true" />}>
                {renderClipartAdvanced(selectedClipartLayer)}
              </InspectorGroup>
            ) : selectedCellLayer ? (
              <InspectorGroup title="Cell paint appearance" tabLabel="Appearance" icon={<MousePointer2 size={15} aria-hidden="true" />}>
                {renderCellAdvanced(selectedCellLayer)}
              </InspectorGroup>
            ) : null}
            <InspectorGroup title="Object placement" tabLabel="Placement" icon={<Ruler size={15} aria-hidden="true" />} priority="quiet">
              <InspectorMetricGrid label="Selected object placement">
                <div><dt>Left</dt><dd>{selectedShapeLayer?.x ?? selectedClipartLayer?.x ?? selectedCellLayer?.x ?? 0}</dd></div>
                <div><dt>Top</dt><dd>{selectedShapeLayer?.y ?? selectedClipartLayer?.y ?? selectedCellLayer?.y ?? 0}</dd></div>
                <div><dt>Width</dt><dd>{roundMeasure(selectedDrawingDimensions.width)} cells</dd></div>
                <div><dt>Height</dt><dd>{roundMeasure(selectedDrawingDimensions.height)} cells</dd></div>
              </InspectorMetricGrid>
            </InspectorGroup>
          </>
        ) : (
          <InspectorGroup title="No selection" tabLabel="Select" icon={<MousePointer2 size={15} aria-hidden="true" />} priority="quiet">
            <div className="editor-inspector-context-hint">
              <MousePointer2 size={16} aria-hidden="true" />
              <span>Select a layer or artwork region to reveal its settings.</span>
            </div>
          </InspectorGroup>
        )}
      </InspectorSections>
    </div>
  );

  return (
    <aside
      className="editor-inspector editor-panel focus-console relative space-y-0"
      aria-label="Properties inspector"
      data-editor-region="inspector"
      data-inspector-context={inspectorTab}
    >
      <div className="editor-inspector__content">
        <div className="editor-inspector__layout focus-console__layout">
          <div className="focus-console__modes">
            <InspectorModeRail
              value={inspectorTab}
              options={inspectorTabs}
              onChange={setInspectorTab}
              orientation="horizontal"
            />
          </div>

          <div className="focus-console__workspace">
            <div
              className="focus-console__shelf focus-console__command-shelf"
              aria-label="Focus console commands"
            >
              <FocusConsoleShelfPanel
                mode="graph"
                active={inspectorTab === "graph"}
                label="Document commands"
              >
                <div className="focus-console__shelf-heading">
                  <span className="focus-console__shelf-kicker">Canvas</span>
                  <strong>Graph dimensions</strong>
                </div>
                <div className="focus-console__unit-switch" role="group" aria-label="Measurement units">
                  {(["cm", "in"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      className={settings.measurementUnit === unit ? "is-active" : ""}
                      onClick={() => updateMeasurementUnit(unit)}
                      aria-pressed={settings.measurementUnit === unit}
                    >
                      {unit.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="focus-console__dimension-pair">
                  <NumberField
                    label="Width"
                    unit="cells"
                    value={settings.graphWidth}
                    min={1}
                    max={MAX_GRAPH_WIDTH_CELLS}
                    inputClassName={inspectorControlClass}
                    onChange={(value) => updateSetting("graphWidth", value)}
                  />
                  <NumberField
                    label="Height"
                    unit="cells"
                    value={settings.graphHeight}
                    min={1}
                    max={MAX_GRAPH_HEIGHT_CELLS}
                    inputClassName={inspectorControlClass}
                    onChange={(value) => updateSetting("graphHeight", value)}
                  />
                </div>
                <dl className="focus-console__summary-metrics">
                  <div>
                    <dt>Cell</dt>
                    <dd>{(settings.cellSizeCm * 10).toFixed(0)} mm</dd>
                  </div>
                  <div>
                    <dt>Graph</dt>
                    <dd>{settings.graphWidth} x {settings.graphHeight}</dd>
                  </div>
                </dl>
                <div className="focus-console__toggle-list">
                  <InspectorCheckbox
                    label="Numbers"
                    checked={settings.showNumbers}
                    onChange={(checked) => updateSetting("showNumbers", checked)}
                  />
                  <InspectorCheckbox
                    label="Guides"
                    checked={settings.showPageBreaks}
                    onChange={(checked) => updateSetting("showPageBreaks", checked)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsWithHistory((current) => editorDefaultGraphSettings(current));
                    setSelectedFillRegionId(null);
                    setFloatingPalette(null);
                    setCopiedFillColor(null);
                  }}
                  className="focus-console__reset"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  Reset document
                </button>
              </FocusConsoleShelfPanel>

              <FocusConsoleShelfPanel
                mode="source"
                active={inspectorTab === "source"}
                label="Selection commands"
              >
                <SelectionCommandShelf model={selectionConsole} />
              </FocusConsoleShelfPanel>

              <FocusConsoleShelfPanel
                mode="draw"
                active={inspectorTab === "draw"}
                label="Create commands"
              >
                <div className="focus-console__shelf-heading">
                  <span className="focus-console__shelf-kicker">Active tool</span>
                  <strong>
                    {drawTab === "clipart"
                      ? "Clipart"
                      : drawingTool === "line"
                        ? "Draw Line"
                        : drawingTool === "shape"
                          ? "Draw Shape"
                          : drawingTool === "lasso"
                            ? "Lasso"
                            : "Select"}
                  </strong>
                </div>
                <InspectorSegmented
                  label="Create mode"
                  value={drawTab}
                  options={drawTabs.map((tab) => ({ value: tab.id, label: tab.label }))}
                  onChange={(value) => {
                    const nextTab = value as DrawTab;
                    if (nextTab === "shape") setPlacingClipartAssetId(null);
                    setDrawTab(nextTab);
                  }}
                />
                <dl className="focus-console__summary-metrics">
                  <div>
                    <dt>Kind</dt>
                    <dd>
                      {drawTab === "clipart"
                        ? selectedClipartAsset
                          ? "Selected"
                          : "None"
                        : drawingTool === "shape"
                          ? armedShapeKind
                            ? GRAPH_SHAPE_KIND_LABELS[armedShapeKind]
                            : "Choose shape"
                          : drawingTool === "line"
                            ? GRAPH_SHAPE_KIND_LABELS[draftShapeKind]
                            : drawingTool === "lasso"
                              ? "Polygon"
                              : "Not set"}
                    </dd>
                  </div>
                </dl>
                <div className="focus-console__swatches" aria-label="Active creation colors">
                  <span>
                    <i style={{ backgroundColor: drawTab === "clipart" ? draftClipartStrokeColor : draftShapeStrokeColor }} aria-hidden="true" />
                    Stroke
                  </span>
                  <span>
                    <i
                      data-transparent={(drawTab === "clipart" ? draftClipartFillColor : draftShapeFillColor) === "transparent" ? "true" : "false"}
                      style={{
                        backgroundColor:
                          (drawTab === "clipart" ? draftClipartFillColor : draftShapeFillColor) === "transparent"
                            ? undefined
                            : drawTab === "clipart"
                              ? draftClipartFillColor
                              : draftShapeFillColor,
                      }}
                      aria-hidden="true"
                    />
                    Fill
                  </span>
                </div>
                {drawTab === "clipart" ? (
                  <button
                    type="button"
                    onClick={() =>
                      selectedClipartAsset &&
                      setPlacingClipartAssetId((value) =>
                        value === selectedClipartAsset.id ? null : selectedClipartAsset.id,
                      )
                    }
                    disabled={!selectedClipartAsset}
                    className="focus-console__primary-action"
                    data-active={placingClipartAssetId === selectedClipartAsset?.id ? "true" : "false"}
                    aria-pressed={placingClipartAssetId === selectedClipartAsset?.id}
                  >
                    Place on canvas
                  </button>
                ) : null}
              </FocusConsoleShelfPanel>

              <FocusConsoleShelfPanel
                mode="palette"
                active={inspectorTab === "palette"}
                label="Color commands"
              >
                <div className="focus-console__shelf-heading">
                  <span className="focus-console__shelf-kicker">
                    {selectedFillRegion ? "Selection" : "Artwork"}
                  </span>
                  <strong>{selectedFillRegion ? "Selected fill" : "Default fill"}</strong>
                </div>
                <div className="focus-console__color-summary">
                  <span
                    className="focus-console__primary-swatch"
                    data-transparent={(selectedFillRegion ? selectedFillRegionColor : settings.fillColor) === "transparent" ? "true" : "false"}
                    style={{
                      backgroundColor:
                        (selectedFillRegion ? selectedFillRegionColor : settings.fillColor) === "transparent"
                          ? undefined
                          : selectedFillRegion
                            ? selectedFillRegionColor
                            : settings.fillColor,
                    }}
                    aria-hidden="true"
                  />
                  <code>{(selectedFillRegion ? selectedFillRegionColor : settings.fillColor).toUpperCase()}</code>
                  {selectedFillRegion ? (
                    <button
                      type="button"
                      onClick={() => resetFillRegionColor(selectedFillRegion.id)}
                      aria-label="Use default fill"
                      title="Use default fill"
                    >
                      <RefreshCw size={14} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <div className="focus-console__swatches focus-console__swatches--color">
                  <span>
                    <i style={{ backgroundColor: settings.outlineColor }} aria-hidden="true" />
                    Outline
                  </span>
                  <span>
                    <i style={{ backgroundColor: settings.gridLineColor }} aria-hidden="true" />
                    Grid
                  </span>
                </div>
                <dl className="focus-console__summary-metrics">
                  <div>
                    <dt>Palette</dt>
                    <dd>{palette.length} {palette.length === 1 ? "color" : "colors"}</dd>
                  </div>
                </dl>
              </FocusConsoleShelfPanel>
            </div>

            <div className="editor-inspector__deck focus-console__detail">
              <div className="editor-inspector__body editor-inspector__panel-host focus-console__detail-scroll">
            {selectionInspector}

          <div
            id="editor-inspector-panel-graph"
            role="tabpanel"
            aria-labelledby="editor-inspector-tab-graph"
            className={`editor-inspector__tab-panel editor-inspector__tab-panel--document ${inspectorTab === "graph" ? "" : "hidden"}`}
            data-inspector-panel="document"
          >
            <InspectorSections label="Document">
            <InspectorGroup
              title="Physical sizing"
              tabLabel="Size"
              icon={<Ruler size={15} aria-hidden="true" />}
              priority="quiet"
              layout="flush"
            >
              <div className="editor-inspector__flat-section-heading">
                <span>Graph and artwork size</span>
                <span>
                  {roundMeasure(cmToUnit(settings.graphHeight * settings.cellSizeCm, settings.measurementUnit))}{" "}
                  {MEASUREMENT_UNIT_LABELS[settings.measurementUnit]} high
                </span>
              </div>
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
            </InspectorGroup>

            <InspectorGroup title="Grid" icon={<Grid3X3 size={15} aria-hidden="true" />}>
              <InspectorRow label="Line color" layout="inline">
                <InspectorColorControl label="Graph line color" value={settings.gridLineColor} onChange={(value) => updateSetting("gridLineColor", value)} />
              </InspectorRow>
              <InspectorRow label="Major every" layout="inline">
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

            <InspectorGroup title="Output summary" tabLabel="Output" icon={<Printer size={15} aria-hidden="true" />} priority="quiet">
              <InspectorMetricGrid label="Document output summary" className="editor-inspector-output-summary">
                <div><dt>Graph</dt><dd>{imageWidthCm} × {imageHeightCm} cm</dd></div>
                <div><dt>Print</dt><dd>{printWidthCm} × {printHeightCm} cm</dd></div>
                <div><dt>Grid</dt><dd>{GRAPH_LINE_LAYER_LABELS[settings.gridLineLayer]} / {settings.showNumbers ? GRID_NUMBER_PLACEMENT_LABELS[settings.gridNumberPlacement] : "No numbers"}</dd></div>
              </InspectorMetricGrid>
            </InspectorGroup>
            </InspectorSections>
          </div>

          <div
            id="editor-inspector-panel-draw"
            role="tabpanel"
            aria-labelledby="editor-inspector-tab-draw"
            className={`editor-inspector__tab-panel editor-inspector__tab-panel--create ${inspectorTab === "draw" ? "" : "hidden"}`}
            data-inspector-panel="create"
          >
            {drawTab === "shape" ? (
              <div
                className="editor-inspector__create-workbench"
                data-create-tool={drawingTool}
                data-shape-armed={armedShapeKind ? "true" : "false"}
              >
                <header className="editor-inspector__create-header">
                  <div className="editor-inspector__create-heading">
                    <span className="editor-inspector__create-icon" aria-hidden="true">
                      {drawingTool === "line" ? <Ruler size={17} /> : <Shapes size={17} />}
                    </span>
                    <div>
                      <span className="editor-inspector__focus-kicker">
                        {drawingTool === "line"
                          ? "Vector stroke"
                          : drawingTool === "shape"
                            ? "Cell shape"
                            : "Create"}
                      </span>
                      <h3>
                        {drawingTool === "line"
                          ? "Draw Line"
                          : drawingTool === "shape"
                            ? "Draw Shape"
                            : drawingTool === "lasso"
                              ? "Lasso region"
                              : "Choose a drawing tool"}
                      </h3>
                    </div>
                  </div>
                  <p>
                    {drawingTool === "line"
                      ? "Drag from a start point to an end point. A click alone does nothing."
                      : drawingTool === "shape"
                        ? "Choose a shape, then click a graph cell to place it at one-cell size."
                        : drawingTool === "lasso"
                          ? "Click to add vertices, then close the region near its starting point."
                          : "Select Draw Line or Draw Shape from the left tool deck."}
                  </p>
                </header>

                {drawingTool === "line" ? (
                  <div className="editor-inspector__create-content">
                    <section className="editor-inspector__create-section" aria-labelledby="create-line-kind-label">
                      <div className="editor-inspector__create-section-heading">
                        <span id="create-line-kind-label">Line type</span>
                        <span>Default: Line</span>
                      </div>
                      <div className="editor-inspector__kind-grid editor-inspector__kind-grid--line">
                        {OPEN_SHAPE_GENERATOR_KINDS.map((kind) => (
                          <button
                            key={`line-kind-${kind}`}
                            type="button"
                            onClick={() => setDraftShapeKind(kind)}
                            className="editor-inspector__kind-button"
                            data-active={draftShapeKind === kind ? "true" : "false"}
                            aria-pressed={draftShapeKind === kind}
                          >
                            <span className={`editor-inspector__line-sample is-${kind}`} aria-hidden="true" />
                            <strong>{GRAPH_SHAPE_KIND_LABELS[kind]}</strong>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="editor-inspector__create-section" aria-labelledby="create-line-style-label">
                      <div className="editor-inspector__create-section-heading">
                        <span id="create-line-style-label">Stroke</span>
                        <span>Applies before drawing</span>
                      </div>
                      <InspectorFieldGrid>
                        <NumberField
                          label="Thickness"
                          value={draftShapeStrokeWidth}
                          min={1}
                          max={24}
                          inputClassName={inspectorControlClass}
                          onChange={(value) => setDraftShapeStrokeWidth(Math.round(value))}
                        />
                        <InspectorSelect
                          label="Line style"
                          value={draftShapeStrokeStyle}
                          options={GRAPH_GRID_LINE_STYLE_KEYS.map((style) => ({
                            value: style,
                            label: `${style[0].toUpperCase()}${style.slice(1)}`,
                          }))}
                          onChange={(value) => setDraftShapeStrokeStyle(value as GraphGridLineStyle)}
                        />
                      </InspectorFieldGrid>
                      <ColorPresetField
                        label="Line color"
                        value={draftShapeStrokeColor}
                        onChange={setDraftShapeStrokeColor}
                      />
                    </section>

                    <div className="editor-inspector__alignment-note">
                      <span className="editor-inspector__alignment-glyph" aria-hidden="true">±5°</span>
                      <span>
                        Near-horizontal and near-vertical strokes align to the graph. Hold Alt for a free angle.
                      </span>
                    </div>
                  </div>
                ) : drawingTool === "shape" ? (
                  <div className="editor-inspector__create-content">
                    <section className="editor-inspector__create-section" aria-labelledby="create-shape-kind-label">
                      <div className="editor-inspector__create-section-heading">
                        <span id="create-shape-kind-label">Choose a shape</span>
                        <span>{armedShapeKind ? GRAPH_SHAPE_KIND_LABELS[armedShapeKind] : "Nothing selected"}</span>
                      </div>
                      <div className="editor-inspector__kind-grid editor-inspector__kind-grid--shape">
                        {CLOSED_SHAPE_GENERATOR_KINDS.map((kind) => (
                          <button
                            key={`closed-shape-kind-${kind}`}
                            type="button"
                            onClick={() => setDraftShapeKind(kind)}
                            className="editor-inspector__kind-button"
                            data-active={armedShapeKind === kind ? "true" : "false"}
                            aria-pressed={armedShapeKind === kind}
                          >
                            <span className={`editor-inspector__shape-glyph is-${kind}`} aria-hidden="true" />
                            <strong>{GRAPH_SHAPE_KIND_LABELS[kind]}</strong>
                          </button>
                        ))}
                      </div>
                    </section>

                    {armedShapeKind ? (
                      <section className="editor-inspector__create-section" aria-labelledby="create-shape-style-label">
                        <div className="editor-inspector__create-section-heading">
                          <span id="create-shape-style-label">Appearance</span>
                          <span>Placed at 1 × 1 cell</span>
                        </div>
                        <InspectorSegmented
                          label="Shape appearance"
                          value={draftShapeFillMode}
                          options={(["outline", "filled"] as ShapeFillMode[]).map((mode) => ({
                            value: mode,
                            label: GENERATED_SHAPE_FILL_MODE_LABELS[mode],
                          }))}
                          onChange={(value) => setDraftShapeFillMode(value as ShapeFillMode)}
                        />
                        <NumberField
                          label="Stroke width"
                          value={draftShapeStrokeWidth}
                          min={1}
                          max={24}
                          inputClassName={inspectorControlClass}
                          onChange={(value) => setDraftShapeStrokeWidth(Math.round(value))}
                        />
                        <ColorPresetField
                          label="Stroke color"
                          value={draftShapeStrokeColor}
                          onChange={setDraftShapeStrokeColor}
                        />
                        {draftShapeFillMode === "filled" ? (
                          <ColorPresetField
                            label="Fill color"
                            value={draftShapeFillColor}
                            onChange={setDraftShapeFillColor}
                            allowTransparent
                          />
                        ) : null}
                      </section>
                    ) : (
                      <div className="editor-inspector__shape-empty">
                        <Shapes size={20} aria-hidden="true" />
                        <strong>Select a shape to arm the canvas</strong>
                        <span>Graph clicks remain inactive until a shape is selected.</span>
                      </div>
                    )}
                  </div>
                ) : drawingTool === "lasso" ? (
                  <div className="editor-inspector__create-content">
                    <section className="editor-inspector__create-section" aria-labelledby="create-lasso-label">
                      <div className="editor-inspector__create-section-heading">
                        <span id="create-lasso-label">Lasso region</span>
                        <span>{lassoVertexCount ? `${lassoVertexCount} point${lassoVertexCount === 1 ? "" : "s"}` : "No points"}</span>
                      </div>
                      <InspectorSegmented
                        label="Lasso result"
                        value={lassoFill}
                        options={[
                          { value: "erase", label: "Erase" },
                          { value: "#ffffff", label: "White" },
                          { value: "#000000", label: "Black" },
                        ]}
                        onChange={(value) => setLassoFill(value as GraphEraseRegionFill | "erase")}
                      />
                      <div className="editor-inspector-action-strip" aria-label="Lasso actions">
                        <button type="button" onClick={commitLasso} disabled={lassoVertexCount < 3}>
                          <Check size={14} aria-hidden="true" />
                          Close region
                        </button>
                        <button type="button" onClick={cancelLasso} disabled={!lassoVertexCount}>
                          <RefreshCw size={14} aria-hidden="true" />
                          Cancel path
                        </button>
                      </div>
                      <p className="editor-inspector__hint">Click the starting point to close, Enter to apply, Escape to cancel, or Backspace to remove the last point.</p>
                    </section>
                  </div>
                ) : (
                  <div className="editor-inspector__create-content">
                    <div className="editor-inspector__shape-empty">
                      <MousePointer2 size={20} aria-hidden="true" />
                      <strong>No creation tool active</strong>
                      <span>Use the left tool deck to start drawing.</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <InspectorSections label="Create">
              <InspectorGroup title="Clipart Library" tabLabel="Library" icon={<ImageIcon size={15} aria-hidden="true" />}>
                <InspectorFieldGrid>
                  <NumberField
                    label="Width"
                    unit="cm"
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
                    value={draftClipartHeightCm}
                    min={0.01}
                    max={1000}
                    step={0.1}
                    allowDecimalInput
                    inputClassName={inspectorControlClass}
                    onChange={setDraftClipartHeightCm}
                  />
                </InspectorFieldGrid>
                <label className={`editor-inspector__upload-action ${uploadingCliparts ? "opacity-60" : ""}`}>
                  {uploadingCliparts ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
                  <span className="editor-inspector__upload-action-label">Upload cliparts</span>
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
                  <div className="editor-inspector__search-shell">
                    <Search size={14} className="editor-inspector__search-icon" aria-hidden="true" />
                    <input
                      type="text"
                      value={clipartSearch}
                      onChange={(event) => setClipartSearch(event.target.value)}
                      placeholder="Search clipart"
                      className="editor-inspector-control editor-inspector__search-input"
                    />
                  </div>
                </label>

                {settings.clipartAssets.length ? (
                  filteredClipartAssets.length ? (
                    <div className="editor-inspector__clipart-grid">
                      {filteredClipartAssets.map((asset) => {
                        const selected = selectedClipartAsset?.id === asset.id;
                        const previewUrl = asset.thumbUrl ?? asset.url ?? asset.dataUrl ?? null;
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
                            aria-pressed={selected}
                          >
                            {previewUrl ? (
                              <img src={previewUrl} alt="" className="h-11 w-11 rounded border border-[var(--editor-line)] bg-[var(--artboard-bg)] object-contain p-1" />
                            ) : (
                              <span className="grid h-11 w-11 place-items-center rounded border border-[var(--editor-line)] bg-[var(--artboard-bg)] text-[var(--editor-muted)]">
                                <ImageIcon size={15} aria-hidden="true" />
                              </span>
                            )}
                            <span className="editor-inspector__clipart-copy min-w-0">
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
            </InspectorSections>
            )}

          </div>

        <div
          id="editor-inspector-panel-palette"
          role="tabpanel"
          aria-labelledby="editor-inspector-tab-palette"
          className={`editor-inspector__tab-panel editor-inspector__tab-panel--color ${inspectorTab === "palette" ? "" : "hidden"}`}
          data-inspector-panel="color"
        >
          <InspectorSections label="Color">
            <InspectorGroup title="Fill color" tabLabel="Fill" icon={<Palette size={15} aria-hidden="true" />}>
              {selectedFillRegion ? (
                <ColorPresetField
                  label={
                    selectedFillRegion.id.startsWith("generated:")
                      ? "Generated artwork fill"
                      : selectedFillRegion.kind === "source"
                        ? "Source region fill"
                        : "Manual region fill"
                  }
                  value={selectedFillRegionColor}
                  onChange={(value) => updateFillRegionColor(selectedFillRegion.id, value)}
                  allowTransparent
                  expanded={!collapsedSections.selectedFill}
                  onExpandedChange={() => toggleSection("selectedFill")}
                />
              ) : null}
              <ColorPresetField
                label="Default fill"
                value={settings.fillColor}
                onChange={(value) => updateSetting("fillColor", value)}
                allowTransparent
                expanded={!collapsedSections.fill}
                onExpandedChange={() => toggleSection("fill")}
              />
            </InspectorGroup>
            <InspectorGroup title="Artwork colors" tabLabel="Artwork" icon={<Palette size={15} aria-hidden="true" />}>
              {!selectedFillRegion ? (
                <div className="editor-inspector-context-hint">
                  <Palette size={15} aria-hidden="true" />
                  Select a filled region on the canvas to override it independently.
                </div>
              ) : null}
              <ColorPresetField
                label="Outline"
                value={settings.outlineColor}
                onChange={updateOutlineColor}
                expanded={!collapsedSections.outline}
                onExpandedChange={() => toggleSection("outline")}
              />
            </InspectorGroup>
            <InspectorGroup title="Graph color" tabLabel="Grid" icon={<Grid3X3 size={15} aria-hidden="true" />} priority="quiet">
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
            <InspectorGroup title="Chart palette" tabLabel="Palette" icon={<Palette size={15} aria-hidden="true" />} priority="quiet">
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
                        {color.cellCount.toLocaleString("en-US")} cells
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
          </InspectorSections>
        </div>
        </div>
      </div>
      </div>
      </div>
      </div>

    </aside>
  );
}
