export type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function positiveInteger(value: unknown, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
}

function decodedImageSize(image: HTMLImageElement) {
  const width = positiveInteger(image.naturalWidth || image.width, 0);
  const height = positiveInteger(image.naturalHeight || image.height, 0);
  if (!width || !height) throw new Error("The selected image has no drawable pixels.");
  return { width, height };
}

function assertDrawableCanvas(canvas: HTMLCanvasElement) {
  if (positiveInteger(canvas.width, 0) <= 0 || positiveInteger(canvas.height, 0) <= 0) {
    throw new Error("The selected image has no drawable pixels.");
  }
}

function outputFileName(fileName: string, type: string) {
  const extension = type === "image/png" ? "png" : fileName.split(".").pop() || "png";
  return `${fileName.replace(/\.[^.]+$/, "")}.${extension}`;
}

export function fullCrop(width: number, height: number): CropPixels {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

export function normalizeCrop(crop: CropPixels, width: number, height: number): CropPixels {
  const safeWidth = positiveInteger(width);
  const safeHeight = positiveInteger(height);
  const x = clamp(Math.round(Number(crop.x) || 0), 0, Math.max(0, safeWidth - 1));
  const y = clamp(Math.round(Number(crop.y) || 0), 0, Math.max(0, safeHeight - 1));
  const cropWidth = clamp(Math.round(Number(crop.width) || 1), 1, safeWidth - x);
  const cropHeight = clamp(Math.round(Number(crop.height) || 1), 1, safeHeight - y);
  return { x, y, width: cropWidth, height: cropHeight };
}

function canvasToFile(canvas: HTMLCanvasElement, fileName: string, type: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(new File([blob], outputFileName(fileName, type), { type }));
        else reject(new Error("Unable to crop image."));
      },
      type,
      0.94,
    );
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = src;
  });
}

export async function cropImageUrlToFile(imageUrl: string, crop: CropPixels, fileName: string, type = "image/png") {
  const image = await loadImage(imageUrl);
  const { width: naturalWidth, height: naturalHeight } = decodedImageSize(image);
  const cropPixels = normalizeCrop(crop, naturalWidth, naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  context.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height,
  );

  return canvasToFile(canvas, fileName, type);
}

function normalizeRightAngleRotation(rotationDegrees = 0) {
  return ((Math.round(rotationDegrees / 90) * 90) % 360 + 360) % 360;
}

export async function transformImageUrlToFile({
  imageUrl,
  crop,
  rotationDegrees = 0,
  fileName,
  type = "image/png",
}: {
  imageUrl: string;
  crop?: CropPixels | null;
  rotationDegrees?: number;
  fileName: string;
  type?: string;
}) {
  const image = await loadImage(imageUrl);
  const { width: naturalWidth, height: naturalHeight } = decodedImageSize(image);
  const cropPixels = crop ? normalizeCrop(crop, naturalWidth, naturalHeight) : fullCrop(naturalWidth, naturalHeight);
  const rotation = normalizeRightAngleRotation(rotationDegrees);
  const rotatedSideways = rotation === 90 || rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = rotatedSideways ? cropPixels.height : cropPixels.width;
  canvas.height = rotatedSideways ? cropPixels.width : cropPixels.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  context.save();
  if (rotation === 90) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    context.translate(canvas.width, canvas.height);
    context.rotate(Math.PI);
  } else if (rotation === 270) {
    context.translate(0, canvas.height);
    context.rotate((Math.PI * 3) / 2);
  }

  context.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height,
  );
  context.restore();

  return canvasToFile(canvas, fileName, type);
}

export async function cropCanvasToFile(canvas: HTMLCanvasElement, crop: CropPixels, fileName: string, type = "image/png") {
  assertDrawableCanvas(canvas);
  const cropPixels = normalizeCrop(crop, canvas.width, canvas.height);
  const output = document.createElement("canvas");
  output.width = cropPixels.width;
  output.height = cropPixels.height;
  const context = output.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  context.drawImage(
    canvas,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height,
  );

  return canvasToFile(output, fileName, type);
}
