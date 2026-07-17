import type { ArtworkDetectionResult } from "@/lib/canvas/artwork-detection";

type PendingDetection = {
  resolve: (result: ArtworkDetectionResult) => void;
  reject: (error: Error) => void;
};

type WorkerResponse =
  | { requestId: number; ok: true; result: ArtworkDetectionResult }
  | { requestId: number; ok: false; error: string };

let sharedWorker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingDetection>();

function supported() {
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function";
}

function worker() {
  if (sharedWorker) return sharedWorker;
  const instance = new Worker(new URL("./crop-detection.worker.ts", import.meta.url), { type: "module" });
  instance.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const request = pending.get(event.data.requestId);
    if (!request) return;
    pending.delete(event.data.requestId);
    if (event.data.ok) request.resolve(event.data.result);
    else request.reject(new Error(event.data.error));
  };
  instance.onerror = (event) => {
    const error = new Error(event.message || "Unable to detect artwork.");
    pending.forEach((request) => request.reject(error));
    pending.clear();
    instance.terminate();
    sharedWorker = null;
  };
  sharedWorker = instance;
  return instance;
}

async function bitmapFromUrl(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Unable to load the image for artwork detection.");
  return createImageBitmap(await response.blob(), { imageOrientation: "from-image" });
}

export async function detectArtworkCropInWorker({
  imageUrl,
  rotationDegrees = 0,
  straightenDegrees = 0,
  flipX = false,
  flipY = false,
  maxAnalysisPixels = 2_000_000,
}: {
  imageUrl: string;
  rotationDegrees?: number;
  straightenDegrees?: number;
  flipX?: boolean;
  flipY?: boolean;
  maxAnalysisPixels?: number;
}): Promise<ArtworkDetectionResult | null> {
  if (!supported()) return null;
  const bitmap = await bitmapFromUrl(imageUrl);
  const requestId = nextRequestId++;
  return new Promise<ArtworkDetectionResult>((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    try {
      worker().postMessage(
        { requestId, bitmap, rotationDegrees, straightenDegrees, flipX, flipY, maxAnalysisPixels },
        [bitmap],
      );
    } catch (error) {
      pending.delete(requestId);
      bitmap.close();
      reject(error instanceof Error ? error : new Error("Unable to start artwork detection."));
    }
  });
}

export function disposeCropDetectionWorker() {
  sharedWorker?.terminate();
  sharedWorker = null;
  pending.forEach((request) => request.reject(new Error("Artwork detection was cancelled.")));
  pending.clear();
}
