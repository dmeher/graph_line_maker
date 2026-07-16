export type ByteLruEntryOptions<T> = {
  bytes: number;
  dispose?: (value: T) => void;
};

type ByteLruEntry<T> = {
  value: T;
  bytes: number;
  dispose?: (value: T) => void;
};

export class ByteLruCache<K, V> {
  readonly #entries = new Map<K, ByteLruEntry<V>>();
  #bytes = 0;
  readonly maxBytes: number;

  constructor(maxBytes: number) {
    if (!Number.isFinite(maxBytes) || maxBytes < 0) throw new Error("Cache byte budget must be non-negative.");
    this.maxBytes = maxBytes;
  }

  get size() {
    return this.#entries.size;
  }

  get bytes() {
    return this.#bytes;
  }

  has(key: K) {
    return this.#entries.has(key);
  }

  get(key: K) {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, options: ByteLruEntryOptions<V>) {
    const bytes = Math.max(0, Math.round(options.bytes));
    const previous = this.#entries.get(key);
    if (previous) {
      this.#entries.delete(key);
      this.#bytes -= previous.bytes;
      if (previous.value !== value) previous.dispose?.(previous.value);
    }

    if (bytes > this.maxBytes) {
      options.dispose?.(value);
      return false;
    }

    this.#entries.set(key, { value, bytes, dispose: options.dispose });
    this.#bytes += bytes;
    this.#prune();
    return this.#entries.has(key);
  }

  delete(key: K) {
    const entry = this.#entries.get(key);
    if (!entry) return false;
    this.#entries.delete(key);
    this.#bytes -= entry.bytes;
    entry.dispose?.(entry.value);
    return true;
  }

  clear() {
    for (const entry of this.#entries.values()) entry.dispose?.(entry.value);
    this.#entries.clear();
    this.#bytes = 0;
  }

  #prune() {
    while (this.#bytes > this.maxBytes) {
      const oldestKey = this.#entries.keys().next().value as K | undefined;
      if (oldestKey === undefined) break;
      this.delete(oldestKey);
    }
  }
}
