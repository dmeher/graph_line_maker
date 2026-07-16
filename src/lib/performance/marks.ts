export type GraphPerformanceStage =
  | "decode"
  | "vector-request"
  | "svg-rasterization"
  | "mask-creation"
  | "region-labeling"
  | "composition"
  | "paint"
  | "export"
  | "cache-hit";

type PerformanceDetail = Record<string, string | number | boolean | null | undefined>;

let nextMeasureId = 1;

function enabled() {
  return process.env.NODE_ENV === "development" && typeof performance !== "undefined";
}

export function startGraphPerformanceStage(stage: GraphPerformanceStage, detail: PerformanceDetail = {}) {
  if (!enabled()) return () => 0;
  const id = nextMeasureId++;
  const start = `graph-pixel:${stage}:${id}:start`;
  const end = `graph-pixel:${stage}:${id}:end`;
  performance.mark(start, { detail });

  return (endDetail: PerformanceDetail = {}) => {
    performance.mark(end, { detail: { ...detail, ...endDetail } });
    const measure = performance.measure(`graph-pixel:${stage}`, {
      start,
      end,
      detail: { ...detail, ...endDetail },
    });
    performance.clearMarks(start);
    performance.clearMarks(end);
    if (measure.duration > 50) {
      console.info(`[graph-pixel] ${stage} long task candidate: ${measure.duration.toFixed(1)}ms`, measure.detail);
    }
    return measure.duration;
  };
}

export function markGraphCacheHit(cache: string, bytes = 0) {
  if (!enabled()) return;
  performance.mark("graph-pixel:cache-hit", { detail: { cache, bytes } });
}

export function estimateCanvasBytes(canvases: Iterable<{ width: number; height: number }>) {
  let bytes = 0;
  for (const canvas of canvases) bytes += Math.max(0, canvas.width) * Math.max(0, canvas.height) * 4;
  return bytes;
}
