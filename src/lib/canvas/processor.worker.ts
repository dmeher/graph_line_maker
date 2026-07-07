import { pixelateLayeredCanvases, type WorkerFittedImageLayer } from "@/lib/canvas/processor";
import type { GraphSettings, PaletteColor } from "@/lib/types";

type WorkerLayerInput = {
  bitmap: ImageBitmap;
  settings: GraphSettings;
};

type WorkerRequest = {
  layers: WorkerLayerInput[];
  settings: GraphSettings;
};

type WorkerResponse =
  | {
      ok: true;
      bitmap: ImageBitmap;
      width: number;
      height: number;
      palette: PaletteColor[];
      fillRegions: ReturnType<typeof pixelateLayeredCanvases>["fillRegions"];
      fillRegionMap: Uint16Array;
    }
  | {
      ok: false;
      error: string;
    };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const bitmaps = event.data.layers.map((layer) => layer.bitmap);
  try {
    const layers: WorkerFittedImageLayer[] = event.data.layers.map((layer) => {
      const canvas = new OffscreenCanvas(layer.bitmap.width, layer.bitmap.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas is not available.");
      context.drawImage(layer.bitmap, 0, 0);
      return {
        canvas,
        settings: layer.settings,
      };
    });

    bitmaps.forEach((bitmap) => bitmap.close());
    const result = pixelateLayeredCanvases(layers, event.data.settings);
    const output = result.canvas as OffscreenCanvas;
    const bitmap = output.transferToImageBitmap();
    const response: WorkerResponse = {
      ok: true,
      bitmap,
      width: output.width,
      height: output.height,
      palette: result.palette,
      fillRegions: result.fillRegions,
      fillRegionMap: result.fillRegionMap,
    };
    self.postMessage(response, [bitmap, result.fillRegionMap.buffer] as Transferable[]);
  } catch (error) {
    bitmaps.forEach((bitmap) => bitmap.close());
    const response: WorkerResponse = {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to process image.",
    };
    self.postMessage(response);
  }
};
