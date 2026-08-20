import { estimateArtworkBackground, type DetectionImageData } from "../canvas/artwork-detection.ts";

export type ExtractionCandidate = { id: string; x: number; y: number; width: number; height: number; area: number };
export type ExtractionOptions = { tolerance?: number; minimumComponentRatio?: number; groupingRatio?: number; paddingRatio?: number; maxCandidates?: number };

function dilate(mask: Uint8Array, width: number, height: number) {
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    let active = 0;
    for (let oy = -1; oy <= 1 && !active; oy += 1) for (let ox = -1; ox <= 1; ox += 1) {
      const sx = x + ox; const sy = y + oy;
      if (sx >= 0 && sx < width && sy >= 0 && sy < height && mask[sy * width + sx]) { active = 1; break; }
    }
    output[y * width + x] = active;
  }
  return output;
}

function erode(mask: Uint8Array, width: number, height: number) {
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    let active = 1;
    for (let oy = -1; oy <= 1 && active; oy += 1) for (let ox = -1; ox <= 1; ox += 1) {
      const sx = x + ox; const sy = y + oy;
      if (sx < 0 || sx >= width || sy < 0 || sy >= height || !mask[sy * width + sx]) { active = 0; break; }
    }
    output[y * width + x] = active;
  }
  return output;
}

function boxesNear(a: ExtractionCandidate, b: ExtractionCandidate, gap: number) {
  return a.x <= b.x + b.width + gap && b.x <= a.x + a.width + gap && a.y <= b.y + b.height + gap && b.y <= a.y + a.height + gap;
}

function unionCandidates(a: ExtractionCandidate, b: ExtractionCandidate): ExtractionCandidate {
  const x = Math.min(a.x, b.x); const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width); const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { id: a.id, x, y, width: right - x, height: bottom - y, area: a.area + b.area };
}

export function detectExtractionCandidates(image: DetectionImageData, options: ExtractionOptions = {}): ExtractionCandidate[] {
  const { width, height, data } = image;
  if (!width || !height || data.length < width * height * 4) return [];
  const tolerance = Math.max(4, Math.min(180, options.tolerance ?? 34));
  const minimumArea = Math.max(3, Math.floor(width * height * (options.minimumComponentRatio ?? 0.00002)));
  const groupingGap = Math.max(2, Math.min(24, Math.round(Math.min(width, height) * (options.groupingRatio ?? 0.0075))));
  const { background } = estimateArtworkBackground(image);
  const foreground = new Uint8Array(width * height);
  for (let pixel = 0; pixel < foreground.length; pixel += 1) {
    const offset = pixel * 4; const alpha = data[offset + 3];
    const difference = Math.abs(data[offset] - background[0]) + Math.abs(data[offset + 1] - background[1]) + Math.abs(data[offset + 2] - background[2]) + Math.abs(alpha - background[3]) * 0.75;
    if ((background[3] < 32 && alpha > 24) || difference >= tolerance * 3) foreground[pixel] = 1;
  }
  const closed = erode(dilate(foreground, width, height), width, height);
  const visited = new Uint8Array(closed.length); const queue = new Int32Array(closed.length); const components: ExtractionCandidate[] = [];
  for (let start = 0; start < closed.length; start += 1) {
    if (!closed[start] || visited[start]) continue;
    let head = 0; let tail = 1; let area = 0; let minX = width; let minY = height; let maxX = -1; let maxY = -1;
    queue[0] = start; visited[start] = 1;
    while (head < tail) {
      const pixel = queue[head++]; const x = pixel % width; const y = Math.floor(pixel / width);
      area += 1; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      for (let oy = -1; oy <= 1; oy += 1) for (let ox = -1; ox <= 1; ox += 1) {
        if (!ox && !oy) continue; const nx = x + ox; const ny = y + oy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx; if (!visited[next] && closed[next]) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    if (area >= minimumArea) components.push({ id: `candidate-${components.length + 1}`, x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, area });
  }
  let groups = components;
  let changed = true;
  while (changed) {
    changed = false; const next: ExtractionCandidate[] = [];
    for (const component of groups) {
      const match = next.findIndex((candidate) => boxesNear(candidate, component, groupingGap));
      if (match === -1) next.push(component); else { next[match] = unionCandidates(next[match], component); changed = true; }
    }
    groups = next;
  }
  const paddingRatio = options.paddingRatio ?? 0.01;
  return groups
    .sort((a, b) => b.area - a.area)
    .slice(0, options.maxCandidates ?? 100)
    .map((candidate, index) => {
      const padding = Math.max(1, Math.round(Math.min(candidate.width, candidate.height) * paddingRatio));
      const x = Math.max(0, candidate.x - padding); const y = Math.max(0, candidate.y - padding);
      const right = Math.min(width, candidate.x + candidate.width + padding); const bottom = Math.min(height, candidate.y + candidate.height + padding);
      return { ...candidate, id: `candidate-${index + 1}`, x, y, width: right - x, height: bottom - y };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
}
