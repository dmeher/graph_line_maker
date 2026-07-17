export type DetectionImageData = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type DetectedCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ArtworkDetectionResult = {
  crop: DetectedCrop | null;
  confidence: number;
  reason: "detected" | "empty" | "edge-to-edge" | "complex-background";
};

export type ArtworkDetectionOptions = {
  colorTolerance?: number;
  gradientThreshold?: number;
  closeRadius?: 0 | 1 | 2;
  minimumComponentRatio?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function median(values: number[]) {
  if (!values.length) return 0;
  values.sort((left, right) => left - right);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

export function estimateArtworkBackground(image: DetectionImageData) {
  const { width, height, data } = image;
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  const alpha: number[] = [];
  const step = Math.max(1, Math.floor((width + height) / 600));

  function sample(x: number, y: number) {
    const offset = (y * width + x) * 4;
    red.push(data[offset]);
    green.push(data[offset + 1]);
    blue.push(data[offset + 2]);
    alpha.push(data[offset + 3]);
  }

  for (let x = 0; x < width; x += step) {
    sample(x, 0);
    if (height > 1) sample(x, height - 1);
  }
  for (let y = step; y < height - 1; y += step) {
    sample(0, y);
    if (width > 1) sample(width - 1, y);
  }

  const background = [median(red), median(green), median(blue), median(alpha)] as const;
  const distances = red.map((value, index) =>
    Math.abs(value - background[0]) +
    Math.abs(green[index] - background[1]) +
    Math.abs(blue[index] - background[2]) +
    Math.abs(alpha[index] - background[3]) * 0.5,
  );
  return { background, spread: median(distances) };
}

function dilate(mask: Uint8Array, width: number, height: number, radius: number) {
  if (!radius) return mask;
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let active = 0;
      for (let offsetY = -radius; offsetY <= radius && !active; offsetY += 1) {
        const sourceY = y + offsetY;
        if (sourceY < 0 || sourceY >= height) continue;
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const sourceX = x + offsetX;
          if (sourceX < 0 || sourceX >= width) continue;
          if (mask[sourceY * width + sourceX]) {
            active = 1;
            break;
          }
        }
      }
      output[y * width + x] = active;
    }
  }
  return output;
}

function erode(mask: Uint8Array, width: number, height: number, radius: number) {
  if (!radius) return mask;
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let active = 1;
      for (let offsetY = -radius; offsetY <= radius && active; offsetY += 1) {
        const sourceY = y + offsetY;
        if (sourceY < 0 || sourceY >= height) continue;
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const sourceX = x + offsetX;
          if (sourceX < 0 || sourceX >= width) continue;
          if (!mask[sourceY * width + sourceX]) {
            active = 0;
            break;
          }
        }
      }
      output[y * width + x] = active;
    }
  }
  return output;
}

export function detectArtworkBounds(
  image: DetectionImageData,
  options: ArtworkDetectionOptions = {},
): ArtworkDetectionResult {
  const width = Math.max(0, Math.round(image.width));
  const height = Math.max(0, Math.round(image.height));
  if (!width || !height || image.data.length < width * height * 4) {
    return { crop: null, confidence: 0, reason: "empty" };
  }

  const colorTolerance = clamp(Number(options.colorTolerance ?? 34), 4, 180);
  const gradientThreshold = clamp(Number(options.gradientThreshold ?? 72), 8, 500);
  const closeRadius = options.closeRadius ?? 1;
  const minimumComponentRatio = clamp(Number(options.minimumComponentRatio ?? 0.00002), 0, 0.02);
  const { background, spread } = estimateArtworkBackground({ ...image, width, height });
  const pixels = width * height;
  const grayscale = new Uint8Array(pixels);
  const difference = new Uint16Array(pixels);
  const foreground = new Uint8Array(pixels);

  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const offset = pixel * 4;
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    const alpha = image.data[offset + 3];
    grayscale[pixel] = Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
    const delta =
      Math.abs(red - background[0]) +
      Math.abs(green - background[1]) +
      Math.abs(blue - background[2]) +
      Math.abs(alpha - background[3]) * 0.75;
    difference[pixel] = delta;
    if ((background[3] < 32 && alpha > 24) || delta >= colorTolerance * 3) foreground[pixel] = 1;
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x;
      const topLeft = grayscale[pixel - width - 1];
      const top = grayscale[pixel - width];
      const topRight = grayscale[pixel - width + 1];
      const left = grayscale[pixel - 1];
      const right = grayscale[pixel + 1];
      const bottomLeft = grayscale[pixel + width - 1];
      const bottom = grayscale[pixel + width];
      const bottomRight = grayscale[pixel + width + 1];
      const gradientX = -topLeft + topRight - 2 * left + 2 * right - bottomLeft + bottomRight;
      const gradientY = -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight;
      const magnitude = Math.abs(gradientX) + Math.abs(gradientY);
      if (magnitude >= gradientThreshold && difference[pixel] >= colorTolerance) foreground[pixel] = 1;
    }
  }

  const closed = erode(dilate(foreground, width, height, closeRadius), width, height, closeRadius);
  const visited = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  const minimumArea = Math.max(3, Math.floor(pixels * minimumComponentRatio));
  let unionMinX = width;
  let unionMinY = height;
  let unionMaxX = -1;
  let unionMaxY = -1;
  let keptPixels = 0;

  for (let start = 0; start < pixels; start += 1) {
    if (!closed[start] || visited[start]) continue;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    visited[start] = 1;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const neighbors = [pixel - 1, pixel + 1, pixel - width, pixel + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= pixels || visited[neighbor] || !closed[neighbor]) continue;
        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) continue;
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }

    if (area < minimumArea) continue;
    keptPixels += area;
    unionMinX = Math.min(unionMinX, minX);
    unionMinY = Math.min(unionMinY, minY);
    unionMaxX = Math.max(unionMaxX, maxX);
    unionMaxY = Math.max(unionMaxY, maxY);
  }

  if (unionMaxX < unionMinX || unionMaxY < unionMinY || !keptPixels) {
    return { crop: null, confidence: 0, reason: spread > colorTolerance * 1.5 ? "complex-background" : "empty" };
  }

  // One native-analysis pixel protects antialiased edge coverage without adding
  // a visible user margin around the detected artwork.
  const minX = Math.max(0, unionMinX - 1);
  const minY = Math.max(0, unionMinY - 1);
  const maxX = Math.min(width - 1, unionMaxX + 1);
  const maxY = Math.min(height - 1, unionMaxY + 1);
  const touches = Number(minX === 0) + Number(minY === 0) + Number(maxX === width - 1) + Number(maxY === height - 1);
  const areaRatio = keptPixels / pixels;
  const backgroundPenalty = clamp(spread / Math.max(1, colorTolerance * 5), 0, 0.4);
  const confidence = clamp(0.62 + Math.min(0.22, Math.sqrt(areaRatio)) - backgroundPenalty - touches * 0.06, 0, 1);

  return {
    crop: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    confidence,
    reason: touches === 4 ? "edge-to-edge" : "detected",
  };
}
