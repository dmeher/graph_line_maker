/**
 * Shared binary input preparation for every vector tracing engine.
 *
 * This module deliberately has no Canvas, DOM, Buffer, or native-vectorizer
 * dependency. The browser uses it to rebuild the invisible centreline topology
 * mask while `/api/vectorize` uses the exact same operation before it sends a
 * mask to either tracing engine.
 */

export type VectorMaskPixels = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
};

export type VectorMaskPreparationOptions = {
  inkThreshold: number;
  lineAdjust: number;
  sketchRemoval: number;
  /** The existing trace control moves in half-pixel increments. */
  lineAdjustStep?: number;
};

export type PreparedVectorTraceMask = {
  mask: Uint8Array;
  width: number;
  height: number;
};

const MIN_VISIBLE_ALPHA = 8;
const DEFAULT_LINE_ADJUST_STEP = 0.5;

function normalizedDimension(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : 0;
}

function pixelMaskFromRgba(pixels: VectorMaskPixels, inkThreshold: number) {
  const width = normalizedDimension(pixels.width);
  const height = normalizedDimension(pixels.height);
  const mask = new Uint8Array(width * height);
  if (!width || !height) return mask;

  const threshold = Number.isFinite(inkThreshold) ? Math.max(0, Math.min(255, inkThreshold)) : 210;
  const availablePixels = Math.min(mask.length, Math.floor(pixels.data.length / 4));
  for (let pixel = 0, offset = 0; pixel < availablePixels; pixel += 1, offset += 4) {
    const alpha = pixels.data[offset + 3] ?? 0;
    if (alpha <= MIN_VISIBLE_ALPHA) continue;
    const red = pixels.data[offset] ?? 255;
    const green = pixels.data[offset + 1] ?? 255;
    const blue = pixels.data[offset + 2] ?? 255;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    mask[pixel] = luminance <= threshold ? 1 : 0;
  }
  return mask;
}

function erodeMask(mask: Uint8Array, width: number, height: number, includeDiagonals = true) {
  const next = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = 1;
      for (let dy = -1; dy <= 1 && keep; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!includeDiagonals && Math.abs(dx) + Math.abs(dy) > 1) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (
            nextX < 0
            || nextY < 0
            || nextX >= width
            || nextY >= height
            || !mask[nextY * width + nextX]
          ) {
            keep = 0;
            break;
          }
        }
      }
      next[y * width + x] = keep;
    }
  }
  return next;
}

function dilateMask(mask: Uint8Array, width: number, height: number, includeDiagonals = true) {
  const next = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let fill = 0;
      for (let dy = -1; dy <= 1 && !fill; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!includeDiagonals && Math.abs(dx) + Math.abs(dy) > 1) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (
            nextX >= 0
            && nextY >= 0
            && nextX < width
            && nextY < height
            && mask[nextY * width + nextX]
          ) {
            fill = 1;
            break;
          }
        }
      }
      next[y * width + x] = fill;
    }
  }
  return next;
}

/** Removes narrow sketch/hatch marks without deleting a complete drawing. */
function removeSketchStrokes(mask: Uint8Array, width: number, height: number, strength: number) {
  if (strength <= 0) return mask;

  let opened = mask;
  for (let step = 0; step < strength; step += 1) {
    opened = erodeMask(opened, width, height);
  }
  for (let step = 0; step < strength; step += 1) {
    opened = dilateMask(opened, width, height);
  }

  // Avoid converting an over-aggressive setting into an unrecoverable blank
  // layer. This matches the existing vectorizer route behaviour.
  return opened.some((value) => value) ? opened : mask;
}

function adjustMaskThickness(
  mask: Uint8Array,
  width: number,
  height: number,
  lineAdjust: number,
  lineAdjustStep: number,
) {
  if (!lineAdjust) return mask;

  let adjusted = mask;
  const amount = Math.abs(lineAdjust);
  const steps = Math.floor(amount);
  const halfStep = Math.max(Number.EPSILON, lineAdjustStep);
  const hasHalfStep = amount - steps >= halfStep;
  const thicken = lineAdjust > 0;

  for (let step = 0; step < steps; step += 1) {
    adjusted = thicken ? dilateMask(adjusted, width, height) : erodeMask(adjusted, width, height);
  }
  if (hasHalfStep) {
    adjusted = thicken
      ? dilateMask(adjusted, width, height, false)
      : erodeMask(adjusted, width, height, false);
  }
  return adjusted;
}

/**
 * Builds a stable, binary ink mask from RGBA pixels.
 *
 * The returned mask is a new array; neither the source pixels nor a caller's
 * prior mask are changed. Both tracing engines and centreline topology use this
 * function, so threshold, sketch removal, alpha handling, and Line adjustment
 * remain visually identical.
 */
export function prepareVectorTraceMask(
  pixels: VectorMaskPixels,
  options: VectorMaskPreparationOptions,
): PreparedVectorTraceMask {
  const width = normalizedDimension(pixels.width);
  const height = normalizedDimension(pixels.height);
  const mask = pixelMaskFromRgba(pixels, options.inkThreshold);
  if (!width || !height) return { mask, width, height };

  const sketchRemoval = Number.isFinite(options.sketchRemoval)
    ? Math.max(0, Math.floor(options.sketchRemoval))
    : 0;
  const cleanedMask = removeSketchStrokes(mask, width, height, sketchRemoval);
  const lineAdjust = Number.isFinite(options.lineAdjust) ? options.lineAdjust : 0;
  const adjustedMask = adjustMaskThickness(
    cleanedMask,
    width,
    height,
    lineAdjust,
    options.lineAdjustStep ?? DEFAULT_LINE_ADJUST_STEP,
  );

  return { mask: adjustedMask, width, height };
}

/** Converts a binary mask into the opaque black/white RGBA input VTracer expects. */
export function binaryMaskToOpaqueRgba(mask: Uint8Array) {
  const pixels = new Uint8Array(mask.length * 4);
  for (let pixel = 0, offset = 0; pixel < mask.length; pixel += 1, offset += 4) {
    const value = mask[pixel] ? 0 : 255;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  return pixels;
}
