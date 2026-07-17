export type PerformanceTier = "low" | "standard" | "high";

export type PreviewPolicy = {
  tier: PerformanceTier;
  draftPixelCap: number;
  imageCacheBytes: number;
  historyBytes: number;
  taskConcurrency: 1 | 2;
  retainedBytesTarget: number;
};

export type DeviceCapabilities = {
  deviceMemoryGb?: number | null;
  hardwareConcurrency?: number | null;
  maxTouchPoints?: number | null;
};

const MEGABYTE = 1024 * 1024;

export const PREVIEW_POLICIES: Record<PerformanceTier, PreviewPolicy> = {
  low: {
    tier: "low",
    draftPixelCap: 1_000_000,
    imageCacheBytes: 64 * MEGABYTE,
    historyBytes: 24 * MEGABYTE,
    taskConcurrency: 1,
    retainedBytesTarget: 256 * MEGABYTE,
  },
  standard: {
    tier: "standard",
    draftPixelCap: 1_500_000,
    imageCacheBytes: 96 * MEGABYTE,
    historyBytes: 48 * MEGABYTE,
    taskConcurrency: 2,
    retainedBytesTarget: 384 * MEGABYTE,
  },
  high: {
    tier: "high",
    draftPixelCap: 2_500_000,
    imageCacheBytes: 128 * MEGABYTE,
    historyBytes: 64 * MEGABYTE,
    taskConcurrency: 2,
    retainedBytesTarget: 384 * MEGABYTE,
  },
};

export function performanceTierForCapabilities(capabilities: DeviceCapabilities): PerformanceTier {
  const memory = Number(capabilities.deviceMemoryGb);
  const cores = Number(capabilities.hardwareConcurrency);
  const hasMemory = Number.isFinite(memory) && memory > 0;
  const hasCores = Number.isFinite(cores) && cores > 0;

  if ((hasMemory && memory <= 4) || (hasCores && cores <= 4)) return "low";
  if (hasMemory && hasCores && memory >= 12 && cores >= 8) return "high";
  return "standard";
}

export function previewPolicyForCapabilities(capabilities: DeviceCapabilities): PreviewPolicy {
  return PREVIEW_POLICIES[performanceTierForCapabilities(capabilities)];
}

export function detectPreviewPolicy(): PreviewPolicy {
  if (typeof navigator === "undefined") return PREVIEW_POLICIES.standard;
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  return previewPolicyForCapabilities({
    deviceMemoryGb: navigatorWithMemory.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

export function draftDimensions(width: number, height: number, policy: PreviewPolicy) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const pixels = safeWidth * safeHeight;
  if (pixels <= policy.draftPixelCap) return { width: safeWidth, height: safeHeight, scale: 1 };
  const scale = Math.sqrt(policy.draftPixelCap / pixels);
  return {
    width: Math.max(1, Math.floor(safeWidth * scale)),
    height: Math.max(1, Math.floor(safeHeight * scale)),
    scale,
  };
}

/**
 * Allocates the policy's image-cache budget across all layer slots that can
 * retain a pristine or derived working canvas. This keeps many-layer projects
 * bounded even when their compressed upload bytes are tiny.
 */
export function workingImagePixelCap(policy: PreviewPolicy, itemCount: number, absolutePixelCap: number) {
  const safeItemCount = Math.max(1, Math.round(itemCount) || 1);
  const safeAbsoluteCap = Math.max(1, Math.round(absolutePixelCap) || 1);
  const cachePixelCap = Math.max(1, Math.floor(policy.imageCacheBytes / 4 / safeItemCount));
  return Math.min(safeAbsoluteCap, cachePixelCap);
}
