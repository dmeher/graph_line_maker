"use client";

import { detectExtractionCandidates, type ExtractionCandidate, type ExtractionOptions } from "@/lib/design/extraction";

export async function detectExtractionCandidatesAsync(image: ImageData, options: ExtractionOptions = {}, signal?: AbortSignal): Promise<ExtractionCandidate[]> {
  if (signal?.aborted) throw new DOMException("Extraction aborted.", "AbortError");
  if (typeof Worker === "undefined") return detectExtractionCandidates(image, options);
  const worker = new Worker(new URL("./extraction.worker.ts", import.meta.url), { type: "module" });
  const id = crypto.randomUUID();
  const copy = image.data.slice();
  return new Promise<ExtractionCandidate[]>((resolve, reject) => {
    const abort = () => { worker.terminate(); reject(new DOMException("Extraction aborted.", "AbortError")); };
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ id: string; candidates?: ExtractionCandidate[]; error?: string }>) => {
      if (event.data.id !== id) return;
      signal?.removeEventListener("abort", abort); worker.terminate();
      if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.candidates ?? []);
    };
    worker.onerror = () => { signal?.removeEventListener("abort", abort); worker.terminate(); resolve(detectExtractionCandidates(image, options)); };
    worker.postMessage({ id, width: image.width, height: image.height, buffer: copy.buffer, options }, [copy.buffer]);
  });
}
