function positiveInteger(value: unknown, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
}

function normalizeRightAngleRotation(rotationDegrees = 0) {
  return ((Math.round(rotationDegrees / 90) * 90) % 360 + 360) % 360;
}

function normalizeFreeRotation(rotationDegrees = 0) {
  const numeric = Number(rotationDegrees);
  if (!Number.isFinite(numeric)) return 0;
  return ((numeric % 360) + 360) % 360;
}

export function transformedImageSize(width: number, height: number, rotationDegrees = 0, straightenDegrees = 0) {
  const safeWidth = positiveInteger(width);
  const safeHeight = positiveInteger(height);
  const rotation = normalizeFreeRotation(normalizeRightAngleRotation(rotationDegrees) + Number(straightenDegrees || 0));
  const radians = (rotation * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  return {
    width: Math.max(1, Math.ceil(safeWidth * cosine + safeHeight * sine)),
    height: Math.max(1, Math.ceil(safeWidth * sine + safeHeight * cosine)),
    rotationDegrees: rotation,
  };
}
