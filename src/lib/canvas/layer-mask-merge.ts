export function mergeLayerPixelMasks(
  fillRegionMap: Uint16Array,
  outlineMask: Uint8Array,
  localFillRegionMap: Uint16Array,
  layerOutlineMask: Uint8Array,
  regionNumberMap: ReadonlyMap<number, number>,
  outlineColorMap?: Uint16Array,
  outlineColorNumber = 0,
) {
  for (let pixel = 0; pixel < localFillRegionMap.length; pixel += 1) {
    const localRegionNumber = localFillRegionMap[pixel];
    const layerOutlineValue = layerOutlineMask[pixel];

    if (localRegionNumber) {
      const globalRegionNumber = regionNumberMap.get(localRegionNumber);
      if (globalRegionNumber) {
        fillRegionMap[pixel] = globalRegionNumber;
        outlineMask[pixel] = layerOutlineValue;
        if (outlineColorMap) outlineColorMap[pixel] = layerOutlineValue ? outlineColorNumber : 0;
      }
      continue;
    }

    if (layerOutlineValue) {
      fillRegionMap[pixel] = 0;
      outlineMask[pixel] = layerOutlineValue;
      if (outlineColorMap) outlineColorMap[pixel] = outlineColorNumber;
    }
  }
}
