import { pixelateLayeredImages, type FillRegion, type FittedImageLayer, type ProcessedGraph } from "@/lib/canvas/processor";
import type { PaletteColor, GraphSettings } from "@/lib/types";

type WorkerResponse = {
  requestId: number;
  ok: boolean;
  error?: string;
  bitmap?: ImageBitmap;
  width?: number;
  height?: number;
  palette?: PaletteColor[];
  fillRegions?: FillRegion[];
  fillRegionMap?: Uint16Array;
};

type PendingRequest = {
  resolve: (result: ProcessedGraph) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  abort: () => void;
};

let sharedWorker: Worker | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();

function supportsCanvasWorker() {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap === "function"
  );
}

function processingAbortError() {
  const error = new Error("Image processing was cancelled.");
  error.name = "AbortError";
  return error;
}

function isDrawableCanvas(canvas: HTMLCanvasElement | null | undefined) {
  return Boolean(canvas && Number.isFinite(canvas.width) && Number.isFinite(canvas.height) && canvas.width > 0 && canvas.height > 0);
}

function detachPendingRequest(requestId: number) {
  const pending = pendingRequests.get(requestId);
  if (!pending) return null;
  pending.signal?.removeEventListener("abort", pending.abort);
  pendingRequests.delete(requestId);
  return pending;
}

function resetWorker(error: Error) {
  sharedWorker?.terminate();
  sharedWorker = null;
  for (const [requestId] of pendingRequests) {
    detachPendingRequest(requestId)?.reject(error);
  }
}

function resultFromWorkerResponse(data: WorkerResponse): ProcessedGraph {
  if (!data.ok || !data.bitmap || !data.fillRegionMap || !data.palette || !data.fillRegions) {
    throw new Error(data.error || "Unable to process image.");
  }

  const width = Number(data.width ?? data.bitmap.width);
  const height = Number(data.height ?? data.bitmap.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || data.bitmap.width <= 0 || data.bitmap.height <= 0) {
    data.bitmap.close();
    throw new Error("Image processing returned an empty canvas.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    data.bitmap.close();
    throw new Error("Canvas is not available.");
  }
  context.drawImage(data.bitmap, 0, 0);
  data.bitmap.close();
  return {
    canvas,
    palette: data.palette,
    fillRegions: data.fillRegions,
    fillRegionMap: data.fillRegionMap,
  };
}

function getSharedWorker() {
  if (sharedWorker) return sharedWorker;
  const worker = new Worker(new URL("./processor.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const pending = detachPendingRequest(event.data.requestId);
    if (!pending) {
      event.data.bitmap?.close();
      return;
    }
    try {
      pending.resolve(resultFromWorkerResponse(event.data));
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error("Unable to process image."));
    }
  };
  worker.onerror = (event) => {
    resetWorker(new Error(event.message || "Unable to process image."));
  };
  sharedWorker = worker;
  return worker;
}

async function pixelateLayeredImagesInWorker(
  layers: FittedImageLayer[],
  settings: GraphSettings,
  signal?: AbortSignal,
): Promise<ProcessedGraph> {
  if (signal?.aborted) throw processingAbortError();

  const drawableLayers = layers.filter((layer) => isDrawableCanvas(layer.canvas));
  const bitmaps = await Promise.all(drawableLayers.map((layer) => createImageBitmap(layer.canvas)));
  if (signal?.aborted) {
    bitmaps.forEach((bitmap) => bitmap.close());
    throw processingAbortError();
  }

  const requestId = nextRequestId;
  nextRequestId += 1;
  const worker = getSharedWorker();
  const workerLayers = drawableLayers.map((layer, index) => ({
    bitmap: bitmaps[index],
    settings: layer.settings,
  }));

  return new Promise<ProcessedGraph>((resolve, reject) => {
    const abort = () => {
      if (!pendingRequests.has(requestId)) return;
      resetWorker(processingAbortError());
    };
    pendingRequests.set(requestId, { resolve, reject, signal, abort });
    signal?.addEventListener("abort", abort, { once: true });
    try {
      worker.postMessage({ requestId, layers: workerLayers, settings }, bitmaps as Transferable[]);
    } catch (error) {
      bitmaps.forEach((bitmap) => bitmap.close());
      detachPendingRequest(requestId);
      reject(error instanceof Error ? error : new Error("Unable to start image processing."));
    }
  });
}

export async function pixelateLayeredImagesWithWorker(
  layers: FittedImageLayer[],
  settings: GraphSettings,
  options: { signal?: AbortSignal } = {},
) {
  if (!supportsCanvasWorker()) return pixelateLayeredImages(layers, settings);

  try {
    return await pixelateLayeredImagesInWorker(layers, settings, options.signal);
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    if (process.env.NODE_ENV === "development") {
      console.warn("[graph-pixel] Canvas worker failed; using the main thread for this render.", error);
    }
    return pixelateLayeredImages(layers, settings);
  }
}
