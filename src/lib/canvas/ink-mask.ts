export type ImageDataLike = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
};

const MIN_ALPHA_FOR_INK = 16;
const MIN_ALPHA_FOR_VECTORIZED_INK = 1;
const BACKGROUND_CONTRAST_GAP = 72;
const COLOR_DISTANCE_THRESHOLD = 58;
const MIN_COLORED_INK_CHANNEL_SPREAD = 18;
const MAX_INK_LUMA_THRESHOLD = 190;
const MIN_INK_LUMA_THRESHOLD = 48;
// Keep in sync with thinning's MIN_SIGNIFICANT_HOLE_PIXELS (8). A hole smaller
// than "significant" is a vector-rasterization pinhole, not a user-visible fill
// region.
const MAX_VECTORIZED_PINHOLE_PIXELS = 7;
const VECTORIZED_PINHOLE_COVERAGE_LIMIT = 192;
/** Below this alpha a pixel reads as bare paper, so it counts as hole area. */
const VECTORIZED_PINHOLE_VISIBLE_COVERAGE = MIN_ALPHA_FOR_INK;
/**
 * Absolute ceiling on one repaired island. A pinhole plus its antialiased rim
 * is a few dozen pixels at most; this stops a large, uniformly faint enclosed
 * area from being promoted to solid ink.
 */
const MAX_VECTORIZED_PINHOLE_ISLAND_PIXELS = MAX_VECTORIZED_PINHOLE_PIXELS * 8;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lumaForRgb(red: number, green: number, blue: number) {
  return 0.299 * red + 0.587 * green + 0.114 * blue;
}

function percentileFromHistogram(histogram: Uint32Array, total: number, percentile: number) {
  const target = Math.max(1, Math.round(total * percentile));
  let seen = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value];
    if (seen >= target) return value;
  }
  return histogram.length - 1;
}

function analyzeImageData(imageData: ImageDataLike) {
  const histogram = new Uint32Array(256);
  const data = imageData.data;
  let total = 0;

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < MIN_ALPHA_FOR_INK) continue;
    const luma = Math.round(lumaForRgb(data[index], data[index + 1], data[index + 2]));
    histogram[clamp(luma, 0, 255)] += 1;
    total += 1;
  }

  if (!total) {
    return {
      brightLuma: 255,
      inkThreshold: 238,
      background: { red: 255, green: 255, blue: 255 },
    };
  }

  const brightLuma = percentileFromHistogram(histogram, total, 0.92);
  const inkThreshold = clamp(brightLuma - BACKGROUND_CONTRAST_GAP, MIN_INK_LUMA_THRESHOLD, MAX_INK_LUMA_THRESHOLD);
  let redTotal = 0;
  let greenTotal = 0;
  let blueTotal = 0;
  let backgroundCount = 0;

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < MIN_ALPHA_FOR_INK) continue;
    const luma = lumaForRgb(data[index], data[index + 1], data[index + 2]);
    if (luma < brightLuma) continue;
    redTotal += data[index];
    greenTotal += data[index + 1];
    blueTotal += data[index + 2];
    backgroundCount += 1;
  }

  return {
    brightLuma,
    inkThreshold,
    background: {
      red: backgroundCount ? redTotal / backgroundCount : 255,
      green: backgroundCount ? greenTotal / backgroundCount : 255,
      blue: backgroundCount ? blueTotal / backgroundCount : 255,
    },
  };
}

function colorDistance(red: number, green: number, blue: number, background: { red: number; green: number; blue: number }) {
  const redDistance = red - background.red;
  const greenDistance = green - background.green;
  const blueDistance = blue - background.blue;
  return Math.sqrt(redDistance * redDistance + greenDistance * greenDistance + blueDistance * blueDistance);
}

function minimumInkComponentPixels(width: number, height: number) {
  return Math.max(3, Math.min(64, Math.round(Math.sqrt(width * height) * 0.016)));
}

