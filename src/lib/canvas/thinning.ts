export type ThinArtworkOptions = {
  preserveSourceInk?: boolean;
  sourceFillThreshold?: number;
  sourceFillMinStrokePixels?: number;
  strokeGapClosePixels?: number;
};

export type ThinArtworkMasks = {
  enclosedFillMask: Uint8Array;
  fillMask: Uint8Array;
  outlineMask: Uint8Array;
  sourceFillMask: Uint8Array;
  strokeMask: Uint8Array;
};

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const FILLED_ASPECT_RATIO_LIMIT = 3;
const DEFAULT_SOURCE_FILL_THRESHOLD = 0.58;
const MIN_SOURCE_FILL_THRESHOLD = 0.05;
const MAX_SOURCE_FILL_THRESHOLD = 1;
const DEFAULT_SOURCE_FILL_MIN_STROKE_PIXELS = 7;
const MIN_SOURCE_FILL_MIN_STROKE_PIXELS = 2;
const MAX_SOURCE_FILL_MIN_STROKE_PIXELS = 48;
const DEFAULT_STROKE_GAP_CLOSE_PIXELS = 0;
const MIN_STROKE_GAP_CLOSE_PIXELS = 0;
const MAX_STROKE_GAP_CLOSE_PIXELS = 2;
const MIN_COMPONENT_PIXELS = 3;
const MIN_SOLID_FILL_MINOR_AXIS = 5;
const MIN_SIGNIFICANT_HOLE_PIXELS = 8;
const MIN_SIGNIFICANT_HOLE_RATIO = 0.025;
const MIN_SCANLINE_ARTIFACT_PIXELS = 24;
const SCANLINE_ARTIFACT_RATIO = 0.12;
const SCANLINE_ISOLATED_RATIO = 0.72;
const SCANLINE_COMPONENT_ASPECT_RATIO = 12;
const SCANLINE_COMPONENT_LONG_SIDE_RATIO = 0.18;
const SCANLINE_COMPONENT_MAX_SHORT_SIDE_RATIO = 0.012;

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeFillThreshold(value: unknown) {
  return clampNumber(value, MIN_SOURCE_FILL_THRESHOLD, MAX_SOURCE_FILL_THRESHOLD, DEFAULT_SOURCE_FILL_THRESHOLD);
}

function normalizeFillMinStrokePixels(value: unknown) {
  return Math.round(
    clampNumber(
      value,
      MIN_SOURCE_FILL_MIN_STROKE_PIXELS,
      MAX_SOURCE_FILL_MIN_STROKE_PIXELS,
      DEFAULT_SOURCE_FILL_MIN_STROKE_PIXELS,
    ),
  );
}

function normalizeGapClosePixels(value: unknown) {
  return Math.round(
    clampNumber(value, MIN_STROKE_GAP_CLOSE_PIXELS, MAX_STROKE_GAP_CLOSE_PIXELS, DEFAULT_STROKE_GAP_CLOSE_PIXELS),
  );
}

function copyMask(mask: Uint8Array) {
  const output = new Uint8Array(mask.length);
  output.set(mask);
  return output;
}

export function boundaryMask(mask: Uint8Array, width: number, height: number) {
  const boundary = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      if (
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        !mask[index - 1] ||
        !mask[index + 1] ||
        !mask[index - width] ||
        !mask[index + width]
      ) {
        boundary[index] = 1;
      }
    }
  }
  return boundary;
}

export function dilateMask(mask: Uint8Array, width: number, height: number, radius: number) {
  if (radius <= 0) return copyMask(mask);

  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;

      for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy += 1) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += 1) {
          output[yy * width + xx] = 1;
        }
      }
    }
  }

  return output;
}

function erodeMask(mask: Uint8Array, width: number, height: number, radius: number) {
  if (radius <= 0) return copyMask(mask);

  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = true;
      for (let yy = y - radius; yy <= y + radius && keep; yy += 1) {
        for (let xx = x - radius; xx <= x + radius; xx += 1) {
          if (xx < 0 || yy < 0 || xx >= width || yy >= height || !mask[yy * width + xx]) {
            keep = false;
            break;
          }
        }
      }
      if (keep) output[y * width + x] = 1;
    }
  }

  return output;
}

