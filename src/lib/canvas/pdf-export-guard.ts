import { GRAPH_MAJOR_CELL_PIXELS } from "../graph-paper.ts";

type GraphCanvasDimensions = {
  width: number;
  height: number;
};

type GraphCellDimensions = {
  graphWidth: number;
  graphHeight: number;
};

function positiveInteger(value: unknown, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
}

/** A settled graph canvas has exactly one 40 px major cell for every graph cell. */
export function isGraphCanvasSizedForSettings(canvas: GraphCanvasDimensions, settings: GraphCellDimensions) {
  return (
    Math.round(canvas.width) === positiveInteger(settings.graphWidth) * GRAPH_MAJOR_CELL_PIXELS
    && Math.round(canvas.height) === positiveInteger(settings.graphHeight) * GRAPH_MAJOR_CELL_PIXELS
  );
}
