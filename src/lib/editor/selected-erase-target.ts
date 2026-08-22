import type { GraphSourceImage } from "@/lib/types";

/**
 * Returns the single source that destructive image tools are allowed to edit.
 * Multi-selection deliberately has no destructive meaning: the user must make
 * one unlocked source the active selection first. Visibility controls canvas
 * composition only; a selected hidden source remains editable.
 */
export function selectedEraseTarget(
  sources: readonly GraphSourceImage[],
  selectedSourceId: string | null,
  selectedLayerKeys: readonly string[],
) {
  if (!selectedSourceId || selectedLayerKeys.length !== 1 || selectedLayerKeys[0] !== `source:${selectedSourceId}`) {
    return null;
  }
  const source = sources.find((candidate) => candidate.id === selectedSourceId) ?? null;
  if (!source || source.locked) return null;
  return source;
}
