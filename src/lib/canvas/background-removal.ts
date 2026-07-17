import type { ImageDataLike } from "@/lib/canvas/ink-mask";

/**
 * Fully client-side background remover. Flood-fills from the image borders and
 * clears the alpha of pixels whose colour is within `tolerance` of the sampled
 * background colour, stopping at the subject's edges. Works best on clean,
 * near-uniform backgrounds; the editor pairs it with the image eraser for
 * manual refinement.
 */

const MAX_RGB_DISTANCE = Math.sqrt(3) * 255;
const MIN_OPAQUE_ALPHA = 8;

/** Returns a new ImageDataLike with background pixels made transparent. Pure; does not mutate input. */
export function removeBackgroundImageData(image: ImageDataLike, tolerance: number): ImageDataLike {
  const { width, height } = image;
  const out = new Uint8ClampedArray(image.data);
  if (width < 2 || height < 2) return { width, height, data: out };

  const threshold = Math.max(0, Math.min(1, tolerance)) * MAX_RGB_DISTANCE;

  // Background reference colour = average of the opaque border pixels.
  let br = 0;
  let bg = 0;
  let bb = 0;
  let count = 0;
  const sampleBorder = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    if (out[index + 3] < MIN_OPAQUE_ALPHA) return;
    br += out[index];
    bg += out[index + 1];
    bb += out[index + 2];
    count += 1;
  };
  for (let x = 0; x < width; x += 1) {
    sampleBorder(x, 0);
    sampleBorder(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    sampleBorder(0, y);
    sampleBorder(width - 1, y);
  }
  if (!count) return { width, height, data: out };
  br /= count;
  bg /= count;
  bb /= count;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const pixel = y * width + x;
    if (visited[pixel]) return;
    visited[pixel] = 1;
    stack.push(pixel);
  };
  for (let x = 0; x < width; x += 1) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    seed(0, y);
    seed(width - 1, y);
  }

  while (stack.length) {
    const pixel = stack.pop() as number;
    const index = pixel * 4;
    if (out[index + 3] >= MIN_OPAQUE_ALPHA) {
      const dr = out[index] - br;
      const dg = out[index + 1] - bg;
      const db = out[index + 2] - bb;
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);
      // A subject/edge pixel: keep it and do not flood past it.
      if (distance > threshold) continue;
    }
    out[index + 3] = 0;
    const x = pixel % width;
    const y = (pixel - x) / width;
    if (x > 0 && !visited[pixel - 1]) {
      visited[pixel - 1] = 1;
      stack.push(pixel - 1);
    }
    if (x < width - 1 && !visited[pixel + 1]) {
      visited[pixel + 1] = 1;
      stack.push(pixel + 1);
    }
    if (y > 0 && !visited[pixel - width]) {
      visited[pixel - width] = 1;
      stack.push(pixel - width);
    }
    if (y < height - 1 && !visited[pixel + width]) {
      visited[pixel + width] = 1;
      stack.push(pixel + width);
    }
  }

  return { width, height, data: out };
}
