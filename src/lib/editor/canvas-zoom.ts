/**
 * Canvas zoom bounds and parsing shared by the Navigator controls, the command
 * palette, pinch zoom, and fit-to-view. Keeping them in one place stops the
 * clamp from drifting between the surfaces that can change zoom.
 */

export const MIN_CANVAS_ZOOM = 0.35;
export const MAX_CANVAS_ZOOM = 5;
export const DEFAULT_CANVAS_ZOOM = 1;
/** One press of zoom in/out moves the canvas by ten percentage points. */
export const CANVAS_ZOOM_STEP = 0.1;

export const MIN_CANVAS_ZOOM_PERCENT = Math.round(MIN_CANVAS_ZOOM * 100);
export const MAX_CANVAS_ZOOM_PERCENT = Math.round(MAX_CANVAS_ZOOM * 100);

/**
 * CSS reference pixels per centimetre. The CSS inch is defined as 96 reference
 * pixels, so this is the only conversion a browser exposes — there is no API
 * for a display's true physical pitch. It is exact when the browser is at 100%
 * zoom on a display whose CSS pixel matches the reference (the common desktop
 * case) and off by the same factor as any OS display scaling otherwise.
 */
export const CSS_PIXELS_PER_CM = 96 / 2.54;

export function clampCanvasZoom(zoom: number) {
  if (!Number.isFinite(zoom)) return DEFAULT_CANVAS_ZOOM;
  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, zoom));
}

/** Clamps and rounds to whole percent, so the readout and the input agree. */
export function roundCanvasZoom(zoom: number) {
  return Math.round(clampCanvasZoom(zoom) * 100) / 100;
}

export function canvasZoomPercent(zoom: number) {
  return Math.round(clampCanvasZoom(zoom) * 100);
}

/**
 * Moves zoom one step in or out. Rounding every step keeps the stored value on
 * whole percents: repeated float addition otherwise drifts (0.35 + 0.1 is not
 * 0.45), and that drift reaches canvas layout maths, not just the readout.
 */
export function stepCanvasZoom(zoom: number, direction: 1 | -1) {
  return roundCanvasZoom(clampCanvasZoom(zoom) + direction * CANVAS_ZOOM_STEP);
}

/**
 * Zoom at which one graph cell measures one physical centimetre on screen.
 *
 * A cell is drawn `cellPixels` canvas pixels wide and the stage is scaled by
 * zoom, so on-screen cell size is `cellPixels * zoom` CSS pixels. Deliberately
 * not rounded to a whole percent: at a 40-pixel cell the exact zoom is 94.49%,
 * and rounding it would stretch a 20-cell graph by about a millimetre. The
 * readout still shows the rounded percentage.
 */
export function actualSizeCanvasZoom(cellPixels: number) {
  if (!Number.isFinite(cellPixels) || cellPixels <= 0) return DEFAULT_CANVAS_ZOOM;
  return clampCanvasZoom(CSS_PIXELS_PER_CM / cellPixels);
}

/**
 * Reads a manually typed zoom percentage.
 *
 * Returns `null` for anything that is not a usable number so the caller can
 * restore the current zoom rather than jump to an arbitrary value; a typed
 * number outside the supported range is clamped instead of rejected, because
 * "500" and "5000" both clearly mean "as far in as this editor goes".
 */
export function parseCanvasZoomPercent(value: string) {
  const numeric = Number.parseFloat(value.replace(/[%\s,]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return roundCanvasZoom(numeric / 100);
}
