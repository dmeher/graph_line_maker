import type { GraphLineLayer, PrintHorizontalAlignment, PrintOrientation, PrintPaperSize, PrintVerticalAlignment } from "@/lib/graph-paper";

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
  x: number;
  y: number;
  topPadding: number;
  bottomPadding: number;
  locked: boolean;
  rotationDegrees: GraphRotationDegrees;
  flipX: boolean;
  flipY: boolean;
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
  rotationDegrees: GraphRotationDegrees;
  flipX: boolean;
  flipY: boolean;
};

export type GraphShapeKind = "square" | "rectangle" | "circle" | "oval" | "line" | "arrow";

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
  locked: boolean;
  rotationDegrees: GraphRotationDegrees;
  flipX: boolean;
  flipY: boolean;
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
  gridLineColor: string;
  gridLineLayer: GraphLineLayer;
  gridLineThickness: number;
  showBorder: boolean;
  transparentBackground: boolean;
  showNumbers: boolean;
  gridNumberPlacement: "inside" | "outside";
  showPageBreaks: boolean;
  majorGridEvery: 5 | 10;
  imageWidth: number;
  imageHeight: number;
  sourceImages: GraphSourceImage[];
  cellPaints: GraphCellPaint[];
  graphShapes: GraphShapeDrawing[];
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