function removeSmallInkComponents(mask: Uint8Array, width: number, height: number, count: number) {
  const minPixels = minimumInkComponentPixels(width, height);
  if (count < minPixels) return { mask, count };

  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let cleanCount = count;

  function enqueue(index: number, tail: number) {
    if (visited[index] || !mask[index]) return tail;
    visited[index] = 1;
    queue[tail] = index;
    return tail + 1;
  }

  for (let start = 0; start < mask.length; start += 1) {
    if (visited[start] || !mask[start]) continue;

    let head = 0;
    let tail = 0;
    tail = enqueue(start, tail);

    while (head < tail) {
      const index = queue[head];
      head += 1;
      const x = index % width;
      const y = Math.floor(index / width);

      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) {
          const next = yy * width + xx;
          tail = enqueue(next, tail);
        }
      }
    }

    if (tail >= minPixels) continue;
    cleanCount -= tail;
    for (let index = 0; index < tail; index += 1) {
      mask[queue[index]] = 0;
    }
  }

  return { mask, count: cleanCount };
}

/**
 * Vector rasterization can leave transparent pixels inside a solid contour —
 * typically where JPEG ringing in the source made the vectorizer trace a speck
 * as a hole. Those pixels are not ink, so they become their own enclosed fill
 * region, and the default enclosed-fill colour is transparent, which reveals
 * the paper and grid beneath the artwork as white spots.
 *
 * Repair only bounded enclosed islands; outer antialiasing and meaningful
 * larger holes stay untouched.
 *
 * The island is grown through any low-coverage pixel, so a hole and the
 * antialiased rim around it are repaired together. The size budget, however,
 * counts only the pixels that actually read as paper.
 *
 * That split is the correctness of this function. A rasterized hole is always
 * ringed by partially transparent pixels, so measuring the whole island against
 * the budget grew every one-pixel hole by its eight-pixel rim, pushed it past
 * the limit, and skipped the repair — leaving the white specks this exists to
 * remove. Counting only paper-revealing pixels keeps the budget measuring the
 * hole itself, while still promoting the faint pixels around it.
 */
function repairVectorizedInkPinholes(mask: Uint8Array, coverage: Uint8Array, width: number, height: number) {
  if (width < 3 || height < 3) return 0;

  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let addedInkPixels = 0;

  function isPinholeCandidate(index: number) {
    return coverage[index] < VECTORIZED_PINHOLE_COVERAGE_LIMIT;
  }

  function revealsPaper(index: number) {
    return coverage[index] < VECTORIZED_PINHOLE_VISIBLE_COVERAGE;
  }

  for (let start = 0; start < mask.length; start += 1) {
    if (visited[start] || !isPinholeCandidate(start)) continue;

    let head = 0;
    let tail = 0;
    let touchesBoundary = false;
    let paperPixels = 0;
    visited[start] = 1;
    queue[tail] = start;
    tail += 1;

    function enqueue(next: number) {
      if (visited[next] || !isPinholeCandidate(next)) return;
      visited[next] = 1;
      queue[tail] = next;
      tail += 1;
    }

    while (head < tail) {
      const index = queue[head];
      head += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBoundary = true;
      if (revealsPaper(index)) paperPixels += 1;

      if (x > 0) enqueue(index - 1);
      if (x < width - 1) enqueue(index + 1);
      if (y > 0) enqueue(index - width);
      if (y < height - 1) enqueue(index + width);
    }

    if (touchesBoundary) continue;
    // Nothing here reads as paper, so there is no artifact to repair.
    if (!paperPixels) continue;
    if (paperPixels > MAX_VECTORIZED_PINHOLE_PIXELS) continue;
    if (tail > MAX_VECTORIZED_PINHOLE_ISLAND_PIXELS) continue;
    for (let index = 0; index < tail; index += 1) {
      const pixel = queue[index];
      if (!mask[pixel]) addedInkPixels += 1;
      mask[pixel] = 1;
      coverage[pixel] = 255;
    }
  }

  return addedInkPixels;
}

