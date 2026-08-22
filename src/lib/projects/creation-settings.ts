import type { GraphSettings, GraphSourceImage } from "../types.ts";

export type FinalizedProjectSource = {
  id: string;
  name: string;
  path: string;
  thumbPath: string | null;
};

function roundCells(value: number) {
  return Math.round(value * 100) / 100;
}

function defaultSourceX(graphWidth: number, width: number) {
  return roundCells(Math.max(0, (graphWidth - width) / 2));
}

/**
 * Applies one creation-time import choice to every finalized upload. Keeping
 * this pure prevents the POST/PATCH upload orchestration from ever drifting
 * from the persisted source defaults that the editor later consumes.
 */
export function buildProjectSettingsWithSources(
  settings: GraphSettings,
  uploadedImages: readonly FinalizedProjectSource[],
  options: { vectorizeSources: boolean },
) {
  const sourceImages: GraphSourceImage[] = uploadedImages.map((image, index) => ({
    ...image,
    width: settings.imageWidth,
    height: settings.imageHeight,
    measurementUnit: settings.measurementUnit,
    imageLineThickness: settings.imageLineThickness,
    sourceFillThreshold: settings.sourceFillThreshold,
    sourceFillMinStrokePixels: settings.sourceFillMinStrokePixels,
    strokeGapClosePixels: settings.strokeGapClosePixels,
    imageAutoEnhance: settings.imageAutoEnhance,
    imageDenoiseLevel: settings.imageDenoiseLevel,
    imageEdgeDetection: settings.imageEdgeDetection,
    imageColorQuantization: settings.imageColorQuantization,
    vectorizerLineAdjust: settings.vectorizerLineAdjust,
    vectorizerInkThreshold: settings.vectorizerInkThreshold,
    vectorizerSketchRemoval: settings.vectorizerSketchRemoval,
    vectorizerFidelity: settings.vectorizerFidelity,
    vectorize: options.vectorizeSources,
    x: defaultSourceX(settings.graphWidth, settings.imageWidth),
    y: index * settings.imageHeight,
    topPadding: 0,
    bottomPadding: 0,
    locked: false,
    visible: true,
    rotationDegrees: 0 as const,
    flipX: false,
    flipY: false,
  }));

  return {
    ...settings,
    sourceImages,
  };
}
