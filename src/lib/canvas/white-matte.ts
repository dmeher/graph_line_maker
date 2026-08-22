import type { ImageDataLike } from "@/lib/canvas/ink-mask";

const CHANNEL_MAX = 255;
// Tiny foreground coverage is JPEG/off-white residue, not a visible contour.
const MIN_FOREGROUND_COVERAGE = 12;

function toByte(value: number) {
  return Math.max(0, Math.min(CHANNEL_MAX, Math.round(value)));
}

/**
 * Removes an opaque white matte from raster artwork without leaving pale
 * white/grey halos. The input is treated as foreground composited over white:
 * each pixel is converted back into a foreground colour plus alpha so graph
 * paper can remain visible underneath it.
 *
 * This is intentionally for direct raster imports only. Solid white artwork
 * cannot be distinguished from a white matte and is therefore transparent.
 */
export function unmatteWhiteBackgroundImageData(image: ImageDataLike): ImageDataLike {
  const data = new Uint8ClampedArray(image.data);

  for (let offset = 0; offset < data.length; offset += 4) {
    const sourceAlpha = data[offset + 3] / CHANNEL_MAX;
    if (sourceAlpha <= 0) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      continue;
    }

    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    // With a white backdrop, the smallest channel encodes how much white is
    // mixed into the pixel. This keeps coloured artwork coloured while turning
    // neutral grey antialiasing into the equivalent translucent black edge.
    const whiteCoverage = Math.min(red, green, blue);
    const foregroundCoverage = CHANNEL_MAX - whiteCoverage;

    if (foregroundCoverage <= MIN_FOREGROUND_COVERAGE) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
      continue;
    }

    data[offset] = toByte(((red - whiteCoverage) * CHANNEL_MAX) / foregroundCoverage);
    data[offset + 1] = toByte(((green - whiteCoverage) * CHANNEL_MAX) / foregroundCoverage);
    data[offset + 2] = toByte(((blue - whiteCoverage) * CHANNEL_MAX) / foregroundCoverage);
    data[offset + 3] = toByte(sourceAlpha * foregroundCoverage);
  }

  return { width: image.width, height: image.height, data };
}
