export const DESIGN_DOCUMENT_VERSION = 1 as const;
export const DESIGN_BLEND_MODES = ["normal", "multiply", "screen", "overlay", "darken", "lighten"] as const;
export type DesignBlendMode = (typeof DESIGN_BLEND_MODES)[number];
export type DesignKind = "document" | "template";
export type DesignLibraryKind = "design" | "clipart";

export type DesignPoint = { x: number; y: number };
export type DesignCrop = { x: number; y: number; width: number; height: number };

export type DesignMaskOperation =
  | { id: string; kind: "brush"; mode: "erase" | "restore"; radius: number; points: DesignPoint[] }
  | { id: string; kind: "lasso"; mode: "erase" | "restore"; points: DesignPoint[] };

export type DesignImageAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
};

export type DesignNodeBase = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  opacity: number;
  blendMode: DesignBlendMode;
  visible: boolean;
  locked: boolean;
  parentId: string | null;
};

export type DesignImageNode = DesignNodeBase & {
  type: "image";
  fileId: string;
  crop: DesignCrop;
  masks: DesignMaskOperation[];
  adjustments: DesignImageAdjustments;
};

export type DesignTextRun = {
  start: number;
  end: number;
  fill?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
};

export type DesignTextNode = DesignNodeBase & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  align: "left" | "center" | "right" | "justify";
  lineHeight: number;
  letterSpacing: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  runs: DesignTextRun[];
};

export type DesignShapeNode = DesignNodeBase & {
  type: "shape";
  shape: "rectangle" | "ellipse" | "polygon" | "line" | "arrow";
  points: DesignPoint[];
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash: number[];
  cornerRadius: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
};

export type DesignPathNode = DesignNodeBase & {
  type: "path";
  points: DesignPoint[];
  stroke: string;
  strokeWidth: number;
  opacity: number;
  tool: "pencil" | "marker";
};

export type DesignGroupNode = DesignNodeBase & {
  type: "group";
  childIds: string[];
};

export type DesignNode = DesignImageNode | DesignTextNode | DesignShapeNode | DesignPathNode | DesignGroupNode;

export type DesignDocumentV1 = {
  version: typeof DESIGN_DOCUMENT_VERSION;
  canvas: { width: number; height: number; background: string | null };
  nodes: DesignNode[];
};

export type DesignFile = {
  id: string;
  designId: string;
  name: string;
  path: string;
  thumbPath: string | null;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
  thumbUrl: string | null;
};

export type Design = {
  id: string;
  userId: string;
  kind: DesignKind;
  title: string;
  document: DesignDocumentV1;
  revision: number;
  previewPath: string | null;
  previewThumbPath: string | null;
  previewUrl: string | null;
  previewThumbUrl: string | null;
  ownerEmail: string;
  ownerDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  files: DesignFile[];
};

export type DesignSummary = Omit<Design, "document" | "files"> & { nodeCount: number };

export type DesignLibraryItem = {
  id: string;
  userId: string;
  kind: DesignLibraryKind;
  title: string;
  tags: string[];
  path: string;
  thumbPath: string | null;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  sourceDesignId: string | null;
  ownerEmail: string;
  ownerDisplayName: string | null;
  url: string | null;
  thumbUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_DESIGN_ADJUSTMENTS: DesignImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  blur: 0,
  grayscale: false,
  sepia: false,
  invert: false,
};
