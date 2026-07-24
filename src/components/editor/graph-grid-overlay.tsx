"use client";

import { useMemo, type CSSProperties } from "react";
import {
  GRAPH_MINOR_PIXEL_SIZE,
  type GraphGridLineStyle,
  type GraphGridPattern,
  type MajorGridEvery,
} from "@/lib/graph-paper";
import {
  GRID_BUCKET_ORDER,
  GRID_BUCKET_OPACITY,
  GRID_BUCKET_WIDTH_UNITS,
  gridBucketForIndex,
  majorEveryMinorFor,
  type GridBucket,
} from "@/lib/canvas/grid-style";

/**
 * Crisp graph-paper grid drawn as an SVG overlay above the (transparent) artwork
 * canvas. Line positions match the export grid (spacing = GRAPH_MINOR_PIXEL_SIZE),
 * and widths are in viewBox units so strokes scale with zoom like real graph paper
 * while the SVG keeps every line crisp. Weights/opacities are shared with the
 * export vector grid via `@/lib/canvas/grid-style`.
 */

function clampThickness(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(10, Math.round(value)));
}

function dashArrayFor(style: GraphGridLineStyle): string | undefined {
  if (style === "dashed") return "10 6";
  if (style === "dotted") return "1 5";
  return undefined;
}

export type GraphGridOverlayProps = {
  /** Artwork-canvas pixel size; used as the SVG viewBox so lines align with export. */
  graphPixelWidth: number;
  graphPixelHeight: number;
  /** On-screen size (graph pixels * zoom). */
  displayWidth: number;
  displayHeight: number;
  gridLineColor: string;
  gridLineThickness: number;
  majorGridEvery: MajorGridEvery;
  gridLineStyle: GraphGridLineStyle;
  gridPattern: GraphGridPattern;
  style?: CSSProperties;
};

export function GraphGridOverlay({
  graphPixelWidth,
  graphPixelHeight,
  displayWidth,
  displayHeight,
  gridLineColor,
  gridLineThickness,
  majorGridEvery,
  gridLineStyle,
  gridPattern,
  style,
}: GraphGridOverlayProps) {
  const width = Math.max(1, Math.round(graphPixelWidth));
  const height = Math.max(1, Math.round(graphPixelHeight));

  const geometry = useMemo(() => {
    const minor = GRAPH_MINOR_PIXEL_SIZE;
    const columns = Math.max(1, Math.round(width / minor));
    const rows = Math.max(1, Math.round(height / minor));
    const majorEveryMinor = majorEveryMinorFor(majorGridEvery);

    if (gridPattern === "dot") {
      // Dots at grid intersections, tiled via <pattern> so the DOM stays tiny.
      const dots = GRID_BUCKET_ORDER.map((bucket) => {
        const step = bucket === "major" ? majorEveryMinor * minor : bucket === "strong" ? majorEveryMinor * minor : bucket === "mid" ? 5 * minor : minor;
        return { bucket, step };
      });
      return { kind: "dot" as const, dots };
    }

    const paths: Record<GridBucket, string> = { minor: "", mid: "", strong: "", major: "" };
    for (let column = 0; column <= columns; column += 1) {
      const x = column * minor;
      paths[gridBucketForIndex(column, majorEveryMinor)] += `M${x} 0V${height}`;
    }
    for (let row = 0; row <= rows; row += 1) {
      const y = row * minor;
      paths[gridBucketForIndex(row, majorEveryMinor)] += `M0 ${y}H${width}`;
    }
    return { kind: "line" as const, paths };
  }, [width, height, majorGridEvery, gridPattern]);

  const base = clampThickness(gridLineThickness);
  const dashArray = dashArrayFor(gridLineStyle);
  // Widths are in viewBox units (GRAPH_MAJOR_CELL_PIXELS per cell) so strokes
  // SCALE with zoom like real graph paper: the thickness-to-cell ratio stays
  // constant, keeping the three-tier hierarchy visible at every zoom while the
  // SVG keeps every line crisp. Shared with the export grid via grid-style.
  const strokeWidthFor = (bucket: GridBucket) => GRID_BUCKET_WIDTH_UNITS[bucket] * base;

  return (
    <svg
      className="pointer-events-none absolute"
      // overflow visible so the edge/border lines (centered on the viewBox
      // boundary) render at full width instead of being half-clipped.
      style={{ overflow: "visible", ...style }}
      width={Math.max(1, displayWidth)}
      height={Math.max(1, displayHeight)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {geometry.kind === "dot" ? (
        <>
          <defs>
            {geometry.dots.map(({ bucket, step }) => {
              const radius = Math.max(0.3, strokeWidthFor(bucket) * 0.9);
              return (
                <pattern key={bucket} id={`grid-dot-${bucket}-${step}`} width={step} height={step} patternUnits="userSpaceOnUse">
                  <circle cx={0} cy={0} r={radius} fill={gridLineColor} opacity={GRID_BUCKET_OPACITY[bucket]} />
                </pattern>
              );
            })}
          </defs>
          {geometry.dots.map(({ bucket, step }) => (
            <rect key={bucket} x={0} y={0} width={width} height={height} fill={`url(#grid-dot-${bucket}-${step})`} />
          ))}
        </>
      ) : (
        GRID_BUCKET_ORDER.map((bucket) =>
          geometry.paths[bucket] ? (
            <path
              key={bucket}
              d={geometry.paths[bucket]}
              stroke={gridLineColor}
              strokeWidth={strokeWidthFor(bucket)}
              strokeOpacity={GRID_BUCKET_OPACITY[bucket]}
              strokeDasharray={dashArray}
              strokeLinecap={gridLineStyle === "dotted" ? "round" : "butt"}
              fill="none"
            />
          ) : null,
        )
      )}
    </svg>
  );
}
