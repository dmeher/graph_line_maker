export type ImageDataLike = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
};

const MIN_ALPHA_FOR_INK = 16;
const BACKGROUND_CONTRAST_GAP = 72;
const COLOR_DISTANCE_THRESHOLD = 58;
const MIN_COLORED_INK_CHANNEL_SPREAD = 18;
const MAX_INK_LUMA_THRESHOLD = 190;
const MIN_INK_LUMA_THRESHOLD = 48;

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
