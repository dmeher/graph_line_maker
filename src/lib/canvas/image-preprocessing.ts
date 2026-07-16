import type { GraphSettings } from "../types";
import type { ImageDataLike } from "./ink-mask";

function isImageColorQuantization(value: unknown): value is 2 | 4 | 8 | 16 | "off" {
  return value === "off" || value === 2 || value === 4 || value === 8 || value === 16;
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function luma(red: number, green: number, blue: number) {
  return 0.299 * red + 0.587 * green + 0.114 * blue;
}

function percentile(values: number[], percentileValue: number, fallback: number) {
  if (!values.length) return fallback;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * percentileValue)));
  return sorted[index];
}

function autoEnhancePixels(data: Uint8ClampedArray | Uint8Array) {
  const lumas: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 16) continue;
    lumas.push(luma(data[index], data[index + 1], data[index + 2]));
  }
  const low = percentile(lumas, 0.05, 0);
  const high = percentile(lumas, 0.95, 255);
  if (high - low < 12) return;
  const scale = 255 / (high - low);

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 16) continue;
    data[index] = clampByte((data[index] - low) * scale);
    data[index + 1] = clampByte((data[index + 1] - low) * scale);
    data[index + 2] = clampByte((data[index + 2] - low) * scale);
  }
}

function denoisePixels(data: Uint8ClampedArray, width: number, height: number, passes: number) {
  const source = new Uint8ClampedArray(data);
  const output = new Uint8ClampedArray(data);

  for (let pass = 0; pass < passes; pass += 1) {
    const input = pass === 0 ? source : new Uint8ClampedArray(output);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let red = 0;
        let green = 0;
        let blue = 0;
        let alpha = 0;
        let count = 0;
        for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) {
          for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) {
            const index = (yy * width + xx) * 4;
            red += input[index];
            green += input[index + 1];
            blue += input[index + 2];
            alpha += input[index + 3];
            count += 1;
          }
        }
        const index = (y * width + x) * 4;
        output[index] = clampByte(red / count);
        output[index + 1] = clampByte(green / count);
        output[index + 2] = clampByte(blue / count);
        output[index + 3] = clampByte(alpha / count);
      }
    }
  }

  data.set(output);
}

function enhanceEdges(data: Uint8ClampedArray, width: number, height: number) {
  const original = new Uint8ClampedArray(data);
  const lumas = new Float32Array(width * height);
  for (let pixel = 0, index = 0; pixel < lumas.length; pixel += 1, index += 4) {
    lumas[pixel] = luma(original[index], original[index + 1], original[index + 2]);
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x;
      const gx =
        -lumas[pixel - width - 1] -
        2 * lumas[pixel - 1] -
        lumas[pixel + width - 1] +
        lumas[pixel - width + 1] +
        2 * lumas[pixel + 1] +
        lumas[pixel + width + 1];
      const gy =
        -lumas[pixel - width - 1] -
        2 * lumas[pixel - width] -
        lumas[pixel - width + 1] +
        lumas[pixel + width - 1] +
        2 * lumas[pixel + width] +
        lumas[pixel + width + 1];
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      if (magnitude < 36) continue;
      const index = pixel * 4;
      const darken = Math.min(82, magnitude * 0.16);
      data[index] = clampByte(original[index] - darken);
      data[index + 1] = clampByte(original[index + 1] - darken);
      data[index + 2] = clampByte(original[index + 2] - darken);
    }
  }
}

function quantizePixels(data: Uint8ClampedArray, colorCount: number) {
  if (colorCount <= 2) {
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] < 16) continue;
      const value = luma(data[index], data[index + 1], data[index + 2]) < 150 ? 0 : 255;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }
    return;
  }

  const steps = Math.max(2, colorCount);
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 16) continue;
    const gray = luma(data[index], data[index + 1], data[index + 2]);
    const bucket = Math.round((gray / 255) * (steps - 1));
    const value = clampByte((bucket / (steps - 1)) * 255);
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
}

export function preprocessImageDataForGraph(imageData: ImageDataLike, settings: GraphSettings): ImageDataLike {
  const output = new Uint8ClampedArray(imageData.data);
  if (settings.imageDenoiseLevel === "light") denoisePixels(output, imageData.width, imageData.height, 1);
  if (settings.imageDenoiseLevel === "strong") denoisePixels(output, imageData.width, imageData.height, 2);
  if (settings.imageAutoEnhance) autoEnhancePixels(output);
  if (settings.imageEdgeDetection === "enhanced") enhanceEdges(output, imageData.width, imageData.height);
  const colorQuantization = settings.imageColorQuantization;
  if (isImageColorQuantization(colorQuantization) && colorQuantization !== "off") {
    quantizePixels(output, colorQuantization);
  }
  return { width: imageData.width, height: imageData.height, data: output };
}
