export type Rgb = { r: number; g: number; b: number; a?: number };

const hexRgbCache = new Map<string, Rgb>();
const rgbHexCache = new Map<string, string>();

export function hexToRgb(hex: string): Rgb {
  const normalizedHex = hex.toLowerCase();
  const cached = hexRgbCache.get(normalizedHex);
  if (cached) return cached;

  const clean = normalizedHex.replace("#", "");
  const value = {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
  hexRgbCache.set(normalizedHex, value);
  return value;
}

export function rgbToHex(rgb: Rgb) {
  const key = `${rgb.r},${rgb.g},${rgb.b}`;
  const cached = rgbHexCache.get(key);
  if (cached) return cached;

  const value = [rgb.r, rgb.g, rgb.b]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0"))
    .join("");
  const hexValue = `#${value}`;
  rgbHexCache.set(key, hexValue);
  return hexValue;
}

