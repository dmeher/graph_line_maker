/// <reference lib="webworker" />

import { detectExtractionCandidates, type ExtractionOptions } from "./extraction.ts";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<{ id: string; width: number; height: number; buffer: ArrayBuffer; options: ExtractionOptions }>) => {
  const { id, width, height, buffer, options } = event.data;
  try {
    const candidates = detectExtractionCandidates({ width, height, data: new Uint8ClampedArray(buffer) }, options);
    self.postMessage({ id, candidates });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "Unable to extract artwork." });
  }
};

export {};
