import type { DesignDocumentV1 } from "./types.ts";

export function estimateDesignDocumentBytes(document: DesignDocumentV1) {
  return new TextEncoder().encode(JSON.stringify(document)).byteLength;
}

export function pruneDesignHistory(entries: DesignDocumentV1[], maxEntries: number, maxBytes: number) {
  const kept = entries.slice(-Math.max(1, maxEntries));
  let bytes = kept.reduce((total, entry) => total + estimateDesignDocumentBytes(entry), 0);
  while (kept.length > 1 && bytes > maxBytes) bytes -= estimateDesignDocumentBytes(kept.shift()!);
  return kept;
}
