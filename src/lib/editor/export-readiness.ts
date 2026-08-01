export type GraphExportCanvas = {
  width: number;
  height: number;
};

export type GraphExportBlockReason =
  | "failed-render"
  | "processing"
  | "drag-preview"
  | "missing-canvas"
  | "outdated-frame";

export type GraphExportReadinessInput = {
  currentRenderFailed: boolean;
  processing: boolean;
  hasDragPreview: boolean;
  renderedSignature: string | null;
  currentSignature: string;
  canvas: GraphExportCanvas | null;
  expectedCanvasWidth: number;
  expectedCanvasHeight: number;
};

function normalizedCanvasDimension(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/**
 * Canvas-output actions must consume the settled frame for the current settings.
 * A queued debounce has `processing === false`, so the processed signature and
 * expected dimensions are both checked as well.
 */
export function graphExportBlockReason(input: GraphExportReadinessInput): GraphExportBlockReason | null {
  if (input.currentRenderFailed) return "failed-render";
  if (input.processing) return "processing";
  if (input.hasDragPreview) return "drag-preview";
  if (!input.canvas) return "missing-canvas";

  const canvasWidth = normalizedCanvasDimension(input.canvas.width);
  const canvasHeight = normalizedCanvasDimension(input.canvas.height);
  const expectedWidth = normalizedCanvasDimension(input.expectedCanvasWidth);
  const expectedHeight = normalizedCanvasDimension(input.expectedCanvasHeight);
  if (
    input.renderedSignature !== input.currentSignature ||
    !canvasWidth ||
    !canvasHeight ||
    canvasWidth !== expectedWidth ||
    canvasHeight !== expectedHeight
  ) {
    return "outdated-frame";
  }

  return null;
}
