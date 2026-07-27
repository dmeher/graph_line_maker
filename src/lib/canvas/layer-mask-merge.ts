export type LayerMaskPlacement = {
  offsetX: number;
  offsetY: number;
  width: number;
  destinationWidth: number;
};

/**
 * Returns the fill region to paint at a pixel without changing the persisted or
 * hit-testable region map. Vector contours keep fractional alpha at their
 * antialiased edges. Those contour pixels are intentionally barriers in the
 * topology, but the partially transparent outline must still be composited over
 * the neighboring fill rather than the paper backdrop.
 */
export function fillRegionNumberForRender(
  fillRegionMap: Uint16Array,
  outlineMask: Uint8Array | null | undefined,
  outlineCoverage: Uint8Array | null | undefined,
  width: number,
  height: number,
  pixel: number,
) {
  const directRegion = fillRegionMap[pixel] ?? 0;
  if (directRegion || !outlineMask?.[pixel]) return directRegion;

  const coverage = outlineCoverage?.[pixel] ?? 255;
  if (coverage <= 0 || coverage >= 255 || width <= 0 || height <= 0) return 0;

  const x = pixel % width;
  const y = Math.floor(pixel / width);
  if (x < 0 || x >= width || y < 0 || y >= height) return 0;

  // Prefer directly adjacent fills before diagonals. Read only the original
  // map, so a one-pixel antialiased edge can never cascade across an outline.
  if (y > 0) {
    const region = fillRegionMap[pixel - width] ?? 0;
    if (region) return region;
  }
  if (x > 0) {
    const region = fillRegionMap[pixel - 1] ?? 0;
    if (region) return region;
  }
  if (x < width - 1) {
    const region = fillRegionMap[pixel + 1] ?? 0;
    if (region) return region;
  }
  if (y < height - 1) {
    const region = fillRegionMap[pixel + width] ?? 0;
    if (region) return region;
  }
  if (x > 0 && y > 0) {
    const region = fillRegionMap[pixel - width - 1] ?? 0;
    if (region) return region;
  }
  if (x < width - 1 && y > 0) {
    const region = fillRegionMap[pixel - width + 1] ?? 0;
    if (region) return region;
  }
  if (x > 0 && y < height - 1) {
    const region = fillRegionMap[pixel + width - 1] ?? 0;
    if (region) return region;
  }
  if (x < width - 1 && y < height - 1) return fillRegionMap[pixel + width + 1] ?? 0;
  return 0;
}

export function mergeLayerPixelMasks(
  fillRegionMap: Uint16Array,
  outlineMask: Uint8Array,
  localFillRegionMap: Uint16Array,
  layerOutlineMask: Uint8Array,
  regionNumberMap: ReadonlyMap<number, number>,
  outlineColorMap?: Uint16Array,
  outlineColorNumber = 0,
  outlineCoverageMap?: Uint8Array,
  layerOutlineCoverageMap?: Uint8Array,
  placement?: LayerMaskPlacement,
) {
  const localWidth = placement ? Math.max(1, Math.min(placement.width, localFillRegionMap.length)) : 0;
  for (let pixel = 0; pixel < localFillRegionMap.length; pixel += 1) {
    const targetPixel = placement
      ? (placement.offsetY + Math.floor(pixel / localWidth)) * placement.destinationWidth + placement.offsetX + (pixel % localWidth)
      : pixel;
    if (targetPixel < 0 || targetPixel >= fillRegionMap.length) continue;
    const localRegionNumber = localFillRegionMap[pixel];
    const layerOutlineValue = layerOutlineMask[pixel];

    if (localRegionNumber) {
      const globalRegionNumber = regionNumberMap.get(localRegionNumber);
      if (globalRegionNumber) {
        fillRegionMap[targetPixel] = globalRegionNumber;
        outlineMask[targetPixel] = layerOutlineValue;
        if (outlineColorMap) outlineColorMap[targetPixel] = layerOutlineValue ? outlineColorNumber : 0;
        if (outlineCoverageMap) {
          outlineCoverageMap[targetPixel] = layerOutlineValue ? (layerOutlineCoverageMap?.[pixel] ?? 255) : 0;
        }
      }
      continue;
    }

    if (layerOutlineValue) {
      fillRegionMap[targetPixel] = 0;
      outlineMask[targetPixel] = layerOutlineValue;
      if (outlineColorMap) outlineColorMap[targetPixel] = outlineColorNumber;
      if (outlineCoverageMap) outlineCoverageMap[targetPixel] = layerOutlineCoverageMap?.[pixel] ?? 255;
    }
  }
}
