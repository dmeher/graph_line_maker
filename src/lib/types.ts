import type {
  GraphGridLineStyle,
  GraphGridPattern,
  GraphImageColorQuantization,
  GraphImageDenoiseLevel,
  GraphImageEdgeDetection,
  GraphImageTraceEngine,
  GraphVectorizerFidelity,
  GraphLineLayer,
  MajorGridEvery,
  PrintHorizontalAlignment,
  PrintOrientation,
  PrintPaperSize,
  PrintVerticalAlignment,
} from "@/lib/graph-paper";

export type AppRole = "admin" | "member";
export type AppUserStatus = "active" | "inactive";

export type AppUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: AppRole;
  status: AppUserStatus;
  invitedByEmail: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CurrentSession = {
  userId: string;
  email: string;
  role: AppRole;
  displayName: string | null;
};

export type PaletteColor = {
  id?: string;
  name: string;
  hex: string;
  locked: boolean;
  cellCount: number;
  sortOrder: number;
};

export type GraphRotationDegrees = number;

/**
 * A freehand erase stroke stored in resolution-independent coordinates:
 * `points` are normalized UV positions (0..1) across the image's working canvas
 * and `radius` is a fraction of the canvas width. This keeps strokes aligned
 * when working canvases are downscaled to the shared pixel budget.
 */
/**
 * `circle`/`square` are brush footprints stamped along a freehand path.
 * `polygon` is different in kind: its points are the **vertices of a closed
 * region**, not a path, and the whole region is affected at once.
 */
export type GraphEraseBrushShape = "circle" | "square" | "polygon";

/**
 * Paint applied to a closed polygon region. Absent means erase (the region
 * becomes transparent), which is the default and the only behaviour brush
 * strokes have. White and black paint over the artwork instead, matching the
 * canvas colour policy in `graph-paper.ts`.
 */
export type GraphEraseRegionFill = "#ffffff" | "#000000";

export type GraphEraseStroke = {
  points: { x: number; y: number }[];
  radius: number;
  /** Brush footprint. Optional; strokes saved before square existed are circles. */
  shape?: GraphEraseBrushShape;
  /** Polygon regions only. Absent = erase to transparent. */
  fill?: GraphEraseRegionFill;
};

/** Non-destructive background-removal configuration for an image layer. */
export type GraphBackgroundRemoval = {
  enabled: boolean;
  /** 0..1 colour-distance threshold; higher removes more of the background. */
  tolerance: number;
};

/** A named grouping of selectable layers, referenced by each member's `groupId`. */
export type GraphLayerGroup = {
  id: string;
  name: string;
};

export type GraphSourceImage = {
  id: string;
  name: string;
  path: string | null;
  url?: string | null;
  /**
   * Bounded WebP derivative used by list and grid views. Persisted; null on
   * assets uploaded before derivatives existed, which fall back to `url`.
   */
  thumbPath?: string | null;
  /** Signed gateway URL for `thumbPath`; derived per request, never persisted. */
  thumbUrl?: string | null;
  width: number;
  height: number;
  measurementUnit: MeasurementUnit;
  imageLineThickness: number;
  sourceFillThreshold: number;
  sourceFillMinStrokePixels: number;
  strokeGapClosePixels: number;
  imageAutoEnhance: boolean;
  imageDenoiseLevel: GraphImageDenoiseLevel;
  imageEdgeDetection: GraphImageEdgeDetection;
  imageColorQuantization: GraphImageColorQuantization;
  vectorizerLineAdjust: number;
  vectorizerInkThreshold: number;
  /** Erosion steps used to strip interior sketch/hatch strokes. 0 = off. Optional for projects saved before the setting existed. */
  vectorizerSketchRemoval?: number;
  vectorizerFidelity: GraphVectorizerFidelity;
  x: number;
  y: number;
  topPadding: number;
  bottomPadding: number;
  locked: boolean;
  visible: boolean;
  rotationDegrees: GraphRotationDegrees;
  flipX: boolean;
  flipY: boolean;
  /** Optional group membership; layers sharing a `groupId` select/move/copy together. */
  groupId?: string | null;
  /** Reversible erase strokes applied to the working image before vectorization. */
  eraseStrokes?: GraphEraseStroke[];
  /** Non-destructive background removal applied to the working image. */
  backgroundRemoval?: GraphBackgroundRemoval;
};

export type MeasurementUnit = "cm" | "in";
export type GraphCellLineSide = "top" | "right" | "bottom" | "left";

export type GraphCellPaint = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sides: GraphCellLineSide[];
  lineColor: string;
  fillColor: string;
  lineWidth: number;
  locked: boolean;
  visible: boolean;
  rotationDegrees: GraphRotationDegrees;
  flipX: boolean;
  flipY: boolean;
  groupId?: string | null;
};

export type GraphShapeKind = "square" | "rectangle" | "circle" | "oval" | "half-circle" | "line" | "arrow";

export type GraphShapeDrawing = {
  id: string;
  name: string;
  kind: GraphShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  sides: GraphCellLineSide[];
  locked: boolean;
  visible: boolean;
  rotationDegrees: GraphRotationDegrees;
  flipX: boolean;
  flipY: boolean;
  groupId?: string | null;
};

