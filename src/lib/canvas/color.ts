import type { PaletteColor } from "@/lib/types";

export type Rgb = { r: number; g: number; b: number; a?: number };

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

export function rgbToHex(rgb: Rgb) {
  const value = [rgb.r, rgb.g, rgb.b]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0"))
    .join("");
  return `#${value}`;
}

export function colorDistance(left: Rgb, right: Rgb) {
  const r = left.r - right.r;
  const g = left.g - right.g;
  const b = left.b - right.b;
  return r * r + g * g + b * b;
}

export function nearestPaletteColor(color: Rgb, palette: PaletteColor[]) {
  if (!palette.length) return color;
  let nearest = hexToRgb(palette[0].hex);
  let distance = Number.POSITIVE_INFINITY;

  for (const paletteColor of palette) {
    const candidate = hexToRgb(paletteColor.hex);
    const nextDistance = colorDistance(color, candidate);
    if (nextDistance < distance) {
      nearest = candidate;
      distance = nextDistance;
    }
  }

  return nearest;
}

export function contrastColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