function closeMask(mask: Uint8Array, width: number, height: number, radius: number) {
  if (radius <= 0) return copyMask(mask);
  return erodeMask(dilateMask(mask, width, height, radius), width, height, radius);
}

function hasPerpendicularSupport(mask: Uint8Array, width: number, height: number, x: number, y: number, horizontal: boolean) {
  if (horizontal) {
    for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) {
      if (yy === y) continue;
      for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) {
        if (mask[yy * width + xx]) return true;
      }
    }
    return false;
  }

  for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) {
    for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) {
      if (xx === x) continue;
      if (mask[yy * width + xx]) return true;
    }
  }
  return false;
}

function removeScanlineArtifacts(mask: Uint8Array, width: number, height: number) {
  const output = copyMask(mask);
  const minHorizontalPixels = Math.max(MIN_SCANLINE_ARTIFACT_PIXELS, Math.round(width * SCANLINE_ARTIFACT_RATIO));
  const minVerticalPixels = Math.max(MIN_SCANLINE_ARTIFACT_PIXELS, Math.round(height * SCANLINE_ARTIFACT_RATIO));

  for (let y = 0; y < height; y += 1) {
    let rowCount = 0;
    let isolatedCount = 0;
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      rowCount += 1;
      if (!hasPerpendicularSupport(mask, width, height, x, y, true)) isolatedCount += 1;
    }

    if (rowCount < minHorizontalPixels || isolatedCount / rowCount < SCANLINE_ISOLATED_RATIO) continue;

    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] && !hasPerpendicularSupport(mask, width, height, x, y, true)) output[index] = 0;
    }
  }

  for (let x = 0; x < width; x += 1) {
    let columnCount = 0;
    let isolatedCount = 0;
    for (let y = 0; y < height; y += 1) {
      const index = y * width + x;
      if (!output[index]) continue;
      columnCount += 1;
      if (!hasPerpendicularSupport(output, width, height, x, y, false)) isolatedCount += 1;
    }

    if (columnCount < minVerticalPixels || isolatedCount / columnCount < SCANLINE_ISOLATED_RATIO) continue;

    for (let y = 0; y < height; y += 1) {
      const index = y * width + x;
      if (output[index] && !hasPerpendicularSupport(output, width, height, x, y, false)) output[index] = 0;
    }
  }

  return output;
}

function neighborCount(mask: Uint8Array, width: number, index: number) {
  return (
    mask[index - width] +
    mask[index - width + 1] +
    mask[index + 1] +
    mask[index + width + 1] +
    mask[index + width] +
    mask[index + width - 1] +
    mask[index - 1] +
    mask[index - width - 1]
  );
}

function transitionCount(mask: Uint8Array, width: number, index: number) {
  const values = [
    mask[index - width],
    mask[index - width + 1],
    mask[index + 1],
    mask[index + width + 1],
    mask[index + width],
    mask[index + width - 1],
    mask[index - 1],
    mask[index - width - 1],
  ];
  let transitions = 0;
  for (let current = 0; current < values.length; current += 1) {
    const next = (current + 1) % values.length;
    if (!values[current] && values[next]) transitions += 1;
  }
  return transitions;
}

export function thinMask(mask: Uint8Array, width: number, height: number) {
  const output = copyMask(mask);
  if (width < 3 || height < 3) return output;

  const remove = new Uint8Array(mask.length);
  let changed = true;
  while (changed) {
    changed = false;
    remove.fill(0);

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        if (!output[index]) continue;

        const neighbors = neighborCount(output, width, index);
        if (neighbors < 2 || neighbors > 6 || transitionCount(output, width, index) !== 1) continue;
        if (output[index - width] && output[index + 1] && output[index + width]) continue;
        if (output[index + 1] && output[index + width] && output[index - 1]) continue;
        remove[index] = 1;
      }
    }

    for (let index = 0; index < remove.length; index += 1) {
      if (!remove[index]) continue;
      output[index] = 0;
      changed = true;
    }

    remove.fill(0);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        if (!output[index]) continue;

        const neighbors = neighborCount(output, width, index);
        if (neighbors < 2 || neighbors > 6 || transitionCount(output, width, index) !== 1) continue;
        if (output[index - width] && output[index + 1] && output[index - 1]) continue;
        if (output[index - width] && output[index + width] && output[index - 1]) continue;
        remove[index] = 1;
      }
    }

    for (let index = 0; index < remove.length; index += 1) {
      if (!remove[index]) continue;
      output[index] = 0;
      changed = true;
    }
  }

  return output;
}