export function maskFromImageData(imageData: ImageDataLike) {
  const mask = new Uint8Array(imageData.width * imageData.height);
  const data = imageData.data;
  const analysis = analyzeImageData(imageData);
  let count = 0;

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const alpha = data[index + 3];
    if (alpha < MIN_ALPHA_FOR_INK) continue;

    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luma = lumaForRgb(red, green, blue);
    const channelSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
    const isDarkInk = luma <= analysis.inkThreshold;
    const isColoredInk =
      channelSpread >= MIN_COLORED_INK_CHANNEL_SPREAD &&
      luma <= analysis.brightLuma - 12 &&
      colorDistance(red, green, blue, analysis.background) >= COLOR_DISTANCE_THRESHOLD;

    if (!isDarkInk && !isColoredInk) continue;
    mask[pixel] = 1;
    count += 1;
  }

  const cleaned = removeSmallInkComponents(mask, imageData.width, imageData.height, count);
  return {
    mask: cleaned.mask,
    count: cleaned.count,
    threshold: analysis.inkThreshold,
  };
}

/**
 * Restores full opacity to ink pixels that lie strictly inside the ink region.
 *
 * The vectorizer emits many adjacent filled paths and every one is normalised
 * to solid black (see styleVectorizedSvgForMask). When the browser rasterizes
 * them, each path antialiases against its neighbour, so two abutting edges
 * composite to roughly three-quarter coverage instead of full. Those seam
 * pixels carry alpha, so they are classified as ink and act as fill barriers,
 * but they are then painted at that reduced alpha — letting the paper and grid
 * show through as pale specks and hairlines inside solid artwork.
 *
 * Because every shape is solid black by construction, partial alpha strictly
 * inside the ink region is always a rasterization artifact and never intent.
 *
 * Only pixels whose entire eight-neighbourhood is ink are promoted. Anything
 * adjacent to a hole or to the outside keeps its coverage, so genuine contour
 * antialiasing and fill-pocket edges stay smooth.
 */
function solidifyInteriorVectorInk(mask: Uint8Array, coverage: Uint8Array, width: number, height: number) {
  if (width < 3 || height < 3) return 0;
  let solidified = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x;
      if (!mask[pixel] || coverage[pixel] === 255) continue;

      // Reads `mask` only, which this pass never mutates, so promotions cannot
      // cascade outward across the contour edge.
      const interior =
        mask[pixel - width - 1] && mask[pixel - width] && mask[pixel - width + 1] &&
        mask[pixel - 1] && mask[pixel + 1] &&
        mask[pixel + width - 1] && mask[pixel + width] && mask[pixel + width + 1];

      if (!interior) continue;
      coverage[pixel] = 255;
      solidified += 1;
    }
  }

  return solidified;
}

export function maskFromVectorizedImageData(imageData: ImageDataLike) {
  const mask = new Uint8Array(imageData.width * imageData.height);
  const coverage = new Uint8Array(mask.length);
  const data = imageData.data;
  let count = 0;

  // The vectorizer route normalizes every SVG shape to black on a transparent
  // background. Alpha therefore represents the vector contour directly; do
  // not apply photographed-artwork speckle cleanup here.
  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const alpha = data[index + 3];
    if (alpha < MIN_ALPHA_FOR_VECTORIZED_INK) continue;
    mask[pixel] = 1;
    coverage[pixel] = alpha;
    count += 1;
  }

  count += repairVectorizedInkPinholes(mask, coverage, imageData.width, imageData.height);
  // After pinhole repair, so a repaired hole counts as ink when deciding
  // which neighbouring pixels are interior.
  solidifyInteriorVectorInk(mask, coverage, imageData.width, imageData.height);

  return { mask, coverage, count };
}
