export type LayerMaskPlacement = {
  offsetX: number;
  offsetY: number;
  width: number;
  destinationWidth: number;
};

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
