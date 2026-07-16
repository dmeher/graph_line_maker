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

/** A freehand erase stroke stored in the image's own (source-local) pixel space. */
export type GraphEraseStroke = {
  points: { x: number; y: number }[];
  radius: number;
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
};

export type ProjectSummary = Omit<Project, "settings" | "palettes"> & {
  palettePreview: PaletteColor[];
};

export type ActionResult<T = undefined> = T extends undefined
  ? { ok: true; message?: string } | { ok: false; message: string }
  : { ok: true; data: T; message?: string } | { ok: false; message: string };