export function expandMaskForLineSize(mask: Uint8Array, width: number, height: number, lineSize: number) {
  const radius = Math.max(0, Math.floor(Math.max(0, lineSize) / 2));
  return radius > 0 ? dilateMask(mask, width, height, radius) : copyMask(mask);
}

function componentHoleCount(width: number, component: Int32Array, count: number, bounds: Bounds) {
  const localWidth = bounds.width;
  const localHeight = bounds.height;
  const localSize = localWidth * localHeight;
  const local = new Uint8Array(localSize);
  const outside = new Uint8Array(localSize);
  const queue = new Int32Array(localSize);
  let head = 0;
  let tail = 0;

  for (let index = 0; index < count; index += 1) {
    const pixel = component[index];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    local[(y - bounds.y) * localWidth + (x - bounds.x)] = 1;
  }

  function enqueue(localIndex: number) {
    if (local[localIndex] || outside[localIndex]) return;
    outside[localIndex] = 1;
    queue[tail] = localIndex;
    tail += 1;
  }

  for (let x = 0; x < localWidth; x += 1) {
    enqueue(x);
    enqueue((localHeight - 1) * localWidth + x);
  }
  for (let y = 1; y < localHeight - 1; y += 1) {
    enqueue(y * localWidth);
    enqueue(y * localWidth + localWidth - 1);
  }

  while (head < tail) {
    const localIndex = queue[head];
    head += 1;
    const x = localIndex % localWidth;
    const y = Math.floor(localIndex / localWidth);
    if (x > 0) enqueue(localIndex - 1);
    if (x < localWidth - 1) enqueue(localIndex + 1);
    if (y > 0) enqueue(localIndex - localWidth);
    if (y < localHeight - 1) enqueue(localIndex + localWidth);
  }

  let holes = 0;
  for (let index = 0; index < local.length; index += 1) {
    if (!local[index] && !outside[index]) holes += 1;
  }
  return holes;
}

function isSolidFillComponent(width: number, component: Int32Array, count: number, bounds: Bounds, threshold: number) {
  if (count < MIN_COMPONENT_PIXELS) return false;

  const boundsArea = bounds.width * bounds.height;
  const coverage = count / Math.max(1, boundsArea);
  if (coverage < threshold) return false;

  if (Math.min(bounds.width, bounds.height) < MIN_SOLID_FILL_MINOR_AXIS) return false;

  const aspectRatio = Math.max(bounds.width, bounds.height) / Math.max(1, Math.min(bounds.width, bounds.height));
  if (aspectRatio >= FILLED_ASPECT_RATIO_LIMIT) return false;

  const holes = componentHoleCount(width, component, count, bounds);
  const significantHolePixels = Math.max(MIN_SIGNIFICANT_HOLE_PIXELS, Math.round(boundsArea * MIN_SIGNIFICANT_HOLE_RATIO));
  return holes < significantHolePixels;
}

function isScanlineComponent(width: number, height: number, bounds: Bounds) {
  const longSide = Math.max(bounds.width, bounds.height);
  const shortSide = Math.min(bounds.width, bounds.height);
  const aspectRatio = longSide / Math.max(1, shortSide);
  const minLongSide = Math.max(MIN_SCANLINE_ARTIFACT_PIXELS, Math.round(Math.max(width, height) * SCANLINE_COMPONENT_LONG_SIDE_RATIO));
  const maxShortSide = Math.max(2, Math.round(Math.min(width, height) * SCANLINE_COMPONENT_MAX_SHORT_SIDE_RATIO));

  return aspectRatio >= SCANLINE_COMPONENT_ASPECT_RATIO && longSide >= minLongSide && shortSide <= maxShortSide;
}

