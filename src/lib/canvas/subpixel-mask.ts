export type SubpixelSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type SubpixelDot = {
  x: number;
  y: number;
};

export type SubpixelMaskPlan = {
  dots: SubpixelDot[];
  segments: SubpixelSegment[];
};

export type SubpixelStrokeStyle = {
  alpha: number;
  strokeWidth: number;
};

export type SubpixelMaskVisitor = {
  dot?: (dot: SubpixelDot) => void;
  segment?: (segment: SubpixelSegment) => void;
};

function hasMaskPixel(mask: Uint8Array, width: number, height: number, x: number, y: number) {
  return x >= 0 && y >= 0 && x < width && y < height && Boolean(mask[y * width + x]);
}

export function visitSubpixelMaskPlan(mask: Uint8Array, width: number, height: number, visitor: SubpixelMaskVisitor) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;

      const centerX = x + 0.5;
      const centerY = y + 0.5;
      visitor.dot?.({ x: centerX, y: centerY });

      const right = hasMaskPixel(mask, width, height, x + 1, y);
      const down = hasMaskPixel(mask, width, height, x, y + 1);
      const downRight = hasMaskPixel(mask, width, height, x + 1, y + 1);
      const downLeft = hasMaskPixel(mask, width, height, x - 1, y + 1);

      if (right) visitor.segment?.({ x1: centerX, y1: centerY, x2: centerX + 1, y2: centerY });
      if (down) visitor.segment?.({ x1: centerX, y1: centerY, x2: centerX, y2: centerY + 1 });
      if (downRight && !right && !down) visitor.segment?.({ x1: centerX, y1: centerY, x2: centerX + 1, y2: centerY + 1 });
      if (downLeft && !down && !hasMaskPixel(mask, width, height, x - 1, y)) {
        visitor.segment?.({ x1: centerX, y1: centerY, x2: centerX - 1, y2: centerY + 1 });
      }
    }
  }
}

export function createSubpixelMaskPlan(mask: Uint8Array, width: number, height: number): SubpixelMaskPlan {
  const dots: SubpixelDot[] = [];
  const segments: SubpixelSegment[] = [];

  visitSubpixelMaskPlan(mask, width, height, {
    dot: (dot) => dots.push(dot),
    segment: (segment) => segments.push(segment),
  });

  return { dots, segments };
}

function foregroundNeighborCount(mask: Uint8Array, width: number, x: number, y: number) {
  return (
    mask[(y - 1) * width + x] +
    mask[(y - 1) * width + x + 1] +
    mask[y * width + x + 1] +
    mask[(y + 1) * width + x + 1] +
    mask[(y + 1) * width + x] +
    mask[(y + 1) * width + x - 1] +
    mask[y * width + x - 1] +
    mask[(y - 1) * width + x - 1]
  );
}

function foregroundTransitionCount(mask: Uint8Array, width: number, x: number, y: number) {
  const neighbors = [
    mask[(y - 1) * width + x],
    mask[(y - 1) * width + x + 1],
    mask[y * width + x + 1],
    mask[(y + 1) * width + x + 1],
    mask[(y + 1) * width + x],
    mask[(y + 1) * width + x - 1],
    mask[y * width + x - 1],
    mask[(y - 1) * width + x - 1],
  ];
  let transitions = 0;
  for (let index = 0; index < neighbors.length; index += 1) {
    if (!neighbors[index] && neighbors[(index + 1) % neighbors.length]) transitions += 1;
  }
  return transitions;
}

function collectSkeletonRemovals(mask: Uint8Array, width: number, height: number, step: 1 | 2) {
  const removals: number[] = [];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;

      const neighborCount = foregroundNeighborCount(mask, width, x, y);
      if (neighborCount < 2 || neighborCount > 6) continue;
      if (foregroundTransitionCount(mask, width, x, y) !== 1) continue;

      const north = mask[(y - 1) * width + x];
      const east = mask[y * width + x + 1];
      const south = mask[(y + 1) * width + x];
      const west = mask[y * width + x - 1];
      const shouldRemove =
        step === 1
          ? (!north || !east || !south) && (!east || !south || !west)
          : (!north || !east || !west) && (!north || !south || !west);

      if (shouldRemove) removals.push(index);
    }
  }

  return removals;
}

export function skeletonizeMask(mask: Uint8Array, width: number, height: number) {
  if (width < 3 || height < 3) return mask;

  const output = new Uint8Array(mask);
  let changed = true;
  let iterations = 0;
  const maxIterations = Math.max(width, height);

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations += 1;

    for (const step of [1, 2] as const) {
      const removals = collectSkeletonRemovals(output, width, height, step);
      if (!removals.length) continue;
      changed = true;
      for (const index of removals) output[index] = 0;
    }
  }

  return output;
}

export function subpixelStrokeStyle(lineWidth: number): SubpixelStrokeStyle {
  const requestedWidth = Math.max(0.01, lineWidth);
  return {
    alpha: 1,
    strokeWidth: Math.max(0.25, requestedWidth),
  };
}