export type GraphClipartAsset = {
  id: string;
  name: string;
  path: string | null;
  url?: string | null;
  /**
   * Bounded WebP derivative used by the library grid, which renders assets into
   * 40x40 boxes. Persisted; null on assets uploaded before derivatives existed.
   */
  thumbPath?: string | null;
  /** Signed gateway URL for `thumbPath`; derived per request, never persisted. */
  thumbUrl?: string | null;
  dataUrl?: string | null;
  mimeType: string;
  width: number;
  height: number;
  createdAt: string;
};

export type GraphClipartImage = {
  id: string;
  name: string;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor: string;
  imageLineThickness: number;
  sourceFillThreshold: number;
  sourceFillMinStrokePixels: number;
  strokeGapClosePixels: number;
  imageAutoEnhance: boolean;
  imageDenoiseLevel: GraphImageDenoiseLevel;
  imageEdgeDetection: GraphImageEdgeDetection;
  imageColorQuantization: GraphImageColorQuantization;
  vectorizerLineAdjust: number;
  vectorizerInkThreshold: number;
  /** Erosion steps used to strip interior sketch/hatch strokes. 0 = off. Optional for projects saved before the setting existed. */
  vectorizerSketchRemoval?: number;
  vectorizerFidelity: GraphVectorizerFidelity;
  locked: boolean;
  visible: boolean;
  rotationDegrees: GraphRotationDegrees;
  flipX: boolean;
  flipY: boolean;
  groupId?: string | null;
  eraseStrokes?: GraphEraseStroke[];
  backgroundRemoval?: GraphBackgroundRemoval;
};

export type GraphSettings = {
  graphWidth: number;
  graphHeight: number;
  cellWidth: number;
  cellHeight: number;
  cellSizeCm: number;
  measurementUnit: MeasurementUnit;
  printPaperSize: PrintPaperSize;
  printOrientation: PrintOrientation;
  printHorizontalAlignment: PrintHorizontalAlignment;
  printVerticalAlignment: PrintVerticalAlignment;
  pixelSize: number;
  gridCellSize: number;
  outputWidth: number;
  outputHeight: number;
  backgroundColor: string;
  lineColor: string;
  outlineColor: string;
  fillColor: string;
  fillRegions: Record<string, string>;
  imageLineThickness: number;
  sourceFillThreshold: number;
  sourceFillMinStrokePixels: number;
  strokeGapClosePixels: number;
  imageAutoEnhance: boolean;
  imageDenoiseLevel: GraphImageDenoiseLevel;
  imageEdgeDetection: GraphImageEdgeDetection;
  imageColorQuantization: GraphImageColorQuantization;
  imageTraceEngine: GraphImageTraceEngine;
  vectorizerStrokeWidth: number;
  vectorizerStrokeColor: string;
  vectorizerLineAdjust: number;
  vectorizerInkThreshold: number;
  /** Erosion steps used to strip interior sketch/hatch strokes. 0 = off. Optional for projects saved before the setting existed. */
  vectorizerSketchRemoval?: number;
  vectorizerFidelity: GraphVectorizerFidelity;
  gridLineColor: string;
  gridLineLayer: GraphLineLayer;
  gridLineStyle: GraphGridLineStyle;
  gridPattern: GraphGridPattern;
  gridLineThickness: number;
  showBorder: boolean;
  transparentBackground: boolean;
  showNumbers: boolean;
  gridNumberPlacement: "inside" | "outside";
  showPageBreaks: boolean;
  majorGridEvery: MajorGridEvery;
  imageWidth: number;
  imageHeight: number;
  sourceImages: GraphSourceImage[];
  cellPaints: GraphCellPaint[];
  graphShapes: GraphShapeDrawing[];
  clipartAssets: GraphClipartAsset[];
  clipartImages: GraphClipartImage[];
  layerGroups?: GraphLayerGroup[];
  imagePadding: number;
  imageOffsetX: number;
  imageOffsetY: number;
  spotPadding: number;
  spotShape: "round" | "square";
  pageMargin: number;
  blackAndWhite: boolean;
  limitedColorMode: boolean;
  maxColors: 2 | 4 | 8 | 16;
};

export type Project = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  originalImagePath: string | null;
  processedImagePath: string | null;
  settings: GraphSettings;
  width: number;
  height: number;
  pixelSize: number;
  gridCellSize: number;
  colorCount: number;
  createdAt: string;
  updatedAt: string;
  palettes: PaletteColor[];
  originalImageUrl?: string | null;
  processedImageUrl?: string | null;
  /**
   * Bounded WebP derivative of the processed image, rendered by dashboard cards.
   * Null for projects saved before derivatives existed; those fall back to the
   * full-size processed image.
   */
  processedThumbPath?: string | null;
  /** Signed gateway URL for `processedThumbPath`; derived per request. */
  processedThumbUrl?: string | null;
};

export type ProjectSummary = Omit<Project, "settings" | "palettes"> & {
  palettePreview: PaletteColor[];
};

export type ActionResult<T = undefined> = T extends undefined
  ? { ok: true; message?: string } | { ok: false; message: string }
  : { ok: true; data: T; message?: string } | { ok: false; message: string };