function createLocalComponentMask(width: number, component: Int32Array, count: number, bounds: Bounds) {
  const localWidth = bounds.width;
  const local = new Uint8Array(localWidth * bounds.height);
  for (let index = 0; index < count; index += 1) {
    const pixel = component[index];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    local[(y - bounds.y) * localWidth + (x - bounds.x)] = 1;
  }
  return local;
}

function isLocalBoundary(local: Uint8Array, width: number, height: number, x: number, y: number) {
  for (let yy = y - 1; yy <= y + 1; yy += 1) {
    for (let xx = x - 1; xx <= x + 1; xx += 1) {
      if (xx === x && yy === y) continue;
      if (xx < 0 || yy < 0 || xx >= width || yy >= height || !local[yy * width + xx]) return true;
    }
  }
  return false;
}

function distanceFromComponentBoundary(local: Uint8Array, width: number, height: number, count: number) {
  const distance = new Uint16Array(local.length);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!local[index] || !isLocalBoundary(local, width, height, x, y)) continue;
      distance[index] = 1;
      queue[tail] = index;
      tail += 1;
    }
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    const nextDistance = distance[index] + 1;

    for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) {
      for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) {
        const nextIndex = yy * width + xx;
        if (!local[nextIndex] || distance[nextIndex]) continue;
        distance[nextIndex] = nextDistance;
        queue[tail] = nextIndex;
        tail += 1;
      }
    }
  }

  return distance;
}

function estimatedSourceWidth(distance: number) {
  return distance > 0 ? distance * 2 - 1 : 0;
}

function dilateLocalFill(fill: Uint8Array, local: Uint8Array, width: number, height: number, radius: number) {
  if (radius <= 0) return fill;

  const output = new Uint8Array(fill.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!fill[index]) continue;

      for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy += 1) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += 1) {
          const nextIndex = yy * width + xx;
          if (local[nextIndex]) output[nextIndex] = 1;
        }
      }
    }
  }

  return output;
}

function fillMaskForWideStrokes(
  width: number,
  component: Int32Array,
  count: number,
  bounds: Bounds,
  sourceFillThreshold: number,
  sourceFillMinStrokePixels: number,
) {
  const localWidth = bounds.width;
  const localHeight = bounds.height;
  const local = createLocalComponentMask(width, component, count, bounds);
  const distance = distanceFromComponentBoundary(local, localWidth, localHeight, count);
  const fill = new Uint8Array(local.length);
  const queue = new Int32Array(count);
  const growWidthThreshold = Math.max(1, Math.min(sourceFillMinStrokePixels, Math.round(sourceFillMinStrokePixels * sourceFillThreshold)));
  let head = 0;
  let tail = 0;

  for (let index = 0; index < local.length; index += 1) {
    if (!local[index] || estimatedSourceWidth(distance[index]) < sourceFillMinStrokePixels) continue;
    fill[index] = 1;
    queue[tail] = index;
    tail += 1;
  }

  if (!tail) return null;

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % localWidth;
    const y = Math.floor(index / localWidth);

    for (let yy = Math.max(0, y - 1); yy <= Math.min(localHeight - 1, y + 1); yy += 1) {
      for (let xx = Math.max(0, x - 1); xx <= Math.min(localWidth - 1, x + 1); xx += 1) {
        const nextIndex = yy * localWidth + xx;
        if (fill[nextIndex] || !local[nextIndex] || estimatedSourceWidth(distance[nextIndex]) < growWidthThreshold) continue;
        fill[nextIndex] = 1;
        queue[tail] = nextIndex;
        tail += 1;
      }
    }
  }

  const restoreRadius = Math.max(0, Math.floor(growWidthThreshold / 2));
  return dilateLocalFill(fill, local, localWidth, localHeight, restoreRadius);
}

function paintComponent(
  width: number,
  component: Int32Array,
  count: number,
  bounds: Bounds,
  fillLocalMask: Uint8Array | null,
  fillMask: Uint8Array,
  strokeMask: Uint8Array,
) {
  for (let index = 0; index < count; index += 1) {
    const pixel = component[index];
    if (!fillLocalMask) {
      strokeMask[pixel] = 1;
      continue;
    }

    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const localIndex = (y - bounds.y) * bounds.width + (x - bounds.x);
    if (fillLocalMask[localIndex]) fillMask[pixel] = 1;
    else strokeMask[pixel] = 1;
  }
}

