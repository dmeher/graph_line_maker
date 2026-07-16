import { detectArtworkBounds, estimateArtworkBackground, type ArtworkDetectionResult } from "@/lib/canvas/artwork-detection";
import { transformedImageSize } from "@/lib/canvas/crop";

type CropDetectionRequest = {
  requestId: number;
  bitmap: ImageBitmap;
  rotationDegrees: number;
  straightenDegrees: number;
  flipX: boolean;
  flipY: boolean;
  maxAnalysisPixels: number;
};

type CropDetectionResponse =
  | { requestId: number; ok: true; result: ArtworkDetectionResult }
  | { requestId: number; ok: false; error: string };

const workerContext = self as unknown as {
  onmessage: ((event: MessageEvent<CropDetectionRequest>) => void) | null;
  postMessage: (message: CropDetectionResponse) => void;
};

function sourceBackground(bitmap: ImageBitmap) {
  const scale = Math.min(1, Math.sqrt(262_144 / Math.max(1, bitmap.width * bitmap.height)));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is not available.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return estimateArtworkBackground(context.getImageData(0, 0, canvas.width, canvas.height)).background;
}

workerContext.onmessage = (event) => {
  const { requestId, bitmap, rotationDegrees, straightenDegrees, flipX, flipY, maxAnalysisPixels } = event.data;
  try {
    if (bitmap.width <= 0 || bitmap.height <= 0) throw new Error("The selected image has no drawable pixels.");
    const background = sourceBackground(bitmap);
    const transformed = transformedImageSize(bitmap.width, bitmap.height, rotationDegrees, straightenDegrees);
    const analysisScale = Math.min(1, Math.sqrt(Math.max(1, maxAnalysisPixels) / (transformed.width * transformed.height)));
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(transformed.width * analysisScale)),
      Math.max(1, Math.round(transformed.height * analysisScale)),
    );
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is not available.");
    if (background[3] > 0) {
      context.fillStyle = `rgba(${Math.round(background[0])}, ${Math.round(background[1])}, ${Math.round(background[2])}, ${background[3] / 255})`;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((transformed.rotationDegrees * Math.PI) / 180);
    context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    context.drawImage(
      bitmap,
      (-bitmap.width * analysisScale) / 2,
      (-bitmap.height * analysisScale) / 2,
      bitmap.width * analysisScale,
      bitmap.height * analysisScale,
    );
    bitmap.close();

    const detected = detectArtworkBounds(context.getImageData(0, 0, canvas.width, canvas.height));
    const x = detected.crop ? Math.max(0, Math.floor(detected.crop.x / analysisScale)) : 0;
    const y = detected.crop ? Math.max(0, Math.floor(detected.crop.y / analysisScale)) : 0;
    const result: ArtworkDetectionResult = detected.crop
      ? {
          ...detected,
          crop: {
            x,
            y,
            width: Math.max(1, Math.min(transformed.width - x, Math.ceil(detected.crop.width / analysisScale))),
            height: Math.max(1, Math.min(transformed.height - y, Math.ceil(detected.crop.height / analysisScale))),
          },
        }
      : detected;
    workerContext.postMessage({ requestId, ok: true, result });
  } catch (error) {
    bitmap.close();
    workerContext.postMessage({
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : "Unable to detect artwork.",
    });
  }
};
