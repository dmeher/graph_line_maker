/**
 * Pure geometry for the image-line eraser. Maps between graph-output-pixel space
 * and a source image's own pixel space, inverting the placement transform used
 * by the processor (`placeSourceImageData`): translate to the placed-box centre,
 * rotate, then flip, drawing the image's content bounds into the fitted box.
 */

export type PlacementTransform = {
  /** Placed-box position/size in graph OUTPUT PIXELS. */
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
  rotationDegrees: number;
  flipX: boolean;
  flipY: boolean;
};

export type ContentBounds = { x: number; y: number; width: number; height: number };

function normalizeRotation(rotationDegrees: number) {
  return ((rotationDegrees % 360) + 360) % 360;
}

function fittedBox(placement: PlacementTransform) {
  const rotation = normalizeRotation(placement.rotationDegrees);
  const rotatedSideways = rotation === 90 || rotation === 270;
  return {
    rotation,
    fittedWidth: rotatedSideways ? placement.drawHeight : placement.drawWidth,
    fittedHeight: rotatedSideways ? placement.drawWidth : placement.drawHeight,
    centerX: placement.drawX + placement.drawWidth / 2,
    centerY: placement.drawY + placement.drawHeight / 2,
  };
}

/** Maps a graph-output-pixel point to a pixel in the source canvas. */
export function graphPixelToSourcePixel(
  gx: number,
  gy: number,
  placement: PlacementTransform,
  bounds: ContentBounds,
): { x: number; y: number } {
  const { rotation, fittedWidth, fittedHeight, centerX, centerY } = fittedBox(placement);
  const rx = gx - centerX;
  const ry = gy - centerY;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Inverse rotation R(-θ) applied to the centred point.
  const ux = rx * cos + ry * sin;
  const uy = -rx * sin + ry * cos;
  // Inverse flip (scale of ±1).
  const lx = placement.flipX ? -ux : ux;
  const ly = placement.flipY ? -uy : uy;
  const cu = fittedWidth ? lx / fittedWidth + 0.5 : 0.5;
  const cv = fittedHeight ? ly / fittedHeight + 0.5 : 0.5;
  return {
    x: bounds.x + cu * bounds.width,
    y: bounds.y + cv * bounds.height,
  };
}

/** Forward transform (source pixel -> graph output pixel); primarily for tests/round-trips. */
export function sourcePixelToGraphPixel(
  sx: number,
  sy: number,
  placement: PlacementTransform,
  bounds: ContentBounds,
): { x: number; y: number } {
  const { rotation, fittedWidth, fittedHeight, centerX, centerY } = fittedBox(placement);
  const cu = bounds.width ? (sx - bounds.x) / bounds.width : 0.5;
  const cv = bounds.height ? (sy - bounds.y) / bounds.height : 0.5;
  const lx = (cu - 0.5) * fittedWidth;
  const ly = (cv - 0.5) * fittedHeight;
  const fx = placement.flipX ? -lx : lx;
  const fy = placement.flipY ? -ly : ly;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = fx * cos - fy * sin;
  const ry = fx * sin + fy * cos;
  return { x: rx + centerX, y: ry + centerY };
}
