export type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
  const x = clamp(Math.round(crop.x), 0, Math.max(0, width - 1));
  const y = clamp(Math.round(crop.y), 0, Math.max(0, height - 1));
  const cropWidth = clamp(Math.round(crop.width), 1, width - x);
  const cropHeight = clamp(Math.round(crop.height), 1, height - y);
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
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
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

export async function cropCanvasToFile(canvas: HTMLCanvasElement, crop: CropPixels, fileName: string, type = "image/png") {
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
