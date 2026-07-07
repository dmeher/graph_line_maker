export type GridNumberLabel = {
  value: number;
  x: number;
  y: number;
};

export type GridNumberLabels = {
  top: GridNumberLabel[];
  bottom: GridNumberLabel[];
  left: GridNumberLabel[];
  right: GridNumberLabel[];
};

export function createGridNumberLabels(graphWidth: number, graphHeight: number, cellWidth: number, cellHeight: number): GridNumberLabels {
  const safeGraphWidth = Math.max(1, Math.round(graphWidth || 1));
  const safeGraphHeight = Math.max(1, Math.round(graphHeight || 1));
  const safeCellWidth = Math.max(1, cellWidth || 1);
  const safeCellHeight = Math.max(1, cellHeight || 1);

  const top = Array.from({ length: safeGraphWidth }, (_, index) => ({
    value: index + 1,
    x: Math.round((index + 0.5) * safeCellWidth),
    y: Math.round(safeCellHeight * 0.28),
  }));
  const bottom = top.map((label) => ({
    ...label,
    y: Math.round(safeGraphHeight * safeCellHeight - safeCellHeight * 0.18),
  }));
  const left = Array.from({ length: safeGraphHeight }, (_, index) => ({
    value: index + 1,
    x: Math.round(safeCellWidth * 0.18),
    y: Math.round((index + 0.55) * safeCellHeight),
  }));
  const right = left.map((label) => ({
    ...label,
    x: Math.round(safeGraphWidth * safeCellWidth - safeCellWidth * 0.18),
  }));

  return { top, bottom, left, right };
}

