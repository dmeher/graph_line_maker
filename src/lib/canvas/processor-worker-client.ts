import { pixelateLayeredImages, type FillRegion, type FittedImageLayer, type ProcessedGraph } from "@/lib/canvas/processor";
import type { PaletteColor, GraphSettings } from "@/lib/types";

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

async function pixelateLayeredImagesInWorker(
  layers: FittedImageLayer[],
  settings: GraphSettings,
  signal?: AbortSignal,
): Promise<ProcessedGraph> {
  if (signal?.aborted) throw processingAbortError();

  const bitmaps = await Promise.all(layers.map((layer) => createImageBitmap(layer.canvas)));
  if (signal?.aborted) {
    bitmaps.forEach((bitmap) => bitmap.close());
    throw processingAbortError();
  }

  const worker = new Worker(new URL("./processor.worker.ts", import.meta.url), { type: "module" });
  const workerLayers = layers.map((layer, index) => ({
    bitmap: bitmaps[index],
    settings: layer.settings,
  }));

  return new Promise<ProcessedGraph>((resolve, reject) => {
    let settled = false;
    let postedToWorker = false;

    function cleanup() {
      signal?.removeEventListener("abort", abort);
      worker.terminate();
    }

    function abort() {
      if (settled) return;
      settled = true;
      if (!postedToWorker) bitmaps.forEach((bitmap) => bitmap.close());
      cleanup();
      reject(processingAbortError());
    }

    worker.onmessage = (event: MessageEvent<{
      ok: boolean;
      error?: string;
      bitmap?: ImageBitmap;
      width?: number;
      height?: number;
      palette?: PaletteColor[];
      fillRegions?: FillRegion[];
      fillRegionMap?: Uint16Array;
    }>) => {
      if (settled) return;
      settled = true;
      cleanup();

      const data = event.data;
      if (!data.ok || !data.bitmap || !data.fillRegionMap || !data.palette || !data.fillRegions) {
        reject(new Error(data.error || "Unable to process image."));
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = data.width ?? data.bitmap.width;
      canvas.height = data.height ?? data.bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        data.bitmap.close();
        reject(new Error("Canvas is not available."));
        return;
      }
      context.drawImage(data.bitmap, 0, 0);
      data.bitmap.close();
      resolve({
        canvas,
        palette: data.palette,
        fillRegions: data.fillRegions,
        fillRegionMap: data.fillRegionMap,
      });
    };

    worker.onerror = (event) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(event.message || "Unable to process image."));
    };

    signal?.addEventListener("abort", abort, { once: true });
    postedToWorker = true;
    worker.postMessage({ layers: workerLayers, settings }, bitmaps as Transferable[]);
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
    return pixelateLayeredImages(layers, settings);
  }
}
