import { pixelateLayeredCanvases, type WorkerFittedImageLayer } from "@/lib/canvas/processor";
import type { GraphSettings, PaletteColor } from "@/lib/types";

type WorkerLayerInput = {
  bitmap: ImageBitmap;
  settings: GraphSettings;
};

type WorkerRequest = {
  requestId: number;
  layers: WorkerLayerInput[];
  settings: GraphSettings;
};

type WorkerResponse =
  | {
      ok: true;
      requestId: number;
      bitmap: ImageBitmap;
      width: number;
      height: number;
      palette: PaletteColor[];
      fillRegions: ReturnType<typeof pixelateLayeredCanvases>["fillRegions"];
      fillRegionMap: Uint16Array;
    }
  | {
      ok: false;
      requestId: number;
      error: string;
    };

const workerContext = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

workerContext.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const bitmaps = event.data.layers.map((layer) => layer.bitmap);
  try {
    const layers: WorkerFittedImageLayer[] = event.data.layers.flatMap((layer) => {
      if (layer.bitmap.width <= 0 || layer.bitmap.height <= 0) return [];
      const canvas = new OffscreenCanvas(layer.bitmap.width, layer.bitmap.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas is not available.");
      context.drawImage(layer.bitmap, 0, 0);
      return [
        {
          canvas,
          settings: layer.settings,
        },
      ];
    });

    bitmaps.forEach((bitmap) => bitmap.close());
    const result = pixelateLayeredCanvases(layers, event.data.settings);
    const output = result.canvas as OffscreenCanvas;
    const bitmap = output.transferToImageBitmap();
    const response: WorkerResponse = {
      ok: true,
      requestId: event.data.requestId,
      bitmap,
      width: output.width,
      height: output.height,
      palette: result.palette,
      fillRegions: result.fillRegions,
      fillRegionMap: result.fillRegionMap,
    };
    workerContext.postMessage(response, [bitmap, result.fillRegionMap.buffer] as Transferable[]);
  } catch (error) {
    bitmaps.forEach((bitmap) => bitmap.close());
    const response: WorkerResponse = {
      ok: false,
      requestId: event.data.requestId,
      error: error instanceof Error ? error.message : "Unable to process image.",
    };
    workerContext.postMessage(response);
  }
};
