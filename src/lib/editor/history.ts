export type SettingsPatch<T extends object> = {
  key: keyof T;
  before: T[keyof T];
  after: T[keyof T];
};

export type SettingsHistoryCommand<T extends object> = {
  id: string;
  label: string;
  patches: SettingsPatch<T>[];
  estimatedBytes: number;
};

function estimateRetainedBytes(value: unknown, visited: WeakSet<object>): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return 16 + value.length * 2;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return 8;
  if (typeof value !== "object") return 16;
  if (visited.has(value)) return 0;
  visited.add(value);

  if (Array.isArray(value)) {
    return 24 + value.reduce((total, entry) => total + estimateRetainedBytes(entry, visited), 0);
  }

  return 32 + Object.entries(value).reduce(
    (total, [key, entry]) => total + key.length * 2 + estimateRetainedBytes(entry, visited),
    0,
  );
}

function commandId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `history-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((entry, index) => valuesEqual(entry, right[index]));
  }

  const leftEntries = Object.entries(left);
  const rightRecord = right as Record<string, unknown>;
  if (leftEntries.length !== Object.keys(rightRecord).length) return false;
  return leftEntries.every(([key, value]) => Object.prototype.hasOwnProperty.call(rightRecord, key) && valuesEqual(value, rightRecord[key]));
}

export function createSettingsHistoryCommand<T extends object>(
  before: T,
  after: T,
  label = "Edit settings",
): SettingsHistoryCommand<T> | null {
  const patches: SettingsPatch<T>[] = [];
  for (const key of Object.keys(before) as Array<keyof T>) {
    if (valuesEqual(before[key], after[key])) continue;
    patches.push({ key, before: before[key], after: after[key] });
  }
  if (!patches.length) return null;

  const visited = new WeakSet<object>();
  const estimatedBytes = patches.reduce(
    (total, patch) => total + 32 + estimateRetainedBytes(patch.before, visited) + estimateRetainedBytes(patch.after, visited),
    64,
  );
  return { id: commandId(), label, patches, estimatedBytes };
}

export function applySettingsHistoryCommand<T extends object>(
  current: T,
  command: SettingsHistoryCommand<T>,
  direction: "undo" | "redo",
): T {
  const next = { ...current };
  for (const patch of command.patches) {
    next[patch.key] = direction === "undo" ? patch.before : patch.after;
  }
  return next;
}

export function boundSettingsHistory<T extends object>(
  commands: SettingsHistoryCommand<T>[],
  maxCount: number,
  maxBytes: number,
) {
  const bounded = commands.slice(-Math.max(1, maxCount));
  let retainedBytes = bounded.reduce((total, command) => total + command.estimatedBytes, 0);
  while (bounded.length > 1 && retainedBytes > maxBytes) {
    retainedBytes -= bounded[0].estimatedBytes;
    bounded.shift();
  }
  return bounded;
}