export function createEnclosedRegionMask(barrierMask: Uint8Array, width: number, height: number) {
  const outside = new Uint8Array(barrierMask.length);
  const enclosed = new Uint8Array(barrierMask.length);
  const queue = new Int32Array(barrierMask.length);
  let head = 0;
  let tail = 0;

  function enqueue(index: number) {
    if (outside[index] || barrierMask[index]) return;
    outside[index] = 1;
    queue[tail] = index;
    tail += 1;
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y < height - 1) enqueue(index + width);
  }

  for (let index = 0; index < barrierMask.length; index += 1) {
    if (!barrierMask[index] && !outside[index]) enclosed[index] = 1;
  }

  return enclosed;
}

export function createThinArtworkMasks(inkMask: Uint8Array, width: number, height: number, options: ThinArtworkOptions = {}): ThinArtworkMasks {
  if (options.preserveSourceInk) {
    const sourceMask = copyMask(inkMask);
    const enclosedFillMask = createEnclosedRegionMask(sourceMask, width, height);
    return {
      enclosedFillMask,
      fillMask: copyMask(enclosedFillMask),
      outlineMask: copyMask(sourceMask),
      sourceFillMask: new Uint8Array(sourceMask.length),
      strokeMask: copyMask(sourceMask),
    };
  }

  const sourceFillThreshold = normalizeFillThreshold(options.sourceFillThreshold);
  const sourceFillMinStrokePixels = normalizeFillMinStrokePixels(options.sourceFillMinStrokePixels);
  const strokeGapClosePixels = normalizeGapClosePixels(options.strokeGapClosePixels);
  const sourceMask = removeScanlineArtifacts(closeMask(inkMask, width, height, strokeGapClosePixels), width, height);
  const visited = new Uint8Array(sourceMask.length);
  const queue = new Int32Array(sourceMask.length);
  const sourceFillMask = new Uint8Array(sourceMask.length);
  const strokeMask = new Uint8Array(sourceMask.length);

  function enqueue(index: number, tail: number) {
    if (visited[index] || !sourceMask[index]) return tail;
    visited[index] = 1;
    queue[tail] = index;
    return tail + 1;
  }

  for (let start = 0; start < sourceMask.length; start += 1) {
    if (visited[start] || !sourceMask[start]) continue;

    let head = 0;
    let tail = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    tail = enqueue(start, tail);

    while (head < tail) {
      const index = queue[head];
      head += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) {
          tail = enqueue(yy * width + xx, tail);
        }
      }
    }

    const bounds = {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX + 1),
      height: Math.max(1, maxY - minY + 1),
    };
    if (isScanlineComponent(width, height, bounds)) continue;

    if (isSolidFillComponent(width, queue, tail, bounds, sourceFillThreshold)) {
      paintComponent(width, queue, tail, bounds, createLocalComponentMask(width, queue, tail, bounds), sourceFillMask, strokeMask);
      continue;
    }

    paintComponent(
      width,
      queue,
      tail,
      bounds,
      fillMaskForWideStrokes(width, queue, tail, bounds, sourceFillThreshold, sourceFillMinStrokePixels),
      sourceFillMask,
      strokeMask,
    );
  }

  const thinnedStrokeMask = thinMask(strokeMask, width, height);
  const fillMask = new Uint8Array(sourceMask.length);
  const enclosedFillMask = createEnclosedRegionMask(sourceMask, width, height);
  for (let index = 0; index < fillMask.length; index += 1) {
    fillMask[index] = sourceFillMask[index] || enclosedFillMask[index] ? 1 : 0;
  }

  const fillBoundaryMask = boundaryMask(sourceFillMask, width, height);
  const outlineMask = new Uint8Array(sourceMask.length);
  for (let index = 0; index < outlineMask.length; index += 1) {
    outlineMask[index] = thinnedStrokeMask[index] || fillBoundaryMask[index] ? 1 : 0;
  }

  return {
    enclosedFillMask,
    fillMask,
    outlineMask,
    sourceFillMask,
    strokeMask: thinnedStrokeMask,
  };
}
