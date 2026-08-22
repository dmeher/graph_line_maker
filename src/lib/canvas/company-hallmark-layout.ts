export type HallmarkTile = {
  tileX: number;
  tileY: number;
  destinationXMm: number;
  destinationYMm: number;
  destinationWidthMm: number;
  destinationHeightMm: number;
  sourceWidth: number;
};

export type CompanyHallmarkPlacement = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

const COMPANY_HALLMARK_PAGE_PADDING_MM = 4;
const COMPANY_HALLMARK_GRID_NUMBER_GAP_MM = 3;
const COMPANY_HALLMARK_ASPECT_RATIO = 9 / 16;
const OUTSIDE_GRID_NUMBER_OFFSET_PX = 26;

/**
 * Places the rotated hallmark in the dedicated left lane of the first column's
 * second row, while leaving clear space for outside row numbers.
 */
export function companyHallmarkPlacement(
  tile: HallmarkTile,
  pageWidthMm: number,
  pageHeightMm: number,
): CompanyHallmarkPlacement | null {
  if (tile.tileX !== 0 || tile.tileY !== 1) return null;

  const millimetresPerSourcePixel = tile.sourceWidth > 0 ? tile.destinationWidthMm / tile.sourceWidth : 0;
  const gridNumberXMm = tile.destinationXMm - OUTSIDE_GRID_NUMBER_OFFSET_PX * millimetresPerSourcePixel;
  const availableWidthMm = Math.max(1, gridNumberXMm - COMPANY_HALLMARK_PAGE_PADDING_MM - COMPANY_HALLMARK_GRID_NUMBER_GAP_MM);
  const widthMm = Math.min(availableWidthMm, Math.max(1, pageWidthMm - COMPANY_HALLMARK_PAGE_PADDING_MM * 2));
  const heightMm = Math.min(widthMm / COMPANY_HALLMARK_ASPECT_RATIO, Math.max(1, pageHeightMm - COMPANY_HALLMARK_PAGE_PADDING_MM * 2));
  const centeredTileYMm = tile.destinationYMm + (tile.destinationHeightMm - heightMm) / 2;

  return {
    xMm: COMPANY_HALLMARK_PAGE_PADDING_MM,
    yMm: Math.min(Math.max(0, centeredTileYMm), Math.max(0, pageHeightMm - heightMm)),
    widthMm,
    heightMm,
  };
}
