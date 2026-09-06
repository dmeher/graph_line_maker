import type { CSSProperties } from "react";
import { GRID_BUCKET_OPACITY, GRID_BUCKET_WIDTH_UNITS } from "@/lib/canvas/grid-style";
import {
  verticalSplitBoundaryPixelPositions,
  verticalSplitPixelRanges,
} from "@/lib/canvas/vertical-splits";
import type { GraphGridLineStyle } from "@/lib/graph-paper";
import type { GraphVerticalSplit } from "@/lib/types";

function clampThickness(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(10, Math.round(value)));
}

function dashArrayFor(style: GraphGridLineStyle): string | undefined {
  if (style === "dashed") return "10 6";
  if (style === "dotted") return "1 5";
  return undefined;
}

export function GraphVerticalSplitOverlay({
  verticalSplits,
  graphWidth,
  graphPixelWidth,
  graphPixelHeight,
  displayWidth,
  displayHeight,
  gridLineColor,
  gridLineThickness,
  gridLineStyle,
  style,
}: {
  verticalSplits: readonly GraphVerticalSplit[];
  graphWidth: number;
  graphPixelWidth: number;
  graphPixelHeight: number;
  displayWidth: number;
  displayHeight: number;
  gridLineColor: string;
  gridLineThickness: number;
  gridLineStyle: GraphGridLineStyle;
  style?: CSSProperties;
}) {
  const width = Math.max(1, Math.round(graphPixelWidth));
  const height = Math.max(1, Math.round(graphPixelHeight));
  const ranges = verticalSplitPixelRanges(verticalSplits, graphWidth, width);
  if (!ranges.length) return null;

  const boundaries = verticalSplitBoundaryPixelPositions(verticalSplits, graphWidth, width);
  const strokeWidth = GRID_BUCKET_WIDTH_UNITS.major * clampThickness(gridLineThickness);
  const dashArray = dashArrayFor(gridLineStyle);

  return (
    <svg
      className="pointer-events-none absolute z-[15]"
      style={{ overflow: "visible", ...style }}
      width={Math.max(1, displayWidth)}
      height={Math.max(1, displayHeight)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {ranges.map((range) => (
        <rect
          key={`${range.startX}-${range.endX}`}
          x={range.startX}
          y={0}
          width={range.endX - range.startX}
          height={height}
          fill="#ffffff"
        />
      ))}
      <path
        d={boundaries.map((x) => `M${x} 0V${height}`).join("")}
        stroke={gridLineColor}
        strokeWidth={strokeWidth}
        strokeOpacity={GRID_BUCKET_OPACITY.major}
        strokeDasharray={dashArray}
        strokeLinecap={gridLineStyle === "dotted" ? "round" : "butt"}
        fill="none"
      />
    </svg>
  );
}
