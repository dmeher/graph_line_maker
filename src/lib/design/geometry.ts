import type { DesignCrop, DesignNode } from "./types.ts";

export type DesignSplitMode = "horizontal" | "vertical" | "quarters";

export function splitPixelRect(rect: { x: number; y: number; width: number; height: number }, mode: DesignSplitMode) {
  const leftWidth = Math.floor(rect.width / 2);
  const rightWidth = rect.width - leftWidth;
  const topHeight = Math.floor(rect.height / 2);
  const bottomHeight = rect.height - topHeight;
  if (mode === "vertical") return [
    { x: rect.x, y: rect.y, width: leftWidth, height: rect.height },
    { x: rect.x + leftWidth, y: rect.y, width: rightWidth, height: rect.height },
  ];
  if (mode === "horizontal") return [
    { x: rect.x, y: rect.y, width: rect.width, height: topHeight },
    { x: rect.x, y: rect.y + topHeight, width: rect.width, height: bottomHeight },
  ];
  return [
    { x: rect.x, y: rect.y, width: leftWidth, height: topHeight },
    { x: rect.x + leftWidth, y: rect.y, width: rightWidth, height: topHeight },
    { x: rect.x, y: rect.y + topHeight, width: leftWidth, height: bottomHeight },
    { x: rect.x + leftWidth, y: rect.y + topHeight, width: rightWidth, height: bottomHeight },
  ];
}

export function splitNormalizedCrop(crop: DesignCrop, mode: DesignSplitMode): DesignCrop[] {
  const halfWidth = crop.width / 2;
  const halfHeight = crop.height / 2;
  if (mode === "vertical") return [
    { x: crop.x, y: crop.y, width: halfWidth, height: crop.height },
    { x: crop.x + halfWidth, y: crop.y, width: crop.width - halfWidth, height: crop.height },
  ];
  if (mode === "horizontal") return [
    { x: crop.x, y: crop.y, width: crop.width, height: halfHeight },
    { x: crop.x, y: crop.y + halfHeight, width: crop.width, height: crop.height - halfHeight },
  ];
  return [
    { x: crop.x, y: crop.y, width: halfWidth, height: halfHeight },
    { x: crop.x + halfWidth, y: crop.y, width: crop.width - halfWidth, height: halfHeight },
    { x: crop.x, y: crop.y + halfHeight, width: halfWidth, height: crop.height - halfHeight },
    { x: crop.x + halfWidth, y: crop.y + halfHeight, width: crop.width - halfWidth, height: crop.height - halfHeight },
  ];
}

export function cropForQuickRegion(region: "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right"): DesignCrop {
  const horizontal = region.includes("left") ? 0 : region.includes("right") ? 0.5 : 0;
  const vertical = region.includes("top") ? 0 : region.includes("bottom") ? 0.5 : 0;
  return { x: horizontal, y: vertical, width: region === "top" || region === "bottom" ? 1 : 0.5, height: region === "left" || region === "right" ? 1 : 0.5 };
}

export function snapDesignNodePosition(
  node: Pick<DesignNode, "id" | "width" | "height">,
  position: { x: number; y: number },
  nodes: Array<Pick<DesignNode, "id" | "x" | "y" | "width" | "height" | "visible">>,
  canvas: { width: number; height: number },
  threshold = 8,
) {
  const xAnchors = [0, canvas.width / 2, canvas.width];
  const yAnchors = [0, canvas.height / 2, canvas.height];
  for (const other of nodes) {
    if (other.id === node.id || !other.visible) continue;
    xAnchors.push(other.x, other.x + other.width / 2, other.x + other.width);
    yAnchors.push(other.y, other.y + other.height / 2, other.y + other.height);
  }
  const ownX = [position.x, position.x + node.width / 2, position.x + node.width];
  const ownY = [position.y, position.y + node.height / 2, position.y + node.height];
  let bestX = position.x; let bestY = position.y; let xDistance = threshold + 1; let yDistance = threshold + 1;
  for (const anchor of xAnchors) for (const own of ownX) { const distance = Math.abs(anchor - own); if (distance < xDistance) { xDistance = distance; bestX = position.x + anchor - own; } }
  for (const anchor of yAnchors) for (const own of ownY) { const distance = Math.abs(anchor - own); if (distance < yDistance) { yDistance = distance; bestY = position.y + anchor - own; } }
  return { x: bestX, y: bestY, snappedX: xDistance <= threshold, snappedY: yDistance <= threshold };
}

export function placementForSplitRect(
  node: Pick<DesignNode, "x" | "y" | "width" | "height" | "rotation" | "flipX" | "flipY">,
  source: { width: number; height: number },
  rect: { x: number; y: number; width: number; height: number },
) {
  const width = node.width * rect.width / source.width; const height = node.height * rect.height / source.height;
  let localX = ((rect.x + rect.width / 2) / source.width - 0.5) * node.width;
  let localY = ((rect.y + rect.height / 2) / source.height - 0.5) * node.height;
  if (node.flipX) localX *= -1; if (node.flipY) localY *= -1;
  const radians = node.rotation * Math.PI / 180;
  const offsetX = localX * Math.cos(radians) - localY * Math.sin(radians);
  const offsetY = localX * Math.sin(radians) + localY * Math.cos(radians);
  return { x: node.x + node.width / 2 + offsetX - width / 2, y: node.y + node.height / 2 + offsetY - height / 2, width, height };
}
