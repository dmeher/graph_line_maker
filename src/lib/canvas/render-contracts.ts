import type { GraphSettings, PaletteColor } from "@/lib/types";
import type { FillRegion } from "@/lib/canvas/processor";

export type StageRevisions = {
  source: number;
  vector: number;
  placement: number;
  mask: number;
  fill: number;
  manual: number;
  grid: number;
  presentation: number;
};

export type RenderMode = "draft" | "full";

export type PreparedImageLayer = {
  id: string;
  kind: "source" | "clipart";
  bitmap: ImageBitmap;
  contentBounds: { x: number; y: number; width: number; height: number };
  rotationDegrees: number;
  flipX: boolean;
  flipY: boolean;
  settings: GraphSettings;
  revisions: Pick<StageRevisions, "source" | "vector" | "placement" | "mask">;
};

export type RenderResponseMetadata = {
  requestId: number;
  documentRevision: number;
  mode: RenderMode;
  palette: PaletteColor[];
  fillRegions: FillRegion[];
  fillRegionMap: Uint16Array;
  timings: Record<string, number>;
  estimatedRetainedBytes: number;
};
